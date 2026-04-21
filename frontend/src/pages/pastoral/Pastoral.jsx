import { useEffect, useState } from 'react'
import { pastoral as api } from '../../api'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'

export default function Pastoral() {
  const [list, setList] = useState([])
  const [form, setForm] = useState({ member_id: '', pastor_id: 1, visit_date: dayjs().format('YYYY-MM-DD'), content: '', is_private: false })
  const [showForm, setShowForm] = useState(false)

  const load = () => api.list().then(r => setList(r.data)).catch(() => {})
  useEffect(() => { load() }, [])

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.visit_date || !form.content) { toast.error('날짜와 내용을 입력하세요.'); return }
    await api.add(form)
    toast.success('심방 기록을 저장했습니다.')
    load()
    setShowForm(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>심방 기록</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}>+ 심방 입력</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.08)', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.82rem', color: '#475569' }}>교인 ID</label>
              <input type="number" value={form.member_id} onChange={e => set('member_id', e.target.value)} style={inp} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.82rem', color: '#475569' }}>날짜</label>
              <input type="date" value={form.visit_date} onChange={e => set('visit_date', e.target.value)} style={inp} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.82rem', color: '#475569' }}>내용</label>
              <textarea rows={4} value={form.content} onChange={e => set('content', e.target.value)} style={{ ...inp, resize: 'vertical' }} />
            </div>
          </div>
          <button type="submit" style={{ marginTop: 12, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer' }}>저장</button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {list.map(v => (
          <div key={v.id} style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>{v.member_name ?? '교인 미지정'}</span>
              <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{v.visit_date} · {v.pastor_name}</span>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#334155', whiteSpace: 'pre-wrap' }}>{v.content}</p>
            {v.is_private && <span style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: 8, display: 'block' }}>🔒 담임목사 전용</span>}
          </div>
        ))}
        {list.length === 0 && <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>심방 기록이 없습니다.</div>}
      </div>
    </div>
  )
}

const inp = { border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit' }
