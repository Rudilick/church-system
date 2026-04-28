import express from 'express'
import pool from '../db/pool.js'

const router = express.Router()

const ALLOWED_TYPES = ['membership_category', 'faith_level']

router.get('/', async (req, res) => {
  try {
    const { type } = req.query
    const activeOnly = req.query.active !== 'false'
    const conditions = []
    const params = []
    if (type) { conditions.push(`enum_type = $${params.length + 1}`); params.push(type) }
    if (activeOnly) conditions.push('is_active = true')
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await pool.query(
      `SELECT id, enum_type, value, display_order, is_active
       FROM church_enum_values ${where}
       ORDER BY enum_type, display_order, id`,
      params
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { enum_type, value, display_order = 0 } = req.body
    if (!enum_type || !value?.trim()) return res.status(400).json({ error: '타입과 값은 필수입니다.' })
    if (!ALLOWED_TYPES.includes(enum_type)) return res.status(400).json({ error: '허용되지 않는 타입입니다.' })
    const { rows } = await pool.query(
      `INSERT INTO church_enum_values (enum_type, value, display_order) VALUES ($1, $2, $3) RETURNING *`,
      [enum_type, value.trim(), display_order]
    )
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { value, display_order, is_active } = req.body
    const { rows } = await pool.query(
      `UPDATE church_enum_values SET
        value         = COALESCE($1, value),
        display_order = COALESCE($2, display_order),
        is_active     = COALESCE($3, is_active)
       WHERE id = $4 RETURNING *`,
      [value?.trim() ?? null, display_order ?? null, is_active ?? null, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: '찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(`DELETE FROM church_enum_values WHERE id = $1`, [req.params.id])
    if (!rowCount) return res.status(404).json({ error: '찾을 수 없습니다.' })
    res.json({ message: '삭제됐습니다.' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
