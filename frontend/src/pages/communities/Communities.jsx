import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { communities as api, members as memberApi } from '../../api'
import styles from './Communities.module.css'

export default function Communities() {
  const [list, setList] = useState([])
  const [editTarget, setEditTarget] = useState(null) // community being edited
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>공동체 / 구역 관리</h1>
      </div>

      <div className={styles.grid}>
        {roots.map(c => (
          <div key={c.id} className={styles.groupWrap}>
            <div style={{ position: 'relative' }}>
              <Link to={`/communities/${c.id}`} className={styles.card}>
                <div className={styles.cardName}>{c.name}</div>
                <div className={styles.cardType}>{c.type ?? ''}</div>
                {c.leader_name && (
                  <div className={styles.leaderBlock}>
                    {c.leader_photo
                      ? <img src={c.leader_photo} alt={c.leader_name} className={styles.leaderPhoto} />
                      : <div className={styles.leaderAvatar} style={{ background: '#3b82f6' }}>
                          {c.leader_name[0]}
                        </div>
                    }
                    <div className={styles.leaderInfo}>
                      <span className={styles.leaderName}>{c.leader_name}</span>
                      {c.leader_position && (
                        <span className={styles.leaderPos}>{c.leader_position}</span>
                      )}
                    </div>
                  </div>
                )}
                {!c.leader_name && (
                  <div className={styles.noLeader}>셀장 미지정</div>
                )}
              </Link>
            </div>
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
