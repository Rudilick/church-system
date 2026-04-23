import { Outlet, NavLink } from 'react-router-dom'
import styles from './Layout.module.css'

const nav = [
  { to: '/',            label: '대시보드',    icon: '🏠' },
  { to: '/members',     label: '교적 관리',   icon: '👥' },
  { to: '/communities', label: '공동체/구역', icon: '🏘️' },
  { to: '/attendance',  label: '출결 관리',   icon: '✅' },
  { to: '/offering',    label: '헌금 관리',   icon: '💰' },
  { to: '/budget',      label: '예산/장부',   icon: '📊' },
  { to: '/pastoral',    label: '심방 기록',   icon: '🙏' },
  { to: '/calendar',    label: '캘린더',      icon: '📅' },
  { to: '/departments', label: '부서',        icon: '🏢' },
  { to: '/messenger',   label: '메신저',      icon: '💬' },
  { to: '/sms',         label: '단체문자',    icon: '📱' },
  { to: '/directory',   label: '스마트 요람', icon: '📖' },
  { to: '/organization', label: '조직 현황',  icon: '🏛️' },
]

export default function Layout() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>⛪ 교회 관리</div>
        <nav>
          {nav.map(({ to, label, icon }) => (
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
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
