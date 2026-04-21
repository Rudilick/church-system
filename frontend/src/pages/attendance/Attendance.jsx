import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { attendance as api } from '../../api'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import styles from './Attendance.module.css'

export default function Attendance() {
  const [services, setServices] = useState([])
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [list, setList] = useState([])
  const [memberName, setMemberName] = useState('')

  useEffect(() => {
    api.services().then(r => {
      setServices(r.data)
      if (r.data.length) setServiceId(String(r.data[0].id))
    })
  }, [])

  useEffect(() => {
    if (!serviceId || !date) return
    api.list({ service_id: serviceId, date }).then(r => setList(r.data))
  }, [serviceId, date])

  const handleAdd = async e => {
    e.preventDefault()
    // 이 페이지에서는 member_id가 필요하므로 실제로는 자동완성 컴포넌트 필요
    // 지금은 간단히 member_id 직접 입력 (추후 개선)
    toast('교인 검색 기능은 다음 단계에서 추가됩니다.')
  }

  const handleRemove = async id => {
    await api.remove(id)
    setList(l => l.filter(a => a.id !== id))
    toast.success('출석 취소')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>출결 관리</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/attendance/qr" className={styles.btn}>QR 출석 체크</Link>
          <Link to="/attendance/stats" className={styles.btnOutline}>통계</Link>
        </div>
      </div>

      <div className={styles.toolbar}>
        <select value={serviceId} onChange={e => setServiceId(e.target.value)} className={styles.select}>
          {services.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={styles.dateInput} />
      </div>

      <div className={styles.card}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>출석 인원: {list.length}명</div>
        <div className={styles.attendeeList}>
          {list.map(a => (
            <div key={a.id} className={styles.attendee}>
              {a.photo_url
                ? <img src={a.photo_url} alt={a.name} className={styles.thumb} />
                : <div className={styles.thumbPlaceholder}>{a.name[0]}</div>
              }
              <span className={styles.attendeeName}>{a.name}</span>
              <span className={styles.method}>{a.method === 'qr' ? 'QR' : '수동'}</span>
              <button className={styles.removeBtn} onClick={() => handleRemove(a.id)}>×</button>
            </div>
          ))}
          {list.length === 0 && <div className={styles.empty}>출석 기록이 없습니다.</div>}
        </div>
      </div>
    </div>
  )
}
