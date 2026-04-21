import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

router.get('/', async (req, res) => {
  const { member_id, pastor_id, from, to } = req.query
  let where = 'WHERE 1=1'
  const params = []

  if (member_id) { params.push(member_id); where += ` AND pv.member_id = $${params.length}` }
  if (pastor_id) { params.push(pastor_id); where += ` AND pv.pastor_id = $${params.length}` }
  if (from)      { params.push(from);      where += ` AND pv.visit_date >= $${params.length}` }
  if (to)        { params.push(to);        where += ` AND pv.visit_date <= $${params.length}` }

  // is_private 레코드는 추후 JWT 권한 검사로 필터 예정 (지금은 전체 반환)
  const { rows } = await pool.query(
    `SELECT pv.*, m.name AS member_name, u.name AS pastor_name
     FROM pastoral_visits pv
     JOIN members m ON m.id = pv.member_id
     JOIN users u ON u.id = pv.pastor_id
     ${where}
     ORDER BY pv.visit_date DESC`,
    params
  )
  res.json(rows)
})

router.post('/', async (req, res) => {
  const { member_id, pastor_id, visit_date, content, is_private } = req.body
  const { rows } = await pool.query(
    `INSERT INTO pastoral_visits (member_id, pastor_id, visit_date, content, is_private)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [member_id, pastor_id, visit_date, content, is_private ?? false]
  )
  res.status(201).json(rows[0])
})

router.put('/:id', async (req, res) => {
  const { visit_date, content, is_private } = req.body
  const { rows } = await pool.query(
    `UPDATE pastoral_visits SET visit_date=$1, content=$2, is_private=$3
     WHERE id=$4 RETURNING *`,
    [visit_date, content, is_private, req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: '심방 기록을 찾을 수 없습니다.' })
  res.json(rows[0])
})

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM pastoral_visits WHERE id = $1', [req.params.id])
  res.status(204).end()
})

export default router
