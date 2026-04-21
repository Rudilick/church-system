import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 기간 내 일정 조회
router.get('/', async (req, res) => {
  const { from, to, department_id } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from, to 날짜 필수' })

  let where = 'WHERE e.start_at <= $2 AND e.end_at >= $1'
  const params = [from, to]

  if (department_id) {
    params.push(department_id)
    where += ` AND e.department_id = $${params.length}`
  }

  const { rows } = await pool.query(
    `SELECT e.*, d.name AS department_name, u.name AS created_by_name
     FROM events e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN users u ON u.id = e.created_by
     ${where}
     ORDER BY e.start_at`,
    params
  )
  res.json(rows)
})

router.post('/', async (req, res) => {
  const { title, description, department_id, location, start_at, end_at, is_all_day, recurrence_rule, created_by } = req.body
  const { rows } = await pool.query(
    `INSERT INTO events (title, description, department_id, location, start_at, end_at, is_all_day, recurrence_rule, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [title, description, department_id ?? null, location, start_at, end_at, is_all_day ?? false, recurrence_rule ?? null, created_by ?? null]
  )
  res.status(201).json(rows[0])
})

router.put('/:id', async (req, res) => {
  const { title, description, department_id, location, start_at, end_at, is_all_day, recurrence_rule } = req.body
  const { rows } = await pool.query(
    `UPDATE events SET title=$1, description=$2, department_id=$3, location=$4,
      start_at=$5, end_at=$6, is_all_day=$7, recurrence_rule=$8
     WHERE id=$9 RETURNING *`,
    [title, description, department_id ?? null, location, start_at, end_at, is_all_day, recurrence_rule ?? null, req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: '일정을 찾을 수 없습니다.' })
  res.json(rows[0])
})

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM events WHERE id = $1', [req.params.id])
  res.status(204).end()
})

export default router
