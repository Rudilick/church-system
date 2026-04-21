import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { departments as api } from '../../api'

export default function Departments() {
  const [list, setList] = useState([])
  useEffect(() => { api.list().then(r => setList(r.data)) }, [])

  return (
    <div>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 20 }}>부서 관리</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 16 }}>
        {list.map(d => (
          <Link key={d.id} to={`/departments/${d.id}`} style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', textDecoration: 'none', color: 'inherit', boxShadow: '0 1px 3px rgba(0,0,0,.08)', display: 'block' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>🏢 {d.name}</div>
            {d.description && <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{d.description}</div>}
          </Link>
        ))}
        {list.length === 0 && <div style={{ color: '#94a3b8', gridColumn: '1/-1', textAlign: 'center', padding: 40 }}>등록된 부서가 없습니다.</div>}
      </div>
    </div>
  )
}
