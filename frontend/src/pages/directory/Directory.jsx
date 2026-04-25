import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { members as memberApi, communities as communityApi } from '../../api'
import dayjs from 'dayjs'
import styles from './Directory.module.css'

const TYPE_LABELS = {
  cell: '셀',
  region: '지역',
  district: '교구',
  community: '공동체',
  women_group: '여전도회',
}
function typeLabel(type) { return TYPE_LABELS[type] || type }

export default function Directory() {
  const [searchParams] = useSearchParams()
  const cidParam = searchParams.get('cid')

  const [members, setMembers] = useState([])
  const [total, setTotal] = useState(0)
  const [groups, setGroups] = useState({})
  const [openSections, setOpenSections] = useState({})
  const [activeFilter, setActiveFilter] = useState(null)
  const [activeLabel, setActiveLabel] = useState('전체')
  const [q, setQ] = useState('')

  useEffect(() => {
    communityApi.list().then(r => {
      const list = Array.isArray(r.data) ? r.data : []
      const grouped = {}
      list.forEach(c => {
        if (!grouped[c.type]) grouped[c.type] = []
        grouped[c.type].push(c)
      })
      setGroups(grouped)

      if (cidParam) {
        const found = list.find(c => String(c.id) === String(cidParam))
        if (found) {
          setActiveFilter(found.id)
          setActiveLabel(found.name)
          setOpenSections(prev => ({ ...prev, [found.type]: true }))
        }
      }
    }).catch(() => {})
  }, [cidParam])

  const load = useCallback(async () => {
    const params = { type: 'active', limit: 200 }
    if (activeFilter) params.community_id = activeFilter
    if (q) params.q = q
    const res = await memberApi.list(params)
    setMembers(res.data.data || [])
    setTotal(res.data.total || 0)
  }, [activeFilter, q])

  useEffect(() => { load() }, [load])

  const selectAll = () => { setActiveFilter(null); setActiveLabel('전체') }
  const selectCommunity = (id, name) => { setActiveFilter(id); setActiveLabel(name) }
  const toggleSection = type => setOpenSections(prev => ({ ...prev, [type]: !prev[type] }))

  const typeOrder = ['cell', 'region', 'district', 'community', 'women_group']
  const sortedTypes = [
    ...typeOrder.filter(t => groups[t]),
    ...Object.keys(groups).filter(t => !typeOrder.includes(t)),
  ]

  return (
    <div className={styles.wrap}>
      {/* ── 좌측 infoPanel ── */}
      <div className={styles.infoPanel}>
        <div className={styles.infoPanelHeader}>
          <p className={styles.infoPanelTitle}>스마트 요람</p>
        </div>

        {/* 전체 */}
        <div
          className={`${styles.allRow} ${activeFilter === null ? styles.allRowActive : ''}`}
          onClick={selectAll}
        >
          전체
        </div>

        {/* type별 섹션 */}
        {sortedTypes.map(type => {
          const items = groups[type] || []
          const isOpen = openSections[type]
          return (
            <div key={type} className={styles.infoSection}>
              <div className={styles.infoSectionHeader} onClick={() => toggleSection(type)}>
                <span>{typeLabel(type)}</span>
                <span>{isOpen ? '▲' : '▼'}</span>
              </div>
              {isOpen && (
                <div className={styles.infoSectionBody}>
                  {items.map(c => (
                    <div
                      key={c.id}
                      className={`${styles.infoRow} ${activeFilter === c.id ? styles.infoRowActive : ''}`}
                      onClick={() => selectCommunity(c.id, c.name)}
                    >
                      {c.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── 우측 콘텐츠 ── */}
      <div className={styles.contentArea}>
        <div className={styles.contentHeader}>
          <h1 className={styles.contentTitle}>{activeLabel}</h1>
          <span className={styles.contentCount}>{total}명</span>
          <input
            className={styles.searchInput}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="이름 검색..."
          />
        </div>

        <div className={styles.memberGrid}>
          {members.length === 0
            ? <div className={styles.empty}>교인이 없습니다.</div>
            : (
              <div className={styles.grid}>
                {members.map(m => (
                  <Link key={m.id} to={`/members/${m.id}`} className={styles.memberCard}>
                    {m.photo_url
                      ? <img src={m.photo_url} alt={m.name} className={styles.memberPhoto} />
                      : <div
                          className={styles.memberAvatar}
                          style={{ background: m.gender === 'M' ? '#3b82f6' : '#ec4899' }}
                        >
                          {m.name[0]}
                        </div>
                    }
                    <div className={styles.memberName}>{m.name}</div>
                    {m.birth_date && <div className={styles.memberAge}>{dayjs().diff(dayjs(m.birth_date), 'year')}세</div>}
                    {m.position && <div className={styles.memberPos}>{m.position}</div>}
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
