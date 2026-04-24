import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { admin as adminApi } from '../../api'
import styles from './Admin.module.css'

const ROLE_LABEL = {
  super_admin:  '슈퍼 관리자',
  church_admin: '교회 관리자',
  pastor:       '교역자',
  teacher:      '교사',
  finance:      '재정',
  member:       '성도',
}

const ROLES = Object.entries(ROLE_LABEL)

// ── 대시보드 탭 ─────────────────────────────────────────────
function DashboardTab() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    adminApi.userStats().then(r => setStats(r.data)).catch(() => toast.error('통계 로드 실패'))
  }, [])

  if (!stats) return <p className={styles.loading}>불러오는 중...</p>

  return (
    <div className={styles.dashGrid}>
      <div className={styles.statCard}>
        <span className={styles.statNum}>{stats.total}</span>
        <span className={styles.statLabel}>전체 사용자</span>
      </div>
      <div className={styles.statCard}>
        <span className={styles.statNum}>{stats.active}</span>
        <span className={styles.statLabel}>활성 사용자</span>
      </div>
      {stats.byRole.map(r => (
        <div key={r.role} className={styles.statCard}>
          <span className={styles.statNum}>{r.count}</span>
          <span className={styles.statLabel}>{ROLE_LABEL[r.role] ?? r.role}</span>
        </div>
      ))}
    </div>
  )
}

// ── 사용자 관리 탭 ───────────────────────────────────────────
function UsersTab() {
  const [users, setUsers]     = useState([])
  const [q, setQ]             = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]       = useState({ email: '', name: '', google_user_id: '', role: 'member', department: '' })
  const [saving, setSaving]   = useState(false)

  const load = (search = '') =>
    adminApi.users(search).then(r => setUsers(r.data)).catch(() => toast.error('사용자 목록 로드 실패'))

  useEffect(() => { load() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await adminApi.createUser(form)
      toast.success('사용자가 등록되었습니다.')
      setShowForm(false)
      setForm({ email: '', name: '', google_user_id: '', role: 'member', department: '' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.error ?? '등록 실패')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(user) {
    try {
      await adminApi.updateUser(user.id, { is_active: !user.is_active })
      toast.success(user.is_active ? '비활성화했습니다.' : '활성화했습니다.')
      load(q)
    } catch (err) {
      toast.error(err.response?.data?.error ?? '수정 실패')
    }
  }

  async function handleDelete(user) {
    if (!window.confirm(`${user.name}(${user.email}) 계정을 비활성화하시겠습니까?`)) return
    try {
      await adminApi.deleteUser(user.id)
      toast.success('비활성화되었습니다.')
      load(q)
    } catch (err) {
      toast.error(err.response?.data?.error ?? '비활성화 실패')
    }
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          placeholder="이메일 또는 이름 검색"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(q)}
        />
        <button className={styles.searchBtn} onClick={() => load(q)}>검색</button>
        <button className={styles.addBtn} onClick={() => setShowForm(v => !v)}>
          {showForm ? '취소' : '+ 사용자 등록'}
        </button>
      </div>

      {showForm && (
        <form className={styles.form} onSubmit={handleCreate}>
          <h3 className={styles.formTitle}>새 사용자 등록</h3>
          <div className={styles.formGrid}>
            <label>
              이메일 *
              <input required value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
            </label>
            <label>
              이름 *
              <input required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
            </label>
            <label>
              Google 계정 ID (sub)
              <input value={form.google_user_id} onChange={e => setForm(f => ({...f, google_user_id: e.target.value}))} placeholder="로그인 후 서버 로그에서 확인" />
            </label>
            <label>
              역할
              <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}>
                {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label>
              부서
              <input value={form.department} onChange={e => setForm(f => ({...f, department: e.target.value}))} />
            </label>
          </div>
          <button className={styles.saveBtn} type="submit" disabled={saving}>
            {saving ? '등록 중...' : '등록'}
          </button>
        </form>
      )}

      <table className={styles.table}>
        <thead>
          <tr>
            <th>이름</th>
            <th>이메일</th>
            <th>역할</th>
            <th>부서</th>
            <th>상태</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 && (
            <tr><td colSpan={6} className={styles.empty}>사용자가 없습니다.</td></tr>
          )}
          {users.map(u => (
            <tr key={u.id}>
              <td>
                <div className={styles.nameCell}>
                  {u.picture && <img src={u.picture} alt="" className={styles.miniAvatar} />}
                  {u.name}
                </div>
              </td>
              <td>{u.email}</td>
              <td>{ROLE_LABEL[u.role] ?? u.role}</td>
              <td>{u.department ?? '-'}</td>
              <td>
                <span className={u.is_active ? styles.active : styles.inactive}>
                  {u.is_active ? '활성' : '비활성'}
                </span>
              </td>
              <td>
                <button className={styles.toggleBtn} onClick={() => handleToggleActive(u)}>
                  {u.is_active ? '비활성화' : '활성화'}
                </button>
                {u.is_active && (
                  <button className={styles.deleteBtn} onClick={() => handleDelete(u)}>삭제</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── 권한 관리 탭 ─────────────────────────────────────────────
function PermissionsTab() {
  const [users, setUsers] = useState([])
  const [saving, setSaving] = useState({})

  useEffect(() => {
    adminApi.users().then(r => setUsers(r.data)).catch(() => toast.error('사용자 목록 로드 실패'))
  }, [])

  async function handleChange(userId, field, value) {
    setSaving(s => ({...s, [userId]: true}))
    try {
      await adminApi.updateUser(userId, { [field]: value === '' ? null : value })
      setUsers(prev => prev.map(u => u.id === userId ? {...u, [field]: value} : u))
      toast.success('저장되었습니다.')
    } catch (err) {
      toast.error(err.response?.data?.error ?? '저장 실패')
    } finally {
      setSaving(s => ({...s, [userId]: false}))
    }
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>이름</th>
          <th>이메일</th>
          <th>역할</th>
          <th>교회 ID</th>
          <th>부서</th>
          <th>활성</th>
        </tr>
      </thead>
      <tbody>
        {users.length === 0 && (
          <tr><td colSpan={6} className={styles.empty}>사용자가 없습니다.</td></tr>
        )}
        {users.map(u => (
          <tr key={u.id} className={saving[u.id] ? styles.saving : ''}>
            <td>
              <div className={styles.nameCell}>
                {u.picture && <img src={u.picture} alt="" className={styles.miniAvatar} />}
                {u.name}
              </div>
            </td>
            <td>{u.email}</td>
            <td>
              <select
                value={u.role ?? 'member'}
                onChange={e => handleChange(u.id, 'role', e.target.value)}
              >
                {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </td>
            <td>
              <input
                type="number"
                className={styles.churchIdInput}
                value={u.church_id ?? 1}
                onChange={e => handleChange(u.id, 'church_id', Number(e.target.value))}
              />
            </td>
            <td>
              <input
                className={styles.deptInput}
                value={u.department ?? ''}
                onChange={e => handleChange(u.id, 'department', e.target.value)}
                onBlur={e => {
                  if (e.target.value !== (u.department ?? '')) {
                    handleChange(u.id, 'department', e.target.value)
                  }
                }}
              />
            </td>
            <td>
              <input
                type="checkbox"
                checked={!!u.is_active}
                onChange={e => handleChange(u.id, 'is_active', e.target.checked)}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── 메인 Admin 컴포넌트 ──────────────────────────────────────
export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('dashboard')

  useEffect(() => {
    if (user && user.role !== 'super_admin' && user.role !== 'church_admin') {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  const tabs = [
    { key: 'dashboard',    label: '대시보드' },
    { key: 'users',        label: '사용자 관리' },
    { key: 'permissions',  label: '권한 관리' },
  ]

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>관리자 패널</h2>
      <div className={styles.tabs}>
        {tabs.map(t => (
          <button
            key={t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={styles.content}>
        {tab === 'dashboard'   && <DashboardTab />}
        {tab === 'users'       && <UsersTab />}
        {tab === 'permissions' && <PermissionsTab />}
      </div>
    </div>
  )
}
