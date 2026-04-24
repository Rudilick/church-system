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
      const membershipType = Math.random() < 0.83 ? 'active' : (Math.random() < 0.6 ? 'inactive' : 'visitor')
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
        `INSERT INTO families (member_id, related_member_id, relation_type) VALUES ($1,$2,'배우자'),($2,$1,'배우자')`,
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
             ($1,$2,'자녀'),($2,$1,'부모'),($3,$2,'자녀'),($2,$3,'부모')`,
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
function is2ndSunday(dateStr) {
  const day = new Date(dateStr + 'T00:00:00Z').getUTCDate()
  return day >= 8 && day <= 14
}

function isFirstSundayOfQuarter(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  const month = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  return [3, 6, 9, 12].includes(month) && day <= 7
}

function pickRandom(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(n, arr.length))
}

// GET /api/seed/offerings — 2024-01-07 ~ 현재까지 주차별 헌금 데이터 생성
router.get('/offerings', async (req, res) => {
  if (req.query.secret !== 'church2025') return res.status(401).json({ error: '인증 실패' })

  const { rows: cnt } = await pool.query('SELECT COUNT(*) FROM offerings')
  if (Number(cnt[0].count) > 100 && req.query.force !== 'true') {
    return res.json({
      message: '헌금 데이터가 이미 존재합니다.',
      count: Number(cnt[0].count),
      hint: '?force=true&secret=church2025 로 덮어쓸 수 있습니다.',
    })
  }

  const { rows: memberRows } = await pool.query(
    `SELECT id FROM members WHERE membership_type IN ('active','inactive') ORDER BY id`
  )
  const { rows: offeringTypes } = await pool.query('SELECT id, name FROM offering_types ORDER BY id')
  const typeMap = {}
  offeringTypes.forEach(t => { typeMap[t.name] = t.id })

  // 2024-01-07(첫 주일)부터 이번 주 주일까지 모든 주일 생성
  const sundays = []
  let cur = new Date('2024-01-07T00:00:00Z')
  const now = new Date()
  // 이번 주 주일 계산 (UTC 기준)
  const todayDay = now.getUTCDay() // 0=Sun
  const thisSunday = new Date(now)
  thisSunday.setUTCDate(now.getUTCDate() - todayDay)
  thisSunday.setUTCHours(0, 0, 0, 0)

  while (cur <= thisSunday) {
    sundays.push(cur.toISOString().slice(0, 10))
    cur = new Date(cur.getTime() + 7 * 24 * 60 * 60 * 1000)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (req.query.force === 'true') await client.query('DELETE FROM offerings')

    const offeringRows = []

    for (const m of memberRows) {
      const givesWeekly   = Math.random() < 0.78
      const givesTithe    = Math.random() < 0.42
      const givesGratitude = Math.random() < 0.55
      const givesBuilding = Math.random() < 0.18
      const givesMission  = Math.random() < 0.22
      const givesRelief   = Math.random() < 0.12

      // 랜덤 주일 선택
      const gratitudeDates = givesGratitude ? pickRandom(sundays, rndInt(1, 4)) : []
      const buildingDates  = givesBuilding  ? pickRandom(sundays, rndInt(1, 2)) : []
      const reliefDates    = givesRelief    ? pickRandom(sundays, rndInt(1, 3)) : []
      const gratitudeSet   = new Set(gratitudeDates)
      const buildingSet    = new Set(buildingDates)
      const reliefSet      = new Set(reliefDates)

      for (const sunday of sundays) {
        // 주정헌금 — 매주 주일, 85% 출석률
        if (givesWeekly && Math.random() < 0.85) {
          offeringRows.push([m.id, typeMap['주정헌금'], rndInt(3, 20) * 10000, sunday])
        }

        // 십일조 — 매월 2째 주일
        if (givesTithe && is2ndSunday(sunday) && Math.random() < 0.88) {
          offeringRows.push([m.id, typeMap['십일조헌금'], rndInt(10, 80) * 10000, sunday])
        }

        // 감사헌금 — 연 1~4회 (사전 선택된 주일)
        if (givesGratitude && gratitudeSet.has(sunday)) {
          offeringRows.push([m.id, typeMap['감사헌금'], rndInt(3, 20) * 10000, sunday])
        }

        // 건축헌금 — 연 1~2회
        if (givesBuilding && buildingSet.has(sunday)) {
          offeringRows.push([m.id, typeMap['건축헌금'], rndInt(10, 100) * 10000, sunday])
        }

        // 선교헌금 — 분기 첫 주일 (3,6,9,12월)
        if (givesMission && isFirstSundayOfQuarter(sunday) && Math.random() < 0.65) {
          offeringRows.push([m.id, typeMap['선교헌금'], rndInt(2, 10) * 10000, sunday])
        }

        // 구제헌금 — 연 1~3회
        if (givesRelief && reliefSet.has(sunday)) {
          offeringRows.push([m.id, typeMap['구제헌금'], rndInt(2, 8) * 10000, sunday])
        }
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
    res.json({
      message: '헌금 시드 완료 ✅',
      sundays: sundays.length,
      members: memberRows.length,
      offerings: offeringRows.length,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[SEED OFFERINGS ERROR]', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

export default router
