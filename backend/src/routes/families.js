import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 가족 관계 추가
router.post('/', async (req, res) => {
  const { member_id, related_member_id, relation_type } = req.body

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO families (member_id, related_member_id, relation_type)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [member_id, related_member_id, relation_type]
    )
    const reverse = reverseRelation(relation_type)
    if (reverse) {
      await client.query(
        `INSERT INTO families (member_id, related_member_id, relation_type)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [related_member_id, member_id, reverse]
      )
    }
    await client.query('COMMIT')
    res.status(201).json({ ok: true })
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// 가족 관계 삭제
router.delete('/', async (req, res) => {
  const { member_id, related_member_id } = req.body
  await pool.query(
    `DELETE FROM families
     WHERE (member_id = $1 AND related_member_id = $2)
        OR (member_id = $2 AND related_member_id = $1)`,
    [member_id, related_member_id]
  )
  res.status(204).end()
})

function reverseRelation(type) {
  const map = {
    spouse: 'spouse',
    parent: 'child',      child: 'parent',
    sibling: 'sibling',
    grandparent: 'grandchild',           grandchild: 'grandparent',
    great_grandparent: 'great_grandchild', great_grandchild: 'great_grandparent',
    aunt_paternal: 'nephew_niece',
    uncle_paternal: 'nephew_niece',
    aunt_maternal: 'nephew_niece',
    uncle_maternal: 'nephew_niece',
    cousin: 'cousin',
    // nephew_niece → null: 조카쪽에서 고모/삼촌/이모/외삼촌 구분 불가, 수동 설정
  }
  return map[type] ?? null
}

export default router
