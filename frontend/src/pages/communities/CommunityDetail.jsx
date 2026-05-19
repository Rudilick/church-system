import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { communities as api } from '../../api'
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus'
import styles from './Communities.module.css'

const ROLE_LABELS = { leader: '구역장', deputy: '부구역장', member: '구성원' }
const communityLabel = c => c.type ? `${c.name}${c.type}` : c.name

export default function CommunityDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)

  const fetchData = useCallback(() => {
    api.get(id).then(r => setData(r.data)).catch(() => {})
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])
  useRefreshOnFocus(fetchData)

  if (!data) return <div>불러오는 중...</div>

  const hasChildren = data.children?.length > 0
  const hasMembers = data.members?.length > 0

  return (
    <div>
      <Link to="/communities" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: 16 }}>← 공동체 목록</Link>

      <div className={styles.detailHeader}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{communityLabel(data)}</h1>
          {data.leader_name && <div style={{ fontSize: '0.875rem', color: '#3b82f6', marginTop: 4 }}>구역장: {data.leader_name}</div>}
        </div>
      </div>

      {hasChildren && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.08)', marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 16 }}>하위 공동체 {data.children.length}개</div>
          <div className={styles.subGrid}>
            {data.children.map(c => (
              <Link key={c.id} to={`/communities/${c.id}`} className={styles.subDetailCard}>
                <div className={styles.subDetailName}>{communityLabel(c)}</div>
                {c.leader_name && <div className={styles.subDetailLeader}>{c.leader_name}</div>}
                <div className={styles.subDetailCount}>{c.member_count ?? 0}명</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {hasMembers && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
          <div style={{ fontWeight: 600, marginBottom: 16 }}>구성원 {data.members.length}명</div>
          <div className={styles.tiles}>
            {data.members.map(m => (
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
        </div>
      )}

      {!hasChildren && !hasMembers && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>구성원이 없습니다.</div>
        </div>
      )}
    </div>
  )
}
