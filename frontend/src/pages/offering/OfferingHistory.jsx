import { useEffect, useState } from 'react'
import { offering as api } from '../../api'
import dayjs from 'dayjs'
import styles from './Offering.module.css'

export default function OfferingHistory() {
  const [rows, setRows] = useState([])
  const [from, setFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [to, setTo]     = useState(dayjs().format('YYYY-MM-DD'))
  const [total, setTotal] = useState(0)

  const load = async () => {
    const res = await api.list({ from, to })
    setRows(res.data.data)
    setTotal(res.data.total)
  }

  useEffect(() => { load() }, [])

  const sum = rows.reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 20 }}>헌금 이력</h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px' }} />
        <span style={{ alignSelf: 'center' }}>~</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px' }} />
        <button className={styles.btn} onClick={load}>조회</button>
      </div>

      <div style={{ marginBottom: 12, fontWeight: 600, color: '#3b82f6' }}>
        합계: {sum.toLocaleString()}원 ({total}건)
      </div>

      <div style={{ background: '#fff', borderRadius: 12, overflow: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['날짜', '교인', '헌금 종류', '금액', '메모'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>{r.date}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>{r.member_name ?? '미상'}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>{r.type_name}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Number(r.amount).toLocaleString()}원</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', color: '#64748b', textAlign: 'center' }}>{r.memo ?? '-'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>데이터 없음</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
