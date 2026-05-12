import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 전체 목록 조회
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM clergy ORDER BY is_current DESC, start_date DESC NULLS LAST`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 등록
router.post('/', async (req, res) => {
  const { name, role, phone, email, start_date, end_date, is_current, notes } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO clergy (name, role, phone, email, start_date, end_date, is_current, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, role || null, phone || null, email || null,
       start_date || null, is_current ? null : (end_date || null),
       is_current ?? true, notes || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 수정
router.put('/:id', async (req, res) => {
  const { name, role, phone, email, start_date, end_date, is_current, notes } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE clergy SET
         name = $1, role = $2, phone = $3, email = $4,
         start_date = $5, end_date = $6, is_current = $7, notes = $8
       WHERE id = $9
       RETURNING *`,
      [name, role || null, phone || null, email || null,
       start_date || null, is_current ? null : (end_date || null),
       is_current ?? true, notes || null,
       req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 삭제
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM clergy WHERE id = $1`, [req.params.id])
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
