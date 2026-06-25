import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { attendance as api } from '../../api'
import { genderColor } from '../../utils'
import dayjs from 'dayjs'
import styles from './AttendanceAbsent.module.css'

const GROUPS = [
  { key: '1',      cls: 'g1',     label: '1주 미출석',     min: 1, max: 1 },
  { key: '2',      cls: 'g2',     label: '2주 미출석',     min: 2, max: 2 },
  { key: '3',      cls: 'g3',     label: '3주 미출석',     min: 3, max: 3 },
  { key: '4plus',  cls: 'g4plus', label: '4주 이상 미출석', min: 4, max: Infinity },
]

function consecutiveAbsent(pattern) {
  let count = 0
  for (const attended of pattern) {
    if (!attended) count++
    else break
  }
  return count
}

function AbsentTile({ m }) {
  const lastDate = m.last_attended_date
    ? dayjs(m.last_attended_date).format('M/D') + ' 마지막'
    : '기록없음'

  return (
    <Link to={`/members/${m.id}`} className={styles.tile}>
      {m.photo_url
        ? <img src={m.photo_url} alt={m.name} className={styles.tileThumb} />
        : <div className={styles.thumbPlaceholder} style={{ background: genderColor(m.gender) }}>
            {m.name[0]}
          </div>
      }
      <span className={styles.tileName}>{m.name}</span>
      <span className={styles.tileSub}>{lastDate}</span>
    </Link>
  )
}

export default function AttendanceAbsent({ serviceId }) {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!serviceId) return
    setLoading(true)
    api.absentMembers(serviceId)
      .then(r => setData(r.data))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [serviceId])

  if (loading) return <div className={styles.empty}>불러오는 중…</div>
  if (!serviceId) return <div className={styles.empty}>예배를 선택하세요.</div>

  const withWeeks = data.map(m => ({ ...m, absentWeeks: consecutiveAbsent(m.pattern) }))

  const grouped = GROUPS.map(g => ({
    ...g,
    members: withWeeks.filter(m => m.absentWeeks >= g.min && m.absentWeeks <= g.max),
  }))

  const total = data.length

  if (total === 0) {
    return <div className={styles.empty}>이번 주 미출석 교인이 없습니다.</div>
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.totalBanner}>
        이번 주 미출석 <strong>{total}명</strong>
        <span className={styles.totalNote}>· 최근 3주 이내 출석 기록 기준</span>
      </div>

      {grouped.map(g => g.members.length > 0 && (
        <div key={g.key} className={styles.section}>
          <div className={`${styles.sectionHeader} ${styles[g.cls]}`}>
            {g.label}
            <span className={styles.sectionCount}>{g.members.length}명</span>
          </div>
          <div className={styles.tileGrid}>
            {g.members.map(m => <AbsentTile key={m.id} m={m} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
