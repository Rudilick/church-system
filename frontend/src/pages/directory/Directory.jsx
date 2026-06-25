import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { members as memberApi, communities as communityApi, positions as positionsApi } from '../../api'
import { genderColor, isRetired } from '../../utils'
import PageShell from '../../components/PageShell'
import styles from './Directory.module.css'

const EDU_KEYWORDS = ['유아부', '유치부', '유년부', '초등부', '청소년부', '중등부', '고등부', '교육부']

function makeGetPositionLabel(posList) {
  const pastoralNames = posList.filter(p => p.category === 'pastoral').map(p => p.name)
  const deaconNames   = posList.filter(p => p.category === 'deacon').map(p => p.name)
  return function getPositionLabel(member) {
    const pos = (member.position || '').trim()
    const retired = isRetired(member.birth_date)
    if (pastoralNames.some(p => pos.includes(p))) return retired ? `은퇴${pos}` : pos
    if (deaconNames.includes(pos)) return retired ? `은퇴${pos}` : pos
    const communities = Array.isArray(member.communities) ? member.communities : []
    const inYouth = communities.some(c => (c.name || '').includes('청년'))
    if (inYouth) return '청년'
    const inEdu = communities.some(c => EDU_KEYWORDS.some(d => (c.name || '').includes(d)))
    const isTeacher = communities.some(c =>
      EDU_KEYWORDS.some(d => (c.name || '').includes(d)) &&
      (c.role === 'teacher' || c.role === 'leader')
    )
    if (inEdu && !isTeacher) return '학생'
    return '성도'
  }
}

const TYPE_LABELS = {
  cell: '셀',
  region: '지역',
  district: '교구',
  community: '공동체',
  women_group: '여전도회',
}
function typeLabel(type) { return TYPE_LABELS[type] || type }

const TYPE_ORDER = ['cell', 'region', 'district', 'community', 'women_group']

export default function Directory() {
  const [members, setMembers]   = useState([])
  const [total, setTotal]       = useState(0)
  const [groups, setGroups]     = useState({})
  const [activeType, setActiveType]     = useState(null)   // null = 전체
  const [activeFilter, setActiveFilter] = useState(null)   // communityId | null
  const [q, setQ]               = useState('')
  const [getPositionLabel, setGetPositionLabel] = useState(() => makeGetPositionLabel([]))

  useEffect(() => {
    positionsApi.list().then(r => {
      setGetPositionLabel(() => makeGetPositionLabel(Array.isArray(r.data) ? r.data : []))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    communityApi.list().then(r => {
      const list = Array.isArray(r.data) ? r.data : []
      const grouped = {}
      list.forEach(c => {
        if (!grouped[c.type]) grouped[c.type] = []
        grouped[c.type].push(c)
      })
      setGroups(grouped)
    }).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    const params = { type: 'active', limit: 200 }
    if (activeFilter) params.community_id = activeFilter
    if (q) params.q = q
    const res = await memberApi.list(params)
    setMembers(res.data.data || [])
    setTotal(res.data.total || 0)
  }, [activeFilter, q])

  useEffect(() => { load() }, [load])

  const sortedTypes = [
    ...TYPE_ORDER.filter(t => groups[t]),
    ...Object.keys(groups).filter(t => !TYPE_ORDER.includes(t)),
  ]

  const handleTypeClick = type => {
    if (activeType === type) { setActiveType(null); setActiveFilter(null) }
    else { setActiveType(type); setActiveFilter(null) }
  }

  const handleChipClick = id => {
    setActiveFilter(prev => prev === id ? null : id)
  }

  const currentChips = activeType ? (groups[activeType] || []) : []

  return (
    <PageShell title="스마트 요람">

      {/* 1차탭: 전체 + 공동체 타입 */}
      <div className={styles.tabRow}>
        <button
          className={`${styles.tabBtn} ${!activeType ? styles.tabBtnActive : ''}`}
          onClick={() => { setActiveType(null); setActiveFilter(null) }}
        >전체</button>
        {sortedTypes.map(type => (
          <button
            key={type}
            className={`${styles.tabBtn} ${activeType === type ? styles.tabBtnActive : ''}`}
            onClick={() => handleTypeClick(type)}
          >{typeLabel(type)}</button>
        ))}
      </div>

      {/* 2차칩: 선택된 타입의 공동체 목록 */}
      {currentChips.length > 0 && (
        <div className={styles.typeChipRow}>
          {currentChips.map(c => (
            <button
              key={c.id}
              className={`${styles.typeChip} ${activeFilter === c.id ? styles.typeChipActive : ''}`}
              onClick={() => handleChipClick(c.id)}
            >{c.name}</button>
          ))}
        </div>
      )}

      {/* 검색 + 카운트 바 */}
      <div className={styles.toolbar}>
        <span className={styles.count}>
          {activeFilter
            ? currentChips.find(c => c.id === activeFilter)?.name
            : activeType ? typeLabel(activeType) : '전체'}
          <em>{total}명</em>
        </span>
        <input
          className={styles.search}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="이름 검색…"
        />
      </div>

      {/* 멤버 그리드 */}
      <div className={styles.grid}>
        {members.length === 0
          ? <div className={styles.empty}>교인이 없습니다.</div>
          : members.map(m => (
            <Link key={m.id} to={`/members/${m.id}`} className={styles.card}>
              {m.photo_url
                ? <img src={m.photo_url} alt={m.name} className={styles.cardPhoto} />
                : <div className={styles.cardInitial} style={{ background: genderColor(m.gender) }}>
                    {m.name[0]}
                  </div>
              }
              <div className={styles.cardName}>{m.name}</div>
              <div className={styles.cardRole}>{getPositionLabel(m)}</div>
            </Link>
          ))
        }
      </div>
    </PageShell>
  )
}
