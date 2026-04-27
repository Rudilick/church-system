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
             COALESCE(
               json_agg(
                 json_build_object('id',m.id,'name',m.name,'job_title',dm.job_title,'photo_url',m.photo_url)
                 ORDER BY m.name
               ) FILTER (WHERE m.id IS NOT NULL), '[]'
             ) AS members
      FROM departments d
      LEFT JOIN department_members dm ON dm.department_id = d.id
      LEFT JOIN members m ON m.id = dm.member_id
      GROUP BY d.id
      ORDER BY d.sort_order, d.name
    `)
    return res.json(buildTree(rows))
  }
  const { rows } = await pool.query('SELECT * FROM departments ORDER BY sort_order, name')
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
  const { rows: dept } = await pool.query('SELECT *, is_budget_dept FROM departments WHERE id = $1', [req.params.id])
  if (!dept.length) return res.status(404).json({ error: '부서를 찾을 수 없습니다.' })
  const { rows: members } = await pool.query(
    `SELECT m.id, m.name, m.gender, m.photo_url, dm.role, dm.job_title
     FROM department_members dm JOIN members m ON m.id = dm.member_id
     WHERE dm.department_id = $1 ORDER BY dm.role DESC, m.name`,
    [req.params.id]
  )
  res.json({ ...dept[0], members })
})

router.post('/', async (req, res) => {
  const { name, description, parent_id, sort_order, is_budget_dept } = req.body
  const { rows } = await pool.query(
    'INSERT INTO departments (name, description, parent_id, sort_order, is_budget_dept) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [name, description || null, parent_id || null, sort_order ?? 0, is_budget_dept ?? false]
  )
  res.status(201).json(rows[0])
})

router.put('/:id', async (req, res) => {
  const { name, description, parent_id, sort_order, is_budget_dept } = req.body
  const { rows } = await pool.query(
    'UPDATE departments SET name=$1, description=$2, parent_id=$3, sort_order=$4, is_budget_dept=$5 WHERE id=$6 RETURNING *',
    [name, description || null, parent_id || null, sort_order ?? 0, is_budget_dept ?? false, req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: '부서를 찾을 수 없습니다.' })
  res.json(rows[0])
})

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM departments WHERE id = $1', [req.params.id])
  res.status(204).end()
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
