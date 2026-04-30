import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

const SURNAMES = ['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송','전','홍','유','고','문','양','손','배','백','허','남','심','노','하','곽','차','류','나','진','엄','원','천']
const MALE_GIVEN = ['민준','서준','도윤','예준','시우','주원','하준','정우','민재','현우','준서','건우','지호','성준','민성','준혁','지훈','현준','성민','준영','태양','우진','승현','재원','동현','승우','재민','진우','태민','승민','인호','철민','동훈','승호','병철','명수','창환','경호','동수','진혁','광수','성호','기현','재호','동규','영호','성철','진호','규현','기영','남준','성욱','정호','세훈','민석','영준','상민','재현','용준','지석','영민','상현','현석','민호','성현','재훈','형준','기준','상훈','민기','성재','동재','정민','원준','기윤','현민','지안','선재','정현','윤준','태훈','상준','은찬','민찬','지환','가온','재윤','도현','승원','효준','건희','성원','명진','원재','우석','형욱','경민','현범','성빈']
const FEMALE_GIVEN = ['서연','서윤','지우','서현','민서','하은','하린','지유','수아','지아','채원','수빈','지민','예린','지수','유나','나은','예은','지현','소윤','미래','은지','혜린','수현','보람','진희','미영','정은','혜진','혜원','은혜','주희','선희','정희','수정','미진','혜숙','영숙','미숙','영희','정숙','경옥','명옥','순례','봉희','정자','말숙','영자','순자','복순','정순','미란','성희','은숙','선미','미화','혜경','수경','민경','지영','지선','재희','혜선','경아','지연','승연','민혜','지혜','수희','은희','현정','선정','정미','미현','경희','순미','봉자','영란','수란','경란','선란','지나','미나','수나','은나','혜나','진나','선나','아름','아란','아영','나리','나래','한별','한빛','새봄','새아','새날']

const ADDRESSES = [
  '서울특별시 강남구 역삼동 123-4','서울특별시 강북구 미아동 56-7','서울특별시 서초구 방배동 89-10',
  '경기도 수원시 영통구 영통동 234-5','경기도 성남시 분당구 서현동 67-8','경기도 고양시 일산동구 마두동 90-1',
  '인천광역시 남동구 구월동 345-6','경기도 용인시 기흥구 보정동 78-9','경기도 부천시 원미구 중동 12-3',
  '서울특별시 송파구 잠실동 456-7','서울특별시 마포구 합정동 23-4','서울특별시 노원구 상계동 56-7',
  '경기도 안양시 동안구 비산동 89-0','경기도 의정부시 가능동 12-3','경기도 남양주시 화도읍 45-6',
]

function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function rndInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function makeName(gender) {
  return rnd(SURNAMES) + rnd(gender === 'M' ? MALE_GIVEN : FEMALE_GIVEN)
}

function birthDate(age, variance = 4) {
  const year = 2025 - age - rndInt(0, variance)
  const month = String(rndInt(1, 12)).padStart(2, '0')
  const day = String(rndInt(1, 28)).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function phone() {
  return `010-${rndInt(1000, 9999)}-${rndInt(1000, 9999)}`
}

function photoUrl(gender, idx) {
  const type = gender === 'M' ? 'men' : 'women'
  return `https://randomuser.me/api/portraits/${type}/${(idx % 99) + 1}.jpg`
}

function regDate(fromYear = 2005, toYear = 2024) {
  const year = rndInt(fromYear, toYear)
  const month = String(rndInt(1, 12)).padStart(2, '0')
  return `${year}-${month}-01`
}

// [position, gender, baseAge, ageVariance, count]
const OFFICER_DEFS = [
  ['담임목사', 'M', 55, 3, 1],
  ['부목사',   'M', 42, 4, 2],
  ['전도사',   'M', 30, 3, 1],
  ['전도사',   'F', 28, 3, 1],
  ['장로',     'M', 65, 5, 6],
  ['권사',     'F', 58, 5, 12],
  ['안수집사', 'M', 52, 4, 10],
  ['집사',     'M', 45, 5, 10],
  ['집사',     'F', 42, 5, 10],
  ['사무간사', 'F', 35, 3, 1],
  ['관리집사', 'M', 53, 3, 2],
]

router.get('/', async (req, res) => {
  if (req.query.secret !== 'church2025') {
    return res.status(401).json({ error: '인증 실패' })
  }

  const { rows: cnt } = await pool.query('SELECT COUNT(*) FROM members')
  if (Number(cnt[0].count) > 10) {
    return res.json({ message: '이미 데이터가 존재합니다.', memberCount: Number(cnt[0].count) })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 셀모임·헌금종류 ID 조회
    const { rows: cells } = await client.query(`SELECT id FROM communities WHERE type = 'cell' ORDER BY id`)
    const cellIds = cells.map(c => c.id)

    const { rows: offeringTypes } = await client.query('SELECT id, name FROM offering_types ORDER BY id')
    const typeMap = {}
    offeringTypes.forEach(t => { typeMap[t.name] = t.id })

    // ── 1. 재직자 생성 ─────────────────────────────────────
    const members = []
    let photoIdx = 0

    for (const [position, gender, baseAge, variance, count] of OFFICER_DEFS) {
      for (let i = 0; i < count; i++) {
        const name = makeName(gender)
        const bd = birthDate(baseAge, variance)
        const { rows } = await client.query(
          `INSERT INTO members (name, gender, birth_date, phone, address, photo_url, position, membership_type, registered_at, baptism_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9) RETURNING id`,
          [name, gender, bd, phone(), rnd(ADDRESSES), photoUrl(gender, photoIdx++), position, regDate(2000, 2018), birthDate(baseAge + 5, 3)]
        )
        members.push({ id: rows[0].id, gender, position })
      }
    }

    // ── 2. 일반 성도 생성 ──────────────────────────────────
    const generalCount = 200 - members.length
    for (let i = 0; i < generalCount; i++) {
      const gender = Math.random() < 0.52 ? 'F' : 'M'
      const age = rndInt(18, 78)
      const membershipType = Math.random() < 0.83 ? 'active' : 'inactive'
      const hasPhone = Math.random() < 0.85
      const hasAddress = Math.random() < 0.7
      const { rows } = await client.query(
        `INSERT INTO members (name, gender, birth_date, phone, address, photo_url, membership_type, registered_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [makeName(gender), gender, birthDate(age, 6), hasPhone ? phone() : null, hasAddress ? rnd(ADDRESSES) : null, photoUrl(gender, photoIdx++), membershipType, regDate(2000, 2024)]
      )
      members.push({ id: rows[0].id, gender, position: null })
    }

    // ── 3. 가족관계 생성 ───────────────────────────────────
    const officerCount = OFFICER_DEFS.reduce((s, [,,,,c]) => s + c, 0)
    const malePool   = members.slice(officerCount).filter(m => m.gender === 'M')
    const femalePool = members.slice(officerCount).filter(m => m.gender === 'F')

    const usedMales   = new Set()
    const usedFemales = new Set()
    let couplesMade = 0

    for (const male of malePool) {
      if (couplesMade >= 50) break
      if (usedMales.has(male.id)) continue
      const female = femalePool.find(f => !usedFemales.has(f.id))
      if (!female) break

      usedMales.add(male.id)
      usedFemales.add(female.id)

      await client.query(
        `INSERT INTO families (member_id, related_member_id, relation_type) VALUES ($1,$2,'spouse'),($2,$1,'spouse')`,
        [male.id, female.id]
      )

      // 자녀 (40% 확률로 1~2명)
      if (Math.random() < 0.4) {
        const childCount = Math.random() < 0.6 ? 1 : 2
        for (let c = 0; c < childCount; c++) {
          const cg = Math.random() < 0.5 ? 'M' : 'F'
          const { rows: cr } = await client.query(
            `INSERT INTO members (name, gender, birth_date, photo_url, membership_type)
             VALUES ($1,$2,$3,$4,'active') RETURNING id`,
            [makeName(cg), cg, birthDate(rndInt(8, 22), 4), photoUrl(cg, photoIdx++)]
          )
          const cid = cr[0].id
          members.push({ id: cid, gender: cg, position: null })
          await client.query(
            `INSERT INTO families (member_id, related_member_id, relation_type) VALUES
             ($1,$2,'child'),($2,$1,'parent'),($3,$2,'child'),($2,$3,'parent')`,
            [male.id, cid, female.id]
          )
        }
      }
      couplesMade++
    }

    // ── 4. 셀 배정 ─────────────────────────────────────────
    if (cellIds.length > 0) {
      // 장로들을 셀 리더로
      const elders = members.filter(m => m.position === '장로')
      for (let i = 0; i < cellIds.length; i++) {
        const elder = elders[i % elders.length]
        await client.query(
          `INSERT INTO member_communities (member_id, community_id, role) VALUES ($1,$2,'leader')`,
          [elder.id, cellIds[i]]
        )
      }

      // 일반 성도 셀 배정 (재직자 제외, 85% 배정)
      for (let i = officerCount; i < members.length; i++) {
        if (Math.random() < 0.85) {
          const cellId = rnd(cellIds)
          await client.query(
            `INSERT INTO member_communities (member_id, community_id, role) VALUES ($1,$2,'member')
             ON CONFLICT DO NOTHING`,
            [members[i].id, cellId]
          )
        }
      }
    }

    // ── 5. 2025년 헌금 데이터 생성 ─────────────────────────
    const donatingMembers = members.filter((_, i) => i < 160)

    for (const m of donatingMembers) {
      // 주정헌금 - 월별 1건 (주 헌금의 월 합계로 표현)
      if (typeMap['주정헌금'] && Math.random() < 0.78) {
        for (let month = 1; month <= 12; month++) {
          const amount = rndInt(4, 25) * 10000
          const day = rndInt(1, 4) * 7  // 주일 (7, 14, 21, 28)
          await client.query(
            `INSERT INTO offerings (member_id, offering_type_id, amount, date) VALUES ($1,$2,$3,$4)`,
            [m.id, typeMap['주정헌금'], amount, `2025-${String(month).padStart(2,'0')}-${day}`]
          )
        }
      }

      // 십일조 - 월별
      if (typeMap['십일조헌금'] && Math.random() < 0.42) {
        for (let month = 1; month <= 12; month++) {
          if (Math.random() < 0.9) {
            const amount = rndInt(10, 80) * 10000
            await client.query(
              `INSERT INTO offerings (member_id, offering_type_id, amount, date) VALUES ($1,$2,$3,$4)`,
              [m.id, typeMap['십일조헌금'], amount, `2025-${String(month).padStart(2,'0')}-10`]
            )
          }
        }
      }

      // 감사헌금 - 연간 1~4회
      if (typeMap['감사헌금'] && Math.random() < 0.55) {
        const times = rndInt(1, 4)
        for (let t = 0; t < times; t++) {
          const month = rndInt(1, 12)
          await client.query(
            `INSERT INTO offerings (member_id, offering_type_id, amount, date) VALUES ($1,$2,$3,$4)`,
            [m.id, typeMap['감사헌금'], rndInt(3, 20) * 10000, `2025-${String(month).padStart(2,'0')}-${String(rndInt(1,28)).padStart(2,'0')}`]
          )
        }
      }

      // 건축헌금 - 연간 1~2회, 일부 성도
      if (typeMap['건축헌금'] && Math.random() < 0.18) {
        const times = rndInt(1, 2)
        for (let t = 0; t < times; t++) {
          const month = rndInt(1, 12)
          await client.query(
            `INSERT INTO offerings (member_id, offering_type_id, amount, date) VALUES ($1,$2,$3,$4)`,
            [m.id, typeMap['건축헌금'], rndInt(10, 100) * 10000, `2025-${String(month).padStart(2,'0')}-15`]
          )
        }
      }

      // 선교헌금 - 분기별, 일부
      if (typeMap['선교헌금'] && Math.random() < 0.22) {
        for (const month of [3, 6, 9, 12]) {
          if (Math.random() < 0.6) {
            await client.query(
              `INSERT INTO offerings (member_id, offering_type_id, amount, date) VALUES ($1,$2,$3,$4)`,
              [m.id, typeMap['선교헌금'], rndInt(2, 10) * 10000, `2025-${String(month).padStart(2,'0')}-01`]
            )
          }
        }
      }

      // 구제헌금 - 연간 1~3회, 소수
      if (typeMap['구제헌금'] && Math.random() < 0.12) {
        const times = rndInt(1, 3)
        for (let t = 0; t < times; t++) {
          const month = rndInt(1, 12)
          await client.query(
            `INSERT INTO offerings (member_id, offering_type_id, amount, date) VALUES ($1,$2,$3,$4)`,
            [m.id, typeMap['구제헌금'], rndInt(2, 8) * 10000, `2025-${String(month).padStart(2,'0')}-20`]
          )
        }
      }
    }

    await client.query('COMMIT')

    const { rows: mCnt } = await client.query('SELECT COUNT(*) FROM members')
    const { rows: oCnt } = await client.query('SELECT COUNT(*) FROM offerings')
    const { rows: fCnt } = await client.query('SELECT COUNT(*) FROM families')

    res.json({
      message: '시드 데이터 생성 완료 ✅',
      members: Number(mCnt[0].count),
      families: Number(fCnt[0].count),
      offerings: Number(oCnt[0].count),
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[SEED ERROR]', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// ── 헌금 시드 헬퍼 ──────────────────────────────────────────
function pickRandom(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(n, arr.length))
}

// 2026-01-04(1월 첫 주일) ~ 2026-04-19 모든 주일
const SUNDAYS_2026 = [
  '2026-01-04','2026-01-11','2026-01-18','2026-01-25',
  '2026-02-01','2026-02-08','2026-02-15','2026-02-22',
  '2026-03-01','2026-03-08','2026-03-15','2026-03-22','2026-03-29',
  '2026-04-05','2026-04-12','2026-04-19',
]
// 특수 주일
const NEW_YEAR_SUNDAY = '2026-01-04'   // 신정 주일
const EASTER_SUNDAY   = '2026-04-05'   // 부활절
const SECOND_SUNDAYS  = new Set(['2026-01-11','2026-02-08','2026-03-08','2026-04-12'])
const MARCH_FIRST_SUN = '2026-03-01'   // 선교헌금 분기 주일

function incomeLevel(position) {
  if (['장로'].includes(position))         return 'high'
  if (['안수집사'].includes(position))      return 'medium'
  if (['담임목사','부목사'].includes(position)) return 'low'
  if (['전도사','사무간사','관리집사'].includes(position)) return 'low'
  if (['집사','권사'].includes(position))   return 'medium'
  // 일반 성도
  const r = Math.random()
  return r < 0.38 ? 'none' : r < 0.72 ? 'low' : r < 0.90 ? 'medium' : 'high'
}

function weeklyAmt(lvl) {
  if (lvl === 'none')   return rndInt(1, 5)  * 10000
  if (lvl === 'low')    return rndInt(3, 10) * 10000
  if (lvl === 'medium') return rndInt(5, 20) * 10000
  return rndInt(10, 50) * 10000
}

function titheAmt(lvl) {
  if (lvl === 'low')    return rndInt(10, 30) * 10000
  if (lvl === 'medium') return rndInt(30, 80) * 10000
  return rndInt(80, 300) * 10000
}

// 헌금 종류는 DB에서 동적으로 조회 (초기 데이터는 index.js init에서 관리)

// GET /api/seed/offerings — 2026년 주차별 소득기반 헌금 데이터 생성
router.get('/offerings', async (req, res) => {
  if (req.query.secret !== 'church2025') return res.status(401).json({ error: '인증 실패' })

  const { rows: memberRows } = await pool.query(
    `SELECT id, position FROM members WHERE membership_type IN ('active','inactive') ORDER BY id`
  )

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 기존 헌금 데이터 삭제 후 DB의 헌금 종류 그대로 활용
    await client.query('DELETE FROM offerings')

    const { rows: typeRows } = await client.query('SELECT id, name FROM offering_types ORDER BY id')
    if (typeRows.length === 0) throw new Error('헌금 종류가 없습니다. 서버를 재시작하거나 초기 설정을 먼저 실행하세요.')
    const tm = {}
    typeRows.forEach(t => { tm[t.name] = t.id })

    const offeringRows = []

    for (const m of memberRows) {
      const lvl = incomeLevel(m.position)
      const hasIncome = lvl !== 'none'

      // 주정헌금: 85% 성도 참여, 매주 85% 출석
      if (Math.random() < 0.85) {
        for (const sun of SUNDAYS_2026) {
          if (Math.random() < 0.85) {
            offeringRows.push([m.id, tm['주정헌금'], weeklyAmt(lvl), sun])
          }
        }
      }

      // 십일조헌금: 소득있는 성도의 65%, 매월 2번째 주일
      if (hasIncome && Math.random() < 0.65) {
        for (const sun of SUNDAYS_2026) {
          if (SECOND_SUNDAYS.has(sun) && Math.random() < 0.90) {
            offeringRows.push([m.id, tm['십일조헌금'], titheAmt(lvl), sun])
          }
        }
      }

      // 감사헌금: 50% 성도, 1~4회 랜덤 주일
      if (Math.random() < 0.50) {
        for (const sun of pickRandom(SUNDAYS_2026, rndInt(1, 4))) {
          offeringRows.push([m.id, tm['감사헌금'], rndInt(3, 20) * 10000, sun])
        }
      }

      // 건축헌금: 소득있는 20%, 1~2회
      if (hasIncome && Math.random() < 0.20) {
        for (const sun of pickRandom(SUNDAYS_2026, rndInt(1, 2))) {
          offeringRows.push([m.id, tm['건축헌금'], rndInt(10, 100) * 10000, sun])
        }
      }

      // 선교헌금: 22%, 3월 첫 주일
      if (Math.random() < 0.22) {
        offeringRows.push([m.id, tm['선교헌금'], rndInt(2, 10) * 10000, MARCH_FIRST_SUN])
      }

      // 구제헌금: 12%, 1~2회
      if (Math.random() < 0.12) {
        for (const sun of pickRandom(SUNDAYS_2026, rndInt(1, 2))) {
          offeringRows.push([m.id, tm['구제헌금'], rndInt(2, 8) * 10000, sun])
        }
      }

      // 절기헌금: 신정 주일(60%)·부활절(70%)
      if (Math.random() < 0.60) {
        offeringRows.push([m.id, tm['절기헌금'], rndInt(3, 15) * 10000, NEW_YEAR_SUNDAY])
      }
      if (Math.random() < 0.70) {
        offeringRows.push([m.id, tm['절기헌금'], rndInt(3, 20) * 10000, EASTER_SUNDAY])
      }

      // 특별헌금: 10%, 1~3회
      if (Math.random() < 0.10) {
        for (const sun of pickRandom(SUNDAYS_2026, rndInt(1, 3))) {
          offeringRows.push([m.id, tm['특별헌금'], rndInt(5, 50) * 10000, sun])
        }
      }

      // 교육헌금: 8%, 1~2회
      if (Math.random() < 0.08) {
        for (const sun of pickRandom(SUNDAYS_2026, rndInt(1, 2))) {
          offeringRows.push([m.id, tm['교육헌금'], rndInt(2, 10) * 10000, sun])
        }
      }

      // 구역헌금: 15%, 매달 한 주일
      if (Math.random() < 0.15) {
        const monthly = ['2026-01-11','2026-02-08','2026-03-15','2026-04-12']
        for (const sun of monthly) {
          if (Math.random() < 0.80) {
            offeringRows.push([m.id, tm['구역헌금'], rndInt(1, 5) * 10000, sun])
          }
        }
      }

      // 봉헌: 5%, 1회
      if (Math.random() < 0.05) {
        const sun = pickRandom(SUNDAYS_2026, 1)[0]
        offeringRows.push([m.id, tm['봉헌'], rndInt(5, 30) * 10000, sun])
      }

      // 장학헌금: 4%, 1회
      if (Math.random() < 0.04) {
        const sun = pickRandom(SUNDAYS_2026, 1)[0]
        offeringRows.push([m.id, tm['장학헌금'], rndInt(10, 50) * 10000, sun])
      }
    }

    // 200행씩 배치 INSERT
    const CHUNK = 200
    for (let i = 0; i < offeringRows.length; i += CHUNK) {
      const chunk = offeringRows.slice(i, i + CHUNK)
      const vals  = chunk.map((_, j) => `($${j*4+1},$${j*4+2},$${j*4+3},$${j*4+4})`).join(',')
      await client.query(
        `INSERT INTO offerings (member_id, offering_type_id, amount, date) VALUES ${vals}`,
        chunk.flat()
      )
    }

    await client.query('COMMIT')

    // 종류별 건수 집계
    const { rows: summary } = await pool.query(`
      SELECT ot.name, COUNT(*)::int AS cnt
      FROM offerings o JOIN offering_types ot ON ot.id = o.offering_type_id
      GROUP BY ot.name ORDER BY cnt DESC
    `)

    res.json({
      message: '2026년 헌금 시드 완료 ✅',
      sundays: SUNDAYS_2026.length,
      members: memberRows.length,
      total: offeringRows.length,
      byType: Object.fromEntries(summary.map(r => [r.name, r.cnt])),
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[SEED OFFERINGS ERROR]', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// ── 부서 배정 시드 ──────────────────────────────────────────
// GET /api/seed/dept-members?secret=church2025
// 모든 교인을 직분·성별·나이 기반으로 부서에 자동 배정한다.
// 실행 전 /api/departments/seed-org 로 조직도를 먼저 생성해야 한다.
router.get('/dept-members', async (req, res) => {
  if (req.query.secret !== 'church2025') return res.status(401).json({ error: '인증 실패' })

  const { rows: deptRows } = await pool.query(
    'SELECT id, name, parent_id FROM departments ORDER BY sort_order, id'
  )
  if (deptRows.length === 0)
    return res.status(400).json({ error: '부서를 먼저 등록해주세요 (POST /api/departments/seed-org)' })

  // name → id 맵 (중복 이름은 마지막 값)
  const dm = {}
  deptRows.forEach(d => { dm[d.name] = d.id })

  // 부모 이름으로 자식 부서 ID 목록 반환
  const childIds = parentName => {
    const pid = dm[parentName]
    if (!pid) return []
    return deptRows.filter(d => d.parent_id === pid).map(d => d.id)
  }

  const { rows: members } = await pool.query(
    `SELECT id, gender, position, birth_date FROM members ORDER BY id`
  )

  // 각 그룹의 리스트 (하위 부서가 없으면 상위 부서 ID로 폴백)
  const fallback = (list, ...names) => {
    if (list.length > 0) return list
    for (const n of names) { if (dm[n]) return [dm[n]] }
    return []
  }
  const 협의기관들 = fallback(childIds('협의기관'), '협의기관', '당회')
  const 남선교회들 = fallback(childIds('남선교회'), '남선교회', '선교회')
  const 여선교회들 = fallback(childIds('여선교회'), '여선교회', '선교회')
  const 구역들     = fallback(childIds('구역회'), '구역회')
  const 찬양대들   = childIds('찬양대')
  const 찬양단들   = childIds('찬양단')
  const 제직부서들 = fallback(childIds('제직회'), '제직회')
  const 모든찬양   = [...찬양대들, ...찬양단들]

  // 모든 leaf 부서 (자식 없는 부서) — 최종 폴백용
  const parentIdSet = new Set(deptRows.filter(d => d.parent_id).map(d => d.parent_id))
  const leafDeptIds = deptRows.filter(d => !parentIdSet.has(d.id)).map(d => d.id)
  const allDeptIds  = deptRows.map(d => d.id)
  const fallbackPool = leafDeptIds.length > 0 ? leafDeptIds : allDeptIds
  let fallbackIdx = 0

  // 라운드로빈 배정 카운터
  let ri = { 협의: 0, 남선: 0, 여선: 0, 구역: 0, 찬양: 0, 제직: 0 }
  const rr = (arr, key) => arr.length ? arr[(ri[key]++) % arr.length] : null

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM department_members')

    const ins = async (deptId, memberId, role = 'member', jobTitle = null) => {
      if (!deptId || !memberId) return
      await client.query(
        `INSERT INTO department_members (department_id, member_id, role, job_title)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [deptId, memberId, role, jobTitle]
      )
    }

    for (const m of members) {
      const age = m.birth_date
        ? Math.floor((Date.now() - new Date(m.birth_date)) / (365.25 * 24 * 3600 * 1000))
        : 35
      const pos = m.position ?? ''
      const g = m.gender  // 'M' | 'F'

      // ── 직분자 배정 ────────────────────────────────────────
      if (pos === '담임목사') {
        await ins(dm['당회'],     m.id, 'leader', '담임목사')
        await ins(dm['공동의회'], m.id, 'leader', '의장')
        await ins(dm['제직회'],   m.id, 'leader', '담임목사')

      } else if (pos === '부목사') {
        await ins(dm['당회'],   m.id, 'member', '부목사')
        await ins(dm['제직회'], m.id, 'member', '부목사')
        await ins(rr(제직부서들, '제직'), m.id, 'leader', '담당목사')

      } else if (pos === '전도사') {
        await ins(dm['제직회'],   m.id, 'member', '전도사')
        await ins(dm['새가족부'], m.id, 'member', '전도사')
        await ins(g === 'F' ? dm['교육부'] : dm['전도부'], m.id, 'member', '전도사')

      } else if (pos === '장로') {
        await ins(dm['당회'],     m.id, 'member', '장로')
        await ins(dm['공동의회'], m.id, 'member', '장로')
        await ins(dm['제직회'],   m.id, 'member', '장로')
        await ins(rr(협의기관들, '협의'), m.id, 'leader', '위원장')
        await ins(rr(남선교회들, '남선'), m.id, 'leader', '회장')
        await ins(rr(구역들, '구역'), m.id, 'leader', '구역장')

      } else if (pos === '권사') {
        await ins(dm['권사회'], m.id, 'member', '권사')
        await ins(dm['제직회'], m.id, 'member', '권사')
        await ins(rr(여선교회들, '여선'), m.id, 'member', '권사')
        await ins(rr(구역들, '구역'), m.id, 'member', '권사')

      } else if (pos === '안수집사') {
        await ins(dm['안수집사회'], m.id, 'member', '안수집사')
        await ins(dm['제직회'],     m.id, 'member', '안수집사')
        await ins(rr(제직부서들, '제직'), m.id, 'leader', '부장')
        await ins(rr(남선교회들, '남선'), m.id, 'leader', '회장')
        await ins(rr(구역들, '구역'), m.id, 'member', '집사')

      } else if (pos === '집사') {
        await ins(dm['제직회'], m.id, 'member', '집사')
        await ins(rr(제직부서들, '제직'), m.id, 'member', '집사')
        if (g === 'M') await ins(rr(남선교회들, '남선'), m.id, 'member', '집사')
        else           await ins(rr(여선교회들, '여선'), m.id, 'member', '집사')
        await ins(rr(구역들, '구역'), m.id, 'member', '집사')

      } else if (pos === '사무간사') {
        await ins(dm['총무부'], m.id, 'member', '간사')
        await ins(dm['제직회'], m.id, 'member', '간사')

      } else if (pos === '관리집사') {
        await ins(dm['관리부'], m.id, 'leader', '관리집사')
        await ins(dm['제직회'], m.id, 'member', '관리집사')

      } else {
        // ── 일반 성도 — 나이별 배정 ───────────────────────────
        if (age < 5) {
          await ins(dm['유아부'], m.id)
        } else if (age < 8) {
          await ins(dm['유치부'], m.id)
        } else if (age < 11) {
          await ins(dm['유년부'], m.id)
        } else if (age < 14) {
          await ins(dm['초등부'], m.id)
        } else if (age < 19) {
          await ins(dm['청소년부'], m.id)
        } else if (age < 29) {
          // 청년부 + 구역
          await ins(dm['청년부'], m.id)
          await ins(rr(구역들, '구역'), m.id)
        } else {
          // 30세 이상: 선교회 + 구역
          if (g === 'M') await ins(rr(남선교회들, '남선'), m.id)
          else           await ins(rr(여선교회들, '여선'), m.id)
          await ins(rr(구역들, '구역'), m.id)
        }

        // 찬양대·찬양단: 13세 이상, 18% 확률 추가 배정
        if (age >= 13 && Math.random() < 0.18 && 모든찬양.length) {
          await ins(rr(모든찬양, '찬양'), m.id)
        }
      }
    }

    // ── 최종 보정: 아직 배정 안 된 교인을 fallback 부서에 배정 ──
    const { rows: unassignedMembers } = await client.query(
      `SELECT id FROM members WHERE id NOT IN (SELECT DISTINCT member_id FROM department_members)`
    )
    for (const m of unassignedMembers) {
      const deptId = fallbackPool[fallbackIdx++ % fallbackPool.length]
      await ins(deptId, m.id, 'member', null)
    }

    await client.query('COMMIT')

    const { rows: [{ count: total }] } = await pool.query('SELECT COUNT(*) FROM department_members')
    const { rows: [{ count: unassigned }] } = await pool.query(
      `SELECT COUNT(*) FROM members WHERE id NOT IN (SELECT DISTINCT member_id FROM department_members)`
    )

    res.json({
      message: '부서 배정 완료 ✅',
      총배정건수: Number(total),
      미배정인원: Number(unassigned),
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[SEED DEPT ERROR]', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// ── 데이터 보강 엔드포인트 ──────────────────────────────────
// GET /api/seed/enrich?secret=church2025
router.get('/enrich', async (req, res) => {
  if (req.query.secret !== 'church2025') return res.status(401).json({ error: '인증 실패' })

  const results = {}

  // ── Section A: 교인 공란 필드 채우기 ──────────────────────
  try {
    const SURNAMES_EN = { '김':'Kim','이':'Lee','박':'Park','최':'Choi','정':'Jung','강':'Kang','조':'Cho','윤':'Yoon','장':'Jang','임':'Lim','한':'Han','오':'Oh','서':'Seo','신':'Shin','권':'Kwon','황':'Hwang','안':'An','송':'Song','전':'Jeon','홍':'Hong','유':'Yu','고':'Ko','문':'Moon','양':'Yang','손':'Son','배':'Bae','백':'Baek','허':'Heo','남':'Nam','심':'Shim','노':'Noh','하':'Ha','곽':'Kwak','차':'Cha','류':'Ryu','나':'Na','진':'Jin','엄':'Eom','원':'Won','천':'Cheon' }
    const GIVEN_EN = ['Minjun','Seojun','Doyun','Jiwoo','Hyunwoo','Junhyuk','Jihoon','Seongmin','Junyoung','Taehun','Woojin','Jaewon','Donghyun','Seunghyun','Jaemin','Jinwoo','Taemin','Inhoo','Seoyeon','Seoyun','Jiyoo','Minseo','Haeun','Harin','Suah','Jia','Chaewon','Subin','Jimin','Yerin','Jihyun','Yuna','Naeun']
    const OCCUPATIONS_M = ['회사원','자영업','공무원','의사','엔지니어','사업가','교사','약사','농업','서비스업','은퇴']
    const OCCUPATIONS_F = ['교사','간호사','주부','약사','공무원','회사원','자영업','은퇴','서비스업']
    const OCCUPATIONS_Y = ['학생']
    const PREV_CHURCHES = ['영락교회','새문안교회','서울제일교회','온누리교회','사랑의교회','지구촌교회','할렐루야교회','광림교회','명성교회','소망교회']
    const PREV_POSITIONS = ['성도','집사','권사','장로','성도','집사']
    const NOTES = ['신실한 봉사자','찬양대 헌신','구역 예배 인도','새벽 기도 참석 꾸준함','가정예배 실천','전도 열정 있음',null,null,null]

    const { rows: allMembers } = await pool.query(
      `SELECT id, name, gender, birth_date, position, registered_at, resident_id, faith_level,
              membership_category, household_head_name, introducer_name, occupation,
              previous_church, anniversary_date, baptism_date, birth_lunar, name_en, note
       FROM members ORDER BY id`
    )
    const allNames = allMembers.map(m => m.name)

    let updatedA = 0
    for (const m of allMembers) {
      const birthStr = m.birth_date ? new Date(m.birth_date).toISOString().slice(0, 10) : null
      const age = birthStr
        ? Math.floor((Date.now() - new Date(birthStr)) / (365.25 * 24 * 3600 * 1000))
        : 35

      const cat = age < 19 ? '교회학교' : age < 40 ? '청년' : '장년'
      const faith = m.position ? '세례' : (Math.random() < 0.6 ? '세례' : Math.random() < 0.5 ? '입교' : '미세례')
      const yy = birthStr ? birthStr.slice(2, 4) : String(rndInt(60, 99))
      const mm2 = birthStr ? birthStr.slice(5, 7) : String(rndInt(1, 12)).padStart(2, '0')
      const dd2 = birthStr ? birthStr.slice(8, 10) : String(rndInt(1, 28)).padStart(2, '0')
      const gCode = m.gender === 'M' ? rndInt(1, 2) : rndInt(3, 4)
      const rid = `${yy}${mm2}${dd2}-${gCode}${String(rndInt(100000, 999999))}`
      const surname = m.name ? m.name[0] : '김'
      const given = rnd(GIVEN_EN)
      const nameEn = `${SURNAMES_EN[surname] || 'Kim'} ${given}`
      const occ = age < 20 ? rnd(OCCUPATIONS_Y) : m.gender === 'M' ? rnd(OCCUPATIONS_M) : rnd(OCCUPATIONS_F)
      const regYear = m.registered_at ? new Date(m.registered_at).getFullYear() : 2010
      const baptYear = regYear + rndInt(0, 1)
      const baptMonth = String(rndInt(1, 12)).padStart(2, '0')
      const baptDay = String(rndInt(1, 28)).padStart(2, '0')
      const baptDate = `${baptYear}-${baptMonth}-${baptDay}`
      const lunar = Math.random() < 0.15

      await pool.query(
        `UPDATE members SET
          membership_category   = COALESCE(NULLIF(membership_category,''), $1),
          faith_level           = COALESCE(NULLIF(faith_level,''), $2),
          resident_id           = COALESCE(NULLIF(resident_id,''), $3),
          household_head_name   = COALESCE(NULLIF(household_head_name,''), name),
          household_relation    = COALESCE(NULLIF(household_relation,''), '본인'),
          introducer_name       = COALESCE(NULLIF(introducer_name,''), $4),
          previous_church       = COALESCE(NULLIF(previous_church,''), $5),
          previous_church_position = COALESCE(NULLIF(previous_church_position,''), $6),
          occupation            = COALESCE(NULLIF(occupation,''), $7),
          baptism_date          = COALESCE(baptism_date, $8),
          birth_lunar           = COALESCE(birth_lunar, $9),
          name_en               = COALESCE(NULLIF(name_en,''), $10),
          note                  = COALESCE(NULLIF(note,''), $11)
        WHERE id = $12`,
        [cat, faith, rid,
         rnd(allNames), rnd(PREV_CHURCHES), rnd(PREV_POSITIONS), occ,
         baptDate, lunar, nameEn, rnd(NOTES), m.id]
      )
      updatedA++
    }
    results.members = updatedA
  } catch (e) {
    results.members = `ERROR: ${e.message}`
  }

  // ── Section B: 복잡한 가족관계 추가 ──────────────────────
  try {
    // 현재 부부 쌍 조회
    const { rows: spouses } = await pool.query(
      `SELECT f.member_id AS husband, f.related_member_id AS wife
       FROM families f
       JOIN members h ON h.id = f.member_id
       JOIN members w ON w.id = f.related_member_id
       WHERE f.relation_type = 'spouse' AND h.gender = 'M' AND w.gender = 'F'
       LIMIT 60`
    )

    // 부부의 자녀 조회
    const { rows: parentChildRows } = await pool.query(
      `SELECT member_id AS parent_id, related_member_id AS child_id FROM families WHERE relation_type = 'child'`
    )
    const childrenOf = {}
    for (const pc of parentChildRows) {
      if (!childrenOf[pc.parent_id]) childrenOf[pc.parent_id] = []
      childrenOf[pc.parent_id].push(pc.child_id)
    }

    // 조부모 후보: 65-80세 교인
    const { rows: elderCandidates } = await pool.query(
      `SELECT id, gender FROM members
       WHERE birth_date IS NOT NULL
         AND EXTRACT(YEAR FROM AGE(birth_date)) BETWEEN 65 AND 85
       ORDER BY random() LIMIT 30`
    )
    const elderMales = elderCandidates.filter(e => e.gender === 'M')
    const elderFemales = elderCandidates.filter(e => e.gender === 'F')

    const ins2 = async (mid, rid, rel) => {
      await pool.query(
        `INSERT INTO families (member_id, related_member_id, relation_type) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [mid, rid, rel]
      )
    }

    let familyAdded = 0
    const usedElderM = new Set()
    const usedElderF = new Set()

    // 조부모 연결: 10쌍의 부부 선택, 해당 부부의 아버지(husband)에게 조부모 배정
    const targetCouples = spouses.slice(0, Math.min(10, spouses.length))
    for (const couple of targetCouples) {
      const gf = elderMales.find(e => !usedElderM.has(e.id))
      const gm = elderFemales.find(e => !usedElderF.has(e.id))
      if (!gf || !gm) break

      usedElderM.add(gf.id)
      usedElderF.add(gm.id)

      // 할아버지 ↔ 아버지(husband)
      await ins2(gf.id, couple.husband, 'child'); familyAdded++
      await ins2(couple.husband, gf.id, 'paternal_grandfather'); familyAdded++
      // 할머니 ↔ 아버지(husband)
      await ins2(gm.id, couple.husband, 'child'); familyAdded++
      await ins2(couple.husband, gm.id, 'paternal_grandmother'); familyAdded++
      // 할아버지 ↔ 할머니 spouse
      await ins2(gf.id, gm.id, 'spouse'); familyAdded++
      await ins2(gm.id, gf.id, 'spouse'); familyAdded++

      // 손자/손녀 연결 (할아버지/할머니 → 자녀의 자녀들)
      const grandchildren = childrenOf[couple.husband] || []
      for (const gcId of grandchildren) {
        await ins2(gf.id, gcId, 'grandchild'); familyAdded++
        await ins2(gcId, gf.id, 'paternal_grandfather'); familyAdded++
        await ins2(gm.id, gcId, 'grandchild'); familyAdded++
        await ins2(gcId, gm.id, 'paternal_grandmother'); familyAdded++
      }
    }

    // 형제자매 연결: 같은 부모를 가진 자녀들끼리
    const { rows: siblingCandidates } = await pool.query(
      `SELECT f1.related_member_id AS child1, f2.related_member_id AS child2
       FROM families f1
       JOIN families f2 ON f1.member_id = f2.member_id
       WHERE f1.relation_type = 'child' AND f2.relation_type = 'child'
         AND f1.related_member_id < f2.related_member_id
       LIMIT 40`
    )
    for (const sc of siblingCandidates) {
      await ins2(sc.child1, sc.child2, 'sibling'); familyAdded++
      await ins2(sc.child2, sc.child1, 'sibling'); familyAdded++
    }

    results.families = familyAdded
  } catch (e) {
    results.families = `ERROR: ${e.message}`
  }

  // ── Section C: 2026년 헌금 데이터 (5월~12월) ─────────────
  try {
    // 2026년 전체 주일 생성
    const ALL_SUNDAYS_2026 = []
    let d = new Date('2026-01-04')
    while (d.getFullYear() === 2026) {
      ALL_SUNDAYS_2026.push(d.toISOString().slice(0, 10))
      d.setDate(d.getDate() + 7)
    }
    const MAY_DEC_SUNDAYS = ALL_SUNDAYS_2026.filter(s => s >= '2026-05-01')
    const SECOND_SUN_ALL = new Set(['2026-01-11','2026-02-08','2026-03-08','2026-04-12','2026-05-10','2026-06-14','2026-07-12','2026-08-09','2026-09-13','2026-10-11','2026-11-08','2026-12-13'])
    const SPECIAL_SUNDAYS_NEW = new Set(['2026-05-03','2026-11-22','2026-12-20'])

    // 이미 5월 이후 헌금이 있으면 스킵
    const { rows: [{ count: existC }] } = await pool.query(
      `SELECT COUNT(*) FROM offerings WHERE date >= '2026-05-01'`
    )
    if (Number(existC) > 0) {
      results.offerings = `SKIP (already ${existC} rows)`
    } else {
      const { rows: memberRows } = await pool.query(
        `SELECT id, position FROM members WHERE membership_type IN ('active','inactive') ORDER BY id`
      )
      let { rows: typeRows } = await pool.query('SELECT id, name FROM offering_types ORDER BY id')
      if (typeRows.length === 0) {
        const defaultTypes = ['주정헌금','십일조헌금','감사헌금','건축헌금','선교헌금','구제헌금','절기헌금','특별헌금','구역헌금','봉헌','장학헌금']
        for (const name of defaultTypes) {
          await pool.query(`INSERT INTO offering_types (name) VALUES ($1) ON CONFLICT DO NOTHING`, [name])
        }
        const { rows } = await pool.query('SELECT id, name FROM offering_types ORDER BY id')
        typeRows = rows
      }
      const tm = {}
      typeRows.forEach(t => { tm[t.name] = t.id })

      const offeringRows = []
      for (const m of memberRows) {
        const lvl = incomeLevel(m.position)
        const hasIncome = lvl !== 'none'

        if (Math.random() < 0.85) {
          for (const sun of MAY_DEC_SUNDAYS) {
            if (Math.random() < 0.85) offeringRows.push([m.id, tm['주정헌금'], weeklyAmt(lvl), sun])
          }
        }
        if (hasIncome && Math.random() < 0.65) {
          for (const sun of MAY_DEC_SUNDAYS) {
            if (SECOND_SUN_ALL.has(sun) && Math.random() < 0.90) offeringRows.push([m.id, tm['십일조헌금'], titheAmt(lvl), sun])
          }
        }
        if (Math.random() < 0.50) {
          for (const sun of pickRandom(MAY_DEC_SUNDAYS, rndInt(1, 4))) offeringRows.push([m.id, tm['감사헌금'], rndInt(3, 20) * 10000, sun])
        }
        if (hasIncome && Math.random() < 0.20) {
          for (const sun of pickRandom(MAY_DEC_SUNDAYS, rndInt(1, 2))) offeringRows.push([m.id, tm['건축헌금'], rndInt(10, 100) * 10000, sun])
        }
        if (Math.random() < 0.22) {
          const missionSun = MAY_DEC_SUNDAYS.find(s => s.slice(5, 7) === '06') || MAY_DEC_SUNDAYS[0]
          offeringRows.push([m.id, tm['선교헌금'], rndInt(2, 10) * 10000, missionSun])
        }
        if (Math.random() < 0.12) {
          for (const sun of pickRandom(MAY_DEC_SUNDAYS, rndInt(1, 2))) offeringRows.push([m.id, tm['구제헌금'], rndInt(2, 8) * 10000, sun])
        }
        // 어린이주일(5월 첫 주), 추수감사(11월), 성탄(12월)
        for (const specialSun of SPECIAL_SUNDAYS_NEW) {
          if (MAY_DEC_SUNDAYS.includes(specialSun) && Math.random() < 0.65) {
            offeringRows.push([m.id, tm['절기헌금'], rndInt(3, 20) * 10000, specialSun])
          }
        }
        if (Math.random() < 0.10) {
          for (const sun of pickRandom(MAY_DEC_SUNDAYS, rndInt(1, 3))) offeringRows.push([m.id, tm['특별헌금'], rndInt(5, 50) * 10000, sun])
        }
        if (Math.random() < 0.15) {
          const monthly2 = MAY_DEC_SUNDAYS.filter(s => SECOND_SUN_ALL.has(s))
          for (const sun of monthly2) {
            if (Math.random() < 0.80) offeringRows.push([m.id, tm['구역헌금'], rndInt(1, 5) * 10000, sun])
          }
        }
      }

      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const CHUNK = 200
        for (let i = 0; i < offeringRows.length; i += CHUNK) {
          const chunk = offeringRows.slice(i, i + CHUNK)
          const vals = chunk.map((_, j) => `($${j*4+1},$${j*4+2},$${j*4+3},$${j*4+4})`).join(',')
          await client.query(`INSERT INTO offerings (member_id, offering_type_id, amount, date) VALUES ${vals}`, chunk.flat())
        }
        await client.query('COMMIT')
        results.offerings = offeringRows.length
      } catch (e2) {
        await client.query('ROLLBACK')
        throw e2
      } finally {
        client.release()
      }
    }
  } catch (e) {
    results.offerings = `ERROR: ${e.message}`
  }

  // ── Section D: 2026년 출석 데이터 ────────────────────────
  try {
    const { rows: [{ count: existD }] } = await pool.query(
      `SELECT COUNT(*) FROM attendances WHERE date >= '2026-01-01'`
    )
    if (Number(existD) > 500) {
      results.attendance = `SKIP (already ${existD} rows)`
    } else {
      const { rows: services } = await pool.query(
        `SELECT id, day_of_week FROM services WHERE is_active = true ORDER BY id`
      )
      const sundaySvcs = services.filter(s => s.day_of_week === 0 || s.day_of_week === null || s.day_of_week === 7)
      const wednesdaySvcs = services.filter(s => s.day_of_week === 3)

      const { rows: activeMembers } = await pool.query(
        `SELECT id FROM members WHERE membership_type = 'active' ORDER BY id`
      )
      const mIds = activeMembers.map(r => r.id)

      // 2026년 모든 주일/수요일 생성
      const allSundays2026 = []
      const allWednesdays2026 = []
      for (let dt = new Date('2026-01-04'); dt.getFullYear() === 2026; dt.setDate(dt.getDate() + 1)) {
        const day = dt.getDay()
        const dateStr = dt.toISOString().slice(0, 10)
        if (day === 0) allSundays2026.push(dateStr)
        if (day === 3) allWednesdays2026.push(dateStr)
      }

      const attRows = []
      const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)

      for (const dateStr of allSundays2026) {
        for (const svc of sundaySvcs) {
          const count = rndInt(60, 90)
          const selected = shuffle(mIds).slice(0, Math.min(count, mIds.length))
          for (const mid of selected) attRows.push([mid, svc.id, dateStr, 'manual'])
        }
      }
      for (const dateStr of allWednesdays2026) {
        for (const svc of wednesdaySvcs) {
          const count = rndInt(30, 50)
          const selected = shuffle(mIds).slice(0, Math.min(count, mIds.length))
          for (const mid of selected) attRows.push([mid, svc.id, dateStr, 'manual'])
        }
      }

      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const CHUNK = 200
        for (let i = 0; i < attRows.length; i += CHUNK) {
          const chunk = attRows.slice(i, i + CHUNK)
          const vals = chunk.map((_, j) => `($${j*4+1},$${j*4+2},$${j*4+3},$${j*4+4})`).join(',')
          await client.query(
            `INSERT INTO attendances (member_id, service_id, date, method) VALUES ${vals} ON CONFLICT DO NOTHING`,
            chunk.flat()
          )
        }
        await client.query('COMMIT')
        results.attendance = attRows.length
      } catch (e2) {
        await client.query('ROLLBACK')
        throw e2
      } finally {
        client.release()
      }
    }
  } catch (e) {
    results.attendance = `ERROR: ${e.message}`
  }

  // ── Section E: 심방 20건 ──────────────────────────────────
  try {
    const { rows: pastorRows } = await pool.query(
      `SELECT u.id FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.name IN ('super_admin','church_admin','pastor')
       ORDER BY u.id LIMIT 1`
    )
    if (pastorRows.length === 0) {
      results.pastoral = 'SKIP (no pastor user found)'
    } else {
      const { rows: [{ count: existE }] } = await pool.query('SELECT COUNT(*) FROM pastoral_visits')
      if (Number(existE) >= 20) {
        results.pastoral = `SKIP (already ${existE} rows)`
      } else {
        const pastorId = pastorRows[0].id
        const VISIT_TYPES = ['가정','가정','가정','전화','전화','병원','교회']
        const LOCATIONS = ['자택','자택','교회','전화통화','병원','교회']
        const CONTENTS = [
          '가정을 방문하여 기도하고 성도의 건강과 가정의 평안을 위해 함께 기도드렸습니다.',
          '전화 심방을 통해 안부를 여쭙고 기도로 위로와 격려를 드렸습니다.',
          '병원에 입원 중인 성도를 방문하여 예배드리고 쾌유를 위해 기도하였습니다.',
          '가정예배를 드리며 성경말씀을 나누고 가족 모두를 위해 기도하였습니다.',
          '오랜만에 교회를 찾은 성도와 면담하며 신앙생활을 격려하였습니다.',
          '어려운 상황에 처한 성도 가정을 방문하여 위로하고 실질적인 도움을 나누었습니다.',
          '새신자 가정을 처음 방문하여 교회를 소개하고 신앙 안내를 드렸습니다.',
          '은퇴 성도를 방문하여 지나온 삶을 돌아보며 감사 예배를 드렸습니다.',
          '청년 성도와 진로 및 신앙에 대해 깊이 대화하고 기도로 마쳤습니다.',
          '구역 예배 중 특별히 어려움을 호소한 성도를 추가로 방문하여 상담하였습니다.',
        ]
        const NEXT_PLANS = [
          '다음 달 재방문 예정, 가정 형편 지속 관찰',
          '병원 퇴원 후 가정 방문 계획',
          '구역 예배 시 지속적인 관심과 기도',
          '다음 분기 심방 시 포함 예정',
          null, null, null,
        ]

        const { rows: visitTargets } = await pool.query(
          `SELECT id FROM members WHERE membership_type = 'active' ORDER BY random() LIMIT 20`
        )

        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          for (const target of visitTargets) {
            const year = Math.random() < 0.5 ? 2025 : 2026
            const month = year === 2026 ? rndInt(1, 4) : rndInt(1, 12)
            const day = rndInt(1, 28)
            const visitDate = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
            const vtype = rnd(VISIT_TYPES)
            const loc = rnd(LOCATIONS)
            const content = rnd(CONTENTS)
            const nextPlan = Math.random() < 0.5 ? rnd(NEXT_PLANS.filter(Boolean)) : null
            await client.query(
              `INSERT INTO pastoral_visits (member_id, pastor_id, visit_date, content, visit_type, location, next_plan)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [target.id, pastorId, visitDate, content, vtype, loc, nextPlan]
            )
          }
          await client.query('COMMIT')
          results.pastoral = visitTargets.length
        } catch (e2) {
          await client.query('ROLLBACK')
          throw e2
        } finally {
          client.release()
        }
      }
    }
  } catch (e) {
    results.pastoral = `ERROR: ${e.message}`
  }

  // ── Section F: 부서 인원 보강 ─────────────────────────────
  try {
    const { rows: depts } = await pool.query('SELECT id, name FROM departments ORDER BY id')
    if (depts.length === 0) {
      results.departments = 'SKIP (no departments)'
    } else {
      const { rows: deptCounts } = await pool.query(
        `SELECT department_id, COUNT(*) AS cnt FROM department_members GROUP BY department_id`
      )
      const countMap = {}
      deptCounts.forEach(r => { countMap[r.department_id] = Number(r.cnt) })

      const { rows: generalMembers } = await pool.query(
        `SELECT id FROM members WHERE position IS NULL AND membership_type = 'active' ORDER BY random()`
      )
      let gmIdx = 0
      let deptAdded = 0

      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        for (const dept of depts) {
          const current = countMap[dept.id] || 0
          const needed = Math.max(0, 3 - current)
          for (let i = 0; i < needed && gmIdx < generalMembers.length; i++, gmIdx++) {
            await client.query(
              `INSERT INTO department_members (department_id, member_id, role, job_title)
               VALUES ($1,$2,'member',null) ON CONFLICT DO NOTHING`,
              [dept.id, generalMembers[gmIdx].id]
            )
            deptAdded++
          }

          // 부장(leader) 없으면 기존 멤버 중 1명을 leader로
          const { rows: leaders } = await client.query(
            `SELECT id FROM department_members WHERE department_id = $1 AND role = 'leader' LIMIT 1`,
            [dept.id]
          )
          if (leaders.length === 0) {
            const { rows: anyMember } = await client.query(
              `SELECT id FROM department_members WHERE department_id = $1 LIMIT 1`,
              [dept.id]
            )
            if (anyMember.length > 0) {
              await client.query(
                `UPDATE department_members SET role = 'leader', job_title = '부장'
                 WHERE id = $1`,
                [anyMember[0].id]
              )
              deptAdded++
            }
          }
        }

        await client.query('COMMIT')
        results.departments = deptAdded
      } catch (e2) {
        await client.query('ROLLBACK')
        throw e2
      } finally {
        client.release()
      }
    }
  } catch (e) {
    results.departments = `ERROR: ${e.message}`
  }

  res.json({ ok: true, results })
})

export default router
