import { useNavigate } from 'react-router-dom'
import styles from './Offering.module.css'

const TILES = [
  { label: '헌금내역 입력', icon: '✏️', path: '/offering/input', color: '#3b82f6', desc: '날짜별 헌금 종류별 입력' },
  { label: '헌금 통계',    icon: '📊', path: '/offering/stats',  color: '#10b981', desc: '기간별 통계 및 차트' },
  { label: '헌금 정보조회', icon: '🔍', path: '/offering/history',color: '#f59e0b', desc: '교인별·기간별 이력 조회' },
  { label: '기부금 영수증', icon: '📄', path: '/offering/receipt',color: '#8b5cf6', desc: '연간 기부금 영수증 발급' },
]

export default function Offering() {
  const navigate = useNavigate()
  return (
    <div>
      <h1 className={styles.pageTitle}>헌금 관리</h1>
      <div className={styles.landingGrid}>
        {TILES.map(t => (
          <button key={t.path} className={styles.landingTile} onClick={() => navigate(t.path)}>
            <div className={styles.tileIcon} style={{ background: t.color + '1a', color: t.color }}>{t.icon}</div>
            <div className={styles.tileLabel}>{t.label}</div>
            <div className={styles.tileDesc}>{t.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
