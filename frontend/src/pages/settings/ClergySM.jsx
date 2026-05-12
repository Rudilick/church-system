import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { clergy as clergyApi } from '../../api'
import styles from './Settings.module.css'

const EMPTY = {
  name: '', role: '', phone: '', email: '',
  start_date: '', end_date: '', is_current: true, notes: '',
}

export default function ClergySM() {
  const [list, setList]     = useState([])
  const [form, setForm]     = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const load = () => clergyApi.list().then(r => setList(r.data)).catch(() => {})
  useEffect(() => { load() }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const openNew = () => { setForm(EMPTY); setEditId(null); setShowForm(true) }
  const openEdit = (c) => {
    setForm({
      name: c.name ?? '', role: c.role ?? '', phone: c.phone ?? '',
      email: c.email ?? '',
      start_date: c.start_date ? c.start_date.slice(0, 10) : '',
      end_date:   c.end_date   ? c.end_date.slice(0, 10)   : '',
      is_current: c.is_current ?? true,
      notes: c.notes ?? '',
    })
    setEditId(c.id)
    setShowForm(true)
  }
  const cancel = () => { setShowForm(false); setEditId(null) }

  const save = async () => {
    if (!form.name.trim()) { toast.error('이름을 입력해주세요.'); return }
    try {
      if (editId) {
        await clergyApi.update(editId, form)
        toast.success('수정했습니다.')
      } else {
        await clergyApi.create(form)
        toast.success('등록했습니다.')
      }
      cancel()
      load()
    } catch { toast.error('저장하지 못했습니다.') }
  }

  const remove = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    await clergyApi.remove(id).catch(() => toast.error('삭제 실패'))
    toast.success('삭제했습니다.')
    load()
  }

  const periodStr = (c) => {
    const s = c.start_date ? c.start_date.slice(0, 7).replace('-', '.') : ''
    if (c.is_current) return s ? `${s} ~ 현재` : '현재'
    const e = c.end_date ? c.end_date.slice(0, 7).replace('-', '.') : ''
    return [s, e].filter(Boolean).join(' ~ ')
  }

  return (
    <div className={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className={styles.cardTitle} style={{ margin: 0, border: 0, padding: 0 }}>교역자 연혁</h2>
        <button className={styles.saveBtn} style={{ padding: '8px 20px', fontSize: '0.9rem' }} onClick={openNew}>+ 등록</button>
      </div>

      {/* 폼 */}
      {showForm && (
        <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>이름 *</label>
              <input className={styles.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="홍길동" />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>직책</label>
              <input className={styles.input} value={form.role} onChange={e => set('role', e.target.value)} placeholder="담임목사, 부목사 등" />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>전화번호</label>
              <input className={styles.input} value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>이메일</label>
              <input className={styles.input} value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>부임일</label>
              <input type="date" className={styles.input} value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>이임일</label>
              <input type="date" className={styles.input} value={form.end_date}
                onChange={e => set('end_date', e.target.value)}
                disabled={form.is_current} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', marginTop: 4 }}>
                <input type="checkbox" checked={form.is_current} onChange={e => set('is_current', e.target.checked)} />
                현재 재직자
              </label>
            </div>
            <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.fieldLabel}>비고</label>
              <textarea className={styles.input} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <button onClick={cancel} style={{ padding: '8px 20px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>취소</button>
            <button className={styles.saveBtn} style={{ padding: '8px 20px' }} onClick={save}>
              {editId ? '수정' : '등록'}
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      {list.length === 0 ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>등록된 교역자가 없습니다.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left', color: '#6b7280', fontSize: '0.8rem' }}>
              <th style={{ padding: '8px 10px' }}>이름</th>
              <th style={{ padding: '8px 10px' }}>직책</th>
              <th style={{ padding: '8px 10px' }}>재직기간</th>
              <th style={{ padding: '8px 10px' }}>전화</th>
              <th style={{ padding: '8px 10px' }}></th>
            </tr>
          </thead>
          <tbody>
            {list.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 10px', fontWeight: 600 }}>
                  {c.name}
                  {c.is_current && <span style={{ marginLeft: 6, fontSize: '0.72rem', background: '#dcfce7', color: '#16a34a', borderRadius: 4, padding: '1px 6px' }}>현재</span>}
                </td>
                <td style={{ padding: '10px 10px', color: '#374151' }}>{c.role ?? '-'}</td>
                <td style={{ padding: '10px 10px', color: '#6b7280' }}>{periodStr(c)}</td>
                <td style={{ padding: '10px 10px', color: '#6b7280' }}>{c.phone ?? '-'}</td>
                <td style={{ padding: '10px 10px', display: 'flex', gap: 6 }}>
                  <button onClick={() => openEdit(c)}
                    style={{ fontSize: '0.78rem', padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>수정</button>
                  <button onClick={() => remove(c.id)}
                    style={{ fontSize: '0.78rem', padding: '4px 10px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', color: '#ef4444', cursor: 'pointer' }}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
