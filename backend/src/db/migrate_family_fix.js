// 가족관계(families) 3자 관계 누락 보정 스크립트
// - 배우자/자녀/형제 관계가 한쪽에만 저장되어 있던 기존 데이터를 보정한다.
// - 기본은 dry-run(조회만). 실제 반영하려면 --apply 플래그를 붙인다.
//   node backend/src/db/migrate_family_fix.js          (dry-run)
//   node backend/src/db/migrate_family_fix.js --apply   (실제 반영)
import dotenv from 'dotenv'
import pool from './pool.js'

dotenv.config()

const APPLY = process.argv.includes('--apply')

// 배우자 한쪽에만 연결된 자녀를 찾는다: A-spouse-B, A-child-C 인데 B-child-C 가 없는 경우
async function findMissingSpouseChildLinks() {
  const { rows } = await pool.query(`
    SELECT s.member_id AS parent_a, s.related_member_id AS parent_b,
           c.related_member_id AS child_id, mb.gender AS parent_b_gender
    FROM families s
    JOIN families c ON c.member_id = s.member_id AND c.relation_type = 'child'
    JOIN members mb ON mb.id = s.related_member_id
    WHERE s.relation_type = 'spouse'
      AND NOT EXISTS (
        SELECT 1 FROM families x
        WHERE x.member_id = s.related_member_id AND x.related_member_id = c.related_member_id
      )
  `)
  return rows
}

// 같은 부모를 둔 자녀들 사이에 sibling 엣지가 없는 경우를 찾는다
async function findMissingSiblingLinks() {
  const { rows } = await pool.query(`
    SELECT DISTINCT c1.member_id AS child_a, c2.member_id AS child_b
    FROM families c1
    JOIN families c2
      ON c2.related_member_id = c1.related_member_id
     AND c2.relation_type IN ('father', 'mother')
     AND c1.member_id < c2.member_id
    WHERE c1.relation_type IN ('father', 'mother')
      AND NOT EXISTS (
        SELECT 1 FROM families x
        WHERE x.member_id = c1.member_id AND x.related_member_id = c2.member_id AND x.relation_type = 'sibling'
      )
  `)
  return rows
}

async function applySpouseChildLinks(client, rows) {
  let count = 0
  for (const r of rows) {
    const parentType = r.parent_b_gender === 'M' ? 'father' : r.parent_b_gender === 'F' ? 'mother' : null
    if (!parentType) continue
    const childRel = parentType === 'father' ? 'father' : 'mother'
    await client.query(
      `INSERT INTO families (member_id, related_member_id, relation_type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [r.parent_b, r.child_id, 'child']
    )
    await client.query(
      `INSERT INTO families (member_id, related_member_id, relation_type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [r.child_id, r.parent_b, childRel]
    )
    count++
  }
  return count
}

async function applySiblingLinks(client, rows) {
  let count = 0
  for (const r of rows) {
    await client.query(
      `INSERT INTO families (member_id, related_member_id, relation_type) VALUES ($1, $2, 'sibling') ON CONFLICT DO NOTHING`,
      [r.child_a, r.child_b]
    )
    await client.query(
      `INSERT INTO families (member_id, related_member_id, relation_type) VALUES ($1, $2, 'sibling') ON CONFLICT DO NOTHING`,
      [r.child_b, r.child_a]
    )
    count++
  }
  return count
}

async function run() {
  const spouseChildGaps = await findMissingSpouseChildLinks()
  const siblingGaps = await findMissingSiblingLinks()

  console.log(`🔍 배우자-자녀 누락: ${spouseChildGaps.length}건`)
  for (const r of spouseChildGaps.slice(0, 20)) {
    console.log(`   부모(${r.parent_b}) ↔ 자녀(${r.child_id}) 연결 누락`)
  }

  console.log(`🔍 형제자매 누락: ${siblingGaps.length}건`)
  for (const r of siblingGaps.slice(0, 20)) {
    console.log(`   자녀(${r.child_a}) ↔ 자녀(${r.child_b}) sibling 연결 누락`)
  }

  if (!APPLY) {
    console.log('\n💡 dry-run 모드입니다. 실제로 반영하려면 --apply 플래그를 붙여 다시 실행하세요.')
    await pool.end()
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const n1 = await applySpouseChildLinks(client, spouseChildGaps)
    const n2 = await applySiblingLinks(client, siblingGaps)
    await client.query('COMMIT')
    console.log(`\n✅ 보정 완료: 배우자-자녀 ${n1}건, 형제자매 ${n2}건`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ 보정 실패:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => {
  console.error('❌ 스크립트 실행 실패:', err)
  process.exit(1)
})
