import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { communities as communityApi } from '../api'
import styles from './Layout.module.css'

const ROLE_LABEL = {
  super_admin:  '슈퍼 관리자',
  church_admin: '교회 관리자',
  pastor:       '교역자',
  teacher:      '교사',
  finance:      '재정',
  member:       '성도',
}

const ROLE_ALLOWED = {
  super_admin:  null,
  church_admin: null,
  pastor:       ['/', '/members', '/communities', '/attendance', '/offering', '/budget', '/accounting', '/pastoral', '/calendar', '/departments', '/messenger', '/sms', '/directory', '/organization'],
  teacher:      ['/', '/members', '/communities', '/attendance', '/calendar', '/departments', '/messenger', '/directory', '/organization'],
  finance:      ['/', '/offering', '/budget', '/accounting', '/calendar', '/messenger'],
  member:       ['/', '/calendar', '/messenger', '/directory'],
}

// 헌금관리/지출회계는 정적 자식 항목
const STATIC_CHILDREN = {
  '/offering': {
    subLabel: '헌금 관리',
    items: [
      { label: '헌금내역 입력',  to: '/offering/input' },
      { label: '헌금 정보조회', to: '/offering/history' },
      { label: '기부금 영수증', to: '/offering/receipt' },
    ],
  },
  '/accounting': {
    subLabel: '부서별',
    items: [
      { label: '총무부', dept: '총무부' },
      { label: '재정부', dept: '재정부' },
      { label: '교육부', dept: '교육부' },
      { label: '관리부', dept: '관리부' },
      { label: '차량부', dept: '차량부' },
      { label: '전도부', dept: '전도부' },
    ],
  },
}

const NAV = [
  { to: '/',             label: '대시보드',    icon: '🏠' },
  { to: '/members',      label: '교적 관리',   icon: '👥' },
  { to: '/communities',  label: '공동체/구역', icon: '🏘️', subLabel: '공동체 목록', dynKey: 'communities' },
  { to: '/attendance',   label: '출결 관리',   icon: '✅' },
  { to: '/offering',     label: '헌금 관리',   icon: '💰' },
  { to: '/budget',       label: '예산/장부',   icon: '📊' },
  { to: '/accounting',   label: '지출회계',    icon: '🧾' },
  { to: '/pastoral',     label: '심방 기록',   icon: '🙏' },
  { to: '/calendar',     label: '캘린더',      icon: '📅' },
  { to: '/departments',  label: '부서',        icon: '🏢' },
  { to: '/messenger',    label: '메신저',      icon: '💬' },
  { to: '/sms',          label: '단체문자',    icon: '📱' },
  { to: '/directory',    label: '스마트 요람', icon: '📖', subLabel: '셀 목록', dynKey: 'communities', dirMode: true },
  { to: '/organization', label: '조직 현황',   icon: '🏛️' },
  { to: '/settings',     label: '교회 설정',   icon: '⚙️' },
  { to: '/admin',        label: '관리자',      icon: '🔑', adminOnly: true },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()

  const [cells, setCells]       = useState([])        // cell 타입 공동체 목록
  const [expanded, setExpanded] = useState({})

  // 셀 목록 로드 (공동체/구역 & 스마트요람 2차 탭용)
  useEffect(() => {
    communityApi.list()
      .then(r => {
        const all = Array.isArray(r.data) ? r.data : []
        setCells(all.filter(c => c.type === 'cell'))
      })
      .catch(() => {})
  }, [])

  // 현재 경로 기준 자동 확장
  useEffect(() => {
    const p = location.pathname
    NAV.forEach(item => {
      const hasSub = item.dynKey || STATIC_CHILDREN[item.to]
      if (hasSub && item.to !== '/' && p.startsWith(item.to)) {
        setExpanded(prev => ({ ...prev, [item.to]: true }))
      }
    })
  }, [location.pathname])

  const toggle = (to) => setExpanded(prev => ({ ...prev, [to]: !prev[to] }))

  const allowed = user ? ROLE_ALLOWED[user.role] : []
  const visibleNav = NAV.filter(item => {
    if (item.adminOnly) return user?.role === 'super_admin' || user?.role === 'church_admin'
    if (allowed === null) return true
    return allowed.includes(item.to)
  })

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const handleSubClick = (item, sub) => {
    if (sub.to) {
      navigate(sub.to)
    } else if (sub.dept) {
      navigate(`/accounting?dept=${encodeURIComponent(sub.dept)}`)
    } else if (sub.id) {
      if (item.dirMode) {
        navigate(`/directory?cid=${sub.id}`)
      } else {
        navigate(`/communities/${sub.id}`)
      }
    }
  }

  const getSubItems = (item) => {
    if (item.dynKey === 'communities') return cells.map(c => ({ label: c.name, id: c.id }))
    return STATIC_CHILDREN[item.to]?.items ?? []
  }

  const getSubLabel = (item) =>
    item.subLabel ?? STATIC_CHILDREN[item.to]?.subLabel ?? ''

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>⛪ 교회 관리</div>
        <nav className={styles.nav}>
          {visibleNav.map(item => {
            const hasSub = !!(item.dynKey || STATIC_CHILDREN[item.to])
            const isExpanded = !!expanded[item.to]
            const subItems = hasSub ? getSubItems(item) : []

            return (
              <div key={item.to}>
                {/* 1차 탭 행 */}
                <div className={styles.navItemRow}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `${styles.navItem} ${isActive ? styles.active : ''}`
                    }
                  >
                    <span className={styles.icon}>{item.icon}</span>
                    {item.label}
                  </NavLink>
                  {hasSub && (
                    <button
                      className={styles.expandBtn}
                      onClick={() => toggle(item.to)}
                      title={isExpanded ? '접기' : '펼치기'}
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  )}
                </div>

                {/* 2차 탭 패널 — Organization infoSection/infoRow 스타일 그대로 */}
                {hasSub && isExpanded && (
                  <div className={styles.subSection}>
                    <div className={styles.subSectionHeader}>{getSubLabel(item)}</div>
                    <div className={styles.subSectionBody}>
                      {subItems.length === 0
                        ? <span className={styles.subEmpty}>없음</span>
                        : subItems.map((sub, i) => (
                          <div
                            key={sub.to || sub.dept || sub.id || i}
                            className={styles.subRow}
                            onClick={() => handleSubClick(item, sub)}
                          >
                            <span className={styles.subRowName}>{sub.label}</span>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
            )
          })}
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
  )
}
