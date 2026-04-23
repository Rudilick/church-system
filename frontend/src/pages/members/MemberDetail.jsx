import { useEffect, useState, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { members as api } from '../../api'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import styles from './Members.module.css'
import FamilyTree from './FamilyTree'
import KakaoMap from './KakaoMap'

export default function MemberDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [member, setMember] = useState(null)
  const [notes, setNotes] = useState([])
  const [noteText, setNoteText] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    api.get(id).then(r => setMember(r.data)).catch(() => toast.error('교인 정보를 불러오지 못했습니다.'))
    api.notes(id).then(r => setNotes(r.data)).catch(() => {})
  }, [id])

  const handleAddNote = async () => {
    if (!noteText.trim()) return
    setNoteSaving(true)
    try {
      const r = await api.addNote(id, noteText)
      setNotes(prev => [r.data, ...prev])
      setNoteText('')
      textareaRef.current?.focus()
    } catch {
      toast.error('저장하지 못했습니다.')
    } finally {
      setNoteSaving(false)
    }
  }

  const handleDeleteNote = async (noteId) => {
    if (!confirm('이 특이사항을 삭제하시겠습니까?')) return
    await api.removeNote(id, noteId).catch(() => toast.error('삭제 실패'))
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  if (!member) return <div>불러오는 중...</div>

  const handleDelete = async () => {
    if (!confirm(`${member.name} 교인을 삭제하시겠습니까?`)) return
    await api.remove(id)
    toast.success('삭제했습니다.')
    navigate('/members')
  }

  const fullAddress = [member.address, member.address_detail].filter(Boolean).join(' ')

  return (
    <div className={styles.detailOuter}>
      {/* 왼쪽: 3개 섹션 (각각 내부 스크롤) */}
      <div className={styles.detailLeft}>

        {/* 섹션 1: 개인 인적사항 (고정, 스크롤 없음) */}
        <div className={styles.detailLeftInfo}>
          <Link to="/members" className={styles.backLink}>← 교인 목록</Link>
          <div className={styles.profileCard}>
            {member.photo_url
              ? <img src={member.photo_url} alt={member.name} className={styles.profilePhoto} />
              : <div className={styles.profilePhotoPlaceholder}
                  style={{ background: member.gender === 'M' ? '#3b82f6' : member.gender === 'F' ? '#ec4899' : '#64748b' }}>
                  {member.name[0]}
                </div>
            }
            <div className={styles.profileInfo}>
              <div className={styles.profileName}>
                {member.name}
                {member.name_en && <small style={{ fontWeight: 400, fontSize: '0.9rem', marginLeft: 8, color: '#94a3b8' }}>{member.name_en}</small>}
              </div>
              <div className={styles.infoGrid}>
                <InfoItem label="성별"    value={member.gender === 'M' ? '남' : member.gender === 'F' ? '여' : '-'} />
                <InfoItem label="생년월일" value={member.birth_date ? dayjs(member.birth_date).format('YYYY년 MM월 DD일') + (member.birth_lunar ? ' (음력)' : '') : '-'} />
                <InfoItem label="연락처"  value={member.phone ?? '-'} />
                <InfoItem label="이메일"  value={member.email ?? '-'} />
                <InfoItem label="직분"    value={member.position ?? '-'} />
                <InfoItem label="등록일"  value={member.registered_at ? dayjs(member.registered_at).format('YYYY.MM.DD') : '-'} />
                <InfoItem label="세례일"  value={member.baptism_date ? dayjs(member.baptism_date).format('YYYY.MM.DD') : '-'} />
                <InfoItem label="직장"    value={member.workplace ?? '-'} />
                <InfoItem label="학교"    value={member.school ?? '-'} />
                <InfoItem label="주소"    value={fullAddress || '-'} />
              </div>
              {member.note && <p style={{ marginTop: 12, fontSize: '0.875rem', color: '#475569' }}>{member.note}</p>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'flex-start', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to={`/members/${id}/edit`} className={styles.btnSecondary}>수정</Link>
                <button className={styles.btnSecondary} style={{ color: '#ef4444', borderColor: '#fca5a5' }} onClick={handleDelete}>삭제</button>
              </div>
              {member.communities?.length > 0 && (
                <div className={styles.communityInCard}>
                  {member.communities.map(c => (
                    <Link key={c.id} to={`/communities/${c.id}`} className={styles.communityBadge}>
                      {c.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 섹션 2: 특이사항 (나머지 공간 + 내부 스크롤) */}
        <div className={styles.detailLeftSection}>
          <div className={styles.sectionTitle}>특이사항</div>
          <div className={styles.noteInputWrap}>
            <textarea
              ref={textareaRef}
              className={styles.noteTextarea}
              placeholder="특이사항을 입력하세요..."
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
              {noteSaving ? '저장 중...' : '저장'}
            </button>
          </div>
          {notes.length > 0 && (
            <div className={styles.noteList}>
              {notes.map(n => (
                <div key={n.id} className={styles.noteItem}>
                  <div className={styles.noteContent}>{n.content}</div>
                  <div className={styles.noteMeta}>
                    <span>{dayjs(n.created_at).format('YYYY.MM.DD HH:mm')}</span>
                    <button className={styles.noteDeleteBtn} onClick={() => handleDeleteNote(n.id)}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 오른쪽: 가계도(상단 50%) + 카카오 지도(하단 50%) */}
      <div className={styles.detailRight}>
        <div className={styles.detailRightTop}>
          <FamilyTree memberId={Number(id)} />
        </div>
        <div className={styles.detailRightBottom}>
          <KakaoMap address={fullAddress || null} />
        </div>
      </div>
    </div>
  )
}

function InfoItem({ label, value }) {
  return (
    <div className={styles.infoItem}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{value}</span>
    </div>
  )
}
