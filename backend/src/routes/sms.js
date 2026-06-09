import { Router } from 'express'
import pool from '../db/pool.js'
import { sendMunjanara, normalizePhone, filterOptedOut } from '../services/smsService.js'

const router = Router()

// 발송 가능한 역할
const SMS_ROLES = ['super_admin', 'church_admin', 'pastor', 'teacher', 'finance']

// ── 수신 대상 번호 수집 (target_type / target_id / member_ids) ──
async function collectRecipients(targetType, targetId, memberIds) {
  let rows = []

  if (targetType === 'all') {
    const r = await pool.query(
      `SELECT id, name, phone FROM members
       WHERE membership_type = 'active' AND phone IS NOT NULL AND phone <> ''`
    )
    rows = r.rows
  } else if (targetType === 'community') {
    const r = await pool.query(
      `SELECT m.id, m.name, m.phone
       FROM member_communities mc JOIN members m ON m.id = mc.member_id
       WHERE mc.community_id = $1 AND m.phone IS NOT NULL AND m.phone <> ''`,
      [targetId]
    )
    rows = r.rows
  } else if (targetType === 'department') {
    const r = await pool.query(
      `SELECT m.id, m.name, m.phone
       FROM department_members dm JOIN members m ON m.id = dm.member_id
       WHERE dm.department_id = $1 AND m.phone IS NOT NULL AND m.phone <> ''`,
      [targetId]
    )
    rows = r.rows
  } else if (targetType === 'individual' && Array.isArray(memberIds) && memberIds.length > 0) {
    const r = await pool.query(
      `SELECT id, name, phone FROM members
       WHERE id = ANY($1) AND phone IS NOT NULL AND phone <> ''`,
      [memberIds]
    )
    rows = r.rows
  }

  return rows
}

// ── 발송 전 미리보기 (GET /api/sms/preview) ──────────────────────
router.get('/preview', async (req, res) => {
  try {
    const { target_type, target_id, member_ids } = req.query
    const memberIdsArr = member_ids
      ? JSON.parse(member_ids).map(Number)
      : undefined

    const members = await collectRecipients(target_type, target_id, memberIdsArr)

    // 유효 번호 필터
    const valid = members.filter(m => normalizePhone(m.phone).valid)

    // opt-out 제외
    const validIds = valid.map(m => m.id)
    const { allowed, excluded } = await filterOptedOut(validIds)

    const allowedSet = new Set(allowed)
    const phones = valid
      .filter(m => allowedSet.has(m.id))
      .map(m => {
        const p = normalizePhone(m.phone).normalized
        return p.slice(0, 3) + '-****-' + p.slice(-4)  // 마스킹
      })

    res.json({
      total:    phones.length,
      excluded: excluded.length,
      phones,
    })
  } catch (err) {
    console.error('[sms preview]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── 수신 거부 목록 조회 (GET /api/sms/opt-out) ───────────────────
router.get('/opt-out', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT o.member_id, o.opted_out_at, o.reason, m.name, m.phone
     FROM member_sms_opt_out o JOIN members m ON m.id = o.member_id
     ORDER BY o.opted_out_at DESC`
  )
  res.json(rows)
})

// ── 수신 거부 등록 (POST /api/sms/opt-out) ──────────────────────
router.post('/opt-out', async (req, res) => {
  const { member_id, reason } = req.body
  if (!member_id) return res.status(400).json({ error: 'member_id 필수' })
  await pool.query(
    `INSERT INTO member_sms_opt_out (member_id, reason)
     VALUES ($1, $2)
     ON CONFLICT (member_id) DO UPDATE SET opted_out_at = NOW(), reason = $2`,
    [member_id, reason ?? null]
  )
  res.status(201).json({ ok: true })
})

// ── 수신 거부 해제 (DELETE /api/sms/opt-out/:memberId) ───────────
router.delete('/opt-out/:memberId', async (req, res) => {
  await pool.query(`DELETE FROM member_sms_opt_out WHERE member_id = $1`, [req.params.memberId])
  res.json({ ok: true })
})

// ── 발송 이력 조회 (GET /api/sms) ───────────────────────────────
router.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT sl.*, u.name AS sender_name
     FROM sms_logs sl
     LEFT JOIN users u ON u.id = sl.sender_id
     ORDER BY sl.sent_at DESC LIMIT 100`
  )
  res.json(rows)
})

// ── 문자 발송 (POST /api/sms/send) ──────────────────────────────
router.post('/send', async (req, res) => {
  // 역할 검사
  if (!SMS_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ error: '문자 발송 권한이 없습니다.' })
  }

  const { target_type, target_id, member_ids: memberIdsRaw, message } = req.body
  const senderId = req.user.id  // 프론트 body의 sender_id는 무시

  if (!message?.trim()) return res.status(400).json({ error: '메시지 내용 필수' })

  const memberIdsArr = Array.isArray(memberIdsRaw) ? memberIdsRaw.map(Number) : undefined

  // 수신 대상 수집
  const members = await collectRecipients(target_type, target_id, memberIdsArr)

  // 유효 번호 필터
  const valid = members
    .map(m => ({ ...m, norm: normalizePhone(m.phone) }))
    .filter(m => m.norm.valid)

  // opt-out 제외
  const validIds = valid.map(m => m.id)
  const { allowed, excluded } = await filterOptedOut(validIds)
  const allowedSet = new Set(allowed)

  const finalMembers = valid.filter(m => allowedSet.has(m.id))
  const phones = finalMembers.map(m => m.norm.normalized)

  // 문자나라 API 발송
  let apiResult = { ok: false, msgType: 'SMS', error: '수신자 없음' }
  if (phones.length > 0) {
    apiResult = await sendMunjanara(phones, message)
  }

  // 로그 저장
  const { rows } = await pool.query(
    `INSERT INTO sms_logs
       (sender_id, target_type, target_id, recipient_count, message, msg_type, api_response)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      senderId,
      target_type,
      target_id ?? null,
      phones.length,
      message,
      apiResult.msgType ?? 'SMS',
      apiResult.raw ?? apiResult.error ?? null,
    ]
  )

  res.status(201).json({
    log:             rows[0],
    recipient_count: phones.length,
    excluded_count:  excluded.length,
    api_ok:          apiResult.ok,
    api_message:     apiResult.ok
      ? `${phones.length}명 발송 완료`
      : (apiResult.error ?? apiResult.raw ?? '발송 실패'),
  })
})

export default router
