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
    `WITH member_cell AS (
       SELECT DISTINCT ON (mc.member_id)
              mc.member_id, co.id AS community_id, co.name AS community_name
       FROM member_communities mc
       JOIN communities co ON co.id = mc.community_id AND co.type = 'cell'
       ORDER BY mc.member_id, mc.joined_at NULLS LAST
     )
     SELECT a.id, a.method, a.created_at,
            m.id AS member_id, m.name, m.gender, m.photo_url,
            mcel.community_id, mcel.community_name
     FROM attendances a
     JOIN members m ON m.id = a.member_id
     LEFT JOIN member_cell mcel ON mcel.member_id = m.id
     WHERE a.service_id = $1 AND a.date = $2
     ORDER BY a.created_at ASC`,
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

// 지난주 동일 예배 출석자 → 이번주 복사
router.post('/copy-last-week', async (req, res) => {
  const { service_id, date } = req.body
  if (!service_id || !date) return res.status(400).json({ error: 'service_id, date 필수' })

  const d = new Date(date); d.setDate(d.getDate() - 7)
  const lastWeek = d.toISOString().slice(0, 10)
  const { rows: last } = await pool.query(
    'SELECT member_id FROM attendances WHERE service_id = $1 AND date = $2',
    [service_id, lastWeek]
  )
  if (!last.length) return res.json({ copied: 0, lastWeek })

  let copied = 0
  for (const { member_id } of last) {
    const r = await pool.query(
      `INSERT INTO attendances (member_id, service_id, date, method)
       VALUES ($1, $2, $3, 'manual')
       ON CONFLICT (member_id, service_id, date) DO NOTHING`,
      [member_id, service_id, date]
    )
    if (r.rowCount) copied++
  }
  res.json({ copied, lastWeek })
})

export default router
