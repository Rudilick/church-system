import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 내 To-do 목록
router.get('/', async (req, res) => {
  const userId = req.user.id
  const today = new Date().toISOString().slice(0, 10)
  // done 항목은 오늘 완료된 것만 포함
  const { rows } = await pool.query(
    `SELECT * FROM todo_items
     WHERE user_id = $1
       AND (status != 'done' OR DATE(completed_at) = $2)
     ORDER BY importance DESC, created_at ASC`,
    [userId, today]
  )
  res.json(rows)
})

// 추가
router.post('/', async (req, res) => {
  const { content, importance = false, due_date } = req.body
  if (!content?.trim()) return res.status(400).json({ error: '내용을 입력하세요.' })
  const { rows } = await pool.query(
    `INSERT INTO todo_items (user_id, content, importance, due_date)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.user.id, content.trim(), importance, due_date || null]
  )
  res.status(201).json(rows[0])
})

// 수정 (내용/중요도/상태/기한) — 전송된 필드만 업데이트
router.put('/:id', async (req, res) => {
  const { content, importance, status, due_date } = req.body
  const { rows } = await pool.query(
    `UPDATE todo_items
     SET content      = COALESCE($1, content),
         importance   = COALESCE($2, importance),
         status       = COALESCE($3, status),
         due_date     = CASE WHEN $4::text IS NOT NULL THEN $4::date ELSE due_date END,
         completed_at = CASE
           WHEN $3 = 'done' THEN NOW()
           WHEN $3 IS NOT NULL THEN NULL
           ELSE completed_at
         END
     WHERE id=$5 AND user_id=$6 RETURNING *`,
    [
      content ?? null,
      importance ?? null,
      status ?? null,
      due_date ?? null,
      req.params.id,
      req.user.id,
    ]
  )
  if (!rows.length) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' })
  res.json(rows[0])
})

// 삭제
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM todo_items WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id])
  res.status(204).end()
})

export default router
