import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import pool from './db/pool.js'

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

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: true, credentials: true }))
app.options('*', cors({ origin: true, credentials: true }))
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

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
app.use('/api/settings',   settingsRouter)
app.use('/api/seed',       seedRouter)

async function init() {
  await pool.query(`ALTER TABLE members ALTER COLUMN photo_url TYPE TEXT`).catch(() => {})
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS position VARCHAR(100)`).catch(() => {})
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS resident_id VARCHAR(20)`).catch(() => {})

  // 교회 기본 정보 테이블
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

  // 샘플 셀모임 생성
  const { rows: cellCheck } = await pool.query(`SELECT COUNT(*) FROM communities WHERE type='cell'`)
  if (Number(cellCheck[0].count) === 0) {
    for (const name of ['은혜셀','사랑셀','소망셀','믿음셀','기쁨셀','평화셀','인내셀','감사셀']) {
      await pool.query(`INSERT INTO communities (name, type) VALUES ($1, 'cell')`, [name])
    }
  }

  // 헌금 종류 기본 데이터 생성
  const { rows: typeCheck } = await pool.query(`SELECT COUNT(*) FROM offering_types`)
  if (Number(typeCheck[0].count) === 0) {
    for (const name of ['주정헌금','십일조헌금','감사헌금','건축헌금','선교헌금','구제헌금']) {
      await pool.query(`INSERT INTO offering_types (name, is_active) VALUES ($1, true)`, [name])
    }
  }
}

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`)
  init().catch(console.error)
})
