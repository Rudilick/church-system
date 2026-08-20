import { Router } from 'express'
import { randomUUID } from 'crypto'
import pool from '../db/pool.js'

const router = Router()

// GET /api/calendar?year=2026&month=4
router.get('/', async (req, res) => {
  const y = parseInt(req.query.year)  || new Date().getFullYear()
  const m = parseInt(req.query.month) || (new Date().getMonth() + 1)
  const from = `${y}-${String(m).padStart(2,'0')}-01`
  const to   = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)

  // 멀티데이 이벤트 포함: start_at이 월 안이거나 end_at이 월 안에 걸치는 것
  const { rows: events } = await pool.query(
    `SELECT id, title, description, location, start_at, end_at, is_all_day, color,
            recurrence_group_id, event_type
     FROM events
     WHERE DATE(start_at) <= $2 AND DATE(end_at) >= $1
     ORDER BY start_at`,
    [from, to]
  )

  const { rows: birthdays } = await pool.query(
    `SELECT id, name, birth_date
     FROM members
     WHERE birth_date IS NOT NULL
       AND EXTRACT(MONTH FROM birth_date) = $1
     ORDER BY EXTRACT(DAY FROM birth_date)`,
    [m]
  )

  // 기도제목 캘린더 이벤트 조회 (event_id로 연결된 것)
  const { rows: prayerEvents } = await pool.query(
    `SELECT pr.id AS prayer_id, pr.content AS prayer_content,
            m.name AS member_name, e.id AS event_id
     FROM prayer_requests pr
     JOIN events e ON e.id = pr.event_id
     JOIN members m ON m.id = pr.member_id
     WHERE DATE(e.start_at) >= $1 AND DATE(e.start_at) <= $2`,
    [from, to]
  )

  res.json({ events, birthdays, prayerEvents })
})

// PUT /api/calendar/:id — 단일 이벤트 수정
router.put('/:id', async (req, res) => {
  const { title, date, end_date, time, location, color, description, event_type } = req.body
  if (!title || !date) return res.status(400).json({ error: '제목과 날짜는 필수입니다.' })

  const isAllDay = !time
  const startAt  = time ? `${date}T${time}:00` : `${date}T00:00:00`
  const endAt    = end_date
    ? (time ? `${end_date}T${time}:00` : `${end_date}T23:59:59`)
    : (time ? `${date}T${time}:00` : `${date}T23:59:59`)

  const { rows } = await pool.query(
    `UPDATE events
     SET title=$1, description=COALESCE($2, description), location=$3, start_at=$4, end_at=$5,
         is_all_day=$6, color=$7, event_type=$8
     WHERE id=$9 RETURNING *`,
    [title, description ?? null, location || null, startAt, endAt,
     isAllDay, color || '#3b82f6', event_type || '기타', req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: '이벤트를 찾을 수 없습니다.' })

  // 심방 후속계획과 연결된 이벤트인지 확인
  const { rows: linked } = await pool.query(
    'SELECT id FROM pastoral_visits WHERE next_plan_event_id=$1',
    [req.params.id]
  )

  // 교인 특이사항(member_notes)과 연결된 이벤트라면 내용도 함께 동기화
  await pool.query(
    'UPDATE member_notes SET content=$1 WHERE event_id=$2',
    [rows[0].description || rows[0].title, req.params.id]
  ).catch(() => {})

  res.json({ ...rows[0], linked_pastoral: linked.length > 0 })
})

// POST /api/calendar
router.post('/', async (req, res) => {
  const { title, date, end_date, time, location, color, recurrence_type, recurrence_end,
          recurrence_month_mode, recurrence_week_of_month,
          description, event_type } = req.body
  if (!title || !date) return res.status(400).json({ error: '제목과 날짜는 필수입니다.' })

  const isAllDay = !time
  const col      = color || '#3b82f6'
  const desc     = description || null
  const eType    = event_type || '기타'

  if (!recurrence_type || recurrence_type === 'none') {
    const startAt = time ? `${date}T${time}:00` : `${date}T00:00:00`
    const endAt   = end_date
      ? (time ? `${end_date}T${time}:00` : `${end_date}T23:59:59`)
      : startAt
    const { rows } = await pool.query(
      `INSERT INTO events (title, description, location, start_at, end_at, is_all_day, color, created_by, event_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [title, desc, location || null, startAt, endAt, isAllDay, col, req.user.id, eType]
    )
    return res.status(201).json(rows[0])
  }

  // 반복 일정 생성
  const groupId = randomUUID()
  const [sy, sm, sd] = date.split('-').map(Number)
  const endDate = recurrence_end
    ? new Date(recurrence_end + 'T00:00:00Z')
    : new Date(Date.UTC(sy + 2, sm - 1, sd))

  const occurrences = []

  if (recurrence_type === 'monthly' && recurrence_month_mode === 'weekday') {
    // 매월 N번째 요일 (예: 매월 둘째 주 일요일)
    const weekday = new Date(Date.UTC(sy, sm - 1, sd)).getUTCDay()
    const weekNum = Math.min(5, Math.max(1, parseInt(recurrence_week_of_month, 10) || 1))
    let y = sy, mo = sm - 1   // 0-indexed month

    while (occurrences.length < 300) {
      const first = new Date(Date.UTC(y, mo, 1))
      if (first > endDate) break
      const firstWeekday = first.getUTCDay()
      const day = 1 + ((weekday - firstWeekday + 7) % 7) + (weekNum - 1) * 7
      const daysInMonth = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate()
      if (day <= daysInMonth) {
        const occDate = new Date(Date.UTC(y, mo, day))
        if (occDate <= endDate) occurrences.push(occDate.toISOString().slice(0, 10))
      }
      mo++
      if (mo === 12) { mo = 0; y++ }
    }
  } else {
    let cur = new Date(Date.UTC(sy, sm - 1, sd))
    while (cur <= endDate) {
      occurrences.push(cur.toISOString().slice(0, 10))
      if (recurrence_type === 'weekly') {
        cur.setUTCDate(cur.getUTCDate() + 7)
      } else {
        const nextM = cur.getUTCMonth() + 1
        const nextY = nextM === 12 ? cur.getUTCFullYear() + 1 : cur.getUTCFullYear()
        const nm    = nextM % 12
        const daysInNext = new Date(Date.UTC(nextY, nm + 1, 0)).getUTCDate()
        cur = new Date(Date.UTC(nextY, nm, Math.min(sd, daysInNext)))
      }
    }
  }

  for (const d of occurrences) {
    const startAt = time ? `${d}T${time}:00` : `${d}T00:00:00`
    await pool.query(
      `INSERT INTO events (title, description, location, start_at, end_at, is_all_day, color,
                           recurrence_group_id, created_by, event_type)
       VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9)`,
      [title, desc, location || null, startAt, isAllDay, col, groupId, req.user.id, eType]
    )
  }

  res.status(201).json({ count: occurrences.length, group_id: groupId })
})

// DELETE /api/calendar/recurrence/:groupId
router.delete('/recurrence/:groupId', async (req, res) => {
  const { rows } = await pool.query(
    'DELETE FROM events WHERE recurrence_group_id=$1 RETURNING id',
    [req.params.groupId]
  )
  res.json({ deleted: rows.length })
})

// DELETE /api/calendar/:id
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM events WHERE id=$1', [req.params.id])
  res.status(204).end()
})

export default router
