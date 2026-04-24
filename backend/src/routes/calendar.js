import { Router } from 'express'
import { randomUUID } from 'crypto'
import pool from '../db/pool.js'

const router = Router()

// GET /api/calendar?year=2026&month=4
router.get('/', async (req, res) => {
  const y = parseInt(req.query.year)  || new Date().getFullYear()
  const m = parseInt(req.query.month) || (new Date().getMonth() + 1)
  const from = `${y}-${String(m).padStart(2,'0')}-01`
  // last day of month
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)

  const { rows: events } = await pool.query(
    `SELECT id, title, location, start_at, is_all_day, color, recurrence_group_id
     FROM events
     WHERE DATE(start_at) >= $1 AND DATE(start_at) <= $2
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

  res.json({ events, birthdays })
})

// POST /api/calendar
router.post('/', async (req, res) => {
  const { title, date, time, location, color, recurrence_type, recurrence_end } = req.body
  if (!title || !date) return res.status(400).json({ error: '제목과 날짜는 필수입니다.' })

  const isAllDay = !time
  const col = color || '#3b82f6'

  if (!recurrence_type || recurrence_type === 'none') {
    const startAt = time ? `${date}T${time}:00` : `${date}T00:00:00`
    const { rows } = await pool.query(
      `INSERT INTO events (title, location, start_at, end_at, is_all_day, color, created_by)
       VALUES ($1,$2,$3,$3,$4,$5,$6) RETURNING *`,
      [title, location || null, startAt, isAllDay, col, req.user.id]
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
  let cur = new Date(Date.UTC(sy, sm - 1, sd))

  while (cur <= endDate) {
    occurrences.push(cur.toISOString().slice(0, 10))
    if (recurrence_type === 'weekly') {
      cur.setUTCDate(cur.getUTCDate() + 7)
    } else {
      // 매월 — 같은 day-of-month 유지
      const nextM = cur.getUTCMonth() + 1
      const nextY = nextM === 12 ? cur.getUTCFullYear() + 1 : cur.getUTCFullYear()
      const nm    = nextM % 12
      const daysInNext = new Date(Date.UTC(nextY, nm + 1, 0)).getUTCDate()
      cur = new Date(Date.UTC(nextY, nm, Math.min(sd, daysInNext)))
    }
  }

  for (const d of occurrences) {
    const startAt = time ? `${d}T${time}:00` : `${d}T00:00:00`
    await pool.query(
      `INSERT INTO events (title, location, start_at, end_at, is_all_day, color, recurrence_group_id, created_by)
       VALUES ($1,$2,$3,$3,$4,$5,$6,$7)`,
      [title, location || null, startAt, isAllDay, col, groupId, req.user.id]
    )
  }

  res.status(201).json({ count: occurrences.length, group_id: groupId })
})

// DELETE /api/calendar/recurrence/:groupId  — 반드시 /:id 앞에 위치
router.delete('/recurrence/:groupId', async (req, res) => {
  const { rows } = await pool.query(
    'DELETE FROM events WHERE recurrence_group_id = $1 RETURNING id',
    [req.params.groupId]
  )
  res.json({ deleted: rows.length })
})

// DELETE /api/calendar/:id — 단일 삭제
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM events WHERE id = $1', [req.params.id])
  res.status(204).end()
})

export default router
