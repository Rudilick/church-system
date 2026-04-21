import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { communities as api } from '../../api'
import styles from './Communities.module.css'

const ROLE_LABELS = { leader: '구역장', deputy: '부구역장', member: '구성원' }

export default function CommunityDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get(id).then(r => setData(r.data)).catch(() => {})
  }, [id])

  if (!data) return <div>불러오는 중...</div>

  return (
    <div>
      <Link to="/communities" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: 16 }}>← 공동체 목록</Link>

      <div className={styles.detailHeader}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{data.name}</h1>
          {data.type && <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{data.type}</span>}
          {data.leader_name && <div style={{ fontSize: '0.875rem', color: '#3b82f6', marginTop: 4 }}>구역장: {data.leader_name}</div>}
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
        <div style={{ fontWeight: 600, marginBottom: 16 }}>구성원 {data.members?.length ?? 0}명</div>
        <div className={styles.tiles}>
          {data.members?.map(m => (
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
    </div>
  )
}
