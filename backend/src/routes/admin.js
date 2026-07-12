import { Router } from 'express'
import pool from '../db/pool.js'
import { createBackup, cleanupBackups } from '../services/backupService.js'

const router = Router()

const VALID_ROLES = ['super_admin', 'church_admin', 'pastor', 'teacher', 'finance', 'member']

// GET /api/admin/users/stats — 역할별 카운트
router.get('/users/stats', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT role, COUNT(*)::int AS count
    FROM users
    GROUP BY role
    ORDER BY role
  `)
  const total = await pool.query(`SELECT COUNT(*)::int AS count FROM users`)
  const active = await pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE is_active = true`)
  res.json({
    byRole: rows,
    total: total.rows[0].count,
    active: active.rows[0].count,
  })
})

// GET /api/admin/users — 사용자 목록
router.get('/users', async (req, res) => {
  const { q } = req.query
  let query = `
    SELECT id, email, name, picture, role, church_id, department, is_active, created_at, updated_at
    FROM users
  `
  const params = []
  if (q) {
    query += ` WHERE email ILIKE $1 OR name ILIKE $1`
    params.push(`%${q}%`)
  }
  query += ` ORDER BY created_at DESC`
  const { rows } = await pool.query(query, params)
  res.json(rows)
})

// POST /api/admin/users — 사용자 등록
router.post('/users', async (req, res) => {
  const { email, name, google_user_id, role, church_id, department } = req.body
  if (!email || !name) return res.status(400).json({ error: 'email, name 필수' })
  if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: '유효하지 않은 role' })

  // church_admin은 자기 church_id 소속 사용자만 등록 가능
  const targetChurchId = req.user.role === 'super_admin'
    ? (church_id ?? req.user.church_id)
    : req.user.church_id

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, name, google_user_id, role, church_id, department, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, email, name, role, church_id, department, is_active, created_at`,
      [email, name, google_user_id || null, role || 'member', targetChurchId, department || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: '이미 등록된 이메일 또는 Google 계정입니다.' })
    throw err
  }
})

// PUT /api/admin/users/:id — 사용자 정보 수정
router.put('/users/:id', async (req, res) => {
  const { id } = req.params
  const { role, church_id, department, is_active, name, google_user_id } = req.body

  // church_admin은 자기 church_id 소속 사용자만 수정 가능
  if (req.user.role === 'church_admin') {
    const { rows } = await pool.query('SELECT church_id FROM users WHERE id=$1', [id])
    if (!rows.length) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })
    if (rows[0].church_id !== req.user.church_id) {
      return res.status(403).json({ error: '다른 교회 사용자를 수정할 수 없습니다.' })
    }
    // church_admin은 super_admin을 만들 수 없음
    if (role === 'super_admin') return res.status(403).json({ error: '권한이 없습니다.' })
  }

  if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: '유효하지 않은 role' })

  const fields = []
  const vals = []
  let idx = 1

  if (role !== undefined)           { fields.push(`role=$${idx++}`);           vals.push(role) }
  if (church_id !== undefined)      { fields.push(`church_id=$${idx++}`);      vals.push(church_id) }
  if (department !== undefined)     { fields.push(`department=$${idx++}`);     vals.push(department) }
  if (is_active !== undefined)      { fields.push(`is_active=$${idx++}`);      vals.push(is_active) }
  if (name !== undefined)           { fields.push(`name=$${idx++}`);           vals.push(name) }
  if (google_user_id !== undefined) { fields.push(`google_user_id=$${idx++}`); vals.push(google_user_id) }

  if (!fields.length) return res.status(400).json({ error: '수정할 필드가 없습니다.' })

  fields.push(`updated_at=NOW()`)
  vals.push(id)

  const { rows } = await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id=$${idx} RETURNING id, email, name, role, church_id, department, is_active, updated_at`,
    vals
  )
  if (!rows.length) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })
  res.json(rows[0])
})

// DELETE /api/admin/users/:id — 비활성화 (soft delete)
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params

  // 자기 자신은 비활성화 불가
  if (Number(id) === req.user.id) {
    return res.status(400).json({ error: '자기 자신은 비활성화할 수 없습니다.' })
  }

  if (req.user.role === 'church_admin') {
    const { rows } = await pool.query('SELECT church_id, role FROM users WHERE id=$1', [id])
    if (!rows.length) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })
    if (rows[0].church_id !== req.user.church_id) {
      return res.status(403).json({ error: '다른 교회 사용자를 삭제할 수 없습니다.' })
    }
    if (rows[0].role === 'super_admin') {
      return res.status(403).json({ error: '권한이 없습니다.' })
    }
  }

  const { rows } = await pool.query(
    `UPDATE users SET is_active=false, updated_at=NOW() WHERE id=$1 RETURNING id, email, name, is_active`,
    [id]
  )
  if (!rows.length) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })
  res.json(rows[0])
})


// ── 교적 백업 목록 조회 ─────────────────────────────────────
router.get('/backups', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, backup_type, backup_date, member_count, created_at
     FROM member_backups
     ORDER BY backup_date DESC, backup_type ASC`
  )
  res.json(rows)
})

// ── 교적 백업 Excel 다운로드 ────────────────────────────────
router.get('/backups/:id/download', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM member_backups WHERE id = $1`, [req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: '백업을 찾을 수 없습니다.' })

  const backup = rows[0]
  const memberRows = Array.isArray(backup.data) ? backup.data : JSON.parse(backup.data)

  // buildMemberWorkbook은 members 라우트 파일 내 함수라 직접 접근 불가.
  // 동일 로직을 ExcelJS로 직접 구현 (간단 버전: 데이터만 포함)
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('교적백업')

  const HEADERS = [
    '순번','이름*','영문이름','성별','생년월일','음력여부','휴대폰','집전화','이메일',
    '주소','상세주소','교인구분','교회학교부서','신급','교인상태','직분',
    '등록일','세례일','인도자','이전교회','이전교회직분','직업','결혼기념일',
    '신앙세대주','세대주관계','직장명','학교명','교역자직원여부','교역자직원직함','메모',
  ]

  ws.columns = HEADERS.map(h => ({ header: h, key: h, width: 14 }))
  const hRow = ws.getRow(1)
  hRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
  })

  const TYPE_LABEL  = { active:'현재재적', inactive:'재적외', transfer_out:'이명', deceased:'소천' }
  const STAFF_LABEL = { pastoral:'교역자', other:'직원' }

  memberRows.forEach((m, i) => {
    ws.addRow({
      '순번': i + 1,
      '이름*': m.name ?? '',
      '영문이름': m.name_en ?? '',
      '성별': m.gender === 'M' ? '남' : m.gender === 'F' ? '여' : '',
      '생년월일': m.birth_date ? new Date(m.birth_date) : '',
      '음력여부': m.birth_lunar ? 'O' : 'X',
      '휴대폰': m.phone ?? '',
      '집전화': m.home_phone ?? '',
      '이메일': m.email ?? '',
      '주소': m.address ?? '',
      '상세주소': m.address_detail ?? '',
      '교인구분': m.membership_category ?? '',
      '교회학교부서': m.school_department ?? '',
      '신급': m.faith_level ?? '',
      '교인상태': TYPE_LABEL[m.membership_type] ?? '',
      '직분': m.position ?? '',
      '등록일': m.registered_at ? new Date(m.registered_at) : '',
      '세례일': m.baptism_date ? new Date(m.baptism_date) : '',
      '인도자': m.introducer_name ?? '',
      '이전교회': m.previous_church ?? '',
      '이전교회직분': m.previous_church_position ?? '',
      '직업': m.occupation ?? '',
      '결혼기념일': m.anniversary_date ? new Date(m.anniversary_date) : '',
      '신앙세대주': m.household_head_name ?? '',
      '세대주관계': m.household_relation ?? '',
      '직장명': m.workplace ?? '',
      '학교명': m.school ?? '',
      '교역자직원여부': STAFF_LABEL[m.staff_category] ?? '해당없음',
      '교역자직원직함': m.staff_role ?? '',
      '메모': m.note ?? '',
      '차량번호': m.vehicle_number ?? '',
    })
  })

  const dateStr = String(backup.backup_date).slice(0, 10).replace(/-/g, '')
  const typeLabel = backup.backup_type === 'monthly' ? '월별' : '일별'
  const buf = await wb.xlsx.writeBuffer()
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''%EA%B5%90%EC%A0%81%EB%B0%B1%EC%97%85_${typeLabel}_${dateStr}.xlsx`)
  res.send(buf)
})

// ── 즉시 백업 실행 (수동) ──────────────────────────────────
router.post('/backups/run', async (req, res) => {
  try {
    await createBackup('daily')
    if (new Date().getDate() === 1) await createBackup('monthly')
    await cleanupBackups()
    const { rows } = await pool.query(
      `SELECT id, backup_type, backup_date, member_count, created_at
       FROM member_backups ORDER BY backup_date DESC, backup_type LIMIT 5`
    )
    res.json({ message: '백업 완료', recent: rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
