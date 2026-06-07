import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// ── 알림 stub (SMS API 연동 시 이 함수만 채우면 됨) ──────────────
async function notifyDispatch(dispatch, type = 'new') {
  // TODO: sendMunjanara() 연동
  // type: 'new' | 'reminder'
  console.log(`[차량알림 stub] type=${type}`, dispatch.id, dispatch.vehicle_name, dispatch.dispatch_date)
}

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
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── 배차 삭제 ────────────────────────────────────────────────────
router.delete('/dispatches/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM vehicle_dispatches WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export { notifyDispatch }
export default router
