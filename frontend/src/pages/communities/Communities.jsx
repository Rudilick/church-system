import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { communities as api } from '../../api'
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus'
import styles from './Communities.module.css'

const communityLabel = c => c.type ? `${c.name}${c.type}` : c.name
const ROLE_LABELS = { leader: '구역장', deputy: '부구역장', member: '구성원' }

export default function Communities() {
  const [tree, setTree] = useState([])
  const [drill, setDrill] = useState([])
  const [leafData, setLeafData] = useState(null)

  const fetchTree = useCallback(() => {
    api.tree().then(r => setTree(r.data)).catch(() => {})
  }, [])

  useEffect(() => { fetchTree() }, [fetchTree])
  useRefreshOnFocus(fetchTree)

  // 전체 계층(공동체+구성원)을 한 번에 받아오므로, id로 바로 찾을 수 있게 평탄화
  const nodeMap = useMemo(() => {
    const map = {}
    const walk = nodes => nodes.forEach(n => { map[n.id] = n; walk(n.children ?? []) })
    walk(tree)
    return map
  }, [tree])

  const childrenOf = id => nodeMap[id]?.children ?? []
  const roots = tree

  const handleTileClick = (c, level) => {
    if (drill[level] === c.id) {
      setDrill(drill.slice(0, level))
      setLeafData(null)
      return
    }
    const newDrill = [...drill.slice(0, level), c.id]
    setDrill(newDrill)
    setLeafData(c.children?.length ? null : c)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>공동체 / 구역 관리</h1>
      </div>

      <div className={styles.stage}>
        {/* 최상위 행 */}
        <div className={styles.rootRow}>
          {roots.map(c => {
            const isActive = drill[0] === c.id
            const isDim = drill.length > 0 && !isActive
            return (
              <div
                key={c.id}
                className={[
                  styles.rootTile,
                  isActive ? styles.rootTileActive : '',
                  isDim ? styles.rootTileDim : '',
                ].join(' ')}
                onClick={() => handleTileClick(c, 0)}
              >
                <div className={styles.rootAvatar}>
                  {c.leader_photo
                    ? <img src={c.leader_photo} alt={c.leader_name} />
                    : <span>{(c.leader_name || c.name)[0]}</span>
                  }
                </div>
                <div className={styles.rootName}>{communityLabel(c)}</div>
                {c.leader_name && <div className={styles.rootLeader}>{c.leader_name}</div>}
                {c.leader_position && <div className={styles.rootPos}>{c.leader_position}</div>}
                {!c.leader_name && <div className={styles.rootNoLeader}>리더 미지정</div>}
              </div>
            )
          })}
        </div>

        {/* 중간 단계 pill */}
        {drill.map((selectedId, levelIdx) => {
          const childList = childrenOf(selectedId)
          if (!childList.length) return null
          const pillClass = styles[`pill${Math.min(levelIdx + 1, 5)}`]

          return (
            <div key={selectedId} className={`${styles.levelPill} ${pillClass}`}>
              {childList.map((c, i) => {
                const isActive = drill[levelIdx + 1] === c.id
                const isDim = drill[levelIdx + 1] !== undefined && !isActive
                return (
                  <div
                    key={c.id}
                    className={[
                      styles.childTile,
                      isActive ? styles.childTileActive : '',
                      isDim ? styles.childTileDim : '',
                    ].join(' ')}
                    style={{ animationDelay: `${i * 55}ms` }}
                    onClick={() => handleTileClick(c, levelIdx + 1)}
                  >
                    <div className={styles.childAvatar}>
                      {c.leader_photo
                        ? <img src={c.leader_photo} alt={c.leader_name} />
                        : <span>{(c.leader_name || c.name)[0]}</span>
                      }
                    </div>
                    <div className={styles.childName}>{communityLabel(c)}</div>
                    {c.leader_name && <div className={styles.childLeader}>{c.leader_name}</div>}
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* 최하위 공동체 — 구성원 인라인 표시 */}
        {leafData && (
          <div
            className={`${styles.levelPill} ${styles[`pill${Math.min(drill.length + 1, 5)}`]}`}
            style={{ flexDirection: 'column', gap: 12 }}
          >
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', padding: '0 4px' }}>
              {communityLabel(leafData)} · 구성원 {leafData.members?.length ?? 0}명
            </div>
            {leafData.members?.length > 0 ? (
              <div className={styles.tiles}>
                {leafData.members.map(m => (
                  <Link key={m.id} to={`/members/${m.id}`} className={styles.tile}>
                    {m.photo_url
                      ? <img src={m.photo_url} alt={m.name} className={styles.tilePhoto} />
                      : <div className={styles.tilePlaceholder}>{m.name[0]}</div>
                    }
                    <span className={styles.tileName}>{m.name}</span>
                    <span className={styles.tileRole}>{ROLE_LABELS[m.role] ?? m.role}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '0.875rem', padding: '8px 4px' }}>구성원이 없습니다.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
