import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 목록 조회
router.get('/', async (req, res) => {
  const { member_id, status } = req.query
  let where = 'WHERE 1=1'
  const params = []

  if (member_id) { params.push(member_id); where += ` AND pr.member_id = $${params.length}` }
  if (status)    { params.push(status);    where += ` AND pr.status = $${params.length}` }

  const { rows } = await pool.query(
    `SELECT pr.*, m.name AS member_name, m.photo_url,
            u.name AS created_by_name
     FROM prayer_requests pr
     JOIN members m ON m.id = pr.member_id
     LEFT JOIN users u ON u.id = pr.created_by
     ${where}
     ORDER BY pr.created_at DESC`,
    params
  )
  res.json(rows)
})

// 등록
router.post('/', async (req, res) => {
  const { member_id, content, is_sensitive, is_event, event_date, event_title } = req.body
  if (!member_id || !content?.trim()) return res.status(400).json({ error: 'member_id, content 필수' })
  const created_by = req.user.id

  const { rows } = await pool.query(
    `INSERT INTO prayer_requests (member_id, content, is_sensitive, created_by)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [member_id, content.trim(), is_sensitive ?? false, created_by]
  )
  const prayer = rows[0]

  // 캘린더 등록
  if (is_event && event_date) {
    try {
      const { rows: mRows } = await pool.query('SELECT name FROM members WHERE id=$1', [member_id])
      const memberName = mRows[0]?.name ?? ''
      const title = event_title?.trim() || `🙏 ${memberName} 기도제목`
      const { rows: evRows } = await pool.query(
        `INSERT INTO events (title, start_at, end_at, is_all_day, color, created_by, event_type)
         VALUES ($1,$2,$2,true,'#6366f1',$3,'기도제목') RETURNING id`,
        [title, `${event_date}T00:00:00`, created_by]
      )
      await pool.query(
        'UPDATE prayer_requests SET event_id=$1 WHERE id=$2',
        [evRows[0].id, prayer.id]
      )
    } catch {}
  }

  res.status(201).json(prayer)
})

// 상태 변경 (응답 처리)
router.put('/:id', async (req, res) => {
  const { status, answer_note } = req.body
  const answered_at = status === 'answered' ? new Date().toISOString() : null
  const { rows } = await pool.query(
    `UPDATE prayer_requests
     SET status=$1, answer_note=$2, answered_at=$3
     WHERE id=$4 RETURNING *`,
    [status, answer_note ?? null, answered_at, req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: '기도제목을 찾을 수 없습니다.' })
  res.json(rows[0])
})

// 삭제
router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT event_id FROM prayer_requests WHERE id=$1', [req.params.id])
  if (rows[0]?.event_id) {
    await pool.query('DELETE FROM events WHERE id=$1', [rows[0].event_id]).catch(() => {})
  }
  await pool.query('DELETE FROM prayer_requests WHERE id=$1', [req.params.id])
  res.status(204).end()
})

export default router
