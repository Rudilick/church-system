import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 발송 이력 조회
router.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT sl.*, u.name AS sender_name
     FROM sms_logs sl
     LEFT JOIN users u ON u.id = sl.sender_id
     ORDER BY sl.sent_at DESC LIMIT 100`
  )
  res.json(rows)
})

// 문자 발송 (SMS API 연동은 추후 - 지금은 로그만 저장)
router.post('/send', async (req, res) => {
  const { sender_id, target_type, target_id, message } = req.body

  // 수신 대상 번호 수집
  let recipients = []
  if (target_type === 'all') {
    const { rows } = await pool.query(
      "SELECT phone FROM members WHERE membership_type = 'active' AND phone IS NOT NULL"
    )
    recipients = rows
  } else if (target_type === 'community') {
    const { rows } = await pool.query(
      `SELECT m.phone FROM member_communities mc
       JOIN members m ON m.id = mc.member_id
       WHERE mc.community_id = $1 AND m.phone IS NOT NULL`,
      [target_id]
    )
    recipients = rows
  } else if (target_type === 'department') {
    const { rows } = await pool.query(
      `SELECT m.phone FROM department_members dm
       JOIN members m ON m.id = dm.member_id
       WHERE dm.department_id = $1 AND m.phone IS NOT NULL`,
      [target_id]
    )
    recipients = rows
  }

  // TODO: 실제 SMS API 호출 (알리고 or 솔라피) — API 키 확정 후 연동

  const { rows } = await pool.query(
    `INSERT INTO sms_logs (sender_id, target_type, target_id, recipient_count, message)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [sender_id, target_type, target_id ?? null, recipients.length, message]
  )

  res.status(201).json({ log: rows[0], recipient_count: recipients.length })
})

export default router
