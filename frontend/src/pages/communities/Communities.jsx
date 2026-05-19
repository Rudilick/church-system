import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { communities as api } from '../../api'
import styles from './Communities.module.css'

export default function Communities() {
  const [list, setList] = useState([])
  const [drill, setDrill] = useState([])
  const [tabXs, setTabXs] = useState({})
  const navigate = useNavigate()
  const stageRef = useRef(null)
  const tileRefs = useRef({})

  useEffect(() => {
    api.list().then(r => setList(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!stageRef.current) return
    const stageRect = stageRef.current.getBoundingClientRect()
    const next = {}
    drill.forEach(id => {
      const node = tileRefs.current[id]
      if (node) {
        const r = node.getBoundingClientRect()
        next[id] = r.left - stageRect.left + r.width / 2
      }
    })
    setTabXs(next)
  }, [drill, list])

  const childrenOf = id => list.filter(c => c.parent_id === id)
  const roots = list.filter(c => !c.parent_id)

  const handleTileClick = (c, level) => {
    if (childrenOf(c.id).length === 0) {
      navigate(`/communities/${c.id}`)
      return
    }
    if (drill[level] === c.id) {
      setDrill(drill.slice(0, level))
    } else {
      setDrill([...drill.slice(0, level), c.id])
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>공동체 / 구역 관리</h1>
      </div>

      <div className={styles.stage} ref={stageRef}>
        {/* 최상위 서클 행 — 프레임 없음 */}
        <div className={styles.rootRow}>
          {roots.map(c => {
            const isActive = drill[0] === c.id
            const isDim = drill.length > 0 && !isActive
            return (
              <div
                key={c.id}
                ref={el => { tileRefs.current[c.id] = el }}
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
                <div className={styles.rootName}>{c.name}</div>
                {c.leader_name && <div className={styles.rootLeader}>{c.leader_name}</div>}
                {c.leader_position && <div className={styles.rootPos}>{c.leader_position}</div>}
                {!c.leader_name && <div className={styles.rootNoLeader}>리더 미지정</div>}
              </div>
            )
          })}
        </div>

        {/* n단계 pill 행 */}
        {drill.map((selectedId, levelIdx) => {
          const childList = childrenOf(selectedId)
          if (childList.length === 0) return null
          const pillClass = styles[`pill${Math.min(levelIdx + 1, 4)}`]
          return (
            <div
              key={selectedId}
              className={`${styles.levelPill} ${pillClass}`}
              style={{ '--tab-x': `${tabXs[selectedId] ?? 0}px` }}
            >
              {childList.map((c, i) => {
                const isActive = drill[levelIdx + 1] === c.id
                const isDim = drill[levelIdx + 1] !== undefined && !isActive
                return (
                  <div
                    key={c.id}
                    ref={el => { tileRefs.current[c.id] = el }}
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
                    <div className={styles.childName}>{c.name}</div>
                    {c.leader_name && <div className={styles.childLeader}>{c.leader_name}</div>}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
