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

export default function AttendanceAbsent({ services = [] }) {
  const [filterId, setFilterId] = useState(null) // null = 전체(모든 예배 통합)
  const [asOfDate, setAsOfDate] = useState(null)
  const [members, setMembers]   = useState([])
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    setLoading(true)
    api.absentMembers(filterId)
      .then(r => {
        setAsOfDate(r.data?.asOfDate ?? null)
        setMembers(r.data?.members ?? [])
      })
      .catch(() => { setAsOfDate(null); setMembers([]) })
      .finally(() => setLoading(false))
  }, [filterId])

  const withWeeks = members.map(m => ({ ...m, absentWeeks: consecutiveAbsent(m.pattern) }))

  const grouped = GROUPS.map(g => ({
    ...g,
    members: withWeeks.filter(m => m.absentWeeks >= g.min && m.absentWeeks <= g.max),
  }))

  const total = members.length
  const dateLabel = asOfDate ? `${dayjs(asOfDate).format('M/D')} 기준` : ''

  return (
    <div className={styles.wrap}>
      {services.length > 0 && (
        <div className={styles.filterRow}>
          <button
            className={`${styles.filterChip} ${filterId === null ? styles.filterChipActive : ''}`}
            onClick={() => setFilterId(null)}
          >전체</button>
          {services.map(s => (
            <button
              key={s.id}
              className={`${styles.filterChip} ${filterId === s.id ? styles.filterChipActive : ''}`}
              onClick={() => setFilterId(s.id)}
            >{s.name}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className={styles.empty}>불러오는 중…</div>
      ) : total === 0 ? (
        <div className={styles.empty}>미출석 교인이 없습니다.</div>
      ) : (
        <>
          <div className={styles.totalBanner}>
            미출석명단 <strong>{total}명</strong>
            {dateLabel && <span className={styles.totalNote}>· {dateLabel}</span>}
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
        </>
      )}
    </div>
  )
}
