import { useState } from 'react'
import { attendance as api } from '../../api'
import dayjs from 'dayjs'
import styles from './Attendance.module.css'

export default function AttendanceStats() {
  const [from, setFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [to, setTo]     = useState(dayjs().format('YYYY-MM-DD'))
  const [rows, setRows] = useState([])

  const load = async () => {
    const res = await api.stats({ from, to })
    setRows(res.data)
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 20 }}>출결 통계</h1>

      <div className={styles.toolbar}>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={styles.dateInput} />
        <span>~</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className={styles.dateInput} />
        <button className={styles.btn} onClick={load}>조회</button>
      </div>

      {rows.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['날짜', '예배', '출석수'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>{r.date}</td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>{r.service_name}</td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>{r.count}명</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
