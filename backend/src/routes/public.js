import { Router } from 'express'
import pool from '../db/pool.js'
import { notifyDispatch } from '../services/vehicleNotifyService.js'

const router = Router()

// 부서 목록 (인증 불필요 — 모바일 입력 페이지용)
router.get('/departments', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, parent_id, sort_order, is_budget_dept FROM departments ORDER BY sort_order, name'
  )
  res.json(rows)
})

// 지출 입력 (인증 불필요 — 모바일 입력 페이지용)
router.post('/expenses', async (req, res) => {
  const { department_id, date, description, amount, memo, receipt_url, author_name } = req.body
  if (!date || !description || amount === undefined || amount === '') {
    return res.status(400).json({ error: '날짜, 지출내용, 금액은 필수입니다.' })
  }
  const { rows } = await pool.query(
    `INSERT INTO expenses (department_id, date, description, amount, memo, receipt_url, author_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [department_id || null, date, description, Number(amount), memo || null, receipt_url || null, author_name || null]
  )
  res.status(201).json({ id: rows[0].id, message: '저장되었습니다.' })
})

// ── 차량 목록 (인증 불필요 — 배차 신청 페이지용) ─────────────────
router.get('/vehicles', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, plate, capacity FROM vehicles WHERE is_active = true ORDER BY name`
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── 특정 날짜·차량 기존 배차 조회 (공개 — 신청 전 확인용) ─────────
// 다중일(date 범위) 배차도 조회 대상 날짜에 걸쳐 있으면 함께 반환한다.
router.get('/vehicle-dispatch', async (req, res) => {
  const { vehicle_id, date } = req.query
  if (!vehicle_id || !date) return res.status(400).json({ error: '차량과 날짜는 필수입니다.' })
  try {
    const { rows } = await pool.query(
      `SELECT dispatch_date, end_date, start_time, end_time, purpose, status
       FROM vehicle_dispatches
       WHERE vehicle_id = $1 AND dispatch_date <= $2 AND end_date >= $2 AND status != 'rejected'
       ORDER BY dispatch_date, start_time`,
      [vehicle_id, date]
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── 배차 신청 (인증 불필요) ───────────────────────────────────────
router.post('/vehicle-dispatch', async (req, res) => {
  const {
    vehicle_id, requester_name, requester_phone, department,
    purpose, dispatch_date, end_date, start_time, end_time, passenger_count, memo
  } = req.body

  const usageEndDate = end_date || dispatch_date

  if (!vehicle_id || !requester_name || !requester_phone || !purpose || !dispatch_date || !usageEndDate || !start_time || !end_time) {
    return res.status(400).json({ error: '필수 항목을 모두 입력해주세요.' })
  }
  if (usageEndDate < dispatch_date) {
    return res.status(400).json({ error: '종료일은 시작일보다 빠를 수 없습니다.' })
  }
  if (dispatch_date === usageEndDate && start_time >= end_time) {
    return res.status(400).json({ error: '종료 시간은 시작 시간보다 늦어야 합니다.' })
  }

  try {
    // 중복 배차 체크 — 사용 기간(시작일+시작시간 ~ 종료일+종료시간)이 겹치는지 확인
    const overlap = await pool.query(
      `SELECT id FROM vehicle_dispatches
       WHERE vehicle_id = $1
         AND status != 'rejected'
         AND (dispatch_date + start_time, end_date + end_time)
             OVERLAPS ($2::date + $4::time, $3::date + $5::time)`,
      [vehicle_id, dispatch_date, usageEndDate, start_time, end_time]
    )
    if (overlap.rows.length > 0) {
      return res.status(409).json({ error: '해당 기간에 이미 배차 신청이 있습니다. 다른 일정을 선택해주세요.' })
    }

    const { rows } = await pool.query(
      `INSERT INTO vehicle_dispatches
         (vehicle_id, requester_name, requester_phone, department, purpose,
          dispatch_date, end_date, start_time, end_time, passenger_count, memo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [vehicle_id, requester_name, requester_phone, department || null,
       purpose, dispatch_date, usageEndDate, start_time, end_time,
       passenger_count || null, memo || null]
    )

    notifyDispatch(rows[0], 'created')
    res.status(201).json({ id: rows[0].id, message: '배차 신청이 완료되었습니다.' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
