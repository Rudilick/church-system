import pool from '../db/pool.js'

/**
 * 전화번호 정규화: 하이픈 제거 후 11자리 숫자 검증
 * @returns {{ normalized: string|null, valid: boolean }}
 */
export function normalizePhone(phone) {
  if (!phone) return { normalized: null, valid: false }
  const normalized = String(phone).replace(/\D/g, '')
  const valid = /^(010|011|016|017|018|019)\d{7,8}$/.test(normalized)
  return { normalized, valid }
}

/**
 * opt-out 교인 필터링
 * @param {number[]} memberIds
 * @returns {{ allowed: number[], excluded: number[] }}
 */
export async function filterOptedOut(memberIds) {
  if (!memberIds?.length) return { allowed: [], excluded: [] }
  const { rows } = await pool.query(
    `SELECT member_id FROM member_sms_opt_out WHERE member_id = ANY($1)`,
    [memberIds]
  )
  const excludedSet = new Set(rows.map(r => r.member_id))
  const allowed   = memberIds.filter(id => !excludedSet.has(id))
  const excluded  = memberIds.filter(id =>  excludedSet.has(id))
  return { allowed, excluded }
}

/**
 * 문자나라 API 발송
 * 환경변수: MUNJANARA_USER_ID, MUNJANARA_PASSWD, MUNJANARA_SENDER
 * @param {string[]} phones  정규화된 전화번호 배열
 * @param {string}   message 발송 메시지
 * @returns {{ ok: boolean, msgType: string, raw?: string, error?: string }}
 */
export async function sendMunjanara(phones, message) {
  const userId = process.env.MUNJANARA_USER_ID
  const passwd = process.env.MUNJANARA_PASSWD
  const sender = process.env.MUNJANARA_SENDER

  if (!userId || !passwd || !sender) {
    return { ok: false, msgType: 'SMS', error: '문자나라 환경변수 미설정 (MUNJANARA_USER_ID, MUNJANARA_PASSWD, MUNJANARA_SENDER)' }
  }

  const msgType = Buffer.byteLength(message, 'utf8') > 90 ? 'LMS' : 'SMS'

  const params = new URLSearchParams({
    userid:   userId,
    passwd:   passwd,
    sender:   sender.replace(/-/g, ''),
    receiver: phones.join(','),
    msg_type: msgType,
    msg:      message,
  })

  try {
    const response = await fetch('https://www.munjanara.co.kr/SMS/api/sendSms.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body:    params.toString(),
    })
    const raw = (await response.text()).trim()
    const ok  = raw.startsWith('OK')
    return { ok, msgType, raw }
  } catch (err) {
    return { ok: false, msgType, error: err.message }
  }
}
