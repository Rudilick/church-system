import { useState } from 'react'
import { pastoral as api } from '../../api'
import toast from 'react-hot-toast'
import styles from './Members.module.css'

const VISIT_TYPES = ['가정', '병원', '이사', '개업', '전화', '구역', '기타']

// 선택된 여러 교인에게 동일한 심방 내용을 한 번에 등록
export default function BulkVisitModal({ members, onClose, onDone }) {
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10))
  const [visitType, setVisitType] = useState('가정')
  const [location, setLocation]   = useState('')
  const [content, setContent]     = useState('')
  const [saving, setSaving]       = useState(false)

  if (!members) return null

  const handleSubmit = async () => {
    if (!content.trim()) { toast.error('심방 내용을 입력하세요.'); return }
    setSaving(true)
    try {
      await Promise.all(members.map(m => api.add({
        member_id: m.id,
        visit_date: visitDate,
        visit_type: visitType,
        location: location || undefined,
        content: content.trim(),
      })))
      toast.success(`${members.length}명에게 심방 기록을 등록했습니다.`)
      onDone?.()
      onClose()
    } catch {
      toast.error('일부 등록에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.bulkModal} onClick={e => e.stopPropagation()}>
        <div className={styles.bulkModalHeader}>
          <span>심방 일괄 등록 — {members.length}명</span>
          <button className={styles.bulkClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.bulkBody}>
          <div className={styles.formGroup}>
            <label>대상</label>
            <div style={{ fontSize: '0.85rem', color: '#475569' }}>
              {members.map(m => m.name).join(', ')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label>날짜 *</label>
              <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} />
            </div>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label>구분</label>
              <select value={visitType} onChange={e => setVisitType(e.target.value)}>
                {VISIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label>장소</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="선택사항" />
          </div>
          <div className={styles.formGroup}>
            <label>내용 *</label>
            <textarea rows={4} value={content} onChange={e => setContent(e.target.value)}
              placeholder="선택된 모든 교인에게 동일하게 기록될 심방 내용" />
          </div>
          <div className={styles.formActions}>
            <button className={styles.btnSecondary} onClick={onClose}>취소</button>
            <button className={styles.btnPrimary} onClick={handleSubmit} disabled={saving}>
              {saving ? '등록 중...' : `${members.length}명 등록`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
