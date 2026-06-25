import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { attendance as api } from '../../api'
import dayjs from 'dayjs'
import styles from './AttendanceAbsent.module.css'

const GROUPS = [
  { key: 'recent',  label: '1~4주 미출석',  min: 0,  max: 27  },
  { key: 'month',   label: '1~2달 미출석',  min: 28, max: 59  },
  { key: 'long',    label: '2달 이상',       min: 60, max: Infinity },
]

function consecutiveAbsent(pattern) {
  let count = 0
  for (const attended of pattern) {
    if (!attended) count++
    else break
  }
  return count
}

function AbsenceDots({ pattern }) {
  const reversed = [...pattern].reverse()
  return (
    <div className={styles.dotsRow}>
      {reversed.map((attended, i) => (
        <span
          key={i}
          className={attended ? styles.dotPresent : styles.dotAbsent}
          title={attended ? '출석' : '미출석'}
        />
      ))}
    </div>
  )
}

function MemberRow({ m }) {
  const absentWeeks = consecutiveAbsent(m.pattern)
  const lastDate = m.last_attended_date
    ? dayjs(m.last_attended_date).format('MM/DD')
    : '기록없음'

  return (
    <div className={styles.memberRow}>
      <Link to={`/members/${m.id}`} className={styles.memberName}>
        {m.name}
      </Link>
      <span className={styles.lastDate}>마지막 출석 {lastDate}</span>
      <AbsenceDots pattern={m.pattern} />
      <span className={styles.absentBadge}>{absentWeeks}주 연속</span>
      {m.phone && (
        <a href={`tel:${m.phone}`} className={styles.phoneLink} title={m.phone}>
          📞
        </a>
      )}
    </div>
  )
}

export default function AttendanceAbsent({ services }) {
  const [serviceId, setServiceId] = useState(null)
  const [data, setData]           = useState([])
  const [loading, setLoading]     = useState(false)

  useEffect(() => {
    if (services.length && !serviceId) setServiceId(services[0].id)
  }, [services])

  useEffect(() => {
    if (!serviceId) return
    setLoading(true)
    api.absentMembers(serviceId)
      .then(r => setData(r.data))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [serviceId])

  const shortName = s => s.name.replace('주일 ', '').replace(' 예배', '예배')

  const grouped = GROUPS.map(g => ({
    ...g,
    members: data.filter(m => m.days_since >= g.min && m.days_since <= g.max),
  }))

  return (
    <div className={styles.wrap}>
      {/* 서비스 탭 */}
      <div className={styles.serviceTabRow}>
        {services.map(s => (
          <button
            key={s.id}
            className={`${styles.serviceTab} ${s.id === serviceId ? styles.serviceTabActive : ''}`}
            onClick={() => setServiceId(s.id)}
          >
            {shortName(s)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.empty}>불러오는 중…</div>
      ) : data.length === 0 ? (
        <div className={styles.empty}>
          미출석 교인이 없거나, 아직 출석 데이터가 없습니다.
        </div>
      ) : (
        <>
          <div className={styles.totalBanner}>
            이번 주 미출석 <strong>{data.length}명</strong>
            <span className={styles.totalNote}>
              · 최근 3주 이내 출석 기록이 있는 분 기준
            </span>
          </div>

          {grouped.map(g => g.members.length > 0 && (
            <div key={g.key} className={styles.section}>
              <div className={`${styles.sectionHeader} ${styles[g.key]}`}>
                {g.label}
                <span className={styles.sectionCount}>{g.members.length}명</span>
              </div>
              <div className={styles.dotsLegend}>
                <span className={styles.dotPresent} /> 출석&nbsp;&nbsp;
                <span className={styles.dotAbsent} /> 미출석&nbsp;&nbsp;
                <span className={styles.legendNote}>← 과거 &nbsp; 최근 →</span>
              </div>
              {g.members.map(m => <MemberRow key={m.id} m={m} />)}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
