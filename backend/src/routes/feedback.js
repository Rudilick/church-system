import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 시스템 개선사항 목록 (같은 교회, 최신순)
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, user_id, user_name, content, screenshot, created_at
     FROM feedback_items
     WHERE church_id = $1
     ORDER BY created_at DESC`,
    [req.user.church_id]
  )
  res.json(rows)
})

// 등록
router.post('/', async (req, res) => {
  const { content, screenshot } = req.body
  if (!content?.trim()) return res.status(400).json({ error: '내용을 입력하세요.' })
  const { rows } = await pool.query(
    `INSERT INTO feedback_items (church_id, user_id, user_name, content, screenshot)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, user_name, content, screenshot, created_at`,
    [req.user.church_id, req.user.id, req.user.name, content.trim(), screenshot || null]
  )
  res.status(201).json(rows[0])
})

export default router
