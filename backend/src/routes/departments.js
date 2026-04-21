import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

router.get('/', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM departments ORDER BY name')
  res.json(rows)
})

router.get('/:id', async (req, res) => {
  const { rows: deptRows } = await pool.query(
    'SELECT * FROM departments WHERE id = $1', [req.params.id]
  )
  if (!deptRows.length) return res.status(404).json({ error: '부서를 찾을 수 없습니다.' })

  const { rows: memberRows } = await pool.query(
    `SELECT m.id, m.name, m.gender, m.photo_url, dm.role
     FROM department_members dm
     JOIN members m ON m.id = dm.member_id
     WHERE dm.department_id = $1 ORDER BY dm.role DESC, m.name`,
    [req.params.id]
  )

  res.json({ ...deptRows[0], members: memberRows })
})

router.post('/', async (req, res) => {
  const { name, description } = req.body
  const { rows } = await pool.query(
    'INSERT INTO departments (name, description) VALUES ($1, $2) RETURNING *',
    [name, description]
  )
  res.status(201).json(rows[0])
})

router.put('/:id', async (req, res) => {
  const { name, description } = req.body
  const { rows } = await pool.query(
    'UPDATE departments SET name=$1, description=$2 WHERE id=$3 RETURNING *',
    [name, description, req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: '부서를 찾을 수 없습니다.' })
  res.json(rows[0])
})

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM departments WHERE id = $1', [req.params.id])
  res.status(204).end()
})

router.post('/:id/members', async (req, res) => {
  const { member_id, role } = req.body
  const { rows } = await pool.query(
    `INSERT INTO department_members (department_id, member_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (department_id, member_id) DO UPDATE SET role = $3
     RETURNING *`,
    [req.params.id, member_id, role ?? 'member']
  )
  res.status(201).json(rows[0])
})

router.delete('/:id/members/:memberId', async (req, res) => {
  await pool.query(
    'DELETE FROM department_members WHERE department_id = $1 AND member_id = $2',
    [req.params.id, req.params.memberId]
  )
  res.status(204).end()
})

export default router
