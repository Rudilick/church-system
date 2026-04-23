import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { settings as settingsApi } from '../../api'
import styles from './Settings.module.css'

const FIELDS = [
  { key: 'church_name', label: '교회명 (단체명)',           placeholder: '○○교회' },
  { key: 'unique_id',   label: '고유번호 (사업자등록번호)', placeholder: '000-00-00000' },
  { key: 'address',     label: '소재지',                   placeholder: '서울특별시 …' },
  { key: 'pastor_name', label: '담임목사',                  placeholder: '홍길동' },
]

export default function Settings() {
  const [form, setForm]     = useState({ church_name: '', unique_id: '', address: '', pastor_name: '' })
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
    <div className={styles.page}>
      <h1 className={styles.title}>교회 설정</h1>
      <p className={styles.desc}>
        저장한 정보는 기부금영수증 등 시스템 전체에서 자동으로 사용됩니다.
      </p>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>교회 기본 정보</h2>

        {loading ? (
          <p className={styles.loading}>불러오는 중…</p>
        ) : (
          <div className={styles.fields}>
            {FIELDS.map(({ key, label, placeholder }) => (
              <label key={key} className={styles.field}>
                <span className={styles.fieldLabel}>{label}</span>
                <input
                  className={styles.input}
                  value={form[key]}
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
    </div>
  )
}
