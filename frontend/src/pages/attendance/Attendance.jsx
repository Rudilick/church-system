import { useEffect, useState, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { attendance as api, members as memberApi, communities as communityApi } from '../../api'
import { genderColor } from '../../utils'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import styles from './Attendance.module.css'
import WeekPicker, { toThisSunday, weekLabel } from '../../components/WeekPicker'

const shortName = s => s.name.replace('주일 ', '').replace(' 예배', '예배')

function AttendTile({ a, onRemove }) {
  return (
    <div className={styles.attendeeTile}>
      <button className={styles.removeBtnTile} onClick={() => onRemove(a.id)}>×</button>
      {a.photo_url
        ? <img src={a.photo_url} alt={a.name} className={styles.tileThumb} />
        : <div className={styles.thumbPlaceholder}
               style={{ width: 52, height: 52, fontSize: '1.2rem',
                        background: genderColor(a.gender) }}>
            {a.name[0]}
          </div>
      }
      <span className={`${styles.tileMethod} ${a.method === 'qr' ? styles.tileMethodQr : ''}`}>
        {a.method === 'qr' ? 'QR' : '수동'}
      </span>
      <span className={styles.attendeeName}>{a.name}</span>
    </div>
  )
}

export default function Attendance() {
  const [services, setServices]         = useState([])
  const [serviceId, setServiceId]       = useState(null)
  const [date, setDate]                 = useState(toThisSunday)
  const [showPicker, setShowPicker]     = useState(false)
  const [list, setList]                 = useState([])
  const [lastWeekInfo, setLastWeekInfo] = useState(null)   // { count, date }
  const [copying, setCopying]           = useState(false)
  const [cells, setCells]               = useState([])
  const [search, setSearch]             = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showDrop, setShowDrop]         = useState(false)
  const searchRef = useRef(null)
  const debounceRef = useRef(null)

  // 서비스 목록 + 셀 목록 초기 로드
  useEffect(() => {
    api.services().then(r => {
      const sunday = r.data.filter(s => s.day_of_week === 0)
      setServices(sunday)
      if (sunday.length) setServiceId(sunday[0].id)
    })
    communityApi.list().then(r => setCells(Array.isArray(r.data) ? r.data : [])).catch(() => {})
  }, [])

  // 출석 목록 + 지난주 정보 로드
  useEffect(() => {
    if (!serviceId || !date) return
    api.list({ service_id: serviceId, date }).then(r => setList(r.data))
    const lastWeekDate = dayjs(date).subtract(7, 'day').format('YYYY-MM-DD')
    api.list({ service_id: serviceId, date: lastWeekDate })
       .then(r => setLastWeekInfo({ count: r.data.length, date: lastWeekDate }))
  }, [serviceId, date])

  // 교인 검색 debounce
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); setShowDrop(false); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      memberApi.list({ q: search, limit: 8 }).then(r => {
        const existing = new Set(list.map(a => a.member_id))
        setSearchResults((r.data.data || []).filter(m => !existing.has(m.id)))
        setShowDrop(true)
      })
    }, 300)
  }, [search, list])

  // 검색 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = e => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleRemove = async id => {
    await api.remove(id)
    setList(l => l.filter(a => a.id !== id))
    toast.success('출석 취소')
  }

  const handleAdd = async member => {
    try {
      await api.add({ member_id: member.id, service_id: serviceId, date })
      setSearch(''); setShowDrop(false)
      toast.success(`${member.name} 출석 등록`)
      api.list({ service_id: serviceId, date }).then(r => setList(r.data))
    } catch {
      toast.error('이미 등록되었거나 오류가 발생했습니다.')
    }
  }

  const { sortedGroups, ungrouped } = useMemo(() => {
    const cellOrder = Object.fromEntries(cells.map((c, i) => [c.name, i]))
    const groups = {}
    const ung = []
    list.forEach(a => {
      if (a.community_name) {
        (groups[a.community_name] ??= []).push(a)
      } else {
        ung.push(a)
      }
    })
    const sortedGroups = Object.entries(groups)
      .sort(([a], [b]) => (cellOrder[a] ?? 999) - (cellOrder[b] ?? 999))
      .map(([name, members]) => ({ name, members }))
    return { sortedGroups, ungrouped: ung }
  }, [list, cells])

  const handleCopyLastWeek = async () => {
    if (!lastWeekInfo?.count) return
    setCopying(true)
    try {
      const r = await api.copyLastWeek({ service_id: serviceId, date })
      toast.success(`${r.data.copied}명 불러왔습니다.`)
      api.list({ service_id: serviceId, date }).then(res => setList(res.data))
    } catch {
      toast.error('불러오기 실패')
    } finally {
      setCopying(false)
    }
  }

  const activeService = services.find(s => s.id === serviceId)

  return (
    <div className={styles.pageWrap}>

      {/* 좌측 사이드바 */}
      <div className={styles.sidebar}>
        <div className={styles.sideLabel}>주일 예배</div>
        {services.map(s => (
          <button
            key={s.id}
            className={s.id === serviceId ? styles.sideTabActive : styles.sideTab}
            onClick={() => setServiceId(s.id)}
          >
            {shortName(s)}
          </button>
        ))}
      </div>

      {/* 메인 콘텐츠 */}
      <div className={styles.content}>

        {/* 상단 바 */}
        <div className={styles.topBar}>
          <div className={styles.weekNavWrap}>
            <div className={styles.weekNav}>
              <button className={styles.weekNavBtn}
                onClick={() => setDate(d => dayjs(d).subtract(1, 'week').format('YYYY-MM-DD'))}>◀</button>
              <button className={styles.weekLabel} onClick={() => setShowPicker(p => !p)}>{weekLabel(date)}</button>
              <button className={styles.weekNavBtn}
                onClick={() => setDate(d => dayjs(d).add(1, 'week').format('YYYY-MM-DD'))}>▶</button>
            </div>
            {showPicker && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => setShowPicker(false)} />
                <WeekPicker current={date} onSelect={d => { setDate(d); setShowPicker(false) }} />
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/attendance/qr" className={styles.btn}>QR 체크인</Link>
            <Link to="/attendance/stats" className={styles.btnOutline}>통계</Link>
          </div>
        </div>

        {/* 지난주 불러오기 박스 */}
        <div className={styles.copyBox}>
          <div className={styles.copyBoxInfo}>
            <span className={styles.copyBoxIcon}>📅</span>
            <span>
              지난주({lastWeekInfo ? dayjs(lastWeekInfo.date).format('MM.DD') : '-'}) ·{' '}
              <strong>{activeService ? shortName(activeService) : ''}</strong> ·{' '}
              {lastWeekInfo?.count ?? 0}명 출석
            </span>
          </div>
          <button
            className={styles.copyBtn}
            onClick={handleCopyLastWeek}
            disabled={copying || !lastWeekInfo?.count}
          >
            {copying ? '불러오는 중...' : '불러오기'}
          </button>
        </div>

        {/* 출석 현황 + 검색 */}
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>
            출석 현황
            <span className={styles.countBadge}>{list.length}명</span>
          </span>
          <div className={styles.searchWrap} ref={searchRef}>
            <input
              className={styles.searchInput}
              placeholder="🔍 교인 이름 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => searchResults.length && setShowDrop(true)}
            />
            {showDrop && searchResults.length > 0 && (
              <div className={styles.searchDropdown}>
                {searchResults.map(m => (
                  <div key={m.id} className={styles.searchItem} onClick={() => handleAdd(m)}>
                    <div className={styles.searchThumb}
                         style={{ background: genderColor(m.gender) }}>
                      {m.photo_url
                        ? <img src={m.photo_url} alt={m.name} />
                        : m.name[0]}
                    </div>
                    <span className={styles.searchName}>{m.name}</span>
                    {m.position && <span className={styles.searchPos}>{m.position}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 출석자 목록 */}
        <div className={styles.card}>
          <div className={styles.cellGroups}>
            {sortedGroups.map(({ name, members }) => (
              <div key={name} className={styles.cellGroup}>
                <span className={styles.cellGroupLabel}>{name}</span>
                <div className={styles.attendeeGrid}>
                  {members.map(a => <AttendTile key={a.id} a={a} onRemove={handleRemove} />)}
                </div>
              </div>
            ))}
            {ungrouped.length > 0 && (
              <div className={styles.attendeeGrid}>
                {ungrouped.map(a => <AttendTile key={a.id} a={a} onRemove={handleRemove} />)}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
