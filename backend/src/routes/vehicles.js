import { Router } from 'express'
import pool from '../db/pool.js'
import { normalizePhone } from '../services/smsService.js'
import { notifyDispatch } from '../services/vehicleNotifyService.js'

const router = Router()

// ── 차량 목록 ────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM vehicles ORDER BY is_active DESC, name`
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── 차량 등록 ────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, plate, capacity, manager_phone } = req.body
  if (!name || !plate) return res.status(400).json({ error: '차량명과 번호판은 필수입니다.' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO vehicles (name, plate, capacity, manager_phone)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, plate, capacity || null, manager_phone || null]
    )
    res.status(201).json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── 차량 수정 ────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const { name, plate, capacity, manager_phone, is_active } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE vehicles SET
         name          = COALESCE($1, name),
         plate         = COALESCE($2, plate),
         capacity      = COALESCE($3, capacity),
         manager_phone = COALESCE($4, manager_phone),
         is_active     = COALESCE($5, is_active)
       WHERE id = $6 RETURNING *`,
      [name, plate, capacity, manager_phone, is_active, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: '차량을 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── 배차 목록 조회 ───────────────────────────────────────────────
router.get('/dispatches', async (req, res) => {
  const { date, vehicle_id, status, from, to } = req.query
  const conditions = []
  const params = []

  if (date) {
    params.push(date)
    conditions.push(`vd.dispatch_date <= $${params.length} AND vd.end_date >= $${params.length}`)
  }
  if (from && to) {
    params.push(from); conditions.push(`vd.dispatch_date >= $${params.length}`)
    params.push(to);   conditions.push(`vd.dispatch_date <= $${params.length}`)
  }
  if (vehicle_id) {
    params.push(vehicle_id)
    conditions.push(`vd.vehicle_id = $${params.length}`)
  }
  if (status) {
    params.push(status)
    conditions.push(`vd.status = $${params.length}`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  try {
    const { rows } = await pool.query(
      `SELECT vd.*, v.name AS vehicle_name, v.plate AS vehicle_plate, v.capacity
       FROM vehicle_dispatches vd
       JOIN vehicles v ON v.id = vd.vehicle_id
       ${where}
       ORDER BY vd.dispatch_date, vd.start_time`,
      params
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── 배차 승인/거절 ───────────────────────────────────────────────
router.patch('/dispatches/:id', async (req, res) => {
  const { status, rejected_reason } = req.body
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: '유효하지 않은 상태값입니다.' })
  }
  try {
    const { rows } = await pool.query(
      `UPDATE vehicle_dispatches
       SET status = $1, rejected_reason = $2
       WHERE id = $3 RETURNING *`,
      [status, rejected_reason || null, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: '배차 신청을 찾을 수 없습니다.' })
    if (status === 'approved' || status === 'rejected') {
      notifyDispatch(rows[0], status === 'approved' ? 'approved' : 'rejected')
    }
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── 배차 삭제(취소) ──────────────────────────────────────────────
router.delete('/dispatches/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM vehicle_dispatches WHERE id = $1', [req.params.id])
    await pool.query('DELETE FROM vehicle_dispatches WHERE id = $1', [req.params.id])
    if (rows.length) notifyDispatch(rows[0], 'deleted')
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── 차량별 고정배차(반복 운행) 목록 ────────────────────────────────
router.get('/:vehicleId/recurring-schedules', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM vehicle_recurring_schedules
       WHERE vehicle_id = $1 AND is_active = true
       ORDER BY recurrence_type, day_of_week, day_of_month, start_time`,
      [req.params.vehicleId]
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── 고정배차 등록 ──────────────────────────────────────────────────
router.post('/:vehicleId/recurring-schedules', async (req, res) => {
  const { title, recurrence_type, day_of_week, day_of_month, start_time, end_time } = req.body
  if (!title?.trim() || !start_time || !end_time) {
    return res.status(400).json({ error: '운행목적, 시작·종료 시간은 필수입니다.' })
  }
  if (!['daily', 'weekly', 'monthly'].includes(recurrence_type)) {
    return res.status(400).json({ error: '유효하지 않은 주기입니다.' })
  }
  if (recurrence_type === 'weekly' && (day_of_week === undefined || day_of_week === null)) {
    return res.status(400).json({ error: '매주 반복은 요일을 선택해야 합니다.' })
  }
  if (recurrence_type === 'monthly' && !day_of_month) {
    return res.status(400).json({ error: '매월 반복은 날짜를 선택해야 합니다.' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO vehicle_recurring_schedules
         (vehicle_id, title, recurrence_type, day_of_week, day_of_month, start_time, end_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.vehicleId, title.trim(), recurrence_type,
       recurrence_type === 'weekly' ? day_of_week : null,
       recurrence_type === 'monthly' ? day_of_month : null,
       start_time, end_time]
    )
    res.status(201).json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── 고정배차 수정 ──────────────────────────────────────────────────
router.patch('/recurring-schedules/:id', async (req, res) => {
  const { title, recurrence_type, day_of_week, day_of_month, start_time, end_time, is_active } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE vehicle_recurring_schedules SET
         title           = COALESCE($1, title),
         recurrence_type = COALESCE($2, recurrence_type),
         day_of_week     = $3,
         day_of_month    = $4,
         start_time      = COALESCE($5, start_time),
         end_time        = COALESCE($6, end_time),
         is_active       = COALESCE($7, is_active)
       WHERE id = $8 RETURNING *`,
      [title ?? null, recurrence_type ?? null,
       day_of_week ?? null, day_of_month ?? null,
       start_time ?? null, end_time ?? null, is_active ?? null, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: '고정배차 일정을 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── 고정배차 삭제 ──────────────────────────────────────────────────
router.delete('/recurring-schedules/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM vehicle_recurring_schedules WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── 배차 알림 수신자 관리 ────────────────────────────────────────
router.get('/notify-recipients', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, phone FROM vehicle_notify_recipients ORDER BY id'
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/notify-recipients', async (req, res) => {
  const { name, phone } = req.body
  const { normalized, valid } = normalizePhone(phone)
  if (!valid) return res.status(400).json({ error: '올바른 휴대폰 번호를 입력하세요.' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO vehicle_notify_recipients (name, phone) VALUES ($1, $2) RETURNING id, name, phone`,
      [name || null, normalized]
    )
    res.status(201).json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/notify-recipients/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM vehicle_notify_recipients WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
