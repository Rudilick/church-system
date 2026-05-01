import { Fragment, createContext, useContext, useEffect, useRef, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { preferences as prefsApi } from '../api'
import styles from './Layout.module.css'

export const NAV_LIST = [
  { to: '/',             label: '대시보드',    icon: '🏠' },
  { to: '/members',      label: '교적 관리',   icon: '👥' },
  { to: '/communities',  label: '공동체/구역', icon: '🏘️' },
  { to: '/attendance',   label: '출결 관리',   icon: '✅' },
  { to: '/offering',     label: '헌금 관리',   icon: '💰' },
  { to: '/budget',       label: '예산/장부',   icon: '📊' },
  { to: '/accounting',   label: '지출회계',    icon: '🧾' },
  { to: '/pastoral',     label: '심방 관리',   icon: '🙏' },
  { to: '/calendar',     label: '캘린더',      icon: '📅' },
  { to: '/departments',  label: '부서',        icon: '🏢' },
  { to: '/messenger',    label: '메신저',      icon: '💬' },
  { to: '/sms',          label: '단체문자',    icon: '📱' },
  { to: '/directory',    label: '스마트 요람', icon: '📖' },
  { to: '/organization', label: '조직 현황',   icon: '🏛️' },
  { to: '/settings',     label: '교회 설정',   icon: '⚙️' },
  { to: '/admin',        label: '관리자',      icon: '🔑', adminOnly: true },
]

export const ROLE_ALLOWED = {
  super_admin:  null,
  church_admin: null,
  pastor:       ['/', '/members', '/communities', '/attendance', '/offering', '/budget', '/accounting', '/pastoral', '/calendar', '/departments', '/messenger', '/sms', '/directory', '/organization'],
  teacher:      ['/', '/members', '/communities', '/attendance', '/calendar', '/departments', '/messenger', '/directory', '/organization'],
  finance:      ['/', '/offering', '/budget', '/accounting', '/calendar', '/messenger'],
  member:       ['/', '/calendar', '/messenger', '/directory'],
}

const ROLE_LABEL = {
  super_admin:  '슈퍼 관리자',
  church_admin: '교회 관리자',
  pastor:       '교역자',
  teacher:      '교사',
  finance:      '재정',
  member:       '성도',
}

const NavConfigContext = createContext(null)
export const useNavConfig = () => useContext(NavConfigContext)

function buildVisibleNav(navConfig, roleFilteredNav) {
  if (!navConfig) return roleFilteredNav
  const roleFilteredTos = new Set(roleFilteredNav.map(n => n.to))
  const ordered = navConfig
    .filter(c => roleFilteredTos.has(c.to) && !c.hidden)
    .map(c => roleFilteredNav.find(n => n.to === c.to))
    .filter(Boolean)
  const configTos = new Set(navConfig.map(c => c.to))
  const missing = roleFilteredNav.filter(n => !configTos.has(n.to))
  return [...ordered, ...missing]
}

function buildEditItems(navConfig, roleFilteredNav) {
  if (navConfig && navConfig.length > 0) {
    const navMap = new Map(roleFilteredNav.map(n => [n.to, n]))
    const ordered = navConfig
      .filter(c => navMap.has(c.to))
      .map(c => ({ ...navMap.get(c.to), hidden: c.hidden ?? false }))
    const configTos = new Set(navConfig.map(c => c.to))
    const missing = roleFilteredNav
      .filter(n => !configTos.has(n.to))
      .map(n => ({ ...n, hidden: false }))
    return [...ordered, ...missing]
  }
  return roleFilteredNav.map(n => ({ ...n, hidden: false }))
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const storageKey = `sidebar_nav_${user?.id ?? 'default'}`
  const [navConfig, setNavConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  const saveNavConfig = (config) => {
    setNavConfig(config)
    localStorage.setItem(storageKey, JSON.stringify(config))
    prefsApi.patch({ sidebar_nav: config }).catch(() => {})
  }

  useEffect(() => {
    prefsApi.get().then(r => {
      if (r.data.sidebar_nav) {
        setNavConfig(r.data.sidebar_nav)
        localStorage.setItem(storageKey, JSON.stringify(r.data.sidebar_nav))
      }
    }).catch(() => {})
  }, []) // eslint-disable-line

  const allowed = user ? ROLE_ALLOWED[user.role] : []
  const roleFilteredNav = NAV_LIST.filter(item => {
    if (item.adminOnly) return user?.role === 'super_admin' || user?.role === 'church_admin'
    if (allowed === null) return true
    return allowed.includes(item.to)
  })

  const visibleNav = buildVisibleNav(navConfig, roleFilteredNav)

  // ── 사이드바 편집 모드 (대시보드 ⚙️ 기어로 제어) ──
  const [sidebarEdit, setSidebarEdit] = useState(false)
  const [editItems, setEditItems]     = useState(() => buildEditItems(navConfig, roleFilteredNav))

  // 편집 모드 진입 시 최신 설정으로 동기화
  useEffect(() => {
    if (sidebarEdit) setEditItems(buildEditItems(navConfig, roleFilteredNav))
  }, [sidebarEdit]) // eslint-disable-line

  // ── 드래그 상태 ──
  const [dragFrom,  setDragFrom]  = useState(null)
  const [dropIndex, setDropIndex] = useState(null)
  const [ghostItem, setGhostItem] = useState(null)
  const [ghostPos,  setGhostPos]  = useState({ x: 0, y: 0 })
  const itemRefs    = useRef([])
  const dropIdxRef  = useRef(null)

  const isNoOp = (from, di) => di === from || di === from + 1

  const startDrag = (e, idx) => {
    e.preventDefault()
    setDragFrom(idx)
    setDropIndex(idx)
    dropIdxRef.current = idx
    setGhostItem(editItems[idx])
    setGhostPos({ x: e.clientX, y: e.clientY })
    document.body.style.cursor     = 'grabbing'
    document.body.style.userSelect = 'none'

    const onMove = (ev) => {
      setGhostPos({ x: ev.clientX, y: ev.clientY })
      let di = 0
      itemRefs.current.forEach((el, i) => {
        if (!el) return
        const r = el.getBoundingClientRect()
        if (ev.clientY > r.top + r.height / 2) di = i + 1
      })
      dropIdxRef.current = di
      setDropIndex(di)
    }

    const onUp = () => {
      const from = idx
      const di   = dropIdxRef.current
      if (di !== null && !isNoOp(from, di)) {
        setEditItems(prev => {
          const next = [...prev]
          const [moved] = next.splice(from, 1)
          next.splice(di > from ? di - 1 : di, 0, moved)
          saveNavConfig(next.map(it => ({ to: it.to, hidden: it.hidden })))
          return next
        })
      }
      setDragFrom(null)
      setDropIndex(null)
      setGhostItem(null)
      dropIdxRef.current = null
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)
  }

  const toggleNavItem = (idx) => {
    setEditItems(prev => {
      const next = prev.map((item, i) => i === idx ? { ...item, hidden: !item.hidden } : item)
      saveNavConfig(next.map(it => ({ to: it.to, hidden: it.hidden })))
      return next
    })
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const showLine = (di) =>
    dragFrom !== null && dropIndex === di && !isNoOp(dragFrom, di)

  return (
    <NavConfigContext.Provider value={{ navConfig, saveNavConfig, roleFilteredNav, sidebarEdit, setSidebarEdit }}>
      <>
        <div className={styles.shell}>
          <aside className={styles.sidebar}>
            <div className={styles.logo}>⛪ 교회 관리</div>

            <nav className={styles.nav}>
              {sidebarEdit ? (
                <>
                  {showLine(0) && <div className={styles.dropLine} />}
                  {editItems.map((item, idx) => (
                    <Fragment key={item.to}>
                      <div
                        ref={el => { itemRefs.current[idx] = el }}
                        className={[
                          styles.navItem,
                          styles.navItemEditable,
                          item.hidden ? styles.navItemEditHidden : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <span className={styles.icon}>{item.icon}</span>
                        <span className={styles.navLabel}>{item.label}</span>
                        <div className={styles.sidebarEditActions}>
                          <span
                            className={styles.sidebarHandle}
                            onPointerDown={e => startDrag(e, idx)}
                            style={{ touchAction: 'none' }}
                          >⠿</span>
                          <button
                            className={`${styles.sidebarToggleBtn} ${item.hidden ? styles.sidebarRestoreBtn : styles.sidebarHideBtn}`}
                            onClick={() => toggleNavItem(idx)}
                          >
                            {item.hidden ? '✓' : '✕'}
                          </button>
                        </div>
                      </div>
                      {showLine(idx + 1) && <div className={styles.dropLine} />}
                    </Fragment>
                  ))}
                </>
              ) : (
                visibleNav.map(({ to, label, icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `${styles.navItem} ${isActive ? styles.active : ''}`
                    }
                  >
                    <span className={styles.icon}>{icon}</span>
                    {label}
                  </NavLink>
                ))
              )}
            </nav>

            <div className={styles.userFooter}>
              {user?.picture
                ? <img src={user.picture} className={styles.avatar} alt={user.name} referrerPolicy="no-referrer" />
                : <div className={styles.avatarFallback}>{user?.name?.[0] ?? '?'}</div>
              }
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user?.name}</span>
                <span className={styles.userRole}>{ROLE_LABEL[user?.role] ?? user?.role}</span>
              </div>
              <button className={styles.logoutBtn} onClick={handleLogout} title="로그아웃">↩</button>
            </div>
          </aside>

          <main className={styles.main}>
            <Outlet />
          </main>
        </div>

        {/* 드래그 고스트 카드 */}
        {ghostItem && (
          <div
            className={styles.sidebarGhost}
            style={{ left: ghostPos.x + 14, top: ghostPos.y - 18 }}
          >
            <span>{ghostItem.icon}</span>
            <span>{ghostItem.label}</span>
          </div>
        )}
      </>
    </NavConfigContext.Provider>
  )
}
