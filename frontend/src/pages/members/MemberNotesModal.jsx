import { useEffect, useRef, useState } from 'react'
import { members as api } from '../../api'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import styles from './Members.module.css'

// 특이사항 모달 — 개인교적상세(MemberDetail)의 특이사항 기능을 모달 환경(스크롤 목록)에 맞게 재구성
export default function MemberNotesModal({ member, onClose }) {
  const [notes, setNotes]                     = useState([])
  const [noteText, setNoteText]               = useState('')
  const [noteIsEvent, setNoteIsEvent]         = useState(false)
  const [noteEventDate, setNoteEventDate]     = useState('')
  const [noteEventTitle, setNoteEventTitle]   = useState('')
  const [noteIsSensitive, setNoteIsSensitive] = useState(false)
  const [noteSaving, setNoteSaving]           = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (!member) return
    setNotes([])
    setNoteText('')
    setNoteIsEvent(false)
    setNoteEventDate('')
    setNoteEventTitle('')
    setNoteIsSensitive(false)
    api.notes(member.id).then(r => setNotes(r.data)).catch(() => {})
  }, [member])

  const handleAddNote = async () => {
    if (!noteText.trim()) return
    if (noteIsEvent && (!noteEventDate || !noteEventTitle.trim())) {
      toast.error('일정 날짜와 제목을 입력해 주세요.')
      return
    }
    setNoteSaving(true)
    try {
      const eventData = noteIsEvent
        ? { is_event: true, event_date: noteEventDate, event_title: noteEventTitle }
        : {}
      const r = await api.addNote(member.id, noteText, { ...eventData, is_sensitive: noteIsSensitive })
      setNotes(prev => [r.data, ...prev])
      setNoteText('')
      setNoteIsEvent(false)
      setNoteEventDate('')
      setNoteEventTitle('')
      setNoteIsSensitive(false)
      textareaRef.current?.focus()
    } catch {
      toast.error('저장하지 못했습니다.')
    } finally {
      setNoteSaving(false)
    }
  }

  const handleDeleteNote = async (noteId) => {
    if (!confirm('이 특이사항을 삭제하시겠습니까?')) return
    await api.removeNote(member.id, noteId).catch(() => toast.error('삭제 실패'))
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  if (!member) return null

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.bulkModal} onClick={e => e.stopPropagation()}>
        <div className={styles.bulkModalHeader}>
          <span>{member.name} — 특이사항</span>
          <button className={styles.bulkClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.bulkBody}>
          <div className={styles.noteList}>
            {notes.map(n => (
              <div key={n.id} className={`${styles.noteItem} ${n.event_id ? styles.noteItemEvent : ''} ${n.is_sensitive ? styles.noteItemSensitive : ''}`}>
                {(n.event_id || n.is_sensitive) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                    {n.event_id && <span className={styles.noteEventBadge}>📅 {n.event_date ? dayjs(n.event_date).format('YYYY.MM.DD') : n.event_title}</span>}
                    {n.is_sensitive && <span className={styles.noteSensitiveBadge}>🔒 민감정보</span>}
                  </div>
                )}
                <span
                  className={styles.noteContent}
                  style={n.is_sensitive ? { filter: 'blur(4px)', userSelect: 'none' } : {}}
                >{n.content}</span>
                <span className={styles.noteMeta}>
                  <span className={styles.noteDate}>{'<'}{dayjs(n.created_at).format('YYYY.MM.DD.')}{'>'}</span>
                  {n.author_name && <span className={styles.noteAuthor}>{n.author_name}</span>}
                  <button className={styles.noteDeleteBtn} onClick={() => handleDeleteNote(n.id)}>⊖</button>
                </span>
              </div>
            ))}
            {notes.length === 0 && (
              <div className={styles.noteEmpty}>등록된 특이사항이 없습니다</div>
            )}
          </div>

          {/* 입력 영역 */}
          <div className={styles.noteInputArea}>
            <div className={styles.noteInputBox}>
              <div className={styles.noteInputTop}>
                <label className={styles.noteEventCheck}>
                  <input
                    type="checkbox"
                    checked={noteIsEvent}
                    onChange={e => setNoteIsEvent(e.target.checked)}
                  />
                  📅 일정으로 등록
                </label>
                <label className={styles.noteEventCheck} style={{ color: '#7c3aed' }}>
                  <input
                    type="checkbox"
                    checked={noteIsSensitive}
                    onChange={e => setNoteIsSensitive(e.target.checked)}
                  />
                  🔒 민감정보보호
                </label>
                {noteIsEvent && (
                  <>
                    <input
                      type="date"
                      className={styles.noteEventDateIcon}
                      value={noteEventDate}
                      onChange={e => setNoteEventDate(e.target.value)}
                    />
                    <input
                      className={styles.noteEventTitleInput}
                      value={noteEventTitle}
                      onChange={e => setNoteEventTitle(e.target.value)}
                      placeholder="캘린더 표시 제목"
                    />
                  </>
                )}
              </div>
              <div className={styles.noteInputRow}>
                <textarea
                  ref={textareaRef}
                  className={styles.noteTextarea}
                  placeholder={noteIsEvent ? '일정 내용' : '특이사항을 입력하세요...'}
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddNote()
                  }}
                  rows={3}
                />
                <button
                  className={styles.noteSubmitBtn}
                  onClick={handleAddNote}
                  disabled={noteSaving || !noteText.trim()}
                >
                  {noteSaving ? '저장\n중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
