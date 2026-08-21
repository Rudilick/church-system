import pool from '../db/pool.js'
import { sendSms } from './smsService.js'

const EVENT_LABEL = {
  created:  '배차 등록',
  approved: '배차 승인',
  rejected: '배차 거절',
  deleted:  '배차 취소',
}

async function getRecipientPhones() {
  const { rows } = await pool.query('SELECT phone FROM vehicle_notify_recipients')
  return rows.map(r => r.phone).filter(Boolean)
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// pg가 DATE 컬럼을 Date 객체로 돌려주기 때문에(문자열 아님) 문자열 보간 시 그대로 넣으면
// "Fri Aug 28 2026 00:00:00 GMT+0000 (Coordinated Universal Time)"처럼 깨져 나온다.
// 연도는 생략(가까운 미래 알림이라 불필요) — 90byte 단문 기준에 맞추기 위한 압축.
function formatDate(d) {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${m}.${day}(${WEEKDAYS[date.getUTCDay()]})`
}

function formatTime(t) {
  return t ? String(t).slice(0, 5) : ''
}

// 항목별 상한 — 값 하나가 비정상적으로 길어져 메시지 전체가 장문(LMS)으로
// 넘어가는 걸 막기 위한 안전장치. 평소 값들은 이 안쪽이라 잘릴 일이 거의 없다.
function truncate(str, maxChars) {
  const s = str ?? ''
  return s.length > maxChars ? `${s.slice(0, maxChars)}…` : s
}

/**
 * 배차 등록/승인/거절/취소 시 설정된 수신자 목록에 SMS 알림.
 * 알림 발송 실패가 배차 처리 자체를 막지 않도록 항상 내부에서 에러를 흡수한다.
 * @param {object} dispatch  vehicle_dispatches 행 (vehicle_id, requester_name, purpose,
 *                            dispatch_date, end_date, start_time, end_time, rejected_reason 등)
 * @param {'created'|'approved'|'rejected'|'deleted'} event
 */
export async function notifyDispatch(dispatch, event) {
  try {
    const phones = await getRecipientPhones()
    if (!phones.length) return

    const { rows: vRows } = await pool.query('SELECT name FROM vehicles WHERE id = $1', [dispatch.vehicle_id])
    const vehicleName = truncate(vRows[0]?.name ?? '차량', 10)
    const requesterName = truncate(dispatch.requester_name, 6)
    const purpose = truncate(dispatch.purpose, 15)

    const startDate = formatDate(dispatch.dispatch_date)
    const endDate   = formatDate(dispatch.end_date)
    const dateText  = startDate === endDate ? startDate : `${startDate}~${endDate}`

    // 90byte(단문 기준) 안에 들어오면 단문(30원), 넘으면 장문(약 2.5배 비용)으로
    // 자동 전환되므로(smsService의 byte 판정), 웬만하면 90byte 안쪽으로 압축한 형태.
    const label = EVENT_LABEL[event] ?? '배차 알림'
    const lines = [
      `[새김] ${label}`,
      `${vehicleName} ${dateText} ${formatTime(dispatch.start_time)}~${formatTime(dispatch.end_time)}`,
      `${requesterName} · ${purpose}`,
    ]
    if (event === 'rejected' && dispatch.rejected_reason) {
      lines.push(`사유: ${dispatch.rejected_reason}`)
    }

    const result = await sendSms(phones, lines.join('\n'))
    if (!result?.ok) {
      console.error('[차량알림 발송 실패]', event, result?.error)
    } else {
      console.log('[차량알림 발송 성공]', event, `${phones.length}명`)
    }
  } catch (err) {
    console.error('[차량알림 발송 실패]', event, err.message)
  }
}
