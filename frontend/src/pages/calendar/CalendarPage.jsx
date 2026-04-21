import { useEffect, useState } from 'react'
import { calendar as api, departments as deptApi } from '../../api'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'

export default function CalendarPage() {
  const [events, setEvents] = useState([])
  const [departments, setDepartments] = useState([])
  const [deptFilter, setDeptFilter] = useState('')
  const [month, setMonth] = useState(dayjs().startOf('month'))
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', department_id: '', location: '', start_at: '', end_at: '', recurrence_rule: '', created_by: 1 })

  const from = month.format('YYYY-MM-DD')
  const to   = month.endOf('month').format('YYYY-MM-DD')

  const load = () => {
    const params = { from, to }
    if (deptFilter) params.department_id = deptFilter
    api.list(params).then(r => setEvents(r.data)).catch(() => {})
  }

  useEffect(() => { deptApi.list().then(r => setDepartments(r.data)) }, [])
  useEffect(() => { load() }, [month, deptFilter])

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.title || !form.start_at) { toast.error('제목과 시작 시간은 필수입니다.'); return }
    await api.add({ ...form, department_id: form.department_id || null, end_at: form.end_at || form.start_at })
    toast.success('일정을 추가했습니다.')
    load()
    setShowForm(false)
  }

  const grouped = {}
  events.forEach(e => {
    const d = dayjs(e.start_at).format('YYYY-MM-DD')
    if (!grouped[d]) grouped[d] = []
    grouped[d].push(e)
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>스마트 캘린더</h1>
        <button onClick={() => setShowForm(!showForm)} style={btnStyle}>+ 일정 추가</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <button onClick={() => setMonth(m => m.subtract(1, 'month'))} style={navBtn}>◀</button>
        <span style={{ fontWeight: 600, minWidth: 100, textAlign: 'center' }}>{month.format('YYYY년 MM월')}</span>
        <button onClick={() => setMonth(m => m.add(1, 'month'))} style={navBtn}>▶</button>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={selectStyle}>
          <option value="">전체 부서</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.08)', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            <div style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lblStyle}>제목 *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inpStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lblStyle}>부서</label>
              <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} style={inpStyle}>
                <option value="">없음</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lblStyle}>장소</label>
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={inpStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lblStyle}>반복 규칙 (RRULE)</label>
              <input placeholder="예: FREQ=WEEKLY;BYDAY=SU" value={form.recurrence_rule} onChange={e => setForm(f => ({ ...f, recurrence_rule: e.target.value }))} style={inpStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lblStyle}>시작 *</label>
              <input type="datetime-local" value={form.start_at} onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))} style={inpStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lblStyle}>종료</label>
              <input type="datetime-local" value={form.end_at} onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))} style={inpStyle} />
            </div>
          </div>
          <button type="submit" style={{ ...btnStyle, marginTop: 12 }}>저장</button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(grouped).sort().map(([date, evs]) => (
          <div key={date} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 80, flexShrink: 0, textAlign: 'right', color: '#94a3b8', fontSize: '0.82rem', paddingTop: 4 }}>
              {dayjs(date).format('MM/DD ddd')}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {evs.map(e => (
                <div key={e.id} style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', borderLeft: '3px solid #3b82f6' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{e.title}</div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>
                    {dayjs(e.start_at).format('HH:mm')} {e.location ? `· ${e.location}` : ''} {e.department_name ? `· ${e.department_name}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>이번 달 일정이 없습니다.</div>}
      </div>
    </div>
  )
}

const btnStyle = { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: '0.875rem' }
const navBtn = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }
const selectStyle = { border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: '0.875rem' }
const lblStyle = { fontSize: '0.82rem', color: '#475569' }
const inpStyle = { border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: '0.875rem', outline: 'none' }
