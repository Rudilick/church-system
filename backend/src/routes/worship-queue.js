import { Router } from 'express'
import pool from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// ── 큐시트 목록 ───────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, queue_date, created_at, updated_at
         FROM worship_queues
        WHERE created_by = $1
        ORDER BY updated_at DESC`,
      [req.user.id]
    )
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
})

// ── 큐시트 생성 ───────────────────────────────────────────
router.post('/', async (req, res) => {
  const { title = '새 큐시트', queue_date = null } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO worship_queues (title, queue_date, created_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [title, queue_date, req.user.id]
    )
    res.status(201).json(rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
})

// ── 큐시트 수정 ───────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { title, queue_date } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE worship_queues
          SET title = COALESCE($1, title),
              queue_date = $2,
              updated_at = NOW()
        WHERE id = $3 AND created_by = $4
       RETURNING *`,
      [title, queue_date ?? null, req.params.id, req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'not found' })
    res.json(rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
})

// ── 큐시트 삭제 ───────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM worship_queues WHERE id = $1 AND created_by = $2`,
      [req.params.id, req.user.id]
    )
    res.status(204).end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
})

// ── 곡 목록 조회 ──────────────────────────────────────────
router.get('/:id/songs', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, queue_id, order_index, song_title, blocks, note, arrow_label
         FROM worship_queue_songs
        WHERE queue_id = $1
        ORDER BY order_index`,
      [req.params.id]
    )
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
})

// ── 곡 목록 전체 저장 (bulk replace) ─────────────────────
router.put('/:id/songs', async (req, res) => {
  const { songs = [] } = req.body
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      'DELETE FROM worship_queue_songs WHERE queue_id = $1',
      [req.params.id]
    )
    const saved = []
    for (let i = 0; i < songs.length; i++) {
      const s = songs[i]
      const { rows } = await client.query(
        `INSERT INTO worship_queue_songs (queue_id, order_index, song_title, blocks, note, arrow_label)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          req.params.id,
          i,
          s.song_title || '',
          JSON.stringify(s.blocks || []),
          s.note || '',
          s.arrow_label || '',
        ]
      )
      saved.push(rows[0])
    }
    await client.query(
      'UPDATE worship_queues SET updated_at = NOW() WHERE id = $1',
      [req.params.id]
    )
    await client.query('COMMIT')
    res.json(saved)
  } catch (e) {
    await client.query('ROLLBACK')
    console.error(e)
    res.status(500).json({ error: e.message })
  } finally {
    client.release()
  }
})

export default router
