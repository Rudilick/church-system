import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { members as api } from '../../api'
import dayjs from 'dayjs'

export default function Directory() {
  const [data, setData] = useState([])
  const [q, setQ] = useState('')
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    const res = await api.list({ q, type: 'active', limit: 100 })
    setData(res.data.data)
    setTotal(res.data.total)
  }, [q])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>스마트 요람</h1>
        <span style={{ color: '#64748b', fontSize: '0.875rem', alignSelf: 'center' }}>총 {total}명</span>
      </div>

      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="이름 검색..."
        style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: '0.9rem', outline: 'none', width: 240, marginBottom: 20 }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
        {data.map(m => (
          <Link key={m.id} to={`/members/${m.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: '16px 12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.08)', transition: 'box-shadow 0.15s' }}>
              {m.photo_url
                ? <img src={m.photo_url} alt={m.name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', marginBottom: 8 }} />
                : <div style={{ width: 64, height: 64, borderRadius: '50%', background: m.gender === 'M' ? '#3b82f6' : '#ec4899', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.4rem', margin: '0 auto 8px' }}>{m.name[0]}</div>
              }
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>{m.name}</div>
              {m.birth_date && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{dayjs().diff(dayjs(m.birth_date), 'year')}세</div>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
