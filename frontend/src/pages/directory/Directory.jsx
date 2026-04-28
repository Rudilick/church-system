import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { members as memberApi, communities as communityApi } from '../../api'
import dayjs from 'dayjs'

const PASTORAL     = ['목사', '전도사', '강도사', '목회자', '선교사', '사모']
const DEACON_ROLES = ['장로', '권사', '안수집사', '집사']
const EDU_KEYWORDS = ['유아부', '유치부', '유년부', '초등부', '청소년부', '중등부', '고등부', '교육부']

function getPositionLabel(member) {
  const pos = (member.position || '').trim()

  if (PASTORAL.some(p => pos.includes(p))) return pos
  if (DEACON_ROLES.some(p => pos === p)) return pos

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

const TYPE_LABELS = {
  cell: '셀',
  region: '지역',
  district: '교구',
  community: '공동체',
  women_group: '여전도회',
}

function typeLabel(type) {
  return TYPE_LABELS[type] || type
}

const CARD_STYLE = {
  background: '#fff',
  borderRadius: 12,
  padding: '16px 12px',
  textAlign: 'center',
  boxShadow: '0 1px 3px rgba(0,0,0,.08)',
  transition: 'box-shadow 0.15s, transform 0.15s',
  cursor: 'pointer',
}

export default function Directory() {
  const [members, setMembers] = useState([])
  const [total, setTotal] = useState(0)
  const [groups, setGroups] = useState({})        // { type: [community, ...] }
  const [openSections, setOpenSections] = useState({})
  const [activeFilter, setActiveFilter] = useState(null)  // null = 전체, communityId = 필터
  const [activeLabel, setActiveLabel] = useState('전체')
  const [q, setQ] = useState('')

  // 공동체 목록 로드 → type별 그룹화
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

  // 멤버 로드
  const load = useCallback(async () => {
    const params = { type: 'active', limit: 200 }
    if (activeFilter) params.community_id = activeFilter
    if (q) params.q = q
    const res = await memberApi.list(params)
    setMembers(res.data.data || [])
    setTotal(res.data.total || 0)
  }, [activeFilter, q])

  useEffect(() => { load() }, [load])

  const selectAll = () => {
    setActiveFilter(null)
    setActiveLabel('전체')
  }

  const selectCommunity = (id, name) => {
    setActiveFilter(id)
    setActiveLabel(name)
  }

  const toggleSection = type => {
    setOpenSections(prev => ({ ...prev, [type]: !prev[type] }))
  }

  const typeOrder = ['cell', 'region', 'district', 'community', 'women_group']
  const sortedTypes = [
    ...typeOrder.filter(t => groups[t]),
    ...Object.keys(groups).filter(t => !typeOrder.includes(t)),
  ]

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 96px)', overflow: 'hidden', margin: '-24px', padding: 0 }}>
      {/* 왼쪽 탭 패널 */}
      <div style={{
        width: 210, flexShrink: 0,
        borderRight: '1px solid #e2e8f0',
        overflowY: 'auto',
        background: '#fff',
        paddingTop: 16,
      }}>
        <div style={{ padding: '0 12px 8px', fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          스마트 요람
        </div>

        {/* 전체 탭 */}
        <TabItem
          label="전체"
          count={null}
          active={activeFilter === null}
          onClick={selectAll}
        />

        {/* type별 섹션 */}
        {sortedTypes.map(type => {
          const items = groups[type] || []
          const isOpen = openSections[type]
          return (
            <div key={type}>
              <div
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: '8px 12px', cursor: 'pointer',
                  fontSize: '0.82rem', fontWeight: 600, color: '#475569',
                  userSelect: 'none',
                }}
                onClick={() => toggleSection(type)}
              >
                <span style={{ flex: 1 }}>{typeLabel(type)}</span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{isOpen ? '▲' : '▼'}</span>
              </div>
              {isOpen && items.map(c => (
                <TabItem
                  key={c.id}
                  label={c.name}
                  count={null}
                  active={activeFilter === c.id}
                  onClick={() => selectCommunity(c.id, c.name)}
                  indent
                />
              ))}
            </div>
          )
        })}
      </div>

      {/* 오른쪽 콘텐츠 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 24px', borderBottom: '1px solid #e2e8f0',
          flexShrink: 0, background: '#fff',
        }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{activeLabel}</h1>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{total}명</span>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="이름 검색..."
            style={{
              marginLeft: 'auto',
              border: '1px solid #e2e8f0', borderRadius: 8,
              padding: '6px 12px', fontSize: '0.88rem',
              outline: 'none', width: 200,
            }}
          />
        </div>

        {/* 멤버 그리드 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {members.length === 0
            ? <div style={{ textAlign: 'center', color: '#94a3b8', padding: 60 }}>교인이 없습니다.</div>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 14 }}>
                {members.map(m => (
                  <Link key={m.id} to={`/members/${m.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={CARD_STYLE}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.08)'; e.currentTarget.style.transform = '' }}
                    >
                      {m.photo_url
                        ? <img src={m.photo_url} alt={m.name} style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', marginBottom: 8 }} />
                        : <div style={{ width: 60, height: 60, borderRadius: '50%', background: m.gender === 'M' ? '#3b82f6' : '#ec4899', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.3rem', margin: '0 auto 8px' }}>
                            {m.name[0]}
                          </div>
                      }
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                        {m.name} <span style={{ fontWeight: 400, fontSize: '0.75rem', color: '#64748b' }}>{getPositionLabel(m)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}

function TabItem({ label, count, active, onClick, indent }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: `7px 12px 7px ${indent ? 24 : 12}px`,
        cursor: 'pointer',
        fontSize: '0.82rem',
        fontWeight: active ? 600 : 400,
        color: active ? '#3b82f6' : '#475569',
        background: active ? '#eff6ff' : 'transparent',
        borderRight: active ? '3px solid #3b82f6' : '3px solid transparent',
        transition: 'all 0.12s',
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      {count != null && (
        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{count}</span>
      )}
    </div>
  )
}
