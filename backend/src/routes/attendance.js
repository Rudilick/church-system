import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// ── 예배 카테고리 CRUD ─────────────────────────────────────────
router.get('/service-categories', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM service_categories ORDER BY sort_order, id')
  res.json(rows)
})
router.post('/service-categories', async (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: '카테고리 이름을 입력하세요.' })
  const { rows: maxRows } = await pool.query('SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM service_categories')
  const { rows } = await pool.query(
    'INSERT INTO service_categories (name, sort_order) VALUES ($1, $2) RETURNING *',
    [name.trim(), maxRows[0].next]
  )
  res.status(201).json(rows[0])
})
router.put('/service-categories/:id', async (req, res) => {
  const { name, sort_order } = req.body
  const { rows } = await pool.query(
    'UPDATE service_categories SET name=COALESCE($1,name), sort_order=COALESCE($2,sort_order) WHERE id=$3 RETURNING *',
    [name?.trim() || null, sort_order ?? null, req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' })
  res.json(rows[0])
})
router.delete('/service-categories/:id', async (req, res) => {
  await pool.query('DELETE FROM service_categories WHERE id=$1', [req.params.id])
  res.status(204).end()
})

// ── 예배 CRUD ──────────────────────────────────────────────────
router.get('/services', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*, sc.name AS category_name
     FROM services s
     LEFT JOIN service_categories sc ON sc.id = s.category_id
     WHERE s.is_active = TRUE
     ORDER BY s.day_of_week, s.start_time`
  )
  res.json(rows)
})
router.post('/services', async (req, res) => {
  const { name, day_of_week, start_time, category_id, target_types, target_school_depts } = req.body
  if (!name?.trim()) return res.status(400).json({ error: '예배 이름을 입력하세요.' })
  const { rows } = await pool.query(
    `INSERT INTO services (name, day_of_week, start_time, category_id, target_types, target_school_depts, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *`,
    [name.trim(), day_of_week ?? null, start_time || null, category_id || null,
     JSON.stringify(target_types || []), JSON.stringify(target_school_depts || [])]
  )
  res.status(201).json(rows[0])
})
router.put('/services/:id', async (req, res) => {
  const { name, day_of_week, start_time, category_id, target_types, target_school_depts } = req.body
  const { rows } = await pool.query(
    `UPDATE services SET name=$1, day_of_week=$2, start_time=$3, category_id=$4, target_types=$5, target_school_depts=$6
     WHERE id=$7 RETURNING *`,
    [name, day_of_week ?? null, start_time || null, category_id || null,
     JSON.stringify(target_types || []), JSON.stringify(target_school_depts || []), req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: '예배를 찾을 수 없습니다.' })
  res.json(rows[0])
})
router.delete('/services/:id', async (req, res) => {
  await pool.query('UPDATE services SET is_active=false WHERE id=$1', [req.params.id])
  res.status(204).end()
})

// 특정 날짜 + 예배의 출석 목록
router.get('/', async (req, res) => {
  const { service_id, date } = req.query
  if (!service_id || !date) return res.status(400).json({ error: 'service_id, date 필수' })

  const { rows } = await pool.query(
    `WITH member_community AS (
       SELECT mc.member_id,
         COALESCE(
           JSON_AGG(JSON_BUILD_OBJECT('name', co.name, 'type', co.type)
                    ORDER BY mc.joined_at NULLS LAST),
           '[]'::json
         ) AS all_communities
       FROM member_communities mc
       JOIN communities co ON co.id = mc.community_id
       GROUP BY mc.member_id
     )
     SELECT a.id, a.method, a.created_at,
            m.id AS member_id, m.name, m.gender, m.photo_url, m.birth_date,
            COALESCE(mcom.all_communities, '[]'::json) AS all_communities
     FROM attendances a
     JOIN members m ON m.id = a.member_id
     LEFT JOIN member_community mcom ON mcom.member_id = m.id
     WHERE a.service_id = $1 AND a.date = $2
     ORDER BY a.created_at ASC`,
    [service_id, date]
  )
  res.json(rows)
})

// 출석 입력 (수동)
router.post('/', async (req, res) => {
  const { member_id, service_id, date, method = 'manual' } = req.body
  const { rows } = await pool.query(
    `INSERT INTO attendances (member_id, service_id, date, method)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (member_id, service_id, date) DO UPDATE SET method = $4
     RETURNING *`,
    [member_id, service_id, date, method]
  )
  res.status(201).json(rows[0])
})

// QR 스캔으로 출석 처리
router.post('/qr', async (req, res) => {
  const { token, service_id, date } = req.body

  const { rows: tokenRows } = await pool.query(
    'SELECT member_id FROM qr_tokens WHERE token = $1',
    [token]
  )
  if (!tokenRows.length) return res.status(404).json({ error: '유효하지 않은 QR 코드입니다.' })

  const { member_id } = tokenRows[0]
  const { rows } = await pool.query(
    `INSERT INTO attendances (member_id, service_id, date, method)
     VALUES ($1, $2, $3, 'qr')
     ON CONFLICT (member_id, service_id, date) DO UPDATE SET method = 'qr'
     RETURNING *`,
    [member_id, service_id, date]
  )

  const { rows: memberRows } = await pool.query(
    'SELECT id, name, photo_url FROM members WHERE id = $1',
    [member_id]
  )

  res.json({ attendance: rows[0], member: memberRows[0] })
})

// 출석 삭제
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM attendances WHERE id = $1', [req.params.id])
  res.status(204).end()
})

// 통계 — 기간별/예배별 집계
router.get('/stats', async (req, res) => {
  const { from, to, service_id } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from, to 날짜 필수' })

  let where = 'WHERE a.date BETWEEN $1 AND $2'
  const params = [from, to]

  if (service_id) {
    params.push(service_id)
    where += ` AND a.service_id = $${params.length}`
  }

  const { rows } = await pool.query(
    `SELECT a.date, s.name AS service_name, COUNT(*) AS count
     FROM attendances a
     JOIN services s ON s.id = a.service_id
     ${where}
     GROUP BY a.date, s.id, s.name
     ORDER BY a.date, s.name`,
    params
  )
  res.json(rows)
})

// ── 주차별 남/녀 출석수 (최근 8주) ────────────────────────────
router.get('/stats/weekly', async (req, res) => {
  const { service_id } = req.query
  const params = []
  const svcFilter = service_id ? `AND a.service_id = $1` : ''
  if (service_id) params.push(service_id)

  // 최근 8주의 일요일 목록 생성
  const { rows } = await pool.query(
    `WITH weeks AS (
       SELECT generate_series(0,7) AS wk
     ),
     sundays AS (
       SELECT DATE_TRUNC('week', CURRENT_DATE + INTERVAL '1 day') - INTERVAL '1 day'
              - (wk * INTERVAL '7 days') AS sun
       FROM weeks
     ),
     base AS (
       SELECT s.sun::date AS week_start,
              COUNT(CASE WHEN m.gender = 'M' THEN 1 END) AS male,
              COUNT(CASE WHEN m.gender = 'F' THEN 1 END) AS female,
              COUNT(*) AS total
       FROM sundays s
       LEFT JOIN attendances a ON a.date = s.sun::date ${svcFilter}
       LEFT JOIN members m ON m.id = a.member_id
       GROUP BY s.sun
     )
     SELECT * FROM base ORDER BY week_start`,
    params
  )
  res.json(rows)
})

// ── 전년 동월/동주 비교 ─────────────────────────────────────
router.get('/stats/compare-year', async (req, res) => {
  const { service_id, year, month } = req.query
  const y = parseInt(year) || new Date().getFullYear()
  const m = parseInt(month) || (new Date().getMonth() + 1)
  const params = [y, m]
  const svcFilter = service_id ? 'AND a.service_id = $3' : ''
  if (service_id) params.push(service_id)

  const { rows } = await pool.query(
    `SELECT EXTRACT(WEEK FROM a.date)::int - EXTRACT(WEEK FROM DATE_TRUNC('month', a.date))::int + 1 AS week_of_month,
            EXTRACT(YEAR FROM a.date)::int AS year,
            COUNT(*) AS total
     FROM attendances a
     WHERE (EXTRACT(YEAR FROM a.date) = $1 OR EXTRACT(YEAR FROM a.date) = $1 - 1)
       AND EXTRACT(MONTH FROM a.date) = $2
       ${svcFilter}
     GROUP BY week_of_month, year
     ORDER BY year, week_of_month`,
    params
  )
  res.json(rows)
})

// ── 연령대 분포 ─────────────────────────────────────────────
router.get('/stats/age-distribution', async (req, res) => {
  const { service_id, date } = req.query
  if (!date) return res.status(400).json({ error: 'date 필수' })

  const params = [date]
  const svcFilter = service_id ? 'AND a.service_id = $2' : ''
  if (service_id) params.push(service_id)

  const { rows } = await pool.query(
    `SELECT CASE
              WHEN age < 10  THEN '10대 미만'
              WHEN age < 20  THEN '10대'
              WHEN age < 30  THEN '20대'
              WHEN age < 40  THEN '30대'
              WHEN age < 50  THEN '40대'
              WHEN age < 60  THEN '50대'
              ELSE '60대 이상'
            END AS age_group,
            COUNT(*) AS count
     FROM (
       SELECT EXTRACT(YEAR FROM AGE(m.birth_date))::int AS age
       FROM attendances a
       JOIN members m ON m.id = a.member_id
       WHERE a.date = $1 ${svcFilter}
         AND m.birth_date IS NOT NULL
     ) t
     GROUP BY age_group
     ORDER BY age_group`,
    params
  )
  res.json(rows)
})

// ── 가족단위 출결 추이 ────────────────────────────────────
router.get('/stats/family', async (req, res) => {
  const { service_id, from, to } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from, to 필수' })

  const params = [from, to]
  const svcFilter = service_id ? 'AND a.service_id = $3' : ''
  if (service_id) params.push(service_id)

  const { rows } = await pool.query(
    `WITH family_attendance AS (
       SELECT a.date,
              f.member_id AS head_id,
              COUNT(DISTINCT CASE WHEN a2.id IS NOT NULL THEN f2.related_member_id END) AS attended_in_family,
              COUNT(DISTINCT f2.related_member_id) AS total_in_family
       FROM families f
       JOIN families f2 ON f2.member_id = f.member_id
       LEFT JOIN attendances a2 ON a2.member_id = f2.related_member_id AND a2.date = a.date ${svcFilter.replace('$3','$3')}
       JOIN attendances a ON a.member_id = f.member_id AND a.date BETWEEN $1 AND $2 ${svcFilter}
       GROUP BY a.date, f.member_id
     )
     SELECT date,
            COUNT(CASE WHEN attended_in_family = total_in_family THEN 1 END) AS all_attended,
            COUNT(CASE WHEN attended_in_family > 0 AND attended_in_family < total_in_family THEN 1 END) AS partial,
            COUNT(CASE WHEN attended_in_family = 0 THEN 1 END) AS none_attended
     FROM family_attendance
     GROUP BY date
     ORDER BY date`,
    params
  )
  res.json(rows)
})

// 지난주 동일 예배 출석자 → 이번주 복사
router.post('/copy-last-week', async (req, res) => {
  const { service_id, date } = req.body
  if (!service_id || !date) return res.status(400).json({ error: 'service_id, date 필수' })

  const d = new Date(date); d.setDate(d.getDate() - 7)
  const lastWeek = d.toISOString().slice(0, 10)
  const { rows: last } = await pool.query(
    'SELECT member_id FROM attendances WHERE service_id = $1 AND date = $2',
    [service_id, lastWeek]
  )
  if (!last.length) return res.json({ copied: 0, lastWeek })

  let copied = 0
  for (const { member_id } of last) {
    const r = await pool.query(
      `INSERT INTO attendances (member_id, service_id, date, method)
       VALUES ($1, $2, $3, 'manual')
       ON CONFLICT (member_id, service_id, date) DO NOTHING`,
      [member_id, service_id, date]
    )
    if (r.rowCount) copied++
  }
  res.json({ copied, lastWeek })
})

export default router
