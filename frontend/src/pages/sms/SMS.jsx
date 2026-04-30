import { useEffect, useState } from 'react'
import { sms as api, communities as communityApi, departments as deptApi } from '../../api'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'

export default function SMS() {
  const [logs, setLogs] = useState([])
  const [form, setForm] = useState({ target_type: 'all', target_id: '', message: '', sender_id: 1 })
  const [communities, setCommunities] = useState([])
  const [departments, setDepartments] = useState([])

  useEffect(() => {
    api.logs().then(r => setLogs(r.data))
    communityApi.list().then(r => setCommunities(r.data))
    deptApi.list().then(r => setDepartments(r.data))
  }, [])

  const handleSend = async e => {
    e.preventDefault()
    if (!form.message.trim()) { toast.error('메시지를 입력하세요.'); return }
    if (!confirm('문자를 발송하시겠습니까?')) return
    const res = await api.send(form)
    toast.success(`${res.data.recipient_count}명에게 발송 처리했습니다.`)
    api.logs().then(r => setLogs(r.data))
    setForm(f => ({ ...f, message: '' }))
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 20 }}>단체 문자 발송</h1>

      <form onSubmit={handleSend} style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.08)', maxWidth: 600, marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={lblStyle}>발송 대상</label>
              <select value={form.target_type} onChange={e => set('target_type', e.target.value)} style={inpStyle}>
                <option value="all">전체 교인</option>
                <option value="community">공동체별</option>
                <option value="department">부서별</option>
              </select>
            </div>
            {form.target_type === 'community' && (
              <div style={{ flex: 1 }}>
                <label style={lblStyle}>공동체 선택</label>
                <select value={form.target_id} onChange={e => set('target_id', e.target.value)} style={inpStyle}>
                  <option value="">선택</option>
                  {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {form.target_type === 'department' && (
              <div style={{ flex: 1 }}>
                <label style={lblStyle}>부서 선택</label>
                <select value={form.target_id} onChange={e => set('target_id', e.target.value)} style={inpStyle}>
                  <option value="">선택</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <label style={lblStyle}>메시지 내용</label>
            <textarea rows={5} value={form.message} onChange={e => set('message', e.target.value)} style={{ ...inpStyle, resize: 'vertical', fontFamily: 'inherit' }} placeholder="발송할 문자 내용을 입력하세요." />
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>{form.message.length}자</div>
          </div>

          <div style={{ padding: 12, background: '#fef3c7', borderRadius: 8, fontSize: '0.82rem', color: '#92400e' }}>
            ⚠️ SMS API 연동 전 상태입니다. 발송 로그만 저장되며 실제 문자는 발송되지 않습니다.
          </div>

          <button type="submit" style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontSize: '0.9rem' }}>발송</button>
        </div>
      </form>

      <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>발송 이력</h2>
      <div style={{ background: '#fff', borderRadius: 12, overflow: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['발송일시', '발송자', '대상', '수신자수', '내용'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'center', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id}>
                <td style={cellStyle}>{dayjs(l.sent_at).format('MM/DD HH:mm')}</td>
                <td style={cellStyle}>{l.sender_name ?? '-'}</td>
                <td style={cellStyle}>{targetLabel(l.target_type)}</td>
                <td style={cellStyle}>{l.recipient_count}명</td>
                <td style={{ ...cellStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.message}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>발송 이력 없음</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function targetLabel(t) {
  return { all: '전체', community: '공동체', department: '부서', individual: '개별' }[t] ?? t
}

const lblStyle = { display: 'block', fontSize: '0.82rem', color: '#475569', marginBottom: 4 }
const inpStyle = { width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: '0.875rem', outline: 'none' }
const cellStyle = { padding: '10px 14px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }
