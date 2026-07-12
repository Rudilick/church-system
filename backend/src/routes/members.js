import { Router } from 'express'
import pool from '../db/pool.js'
import multer from 'multer'

const upload = multer({ storage: multer.memoryStorage() })

const router = Router()

// ── 전체 필드 ILIKE 검색 블록 생성 ─────────────────────────
function buildFieldSearch(paramIdx) {
  const p = `$${paramIdx}`
  return `(
    m.name ILIKE ${p} OR m.name_en ILIKE ${p}
    OR m.phone ILIKE ${p} OR m.home_phone ILIKE ${p}
    OR m.birth_date::text ILIKE ${p}
    OR m.address ILIKE ${p} OR m.address_detail ILIKE ${p}
    OR m.email ILIKE ${p} OR m.position ILIKE ${p}
    OR m.membership_category ILIKE ${p}
    OR m.faith_level ILIKE ${p} OR m.school_department ILIKE ${p}
    OR m.workplace ILIKE ${p} OR m.school ILIKE ${p}
    OR m.introducer_name ILIKE ${p} OR m.previous_church ILIKE ${p}
    OR m.previous_church_position ILIKE ${p}
    OR m.occupation ILIKE ${p}
    OR m.household_head_name ILIKE ${p} OR m.household_relation ILIKE ${p}
    OR m.note ILIKE ${p}
    OR (CASE m.gender
        WHEN 'M' THEN '남 남성 남자' WHEN 'F' THEN '여 여성 여자'
        ELSE m.gender END) ILIKE ${p}
    OR (CASE m.membership_type
        WHEN 'active'       THEN '현재재적'
        WHEN 'inactive'     THEN '재적 외'
        WHEN 'transfer_out' THEN '이명'
        WHEN 'deceased'     THEN '소천'
        ELSE m.membership_type END) ILIKE ${p}
    OR (CASE m.staff_category
        WHEN 'pastoral' THEN '교역자'
        WHEN 'other'    THEN '직원'
        ELSE m.staff_category END) ILIKE ${p}
    OR m.staff_role ILIKE ${p}
    OR EXISTS (
      SELECT 1 FROM member_communities mc
      JOIN communities c ON c.id = mc.community_id
      WHERE mc.member_id = m.id AND c.name ILIKE ${p}
    )
    OR EXISTS (
      SELECT 1 FROM department_members dm
      JOIN departments d ON d.id = dm.department_id
      WHERE dm.member_id = m.id AND d.name ILIKE ${p}
    )
    OR EXISTS (
      SELECT 1 FROM families f
      JOIN members fm ON fm.id = f.related_member_id
      WHERE f.member_id = m.id AND fm.name ILIKE ${p}
    )
  )`
}

// 목록 조회 (검색, 페이징)
router.get('/', async (req, res) => {
  const { q, type, page = 1, limit = 50, conditions: condRaw, sort, name_only } = req.query
  const offset = (page - 1) * limit

  let where = 'WHERE 1=1'
  const params = []

  // 단순 검색 — 이름 전용(name_only) 또는 전 필드 ILIKE
  if (q && !condRaw) {
    params.push(`%${q}%`)
    where += name_only
      ? ` AND m.name ILIKE $${params.length}`
      : ` AND ${buildFieldSearch(params.length)}`
  }

  // 조건 검색 (conditions JSON 파라미터)
  if (condRaw) {
    try {
      const conds = JSON.parse(condRaw).filter(c => c.q?.trim())
      if (conds.length > 0) {
        const parts = conds.map((cond, i) => {
          params.push(`%${cond.q.trim()}%`)
          return { expr: buildFieldSearch(params.length), op: cond.op || 'OR' }
        })
        // 첫 조건은 항상 포함, 이후는 op로 연결
        let condExpr = parts[0].expr
        for (let i = 1; i < parts.length; i++) {
          condExpr = `(${condExpr}) ${parts[i].op} (${parts[i].expr})`
        }
        where += ` AND (${condExpr})`
      }
    } catch { /* 파싱 실패 시 무시 */ }
  }

  if (type) {
    params.push(type)
    where += ` AND m.membership_type = $${params.length}`
  }
  if (req.query.positions) {
    const posArr = req.query.positions.split(',').map(p => p.trim())
    params.push(posArr)
    where += ` AND m.position = ANY($${params.length})`
  }
  if (req.query.category) {
    params.push(req.query.category)
    if (req.query.category === 'pastoral' || req.query.category === 'other') {
      where += ` AND m.staff_category = $${params.length}`
    } else {
      where += ` AND m.position IN (SELECT name FROM positions WHERE category = $${params.length} AND is_active = true)`
    }
  }
  if (req.query.birth_date) {
    params.push(req.query.birth_date)
    where += ` AND m.birth_date = $${params.length}`
  }
  if (req.query.community_id) {
    params.push(req.query.community_id)
    where += ` AND m.id IN (SELECT member_id FROM member_communities WHERE community_id = $${params.length})`
  }

  // 정렬
  // COLLATE "C" — DB 기본 로케일(en_US.utf8 등)의 한글 정렬 규칙에 기대지 않고
  // 순수 코드포인트(ㄱㄴㄷ 앞선순) 기준으로 정렬한다. 글자 수와 무관하게 정확한 순서 보장.
  const orderMap = {
    name_asc:   'm.name COLLATE "C" ASC',
    name_desc:  'm.name COLLATE "C" DESC',
    birth_asc:  'm.birth_date ASC NULLS LAST',
    birth_desc: 'm.birth_date DESC NULLS LAST',
  }
  const orderBy      = orderMap[sort] || 'm.name COLLATE "C" ASC'
  const orderByOuter = orderBy.replace(/\bm\./g, '')  // 외부 쿼리에서 m. 접두사 제거

  params.push(Number(limit) || 50, Number(offset) || 0)

  let rows
  try {
    const result = await pool.query(
      `SELECT sub.*,
              COALESCE(
                (SELECT JSON_AGG(JSON_BUILD_OBJECT('name', c.name, 'type', c.type, 'role', mc.role))
                 FROM member_communities mc
                 JOIN communities c ON c.id = mc.community_id
                 WHERE mc.member_id = sub.id),
                '[]'::json
              ) AS communities,
              COALESCE(
                (SELECT JSON_AGG(JSON_BUILD_OBJECT('name', d.name))
                 FROM department_members dm
                 JOIN departments d ON d.id = dm.department_id
                 WHERE dm.member_id = sub.id),
                '[]'::json
              ) AS departments,
              COALESCE(
                (SELECT JSON_AGG(JSON_BUILD_OBJECT('name', fm.name, 'relation', f.relation_type))
                 FROM families f
                 JOIN members fm ON fm.id = f.related_member_id
                 WHERE f.member_id = sub.id),
                '[]'::json
              ) AS families,
              (
                WITH RECURSIVE cp AS (
                  SELECT c.id, c.parent_id,
                         CASE WHEN c.type IS NOT NULL AND c.type != ''
                              THEN c.name || c.type ELSE c.name END AS seg,
                         1 AS lvl
                  FROM (
                    SELECT mc2.community_id FROM member_communities mc2
                    WHERE mc2.member_id = sub.id ORDER BY mc2.id LIMIT 1
                  ) first_mc
                  JOIN communities c ON c.id = first_mc.community_id
                  UNION ALL
                  SELECT c.id, c.parent_id,
                         CASE WHEN c.type IS NOT NULL AND c.type != ''
                              THEN c.name || c.type ELSE c.name END AS seg,
                         cp.lvl + 1
                  FROM cp JOIN communities c ON c.id = cp.parent_id
                )
                SELECT string_agg(seg, ' ' ORDER BY lvl DESC) FROM cp
              ) AS community_text
       FROM (
         SELECT m.id, m.name, m.name_en, m.gender, m.birth_date, m.phone, m.home_phone,
                m.photo_url, m.membership_type, m.registered_at, m.position,
                m.school_department, m.address, m.address_detail, m.email,
                m.membership_category, m.faith_level, m.workplace, m.school,
                m.occupation, m.note, m.introducer_name, m.previous_church,
                m.previous_church_position, m.household_head_name, m.household_relation,
                COUNT(*) OVER() AS total_count
         FROM members m
         ${where}
         ORDER BY ${orderBy}
         LIMIT $${params.length - 1} OFFSET $${params.length}
       ) sub
       ORDER BY ${orderByOuter}`,
      params
    )
    rows = result.rows
  } catch (err) {
    console.error('[members GET] query error:', err.message)
    console.error('  where:', where)
    console.error('  params:', params)
    return res.status(500).json({ error: err.message })
  }

  const total = rows[0]?.total_count ?? 0
  res.json({ data: rows, total: Number(total), page: Number(page), limit: Number(limit) })
})

// 이번 주 성도 일정 (특이사항 이벤트)
router.get('/week-events', async (req, res) => {
  const days = Number(req.query.days ?? 7)
  const { rows } = await pool.query(
    `SELECT n.id, n.content, n.member_id,
            m.name AS member_name, m.photo_url, m.gender,
            e.title AS event_title, DATE(e.start_at) AS event_date
     FROM member_notes n
     JOIN members m ON m.id = n.member_id
     JOIN events e ON e.id = n.event_id
     WHERE DATE(e.start_at) >= CURRENT_DATE
       AND DATE(e.start_at) < CURRENT_DATE + ($1 || ' days')::INTERVAL
     ORDER BY e.start_at`,
    [days]
  )
  res.json(rows)
})

// 최근 활동 피드
router.get('/activity-feed', async (req, res) => {
  const limit = Number(req.query.limit ?? 15)
  try { const { rows } = await pool.query(
    `SELECT id, ts, detail, member_name, member_id, photo_url, tab, event_title,
            visit_date, visit_type, location, is_sensitive, created_by_name
     FROM (
       SELECT n.id, n.created_at AS ts,
              CASE WHEN n.is_sensitive THEN '(개인정보)' ELSE n.content END AS detail,
              m.name AS member_name, m.id AS member_id, m.photo_url,
              '특이사항' AS tab,
              e.title AS event_title,
              NULL::date AS visit_date, NULL::text AS visit_type, NULL::text AS location,
              COALESCE(n.is_sensitive, false) AS is_sensitive,
              u.name AS created_by_name
       FROM member_notes n
       JOIN members m ON m.id = n.member_id
       LEFT JOIN events e ON e.id = n.event_id
       LEFT JOIN users u ON u.id = n.created_by

       UNION ALL

       SELECT pv.id, pv.created_at AS ts, pv.content AS detail,
              m.name AS member_name, m.id AS member_id, m.photo_url,
              '심방등록' AS tab,
              NULL AS event_title,
              pv.visit_date, pv.visit_type, pv.location,
              false AS is_sensitive,
              u.name AS created_by_name
       FROM pastoral_visits pv
       JOIN members m ON m.id = pv.member_id
       LEFT JOIN users u ON u.id = pv.pastor_id

       UNION ALL

       SELECT e.id, e.created_at AS ts,
              TO_CHAR(e.start_at AT TIME ZONE 'Asia/Seoul', 'MM/DD') || ' ' || e.title AS detail,
              '-' AS member_name, NULL::int AS member_id, NULL::text AS photo_url,
              '캘린더 일정' AS tab, e.title AS event_title,
              e.start_at::date AS visit_date, NULL::text AS visit_type, NULL::text AS location,
              false AS is_sensitive,
              u.name AS created_by_name
       FROM events e
       LEFT JOIN member_notes mn ON mn.event_id = e.id
       LEFT JOIN pastoral_visits pv ON pv.next_plan_event_id = e.id
       LEFT JOIN users u ON u.id = e.created_by
       WHERE mn.id IS NULL AND pv.id IS NULL

       UNION ALL

       SELECT pr.id, pr.created_at AS ts,
              CASE WHEN pr.is_sensitive THEN '(개인정보)' ELSE pr.content END AS detail,
              m.name AS member_name, m.id AS member_id, m.photo_url,
              '기도제목' AS tab,
              NULL AS event_title, NULL::date AS visit_date,
              NULL::text AS visit_type, NULL::text AS location,
              COALESCE(pr.is_sensitive, false) AS is_sensitive,
              u.name AS created_by_name
       FROM prayer_requests pr
       JOIN members m ON m.id = pr.member_id
       LEFT JOIN users u ON u.id = pr.created_by
     ) combined
     WHERE ts >= NOW() - INTERVAL '30 days'
     ORDER BY ts DESC
     LIMIT $1`,
    [limit]
  )
  res.json(rows)
  } catch (err) {
    console.error('activity-feed error:', err.message)
    res.json([])
  }
})

// 자동완성 제안 (school, workplace 필드)
router.get('/suggest', async (req, res) => {
  const { field, q } = req.query
  const allowed = ['school', 'workplace']
  if (!allowed.includes(field)) return res.status(400).json([])
  const { rows } = await pool.query(
    `SELECT DISTINCT ${field} AS v FROM members
     WHERE ${field} ILIKE $1 AND ${field} IS NOT NULL AND ${field} <> ''
     ORDER BY v LIMIT 20`,
    [`%${q || ''}%`]
  )
  res.json(rows.map(r => r.v))
})

// ── ExcelJS 워크북 빌더 (bulk-template / full-export / 백업 다운로드 공용) ────
async function buildMemberWorkbook(memberRows = []) {
  const { default: ExcelJS } = await import('exceljs')
  const [enumRows, posRows] = await Promise.all([
    pool.query(
      `SELECT enum_type AS type, value FROM church_enum_values
       WHERE enum_type IN ('membership_category','faith_level','school_department')
         AND is_active = true
       ORDER BY enum_type, display_order`
    ),
    pool.query(`SELECT name FROM positions WHERE category = 'deacon' ORDER BY id`),
  ])

  const byType = {}
  for (const r of enumRows.rows) {
    if (!byType[r.type]) byType[r.type] = []
    byType[r.type].push(r.value)
  }
  const categories  = byType['membership_category'] ?? ['장년','청년','교회학교','자치','특별']
  const faithLevels = byType['faith_level']         ?? ['원입교인','유아세례교인','아동세례교인','세례교인']
  const schoolDepts = byType['school_department']   ?? []
  const positions   = posRows.rows.map(r => r.name)

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('교인등록')

  const COLS = [
    { key: '순번',          width: 6  },
    { key: '이름*',         width: 12 },
    { key: '영문이름',      width: 16 },
    { key: '성별',          width: 8  },
    { key: '생년월일',      width: 14 },
    { key: '음력여부',      width: 10 },
    { key: '휴대폰',        width: 16 },
    { key: '집전화',        width: 16 },
    { key: '이메일',        width: 24 },
    { key: '주소',          width: 30 },
    { key: '상세주소',      width: 20 },
    { key: '교인구분',      width: 12 },
    { key: '교회학교부서',  width: 14 },
    { key: '신급',          width: 12 },
    { key: '교인상태',      width: 12 },
    { key: '직분',          width: 12 },
    { key: '등록일',        width: 14 },
    { key: '세례일',        width: 14 },
    { key: '인도자',        width: 12 },
    { key: '이전교회',      width: 16 },
    { key: '이전교회직분',  width: 14 },
    { key: '직업',          width: 12 },
    { key: '결혼기념일',    width: 14 },
    { key: '신앙세대주',    width: 12 },
    { key: '세대주관계',    width: 12 },
    { key: '직장명',        width: 16 },
    { key: '학교명',        width: 16 },
    { key: '교역자직원여부', width: 14 },
    { key: '교역자직원직함', width: 14 },
    { key: '메모',          width: 24 },
  ]

  ws.columns = COLS.map(c => ({ header: c.key, key: c.key, width: c.width }))

  const headerRow = ws.getRow(1)
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFB0C4DE' } } }
  })
  headerRow.height = 22

  const colByKey = {}
  ws.columns.forEach((col, i) => { colByKey[col.key] = i + 1 })
  const colLetter = n => String.fromCharCode(64 + n)
  const maxRow = Math.max(500, (memberRows.length || 0) + 10)

  // 실제 데이터(또는 양식 예시 행)를 먼저 추가 — addRow()는 마지막 행 다음에 추가되므로,
  // 아래 서식/유효성검사 루프(getCell로 빈 행을 미리 만듦)보다 반드시 먼저 실행해야
  // 데이터가 500행 뒤로 밀려나지 않고 2행부터 채워짐
  if (memberRows.length === 0) {
    // 양식 모드: 예시 행 추가
    const exRow = ws.addRow({
      '순번': 1, '이름*': '홍길동', '영문이름': 'Gildong Hong',
      '성별': '남', '생년월일': new Date(1990, 0, 1), '음력여부': 'X',
      '휴대폰': '010-1234-5678', '집전화': '', '이메일': 'example@email.com',
      '주소': '서울시 강남구', '상세주소': '101동 202호',
      '교인구분': categories[0] ?? '', '교회학교부서': '',
      '신급': faithLevels[0] ?? '', '교인상태': '현재재적',
      '직분': positions[0] ?? '', '등록일': new Date(2020, 0, 1),
      '세례일': '', '인도자': '', '이전교회': '', '이전교회직분': '',
      '직업': '', '결혼기념일': '', '신앙세대주': '홍길동', '세대주관계': '본인',
      '직장명': '', '학교명': '', '교역자직원여부': '해당없음', '교역자직원직함': '', '메모': '',
    })
    exRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7FF' } }
    })
  } else {
    // 데이터 모드: 실제 교인 데이터 행 추가
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
  }

  // 날짜 서식
  const DATE_COLS = ['생년월일','등록일','세례일','결혼기념일']
  for (const colKey of DATE_COLS) {
    const colIdx = colByKey[colKey]
    if (!colIdx) continue
    for (let r = 2; r <= maxRow; r++) ws.getCell(r, colIdx).numFmt = 'yyyy-mm-dd'
  }

  // 드롭다운 숨김 시트
  const listWs = wb.addWorksheet('목록')
  listWs.state = 'veryHidden'

  const LISTS = [
    { col: '성별',           values: ['남','여'] },
    { col: '음력여부',       values: ['O','X'] },
    { col: '교인구분',       values: categories },
    { col: '신급',           values: faithLevels },
    { col: '교인상태',       values: ['현재재적','재적외','이명','소천'] },
    { col: '교역자직원여부', values: ['해당없음','교역자','직원'] },
    { col: '교회학교부서',   values: schoolDepts },
    { col: '직분',           values: positions },
  ]

  LISTS.forEach(({ values }, ci) => {
    values.forEach((v, ri) => { listWs.getCell(ri + 1, ci + 1).value = v })
  })

  LISTS.forEach(({ col, values }, ci) => {
    const colIdx = colByKey[col]
    if (!colIdx || !values.length) return
    const ref = `목록!$${colLetter(ci + 1)}$1:$${colLetter(ci + 1)}$${values.length}`
    for (let r = 2; r <= maxRow; r++) {
      ws.getCell(r, colIdx).dataValidation = {
        type: 'list', allowBlank: true, formulae: [ref],
        showErrorMessage: true, errorTitle: '입력 오류',
        error: '목록에서 선택하거나 직접 입력하세요.',
      }
    }
    ws.getCell(1, colIdx).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } }
  })

  // 텍스트 포맷 (숫자 자동변환 방지)
  const TEXT_COLS = ['휴대폰','집전화','이메일','주소','상세주소',
    '인도자','이전교회','이전교회직분','직업','신앙세대주','세대주관계',
    '직장명','학교명','교역자직원직함','메모']
  for (const colKey of TEXT_COLS) {
    const colIdx = colByKey[colKey]
    if (!colIdx) continue
    for (let r = 2; r <= maxRow; r++) ws.getCell(r, colIdx).numFmt = '@'
  }

  return wb
}

// ── 엑셀 양식 다운로드 ────────────────────────────────────
router.get('/bulk-template', async (req, res) => {
  const wb = await buildMemberWorkbook([])
  const buf = await wb.xlsx.writeBuffer()
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''%EA%B5%90%EC%9D%B8%EB%93%B1%EB%A1%9D%EC%96%91%EC%8B%9D.xlsx")
  res.send(buf)
})

// ── 교적 전체 내보내기 (업로드 양식과 동일 30컬럼) ──────────
router.get('/full-export', async (req, res) => {
  const idsParam = req.query.ids
  let memberRows
  if (idsParam) {
    const ids = idsParam.split(',').map(Number).filter(n => !isNaN(n) && n > 0)
    const { rows } = await pool.query(
      `SELECT * FROM members WHERE id = ANY($1::int[]) ORDER BY name`, [ids]
    )
    memberRows = rows
  } else {
    const { rows } = await pool.query(`SELECT * FROM members ORDER BY name`)
    memberRows = rows
  }
  const wb  = await buildMemberWorkbook(memberRows)
  const buf = await wb.xlsx.writeBuffer()
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''%EA%B5%90%EC%A0%81%EC%A0%84%EC%B2%B4_${date}.xlsx`)
  res.send(buf)
})

// ── 엑셀 일괄 등록 / 업데이트 ──────────────────────────────
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' })

  // mode: 'fill_blanks' (공란만 채움) | 'overwrite' (기존값도 덮어씀, Excel 공란 제외)
  const mode = req.body.mode === 'overwrite' ? 'overwrite' : 'fill_blanks'

  let rows
  try {
    const xlsxMod = await import('xlsx')
    const XLSX = xlsxMod.default ?? xlsxMod
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return res.status(400).json({ error: '워크시트를 찾을 수 없습니다.' })
    rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true })
  } catch (err) {
    console.error('bulk-upload 파일 파싱 오류:', err)
    return res.status(400).json({ error: `엑셀 파일을 읽을 수 없습니다: ${err.message}` })
  }
  if (!rows || rows.length < 2) return res.status(400).json({ error: '데이터 행이 없습니다.' })

  const headerMap = {}
  ;(rows[0] || []).forEach((key, colIdx) => {
    const k = String(key ?? '').trim()
    if (k) headerMap[k] = colIdx
  })

  const d = v => (v === '' || v === undefined || v === null) ? null : v

  const toDate = v => {
    if (!v) return null
    if (v instanceof Date) return v.toISOString().slice(0, 10)
    const s = String(v).replace(/\./g, '-').trim()
    return s || null
  }

  const formatPhone = v => {
    if (!v) return null
    const digits = String(v).replace(/\D/g, '')
    if (!digits) return null
    if (digits.length === 11) return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`
    if (digits.length === 10) {
      if (digits.startsWith('02')) return `${digits.slice(0,2)}-${digits.slice(2,6)}-${digits.slice(6)}`
      return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`
    }
    return String(v)
  }

  // fill_blanks: COALESCE(기존값, 신규값) — 기존값이 null이면 채움
  const FILL_SQL = `
    UPDATE members SET
      name_en                  = COALESCE(name_en, $1),
      gender                   = COALESCE(gender, $2),
      birth_lunar              = CASE WHEN $3 = TRUE THEN TRUE ELSE birth_lunar END,
      phone                    = COALESCE(phone, $4),
      home_phone               = COALESCE(home_phone, $5),
      email                    = COALESCE(email, $6),
      address                  = COALESCE(address, $7),
      address_detail           = COALESCE(address_detail, $8),
      membership_category      = COALESCE(membership_category, $9),
      school_department        = COALESCE(school_department, $10),
      faith_level              = COALESCE(faith_level, $11),
      membership_type          = COALESCE(membership_type, $12),
      position                 = COALESCE(position, $13),
      registered_at            = COALESCE(registered_at, $14),
      baptism_date             = COALESCE(baptism_date, $15),
      introducer_name          = COALESCE(introducer_name, $16),
      previous_church          = COALESCE(previous_church, $17),
      previous_church_position = COALESCE(previous_church_position, $18),
      occupation               = COALESCE(occupation, $19),
      anniversary_date         = COALESCE(anniversary_date, $20),
      household_head_name      = COALESCE(household_head_name, $21),
      household_relation       = COALESCE(household_relation, $22),
      workplace                = COALESCE(workplace, $23),
      school                   = COALESCE(school, $24),
      staff_category           = COALESCE(NULLIF(staff_category, ''), $25),
      staff_role               = COALESCE(staff_role, $26),
      note                     = COALESCE(note, $27),
      vehicle_number           = COALESCE(vehicle_number, $28),
      updated_at               = NOW()
    WHERE id = $29 RETURNING id`

  // overwrite: COALESCE(신규값, 기존값) — Excel에 값 있으면 덮어씀
  const OVERWRITE_SQL = `
    UPDATE members SET
      name_en                  = COALESCE($1, name_en),
      gender                   = COALESCE($2, gender),
      birth_lunar              = CASE WHEN $3 IS NOT NULL THEN $3 ELSE birth_lunar END,
      phone                    = COALESCE($4, phone),
      home_phone               = COALESCE($5, home_phone),
      email                    = COALESCE($6, email),
      address                  = COALESCE($7, address),
      address_detail           = COALESCE($8, address_detail),
      membership_category      = COALESCE($9, membership_category),
      school_department        = COALESCE($10, school_department),
      faith_level              = COALESCE($11, faith_level),
      membership_type          = COALESCE($12, membership_type),
      position                 = COALESCE($13, position),
      registered_at            = COALESCE($14, registered_at),
      baptism_date             = COALESCE($15, baptism_date),
      introducer_name          = COALESCE($16, introducer_name),
      previous_church          = COALESCE($17, previous_church),
      previous_church_position = COALESCE($18, previous_church_position),
      occupation               = COALESCE($19, occupation),
      anniversary_date         = COALESCE($20, anniversary_date),
      household_head_name      = COALESCE($21, household_head_name),
      household_relation       = COALESCE($22, household_relation),
      workplace                = COALESCE($23, workplace),
      school                   = COALESCE($24, school),
      staff_category           = COALESCE($25, staff_category),
      staff_role               = COALESCE($26, staff_role),
      note                     = COALESCE($27, note),
      vehicle_number           = COALESCE($28, vehicle_number),
      updated_at               = NOW()
    WHERE id = $29 RETURNING id`

  const UPDATE_SQL = mode === 'fill_blanks' ? FILL_SQL : OVERWRITE_SQL

  const total = rows.length - 1
  let insertCount = 0
  let updateCount = 0
  let skipCount   = 0
  const errors = []

  for (let rowNum = 2; rowNum <= rows.length; rowNum++) {
    const rowData = rows[rowNum - 1]

    const getVal = headerKey => {
      const ci = headerMap[headerKey]
      if (ci === undefined) return undefined
      const v = rowData ? rowData[ci] : null
      if (v === null || v === undefined) return ''
      if (v instanceof Date) return v
      if (typeof v === 'number') return String(v)
      return String(v).trim()
    }

    // 이름이 없는 행(양식의 빈 줄 등)은 업로드 대상이 아니므로 조용히 무시 — 에러 로그 남기지 않음
    const name = getVal('이름*')
    if (!name) continue

    const genderRaw  = getVal('성별')
    const gender     = genderRaw === '남' ? 'M' : genderRaw === '여' ? 'F' : null

    // birth_lunar: true(O) / false(X) / null(공란) — 공란은 overwrite시 덮어쓰지 않음
    const lunarRaw   = String(getVal('음력여부') ?? '').toUpperCase()
    const birth_lunar = lunarRaw === 'O' ? true : lunarRaw === 'X' ? false : null

    const typeRaw    = getVal('교인상태')
    const typeMap    = { '현재재적':'active','재적외':'inactive','이명':'transfer_out','소천':'deceased' }
    // null = Excel 공란 → INSERT 시 'active' 기본값, UPDATE 시 덮어쓰지 않음
    const membership_type = typeRaw ? (typeMap[typeRaw] ?? null) : null

    const staffRaw   = getVal('교역자직원여부')
    const staffMap   = { '교역자':'pastoral','직원':'other' }
    // '해당없음' → '' (명시적 해제), 공란 → null (변경 안 함)
    const staff_category = staffRaw === '해당없음' ? '' : staffRaw ? (staffMap[staffRaw] ?? null) : null

    const birth_date = toDate(getVal('생년월일'))

    // ── 기존 교인 매칭 (이름 + 생년월일) ─────────────────────
    let existingId = null
    if (birth_date) {
      const { rows: matches } = await pool.query(
        `SELECT id FROM members WHERE name = $1 AND birth_date = $2`,
        [name, birth_date]
      )
      if (matches.length > 1) {
        skipCount++
        errors.push({ row: rowNum, name, message: `동명이인 중복 (${matches.length}명 일치) — 스킵` })
        continue
      }
      if (matches.length === 1) existingId = matches[0].id
    }

    const updateParams = [
      d(getVal('영문이름')),           // $1  name_en
      gender,                           // $2  gender
      birth_lunar,                      // $3  birth_lunar (true/false/null)
      formatPhone(getVal('휴대폰')),    // $4  phone
      formatPhone(getVal('집전화')),    // $5  home_phone
      d(getVal('이메일')),              // $6  email
      d(getVal('주소')),                // $7  address
      d(getVal('상세주소')),            // $8  address_detail
      d(getVal('교인구분')),            // $9  membership_category
      d(getVal('교회학교부서')),        // $10 school_department
      d(getVal('신급')),                // $11 faith_level
      membership_type,                  // $12 membership_type (null = 공란)
      d(getVal('직분')),                // $13 position
      toDate(getVal('등록일')),         // $14 registered_at
      toDate(getVal('세례일')),         // $15 baptism_date
      d(getVal('인도자')),              // $16 introducer_name
      d(getVal('이전교회')),            // $17 previous_church
      d(getVal('이전교회직분')),        // $18 previous_church_position
      d(getVal('직업')),                // $19 occupation
      toDate(getVal('결혼기념일')),     // $20 anniversary_date
      d(getVal('신앙세대주')),          // $21 household_head_name
      d(getVal('세대주관계')),          // $22 household_relation
      d(getVal('직장명')),              // $23 workplace
      d(getVal('학교명')),              // $24 school
      staff_category,                   // $25 staff_category (null/''/'pastoral'/'other')
      d(getVal('교역자직원직함')),      // $26 staff_role
      d(getVal('메모')),                // $27 note
      d(getVal('차량번호')),            // $28 vehicle_number
    ]

    try {
      if (existingId) {
        // 기존 교인 업데이트
        await pool.query(UPDATE_SQL, [...updateParams, existingId])
        updateCount++
      } else {
        // 신규 교인 등록
        await pool.query(
          `INSERT INTO members
             (name, name_en, gender, birth_date, birth_lunar,
              phone, home_phone, email, address, address_detail,
              membership_category, school_department, faith_level, membership_type,
              position, registered_at, baptism_date,
              introducer_name, previous_church, previous_church_position,
              occupation, anniversary_date, household_head_name, household_relation,
              workplace, school, staff_category, staff_role, note, vehicle_number)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)`,
          [
            name,
            updateParams[0],             // name_en
            updateParams[1],             // gender
            birth_date,
            birth_lunar ?? false,        // birth_lunar — INSERT 기본값 false
            updateParams[3],             // phone
            updateParams[4],             // home_phone
            updateParams[5],             // email
            updateParams[6],             // address
            updateParams[7],             // address_detail
            updateParams[8],             // membership_category
            updateParams[9],             // school_department
            updateParams[10],            // faith_level
            membership_type ?? 'active', // membership_type — INSERT 기본값 'active'
            updateParams[12],            // position
            updateParams[13],            // registered_at
            updateParams[14],            // baptism_date
            updateParams[15],            // introducer_name
            updateParams[16],            // previous_church
            updateParams[17],            // previous_church_position
            updateParams[18],            // occupation
            updateParams[19],            // anniversary_date
            updateParams[20],            // household_head_name
            updateParams[21],            // household_relation
            updateParams[22],            // workplace
            updateParams[23],            // school
            staff_category ?? '',        // staff_category — INSERT 기본값 ''
            updateParams[25],            // staff_role
            updateParams[26],            // note
            updateParams[27],            // vehicle_number
          ]
        )
        insertCount++
      }
    } catch (err) {
      errors.push({ row: rowNum, name, message: err.message })
    }
  }

  const successCount = insertCount + updateCount
  res.json({ total, successCount, insertCount, updateCount, skipCount, errors })
})

// 단일 조회 (가족관계 포함)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const { rows: memberRows } = await pool.query(
      `SELECT * FROM members WHERE id = $1`, [id]
    )
    if (!memberRows.length) return res.status(404).json({ error: '교인을 찾을 수 없습니다.' })

    const { rows: familyRows } = await pool.query(
      `SELECT f.relation_type,
              m.id, m.name, m.gender, m.birth_date, m.photo_url
       FROM families f
       JOIN members m ON m.id = f.related_member_id
       WHERE f.member_id = $1`,
      [id]
    )

    const { rows: communityRows } = await pool.query(
      `SELECT c.id, c.name, c.type, mc.role
       FROM member_communities mc
       JOIN communities c ON c.id = mc.community_id
       WHERE mc.member_id = $1`,
      [id]
    )

    res.json({ ...memberRows[0], family: familyRows, communities: communityRows })
  } catch (err) {
    console.error('GET /members/:id:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// 등록
router.post('/', async (req, res) => {
  try {
    const {
      name, name_en, gender, birth_date, birth_lunar,
      phone, home_phone, email, address, address_detail, lat, lng,
      workplace, school, photo_url, photo_thumb_url, position,
      membership_type, registered_at, baptism_date, note,
      resident_id, membership_category, faith_level, school_department,
      household_head_name, household_relation,
      introducer_name, previous_church, previous_church_position,
      occupation, anniversary_date,
      staff_category, staff_role, staff_start_date, staff_end_date,
      vehicle_number,
    } = req.body

    const d = (v) => (v === '' || v === undefined) ? null : v

    const { rows } = await pool.query(
      `INSERT INTO members
         (name, name_en, gender, birth_date, birth_lunar,
          phone, home_phone, email, address, address_detail, lat, lng,
          workplace, school, photo_url, photo_thumb_url, position,
          membership_type, registered_at, baptism_date, note,
          resident_id, membership_category, faith_level, school_department,
          household_head_name, household_relation,
          introducer_name, previous_church, previous_church_position,
          occupation, anniversary_date,
          staff_category, staff_role, staff_start_date, staff_end_date,
          vehicle_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37)
       RETURNING *`,
      [name, d(name_en), d(gender), d(birth_date), birth_lunar ?? false,
       d(phone), d(home_phone), d(email), d(address), d(address_detail), d(lat), d(lng),
       d(workplace), d(school), d(photo_url), d(photo_thumb_url), d(position),
       membership_type ?? 'active', d(registered_at), d(baptism_date), d(note),
       d(resident_id), d(membership_category), d(faith_level), d(school_department),
       d(household_head_name), d(household_relation),
       d(introducer_name), d(previous_church), d(previous_church_position),
       d(occupation), d(anniversary_date),
       d(staff_category), d(staff_role), d(staff_start_date), d(staff_end_date),
       d(vehicle_number)]
    )

    if (staff_category === 'pastoral') {
      await pool.query(`
        INSERT INTO clergy (member_id, name, role, start_date, end_date, is_current)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (member_id) WHERE member_id IS NOT NULL DO UPDATE SET
          name       = EXCLUDED.name,
          role       = EXCLUDED.role,
          start_date = EXCLUDED.start_date,
          end_date   = EXCLUDED.end_date,
          is_current = EXCLUDED.is_current
      `, [rows[0].id, name, d(staff_role), d(staff_start_date), d(staff_end_date), !staff_end_date])
    }

    res.status(201).json(rows[0])
  } catch (err) {
    console.error('POST /members:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// 수정
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const fields = [
      'name','name_en','gender','birth_date','birth_lunar',
      'phone','home_phone','email','address','address_detail','lat','lng',
      'workplace','school','photo_url','photo_thumb_url','position',
      'membership_type','registered_at','baptism_date','note',
      'resident_id','membership_category','faith_level','school_department',
      'household_head_name','household_relation',
      'introducer_name','previous_church','previous_church_position',
      'occupation','anniversary_date',
      'staff_category','staff_role','staff_start_date','staff_end_date',
      'vehicle_number',
    ]

    const d = (_f, v) => (v === '' || v === undefined) ? null : v

    const updates = []
    const params = []
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        params.push(d(f, req.body[f]))
        updates.push(`${f} = $${params.length}`)
      }
    }
    if (!updates.length) return res.status(400).json({ error: '변경 항목이 없습니다.' })

    params.push(id)
    const { rows } = await pool.query(
      `UPDATE members SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length} RETURNING *`,
      params
    )

    if (!rows.length) return res.status(404).json({ error: '교인을 찾을 수 없습니다.' })

    // 교역자 연혁 자동 동기화
    if (rows[0].staff_category === 'pastoral') {
      await pool.query(`
        INSERT INTO clergy (member_id, name, role, start_date, end_date, is_current)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (member_id) WHERE member_id IS NOT NULL DO UPDATE SET
          name       = EXCLUDED.name,
          role       = EXCLUDED.role,
          start_date = EXCLUDED.start_date,
          end_date   = EXCLUDED.end_date,
          is_current = EXCLUDED.is_current
      `, [
        id,
        rows[0].name,
        rows[0].staff_role || null,
        rows[0].staff_start_date || null,
        rows[0].staff_end_date || null,
        !rows[0].staff_end_date,
      ])
    } else {
      // pastoral → 다른 구분으로 변경 시 연혁에서 사임 처리
      await pool.query(`
        UPDATE clergy SET is_current = false, end_date = COALESCE(end_date, CURRENT_DATE)
        WHERE member_id = $1 AND is_current = true
      `, [id])
    }

    res.json(rows[0])
  } catch (err) {
    console.error('PUT /members/:id:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// 일괄 삭제
router.delete('/bulk', async (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: 'ids 배열이 필요합니다.' })
  try {
    await pool.query('DELETE FROM members WHERE id = ANY($1::int[])', [ids])
    res.status(204).end()
  } catch (err) {
    console.error('DELETE /members/bulk:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// 삭제
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM members WHERE id = $1', [req.params.id])
    res.status(204).end()
  } catch (err) {
    console.error('DELETE /members/:id:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// 특이사항 노트 목록
router.get('/:id/notes', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT n.id, n.content, n.created_at, n.event_id, COALESCE(n.is_sensitive, false) AS is_sensitive,
            e.title AS event_title, DATE(e.start_at) AS event_date,
            u.name AS author_name
     FROM member_notes n
     LEFT JOIN events e ON e.id = n.event_id
     LEFT JOIN users u ON u.id = n.created_by
     WHERE n.member_id = $1 ORDER BY n.created_at DESC`,
    [req.params.id]
  )
  res.json(rows)
})

// 특이사항 노트 등록
router.post('/:id/notes', async (req, res) => {
  const { content, is_event, event_date, event_title, is_sensitive } = req.body
  if (!content?.trim()) return res.status(400).json({ error: '내용을 입력하세요.' })

  let eventId = null
  if (is_event && event_date) {
    const startAt = `${event_date}T00:00:00`
    const { rows: mRows } = await pool.query('SELECT name FROM members WHERE id = $1', [req.params.id])
    const memberName = mRows[0]?.name ?? ''
    const titleBase = event_title?.trim() || content.trim().slice(0, 30)
    const fullTitle = memberName ? `${memberName} ${titleBase}` : titleBase
    const { rows: evRows } = await pool.query(
      `INSERT INTO events (title, description, start_at, end_at, is_all_day, color, created_by)
       VALUES ($1, $2, $3, $3, true, '#8b5cf6', $4) RETURNING id`,
      [fullTitle, content.trim(), startAt, req.user.id]
    )
    eventId = evRows[0].id
  }

  const { rows } = await pool.query(
    `INSERT INTO member_notes (member_id, content, event_id, is_sensitive, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, content, created_at, event_id, COALESCE(is_sensitive, false) AS is_sensitive`,
    [req.params.id, content.trim(), eventId, is_sensitive ?? false, req.user.id]
  )
  const note = rows[0]
  if (eventId) {
    note.event_title = event_title.trim()
    note.event_date  = event_date
  }
  note.author_name = req.user.name ?? null
  res.status(201).json(note)
})

// 특이사항 노트 삭제
router.delete('/:id/notes/:noteId', async (req, res) => {
  const { rows } = await pool.query(
    `DELETE FROM member_notes WHERE id = $1 AND member_id = $2 RETURNING event_id`,
    [req.params.noteId, req.params.id]
  )
  if (rows[0]?.event_id) {
    await pool.query(`DELETE FROM events WHERE id = $1`, [rows[0].event_id]).catch(() => {})
  }
  res.status(204).end()
})

// 생일 임박 조회 (향후 N일 이내)
router.get('/birthdays/upcoming', async (req, res) => {
  const days = Number(req.query.days ?? 7)
  const { rows } = await pool.query(
    `SELECT id, name, gender, birth_date, photo_url, phone
     FROM members
     WHERE membership_type = 'active'
       AND (
         DATE_PART('month', birth_date) * 100 + DATE_PART('day', birth_date)
         BETWEEN
           DATE_PART('month', NOW()) * 100 + DATE_PART('day', NOW())
         AND
           DATE_PART('month', NOW() + ($1 || ' days')::INTERVAL) * 100 +
           DATE_PART('day',   NOW() + ($1 || ' days')::INTERVAL)
       )
     ORDER BY DATE_PART('month', birth_date), DATE_PART('day', birth_date)`,
    [days]
  )
  res.json(rows)
})

export default router
