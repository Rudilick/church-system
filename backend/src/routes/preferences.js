import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(preferences, '{}'::jsonb) AS preferences FROM users WHERE id = $1`,
      [req.user.id]
    )
    res.json(rows[0]?.preferences ?? {})
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE users
         SET preferences = preferences || $1::jsonb
       WHERE id = $2
       RETURNING preferences`,
      [JSON.stringify(req.body), req.user.id]
    )
    res.json(rows[0]?.preferences ?? {})
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
