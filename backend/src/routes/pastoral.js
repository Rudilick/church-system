import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 미심방 현황 — /pastoral/unvisited 보다 먼저 등록해야 /:id 와 충돌 방지
router.get('/unvisited', async (req, res) => {
  const months = req.query.months ?? 3
  const { rows } = await pool.query(
    `SELECT m.id, m.name, m.gender, m.photo_url, m.position,
            MAX(pv.visit_date) AS last_visit_date,
            c.name AS community_name
     FROM members m
     LEFT JOIN pastoral_visits pv ON pv.member_id = m.id
     LEFT JOIN member_communities mc ON mc.member_id = m.id AND mc.role != 'leader'
     LEFT JOIN communities c ON c.id = mc.community_id
     WHERE m.membership_type = 'active'
     GROUP BY m.id, m.name, m.gender, m.photo_url, m.position, c.name
     HAVING MAX(pv.visit_date) < NOW() - ($1 || ' months')::INTERVAL
         OR MAX(pv.visit_date) IS NULL
     ORDER BY last_visit_date ASC NULLS FIRST`,
    [months]
  )
  res.json(rows)
})

// 전체 목록 조회
router.get('/', async (req, res) => {
  const { member_id, pastor_id, from, to } = req.query
  let where = 'WHERE 1=1'
  const params = []

  if (member_id) { params.push(member_id); where += ` AND pv.member_id = $${params.length}` }
  if (pastor_id) { params.push(pastor_id); where += ` AND pv.pastor_id = $${params.length}` }
  if (from)      { params.push(from);      where += ` AND pv.visit_date >= $${params.length}` }
  if (to)        { params.push(to);        where += ` AND pv.visit_date <= $${params.length}` }

  const { rows } = await pool.query(
    `SELECT pv.*, m.name AS member_name, m.photo_url, u.name AS pastor_name
     FROM pastoral_visits pv
     JOIN members m ON m.id = pv.member_id
     LEFT JOIN users u ON u.id = pv.pastor_id
     ${where}
     ORDER BY pv.visit_date DESC`,
    params
  )
  res.json(rows)
})

// 등록
router.post('/', async (req, res) => {
  const {
    member_id, visit_date, content, visit_type, location, next_plan,
    next_plan_is_event, next_plan_event_date, next_plan_event_title,
  } = req.body
  const pastor_id = req.user.id
  const { rows } = await pool.query(
    `INSERT INTO pastoral_visits
       (member_id, pastor_id, visit_date, content, visit_type, location, next_plan)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [member_id, pastor_id, visit_date, content,
     visit_type ?? '가정', location ?? null, next_plan ?? null]
  )
  const visit = rows[0]

  // 심방 자동 캘린더 등록 (녹색)
  try {
    const { rows: mRows } = await pool.query('SELECT name FROM members WHERE id = $1', [member_id])
    const mName = mRows[0]?.name ?? ''
    const visitTitle = `${mName ? mName + ' ' : ''}심방${visit_type ? ` (${visit_type})` : ''}`
    await pool.query(
      `INSERT INTO events (title, start_at, end_at, is_all_day, color, created_by)
       VALUES ($1, $2, $2, true, '#10b981', $3)`,
      [visitTitle, `${visit_date}T00:00:00`, pastor_id]
    )
  } catch {}

  // 후속계획 캘린더 등록
  if (next_plan_is_event && next_plan_event_date && next_plan_event_title?.trim()) {
    try {
      const { rows: mRows } = await pool.query('SELECT name FROM members WHERE id = $1', [member_id])
      const memberName = mRows[0]?.name ?? ''
      const fullTitle = memberName ? `${memberName} ${next_plan_event_title.trim()}` : next_plan_event_title.trim()
      const startAt = `${next_plan_event_date}T00:00:00`
      const endAt   = `${next_plan_event_date}T23:59:59`
      const { rows: evRows } = await pool.query(
        `INSERT INTO events (title, start_at, end_at, created_by)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [fullTitle, startAt, endAt, pastor_id]
      )
      const eventId = evRows[0].id
      await pool.query(
        `INSERT INTO member_notes (member_id, content, is_event, event_id, event_date, event_title)
         VALUES ($1, $2, TRUE, $3, $4, $5)`,
        [member_id, next_plan ?? '', eventId, next_plan_event_date, fullTitle]
      )
    } catch {}
  }

  res.status(201).json(visit)
})

// 수정
router.put('/:id', async (req, res) => {
  const { visit_date, content, visit_type, location, next_plan } = req.body
  const { rows } = await pool.query(
    `UPDATE pastoral_visits
     SET visit_date=$1, content=$2, visit_type=$3, location=$4, next_plan=$5
     WHERE id=$6 RETURNING *`,
    [visit_date, content,
     visit_type ?? '가정', location ?? null, next_plan ?? null, req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: '심방 기록을 찾을 수 없습니다.' })
  res.json(rows[0])
})

// 삭제
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM pastoral_visits WHERE id = $1', [req.params.id])
  res.status(204).end()
})

export default router
