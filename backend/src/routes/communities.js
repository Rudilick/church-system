import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 전체 목록 (트리 구조용, type 필터 선택)
router.get('/', async (req, res) => {
  const { type } = req.query
  const params = []
  let where = ''
  if (type) { params.push(type); where = `WHERE c.type = $1` }

  const { rows } = await pool.query(
    `SELECT c.*, m.name AS leader_name
     FROM communities c
     LEFT JOIN members m ON m.id = c.leader_id
     ${where}
     ORDER BY c.parent_id NULLS FIRST, c.name`,
    params
  )
  res.json(rows)
})

// 단일 공동체 + 구성원 타일
router.get('/:id', async (req, res) => {
  const { rows: comRows } = await pool.query(
    `SELECT c.*, m.name AS leader_name
     FROM communities c
     LEFT JOIN members m ON m.id = c.leader_id
     WHERE c.id = $1`,
    [req.params.id]
  )
  if (!comRows.length) return res.status(404).json({ error: '공동체를 찾을 수 없습니다.' })

  const { rows: memberRows } = await pool.query(
    `SELECT m.id, m.name, m.gender, m.birth_date, m.photo_url, mc.role
     FROM member_communities mc
     JOIN members m ON m.id = mc.member_id
     WHERE mc.community_id = $1
     ORDER BY mc.role DESC, m.name`,
    [req.params.id]
  )

  res.json({ ...comRows[0], members: memberRows })
})

// 공동체 생성
router.post('/', async (req, res) => {
  const { name, type, parent_id, leader_id, description } = req.body
  const { rows } = await pool.query(
    `INSERT INTO communities (name, type, parent_id, leader_id, description)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, type, parent_id ?? null, leader_id ?? null, description]
  )
  res.status(201).json(rows[0])
})

// 수정
router.put('/:id', async (req, res) => {
  const { name, type, parent_id, leader_id, description } = req.body
  const { rows } = await pool.query(
    `UPDATE communities SET name=$1, type=$2, parent_id=$3, leader_id=$4, description=$5
     WHERE id=$6 RETURNING *`,
    [name, type, parent_id ?? null, leader_id ?? null, description, req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: '공동체를 찾을 수 없습니다.' })
  res.json(rows[0])
})

// 삭제
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM communities WHERE id = $1', [req.params.id])
  res.status(204).end()
})

// 구성원 추가
router.post('/:id/members', async (req, res) => {
  const { member_id, role, joined_at } = req.body
  const { rows } = await pool.query(
    `INSERT INTO member_communities (community_id, member_id, role, joined_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (member_id, community_id) DO UPDATE SET role = $3
     RETURNING *`,
    [req.params.id, member_id, role ?? 'member', joined_at ?? null]
  )
  res.status(201).json(rows[0])
})

// 구성원 제거
router.delete('/:id/members/:memberId', async (req, res) => {
  await pool.query(
    `DELETE FROM member_communities WHERE community_id = $1 AND member_id = $2`,
    [req.params.id, req.params.memberId]
  )
  res.status(204).end()
})

export default router
