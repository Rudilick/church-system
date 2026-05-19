import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { communities as api, members as memberApi } from '../../api'
import styles from './Communities.module.css'

export default function Communities() {
  const [list, setList] = useState([])
  const [editTarget, setEditTarget] = useState(null)
  const [selectedRoot, setSelectedRoot] = useState(null)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [saving, setSaving] = useState(false)
  const searchRef = useRef(null)

  const load = () => api.list().then(r => setList(r.data)).catch(() => {})

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!editTarget) return
    setTimeout(() => searchRef.current?.focus(), 50)
  }, [editTarget])

  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    memberApi.list({ q: search, limit: 8 }).then(r => setResults(r.data.data || []))
  }, [search])

  const openEdit = (e, c) => {
    e.preventDefault()
    e.stopPropagation()
    setEditTarget(c)
    setSearch('')
    setResults([])
  }

  const selectLeader = async (member) => {
    if (!editTarget) return
    setSaving(true)
    try {
      await api.addMember(editTarget.id, { member_id: member.id, role: 'leader' })
      await load()
      setEditTarget(null)
    } catch {}
    setSaving(false)
  }

  const removeLeader = async () => {
    if (!editTarget || !editTarget.leader_id) return
    setSaving(true)
    try {
      await api.removeMember(editTarget.id, editTarget.leader_id)
      await load()
      setEditTarget(null)
    } catch {}
    setSaving(false)
  }

  const roots = list.filter(c => !c.parent_id)
  const children = id => list.filter(c => c.parent_id === id)

  const handleRootClick = (c) => {
    setSelectedRoot(prev => prev?.id === c.id ? null : c)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>공동체 / 구역 관리</h1>
      </div>

      <div className={styles.stage}>
        {/* 최상위 서클 행 */}
        <div className={styles.rootRow}>
          {roots.map(c => (
            <div
              key={c.id}
              className={[
                styles.rootTile,
                selectedRoot?.id === c.id ? styles.rootTileActive : '',
                selectedRoot && selectedRoot.id !== c.id ? styles.rootTileDim : '',
              ].join(' ')}
              onClick={() => handleRootClick(c)}
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
              <button
                className={styles.rootEditBtn}
                onClick={e => openEdit(e, c)}
                title="리더 지정"
              >⚙</button>
            </div>
          ))}
        </div>

        {/* 하위 서클 행 */}
        {selectedRoot && children(selectedRoot.id).length > 0 && (
          <div className={styles.childSection}>
            <div className={styles.childSectionLabel}>{selectedRoot.name} 하위 공동체</div>
            <div className={styles.childRow}>
              {children(selectedRoot.id).map((c, i) => (
                <Link
                  key={c.id}
                  to={`/communities/${c.id}`}
                  className={styles.childTile}
                  style={{ animationDelay: `${i * 55}ms` }}
                >
                  <div className={styles.childAvatar}>
                    {c.leader_photo
                      ? <img src={c.leader_photo} alt={c.leader_name} />
                      : <span>{(c.leader_name || c.name)[0]}</span>
                    }
                  </div>
                  <div className={styles.childName}>{c.name}</div>
                  {c.leader_name && <div className={styles.childLeader}>{c.leader_name}</div>}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 하위 없는 경우 */}
        {selectedRoot && children(selectedRoot.id).length === 0 && (
          <div className={styles.childSection}>
            <Link to={`/communities/${selectedRoot.id}`} className={styles.goDetailLink}>
              {selectedRoot.name} 구성원 보기 →
            </Link>
          </div>
        )}
      </div>

      {/* 리더 지정 모달 */}
      {editTarget && (
        <div className={styles.modalBack} onClick={() => setEditTarget(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>{editTarget.name} — 셀장 지정</div>

            {editTarget.leader_name && (
              <div className={styles.currentLeader}>
                <span>현재 셀장: <strong>{editTarget.leader_name}</strong></span>
                <button className={styles.removeLeaderBtn} onClick={removeLeader} disabled={saving}>
                  해제
                </button>
              </div>
            )}

            <input
              ref={searchRef}
              className={styles.leaderSearch}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="교인 이름 검색..."
            />

            {results.length > 0 && (
              <div className={styles.leaderResults}>
                {results.map(m => (
                  <div key={m.id} className={styles.leaderResult} onClick={() => selectLeader(m)}>
                    <div className={styles.leaderResultAvatar}>
                      {m.photo_url
                        ? <img src={m.photo_url} alt={m.name} />
                        : <span>{(m.name || '?')[0]}</span>
                      }
                    </div>
                    <div>
                      <div className={styles.leaderResultName}>{m.name}</div>
                      {m.position && <div className={styles.leaderResultPos}>{m.position}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setEditTarget(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
