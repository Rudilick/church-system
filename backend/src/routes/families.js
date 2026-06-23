import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// 가족 관계 추가
router.post('/', async (req, res) => {
  const { member_id, related_member_id, relation_type } = req.body

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const addEdge = async (a, b, type) => {
      if (a === b) return 0
      let inserted = 0
      const fwd = await client.query(
        `INSERT INTO families (member_id, related_member_id, relation_type)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [a, b, type]
      )
      inserted += fwd.rowCount
      const reverse = reverseRelation(type)
      if (reverse) {
        const rev = await client.query(
          `INSERT INTO families (member_id, related_member_id, relation_type)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [b, a, reverse]
        )
        inserted += rev.rowCount
      }
      return inserted
    }

    await addEdge(member_id, related_member_id, relation_type)
    const autoLinked = await inferAndLinkRelatives(client, addEdge, member_id, related_member_id, relation_type)

    await client.query('COMMIT')
    res.status(201).json({ ok: true, autoLinked })
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
    father: 'child',      mother: 'child',
    sibling: 'sibling',
    grandparent: 'grandchild',           grandchild: 'grandparent',
    great_grandparent: 'great_grandchild', great_grandchild: 'great_grandparent',
    aunt_paternal: 'nephew_niece',
    uncle_paternal: 'nephew_niece',
    aunt_maternal: 'nephew_niece',
    uncle_maternal: 'nephew_niece',
    cousin: 'cousin',
    시부: '며느리', 시모: '며느리',
    장인: '사위',   장모: '사위',
    // 한글 입력 호환 (UI에서 한글로 저장된 기존 데이터 대응)
    '배우자': 'spouse',
    '부모': 'child', '자녀': 'parent',
    '부': 'child',   '모': 'child',
    '형제·자매': 'sibling', '형제자매': 'sibling',
    '조부모': 'grandchild', '손자녀': 'grandparent',
    // nephew_niece/며느리/사위 → null: 반대편 구분 불가, 수동 설정
  }
  return map[type] ?? null
}

// member_id→related_member_id 의 relation_type을 spouse/father/mother/child/sibling로 정규화. 추론 대상이 아니면 null
function normalizeCore(type) {
  const alias = { '배우자': 'spouse', '자녀': 'child', '부': 'father', '모': 'mother', '형제·자매': 'sibling', '형제자매': 'sibling' }
  const t = alias[type] ?? type
  return ['spouse', 'father', 'mother', 'child', 'sibling'].includes(t) ? t : null
}

const PARENT_TYPE_BY_GENDER = { M: 'father', F: 'mother' }

// 새 엣지(memberId, relatedId, relType) 추가 시, 이미 한쪽과 연결되어 있던 제3자와의 관계를 1-hop만 추론해 함께 연결한다.
// (예: 배우자가 이미 있는 사람에게 자녀를 추가하면, 배우자에게도 같은 자녀를 자동 연결)
async function inferAndLinkRelatives(client, addEdge, memberId, relatedId, relType) {
  const type = normalizeCore(relType)
  if (!type) return 0

  const { rows: members } = await client.query(
    `SELECT id, gender FROM members WHERE id IN ($1, $2)`,
    [memberId, relatedId]
  )
  const genderOf = id => members.find(m => m.id === id)?.gender

  const familyOf = async id => {
    const { rows } = await client.query(
      `SELECT related_member_id AS id, relation_type FROM families WHERE member_id = $1 AND related_member_id NOT IN ($2, $3)`,
      [id, memberId, relatedId]
    )
    return rows.map(r => ({ id: r.id, type: normalizeCore(r.relation_type) })).filter(r => r.type)
  }

  let autoLinked = 0

  if (type === 'spouse') {
    const memberFam = await familyOf(memberId)
    const relatedFam = await familyOf(relatedId)
    for (const c of memberFam.filter(f => f.type === 'child')) {
      autoLinked += await addEdge(relatedId, c.id, 'child')
    }
    for (const c of relatedFam.filter(f => f.type === 'child')) {
      autoLinked += await addEdge(memberId, c.id, 'child')
    }
  } else if (type === 'father' || type === 'mother') {
    // relatedId가 memberId의 부/모. relatedId의 배우자도 memberId의 부/모로, memberId의 형제도 relatedId의 자녀로 연결
    const relatedFam = await familyOf(relatedId)
    const memberFam = await familyOf(memberId)
    for (const spouse of relatedFam.filter(f => f.type === 'spouse')) {
      const pType = PARENT_TYPE_BY_GENDER[genderOf(spouse.id)]
      if (pType) autoLinked += await addEdge(memberId, spouse.id, pType)
    }
    for (const sib of memberFam.filter(f => f.type === 'sibling')) {
      autoLinked += await addEdge(sib.id, relatedId, type)
    }
  } else if (type === 'child') {
    // relatedId가 memberId의 자녀. memberId의 배우자도 relatedId의 부모로, memberId의 다른 자녀도 relatedId의 형제로 연결
    const memberFam = await familyOf(memberId)
    for (const spouse of memberFam.filter(f => f.type === 'spouse')) {
      autoLinked += await addEdge(spouse.id, relatedId, 'child')
    }
    for (const sibling of memberFam.filter(f => f.type === 'child')) {
      autoLinked += await addEdge(sibling.id, relatedId, 'sibling')
    }
  } else if (type === 'sibling') {
    // memberId와 relatedId가 형제. 서로의 부모와 다른 형제들을 맞교환 연결
    const memberFam = await familyOf(memberId)
    const relatedFam = await familyOf(relatedId)
    for (const parent of memberFam.filter(f => f.type === 'father' || f.type === 'mother')) {
      autoLinked += await addEdge(relatedId, parent.id, parent.type)
    }
    for (const parent of relatedFam.filter(f => f.type === 'father' || f.type === 'mother')) {
      autoLinked += await addEdge(memberId, parent.id, parent.type)
    }
    for (const sib of memberFam.filter(f => f.type === 'sibling')) {
      autoLinked += await addEdge(relatedId, sib.id, 'sibling')
    }
    for (const sib of relatedFam.filter(f => f.type === 'sibling')) {
      autoLinked += await addEdge(memberId, sib.id, 'sibling')
    }
  }

  return autoLinked
}

export { inferAndLinkRelatives, reverseRelation }
export default router
