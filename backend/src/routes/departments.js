import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

function buildTree(rows) {
  const map = {}
  rows.forEach(r => { map[r.id] = { ...r, children: [] } })
  const roots = []
  rows.forEach(r => {
    if (r.parent_id && map[r.parent_id]) map[r.parent_id].children.push(map[r.id])
    else roots.push(map[r.id])
  })
  return roots
}

// GET /departments?tree=true  or  GET /departments (flat)
router.get('/', async (req, res) => {
  if (req.query.tree === 'true') {
    const { rows } = await pool.query(`
      SELECT d.id, d.name, d.description, d.parent_id, d.sort_order, d.is_budget_dept,
             d.head_id, d.is_education,
             hm.name AS head_name, hm.photo_url AS head_photo, hm.position AS head_position,
             COALESCE(
               json_agg(
                 json_build_object('id',m.id,'name',m.name,'job_title',dm.job_title,'photo_url',m.photo_url)
                 ORDER BY m.name
               ) FILTER (WHERE m.id IS NOT NULL), '[]'
             ) AS members
      FROM departments d
      LEFT JOIN members hm ON hm.id = d.head_id
      LEFT JOIN department_members dm ON dm.department_id = d.id
      LEFT JOIN members m ON m.id = dm.member_id
      GROUP BY d.id, hm.name, hm.photo_url, hm.position
      ORDER BY d.sort_order, d.name
    `)
    return res.json(buildTree(rows))
  }
  const { rows } = await pool.query(
    `SELECT d.*, d.head_id, d.is_education,
            hm.name AS head_name, hm.photo_url AS head_photo, hm.position AS head_position,
            COUNT(dm.member_id)::int AS member_count
     FROM departments d
     LEFT JOIN members hm ON hm.id = d.head_id
     LEFT JOIN department_members dm ON dm.department_id = d.id
     GROUP BY d.id, hm.name, hm.photo_url, hm.position
     ORDER BY d.sort_order, d.name`
  )
  res.json(rows)
})

// 회원의 모든 부서 배정 조회
router.get('/by-member/:memberId', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT dm.department_id, d.name AS department_name, dm.job_title, dm.role
     FROM department_members dm
     JOIN departments d ON d.id = dm.department_id
     WHERE dm.member_id = $1 ORDER BY d.name`,
    [req.params.memberId]
  )
  res.json(rows)
})

// 회원의 모든 부서 배정 일괄 삭제
router.delete('/by-member/:memberId', async (req, res) => {
  await pool.query('DELETE FROM department_members WHERE member_id = $1', [req.params.memberId])
  res.status(204).end()
})

// 샘플 조직도 시드
router.post('/seed-org', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM department_members')
    await client.query('DELETE FROM departments')
    await client.query('ALTER SEQUENCE departments_id_seq RESTART WITH 1')

    const ins = async (name, parentId, order) => {
      const { rows } = await client.query(
        'INSERT INTO departments (name, parent_id, sort_order) VALUES ($1,$2,$3) RETURNING id',
        [name, parentId || null, order]
      )
      return rows[0].id
    }

    const 당회 = await ins('당회', null, 1)
    const 협의기관 = await ins('협의기관', 당회, 1)
    for (const [n, o] of [['감사위원회',1],['어린이집이사회',2],['교육위원회',3],['음악위원회',4],['대외협력위원회',5],['미디어위원회',6],['사랑의헌금관리위원회',7],['예결위원회',8],['식당위원회',9],['미화팀',10]])
      await ins(n, 협의기관, o)
    const 실행기관 = await ins('실행기관', 당회, 2)
    await ins('안수집사회', 실행기관, 1); await ins('권사회', 실행기관, 2)
    const 부속기관 = await ins('부속기관', 당회, 3)
    await ins('어린이집', 부속기관, 1)

    await ins('공동의회', null, 2)

    const 제직회 = await ins('제직회', null, 3)
    for (const [n, o] of [['총무부',1],['음영부',2],['교육부',3],['전도부',4],['선교부',5],['차량부',6],['사회부',7],['관리부',8],['친교부',9],['재정부',10],['새가족부',11]])
      await ins(n, 제직회, o)

    const 교회학교 = await ins('교회학교', null, 4)
    for (const [n, o] of [['유아부',1],['유치부',2],['유년부',3],['초등부',4],['청소년부',5],['청년부',6],['이음공동체',7],['시온부',8]])
      await ins(n, 교회학교, o)

    const 찬양대 = await ins('찬양대', null, 5)
    for (const [n, o] of [['사랑찬양대',1],['믿음찬양대',2],['소망찬양대',3],['화평찬양대',4]])
      await ins(n, 찬양대, o)

    const 찬양단 = await ins('찬양단', null, 6)
    for (const [n, o] of [['아이노스찬양단',1],['마하나임찬양단',2],['글로리아찬양단',3],['약속찬양단',4],['코람데오중창단',5]])
      await ins(n, 찬양단, o)

    const 선교회 = await ins('선교회', null, 7)
    const 남선교회 = await ins('남선교회', 선교회, 1)
    for (const [n, o] of [['장수회',1],['제1아브라함선교회',2],['제2아브라함선교회',3],['제1남선교회',4],['제2남선교회',5],['제3남선교회',6],['제4남선교회',7],['제5남선교회',8],['제6남선교회',9]])
      await ins(n, 남선교회, o)
    const 여선교회 = await ins('여선교회', 선교회, 2)
    for (const [n, o] of [['장수회',1],['제1한나전도회',2],['제2한나전도회',3],['제1여선교회',4],['제2여선교회',5],['제3여선교회',6],['제4여선교회',7],['제5여선교회',8],['제6여선교회',9],['제7여선교회',10],['제8여선교회',11]])
      await ins(n, 여선교회, o)

    const 구역회 = await ins('구역회', null, 8)
    for (const [n, o] of [['제1구역',1],['제2구역',2],['제3구역(청년부)',3]])
      await ins(n, 구역회, o)

    await client.query('COMMIT')
    res.json({ message: '샘플 조직도가 적용되었습니다.' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: '시드 실패' })
  } finally {
    client.release()
  }
})

router.get('/:id', async (req, res) => {
  const { rows: dept } = await pool.query(
    `SELECT d.*, hm.name AS head_name, hm.photo_url AS head_photo, hm.position AS head_position
     FROM departments d LEFT JOIN members hm ON hm.id = d.head_id WHERE d.id = $1`,
    [req.params.id]
  )
  if (!dept.length) return res.status(404).json({ error: '부서를 찾을 수 없습니다.' })
  const { rows: members } = await pool.query(
    `SELECT m.id, m.name, m.gender, m.photo_url, m.birth_date, dm.role, dm.job_title
     FROM department_members dm JOIN members m ON m.id = dm.member_id
     WHERE dm.department_id = $1 ORDER BY dm.role DESC, m.name`,
    [req.params.id]
  )
  res.json({ ...dept[0], members })
})

router.post('/', async (req, res) => {
  const { name, description, parent_id, sort_order, is_budget_dept, head_id } = req.body
  const { rows } = await pool.query(
    'INSERT INTO departments (name, description, parent_id, sort_order, is_budget_dept, head_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [name, description || null, parent_id || null, sort_order ?? 0, is_budget_dept ?? false, head_id || null]
  )
  // 부모가 is_education인 경우 자동 mirror
  if (rows[0].parent_id) {
    const { rows: ancestors } = await pool.query(
      `WITH RECURSIVE chain AS (
         SELECT id, parent_id, is_education FROM departments WHERE id = $1
         UNION ALL
         SELECT d.id, d.parent_id, d.is_education FROM departments d JOIN chain c ON d.id = c.parent_id
       )
       SELECT id FROM chain WHERE is_education = true LIMIT 1`,
      [rows[0].parent_id]
    )
    if (ancestors.length) {
      const { rows: commParent } = await pool.query(
        'SELECT id FROM communities WHERE source_dept_id = $1', [rows[0].parent_id]
      )
      if (commParent.length) {
        await pool.query(
          `INSERT INTO communities (name, parent_id, source_dept_id, is_locked, sort_order)
           VALUES ($1, $2, $3, true, 0) ON CONFLICT (source_dept_id) DO NOTHING`,
          [name, commParent[0].id, rows[0].id]
        )
      }
    }
  }
  res.status(201).json(rows[0])
})

router.put('/:id', async (req, res) => {
  const { name, description, parent_id, sort_order, is_budget_dept, head_id } = req.body
  const { rows } = await pool.query(
    'UPDATE departments SET name=$1, description=$2, parent_id=$3, sort_order=$4, is_budget_dept=$5, head_id=$6 WHERE id=$7 RETURNING *',
    [name, description || null, parent_id || null, sort_order ?? 0, is_budget_dept ?? false, head_id || null, req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: '부서를 찾을 수 없습니다.' })
  // 연동된 community name 동기화
  await pool.query('UPDATE communities SET name=$1 WHERE source_dept_id=$2', [name, req.params.id])
  res.json(rows[0])
})

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM departments WHERE id = $1', [req.params.id])
  res.status(204).end()
})

// ── 교육부서 → 교구구성 연동 ─────────────────────────────────
async function collectDeptIds(rootId, client) {
  const { rows } = await client.query(
    `WITH RECURSIVE sub AS (
       SELECT id FROM departments WHERE id = $1
       UNION ALL
       SELECT d.id FROM departments d JOIN sub s ON d.parent_id = s.id
     ) SELECT id FROM sub`,
    [rootId]
  )
  return rows.map(r => r.id)
}

async function syncTree(deptId, parentCommId, client) {
  const { rows: [dept] } = await client.query('SELECT * FROM departments WHERE id=$1', [deptId])
  const { rows: [comm] } = await client.query(
    `INSERT INTO communities (name, type, parent_id, source_dept_id, is_locked, sort_order)
     VALUES ($1, '', $2, $3, true, 0)
     ON CONFLICT (source_dept_id) WHERE source_dept_id IS NOT NULL DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [dept.name, parentCommId, deptId]
  )
  const { rows: children } = await client.query(
    'SELECT id FROM departments WHERE parent_id=$1 ORDER BY sort_order', [deptId]
  )
  for (const child of children) await syncTree(child.id, comm.id, client)
}

router.post('/:id/sync-to-communities', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('UPDATE departments SET is_education=true WHERE id=$1', [req.params.id])
    await syncTree(Number(req.params.id), null, client)
    await client.query('COMMIT')
    res.json({ ok: true })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: '연동에 실패했습니다.' })
  } finally { client.release() }
})

router.post('/:id/unsync-communities', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const ids = await collectDeptIds(Number(req.params.id), client)
    await client.query(
      'DELETE FROM communities WHERE is_locked=true AND source_dept_id = ANY($1)', [ids]
    )
    await client.query('UPDATE departments SET is_education=false WHERE id=$1', [req.params.id])
    await client.query('COMMIT')
    res.json({ ok: true })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: '해제에 실패했습니다.' })
  } finally { client.release() }
})

router.post('/:id/members', async (req, res) => {
  const { member_id, role, job_title } = req.body
  const { rows } = await pool.query(
    `INSERT INTO department_members (department_id, member_id, role, job_title)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (department_id, member_id) DO UPDATE SET role=$3, job_title=$4
     RETURNING *`,
    [req.params.id, member_id, role ?? 'member', job_title || null]
  )
  res.status(201).json(rows[0])
})

router.put('/:id/members/:memberId', async (req, res) => {
  const { job_title, role } = req.body
  const { rows } = await pool.query(
    `UPDATE department_members SET job_title=$1, role=COALESCE($2,role)
     WHERE department_id=$3 AND member_id=$4 RETURNING *`,
    [job_title || null, role || null, req.params.id, req.params.memberId]
  )
  if (!rows.length) return res.status(404).json({ error: '소속 정보를 찾을 수 없습니다.' })
  res.json(rows[0])
})

router.delete('/:id/members/:memberId', async (req, res) => {
  await pool.query(
    'DELETE FROM department_members WHERE department_id=$1 AND member_id=$2',
    [req.params.id, req.params.memberId]
  )
  res.status(204).end()
})

export default router
