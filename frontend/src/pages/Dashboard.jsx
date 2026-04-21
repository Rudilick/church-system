import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { members as membersApi, attendance, offering } from '../api'
import dayjs from 'dayjs'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const [birthdays, setBirthdays] = useState([])
  const today = dayjs().format('YYYY-MM-DD')

  useEffect(() => {
    membersApi.birthdays(7).then(r => setBirthdays(r.data)).catch(() => {})
  }, [])

  return (
    <div>
      <h1 className={styles.title}>대시보드</h1>
      <p className={styles.date}>{dayjs().format('YYYY년 MM월 DD일 dddd')}</p>

      <div className={styles.grid}>
        <Card title="교적 관리" icon="👥" to="/members" desc="교인 등록·조회·수정" />
        <Card title="출결 관리" icon="✅" to="/attendance" desc="예배 출석 체크" />
        <Card title="헌금 관리" icon="💰" to="/offering" desc="헌금 입력 및 이력" />
        <Card title="예산/장부" icon="📊" to="/budget" desc="수입·지출 관리" />
        <Card title="심방 기록" icon="🙏" to="/pastoral" desc="심방 일지 관리" />
        <Card title="캘린더"   icon="📅" to="/calendar" desc="부서별 일정 관리" />
      </div>

      {birthdays.length > 0 && (
        <section className={styles.section}>
          <h2>🎂 이번 주 생일</h2>
          <div className={styles.birthdayList}>
            {birthdays.map(m => (
              <Link key={m.id} to={`/members/${m.id}`} className={styles.birthdayCard}>
                {m.photo_url
                  ? <img src={m.photo_url} alt={m.name} />
                  : <div className={styles.avatar}>{m.name[0]}</div>
                }
                <span>{m.name}</span>
                <small>{dayjs(m.birth_date).format('MM/DD')}</small>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Card({ title, icon, to, desc }) {
  return (
    <Link to={to} className={styles.card}>
      <span className={styles.cardIcon}>{icon}</span>
      <div>
        <div className={styles.cardTitle}>{title}</div>
        <div className={styles.cardDesc}>{desc}</div>
      </div>
    </Link>
  )
}
