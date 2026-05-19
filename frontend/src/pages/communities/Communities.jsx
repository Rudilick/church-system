import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { communities as api } from '../../api'
import styles from './Communities.module.css'

export default function Communities() {
  const [list, setList] = useState([])
  const [drill, setDrill] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    api.list().then(r => setList(r.data)).catch(() => {})
  }, [])

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

      <div className={styles.stage}>
        {/* 최상위 행 — 선택된 타일은 active, 나머지는 dim */}
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
                <div className={styles.rootName}>{c.name}</div>
                {c.leader_name && <div className={styles.rootLeader}>{c.leader_name}</div>}
                {c.leader_position && <div className={styles.rootPos}>{c.leader_position}</div>}
                {!c.leader_name && <div className={styles.rootNoLeader}>리더 미지정</div>}
              </div>
            )
          })}
        </div>

        {/* n단계 pill — 자식 타일들만 */}
        {drill.map((selectedId, levelIdx) => {
          const childList = childrenOf(selectedId)
          if (!childList.length) return null
          const pillClass = styles[`pill${Math.min(levelIdx + 1, 4)}`]

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
