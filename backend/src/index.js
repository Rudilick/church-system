import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import pool from './db/pool.js'

import authRouter        from './routes/auth.js'
import adminRouter       from './routes/admin.js'
import membersRouter     from './routes/members.js'
import familiesRouter    from './routes/families.js'
import communitiesRouter from './routes/communities.js'
import departmentsRouter from './routes/departments.js'
import attendanceRouter  from './routes/attendance.js'
import offeringRouter    from './routes/offering.js'
import budgetRouter      from './routes/budget.js'
import pastoralRouter    from './routes/pastoral.js'
import calendarRouter    from './routes/calendar.js'
import messengerRouter   from './routes/messenger.js'
import smsRouter         from './routes/sms.js'
import settingsRouter    from './routes/settings.js'
import seedRouter        from './routes/seed.js'
import expensesRouter    from './routes/expenses.js'
import publicRouter      from './routes/public.js'
import positionsRouter   from './routes/positions.js'
import enumValuesRouter  from './routes/enum-values.js'

import { requireAuth, requireRole } from './middleware/auth.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

// CORS — 허용 도메인 명시
const allowedOrigins = [
  'https://church.rudilick.com',
  'http://localhost:5173',
  'http://localhost:4173',
]
const corsOptions = {
  origin: (origin, callback) => {
    // origin이 없는 경우(curl, Postman 등 서버 간 통신) 허용
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('CORS 정책에 의해 차단된 출처입니다.'))
    }
  },
  credentials: true,
}
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

// Rate Limiting — 로그인 API: 15분에 20회
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: '요청이 너무 많습니다. 15분 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// 일반 API: 1분에 200회
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

// 공개 라우트 (인증 불필요) — rate limit 적용
app.use('/api/auth',   authLimiter, authRouter)
app.use('/api/public', apiLimiter,  publicRouter)

// 이하 모든 /api/* 라우트에 인증 필수 + rate limit
app.use('/api', apiLimiter, requireAuth)

app.use('/api/members',     membersRouter)
app.use('/api/families',    familiesRouter)
app.use('/api/communities', communitiesRouter)
app.use('/api/departments', departmentsRouter)
app.use('/api/attendance',  attendanceRouter)
app.use('/api/offering',    offeringRouter)
app.use('/api/budget',      budgetRouter)
app.use('/api/pastoral',    pastoralRouter)
app.use('/api/calendar',    calendarRouter)
app.use('/api/messenger',   messengerRouter)
app.use('/api/sms',         smsRouter)
app.use('/api/settings',    settingsRouter)
app.use('/api/expenses',    expensesRouter)
app.use('/api/positions',   positionsRouter)
app.use('/api/enum-values', enumValuesRouter)
app.use('/api/seed',        requireRole(['super_admin']), seedRouter)
app.use('/api/admin',       requireRole(['super_admin', 'church_admin']), adminRouter)

async function init() {
  await pool.query(`ALTER TABLE members ALTER COLUMN photo_url TYPE TEXT`).catch(() => {})
  await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#3b82f6'`).catch(() => {})
  await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_group_id UUID`).catch(() => {})
  await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT`).catch(() => {})
  await pool.query(`ALTER TABLE member_notes ADD COLUMN IF NOT EXISTS event_id INT REFERENCES events(id) ON DELETE SET NULL`).catch(() => {})
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS position VARCHAR(100)`).catch(() => {})
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS resident_id VARCHAR(20)`).catch(() => {})
  await pool.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS parent_id INT REFERENCES departments(id) ON DELETE SET NULL`).catch(() => {})
  await pool.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0`).catch(() => {})
  await pool.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_budget_dept BOOLEAN DEFAULT false`).catch(() => {})
  await pool.query(`ALTER TABLE department_members ADD COLUMN IF NOT EXISTS job_title VARCHAR(200)`).catch(() => {})
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS membership_category VARCHAR(50)`).catch(() => {})
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS faith_level VARCHAR(50)`).catch(() => {})
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS household_head_name VARCHAR(100)`).catch(() => {})
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS household_relation VARCHAR(50)`).catch(() => {})
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS introducer_name VARCHAR(100)`).catch(() => {})
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS previous_church VARCHAR(200)`).catch(() => {})
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS previous_church_position VARCHAR(100)`).catch(() => {})
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS occupation VARCHAR(100)`).catch(() => {})
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS anniversary_date DATE`).catch(() => {})
  await pool.query(`ALTER TABLE church_settings ADD COLUMN IF NOT EXISTS member_pin VARCHAR(200) DEFAULT '0000'`).catch(() => {})
  await pool.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS author_name VARCHAR(100)`).catch(() => {})
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS staff_category VARCHAR(50)`).catch(() => {})
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS staff_role VARCHAR(100)`).catch(() => {})

  // 관계 유형 마이그레이션: parent → father/mother, grandparent → paternal_grandfather/grandmother
  await pool.query(`
    UPDATE families f SET relation_type =
      CASE WHEN m.gender = 'M' THEN 'father' WHEN m.gender = 'F' THEN 'mother' ELSE f.relation_type END
    FROM members m WHERE f.relation_type = 'parent' AND f.related_member_id = m.id
  `).catch(() => {})
  await pool.query(`
    UPDATE families f SET relation_type =
      CASE WHEN m.gender = 'M' THEN 'paternal_grandfather' WHEN m.gender = 'F' THEN 'paternal_grandmother' ELSE f.relation_type END
    FROM members m WHERE f.relation_type = 'grandparent' AND f.related_member_id = m.id
  `).catch(() => {})

  // 주일 오후찬양예배 서비스 추가 (없는 경우에만)
  const { rows: svcCheck } = await pool.query(`SELECT id FROM services WHERE name = '주일 오후찬양예배'`).catch(() => ({ rows: [] }))
  if (!svcCheck.length) {
    await pool.query(`INSERT INTO services (name, day_of_week, start_time, is_active) VALUES ('주일 오후찬양예배', 0, '16:00', true)`).catch(() => {})
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS church_settings (
      id          INT PRIMARY KEY DEFAULT 1,
      church_name VARCHAR(200) DEFAULT '',
      unique_id   VARCHAR(50)  DEFAULT '',
      address     VARCHAR(500) DEFAULT '',
      pastor_name VARCHAR(100) DEFAULT '',
      CONSTRAINT church_settings_single CHECK (id = 1)
    )
  `)
  await pool.query(`INSERT INTO church_settings (id) VALUES (1) ON CONFLICT DO NOTHING`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_notes (
      id         SERIAL PRIMARY KEY,
      member_id  INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      content    TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  const { rows: cellCheck } = await pool.query(`SELECT COUNT(*) FROM communities WHERE type='cell'`)
  if (Number(cellCheck[0].count) === 0) {
    for (const name of ['은혜셀','사랑셀','소망셀','믿음셀','기쁨셀','평화셀','인내셀','감사셀']) {
      await pool.query(`INSERT INTO communities (name, type) VALUES ($1, 'cell')`, [name])
    }
  }

  const { rows: typeCheck } = await pool.query(`SELECT COUNT(*) FROM offering_types`)
  if (Number(typeCheck[0].count) === 0) {
    for (const name of ['주정헌금','십일조헌금','감사헌금','건축헌금','선교헌금','구제헌금','절기헌금','특별헌금','교육헌금','구역헌금','봉헌','장학헌금']) {
      await pool.query(`INSERT INTO offering_types (name) VALUES ($1)`, [name])
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS positions (
      id            SERIAL PRIMARY KEY,
      name          VARCHAR(100) NOT NULL,
      category      VARCHAR(50)  NOT NULL DEFAULT 'deacon',
      display_order INT          NOT NULL DEFAULT 0,
      is_active     BOOLEAN      NOT NULL DEFAULT true
    )
  `)
  const { rows: posCheck } = await pool.query(`SELECT COUNT(*) FROM positions`)
  if (Number(posCheck[0].count) === 0) {
    const initPositions = [
      { name: '담임목사', category: 'pastoral', order: 0 },
      { name: '부목사',   category: 'pastoral', order: 1 },
      { name: '전도사',   category: 'pastoral', order: 2 },
      { name: '장로',     category: 'deacon',   order: 3 },
      { name: '권사',     category: 'deacon',   order: 4 },
      { name: '안수집사', category: 'deacon',   order: 5 },
      { name: '집사',     category: 'deacon',   order: 6 },
      { name: '사무간사', category: 'other',    order: 7 },
      { name: '관리집사', category: 'other',    order: 8 },
    ]
    for (const p of initPositions) {
      await pool.query(
        `INSERT INTO positions (name, category, display_order) VALUES ($1, $2, $3)`,
        [p.name, p.category, p.order]
      )
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS church_enum_values (
      id            SERIAL PRIMARY KEY,
      enum_type     VARCHAR(50)  NOT NULL,
      value         VARCHAR(100) NOT NULL,
      display_order INT          NOT NULL DEFAULT 0,
      is_active     BOOLEAN      NOT NULL DEFAULT true
    )
  `)
  const { rows: enumCheck } = await pool.query(`SELECT COUNT(*) FROM church_enum_values`)
  if (Number(enumCheck[0].count) === 0) {
    const initEnums = [
      { type: 'membership_category', value: '장년',    order: 0 },
      { type: 'membership_category', value: '청년',    order: 1 },
      { type: 'membership_category', value: '교회학교', order: 2 },
      { type: 'membership_category', value: '자치',    order: 3 },
      { type: 'membership_category', value: '특별',    order: 4 },
      { type: 'faith_level',         value: '입교',    order: 0 },
      { type: 'faith_level',         value: '세례',    order: 1 },
      { type: 'faith_level',         value: '영아세례', order: 2 },
      { type: 'faith_level',         value: '미세례',  order: 3 },
      { type: 'faith_level',         value: '학습',    order: 4 },
    ]
    for (const e of initEnums) {
      await pool.query(
        `INSERT INTO church_enum_values (enum_type, value, display_order) VALUES ($1, $2, $3)`,
        [e.type, e.value, e.order]
      )
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id            SERIAL PRIMARY KEY,
      department_id INT REFERENCES departments(id) ON DELETE SET NULL,
      date          DATE NOT NULL,
      description   VARCHAR(500) NOT NULL,
      amount        BIGINT NOT NULL DEFAULT 0,
      memo          VARCHAR(500),
      receipt_url   TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`)
  init().catch(console.error)
})
