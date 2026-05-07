import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 미심방 현황
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
    `SELECT pv.*,
            m.name AS member_name, m.photo_url, m.position AS member_position, m.gender AS member_gender,
            u.name AS pastor_name,
            creator.name AS created_by_name
     FROM pastoral_visits pv
     JOIN members m ON m.id = pv.member_id
     LEFT JOIN users u ON u.id = pv.pastor_id
     LEFT JOIN users creator ON creator.id = pv.pastor_id
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
    hymn, bible_verse, companions,
    next_plan_is_event, next_plan_event_date, next_plan_event_title,
  } = req.body
  const pastor_id = req.user.id

  const { rows } = await pool.query(
    `INSERT INTO pastoral_visits
       (member_id, pastor_id, visit_date, content, visit_type, location, next_plan,
        hymn, bible_verse, companions)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [member_id, pastor_id, visit_date, content,
     visit_type ?? '가정', location ?? null, next_plan ?? null,
     hymn ?? null, bible_verse ?? null,
     JSON.stringify(companions || [])]
  )
  const visit = rows[0]

  // 심방 자동 캘린더 등록 (녹색, 심방 타입)
  try {
    const { rows: mRows } = await pool.query('SELECT name FROM members WHERE id=$1', [member_id])
    const mName = mRows[0]?.name ?? ''
    const visitTitle = `${mName ? mName + ' ' : ''}심방${visit_type ? ` (${visit_type})` : ''}`
    await pool.query(
      `INSERT INTO events (title, start_at, end_at, is_all_day, color, created_by, event_type)
       VALUES ($1,$2,$2,true,'#10b981',$3,'심방')`,
      [visitTitle, `${visit_date}T00:00:00`, pastor_id]
    )
  } catch {}

  // 후속계획 캘린더 등록
  let nextPlanEventId = null
  if (next_plan_is_event && next_plan_event_date && next_plan?.trim()) {
    try {
      const startAt = `${next_plan_event_date}T00:00:00`
      const endAt   = `${next_plan_event_date}T23:59:59`
      const { rows: evRows } = await pool.query(
        `INSERT INTO events (title, start_at, end_at, created_by, event_type)
         VALUES ($1,$2,$3,$4,'추후일정') RETURNING id`,
        [next_plan.trim(), startAt, endAt, pastor_id]
      )
      nextPlanEventId = evRows[0].id
      await pool.query(
        'UPDATE pastoral_visits SET next_plan_event_id=$1 WHERE id=$2',
        [nextPlanEventId, visit.id]
      )
    } catch {}
  }

  res.status(201).json({ ...visit, next_plan_event_id: nextPlanEventId })
})

// 수정
router.put('/:id', async (req, res) => {
  const {
    visit_date, content, visit_type, location, next_plan,
    hymn, bible_verse, companions,
    next_plan_is_event, next_plan_event_date, next_plan_event_title,
  } = req.body
  const pastor_id = req.user.id

  // 기존 후속계획 이벤트 ID 조회
  const { rows: existing } = await pool.query(
    'SELECT next_plan_event_id, member_id FROM pastoral_visits WHERE id=$1',
    [req.params.id]
  )
  if (!existing.length) return res.status(404).json({ error: '심방 기록을 찾을 수 없습니다.' })
  const { next_plan_event_id: oldEventId, member_id } = existing[0]

  const { rows } = await pool.query(
    `UPDATE pastoral_visits
     SET visit_date=$1, content=$2, visit_type=$3, location=$4, next_plan=$5,
         hymn=$6, bible_verse=$7, companions=$8
     WHERE id=$9 RETURNING *`,
    [visit_date, content,
     visit_type ?? '가정', location ?? null, next_plan ?? null,
     hymn ?? null, bible_verse ?? null,
     JSON.stringify(companions || []), req.params.id]
  )

  // 후속계획 이벤트 동기화
  if (next_plan_is_event && next_plan_event_date && next_plan?.trim()) {
    const startAt = `${next_plan_event_date}T00:00:00`
    const endAt   = `${next_plan_event_date}T23:59:59`

    if (oldEventId) {
      await pool.query(
        'UPDATE events SET title=$1, start_at=$2, end_at=$3 WHERE id=$4',
        [next_plan.trim(), startAt, endAt, oldEventId]
      ).catch(() => {})
    } else {
      try {
        const { rows: evRows } = await pool.query(
          `INSERT INTO events (title, start_at, end_at, created_by, event_type)
           VALUES ($1,$2,$3,$4,'추후일정') RETURNING id`,
          [next_plan.trim(), startAt, endAt, pastor_id]
        )
        await pool.query(
          'UPDATE pastoral_visits SET next_plan_event_id=$1 WHERE id=$2',
          [evRows[0].id, req.params.id]
        )
      } catch {}
    }
  } else if (!next_plan_is_event && oldEventId) {
    // 캘린더 등록 해제 시 이벤트 삭제
    await pool.query('DELETE FROM events WHERE id=$1', [oldEventId]).catch(() => {})
    await pool.query('UPDATE pastoral_visits SET next_plan_event_id=NULL WHERE id=$1', [req.params.id])
  }

  res.json(rows[0])
})

// 삭제
router.delete('/:id', async (req, res) => {
  // 연결된 후속계획 이벤트도 삭제
  const { rows } = await pool.query('SELECT next_plan_event_id FROM pastoral_visits WHERE id=$1', [req.params.id])
  if (rows[0]?.next_plan_event_id) {
    await pool.query('DELETE FROM events WHERE id=$1', [rows[0].next_plan_event_id]).catch(() => {})
  }
  await pool.query('DELETE FROM pastoral_visits WHERE id=$1', [req.params.id])
  res.status(204).end()
})

export default router
