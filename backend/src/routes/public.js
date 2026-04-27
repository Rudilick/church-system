import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 부서 목록 (인증 불필요 — 모바일 입력 페이지용)
router.get('/departments', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, parent_id, sort_order, is_budget_dept FROM departments ORDER BY sort_order, name'
  )
  res.json(rows)
})

// 지출 입력 (인증 불필요 — 모바일 입력 페이지용)
router.post('/expenses', async (req, res) => {
  const { department_id, date, description, amount, memo, receipt_url, author_name } = req.body
  if (!date || !description || amount === undefined || amount === '') {
    return res.status(400).json({ error: '날짜, 지출내용, 금액은 필수입니다.' })
  }
  const { rows } = await pool.query(
    `INSERT INTO expenses (department_id, date, description, amount, memo, receipt_url, author_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [department_id || null, date, description, Number(amount), memo || null, receipt_url || null, author_name || null]
  )
  res.status(201).json({ id: rows[0].id, message: '저장되었습니다.' })
})

export default router
