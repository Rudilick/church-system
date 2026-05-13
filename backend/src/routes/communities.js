import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

function buildTree(rows, memberMap, parentId = null) {
  return rows
    .filter(r => (r.parent_id ?? null) === parentId)
    .map(r => ({
      ...r,
      members: memberMap[r.id] ?? [],
      children: buildTree(rows, memberMap, r.id),
    }))
}

// 전체 목록 (tree=true 시 계층 트리, 기본은 flat)
router.get('/', async (req, res) => {
  const { type, tree } = req.query
  const params = []
  let where = ''
  if (type) { params.push(type); where = `WHERE c.type = $1` }

  const { rows } = await pool.query(
    `SELECT c.*,
       pm.name       AS pastor_name,
       pm.photo_url  AS pastor_photo,
       COALESCE(m.name,      lm.name)       AS leader_name,
       COALESCE(m.photo_url, lm.photo_url)  AS leader_photo,
       COALESCE(m.position,  lm.position)   AS leader_position
     FROM communities c
     LEFT JOIN members pm ON pm.id = c.pastor_id
     LEFT JOIN members m  ON m.id  = c.leader_id
     LEFT JOIN LATERAL (
       SELECT mem.name, mem.photo_url, mem.position
       FROM member_communities mc
       JOIN members mem ON mem.id = mc.member_id
       WHERE mc.community_id = c.id AND mc.role = 'leader'
       ORDER BY mc.member_id
       LIMIT 1
     ) lm ON true
     ${where}
     ORDER BY c.parent_id NULLS FIRST, c.name`,
    params
  )

  if (tree !== 'true') return res.json(rows)

  // 트리 모드: 전체 구성원도 함께 조회
  const { rows: memberRows } = await pool.query(
    `SELECT mc.community_id, m.id, m.name, m.photo_url, m.position, mc.role
     FROM member_communities mc
     JOIN members m ON m.id = mc.member_id
     ORDER BY mc.community_id, mc.role DESC, m.name`
  )
  const memberMap = {}
  for (const mr of memberRows) {
    if (!memberMap[mr.community_id]) memberMap[mr.community_id] = []
    memberMap[mr.community_id].push(mr)
  }

  res.json(buildTree(rows, memberMap))
})

// 단일 공동체 + 구성원 타일
router.get('/:id', async (req, res) => {
  const { rows: comRows } = await pool.query(
    `SELECT c.*,
       pm.name       AS pastor_name,
       pm.photo_url  AS pastor_photo,
       COALESCE(m.name,      lm.name)       AS leader_name,
       COALESCE(m.photo_url, lm.photo_url)  AS leader_photo,
       COALESCE(m.position,  lm.position)   AS leader_position
     FROM communities c
     LEFT JOIN members pm ON pm.id = c.pastor_id
     LEFT JOIN members m  ON m.id  = c.leader_id
     LEFT JOIN LATERAL (
       SELECT mem.name, mem.photo_url, mem.position
       FROM member_communities mc
       JOIN members mem ON mem.id = mc.member_id
       WHERE mc.community_id = c.id AND mc.role = 'leader'
       ORDER BY mc.member_id
       LIMIT 1
     ) lm ON true
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
  const { name, type, parent_id, leader_id, pastor_id, description } = req.body
  const { rows } = await pool.query(
    `INSERT INTO communities (name, type, parent_id, leader_id, pastor_id, description)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, type, parent_id ?? null, leader_id ?? null, pastor_id ?? null, description]
  )
  res.status(201).json(rows[0])
})

// 수정
router.put('/:id', async (req, res) => {
  const { name, type, parent_id, leader_id, pastor_id, description } = req.body
  const { rows } = await pool.query(
    `UPDATE communities
     SET name=$1, type=$2, parent_id=$3, leader_id=$4, pastor_id=$5, description=$6
     WHERE id=$7 RETURNING *`,
    [name, type, parent_id ?? null, leader_id ?? null, pastor_id ?? null, description, req.params.id]
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
  const resolvedRole = role ?? 'member'
  const { rows } = await pool.query(
    `INSERT INTO member_communities (community_id, member_id, role, joined_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (member_id, community_id) DO UPDATE SET role = $3
     RETURNING *`,
    [req.params.id, member_id, resolvedRole, joined_at ?? null]
  )
  if (resolvedRole === 'leader') {
    await pool.query(
      `UPDATE communities SET leader_id = $1 WHERE id = $2`,
      [member_id, req.params.id]
    )
  } else {
    await pool.query(
      `UPDATE communities SET leader_id = NULL WHERE id = $1 AND leader_id = $2`,
      [req.params.id, member_id]
    )
  }
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
