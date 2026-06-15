import { useState, useEffect } from 'react'
import { attendance as api } from '../../api'
import dayjs from 'dayjs'
import styles from './AttendanceStats.module.css'
import PageHeader from '../../components/PageHeader'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const AGE_COLORS = ['#6366f1','#3b82f6','#10b981','#f59e0b','#f97316','#ef4444']
const FAMILY_COLORS = ['#10b981','#f59e0b','#94a3b8']

export default function AttendanceStats() {
  const [tab, setTab] = useState('overall')    // 'overall' | 'service'
  const [serviceId, setServiceId] = useState('')
  const [services, setServices] = useState([])

  const [summary, setSummary] = useState(null)        // { thisWeek, lastWeek, lastYearWeek }
  const [weekly, setWeekly] = useState([])            // 8주 남/녀
  const [compareYear, setCompareYear] = useState([])  // 전년 동월 비교
  const [ageData, setAgeData] = useState([])          // 연령대 분포
  const [familyData, setFamilyData] = useState([])    // 가족단위
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.services().then(r => setServices(r.data || []))
  }, [])

  useEffect(() => { loadAll() }, [tab, serviceId])

  const params = tab === 'service' && serviceId ? { service_id: serviceId } : {}

  const loadAll = async () => {
    setLoading(true)
    try {
      const [w, cy, ag, fam] = await Promise.all([
        api.statsWeekly(params),
        api.statsCompareYear(params),
        api.statsAge(params),
        api.statsFamily(params),
      ])
      const weekRows = w.data || []
      // Derive summary from last two weekly rows and compare-year data
      const last  = weekRows[weekRows.length - 1]
      const prev  = weekRows[weekRows.length - 2]
      const cyRows = cy.data || []
      const lastYearWeek = cyRows.find(r => r.is_last_year && r.week_label === last?.week_label)
      setSummary({
        thisWeek:     (last?.male || 0) + (last?.female || 0),
        lastWeekDiff: last && prev
          ? ((last.male + last.female) - (prev.male + prev.female))
          : null,
        lastYearDiff: last && lastYearWeek
          ? ((last.male + last.female) - (lastYearWeek.male + lastYearWeek.female))
          : null,
      })
      setWeekly(weekRows)
      setCompareYear(cyRows)
      setAgeData(ag.data || [])
      setFamilyData(fam.data || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const fmtDiff = (n) => {
    if (n === null || n === undefined) return '–'
    if (n > 0) return <span className={styles.up}>▲ {n}</span>
    if (n < 0) return <span className={styles.down}>▼ {Math.abs(n)}</span>
    return <span className={styles.flat}>– 0</span>
  }

  // Recharts custom tooltip
  const ChipTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipLabel}>{label}</p>
        {payload.map(p => (
          <p key={p.dataKey} style={{ color: p.color, margin: '2px 0', fontSize: '0.82rem' }}>
            {p.name}: {p.value}명
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader title="출결 통계" />
      <div className={styles.tabRow}>
        <button className={`${styles.tabBtn} ${tab === 'overall' ? styles.tabActive : ''}`}
          onClick={() => setTab('overall')}>전체</button>
        <button className={`${styles.tabBtn} ${tab === 'service' ? styles.tabActive : ''}`}
          onClick={() => setTab('service')}>예배별</button>
        {tab === 'service' && (
          <select className={styles.serviceSelect} value={serviceId}
            onChange={e => setServiceId(e.target.value)}>
            <option value="">예배 선택</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading && <div className={styles.loading}>불러오는 중…</div>}

      {/* ── 요약 카드 ────────────────────────────────────────── */}
      {summary && (
        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>이번 주 출석</div>
            <div className={styles.cardValue}>{summary.thisWeek}<span className={styles.cardUnit}>명</span></div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>전주 대비</div>
            <div className={styles.cardValue}>{fmtDiff(summary.lastWeekDiff)}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>전년 동주 대비</div>
            <div className={styles.cardValue}>{fmtDiff(summary.lastYearDiff)}</div>
          </div>
        </div>
      )}

      {/* ── 주차별 추이 (8주, 남/녀) ──────────────────────────── */}
      {weekly.length > 0 && (
        <div className={styles.chartBox}>
          <h3 className={styles.chartTitle}>주차별 출석 추이 (최근 8주)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weekly} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="week_label" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={32} />
              <Tooltip content={<ChipTooltip />} />
              <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
              <Line type="monotone" dataKey="male"   name="남성" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="female" name="여성" stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="total"  name="합계" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── 전년 동월 비교 막대 ───────────────────────────────── */}
      {compareYear.length > 0 && (
        <div className={styles.chartBox}>
          <h3 className={styles.chartTitle}>전년 동월 비교</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={compareYear} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="week_label" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={32} />
              <Tooltip content={<ChipTooltip />} />
              <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
              <Bar dataKey="this_year"  name="올해" fill="#3b82f6" radius={[3,3,0,0]} />
              <Bar dataKey="last_year"  name="작년" fill="#cbd5e1" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── 연령대 분포 + 가족단위 출결 ──────────────────────── */}
      <div className={styles.chartRow}>
        {ageData.length > 0 && (
          <div className={`${styles.chartBox} ${styles.chartHalf}`}>
            <h3 className={styles.chartTitle}>연령대 분포</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={ageData} dataKey="count" nameKey="age_group"
                  cx="50%" cy="50%" innerRadius={52} outerRadius={80}
                  paddingAngle={2} label={({ age_group, percent }) =>
                    `${age_group} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {ageData.map((_, i) => (
                    <Cell key={i} fill={AGE_COLORS[i % AGE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v}명`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {familyData.length > 0 && (
          <div className={`${styles.chartBox} ${styles.chartHalf}`}>
            <h3 className={styles.chartTitle}>가족단위 출결</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={familyData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week_label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={32} />
                <Tooltip content={<ChipTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                <Bar dataKey="full"    name="전가족출석" stackId="a" fill={FAMILY_COLORS[0]} />
                <Bar dataKey="partial" name="일부출석"   stackId="a" fill={FAMILY_COLORS[1]} />
                <Bar dataKey="none"    name="미출석"     stackId="a" fill={FAMILY_COLORS[2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {!loading && !summary && (
        <div className={styles.empty}>데이터가 없습니다.</div>
      )}
    </div>
  )
}
