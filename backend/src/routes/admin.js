import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

const VALID_ROLES = ['super_admin', 'church_admin', 'pastor', 'teacher', 'finance', 'member']

// GET /api/admin/users/stats — 역할별 카운트
router.get('/users/stats', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT role, COUNT(*)::int AS count
    FROM users
    GROUP BY role
    ORDER BY role
  `)
  const total = await pool.query(`SELECT COUNT(*)::int AS count FROM users`)
  const active = await pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE is_active = true`)
  res.json({
    byRole: rows,
    total: total.rows[0].count,
    active: active.rows[0].count,
  })
})

// GET /api/admin/users — 사용자 목록
router.get('/users', async (req, res) => {
  const { q } = req.query
  let query = `
    SELECT id, email, name, picture, role, church_id, department, is_active, created_at, updated_at
    FROM users
  `
  const params = []
  if (q) {
    query += ` WHERE email ILIKE $1 OR name ILIKE $1`
    params.push(`%${q}%`)
  }
  query += ` ORDER BY created_at DESC`
  const { rows } = await pool.query(query, params)
  res.json(rows)
})

// POST /api/admin/users — 사용자 등록
router.post('/users', async (req, res) => {
  const { email, name, google_user_id, role, church_id, department } = req.body
  if (!email || !name) return res.status(400).json({ error: 'email, name 필수' })
  if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: '유효하지 않은 role' })

  // church_admin은 자기 church_id 소속 사용자만 등록 가능
  const targetChurchId = req.user.role === 'super_admin'
    ? (church_id ?? req.user.church_id)
    : req.user.church_id

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, name, google_user_id, role, church_id, department, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, email, name, role, church_id, department, is_active, created_at`,
      [email, name, google_user_id || null, role || 'member', targetChurchId, department || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: '이미 등록된 이메일 또는 Google 계정입니다.' })
    throw err
  }
})

// PUT /api/admin/users/:id — 사용자 정보 수정
router.put('/users/:id', async (req, res) => {
  const { id } = req.params
  const { role, church_id, department, is_active, name, google_user_id } = req.body

  // church_admin은 자기 church_id 소속 사용자만 수정 가능
  if (req.user.role === 'church_admin') {
    const { rows } = await pool.query('SELECT church_id FROM users WHERE id=$1', [id])
    if (!rows.length) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })
    if (rows[0].church_id !== req.user.church_id) {
      return res.status(403).json({ error: '다른 교회 사용자를 수정할 수 없습니다.' })
    }
    // church_admin은 super_admin을 만들 수 없음
    if (role === 'super_admin') return res.status(403).json({ error: '권한이 없습니다.' })
  }

  if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: '유효하지 않은 role' })

  const fields = []
  const vals = []
  let idx = 1

  if (role !== undefined)           { fields.push(`role=$${idx++}`);           vals.push(role) }
  if (church_id !== undefined)      { fields.push(`church_id=$${idx++}`);      vals.push(church_id) }
  if (department !== undefined)     { fields.push(`department=$${idx++}`);     vals.push(department) }
  if (is_active !== undefined)      { fields.push(`is_active=$${idx++}`);      vals.push(is_active) }
  if (name !== undefined)           { fields.push(`name=$${idx++}`);           vals.push(name) }
  if (google_user_id !== undefined) { fields.push(`google_user_id=$${idx++}`); vals.push(google_user_id) }

  if (!fields.length) return res.status(400).json({ error: '수정할 필드가 없습니다.' })

  fields.push(`updated_at=NOW()`)
  vals.push(id)

  const { rows } = await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id=$${idx} RETURNING id, email, name, role, church_id, department, is_active, updated_at`,
    vals
  )
  if (!rows.length) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })
  res.json(rows[0])
})

// DELETE /api/admin/users/:id — 비활성화 (soft delete)
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params

  // 자기 자신은 비활성화 불가
  if (Number(id) === req.user.id) {
    return res.status(400).json({ error: '자기 자신은 비활성화할 수 없습니다.' })
  }

  if (req.user.role === 'church_admin') {
    const { rows } = await pool.query('SELECT church_id, role FROM users WHERE id=$1', [id])
    if (!rows.length) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })
    if (rows[0].church_id !== req.user.church_id) {
      return res.status(403).json({ error: '다른 교회 사용자를 삭제할 수 없습니다.' })
    }
    if (rows[0].role === 'super_admin') {
      return res.status(403).json({ error: '권한이 없습니다.' })
    }
  }

  const { rows } = await pool.query(
    `UPDATE users SET is_active=false, updated_at=NOW() WHERE id=$1 RETURNING id, email, name, is_active`,
    [id]
  )
  if (!rows.length) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })
  res.json(rows[0])
})

export default router
