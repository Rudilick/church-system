import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 회계연도 목록
router.get('/fiscal-years', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM fiscal_years ORDER BY year DESC')
  res.json(rows)
})

// 예산 항목 목록
router.get('/categories', async (req, res) => {
  const { fiscal_year_id, department_id } = req.query
  let where = 'WHERE 1=1'
  const params = []
  if (fiscal_year_id) { params.push(fiscal_year_id); where += ` AND bc.fiscal_year_id = $${params.length}` }
  if (department_id)  { params.push(department_id);  where += ` AND bc.department_id = $${params.length}` }

  const { rows } = await pool.query(
    `SELECT bc.*, d.name AS department_name,
            COALESCE(SUM(t.amount), 0)::BIGINT AS spent
     FROM budget_categories bc
     LEFT JOIN departments d ON d.id = bc.department_id
     LEFT JOIN transactions t ON t.budget_category_id = bc.id
     ${where}
     GROUP BY bc.id, d.name
     ORDER BY bc.type, bc.name`,
    params
  )
  res.json(rows)
})

// 예산 항목(부서별 사업) 등록
router.post('/categories', async (req, res) => {
  const { name, type, fiscal_year_id, department_id, budget_amount, account_code, calc_basis } = req.body
  if (!name?.trim() || !['I', 'E'].includes(type) || !fiscal_year_id) {
    return res.status(400).json({ error: '사업명, 구분(수입/지출), 회계연도는 필수입니다.' })
  }
  const { rows } = await pool.query(
    `INSERT INTO budget_categories (name, type, department_id, fiscal_year_id, budget_amount, account_code, calc_basis)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name.trim(), type, department_id || null, fiscal_year_id, budget_amount || 0, account_code || null, calc_basis || null]
  )
  res.status(201).json(rows[0])
})

// 예산 항목 수정 (당기예산 금액, 산출기초 등)
router.patch('/categories/:id', async (req, res) => {
  const { name, budget_amount, department_id, account_code, calc_basis } = req.body
  const { rows } = await pool.query(
    `UPDATE budget_categories SET
       name          = COALESCE($1, name),
       budget_amount = COALESCE($2, budget_amount),
       department_id = COALESCE($3, department_id),
       account_code  = COALESCE($4, account_code),
       calc_basis    = COALESCE($5, calc_basis)
     WHERE id = $6 RETURNING *`,
    [name ?? null, budget_amount ?? null, department_id ?? null, account_code ?? null, calc_basis ?? null, req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: '예산 항목을 찾을 수 없습니다.' })
  res.json(rows[0])
})

// 예산 항목 삭제
router.delete('/categories/:id', async (req, res) => {
  await pool.query('DELETE FROM budget_categories WHERE id = $1', [req.params.id])
  res.status(204).end()
})

// 총괄 — 부서 무관, 회계연도 내 목(account_code)별 합산
router.get('/categories/summary', async (req, res) => {
  const { fiscal_year_id } = req.query
  if (!fiscal_year_id) return res.status(400).json({ error: 'fiscal_year_id 필수' })
  const { rows } = await pool.query(
    `SELECT type, account_code, COALESCE(SUM(budget_amount), 0)::BIGINT AS total
     FROM budget_categories
     WHERE fiscal_year_id = $1 AND account_code IS NOT NULL
     GROUP BY type, account_code`,
    [fiscal_year_id]
  )
  res.json(rows)
})

// 거래 목록
router.get('/transactions', async (req, res) => {
  const { fiscal_year_id, category_id, from, to, page = 1, limit = 50 } = req.query
  const offset = (page - 1) * limit

  let where = 'WHERE 1=1'
  const params = []
  if (fiscal_year_id) { params.push(fiscal_year_id); where += ` AND t.fiscal_year_id = $${params.length}` }
  if (category_id)    { params.push(category_id);    where += ` AND t.budget_category_id = $${params.length}` }
  if (from)           { params.push(from);            where += ` AND t.date >= $${params.length}` }
  if (to)             { params.push(to);              where += ` AND t.date <= $${params.length}` }

  params.push(limit, offset)

  const { rows } = await pool.query(
    `SELECT t.*, bc.name AS category_name,
            array_agg(r.file_url) FILTER (WHERE r.file_url IS NOT NULL) AS receipt_urls,
            COUNT(*) OVER() AS total_count
     FROM transactions t
     LEFT JOIN budget_categories bc ON bc.id = t.budget_category_id
     LEFT JOIN receipts r ON r.transaction_id = t.id
     ${where}
     GROUP BY t.id, bc.name
     ORDER BY t.date DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  res.json({ data: rows, total: Number(rows[0]?.total_count ?? 0) })
})

// 거래 입력
router.post('/transactions', async (req, res) => {
  const { budget_category_id, type, amount, date, memo, fiscal_year_id } = req.body
  const { rows } = await pool.query(
    `INSERT INTO transactions (budget_category_id, type, amount, date, memo, fiscal_year_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [budget_category_id, type, amount, date, memo, fiscal_year_id]
  )
  res.status(201).json(rows[0])
})

// 거래 삭제
router.delete('/transactions/:id', async (req, res) => {
  await pool.query('DELETE FROM transactions WHERE id = $1', [req.params.id])
  res.status(204).end()
})

// 결산 보고서 — 연도별 수입/지출 집계
router.get('/report', async (req, res) => {
  const { fiscal_year_id } = req.query
  if (!fiscal_year_id) return res.status(400).json({ error: 'fiscal_year_id 필수' })

  const { rows } = await pool.query(
    `SELECT bc.name AS category, bc.type,
            bc.budget_amount,
            COALESCE(SUM(t.amount), 0)::BIGINT AS actual
     FROM budget_categories bc
     LEFT JOIN transactions t ON t.budget_category_id = bc.id
     WHERE bc.fiscal_year_id = $1
     GROUP BY bc.id
     ORDER BY bc.type, bc.name`,
    [fiscal_year_id]
  )

  const income  = rows.filter(r => r.type === 'I')
  const expense = rows.filter(r => r.type === 'E')
  const totalIncome  = income.reduce((s, r) => s + Number(r.actual), 0)
  const totalExpense = expense.reduce((s, r) => s + Number(r.actual), 0)

  res.json({ income, expense, totalIncome, totalExpense, balance: totalIncome - totalExpense })
})

export default router
