import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

router.get('/', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM church_settings WHERE id = 1')
  res.json(rows[0] ?? { church_name: '', unique_id: '', address: '', pastor_name: '' })
})

router.put('/', async (req, res) => {
  const { church_name, unique_id, address, pastor_name, member_pin } = req.body
  const { rows } = await pool.query(
    `UPDATE church_settings
     SET church_name = $1, unique_id = $2, address = $3, pastor_name = $4, member_pin = COALESCE($5, member_pin)
     WHERE id = 1 RETURNING *`,
    [church_name ?? '', unique_id ?? '', address ?? '', pastor_name ?? '', member_pin || null]
  )
  res.json(rows[0])
})

router.post('/verify-member-pin', async (req, res) => {
  const PASTOR_ROLES = ['super_admin', 'church_admin', 'pastor']
  if (!PASTOR_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: '목회자 권한이 필요합니다.' })
  }
  const { pin } = req.body
  const { rows } = await pool.query('SELECT member_pin FROM church_settings WHERE id = 1')
  const stored = rows[0]?.member_pin ?? '0000'
  if (pin !== stored) return res.status(403).json({ error: '암호키가 올바르지 않습니다.' })
  res.json({ ok: true })
})

export default router
