import { useEffect, useState } from 'react'
import { budget as api } from '../../api'

export default function BudgetReport() {
  const [fiscalYears, setFiscalYears] = useState([])
  const [fyId, setFyId] = useState('')
  const [report, setReport] = useState(null)

  useEffect(() => {
    api.fiscalYears().then(r => {
      setFiscalYears(r.data)
      if (r.data.length) setFyId(String(r.data[0].id))
    })
  }, [])

  useEffect(() => {
    if (!fyId) return
    api.report({ fiscal_year_id: fyId }).then(r => setReport(r.data))
  }, [fyId])

  if (!report) return <div>불러오는 중...</div>

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 20 }}>결산 보고서</h1>

      <select value={fyId} onChange={e => setFyId(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', marginBottom: 24 }}>
        {fiscalYears.map(f => <option key={f.id} value={f.id}>{f.year}년도</option>)}
      </select>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <Box label="총 수입" value={report.totalIncome} color="#22c55e" />
        <Box label="총 지출" value={report.totalExpense} color="#ef4444" />
        <Box label="잔액" value={report.balance} color="#3b82f6" />
      </div>

      <Section title="수입 내역" rows={report.income} color="#22c55e" />
      <Section title="지출 내역" rows={report.expense} color="#ef4444" />
    </div>
  )
}

function Box({ label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', flex: 1 }}>
      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: '1.2rem', fontWeight: 700, color, marginTop: 4 }}>{Number(value).toLocaleString()}원</div>
    </div>
  )
}

function Section({ title, rows, color }) {
  const total = rows.reduce((s, r) => s + Number(r.actual), 0)
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.08)', marginBottom: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 12 }}>{title} — 합계 {total.toLocaleString()}원</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {['항목', '예산', '실적', '달성률'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const pct = r.budget_amount > 0 ? Math.round(Number(r.actual) / Number(r.budget_amount) * 100) : null
            return (
              <tr key={i}>
                <td style={c}>{r.category}</td>
                <td style={c}>{r.budget_amount > 0 ? Number(r.budget_amount).toLocaleString() + '원' : '-'}</td>
                <td style={{ ...c, fontWeight: 600, color }}>{Number(r.actual).toLocaleString()}원</td>
                <td style={c}>{pct !== null ? `${pct}%` : '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const c = { padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }
