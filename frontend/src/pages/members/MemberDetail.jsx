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
      {/* 왼쪽 패널 */}
      <div className={styles.detailLeft}>

        {/* 인적사항 카드 (고정 높이, 스크롤 없음) */}
        <div className={styles.detailLeftInfo}>
          <div className={styles.profileCard}>

            {/* 카드 헤더: 뒤로가기 + 소제목 */}
            <div className={styles.profileCardHeader}>
              <Link to="/members" className={styles.backLink}>← 교인 목록</Link>
              <span className={styles.sectionTitle} style={{ margin: 0 }}>인적사항</span>
            </div>

            {/* 사진 + 이름 | 수정/삭제 + 소그룹 */}
            <div className={styles.profileCardTop}>
              <div className={styles.profileCardPhotoName}>
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
                    {member.name_en && <small style={{ fontWeight: 400, fontSize: '0.9rem', marginLeft: 6, color: '#94a3b8' }}>{member.name_en}</small>}
                  </div>
                  {member.note && <p style={{ marginTop: 6, fontSize: '0.85rem', color: '#475569', margin: '6px 0 0' }}>{member.note}</p>}
                </div>
              </div>
              <div className={styles.profileCardActions}>
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

            {/* 2열 정보 그리드 */}
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

          </div>
        </div>

        {/* 특이사항 카드 (남은 공간 + 내부 스크롤) */}
        <div className={styles.detailLeftSection}>
          <div className={styles.noteCard}>
            <div className={styles.noteCardHead}>
              <span className={styles.sectionTitle} style={{ margin: 0 }}>특이사항</span>
            </div>
            <div className={styles.noteCardScroll}>
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
          </div>
        </div>
      </div>

      {/* 오른쪽 패널 */}
      <div className={styles.detailRight}>

        {/* 가계도 카드 */}
        <div className={styles.detailRightTop}>
          <div className={styles.rightCard}>
            <div className={styles.rightCardHead}>
              <span className={styles.sectionTitle} style={{ margin: 0 }}>관계도</span>
            </div>
            <div className={styles.rightCardBody}>
              <FamilyTree memberId={Number(id)} />
            </div>
          </div>
        </div>

        {/* 위치도 카드 */}
        <div className={styles.detailRightBottom}>
          <div className={styles.rightCard}>
            <div className={styles.rightCardHead}>
              <span className={styles.sectionTitle} style={{ margin: 0 }}>위치도</span>
            </div>
            <div className={styles.rightCardBody}>
              <KakaoMap address={fullAddress || null} />
            </div>
          </div>
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
