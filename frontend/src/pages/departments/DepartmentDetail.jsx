import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { departments as api } from '../../api'

export default function DepartmentDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  useEffect(() => { api.get(id).then(r => setData(r.data)).catch(() => {}) }, [id])
  if (!data) return <div>불러오는 중...</div>

  return (
    <div>
      <Link to="/departments" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: 16 }}>← 부서 목록</Link>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 6 }}>{data.name}</h1>
      {data.description && <p style={{ color: '#64748b', marginBottom: 20 }}>{data.description}</p>}

      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
        <div style={{ fontWeight: 600, marginBottom: 16 }}>구성원 {data.members?.length ?? 0}명</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {data.members?.map(m => (
            <Link key={m.id} to={`/members/${m.id}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textDecoration: 'none', color: 'inherit', background: '#f8fafc', borderRadius: 10, padding: '12px 16px', minWidth: 80 }}>
              {m.photo_url
                ? <img src={m.photo_url} alt={m.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#64748b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.2rem' }}>{m.name[0]}</div>
              }
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{m.name}</span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{m.role === 'leader' ? '부장' : '부원'}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
