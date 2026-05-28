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
import prayerRouter      from './routes/prayer.js'
import calendarRouter    from './routes/calendar.js'
import messengerRouter   from './routes/messenger.js'
import smsRouter         from './routes/sms.js'
import settingsRouter    from './routes/settings.js'
import seedRouter        from './routes/seed.js'
import expensesRouter    from './routes/expenses.js'
import publicRouter      from './routes/public.js'
import positionsRouter   from './routes/positions.js'
import enumValuesRouter  from './routes/enum-values.js'
import preferencesRouter from './routes/preferences.js'
import todosRouter       from './routes/todos.js'
import worshipQueueRouter from './routes/worship-queue.js'
import clergyRouter       from './routes/clergy.js'

import { requireAuth, requireRole } from './middleware/auth.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

// CORS — 허용 도메인 명시
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean)
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

// ICS 캘린더 피드 (공개, 토큰 기반 인증)
app.get('/api/calendar/ical', apiLimiter, async (req, res) => {
  const { token } = req.query
  if (!token) return res.status(401).end()
  const { rows: [user] } = await pool.query(
    'SELECT id, church_id FROM users WHERE ical_token = $1', [token]
  )
  if (!user) return res.status(401).end()

  const { rows: events } = await pool.query(`
    SELECT id, title, description, location, start_at, end_at, is_all_day, event_type
    FROM events
    WHERE end_at >= NOW() - INTERVAL '3 months'
      AND start_at <= NOW() + INTERVAL '2 years'
    ORDER BY start_at
  `)

  function formatIcalDate(dateStr, isAllDay) {
    const d = new Date(dateStr)
    if (isAllDay) return d.toISOString().slice(0,10).replace(/-/g,'')
    return d.toISOString().slice(0,19).replace(/[-:]/g,'') + 'Z'
  }
  function escIcal(str) {
    return String(str).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n')
  }

  const lines = [
    'BEGIN:VCALENDAR','VERSION:2.0',
    'PRODID:-//Saegim//Church System//KO',
    'X-WR-CALNAME:교회 일정','X-WR-TIMEZONE:Asia/Seoul',
    'CALSCALE:GREGORIAN','METHOD:PUBLISH',
  ]
  const nowStamp = new Date().toISOString().slice(0,19).replace(/[-:]/g,'') + 'Z'
  for (const ev of events) {
    const dtStart = formatIcalDate(ev.start_at, ev.is_all_day)
    const dtEnd   = formatIcalDate(ev.end_at,   ev.is_all_day)
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${ev.id}@saegim-church`)
    lines.push(`DTSTAMP:${nowStamp}`)
    lines.push(`DTSTART${ev.is_all_day ? ';VALUE=DATE' : ''}:${dtStart}`)
    lines.push(`DTEND${ev.is_all_day   ? ';VALUE=DATE' : ''}:${dtEnd}`)
    lines.push(`SUMMARY:${escIcal(ev.title)}`)
    if (ev.location)    lines.push(`LOCATION:${escIcal(ev.location)}`)
    if (ev.description) lines.push(`DESCRIPTION:${escIcal(ev.description)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', 'inline; filename="church.ics"')
  res.send(lines.join('\r\n'))
})

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
app.use('/api/prayer',      prayerRouter)
app.use('/api/calendar',    calendarRouter)
app.use('/api/messenger',   messengerRouter)
app.use('/api/sms',         smsRouter)
app.use('/api/settings',    settingsRouter)
app.use('/api/expenses',    expensesRouter)
app.use('/api/positions',   positionsRouter)
app.use('/api/enum-values', enumValuesRouter)
app.use('/api/preferences', preferencesRouter)
app.use('/api/todos',         todosRouter)
app.use('/api/worship-queues', worshipQueueRouter)
app.use('/api/clergy',      clergyRouter)
app.use('/api/seed',        requireRole(['super_admin']), seedRouter)
app.use('/api/admin',       requireRole(['super_admin', 'church_admin']), adminRouter)

async function init() {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb`).catch(() => {})
  await pool.query(`ALTER TABLE members ALTER COLUMN photo_url TYPE TEXT`).catch(() => {})
  await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#3b82f6'`).catch(() => {})
  await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_group_id UUID`).catch(() => {})
  await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT`).catch(() => {})
  await pool.query(`ALTER TABLE member_notes ADD COLUMN IF NOT EXISTS event_id INT REFERENCES events(id) ON DELETE SET NULL`).catch(() => {})
  await pool.query(`ALTER TABLE member_notes ADD COLUMN IF NOT EXISTS is_sensitive BOOLEAN DEFAULT FALSE`).catch(() => {})
  await pool.query(`ALTER TABLE member_notes ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id) ON DELETE SET NULL`).catch(() => {})
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
  await pool.query(`ALTER TABLE pastoral_visits ADD COLUMN IF NOT EXISTS visit_type VARCHAR(50) DEFAULT '가정'`).catch(() => {})
  await pool.query(`ALTER TABLE pastoral_visits ADD COLUMN IF NOT EXISTS location VARCHAR(200)`).catch(() => {})
  await pool.query(`ALTER TABLE pastoral_visits ADD COLUMN IF NOT EXISTS next_plan TEXT`).catch(() => {})
  await pool.query(`ALTER TABLE communities ADD COLUMN IF NOT EXISTS pastor_id INT REFERENCES members(id) ON DELETE SET NULL`).catch(() => {})
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pastoral_member ON pastoral_visits(member_id)`).catch(() => {})
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pastoral_date ON pastoral_visits(visit_date DESC)`).catch(() => {})
  await pool.query(`
    CREATE TABLE IF NOT EXISTS prayer_requests (
      id          SERIAL PRIMARY KEY,
      member_id   INT  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      content     TEXT NOT NULL,
      status      VARCHAR(20) NOT NULL DEFAULT 'active',
      created_by  INT  REFERENCES users(id),
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      answered_at TIMESTAMPTZ,
      answer_note TEXT
    )
  `).catch(() => {})
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_prayer_member ON prayer_requests(member_id)`).catch(() => {})

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

  // ── 서비스 카테고리 ──────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_categories (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(100) NOT NULL,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  const { rows: scCheck } = await pool.query(`SELECT COUNT(*) FROM service_categories`)
  if (Number(scCheck[0].count) === 0) {
    for (const [i, name] of ['주일예배','교회학교','특별예배','새벽예배','수요예배'].entries()) {
      await pool.query(`INSERT INTO service_categories (name, sort_order) VALUES ($1, $2)`, [name, i])
    }
  }
  await pool.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS category_id INT REFERENCES service_categories(id)`).catch(() => {})
  await pool.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS target_types JSONB DEFAULT '[]'`).catch(() => {})
  await pool.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS target_school_depts JSONB DEFAULT '[]'`).catch(() => {})
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS school_department VARCHAR(100)`).catch(() => {})

  // ── pastoral_visits 신규 필드 ────────────────────────────────
  await pool.query(`ALTER TABLE pastoral_visits ADD COLUMN IF NOT EXISTS hymn VARCHAR(200)`).catch(() => {})
  await pool.query(`ALTER TABLE pastoral_visits ADD COLUMN IF NOT EXISTS bible_verse VARCHAR(200)`).catch(() => {})
  await pool.query(`ALTER TABLE pastoral_visits ADD COLUMN IF NOT EXISTS companions JSONB DEFAULT '[]'`).catch(() => {})
  await pool.query(`ALTER TABLE pastoral_visits ADD COLUMN IF NOT EXISTS next_plan_event_id INT REFERENCES events(id) ON DELETE SET NULL`).catch(() => {})

  // ── prayer_requests 캘린더 연동 ──────────────────────────────
  await pool.query(`ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS event_id INT REFERENCES events(id) ON DELETE SET NULL`).catch(() => {})

  // ── events event_type ────────────────────────────────────────
  await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type VARCHAR(50) DEFAULT '기타'`).catch(() => {})

  // ── 개인 To-do ───────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todo_items (
      id           SERIAL PRIMARY KEY,
      user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content      TEXT NOT NULL,
      importance   BOOLEAN DEFAULT FALSE,
      status       VARCHAR(20) DEFAULT 'pending',
      due_date     DATE,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_todo_user ON todo_items(user_id)`).catch(() => {})

  // ── 찬양큐시트 ───────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS worship_queues (
      id          SERIAL PRIMARY KEY,
      title       VARCHAR(200) NOT NULL DEFAULT '새 큐시트',
      queue_date  DATE,
      created_by  INT REFERENCES users(id),
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {})
  await pool.query(`
    CREATE TABLE IF NOT EXISTS worship_queue_songs (
      id          SERIAL PRIMARY KEY,
      queue_id    INT REFERENCES worship_queues(id) ON DELETE CASCADE,
      order_index INT NOT NULL DEFAULT 0,
      song_title  VARCHAR(200) DEFAULT '',
      blocks      JSONB NOT NULL DEFAULT '[]',
      note        TEXT DEFAULT '',
      arrow_label VARCHAR(100) DEFAULT '',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {})
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_wqs_queue ON worship_queue_songs(queue_id)`).catch(() => {})
  await pool.query(`ALTER TABLE worship_queue_songs ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) NOT NULL DEFAULT 'song'`).catch(() => {})
  await pool.query(`ALTER TABLE worship_queue_songs ADD COLUMN IF NOT EXISTS sheet_image TEXT`).catch(() => {})
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_wqs_type ON worship_queue_songs(item_type)`).catch(() => {})
  await pool.query(`
    CREATE TABLE IF NOT EXISTS song_library (
      id          SERIAL PRIMARY KEY,
      song_title  VARCHAR(200) NOT NULL,
      last_blocks JSONB NOT NULL DEFAULT '[]',
      last_note   TEXT DEFAULT '',
      last_sheet  TEXT,
      created_by  INT REFERENCES users(id),
      updated_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (song_title, created_by)
    )
  `).catch(() => {})
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_song_library_title ON song_library(song_title, created_by)`).catch(() => {})

  await pool.query(`ALTER TABLE church_settings ADD COLUMN IF NOT EXISTS finance_pin VARCHAR(20) DEFAULT '0000'`).catch(() => {})

  // ── 교역자 연혁 ──────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clergy (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      role        TEXT,
      phone       TEXT,
      email       TEXT,
      start_date  DATE,
      end_date    DATE,
      is_current  BOOLEAN DEFAULT TRUE,
      notes       TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {})

  // ── 기도제목 민감정보 플래그 ─────────────────────────────────
  await pool.query(`ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS is_sensitive BOOLEAN DEFAULT FALSE`).catch(() => {})

  // ── ICS 캘린더 구독 토큰 ─────────────────────────────────────
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ical_token VARCHAR(64) UNIQUE`).catch(() => {})
  await pool.query(`UPDATE users SET ical_token = encode(gen_random_bytes(32), 'hex') WHERE ical_token IS NULL`).catch(() => {})

  // ── 조직/교구 연동 컬럼 ──────────────────────────────────────
  await pool.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS head_id INT REFERENCES members(id)`).catch(() => {})
  await pool.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_education BOOLEAN NOT NULL DEFAULT false`).catch(() => {})
  await pool.query(`ALTER TABLE communities ADD COLUMN IF NOT EXISTS source_dept_id INT REFERENCES departments(id)`).catch(() => {})
  await pool.query(`ALTER TABLE communities ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false`).catch(() => {})
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS communities_source_dept_id_key ON communities(source_dept_id) WHERE source_dept_id IS NOT NULL`).catch(() => {})

  // ── 심방 교역자 필드 ─────────────────────────────────────────
  await pool.query(`ALTER TABLE pastoral_visits ADD COLUMN IF NOT EXISTS visiting_pastor TEXT`).catch(() => {})
}

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`)
  init().catch(console.error)
})
