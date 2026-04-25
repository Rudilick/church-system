import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { communities as api } from '../../api'
import styles from './Communities.module.css'

const TYPE_LABELS = {
  cell: '셀',
  region: '지역',
  district: '교구',
  community: '공동체',
  women_group: '여전도회',
}
function typeLabel(type) { return TYPE_LABELS[type] || type }

export default function Communities() {
  const navigate = useNavigate()
  const [list, setList] = useState([])
  const [groups, setGroups] = useState({})
  const [openSections, setOpenSections] = useState({})
  const [activeId, setActiveId] = useState(null)

  useEffect(() => {
    api.list().then(r => {
      const data = Array.isArray(r.data) ? r.data : []
      setList(data)
      const grouped = {}
      data.forEach(c => {
        if (!grouped[c.type]) grouped[c.type] = []
        grouped[c.type].push(c)
      })
      setGroups(grouped)
      // 첫 번째 타입 자동 펼침
      const firstType = Object.keys(grouped)[0]
      if (firstType) setOpenSections({ [firstType]: true })
    }).catch(() => {})
  }, [])

  const toggleSection = type => setOpenSections(prev => ({ ...prev, [type]: !prev[type] }))

  const typeOrder = ['cell', 'region', 'district', 'community', 'women_group']
  const sortedTypes = [
    ...typeOrder.filter(t => groups[t]),
    ...Object.keys(groups).filter(t => !typeOrder.includes(t)),
  ]

  // 우측 표시: activeId 선택된 공동체 또는 전체 목록
  const roots = list.filter(c => !c.parent_id)
  const children = id => list.filter(c => c.parent_id === id)

  return (
    <div className={styles.wrap}>
      {/* ── 좌측 infoPanel ── */}
      <div className={styles.infoPanel}>
        <div className={styles.infoPanelHeader}>
          <p className={styles.infoPanelTitle}>공동체 / 구역</p>
        </div>

        {/* 전체 보기 */}
        <div
          className={`${styles.allRow} ${activeId === null ? styles.allRowActive : ''}`}
          onClick={() => setActiveId(null)}
        >
          전체
        </div>

        {sortedTypes.map(type => {
          const items = groups[type] || []
          const isOpen = openSections[type]
          return (
            <div key={type} className={styles.infoSection}>
              <div className={styles.infoSectionHeader} onClick={() => toggleSection(type)}>
                <span>{typeLabel(type)} {items.length}개</span>
                <span>{isOpen ? '▲' : '▼'}</span>
              </div>
              {isOpen && (
                <div className={styles.infoSectionBody}>
                  {items.map(c => (
                    <div
                      key={c.id}
                      className={`${styles.infoRow} ${activeId === c.id ? styles.infoRowActive : ''}`}
                      onClick={() => navigate(`/communities/${c.id}`)}
                    >
                      <span className={styles.infoRowName}>{c.name}</span>
                      {c.leader_name && <span className={styles.infoRowSub}>{c.leader_name}</span>}
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
          <h1 className={styles.contentTitle}>공동체 / 구역 관리</h1>
          <span className={styles.contentCount}>{list.length}개</span>
        </div>

        <div className={styles.gridArea}>
          <div className={styles.grid}>
            {roots.map(c => (
              <div key={c.id} className={styles.groupWrap}>
                <Link to={`/communities/${c.id}`} className={styles.card}>
                  <div className={styles.cardName}>{c.name}</div>
                  <div className={styles.cardType}>{typeLabel(c.type)}</div>
                  {c.leader_name && <div className={styles.leader}>구역장: {c.leader_name}</div>}
                </Link>
                {children(c.id).length > 0 && (
                  <div className={styles.children}>
                    {children(c.id).map(sub => (
                      <Link key={sub.id} to={`/communities/${sub.id}`} className={styles.subCard}>
                        {sub.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
