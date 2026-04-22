import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

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

async function init() {
  // photo_url을 TEXT로 확장 (VARCHAR(500) 초과 대비)
  await pool.query(`ALTER TABLE members ALTER COLUMN photo_url TYPE TEXT`).catch(() => {})

  // 샘플 셀 자동 생성
  const { rows } = await pool.query(`SELECT COUNT(*) FROM communities WHERE type='cell'`)
  if (Number(rows[0].count) === 0) {
    const cells = ['은혜셀','사랑셀','소망셀','믿음셀','기쁨셀','평화셀','인내셀','감사셀']
    for (const name of cells) {
      await pool.query(`INSERT INTO communities (name, type) VALUES ($1, 'cell')`, [name])
    }
  }
}

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`)
  init().catch(console.error)
})
