import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { offering as api, members as membersApi } from '../../api'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import styles from './Offering.module.css'

export default function Offering() {
  const [types, setTypes] = useState([])
  const [form, setForm] = useState({ member_id: '', offering_type_id: '', amount: '', date: dayjs().format('YYYY-MM-DD'), memo: '' })
  const [count, setCount] = useState(0)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberSuggestions, setMemberSuggestions] = useState([])
  const [memberName, setMemberName] = useState('')
  const suggestTimer = useRef(null)

  useEffect(() => {
    api.types().then(r => {
      setTypes(r.data)
      if (r.data.length) setForm(f => ({ ...f, offering_type_id: r.data[0].id }))
    })
  }, [])

  const handleMemberInput = (val) => {
    setMemberQuery(val)
    setMemberName(val)
    setForm(f => ({ ...f, member_id: '' }))
    clearTimeout(suggestTimer.current)
    if (val.length < 1) { setMemberSuggestions([]); return }
    suggestTimer.current = setTimeout(async () => {
      const res = await membersApi.list({ q: val, limit: 8 })
      setMemberSuggestions(res.data.data)
    }, 200)
  }

  const selectMember = (m) => {
    setForm(f => ({ ...f, member_id: m.id }))
    setMemberName(m.name)
    setMemberQuery(m.name)
    setMemberSuggestions([])
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.offering_type_id || !form.amount || !form.date) {
      toast.error('헌금 종류, 금액, 날짜는 필수입니다.')
      return
    }
    try {
      await api.add({ ...form, member_id: form.member_id || null })
      setCount(c => c + 1)
      toast.success(`입력 완료 (${count + 1}건)`)
      setForm(f => ({ ...f, member_id: '', amount: '', memo: '' }))
      setMemberName('')
      setMemberQuery('')
    } catch {
      toast.error('저장 실패')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>헌금 관리</h1>
        <Link to="/offering/history" className={styles.btnOutline}>이력 조회</Link>
      </div>

      <form onSubmit={handleSubmit} className={styles.card}>
        <div style={{ fontWeight: 600, marginBottom: 16 }}>헌금 입력 <span style={{ color: '#3b82f6' }}>({count}건 입력됨)</span></div>

        <div className={styles.formGrid}>
          <div className={styles.group}>
            <label>교인 이름 (미상 가능)</label>
            <div className={styles.autocomplete}>
              <input
                value={memberQuery}
                onChange={e => handleMemberInput(e.target.value)}
                placeholder="이름 검색..."
                autoComplete="off"
              />
              {memberSuggestions.length > 0 && (
                <ul className={styles.suggestions}>
                  {memberSuggestions.map(m => (
                    <li key={m.id} onMouseDown={() => selectMember(m)}>
                      {m.name} {m.phone && <span>{m.phone}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className={styles.group}>
            <label>헌금 종류 *</label>
            <select value={form.offering_type_id} onChange={e => setForm(f => ({ ...f, offering_type_id: e.target.value }))}>
              {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className={styles.group}>
            <label>금액 *</label>
            <input
              type="number"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0"
              min="0"
            />
          </div>

          <div className={styles.group}>
            <label>날짜 *</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>

          <div className={styles.group} style={{ gridColumn: 'span 2' }}>
            <label>메모</label>
            <input value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} />
          </div>
        </div>

        <button type="submit" className={styles.btn}>입력</button>
      </form>
    </div>
  )
}
