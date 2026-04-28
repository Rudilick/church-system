import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { settings as settingsApi, positions as positionsApi, enumValues as enumValuesApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import OrgManager from './OrgManager'
import styles from './Settings.module.css'

const FIELDS = [
  { key: 'church_name', label: '교회명 (단체명)',           placeholder: '○○교회' },
  { key: 'unique_id',   label: '고유번호 (사업자등록번호)', placeholder: '000-00-00000' },
  { key: 'address',     label: '소재지',                   placeholder: '서울특별시 …' },
  { key: 'pastor_name', label: '담임목사',                  placeholder: '홍길동' },
  { key: 'member_pin',  label: '상세정보 열람 암호키',      placeholder: '기본값: 0000', type: 'password' },
]

function ChurchInfo() {
  const { user } = useAuth()
  const canEditPin = ['super_admin', 'church_admin', 'pastor'].includes(user?.role)
  const [form, setForm]       = useState({ church_name: '', unique_id: '', address: '', pastor_name: '', member_pin: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    settingsApi.get()
      .then(r => setForm(r.data))
      .catch(() => toast.error('설정을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsApi.update(form)
      toast.success('저장됐습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>교회 기본 정보</h2>
      {loading ? (
        <p className={styles.loading}>불러오는 중…</p>
      ) : (
        <div className={styles.fields}>
          {FIELDS.filter(f => f.key !== 'member_pin' || canEditPin).map(({ key, label, placeholder, type }) => (
            <label key={key} className={styles.field}>
              <span className={styles.fieldLabel}>{label}</span>
              <input
                className={styles.input}
                type={type ?? 'text'}
                value={form[key] ?? ''}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
              />
            </label>
          ))}
        </div>
      )}
      <button className={styles.saveBtn} onClick={handleSave} disabled={saving || loading}>
        {saving ? '저장 중…' : '저장'}
      </button>
    </div>
  )
}

const CATEGORY_LABELS = { pastoral: '목회자', deacon: '제직', other: '기타' }

function PositionsManager() {
  const [list, setList]   = useState([])
  const [newName, setNewName]     = useState('')
  const [newCategory, setNewCategory] = useState('deacon')
  const [saving, setSaving] = useState(false)

  const load = () => positionsApi.list({ active: 'false' }).then(r => setList(Array.isArray(r.data) ? r.data : [])).catch(() => {})
  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await positionsApi.create({ name: newName.trim(), category: newCategory, display_order: list.length })
      setNewName('')
      toast.success('직분을 추가했습니다.')
      load()
    } catch { toast.error('추가에 실패했습니다.') } finally { setSaving(false) }
  }

  const toggleActive = async (item) => {
    try {
      await positionsApi.update(item.id, { is_active: !item.is_active })
      load()
    } catch { toast.error('변경에 실패했습니다.') }
  }

  const handleDelete = async (item) => {
    try {
      const r = await positionsApi.remove(item.id)
      toast.success(r.data.message)
      load()
    } catch { toast.error('삭제에 실패했습니다.') }
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>직분 관리</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          className={styles.input} style={{ flex: 1 }}
          value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="새 직분명 (예: 강도사)"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <select
          className={styles.input} style={{ width: 110 }}
          value={newCategory} onChange={e => setNewCategory(e.target.value)}
        >
          <option value="pastoral">목회자</option>
          <option value="deacon">제직</option>
          <option value="other">기타</option>
        </select>
        <button className={styles.saveBtn} onClick={handleAdd} disabled={saving || !newName.trim()}>추가</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
            <th style={{ textAlign: 'left', padding: '6px 8px' }}>직분명</th>
            <th style={{ textAlign: 'left', padding: '6px 8px' }}>분류</th>
            <th style={{ textAlign: 'center', padding: '6px 8px' }}>활성</th>
            <th style={{ padding: '6px 8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {list.map(item => (
            <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: item.is_active ? 1 : 0.45 }}>
              <td style={{ padding: '8px 8px' }}>{item.name}</td>
              <td style={{ padding: '8px 8px', color: '#6b7280', fontSize: '0.82rem' }}>
                {CATEGORY_LABELS[item.category] ?? item.category}
              </td>
              <td style={{ textAlign: 'center', padding: '8px 8px' }}>
                <input type="checkbox" checked={item.is_active} onChange={() => toggleActive(item)} />
              </td>
              <td style={{ textAlign: 'right', padding: '8px 8px' }}>
                <button
                  onClick={() => handleDelete(item)}
                  style={{ fontSize: '0.78rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                >삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EnumSection({ enumType, title }) {
  const [list, setList]   = useState([])
  const [newVal, setNewVal] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => enumValuesApi.list(enumType).then(r => {
    const data = Array.isArray(r.data) ? r.data : []
    setList(data.filter(x => x.enum_type === enumType))
  }).catch(() => {})
  useEffect(() => { load() }, [enumType])

  const handleAdd = async () => {
    if (!newVal.trim()) return
    setSaving(true)
    try {
      await enumValuesApi.create({ enum_type: enumType, value: newVal.trim(), display_order: list.length })
      setNewVal('')
      toast.success('추가했습니다.')
      load()
    } catch { toast.error('추가에 실패했습니다.') } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try {
      await enumValuesApi.remove(id)
      toast.success('삭제했습니다.')
      load()
    } catch { toast.error('삭제에 실패했습니다.') }
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#374151', marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          className={styles.input} style={{ flex: 1 }}
          value={newVal} onChange={e => setNewVal(e.target.value)}
          placeholder={`새 ${title} 추가`}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button className={styles.saveBtn} onClick={handleAdd} disabled={saving || !newVal.trim()}>추가</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {list.map(item => (
          <span key={item.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#f1f5f9', borderRadius: 20, padding: '4px 12px',
            fontSize: '0.88rem', color: '#334155',
          }}>
            {item.value}
            <button
              onClick={() => handleDelete(item.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', lineHeight: 1, padding: 0, fontSize: '0.9rem' }}
            >×</button>
          </span>
        ))}
        {list.length === 0 && <span style={{ color: '#94a3b8', fontSize: '0.88rem' }}>항목 없음</span>}
      </div>
    </div>
  )
}

function EnumManager() {
  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>분류 설정</h2>
      <EnumSection enumType="membership_category" title="교인구분" />
      <EnumSection enumType="faith_level" title="신급" />
    </div>
  )
}

const TABS = [
  { key: 'church',    label: '교회 기본 정보' },
  { key: 'org',       label: '조직 관리' },
  { key: 'positions', label: '직분 관리' },
  { key: 'enums',     label: '분류 설정' },
]

export default function Settings() {
  const [tab, setTab] = useState('church')

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>교회 설정</h1>

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'church'    && <ChurchInfo />}
      {tab === 'org'       && <OrgManager />}
      {tab === 'positions' && <PositionsManager />}
      {tab === 'enums'     && <EnumManager />}
    </div>
  )
}
