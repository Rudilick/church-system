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
    `SELECT m.id, m.name, m.gender, m.birth_date, m.phone, m.photo_url,
            m.membership_type, m.registered_at, m.position,
            COUNT(*) OVER() AS total_count
     FROM members m
     ${where}
     ORDER BY m.name
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  const total = rows[0]?.total_count ?? 0
  res.json({ data: rows, total: Number(total), page: Number(page), limit: Number(limit) })
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
  } = req.body

  const d = (v) => (v === '' || v === undefined) ? null : v

  const { rows } = await pool.query(
    `INSERT INTO members
       (name, name_en, gender, birth_date, birth_lunar,
        phone, email, address, address_detail, lat, lng,
        workplace, school, photo_url, position,
        membership_type, registered_at, baptism_date, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING *`,
    [name, d(name_en), d(gender), d(birth_date), birth_lunar ?? false,
     d(phone), d(email), d(address), d(address_detail), d(lat), d(lng),
     d(workplace), d(school), d(photo_url), d(position),
     membership_type ?? 'active', d(registered_at), d(baptism_date), d(note)]
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
  ]

  const DATE_FIELDS = new Set(['birth_date', 'registered_at', 'baptism_date'])
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
