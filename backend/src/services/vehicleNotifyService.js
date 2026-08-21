import pool from '../db/pool.js'
import { sendSms } from './smsService.js'

const EVENT_LABEL = {
  created:  '🚗 배차 신청 등록',
  approved: '✅ 배차 승인',
  rejected: '❌ 배차 거절',
  deleted:  '🚫 배차 취소',
}

async function getRecipientPhones() {
  const { rows } = await pool.query('SELECT phone FROM vehicle_notify_recipients')
  return rows.map(r => r.phone).filter(Boolean)
}

function formatTime(t) {
  return t ? String(t).slice(0, 5) : ''
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
    const vehicleName = vRows[0]?.name ?? '차량'

    const dateText = dispatch.dispatch_date === dispatch.end_date
      ? dispatch.dispatch_date
      : `${dispatch.dispatch_date}~${dispatch.end_date}`

    const label = EVENT_LABEL[event] ?? '배차 알림'
    const lines = [
      `[${label}]`,
      `${vehicleName} · ${dateText} ${formatTime(dispatch.start_time)}~${formatTime(dispatch.end_time)}`,
      `신청자: ${dispatch.requester_name}`,
      `목적: ${dispatch.purpose}`,
    ]
    if (event === 'rejected' && dispatch.rejected_reason) {
      lines.push(`사유: ${dispatch.rejected_reason}`)
    }

    await sendSms(phones, lines.join('\n'))
  } catch (err) {
    console.error('[차량알림 발송 실패]', err.message)
  }
}
