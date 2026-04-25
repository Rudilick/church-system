import { useNavigate } from 'react-router-dom'
import styles from './Offering.module.css'

const ITEMS = [
  { label: '헌금내역 입력', icon: '✏️', path: '/offering/input',   desc: '날짜별 헌금 종류별 입력',     color: '#3b82f6' },
  { label: '헌금 통계',    icon: '📊', path: '/offering/stats',   desc: '기간별 통계 및 차트',         color: '#10b981' },
  { label: '헌금 정보조회', icon: '🔍', path: '/offering/history', desc: '교인별·기간별 이력 조회',     color: '#f59e0b' },
  { label: '기부금 영수증', icon: '📄', path: '/offering/receipt', desc: '연간 기부금 영수증 발급',     color: '#8b5cf6' },
]

export default function Offering() {
  const navigate = useNavigate()
  return (
    <div className={styles.offeringWrap}>
      {/* ── 좌측 infoPanel (Organization 스타일) ── */}
      <div className={styles.infoPanel}>
        <div className={styles.infoPanelHeader}>
          <p className={styles.infoPanelTitle}>헌금 관리</p>
        </div>
        <div className={styles.infoSection}>
          <div className={styles.infoSectionHeader}>메뉴</div>
          <div className={styles.infoSectionBody}>
            {ITEMS.map(item => (
              <div
                key={item.path}
                className={styles.infoRow}
                onClick={() => navigate(item.path)}
              >
                <span className={styles.infoRowIcon}>{item.icon}</span>
                <div className={styles.infoRowText}>
                  <span className={styles.infoRowName}>{item.label}</span>
                  <span className={styles.infoRowSub}>{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 우측: 랜딩 타일 ── */}
      <div className={styles.offeringContent}>
        <h1 className={styles.pageTitle}>헌금 관리</h1>
        <div className={styles.landingGrid}>
          {ITEMS.map(t => (
            <button key={t.path} className={styles.landingTile} onClick={() => navigate(t.path)}>
              <div className={styles.tileIcon} style={{ background: t.color + '1a', color: t.color }}>{t.icon}</div>
              <div className={styles.tileLabel}>{t.label}</div>
              <div className={styles.tileDesc}>{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
