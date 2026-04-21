import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 내 채팅방 목록
router.get('/rooms', async (req, res) => {
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id 필수' })

  const { rows } = await pool.query(
    `SELECT mr.id, mr.name, mr.is_group,
            (SELECT m.body FROM messages m WHERE m.room_id = mr.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
            (SELECT m.created_at FROM messages m WHERE m.room_id = mr.id ORDER BY m.created_at DESC LIMIT 1) AS last_at
     FROM message_rooms mr
     JOIN message_room_members mrm ON mrm.room_id = mr.id
     WHERE mrm.user_id = $1
     ORDER BY last_at DESC NULLS LAST`,
    [user_id]
  )
  res.json(rows)
})

// 채팅방 생성
router.post('/rooms', async (req, res) => {
  const { name, is_group, user_ids } = req.body
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: roomRows } = await client.query(
      'INSERT INTO message_rooms (name, is_group) VALUES ($1, $2) RETURNING *',
      [name ?? null, is_group ?? false]
    )
    const room = roomRows[0]
    for (const uid of user_ids) {
      await client.query(
        'INSERT INTO message_room_members (room_id, user_id) VALUES ($1, $2)',
        [room.id, uid]
      )
    }
    await client.query('COMMIT')
    res.status(201).json(room)
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// 채팅방 메시지 조회
router.get('/rooms/:id/messages', async (req, res) => {
  const { before, limit = 50 } = req.query
  let where = 'WHERE m.room_id = $1'
  const params = [req.params.id]

  if (before) {
    params.push(before)
    where += ` AND m.created_at < $${params.length}`
  }

  params.push(limit)
  const { rows } = await pool.query(
    `SELECT m.*, u.name AS sender_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     ${where}
     ORDER BY m.created_at DESC
     LIMIT $${params.length}`,
    params
  )
  res.json(rows.reverse())
})

// 메시지 전송
router.post('/rooms/:id/messages', async (req, res) => {
  const { sender_id, body, file_url } = req.body
  const { rows } = await pool.query(
    `INSERT INTO messages (room_id, sender_id, body, file_url)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.params.id, sender_id, body, file_url ?? null]
  )
  res.status(201).json(rows[0])
})

// 읽음 처리
router.post('/messages/:id/read', async (req, res) => {
  const { user_id } = req.body
  await pool.query(
    `INSERT INTO message_reads (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.params.id, user_id]
  )
  res.status(204).end()
})

export default router
