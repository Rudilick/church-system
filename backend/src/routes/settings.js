import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

router.get('/', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM church_settings WHERE id = 1')
  res.json(rows[0] ?? { church_name: '', unique_id: '', address: '', pastor_name: '' })
})

router.put('/', async (req, res) => {
  const { church_name, unique_id, address, pastor_name } = req.body
  const { rows } = await pool.query(
    `UPDATE church_settings
     SET church_name = $1, unique_id = $2, address = $3, pastor_name = $4
     WHERE id = 1 RETURNING *`,
    [church_name ?? '', unique_id ?? '', address ?? '', pastor_name ?? '']
  )
  res.json(rows[0])
})

export default router
