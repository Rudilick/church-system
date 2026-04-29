import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 목록 조회
router.get('/', async (req, res) => {
  const { member_id, status } = req.query
  let where = 'WHERE 1=1'
  const params = []

  if (member_id) { params.push(member_id); where += ` AND pr.member_id = $${params.length}` }
  if (status)    { params.push(status);    where += ` AND pr.status = $${params.length}` }

  const { rows } = await pool.query(
    `SELECT pr.*, m.name AS member_name, m.photo_url
     FROM prayer_requests pr
     JOIN members m ON m.id = pr.member_id
     ${where}
     ORDER BY pr.created_at DESC`,
    params
  )
  res.json(rows)
})

// 등록
router.post('/', async (req, res) => {
  const { member_id, content } = req.body
  const created_by = req.user.id
  const { rows } = await pool.query(
    `INSERT INTO prayer_requests (member_id, content, created_by)
     VALUES ($1, $2, $3) RETURNING *`,
    [member_id, content, created_by]
  )
  res.status(201).json(rows[0])
})

// 상태 변경 (응답 처리)
router.put('/:id', async (req, res) => {
  const { status, answer_note } = req.body
  const answered_at = status === 'answered' ? new Date().toISOString() : null
  const { rows } = await pool.query(
    `UPDATE prayer_requests
     SET status=$1, answer_note=$2, answered_at=$3
     WHERE id=$4 RETURNING *`,
    [status, answer_note ?? null, answered_at, req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: '기도제목을 찾을 수 없습니다.' })
  res.json(rows[0])
})

// 삭제
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM prayer_requests WHERE id = $1', [req.params.id])
  res.status(204).end()
})

export default router
