import express from 'express'
import pool from '../db/pool.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const activeOnly = req.query.active !== 'false'
    const where = activeOnly ? 'WHERE is_active = true' : ''
    const { rows } = await pool.query(
      `SELECT id, name, category, display_order, is_active
       FROM positions ${where}
       ORDER BY display_order, id`
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { name, category = 'deacon', display_order = 0 } = req.body
    if (!name?.trim()) return res.status(400).json({ error: '이름은 필수입니다.' })
    const { rows } = await pool.query(
      `INSERT INTO positions (name, category, display_order) VALUES ($1, $2, $3) RETURNING *`,
      [name.trim(), category, display_order]
    )
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { name, category, display_order, is_active } = req.body
    const { rows } = await pool.query(
      `UPDATE positions SET
        name          = COALESCE($1, name),
        category      = COALESCE($2, category),
        display_order = COALESCE($3, display_order),
        is_active     = COALESCE($4, is_active)
       WHERE id = $5 RETURNING *`,
      [name ?? null, category ?? null, display_order ?? null, is_active ?? null, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: '찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const { rows: pos } = await pool.query(`SELECT name FROM positions WHERE id = $1`, [req.params.id])
    if (!pos.length) return res.status(404).json({ error: '찾을 수 없습니다.' })
    const { rows: used } = await pool.query(
      `SELECT 1 FROM members WHERE position = $1 LIMIT 1`, [pos[0].name]
    )
    if (used.length) {
      await pool.query(`UPDATE positions SET is_active = false WHERE id = $1`, [req.params.id])
      return res.json({ message: '사용 중이어서 비활성화했습니다.', deactivated: true })
    }
    await pool.query(`DELETE FROM positions WHERE id = $1`, [req.params.id])
    res.json({ message: '삭제됐습니다.' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
