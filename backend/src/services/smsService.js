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

// 실제 벤더 발송 함수(sendSms/sendAlimtalk)는 backend/src/services/solapiService.js 참고.
// 이 파일은 벤더 무관 도메인 로직(번호 정규화, 수신거부 필터링)만 담당한다.
