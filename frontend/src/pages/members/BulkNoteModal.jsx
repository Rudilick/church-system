import { useState } from 'react'
import { members as api } from '../../api'
import toast from 'react-hot-toast'
import styles from './Members.module.css'

// 선택된 여러 교인에게 동일한 특이사항을 한 번에 등록
export default function BulkNoteModal({ members, onClose, onDone }) {
  const [content, setContent]         = useState('')
  const [isSensitive, setIsSensitive] = useState(false)
  const [saving, setSaving]           = useState(false)

  if (!members) return null

  const handleSubmit = async () => {
    if (!content.trim()) { toast.error('내용을 입력하세요.'); return }
    setSaving(true)
    try {
      await Promise.all(members.map(m => api.addNote(m.id, content.trim(), { is_sensitive: isSensitive })))
      toast.success(`${members.length}명에게 특이사항을 등록했습니다.`)
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
          <span>특이사항 일괄 등록 — {members.length}명</span>
          <button className={styles.bulkClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.bulkBody}>
          <div className={styles.formGroup}>
            <label>대상</label>
            <div style={{ fontSize: '0.85rem', color: '#475569' }}>
              {members.map(m => m.name).join(', ')}
            </div>
          </div>
          <div className={styles.formGroup}>
            <label>내용 *</label>
            <textarea rows={4} value={content} onChange={e => setContent(e.target.value)}
              placeholder="선택된 모든 교인에게 동일하게 기록될 특이사항" />
          </div>
          <label className={styles.noteEventCheck} style={{ color: '#7c3aed' }}>
            <input type="checkbox" checked={isSensitive} onChange={e => setIsSensitive(e.target.checked)} />
            🔒 민감정보보호
          </label>
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
