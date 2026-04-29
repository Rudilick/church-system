import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 목록 조회 (검색, 페이징)
router.get('/', async (req, res) => {
  const { q, type, page = 1, limit = 50 } = req.query
  const offset = (page - 1) * limit

  let where = 'WHERE 1=1'
  const params = []

  if (q) {
    params.push(`%${q}%`)
    where += ` AND (m.name ILIKE $${params.length} OR m.phone ILIKE $${params.length})`
  }
  if (type) {
    params.push(type)
    where += ` AND m.membership_type = $${params.length}`
  }
  if (req.query.positions) {
    const posArr = req.query.positions.split(',').map(p => p.trim())
    params.push(posArr)
    where += ` AND m.position = ANY($${params.length})`
  }
  if (req.query.birth_date) {
    params.push(req.query.birth_date)
    where += ` AND m.birth_date = $${params.length}`
  }
  if (req.query.community_id) {
    params.push(req.query.community_id)
    where += ` AND m.id IN (SELECT member_id FROM member_communities WHERE community_id = $${params.length})`
  }

  params.push(limit, offset)

  const { rows } = await pool.query(
    `SELECT sub.*,
            COALESCE(
              (SELECT JSON_AGG(JSON_BUILD_OBJECT('name', c.name, 'type', c.type, 'role', mc.role))
               FROM member_communities mc
               JOIN communities c ON c.id = mc.community_id
               WHERE mc.member_id = sub.id),
              '[]'::json
            ) AS communities
     FROM (
       SELECT m.id, m.name, m.gender, m.birth_date, m.phone, m.photo_url,
              m.membership_type, m.registered_at, m.position,
              COUNT(*) OVER() AS total_count
       FROM members m
       ${where}
       ORDER BY m.name
       LIMIT $${params.length - 1} OFFSET $${params.length}
     ) sub
     ORDER BY sub.name`,
    params
  )

  const total = rows[0]?.total_count ?? 0
  res.json({ data: rows, total: Number(total), page: Number(page), limit: Number(limit) })
})

// 이번 주 성도 일정 (특이사항 이벤트)
router.get('/week-events', async (req, res) => {
  const days = Number(req.query.days ?? 7)
  const { rows } = await pool.query(
    `SELECT n.id, n.content, n.member_id,
            m.name AS member_name, m.photo_url, m.gender,
            e.title AS event_title, DATE(e.start_at) AS event_date
     FROM member_notes n
     JOIN members m ON m.id = n.member_id
     JOIN events e ON e.id = n.event_id
     WHERE DATE(e.start_at) >= CURRENT_DATE
       AND DATE(e.start_at) < CURRENT_DATE + ($1 || ' days')::INTERVAL
     ORDER BY e.start_at`,
    [days]
  )
  res.json(rows)
})

// 최근 활동 피드
router.get('/activity-feed', async (req, res) => {
  const limit = Number(req.query.limit ?? 15)
  const { rows } = await pool.query(
    `SELECT id, ts, detail, member_name, member_id, photo_url, tab, event_title,
            visit_date, visit_type, location
     FROM (
       SELECT n.id, n.created_at AS ts, n.content AS detail,
              m.name AS member_name, m.id AS member_id, m.photo_url,
              CASE WHEN n.event_id IS NOT NULL THEN '캘린더 일정' ELSE '특이사항' END AS tab,
              e.title AS event_title,
              NULL::date AS visit_date, NULL::text AS visit_type, NULL::text AS location
       FROM member_notes n
       JOIN members m ON m.id = n.member_id
       LEFT JOIN events e ON e.id = n.event_id

       UNION ALL

       SELECT pv.id, pv.created_at AS ts, pv.content AS detail,
              m.name AS member_name, m.id AS member_id, m.photo_url,
              '심방등록' AS tab,
              NULL AS event_title,
              pv.visit_date, pv.visit_type, pv.location
       FROM pastoral_visits pv
       JOIN members m ON m.id = pv.member_id
     ) combined
     ORDER BY ts DESC
     LIMIT $1`,
    [limit]
  )
  res.json(rows)
})

// 단일 조회 (가족관계 포함)
router.get('/:id', async (req, res) => {
  const { id } = req.params

  const { rows: memberRows } = await pool.query(
    `SELECT * FROM members WHERE id = $1`,
    [id]
  )
  if (!memberRows.length) return res.status(404).json({ error: '교인을 찾을 수 없습니다.' })

  const { rows: familyRows } = await pool.query(
    `SELECT f.relation_type,
            m.id, m.name, m.gender, m.birth_date, m.photo_url
     FROM families f
     JOIN members m ON m.id = f.related_member_id
     WHERE f.member_id = $1`,
    [id]
  )

  const { rows: communityRows } = await pool.query(
    `SELECT c.id, c.name, c.type, mc.role
     FROM member_communities mc
     JOIN communities c ON c.id = mc.community_id
     WHERE mc.member_id = $1`,
    [id]
  )

  res.json({ ...memberRows[0], family: familyRows, communities: communityRows })
})

// 등록
router.post('/', async (req, res) => {
  const {
    name, name_en, gender, birth_date, birth_lunar,
    phone, email, address, address_detail, lat, lng,
    workplace, school, photo_url, position,
    membership_type, registered_at, baptism_date, note,
    resident_id, membership_category, faith_level,
    household_head_name, household_relation,
    introducer_name, previous_church, previous_church_position,
    occupation, anniversary_date,
    staff_category, staff_role,
  } = req.body

  const d = (v) => (v === '' || v === undefined) ? null : v

  const { rows } = await pool.query(
    `INSERT INTO members
       (name, name_en, gender, birth_date, birth_lunar,
        phone, email, address, address_detail, lat, lng,
        workplace, school, photo_url, position,
        membership_type, registered_at, baptism_date, note,
        resident_id, membership_category, faith_level,
        household_head_name, household_relation,
        introducer_name, previous_church, previous_church_position,
        occupation, anniversary_date, staff_category, staff_role)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
     RETURNING *`,
    [name, d(name_en), d(gender), d(birth_date), birth_lunar ?? false,
     d(phone), d(email), d(address), d(address_detail), d(lat), d(lng),
     d(workplace), d(school), d(photo_url), d(position),
     membership_type ?? 'active', d(registered_at), d(baptism_date), d(note),
     d(resident_id), d(membership_category), d(faith_level),
     d(household_head_name), d(household_relation),
     d(introducer_name), d(previous_church), d(previous_church_position),
     d(occupation), d(anniversary_date), d(staff_category), d(staff_role)]
  )

  res.status(201).json(rows[0])
})

// 수정
router.put('/:id', async (req, res) => {
  const { id } = req.params
  const fields = [
    'name','name_en','gender','birth_date','birth_lunar',
    'phone','email','address','address_detail','lat','lng',
    'workplace','school','photo_url','position',
    'membership_type','registered_at','baptism_date','note',
    'resident_id','membership_category','faith_level',
    'household_head_name','household_relation',
    'introducer_name','previous_church','previous_church_position',
    'occupation','anniversary_date',
    'staff_category','staff_role',
  ]

  const DATE_FIELDS = new Set(['birth_date', 'registered_at', 'baptism_date', 'anniversary_date'])
  const d = (f, v) => (DATE_FIELDS.has(f) && v === '') ? null : v

  const updates = []
  const params = []
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      params.push(d(f, req.body[f]))
      updates.push(`${f} = $${params.length}`)
    }
  }
  if (!updates.length) return res.status(400).json({ error: '변경 항목이 없습니다.' })

  params.push(id)
  const { rows } = await pool.query(
    `UPDATE members SET ${updates.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length} RETURNING *`,
    params
  )

  if (!rows.length) return res.status(404).json({ error: '교인을 찾을 수 없습니다.' })
  res.json(rows[0])
})

// 삭제
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM members WHERE id = $1', [req.params.id])
  res.status(204).end()
})

// 특이사항 노트 목록
router.get('/:id/notes', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT n.id, n.content, n.created_at, n.event_id,
            e.title AS event_title, DATE(e.start_at) AS event_date
     FROM member_notes n
     LEFT JOIN events e ON e.id = n.event_id
     WHERE n.member_id = $1 ORDER BY n.created_at DESC`,
    [req.params.id]
  )
  res.json(rows)
})

// 특이사항 노트 등록
router.post('/:id/notes', async (req, res) => {
  const { content, is_event, event_date, event_title } = req.body
  if (!content?.trim()) return res.status(400).json({ error: '내용을 입력하세요.' })

  let eventId = null
  if (is_event && event_date && event_title?.trim()) {
    const startAt = `${event_date}T00:00:00`
    const { rows: mRows } = await pool.query('SELECT name FROM members WHERE id = $1', [req.params.id])
    const memberName = mRows[0]?.name ?? ''
    const fullTitle = memberName ? `${memberName} ${event_title.trim()}` : event_title.trim()
    const { rows: evRows } = await pool.query(
      `INSERT INTO events (title, description, start_at, end_at, is_all_day, color, created_by)
       VALUES ($1, $2, $3, $3, true, '#8b5cf6', $4) RETURNING id`,
      [fullTitle, content.trim(), startAt, req.user.id]
    )
    eventId = evRows[0].id
  }

  const { rows } = await pool.query(
    `INSERT INTO member_notes (member_id, content, event_id) VALUES ($1, $2, $3)
     RETURNING id, content, created_at, event_id`,
    [req.params.id, content.trim(), eventId]
  )
  const note = rows[0]
  if (eventId) {
    note.event_title = event_title.trim()
    note.event_date  = event_date
  }
  res.status(201).json(note)
})

// 특이사항 노트 삭제
router.delete('/:id/notes/:noteId', async (req, res) => {
  const { rows } = await pool.query(
    `DELETE FROM member_notes WHERE id = $1 AND member_id = $2 RETURNING event_id`,
    [req.params.noteId, req.params.id]
  )
  if (rows[0]?.event_id) {
    await pool.query(`DELETE FROM events WHERE id = $1`, [rows[0].event_id]).catch(() => {})
  }
  res.status(204).end()
})

// 생일 임박 조회 (향후 N일 이내)
router.get('/birthdays/upcoming', async (req, res) => {
  const days = Number(req.query.days ?? 7)
  const { rows } = await pool.query(
    `SELECT id, name, gender, birth_date, photo_url, phone
     FROM members
     WHERE membership_type = 'active'
       AND (
         DATE_PART('month', birth_date) * 100 + DATE_PART('day', birth_date)
         BETWEEN
           DATE_PART('month', NOW()) * 100 + DATE_PART('day', NOW())
         AND
           DATE_PART('month', NOW() + ($1 || ' days')::INTERVAL) * 100 +
           DATE_PART('day',   NOW() + ($1 || ' days')::INTERVAL)
       )
     ORDER BY DATE_PART('month', birth_date), DATE_PART('day', birth_date)`,
    [days]
  )
  res.json(rows)
})

export default router
