import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { budget as api } from '../../api'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'

export default function Budget() {
  const [fiscalYears, setFiscalYears] = useState([])
  const [fyId, setFyId] = useState('')
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [form, setForm] = useState({ budget_category_id: '', type: 'E', amount: '', date: dayjs().format('YYYY-MM-DD'), memo: '' })

  useEffect(() => {
    api.fiscalYears().then(r => {
      setFiscalYears(r.data)
      if (r.data.length) setFyId(String(r.data[0].id))
    })
  }, [])

  useEffect(() => {
    if (!fyId) return
    api.categories({ fiscal_year_id: fyId }).then(r => setCategories(r.data))
    api.transactions({ fiscal_year_id: fyId }).then(r => setTransactions(r.data.data))
  }, [fyId])

  const handleAdd = async e => {
    e.preventDefault()
    if (!form.budget_category_id || !form.amount) { toast.error('항목과 금액을 입력하세요.'); return }
    await api.addTransaction({ ...form, fiscal_year_id: fyId })
    toast.success('입력했습니다.')
    api.transactions({ fiscal_year_id: fyId }).then(r => setTransactions(r.data.data))
    setForm(f => ({ ...f, amount: '', memo: '' }))
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const totalIncome  = transactions.filter(t => t.type === 'I').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = transactions.filter(t => t.type === 'E').reduce((s, t) => s + Number(t.amount), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>예산 / 장부</h1>
        <Link to="/budget/report" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 16px', textDecoration: 'none', color: '#475569', fontSize: '0.875rem' }}>결산 보고서</Link>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <select value={fyId} onChange={e => setFyId(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px' }}>
          {fiscalYears.map(f => <option key={f.id} value={f.id}>{f.year}년도</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <SummaryBox label="총 수입" value={totalIncome} color="#22c55e" />
        <SummaryBox label="총 지출" value={totalExpense} color="#ef4444" />
        <SummaryBox label="잔액" value={totalIncome - totalExpense} color="#3b82f6" />
      </div>

      <form onSubmit={handleAdd} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.08)', marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>거래 입력</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
          <select value={form.type} onChange={e => set('type', e.target.value)} style={inputStyle}>
            <option value="I">수입</option>
            <option value="E">지출</option>
          </select>
          <select value={form.budget_category_id} onChange={e => set('budget_category_id', e.target.value)} style={inputStyle}>
            <option value="">항목 선택</option>
            {categories.filter(c => c.type === form.type).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="number" placeholder="금액" value={form.amount} onChange={e => set('amount', e.target.value)} style={inputStyle} />
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inputStyle} />
          <input placeholder="메모" value={form.memo} onChange={e => set('memo', e.target.value)} style={inputStyle} />
        </div>
        <button type="submit" style={{ marginTop: 12, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer' }}>입력</button>
      </form>

      <div style={{ background: '#fff', borderRadius: 12, overflow: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['날짜', '구분', '항목', '금액', '메모'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id}>
                <td style={cellStyle}>{t.date}</td>
                <td style={{ ...cellStyle, color: t.type === 'I' ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{t.type === 'I' ? '수입' : '지출'}</td>
                <td style={cellStyle}>{t.category_name ?? '-'}</td>
                <td style={{ ...cellStyle, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{Number(t.amount).toLocaleString()}원</td>
                <td style={{ ...cellStyle, color: '#64748b' }}>{t.memo ?? '-'}</td>
              </tr>
            ))}
            {transactions.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>데이터 없음</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SummaryBox({ label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', flex: 1 }}>
      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.2rem', fontWeight: 700, color }}>{value.toLocaleString()}원</div>
    </div>
  )
}

const inputStyle = { border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: '0.875rem', outline: 'none' }
const cellStyle = { padding: '10px 14px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }
