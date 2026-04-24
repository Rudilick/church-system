import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import pool from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

// POST /api/auth/google — Google ID token 검증 후 자체 JWT 발급
router.post('/google', async (req, res) => {
  const { credential } = req.body
  if (!credential) return res.status(400).json({ error: 'credential 필수' })

  // 1. Google ID token 검증
  let payload
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
    payload = ticket.getPayload()
  } catch (err) {
    console.error('[auth] Google 토큰 검증 실패:', err.message)
    return res.status(401).json({ error: '구글 토큰 검증 실패' })
  }

  const { sub, email, name, picture } = payload

  // 개발 시 google_user_id(sub) 확인용 로그 — super_admin 등록에 필요
  console.log(`[auth] 로그인 시도: email=${email}, google_sub=${sub}`)

  // 2. DB에서 사용자 조회 — google_user_id 우선, 없으면 email로 fallback
  let { rows } = await pool.query(
    'SELECT * FROM users WHERE google_user_id = $1',
    [sub]
  )

  // 이메일로 재조회 (관리자가 이메일만으로 미리 등록한 경우)
  if (!rows.length) {
    const byEmail = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )
    rows = byEmail.rows
  }

  // 2-1. 미등록 사용자
  if (!rows.length) {
    return res.status(403).json({
      error: 'NOT_REGISTERED',
      googleInfo: { sub, email, name, picture },
    })
  }

  const user = rows[0]

  // 2-2. 비활성 사용자
  if (!user.is_active) {
    return res.status(403).json({
      error: 'INACTIVE',
      googleInfo: { sub, email, name, picture },
    })
  }

  // 3. google_user_id 자동 연결 + 이름/사진 최신화
  await pool.query(
    'UPDATE users SET google_user_id=$1, name=$2, picture=$3, updated_at=NOW() WHERE id=$4',
    [sub, name, picture, user.id]
  )

  // 4. 자체 JWT 발급
  const token = jwt.sign(
    {
      id:             user.id,
      google_user_id: user.google_user_id,
      email:          user.email,
      name,
      picture,
      role:           user.role,
      church_id:      user.church_id,
      department:     user.department,
      is_active:      user.is_active,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  res.json({
    token,
    user: {
      id:         user.id,
      email:      user.email,
      name,
      picture,
      role:       user.role,
      church_id:  user.church_id,
      department: user.department,
      is_active:  user.is_active,
    },
  })
})

// GET /api/auth/me — 현재 로그인 사용자 정보 (토큰 갱신 없이 최신 DB 값 반환)
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, email, name, picture, role, church_id, department, is_active FROM users WHERE id=$1',
    [req.user.id]
  )
  if (!rows.length) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })
  res.json(rows[0])
})

// POST /api/auth/logout — 클라이언트 JWT 삭제 방식이므로 서버는 200만 반환
router.post('/logout', (_req, res) => res.json({ ok: true }))

export default router
