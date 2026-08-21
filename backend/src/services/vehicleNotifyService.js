import pool from '../db/pool.js'
import { sendSms } from './smsService.js'

// [새김]과 사이 공백 없이 붙는다. 4자를 넘으면 안전하게 잘라내되(평소엔 정확히 4자라 안 잘림)
// 이 라벨엔 ".." 마커를 붙이지 않는다(붙이면 오히려 어색함).
const EVENT_LABEL = {
  created:  '배차신청',
  approved: '배차승인',
  rejected: '배차거절',
  deleted:  '배차취소',
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

// 분 단위는 생략하고 시(時)까지만
function formatHour(t) {
  return t ? String(t).slice(0, 2) : ''
}

// 차량명·라벨: 상한 넘으면 앞 3글자 + ".."
function truncateWithMark(str, maxChars) {
  const s = str ?? ''
  return s.length > maxChars ? `${s.slice(0, 3)}..` : s
}

// 신청자명: 상한 넘으면 그냥 잘라내기만 (마커 없음)
function truncatePlain(str, maxChars) {
  const s = str ?? ''
  return s.slice(0, maxChars)
}

// 차량번호 뒷자리 숫자 4개만
function plateLast4(plate) {
  const digits = String(plate ?? '').replace(/\D/g, '')
  return digits.slice(-4)
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

    const { rows: vRows } = await pool.query('SELECT name, plate FROM vehicles WHERE id = $1', [dispatch.vehicle_id])
    const vehicleName = truncateWithMark(vRows[0]?.name ?? '차량', 4)
    const plate = plateLast4(vRows[0]?.plate)
    const requesterName = truncatePlain(dispatch.requester_name, 4)

    const startDate = formatDate(dispatch.dispatch_date)
    const endDate   = formatDate(dispatch.end_date)
    const dateText  = startDate === endDate ? startDate : `${startDate}~${endDate}`

    // 4가지 이벤트 모두 맨 윗줄 라벨(2번째 2글자)만 다르고 나머지 내용/줄 수는 완전히 동일하게
    // 고정 — 거절 사유처럼 길이가 들쭉날쭉한 항목을 넣지 않아 90byte 초과 위험을 원천 차단한다.
    const label = truncateWithMark(EVENT_LABEL[event] ?? '배차알림', 4)
    const message = [
      `[새김]${label}`,
      `${vehicleName}${plate ? `(${plate})` : ''}`,
      dateText,
      `${formatHour(dispatch.start_time)}~${formatHour(dispatch.end_time)}시`,
      requesterName,
    ].join('\n')

    const result = await sendSms(phones, message)
    if (!result?.ok) {
      console.error('[차량알림 발송 실패]', event, result?.error)
    } else {
      console.log('[차량알림 발송 성공]', event, `${phones.length}명`)
    }
  } catch (err) {
    console.error('[차량알림 발송 실패]', event, err.message)
  }
}
