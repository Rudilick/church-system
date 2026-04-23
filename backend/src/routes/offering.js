import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 헌금 종류 목록
router.get('/types', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM offering_types WHERE is_active = TRUE ORDER BY id'
  )
  res.json(rows)
})

// 헌금 입력
router.post('/', async (req, res) => {
  const { member_id, offering_type_id, amount, date, memo, name } = req.body
  const { rows } = await pool.query(
    `INSERT INTO offerings (member_id, name, offering_type_id, amount, date, memo)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [member_id ?? null, name || null, offering_type_id, amount, date, memo]
  )
  res.status(201).json(rows[0])
})

// 헌금 수정
router.put('/:id', async (req, res) => {
  const { name, member_id, amount, memo } = req.body
  const { rows } = await pool.query(
    `UPDATE offerings SET name=$1, member_id=$2, amount=$3, memo=$4 WHERE id=$5 RETURNING *`,
    [name || null, member_id ?? null, amount, memo || null, req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: 'not found' })
  res.json(rows[0])
})

// 헌금 이력 조회 (교인별 or 기간별)
router.get('/', async (req, res) => {
  const { member_id, from, to, type_id, page = 1, limit = 50 } = req.query
  const offset = (page - 1) * limit

  let where = 'WHERE 1=1'
  const params = []

  if (member_id) { params.push(member_id); where += ` AND o.member_id = $${params.length}` }
  if (from)      { params.push(from);      where += ` AND o.date >= $${params.length}` }
  if (to)        { params.push(to);        where += ` AND o.date <= $${params.length}` }
  if (type_id)   { params.push(type_id);   where += ` AND o.offering_type_id = $${params.length}` }

  params.push(limit, offset)

  const { rows } = await pool.query(
    `SELECT o.*, COALESCE(m.name, o.name) AS member_name, ot.name AS type_name,
            COUNT(*) OVER() AS total_count
     FROM offerings o
     LEFT JOIN members m ON m.id = o.member_id
     JOIN offering_types ot ON ot.id = o.offering_type_id
     ${where}
     ORDER BY o.date DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  const total = rows[0]?.total_count ?? 0
  res.json({ data: rows, total: Number(total) })
})

// 교인별 헌금 합계 (기부금 영수증용)
router.get('/summary', async (req, res) => {
  const { member_id, year } = req.query
  if (!member_id || !year) return res.status(400).json({ error: 'member_id, year 필수' })

  const { rows } = await pool.query(
    `SELECT ot.name AS type_name, SUM(o.amount)::BIGINT AS total
     FROM offerings o
     JOIN offering_types ot ON ot.id = o.offering_type_id
     WHERE o.member_id = $1
       AND EXTRACT(YEAR FROM o.date) = $2
     GROUP BY ot.id, ot.name
     ORDER BY total DESC`,
    [member_id, year]
  )

  const { rows: memberRows } = await pool.query(
    'SELECT id, name, address FROM members WHERE id = $1',
    [member_id]
  )

  res.json({ member: memberRows[0], year: Number(year), breakdown: rows })
})

// 날짜별 헌금종류별 건수 (타일 카운트용)
router.get('/daily-counts', async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10)
  const { rows } = await pool.query(
    `SELECT offering_type_id, COUNT(*)::INT AS count FROM offerings WHERE date = $1 GROUP BY offering_type_id`,
    [date]
  )
  res.json(rows)
})

// 헌금 삭제
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM offerings WHERE id = $1', [req.params.id])
  res.status(204).end()
})

export default router
