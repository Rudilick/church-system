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

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://church.rudilick.com',
  'https://church-system-pearl.vercel.app',
]

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true)
    else cb(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))
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

app.listen(PORT, () => console.log(`서버 실행 중: http://localhost:${PORT}`))
