import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 문자나라 API 발송
async function sendMunjanara(receivers, message) {
  const userId   = process.env.MUNJANARA_USER_ID
  const passwd   = process.env.MUNJANARA_PASSWD
  const sender   = process.env.MUNJANARA_SENDER

  if (!userId || !passwd || !sender) {
    return { ok: false, error: '문자나라 환경변수 미설정 (MUNJANARA_USER_ID, MUNJANARA_PASSWD, MUNJANARA_SENDER)' }
  }

  const receiverStr = receivers.join(',')
  // 메시지가 SMS 한도(90bytes) 초과 시 LMS로 전환
  const msgType = Buffer.byteLength(message, 'utf8') > 90 ? 'LMS' : 'SMS'

  const params = new URLSearchParams({
    userid:   userId,
    passwd:   passwd,
    sender:   sender.replace(/-/g, ''),
    receiver: receiverStr.replace(/-/g, ''),
    msg_type: msgType,
    msg:      message,
  })

  try {
    const response = await fetch('https://www.munjanara.co.kr/SMS/api/sendSms.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body:    params.toString(),
    })
    const text = await response.text()
    // 문자나라 응답: "OK" 또는 에러코드
    const ok = text.trim().startsWith('OK')
    return { ok, raw: text.trim() }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

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

// 문자 발송
router.post('/send', async (req, res) => {
  const { sender_id, target_type, target_id, message } = req.body

  if (!message?.trim()) return res.status(400).json({ error: '메시지 내용 필수' })

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

  const phones = recipients.map(r => r.phone).filter(Boolean)

  // 문자나라 API 실제 발송
  let apiResult = { ok: false, error: '환경변수 미설정으로 로그만 저장' }
  if (phones.length > 0 && process.env.MUNJANARA_USER_ID) {
    apiResult = await sendMunjanara(phones, message)
  }

  // 로그 저장
  const { rows } = await pool.query(
    `INSERT INTO sms_logs (sender_id, target_type, target_id, recipient_count, message)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [sender_id, target_type, target_id ?? null, phones.length, message]
  )

  res.status(201).json({
    log:             rows[0],
    recipient_count: phones.length,
    api_ok:          apiResult.ok,
    api_message:     apiResult.ok ? '발송 완료' : (apiResult.error ?? apiResult.raw ?? '발송 실패'),
  })
})

export default router
