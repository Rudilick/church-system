import { createContext, useContext, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
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
  }

  const allowed = user ? ROLE_ALLOWED[user.role] : []
  const roleFilteredNav = NAV_LIST.filter(item => {
    if (item.adminOnly) return user?.role === 'super_admin' || user?.role === 'church_admin'
    if (allowed === null) return true
    return allowed.includes(item.to)
  })

  const visibleNav = buildVisibleNav(navConfig, roleFilteredNav)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <NavConfigContext.Provider value={{ navConfig, saveNavConfig, roleFilteredNav }}>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.logo}>⛪ 교회 관리</div>
          <nav className={styles.nav}>
            {visibleNav.map(({ to, label, icon }) => (
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
            ))}
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
    </NavConfigContext.Provider>
  )
}
