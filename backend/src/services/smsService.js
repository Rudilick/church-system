import pool from '../db/pool.js'
import { sendSms as sendSmsSolapi } from './solapiService.js'
import { sendSms as sendSmsMunjanara } from './munjanaraService.js'

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
 * 일반 SMS/LMS 발송 — SMS_PROVIDER 환경변수(munjanara | 기본 solapi)에 따라 벤더 선택.
 * 카카오 알림톡(sendAlimtalk)은 벤더 지원 범위가 달라 항상 solapiService.js를 직접 사용한다.
 */
export const sendSms = process.env.SMS_PROVIDER === 'munjanara' ? sendSmsMunjanara : sendSmsSolapi
