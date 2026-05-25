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

// ── 곡 라이브러리 자동완성 검색 (/:id 패턴보다 먼저 선언) ──
router.get('/song-library/search', async (req, res) => {
  const q = (req.query.q || '').trim()
  if (!q) return res.json([])
  try {
    const { rows } = await pool.query(
      `SELECT id, song_title, last_blocks, last_note, last_sheet
         FROM song_library
        WHERE created_by = $1 AND song_title ILIKE $2
        ORDER BY updated_at DESC
        LIMIT 10`,
      [req.user.id, `%${q}%`]
    )
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
})

// ── 곡 이력 조회 (갤러리용 — 동일 제목의 모든 큐 기록) ──────
router.get('/songs/history', async (req, res) => {
  const { title } = req.query
  if (!title) return res.json([])
  try {
    const { rows } = await pool.query(
      `SELECT
         wqs.id, wqs.song_title, wqs.blocks, wqs.note,
         wq.title AS queue_title, wq.queue_date,
         COALESCE((
           SELECT json_agg(sh.sheet_image ORDER BY sh.order_index)
           FROM worship_queue_songs sh
           WHERE sh.queue_id = wqs.queue_id
             AND sh.item_type = 'sheet'
             AND sh.order_index > wqs.order_index
             AND sh.order_index < COALESCE(
               (SELECT MIN(ns.order_index)
                FROM worship_queue_songs ns
                WHERE ns.queue_id = wqs.queue_id
                  AND ns.item_type = 'song'
                  AND ns.order_index > wqs.order_index), 999999)
             AND sh.sheet_image IS NOT NULL
         ), '[]'::json) AS sheet_images
       FROM worship_queue_songs wqs
       JOIN worship_queues wq ON wq.id = wqs.queue_id
       WHERE wqs.item_type = 'song'
         AND wqs.song_title = $1
         AND wq.created_by = $2
       ORDER BY wq.queue_date DESC NULLS LAST, wq.id DESC
       LIMIT 30`,
      [title, req.user.id]
    )
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
})

// ── 곡 레코드 삭제 (갤러리 삭제) ─────────────────────────────
router.delete('/songs/:songId', async (req, res) => {
  try {
    // 본인 곡인지 확인 + queue_id / order_index 조회
    const { rows } = await pool.query(
      `SELECT wqs.queue_id, wqs.order_index
         FROM worship_queue_songs wqs
         JOIN worship_queues wq ON wq.id = wqs.queue_id
        WHERE wqs.id = $1 AND wq.created_by = $2`,
      [req.params.songId, req.user.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'not found' })
    const { queue_id, order_index } = rows[0]

    // 바로 뒤 연속 sheet 레코드 삭제
    await pool.query(
      `DELETE FROM worship_queue_songs
        WHERE queue_id = $1
          AND item_type = 'sheet'
          AND order_index > $2
          AND order_index < COALESCE(
            (SELECT MIN(order_index) FROM worship_queue_songs
              WHERE queue_id = $1 AND item_type = 'song' AND order_index > $2),
            999999)`,
      [queue_id, order_index]
    )
    // 곡 레코드 삭제
    await pool.query('DELETE FROM worship_queue_songs WHERE id = $1', [req.params.songId])
    res.status(204).end()
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

// ── 아이템 목록 조회 ──────────────────────────────────────
router.get('/:id/songs', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, queue_id, order_index, item_type, song_title, blocks, note, arrow_label, sheet_image
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

// ── 아이템 목록 전체 저장 (bulk replace) + song_library upsert ──
router.put('/:id/songs', async (req, res) => {
  const items = req.body.items || req.body.songs || []
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      'DELETE FROM worship_queue_songs WHERE queue_id = $1',
      [req.params.id]
    )
    const saved = []
    let pendingSheet = null

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const type = item.item_type || 'song'

      const { rows } = await client.query(
        `INSERT INTO worship_queue_songs
           (queue_id, order_index, item_type, song_title, blocks, note, arrow_label, sheet_image)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          req.params.id,
          i,
          type,
          item.song_title || '',
          JSON.stringify(item.blocks || []),
          item.note || '',
          item.arrow_label || '',
          item.sheet_image || null,
        ]
      )
      saved.push(rows[0])

      // song_library upsert: sheet 타입은 다음 song에 연결
      if (type === 'sheet') {
        pendingSheet = item.sheet_image || null
      }
      if (type === 'song' && item.song_title?.trim()) {
        await client.query(
          `INSERT INTO song_library (song_title, last_blocks, last_note, last_sheet, created_by, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (song_title, created_by) DO UPDATE SET
             last_blocks = EXCLUDED.last_blocks,
             last_note   = EXCLUDED.last_note,
             last_sheet  = EXCLUDED.last_sheet,
             updated_at  = NOW()`,
          [
            item.song_title.trim(),
            JSON.stringify(item.blocks || []),
            item.note || '',
            pendingSheet,
            req.user.id,
          ]
        )
        pendingSheet = null
      }
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
