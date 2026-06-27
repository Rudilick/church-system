import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { members as membersApi, pastoral as pastoralApi, preferences as prefsApi, todos as todosApi, attendance as attendanceApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useNavConfig } from '../components/Layout'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
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
const MAX_TILES = 7

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토']

function WallClock({ time }) {
  const hourDeg   = (time.hour() % 12) * 30 + time.minute() * 0.5
  const minuteDeg = time.minute() * 6 + time.second() * 0.1
  const secondDeg = time.second() * 6

  return (
    <div className={styles.wallClock}>
      {[...Array(12)].map((_, i) => (
        <span key={i} className={styles.clockTick} style={{ transform: `rotate(${i * 30}deg)` }} />
      ))}
      <span className={`${styles.clockHand} ${styles.clockHandHour}`}   style={{ transform: `rotate(${hourDeg}deg)` }} />
      <span className={`${styles.clockHand} ${styles.clockHandMinute}`} style={{ transform: `rotate(${minuteDeg}deg)` }} />
      <span className={`${styles.clockHand} ${styles.clockHandSecond}`} style={{ transform: `rotate(${secondDeg}deg)` }} />
      <span className={styles.clockCenter} />
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { setSidebarEdit } = useNavConfig() ?? {}
  const navigate = useNavigate()
  const storageKey = `dashboard_tiles_${user?.id ?? 'default'}`

  const [birthdays,    setBirthdays]    = useState([])
  const [weekEvents,   setWeekEvents]   = useState([])
  const [weekPastoral, setWeekPastoral] = useState([])
  const [activityFeed, setActivityFeed] = useState([])
  const [absentSummary, setAbsentSummary] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [now, setNow] = useState(dayjs())

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000)
    return () => clearInterval(timer)
  }, [])

  // To-do 상태
  const [todos,      setTodos]      = useState([])
  const [todoInput,  setTodoInput]  = useState('')
  const [todoSaving, setTodoSaving] = useState(false)
  const todoInputRef = useRef(null)

  const openSettings = () => {
    setShowSettings(true)
    setSidebarEdit?.(true)
  }
  const closeSettings = () => {
    setShowSettings(false)
    setSidebarEdit?.(false)
  }
  const [visibleIds, setVisibleIds] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : DEFAULT_TILE_IDS
    } catch { return DEFAULT_TILE_IDS }
  })

  useEffect(() => {
    membersApi.birthdays(7).then(r => setBirthdays(r.data)).catch(() => {})
    membersApi.weekEvents(7).then(r => setWeekEvents(r.data)).catch(() => {})
    membersApi.activityFeed(10).then(r => setActivityFeed(r.data)).catch(() => {})
    attendanceApi.absentSummary().then(r => setAbsentSummary(r.data)).catch(() => {})

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

    todosApi.list().then(r => setTodos(r.data || [])).catch(() => {})
  }, [])

  // ── To-do 핸들러 ──────────────────────────────────────────
  const addTodo = async () => {
    if (!todoInput.trim()) return
    setTodoSaving(true)
    try {
      const r = await todosApi.add({ content: todoInput.trim() })
      setTodos(prev => [r.data, ...prev])
      setTodoInput('')
      todoInputRef.current?.focus()
    } catch { toast.error('저장 실패') }
    finally { setTodoSaving(false) }
  }

  const updateTodo = async (id, patch) => {
    try {
      const r = await todosApi.update(id, patch)
      setTodos(prev => prev.map(t => t.id === id ? r.data : t))
      if (patch.status === 'done') {
        toast.success('내일 목록에서 자동 삭제됩니다', { duration: 2500 })
      }
    } catch { toast.error('수정 실패') }
  }

  const removeTodo = async (id) => {
    try {
      await todosApi.remove(id)
      setTodos(prev => prev.filter(t => t.id !== id))
    } catch { toast.error('삭제 실패') }
  }

  const STATUS_NEXT  = { pending: 'done', done: 'delayed', delayed: 'hold', hold: 'pending' }
  const STATUS_LABEL = { pending: '진행', done: '✓완료', delayed: '→연기', hold: '○보류' }
  const STATUS_COLOR = { pending: '#3b82f6', done: '#10b981', delayed: '#f59e0b', hold: '#94a3b8' }

  const saveVisibleIds = (ids) => {
    setVisibleIds(ids)
    localStorage.setItem(storageKey, JSON.stringify(ids))
    prefsApi.patch({ dashboard_tiles: ids }).catch(() => {})
  }

  const shownTiles = ALL_TILES.filter(t => visibleIds.includes(t.id))

  // 최근활동 클릭 네비게이션
  const handleActivityClick = (item) => {
    if (item.tab === '특이사항') {
      if (item.member_id) navigate(`/members/${item.member_id}`)
    } else if (item.tab === '심방등록') {
      const month = item.visit_date ? dayjs(item.visit_date).format('YYYY-MM') : dayjs(item.ts).format('YYYY-MM')
      navigate(`/pastoral?month=${month}`)
    } else if (item.tab === '캘린더 일정') {
      const month = item.visit_date ? dayjs(item.visit_date).format('YYYY-MM') : dayjs(item.ts).format('YYYY-MM')
      navigate(`/calendar?month=${month}`)
    } else if (item.tab === '기도제목') {
      if (item.member_id) navigate(`/members/${item.member_id}`)
    }
  }

  return (
    <div className={styles.page}>

      {/* 타일 설정 패널 */}
      {showSettings && (
        <div className={styles.settingsPanel}>
          <div className={styles.settingsPanelHead}>
            <span className={styles.settingsPanelTitle}>대시보드 바로가기 <span className={styles.settingsTileCount}>({visibleIds.length}/{MAX_TILES})</span></span>
            <button className={styles.settingsClose} onClick={closeSettings}>✕</button>
          </div>
          <div className={styles.settingsGrid}>
            {ALL_TILES.map(tile => {
              const isOn = visibleIds.includes(tile.id)
              const isDisabled = !isOn && visibleIds.length >= MAX_TILES
              return (
                <label
                  key={tile.id}
                  className={`${styles.settingsTile} ${isOn ? styles.settingsTileOn : ''} ${isDisabled ? styles.settingsTileDisabled : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isOn}
                    disabled={isDisabled}
                    onChange={() => {
                      if (isDisabled) return
                      const next = isOn
                        ? visibleIds.filter(v => v !== tile.id)
                        : [...visibleIds, tile.id]
                      saveVisibleIds(next)
                    }}
                    style={{ display: 'none' }}
                  />
                  <span className={styles.settingsTileIcon}>{tile.icon}</span>
                  <span className={styles.settingsTileName}>{tile.title}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* 타일 한 줄 + 날짜/시각 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>📌 바로가기</h2>
        <div
          className={styles.tilesRowWrap}
          style={{ gridTemplateColumns: `repeat(${shownTiles.length + 3}, 1fr)` }}
        >
          {shownTiles.map(tile => (
            <Link key={tile.id} to={tile.to} className={styles.tile}>
              <span className={styles.tileIcon}>{tile.icon}</span>
              <span className={styles.tileName}>{tile.title}</span>
            </Link>
          ))}
          <div className={styles.dateTimeBlock}>
            <WallClock time={now} />
            <p className={styles.dateBig}>
              {now.format('YYYY년 MM월 DD일')}
              <br />
              {`${WEEKDAYS_KO[now.day()]}요일  ${now.format('HH:mm:ss')}`}
            </p>
          </div>
          <div className={styles.gearWrap}>
            <button
              className={`${styles.gearBtn} ${showSettings ? styles.gearBtnActive : ''}`}
              onClick={showSettings ? closeSettings : openSettings}
              title="설정"
            >⚙️</button>
          </div>
        </div>
      </section>

      {/* ── 이번 주 일정 + 나의 할 일 + 최근 활동 3분할 ───────── */}
      <section className={styles.section}>
        <div className={styles.dashGrid}>

          {/* 이번 주 일정 */}
          <div className={`${styles.midCol} ${styles.scheduleArea}`}>
            <h2 className={styles.sectionTitle}>📅 이번 주 일정</h2>
          <div className={styles.midCard}>

            <div className={styles.midGroup}>
              <div className={styles.midGroupLabel}>🎂 생일</div>
              {birthdays.length > 0 ? (
                <div className={styles.midScroll}>
                  {birthdays.map(m => (
                    <Link key={m.id} to={`/members/${m.id}`} className={styles.midChip} style={{ borderTop: '3px solid #f59e0b' }}>
                      {m.photo_url
                        ? <img src={m.photo_url} alt={m.name} className={styles.midChipImg} />
                        : <div className={styles.midChipAvatar} style={{ background: '#f59e0b' }}>{m.name[0]}</div>
                      }
                      <span className={styles.midChipName}>{m.name}</span>
                      <span className={styles.midChipSub}>{dayjs(m.birth_date).format('MM/DD')}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className={styles.midGroupEmpty}>이번 주 생일인 분이 없습니다.</p>
              )}
            </div>

            <div className={styles.midGroup}>
              <div className={styles.midGroupLabel}>🤝 심방</div>
              {weekPastoral.length > 0 ? (
                <div className={styles.midScroll}>
                  {weekPastoral.map(pv => (
                    <Link key={pv.id} to={`/members/${pv.member_id}`} className={styles.midChip} style={{ borderTop: '3px solid #0ea5e9' }}>
                      {pv.photo_url
                        ? <img src={pv.photo_url} alt={pv.member_name} className={styles.midChipImg} />
                        : <div className={styles.midChipAvatar} style={{ background: '#0ea5e9' }}>{pv.member_name[0]}</div>
                      }
                      <span className={styles.midChipName}>{pv.member_name}</span>
                      <span className={styles.midChipSub}>{dayjs(pv.visit_date).format('MM/DD')}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className={styles.midGroupEmpty}>이번 주 예정된 심방이 없습니다.</p>
              )}
            </div>

            <div className={styles.midGroup}>
              <div className={styles.midGroupLabel}>✅ 성도일정</div>
              {weekEvents.length > 0 ? (
                <div className={styles.midScroll}>
                  {weekEvents.map(ev => (
                    <Link key={ev.id} to={`/members/${ev.member_id}`} className={styles.midChip} style={{ borderTop: '3px solid #8b5cf6' }}>
                      {ev.photo_url
                        ? <img src={ev.photo_url} alt={ev.member_name} className={styles.midChipImg} />
                        : <div className={styles.midChipAvatar} style={{ background: '#8b5cf6' }}>{ev.member_name[0]}</div>
                      }
                      <span className={styles.midChipName}>{ev.member_name}</span>
                      <span className={styles.midChipSub}>{dayjs(ev.event_date).format('MM/DD')}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className={styles.midGroupEmpty}>이번 주 성도일정이 없습니다.</p>
              )}
            </div>
          </div>
          </div>

          {/* 나의 할 일 */}
          <div className={`${styles.midCol} ${styles.todoArea}`}>
            <h2 className={styles.sectionTitle}>📝 나의 할 일</h2>
          <div className={styles.midCard}>

            {/* 입력 */}
            <div className={styles.todoInputRow}>
              <input
                ref={todoInputRef}
                className={styles.todoInput}
                placeholder="할 일 추가…"
                value={todoInput}
                onChange={e => setTodoInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTodo()}
              />
              <button className={styles.todoAddBtn} onClick={addTodo} disabled={todoSaving || !todoInput.trim()}>
                +
              </button>
            </div>

            {/* 목록 */}
            <div className={styles.todoList}>
              {todos.length === 0 && (
                <p className={styles.midEmpty}>할 일이 없습니다.</p>
              )}
              {todos.map(t => (
                <div key={t.id} className={`${styles.todoItem} ${t.status === 'done' ? styles.todoItemDone : ''}`}>
                  <button
                    className={`${styles.todoStar} ${t.importance ? styles.todoStarOn : ''}`}
                    onClick={() => updateTodo(t.id, { importance: !t.importance })}
                    title="중요"
                  >★</button>
                  <span className={styles.todoContent}>{t.content}</span>
                  <button
                    className={styles.todoStatus}
                    style={{ color: STATUS_COLOR[t.status] || '#3b82f6' }}
                    onClick={() => updateTodo(t.id, { status: STATUS_NEXT[t.status] || 'pending' })}
                    title="상태 변경"
                  >{STATUS_LABEL[t.status] || '진행'}</button>
                  <button className={styles.todoDel} onClick={() => removeTodo(t.id)} title="삭제">✕</button>
                </div>
              ))}
            </div>
          </div>
          </div>

          {/* 최근 활동 */}
          <div className={`${styles.midCol} ${styles.activityArea}`}>
            <h2 className={styles.sectionTitle}>🕐 최근 활동</h2>
            <div className={styles.timelineWrap}>
              <div className={styles.timeline}>
            {absentSummary?.absent_count > 0 && (
              <div
                className={`${styles.timelineRow} ${styles.timelineRowClickable} ${styles.absentRow}`}
                onClick={() => navigate('/attendance', { state: { view: 'absent' } })}
              >
                <span className={styles.timelineTabWrap}>
                  <span className={styles.timelineTab}>출결</span>
                </span>
                <span className={styles.timelineName}>
                  미출석명단{absentSummary.last_date ? ` (${dayjs(absentSummary.last_date).format('M/D')})` : ''}
                </span>
                <span className={styles.timelineDetail}>
                  {absentSummary.absent_count}명 &rsaquo;
                </span>
              </div>
            )}
            {activityFeed.length > 0 ? activityFeed.map((item, i) => {
              const isNew = dayjs().diff(dayjs(item.ts), 'hour') < 24
              return (
                <div
                  key={i}
                  className={`${styles.timelineRow} ${styles.timelineRowClickable}`}
                  onClick={() => handleActivityClick(item)}
                >
                  <span className={styles.timelineTabWrap}>
                    <span className={styles.timelineTab}>
                      {isNew && <span className={styles.newDot} />}
                      {item.tab}
                    </span>
                  </span>
                  <span className={styles.timelineName}>
                    {item.member_name && item.member_name !== '-' ? item.member_name : '-'}
                  </span>
                  <span className={styles.timelineDetail}>
                    {item.tab === '심방등록'
                      ? (() => {
                          const datePart = item.visit_date ? dayjs(item.visit_date).format('MM/DD') : null
                          const rest = [item.visit_type, item.location, item.detail].filter(Boolean).join(' · ')
                          return [datePart, rest].filter(Boolean).join(' ')
                        })()
                      : item.detail?.slice(0, 60)
                    }
                    {item.created_by_name && (
                      <span className={styles.timelineAuthor}>{item.created_by_name}</span>
                    )}
                  </span>
                </div>
              )
            }) : (
              <div className={styles.timelineEmpty}>최근 30일간의 활동 내역이 없습니다.</div>
            )}
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
