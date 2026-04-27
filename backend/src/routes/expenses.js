import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

router.get('/', async (req, res) => {
  const { department_id, year, month } = req.query
  const conds = ['1=1']
  const params = []

  if (department_id) {
    params.push(department_id)
    conds.push(`e.department_id = $${params.length}`)
  }
  if (year) {
    params.push(year)
    conds.push(`EXTRACT(YEAR FROM e.date) = $${params.length}`)
  }
  if (month && Number(month) > 0) {
    params.push(month)
    conds.push(`EXTRACT(MONTH FROM e.date) = $${params.length}`)
  }

  const { rows } = await pool.query(`
    SELECT e.id, e.department_id, e.date, e.description, e.amount,
           e.memo, e.receipt_url, e.author_name, e.created_at, d.name AS department_name
    FROM expenses e
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE ${conds.join(' AND ')}
    ORDER BY e.date DESC, e.id DESC
  `, params)
  res.json(rows)
})

router.post('/', async (req, res) => {
  const { department_id, date, description, amount, memo, receipt_url, author_name } = req.body
  if (!date || !description || amount === undefined || amount === '') {
    return res.status(400).json({ error: '날짜, 지출내용, 금액은 필수입니다.' })
  }
  const { rows } = await pool.query(
    `INSERT INTO expenses (department_id, date, description, amount, memo, receipt_url, author_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, department_id, date, description, amount, memo, receipt_url, author_name, created_at`,
    [department_id || null, date, description, Number(amount), memo || null, receipt_url || null, author_name || null]
  )
  res.status(201).json(rows[0])
})

router.put('/:id', async (req, res) => {
  const { department_id, date, description, amount, memo, receipt_url, author_name } = req.body
  const { rows } = await pool.query(
    `UPDATE expenses
     SET department_id=$1, date=$2, description=$3, amount=$4, memo=$5, receipt_url=$6, author_name=$7
     WHERE id=$8
     RETURNING id, department_id, date, description, amount, memo, receipt_url, author_name, created_at`,
    [department_id || null, date, description, Number(amount), memo || null, receipt_url || null, author_name || null, req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' })
  res.json(rows[0])
})

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM expenses WHERE id=$1', [req.params.id])
  res.status(204).send()
})

export default router
