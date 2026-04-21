import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 예배 목록
router.get('/services', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM services WHERE is_active = TRUE ORDER BY day_of_week, start_time'
  )
  res.json(rows)
})

// 특정 날짜 + 예배의 출석 목록
router.get('/', async (req, res) => {
  const { service_id, date } = req.query
  if (!service_id || !date) return res.status(400).json({ error: 'service_id, date 필수' })

  const { rows } = await pool.query(
    `SELECT a.id, a.method, a.created_at,
            m.id AS member_id, m.name, m.gender, m.photo_url
     FROM attendances a
     JOIN members m ON m.id = a.member_id
     WHERE a.service_id = $1 AND a.date = $2
     ORDER BY m.name`,
    [service_id, date]
  )
  res.json(rows)
})

// 출석 입력 (수동)
router.post('/', async (req, res) => {
  const { member_id, service_id, date, method = 'manual' } = req.body
  const { rows } = await pool.query(
    `INSERT INTO attendances (member_id, service_id, date, method)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (member_id, service_id, date) DO UPDATE SET method = $4
     RETURNING *`,
    [member_id, service_id, date, method]
  )
  res.status(201).json(rows[0])
})

// QR 스캔으로 출석 처리
router.post('/qr', async (req, res) => {
  const { token, service_id, date } = req.body

  const { rows: tokenRows } = await pool.query(
    'SELECT member_id FROM qr_tokens WHERE token = $1',
    [token]
  )
  if (!tokenRows.length) return res.status(404).json({ error: '유효하지 않은 QR 코드입니다.' })

  const { member_id } = tokenRows[0]
  const { rows } = await pool.query(
    `INSERT INTO attendances (member_id, service_id, date, method)
     VALUES ($1, $2, $3, 'qr')
     ON CONFLICT (member_id, service_id, date) DO UPDATE SET method = 'qr'
     RETURNING *`,
    [member_id, service_id, date]
  )

  const { rows: memberRows } = await pool.query(
    'SELECT id, name, photo_url FROM members WHERE id = $1',
    [member_id]
  )

  res.json({ attendance: rows[0], member: memberRows[0] })
})

// 출석 삭제
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM attendances WHERE id = $1', [req.params.id])
  res.status(204).end()
})

// 통계 — 기간별/예배별 집계
router.get('/stats', async (req, res) => {
  const { from, to, service_id } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from, to 날짜 필수' })

  let where = 'WHERE a.date BETWEEN $1 AND $2'
  const params = [from, to]

  if (service_id) {
    params.push(service_id)
    where += ` AND a.service_id = $${params.length}`
  }

  const { rows } = await pool.query(
    `SELECT a.date, s.name AS service_name, COUNT(*) AS count
     FROM attendances a
     JOIN services s ON s.id = a.service_id
     ${where}
     GROUP BY a.date, s.id, s.name
     ORDER BY a.date, s.name`,
    params
  )
  res.json(rows)
})

export default router
