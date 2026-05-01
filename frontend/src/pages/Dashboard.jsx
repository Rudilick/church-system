import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { members as membersApi, pastoral as pastoralApi, preferences as prefsApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useNavConfig } from '../components/Layout'
import dayjs from 'dayjs'
import styles from './Dashboard.module.css'

const ALL_TILES = [
  { id: 'members',     title: '교적 관리',   icon: '👥', to: '/members',     desc: '교인 등록·조회·수정' },
  { id: 'attendance',  title: '출결 관리',   icon: '✅', to: '/attendance',  desc: '예배 출석 체크' },
  { id: 'offering',    title: '헌금 관리',   icon: '💰', to: '/offering',    desc: '헌금 입력 및 이력' },
  { id: 'budget',      title: '예산/장부',   icon: '📊', to: '/budget',      desc: '수입·지출 관리' },
  { id: 'pastoral',    title: '심방 관리',   icon: '🙏', to: '/pastoral',    desc: '심방 일지 관리' },
  { id: 'calendar',    title: '캘린더',      icon: '📅', to: '/calendar',    desc: '부서별 일정 관리' },
  { id: 'departments', title: '부서 관리',   icon: '🏢', to: '/departments', desc: '부서 및 직책 관리' },
  { id: 'communities', title: '공동체',      icon: '🤝', to: '/communities', desc: '소그룹 공동체 관리' },
  { id: 'accounting',  title: '지출회계',    icon: '🧾', to: '/accounting',  desc: '지출 및 영수증 관리' },
  { id: 'sms',         title: '단체문자',    icon: '📱', to: '/sms',         desc: '성도 SMS 발송' },
]

const DEFAULT_TILE_IDS = ['members', 'attendance', 'offering', 'budget', 'pastoral', 'calendar']

export default function Dashboard() {
  const { user } = useAuth()
  const { setSidebarEdit } = useNavConfig() ?? {}
  const storageKey = `dashboard_tiles_${user?.id ?? 'default'}`

  const [birthdays,    setBirthdays]    = useState([])
  const [weekEvents,   setWeekEvents]   = useState([])
  const [weekPastoral, setWeekPastoral] = useState([])
  const [activityFeed, setActivityFeed] = useState([])
  const [showSettings, setShowSettings] = useState(false)

  const openSettings = () => {
    setShowSettings(true)
    setSidebarEdit?.(true)
  }
  const closeSettings = () => {
    setShowSettings(false)
    setSidebarEdit?.(false)
  }
  const [visibleIds,   setVisibleIds]   = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : DEFAULT_TILE_IDS
    } catch { return DEFAULT_TILE_IDS }
  })

  useEffect(() => {
    membersApi.birthdays(7).then(r => setBirthdays(r.data)).catch(() => {})
    membersApi.weekEvents(7).then(r => setWeekEvents(r.data)).catch(() => {})
    membersApi.activityFeed(15).then(r => setActivityFeed(r.data)).catch(() => {})

    const today = dayjs()
    const dow = today.day()
    const weekStart = today.subtract(dow === 0 ? 6 : dow - 1, 'day').format('YYYY-MM-DD')
    const weekEnd   = dayjs(weekStart).add(6, 'day').format('YYYY-MM-DD')
    pastoralApi.list({ from: weekStart, to: weekEnd })
      .then(r => setWeekPastoral(r.data)).catch(() => {})

    prefsApi.get().then(r => {
      if (r.data.dashboard_tiles) {
        setVisibleIds(r.data.dashboard_tiles)
        localStorage.setItem(storageKey, JSON.stringify(r.data.dashboard_tiles))
      }
    }).catch(() => {})
  }, [])

  const saveVisibleIds = (ids) => {
    setVisibleIds(ids)
    localStorage.setItem(storageKey, JSON.stringify(ids))
    prefsApi.patch({ dashboard_tiles: ids }).catch(() => {})
  }

  const shownTiles = ALL_TILES.filter(t => visibleIds.includes(t.id))

  return (
    <div className={styles.page}>

      {/* 헤더 */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>대시보드</h1>
          <p className={styles.date}>{dayjs().format('YYYY년 MM월 DD일 dddd')}</p>
        </div>
        <button
          className={`${styles.gearBtn} ${showSettings ? styles.gearBtnActive : ''}`}
          onClick={showSettings ? closeSettings : openSettings}
          title="설정"
        >⚙️</button>
      </div>

      {/* 타일 설정 패널 */}
      {showSettings && (
        <div className={styles.settingsPanel}>
          <div className={styles.settingsPanelHead}>
            <span className={styles.settingsPanelTitle}>대시보드 바로가기</span>
            <button className={styles.settingsClose} onClick={closeSettings}>✕</button>
          </div>
          <div className={styles.settingsGrid}>
            {ALL_TILES.map(tile => (
              <label
                key={tile.id}
                className={`${styles.settingsTile} ${visibleIds.includes(tile.id) ? styles.settingsTileOn : ''}`}
              >
                <input
                  type="checkbox"
                  checked={visibleIds.includes(tile.id)}
                  onChange={() => {
                    const next = visibleIds.includes(tile.id)
                      ? visibleIds.filter(v => v !== tile.id)
                      : [...visibleIds, tile.id]
                    saveVisibleIds(next)
                  }}
                  style={{ display: 'none' }}
                />
                <span className={styles.settingsTileIcon}>{tile.icon}</span>
                <span className={styles.settingsTileName}>{tile.title}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 타일 한 줄 */}
      <div className={styles.tilesRow}>
        {shownTiles.map(tile => (
          <Link key={tile.id} to={tile.to} className={styles.tile}>
            <span className={styles.tileIcon}>{tile.icon}</span>
            <span className={styles.tileName}>{tile.title}</span>
          </Link>
        ))}
      </div>

      {/* 이번 주 생일 */}
      {birthdays.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>🎂 이번 주 생일</h2>
          <div className={styles.cardRow}>
            {birthdays.map(m => (
              <Link key={m.id} to={`/members/${m.id}`} className={`${styles.faceCard} ${styles.faceCardBirthday}`}>
                {m.photo_url
                  ? <img src={m.photo_url} alt={m.name} className={styles.faceImg} />
                  : <div className={styles.faceAvatar} style={{ background: '#f59e0b' }}>{m.name[0]}</div>
                }
                <span className={styles.faceName}>{m.name}</span>
                <small className={styles.faceSub}>{dayjs(m.birth_date).format('MM/DD')}</small>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 이번 주 성도 일정 */}
      {weekEvents.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>📅 이번 주 성도 일정</h2>
          <div className={styles.cardRow}>
            {weekEvents.map(ev => (
              <Link key={ev.id} to={`/members/${ev.member_id}`} className={`${styles.faceCard} ${styles.faceCardEvent}`}>
                {ev.photo_url
                  ? <img src={ev.photo_url} alt={ev.member_name} className={styles.faceImg} />
                  : <div className={styles.faceAvatar} style={{ background: '#8b5cf6' }}>{ev.member_name[0]}</div>
                }
                <span className={styles.faceName}>{ev.member_name}</span>
                <small className={styles.faceSub}>{dayjs(ev.event_date).format('MM/DD')}</small>
                <div className={styles.faceTooltip}>
                  <strong>{ev.event_title}</strong>
                  <span>{ev.content}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 이번 주 심방 일정 */}
      {weekPastoral.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>🙏 이번 주 심방 일정</h2>
          <div className={styles.cardRow}>
            {weekPastoral.map(pv => (
              <Link key={pv.id} to={`/members/${pv.member_id}`} className={`${styles.faceCard} ${styles.faceCardPastoral}`}>
                {pv.photo_url
                  ? <img src={pv.photo_url} alt={pv.member_name} className={styles.faceImg} />
                  : <div className={styles.faceAvatar} style={{ background: '#0ea5e9' }}>{pv.member_name[0]}</div>
                }
                <span className={styles.faceName}>{pv.member_name}</span>
                <small className={styles.faceSub}>{dayjs(pv.visit_date).format('MM/DD')}</small>
                <div className={styles.faceTooltip}>
                  <strong>{dayjs(pv.visit_date).format('MM월 DD일')} 심방</strong>
                  <span>{pv.content?.slice(0, 80)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 최근 활동 타임라인 */}
      {activityFeed.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>🕐 최근 활동</h2>
          <div className={styles.timeline}>
            {activityFeed.map((item, i) => (
              <div key={i} className={styles.timelineRow}>
                <span className={styles.timelineTime}>
                  {dayjs(item.ts).format('YYYY-MM-DD HH:mm')}
                </span>
                <span className={styles.timelineTab}>{item.tab}</span>
                <Link to={`/members/${item.member_id}`} className={styles.timelineName}>
                  {item.member_name}
                </Link>
                <span className={styles.timelineDetail}>
                  {item.tab === '심방등록'
                    ? [
                        item.visit_date ? dayjs(item.visit_date).format('MM.DD') : null,
                        item.visit_type,
                        item.location,
                        item.detail,
                      ].filter(Boolean).join(' · ')
                    : item.event_title || item.detail?.slice(0, 60)
                  }
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
