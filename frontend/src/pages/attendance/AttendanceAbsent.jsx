import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { attendance as api } from '../../api'
import { genderColor } from '../../utils'
import dayjs from 'dayjs'
import styles from './AttendanceAbsent.module.css'

const GROUPS = Array.from({ length: 8 }, (_, i) => {
  const n = i + 1
  return { key: String(n), cls: `g${n}`, label: `${n}주 미출석`, weeks: n }
})

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
  const [longterm, setLongterm] = useState([])
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    setLoading(true)
    api.absentMembers(filterId)
      .then(r => {
        setAsOfDate(r.data?.asOfDate ?? null)
        setMembers(r.data?.members ?? [])
        setLongterm(r.data?.longterm ?? [])
      })
      .catch(() => { setAsOfDate(null); setMembers([]); setLongterm([]) })
      .finally(() => setLoading(false))
  }, [filterId])

  const grouped = GROUPS.map(g => ({
    ...g,
    members: members.filter(m => m.weeks_missed === g.weeks),
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
      ) : total === 0 && longterm.length === 0 ? (
        <div className={styles.empty}>미출석 교인이 없습니다.</div>
      ) : (
        <>
          <div className={styles.totalBanner}>
            미출석명단 <strong>{total}명</strong>
            {longterm.length > 0 && <span className={styles.totalNote}>· 장기결석자 {longterm.length}명 별도</span>}
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

          {longterm.length > 0 && (
            <div className={styles.section}>
              <div className={`${styles.sectionHeader} ${styles.glongterm}`}>
                장기결석자 (8주 초과)
                <span className={styles.sectionCount}>{longterm.length}명</span>
              </div>
              <div className={styles.tileGrid}>
                {longterm.map(m => <AbsentTile key={m.id} m={m} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
