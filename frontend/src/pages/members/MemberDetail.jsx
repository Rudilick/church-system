import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { members as api, departments as deptApi, settings as settingsApi, communities as communityApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { genderColor, calcWesternAge, displayPosition } from '../../utils'
import { useIsMobile } from '../../hooks/useIsMobile'
import { usePositionRanks, positionRankColor } from '../../hooks/usePositionRanks'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import styles from './Members.module.css'
import KakaoMap from './KakaoMap'
import MemberPrintReport from './MemberPrintReport'
import DeleteGuardModal from '../../components/DeleteGuardModal'
import { useDeleteGuard } from '../../hooks/useDeleteGuard'

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  )
}

function NoteItem({ n, showAll, onDelete, onEdit }) {
  return (
    <div className={`${styles.noteItem} ${n.event_id ? styles.noteItemEvent : ''} ${n.is_sensitive ? styles.noteItemSensitive : ''}`}>
      {(n.event_id || n.is_sensitive) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
          {n.event_id && <span className={styles.noteEventBadge}>📅 {n.event_date ? dayjs(n.event_date).format('YYYY.MM.DD') : n.event_title}</span>}
          {n.is_sensitive && <span className={styles.noteSensitiveBadge}>🔒 민감정보</span>}
        </div>
      )}
      <span
        className={styles.noteContent}
        style={n.is_sensitive && !showAll ? { filter: 'blur(4px)', userSelect: 'none' } : {}}
      >{n.content}</span>
      <span className={styles.noteMeta}>
        <span className={styles.noteDate}>{'<'}{dayjs(n.created_at).format('YYYY.MM.DD.')}{'>'}</span>
        {n.author_name && <span className={styles.noteAuthor}>{n.author_name}</span>}
        <button className={styles.noteEditBtn} onClick={() => onEdit(n)} title="수정"><EditIcon /></button>
        <button className={styles.noteDeleteBtn} onClick={() => onDelete(n.id)} title="삭제">⊖</button>
      </span>
    </div>
  )
}

// 폰 화면에서는 값이 없는(저장되지 않은) 항목은 아예 표시하지 않음
function PitField({ label, value, isMobileScreen, blur }) {
  if (isMobileScreen && !value) return null
  return (
    <>
      <span className={styles.pitLabel}>{label}</span>
      <span className={styles.pitValue} style={blur ? { filter: 'blur(4px)', userSelect: 'none' } : undefined}>{value ?? '-'}</span>
    </>
  )
}

function isLeafInTree(nodes, targetId) {
  for (const node of nodes) {
    if (String(node.id) === String(targetId)) return !node.children?.length
    if (node.children?.length) {
      const r = isLeafInTree(node.children, targetId)
      if (r !== null) return r
    }
  }
  return null
}


function calcKoreanAge(birthDate) {
  if (!birthDate) return null
  return dayjs().year() - dayjs(birthDate).year() + 1
}

function buildParishPath(memberCommunity, allCommunities) {
  if (!memberCommunity) return null
  const path = []
  let cur = allCommunities.find(c => c.id === memberCommunity.id)
  while (cur) {
    path.unshift(cur.type ? cur.name + cur.type : cur.name)
    cur = cur.parent_id ? allCommunities.find(c => c.id === cur.parent_id) : null
  }
  return { text: path.join(' '), isLeader: memberCommunity.role === 'leader' }
}

export default function MemberDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isMobileScreen = useIsMobile(768)
  const rankMap = usePositionRanks()
  const [member, setMember] = useState(null)
  const [deptAssignments, setDeptAssignments] = useState([])
  const [notes, setNotes] = useState([])
  const [noteText, setNoteText]               = useState('')
  const [noteIsEvent, setNoteIsEvent]         = useState(false)
  const [noteEventDate, setNoteEventDate]     = useState('')
  const [noteEventTitle, setNoteEventTitle]   = useState('')
  const [noteIsSensitive, setNoteIsSensitive] = useState(false)
  const [noteSaving, setNoteSaving]           = useState(false)
  const [editingNoteId, setEditingNoteId]     = useState(null)
  const [notePage, setNotePage]               = useState(0)
  const [communityList, setCommunityList]     = useState([])
  const { user } = useAuth()
  const canViewDetail = ['super_admin', 'church_admin', 'pastor'].includes(user?.role)

  const [activeTab, setActiveTab] = useState('family')
  const [deptTree, setDeptTree] = useState([])
  const [communityTree, setCommunityTree] = useState([])
  const [showPrivate, setShowPrivate] = useState(false)
  const [pinModal, setPinModal] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [pinAction, setPinAction] = useState(null) // 'view' | 'edit'
  const [printMemberId, setPrintMemberId] = useState(null)
  const textareaRef = useRef(null)
  const touchStartX = useRef(null)
  const [navCoords, setNavCoords] = useState(null)
  const pagerRef = useRef(null)
  const [notesPerPage, setNotesPerPage] = useState(8)

  const formatAddress = (addr) => {
    if (!addr) return ''
    return addr.replace(/^[^\s]*도\s+/, '')
  }

  const openNaver = () => {
    const rawAddr = formatAddress(fullAddress)
    const encoded = encodeURIComponent(rawAddr)
    const deeplink = navCoords
      ? `nmap://route/car?dlat=${navCoords.lat}&dlng=${navCoords.lng}&dname=${encoded}&appname=church`
      : `nmap://search?query=${encoded}&appname=church`
    window.location.href = deeplink
    setTimeout(() => {
      if (document.hasFocus()) window.open(`https://map.naver.com/v5/search/${encoded}`, '_blank')
    }, 1500)
  }

  useEffect(() => {
    setActiveTab('family')
    setNavCoords(null)
    api.get(id).then(r => {
      setMember(r.data)
    }).catch(() => toast.error('교인 정보를 불러오지 못했습니다.'))
    api.notes(id).then(r => setNotes(r.data)).catch(() => {})
    deptApi.byMember(id).then(r => setDeptAssignments(r.data || [])).catch(() => {})
    communityApi.list().then(r => setCommunityList(r.data || [])).catch(() => {})
    deptApi.tree().then(r => setDeptTree(r.data || [])).catch(() => {})
    communityApi.tree().then(r => setCommunityTree(Array.isArray(r.data) ? r.data : [])).catch(() => {})
  }, [id])

  useEffect(() => {
    if (!pagerRef.current) return
    const observer = new ResizeObserver(entries => {
      const h = entries[0].contentRect.height
      setNotesPerPage(Math.max(1, Math.floor(h / 56)))
    })
    observer.observe(pagerRef.current)
    return () => observer.disconnect()
  }, [])

  const resetNoteForm = () => {
    setNoteText('')
    setNoteIsEvent(false)
    setNoteEventDate('')
    setNoteEventTitle('')
    setNoteIsSensitive(false)
    setEditingNoteId(null)
  }

  const handleAddNote = async () => {
    if (!noteText.trim()) return
    if (noteIsEvent && !noteEventDate) {
      toast.error('일정 날짜를 입력해 주세요.')
      return
    }
    setNoteSaving(true)
    try {
      const eventData = noteIsEvent
        ? { is_event: true, event_date: noteEventDate, event_title: noteEventTitle }
        : {}
      if (editingNoteId) {
        const r = await api.updateNote(id, editingNoteId, noteText, { ...eventData, is_sensitive: noteIsSensitive })
        setNotes(prev => prev.map(n => n.id === editingNoteId ? r.data : n))
        toast.success('수정했습니다.')
      } else {
        const r = await api.addNote(id, noteText, { ...eventData, is_sensitive: noteIsSensitive })
        setNotes(prev => [r.data, ...prev])
      }
      resetNoteForm()
      textareaRef.current?.focus()
    } catch {
      toast.error('저장하지 못했습니다.')
    } finally {
      setNoteSaving(false)
    }
  }

  const handleEditNoteStart = (n) => {
    setNoteText(n.content)
    setNoteIsEvent(!!n.event_id)
    setNoteEventDate(n.event_date || '')
    const rawTitle = n.event_title || ''
    const prefix = member?.name ? `${member.name} ` : ''
    setNoteEventTitle(rawTitle.startsWith(prefix) ? rawTitle.slice(prefix.length) : rawTitle)
    setNoteIsSensitive(!!n.is_sensitive)
    setEditingNoteId(n.id)
    textareaRef.current?.focus()
  }

  const noteDeleteGuard = useDeleteGuard()
  const memberDeleteGuard = useDeleteGuard()
  const handleDeleteNote = (noteId) => {
    noteDeleteGuard.request(async () => {
      await api.removeNote(id, noteId).catch(() => toast.error('삭제 실패'))
      setNotes(prev => prev.filter(n => n.id !== noteId))
      if (editingNoteId === noteId) resetNoteForm()
    })
  }

  const openPin = (action) => {
    setPinAction(action)
    setPinInput('')
    setPinModal(true)
  }

  const verifyPin = async () => {
    if (!pinInput.trim()) return
    setPinLoading(true)
    try {
      await settingsApi.verifyMemberPin(pinInput)
      setPinModal(false)
      setPinInput('')
      if (pinAction === 'view') setShowPrivate(true)
      else if (pinAction === 'edit') navigate(`/members/${id}/edit`)
    } catch (err) {
      if (err?.response?.status === 403) {
        toast.error('암호키가 올바르지 않습니다.')
      } else {
        toast.error('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.')
      }
    } finally {
      setPinLoading(false)
    }
  }

  if (!member) return <div>불러오는 중...</div>

  const handleDelete = () => {
    memberDeleteGuard.request(async () => {
      await api.remove(id)
      toast.success('삭제했습니다.')
      navigate('/members')
    })
  }

  const fullAddress = [member.address, member.address_detail].filter(Boolean).join(' ')

  const parishResult = buildParishPath(member.communities?.[0], communityList)
  const parishText = parishResult ? parishResult.text + (parishResult.isLeader ? ' (리더)' : '') : null
  const korAge = calcKoreanAge(member.birth_date)
  const westAge = calcWesternAge(member.birth_date)
  // 폰 화면에서는 PIN 잠금 없이 개인정보를 항상 표시
  const showAll = showPrivate || isMobileScreen

  const pageCount = Math.max(1, Math.ceil(notes.length / notesPerPage))
  const pagedNotes = Array.from({ length: pageCount }, (_, i) =>
    notes.slice(i * notesPerPage, (i + 1) * notesPerPage)
  )
  const safePage = Math.min(notePage, pageCount - 1)

  const handleTouchStart = e => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd = e => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (dx < -50) setNotePage(p => Math.min(p + 1, pageCount - 1))
    if (dx >  50) setNotePage(p => Math.max(p - 1, 0))
    touchStartX.current = null
  }

  return (
    <>
    <div className={styles.detailOuter}>
      {/* 왼쪽 패널 — 단일 카드 (인적사항 + 특이사항 통합) */}
      <div className={styles.detailLeft}>
        <div className={styles.profileCard}>

          {/* 카드 헤더: 소제목 + 뒤로가기 */}
          <div className={styles.profileCardHeader}>
            <span className={styles.sectionTitle} style={{ margin: 0 }}>인적사항</span>
            <Link to="/members" className={styles.backLink}>교인 목록</Link>
          </div>

          {/* 사진 + 2행 그리드 */}
          {isMobileScreen ? (
            /* 폰 화면: 사진 왼쪽 + 이름·직분·성별·나이 한 행 + 우측 세로 버튼 3개 */
            <div className={styles.mDetailTop}>
              {member.photo_url
                ? <img src={member.photo_url} alt={member.name} className={styles.mDetailPhoto} />
                : <div className={styles.mDetailPhotoPlaceholder}
                    style={{ background: genderColor(member.gender) }}>
                    {member.name[0]}
                  </div>
              }
              <div className={styles.mDetailNameRow}>
                <div className={styles.mDetailInfoCol}>
                  <div className={styles.mDetailNameInfo}>
                    <span className={styles.profileName}>{member.name}</span>
                    {member.position && (
                      <span className={styles.profilePosBadge} style={positionRankColor(member.position, rankMap)}>{displayPosition(member)}</span>
                    )}
                    {member.gender && (
                      <span className={styles.profileMeta}>{member.gender === 'M' ? '남성' : '여성'}</span>
                    )}
                    {korAge != null && (
                      <span className={styles.profileMeta}>{korAge}세</span>
                    )}
                  </div>
                  {member.birth_date && (
                    <div className={styles.mDetailSubLine}>
                      {dayjs(member.birth_date).format('YYYY.MM.DD')}{member.birth_lunar ? '(음)' : ''} · (만{westAge}세)
                    </div>
                  )}
                  {parishText && (
                    <div className={styles.mDetailSubLine}>{parishText}</div>
                  )}
                </div>
                <div className={styles.mDetailBtnCol}>
                  <div className={styles.mDetailBtnRow}>
                    <button className={styles.mDetailIconBtn} onClick={() => openPin('edit')} title="수정"><EditIcon /></button>
                    <button className={styles.mDetailIconBtn} onClick={() => setPrintMemberId(id)} title="출력">🖨</button>
                    <button className={`${styles.mDetailIconBtn} ${styles.mDetailIconBtnDanger}`} onClick={handleDelete} title="삭제"><TrashIcon /></button>
                  </div>
                  <Link to={`/pastoral?member_id=${id}`} className={styles.mDetailVisitBtn}>심방등록</Link>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.profileCardTop}>
              {member.photo_url
                ? <img src={member.photo_url} alt={member.name} className={styles.profilePhoto} />
                : <div className={styles.profilePhotoPlaceholder}
                    style={{ background: genderColor(member.gender) }}>
                    {member.name[0]}
                  </div>
              }
              <div className={styles.profileInfoGrid}>
                {/* 행1 텍스트: 이름 · 직분 · 교구 */}
                <div className={styles.profileInfoRow}>
                  <span className={styles.profileName}>{member.name}</span>
                  {member.position && (
                    <span className={styles.profilePosBadge} style={positionRankColor(member.position, rankMap)}>{displayPosition(member)}</span>
                  )}
                  {parishText && (
                    <span className={styles.profileMeta}>{parishText}</span>
                  )}
                </div>
                {/* 행1 버튼: 수정 · 심방내역 */}
                <div className={styles.profileBtnGroup}>
                  <button className={styles.btnSm} onClick={() => openPin('edit')}>수정</button>
                  <Link to={`/pastoral?member_id=${id}`} className={`${styles.btnSm} ${styles.btnSmPurple}`}>심방내역</Link>
                  <button className={styles.btnSm} onClick={() => setPrintMemberId(id)}>🖨 출력</button>
                </div>
                {/* 행2 텍스트: 성별 · 생년월일 · 나이 · 만나이 */}
                <div className={styles.profileInfoRow}>
                  {member.gender && (
                    <span className={styles.profileMeta}>{member.gender === 'M' ? '남성' : '여성'}</span>
                  )}
                  {member.birth_date && (
                    <span className={styles.profileMeta}>
                      {dayjs(member.birth_date).format('YYYY.MM.DD')}{member.birth_lunar ? '(음)' : ''}
                    </span>
                  )}
                  {korAge != null && (
                    <span className={styles.profileMeta}>{korAge}세</span>
                  )}
                  {westAge != null && (
                    <span className={styles.profileMeta}>(만{westAge}세)</span>
                  )}
                </div>
                {/* 행2 버튼: 삭제 · 개인정보 */}
                <div className={styles.profileBtnGroup}>
                  <button className={`${styles.btnSm} ${styles.btnSmDanger}`} onClick={handleDelete}>삭제</button>
                  {canViewDetail && (
                    showPrivate
                      ? <button className={`${styles.btnSm} ${styles.btnSmGreen}`} onClick={() => setShowPrivate(false)}>개인정보</button>
                      : <button className={`${styles.btnSm} ${styles.btnSmViolet}`} onClick={() => openPin('view')}>개인정보</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 인적사항 그리드 — 폰 화면은 생년월일·소속을 위쪽 프로필 타일에서 이미 보여주므로 생략 */}
          <div className={styles.pitTable}>
            {!isMobileScreen && member.birth_date && <>
              <span className={styles.pitLabel}>생년월일</span>
              <span className={`${styles.pitValue} ${styles.pitSpan}`}>
                {dayjs(member.birth_date).format('YYYY.MM.DD')}{member.birth_lunar ? '(음)' : ''} · (만{westAge}세)
              </span>
            </>}
            {!isMobileScreen && parishText && <>
              <span className={styles.pitLabel}>소속</span>
              <span className={`${styles.pitValue} ${styles.pitSpan}`}>{parishText}</span>
            </>}
            {member.phone && <>
              <span className={styles.pitLabel}>전화번호</span>
              <span className={`${styles.pitValue} ${styles.pitSpan}`} style={{ whiteSpace: 'nowrap' }}>
                {/Android|iPhone|iPad/i.test(navigator.userAgent)
                  ? <a href={`tel:${member.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{member.phone}</a>
                  : member.phone}
              </span>
            </>}
            {(member.address || member.address_detail) && <>
              <span className={styles.pitLabel}>주소</span>
              <span className={`${styles.pitValue} ${styles.pitSpan}`} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {[formatAddress(member.address), member.address_detail].filter(Boolean).join(' ')}
              </span>
            </>}

            {canViewDetail && <>
              <PitField label="교인구분" value={member.membership_category} isMobileScreen={isMobileScreen} blur={!showAll} />
              <PitField label="신급" value={member.faith_level} isMobileScreen={isMobileScreen} blur={!showAll} />
              <PitField label="인도자" value={member.introducer_name} isMobileScreen={isMobileScreen} blur={!showAll} />
              <PitField label="신앙세대주" value={member.household_head_name} isMobileScreen={isMobileScreen} blur={!showAll} />
              <PitField label="세대주관계" value={member.household_relation} isMobileScreen={isMobileScreen} blur={!showAll} />
              <PitField label="직업" value={member.occupation} isMobileScreen={isMobileScreen} blur={!showAll} />
              <PitField label="이전교회" value={member.previous_church} isMobileScreen={isMobileScreen} blur={!showAll} />
              <PitField label="이전교회직분" value={member.previous_church_position} isMobileScreen={isMobileScreen} blur={!showAll} />
              {!isMobileScreen && <><span /><span /></>}
            </>}
          </div>

          {/* 특이사항 구분선 */}
          <div className={styles.noteSectionHead}>
            <span className={styles.sectionTitle} style={{ margin: 0 }}>특이사항</span>
          </div>

          {isMobileScreen ? (
            /* 폰 화면: 스크롤 가능한 단순 세로 목록 (고정 높이 페이징 없음) */
            <div className={styles.mNoteList}>
              {notes.length === 0 && <div className={styles.noteEmpty}>등록된 특이사항이 없습니다</div>}
              {notes.map(n => (
                <NoteItem key={n.id} n={n} showAll={showAll} onDelete={handleDeleteNote} onEdit={handleEditNoteStart} />
              ))}
            </div>
          ) : (
            <>
            {/* 수평 페이지 슬라이더 */}
            <div className={styles.notePager}
                 ref={pagerRef}
                 onTouchStart={handleTouchStart}
                 onTouchEnd={handleTouchEnd}>
              <div className={styles.notePageTrack}
                   style={{ transform: `translateX(-${safePage * 100}%)` }}>
                {pagedNotes.map((pageNotes, pi) => (
                  <div key={pi} className={styles.notePage}>
                    {pageNotes.map(n => (
                      <NoteItem key={n.id} n={n} showAll={showAll} onDelete={handleDeleteNote} onEdit={handleEditNoteStart} />
                    ))}
                    {pageNotes.length === 0 && (
                      <div className={styles.noteEmpty}>등록된 특이사항이 없습니다</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 페이지 인디케이터 */}
            {pageCount > 1 && (
              <div className={styles.noteDots}>
                {Array.from({ length: pageCount }, (_, i) => (
                  <button
                    key={i}
                    className={`${styles.noteDot} ${i === safePage ? styles.noteDotActive : ''}`}
                    onClick={() => setNotePage(i)}
                  />
                ))}
              </div>
            )}
            </>
          )}

          {/* 입력 영역 (목록 아래) */}
          <div className={styles.noteInputArea}>
            <div className={styles.noteInputBox}>
              {editingNoteId && (
                <div className={styles.noteEditingBanner}>
                  ✏️ 특이사항 수정 중
                  <button type="button" onClick={resetNoteForm}>취소</button>
                </div>
              )}
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
                      placeholder="캘린더 표시 제목 (비워두면 특이사항 내용으로 자동 표시)"
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
                  {noteSaving ? '저장\n중...' : (editingNoteId ? '수정' : '저장')}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 오른쪽 패널 */}
      <div className={styles.detailRight}>

        {/* 관계도 카드 */}
        <div className={styles.detailRightTop}>
          <div className={styles.rightCard}>
            <div className={styles.rightCardHead}>
              <span className={styles.sectionTitle} style={{ margin: 0 }}>관계도</span>
              <div className={styles.relationTabs}>
                <button
                  className={activeTab === 'family' ? styles.relationTabActive : styles.relationTab}
                  onClick={() => setActiveTab('family')}
                >가족</button>
                {deptAssignments
                  .filter(a => isLeafInTree(deptTree, a.department_id) === true)
                  .map(a => (
                    <button
                      key={`dept-${a.department_id}`}
                      className={activeTab === `dept-${a.department_id}` ? styles.relationTabActive : styles.relationTab}
                      onClick={() => setActiveTab(`dept-${a.department_id}`)}
                    >{a.department_name}</button>
                  ))}
                {(member.communities || [])
                  .filter(c => isLeafInTree(communityTree, c.id) === true)
                  .map(c => (
                    <button
                      key={`comm-${c.id}`}
                      className={activeTab === `comm-${c.id}` ? styles.relationTabActive : styles.relationTab}
                      onClick={() => setActiveTab(`comm-${c.id}`)}
                    >{c.type ? `${c.name}${c.type}` : c.name}</button>
                  ))}
              </div>
            </div>
            <div className={styles.rightCardBody}>
              {activeTab === 'family' && <NuclearFamilyView memberId={Number(id)} isMobileScreen={isMobileScreen} />}
              {String(activeTab).startsWith('dept-') && (
                <GroupMemberView
                  groupId={Number(String(activeTab).replace('dept-', ''))}
                  groupType="dept"
                  currentMemberId={Number(id)}
                />
              )}
              {String(activeTab).startsWith('comm-') && (
                <GroupMemberView
                  groupId={Number(String(activeTab).replace('comm-', ''))}
                  groupType="community"
                  currentMemberId={Number(id)}
                />
              )}
            </div>
          </div>
        </div>

        {/* 위치도 카드 */}
        <div className={styles.detailRightBottom}>
          <div className={styles.rightCard}>
            <div className={styles.rightCardHead}>
              <span className={styles.sectionTitle} style={{ margin: 0 }}>위치도</span>
              {fullAddress && (
                <button
                  onClick={openNaver}
                  style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.82rem', color: '#3b82f6', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
                >🗺 길찾기</button>
              )}
            </div>
            <div className={`${styles.rightCardBody} ${styles.rightCardBodyMap}`}>
              <KakaoMap address={fullAddress || null} onCoordsReady={setNavCoords} />
            </div>
          </div>
        </div>

      </div>
    </div>

    {pinModal && (
      <PinModal
        pinInput={pinInput}
        setPinInput={setPinInput}
        onVerify={verifyPin}
        onClose={() => { setPinModal(false); setPinInput('') }}
        loading={pinLoading}
        action={pinAction}
      />
    )}

    <DeleteGuardModal {...noteDeleteGuard.modalProps} message="이 특이사항을 삭제하시겠습니까?" />
    <DeleteGuardModal {...memberDeleteGuard.modalProps} message={`${member.name} 교인을 삭제하시겠습니까?`} />
    <MemberPrintReport memberId={printMemberId} onDone={() => setPrintMemberId(null)} />

    </>
  )
}

function PinModal({ pinInput, setPinInput, onVerify, onClose, loading, action }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', width: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
          {action === 'edit' ? '수정 페이지 진입' : '개인정보 열람'}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 18 }}>암호키를 입력하세요.</div>
        <input
          type="password"
          value={pinInput}
          onChange={e => setPinInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onVerify()}
          placeholder="암호키 입력"
          autoFocus
          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: '1rem', marginBottom: 16, outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.9rem', color: '#64748b' }}>취소</button>
          <button onClick={onVerify} disabled={loading || !pinInput.trim()} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
            {loading ? '확인 중…' : '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoItem({ label, value, blur }) {
  return (
    <div className={styles.infoItem}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue} style={blur ? { filter: 'blur(4px)', userSelect: 'none' } : undefined}>{value}</span>
    </div>
  )
}

function HoverMemberNode({ member, isAnchor, label, size, smallSize, onClick }) {
  const [hov, setHov] = useState(false)
  const color = genderColor(member.gender)
  const sz = isAnchor ? size : (hov ? size : smallSize)
  return (
    <div
      className={styles.hmnNode}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div
        className={`${styles.hmnCircle} ${isAnchor ? styles.hmnAnchor : ''}`}
        style={{ width: sz, height: sz, borderColor: isAnchor ? '#3b82f6' : color }}
      >
        {member.photo_url
          ? <img src={member.photo_url} alt={member.name} />
          : <span style={{ fontSize: sz * 0.38, color: isAnchor ? '#fff' : color }}>
              {(member.name || '?')[0]}
            </span>
        }
      </div>
      <div className={styles.hmnName}>{member.name}</div>
      {label && <div className={styles.hmnLabel}>{label}</div>}
    </div>
  )
}

// ── 가족+ 확장 가계도 ─────────────────────────────────────
const EFW = 1400, EFH = 600
const ECOL = { ggp: 438, gp: 543, par: 648, sel: 753, ch: 858, gch: 963 }
const ECY  = 300
const ELINE_PROPS = { stroke: '#cbd5e1', strokeWidth: 1.8, strokeLinecap: 'round' }
const EF_REL = {
  great_grandparent:'증조부모', grandparent:'조부모', parent:'부모',
  father:'부', mother:'모',
  paternal_grandfather:'조부', paternal_grandmother:'조모',
  maternal_grandfather:'외조부', maternal_grandmother:'외조모',
  spouse:'배우자', sibling:'형제자매',
  child:'자녀', grandchild:'손자녀', great_grandchild:'증손자녀',
  aunt_paternal:'고모', uncle_paternal:'삼촌',
  aunt_maternal:'이모', uncle_maternal:'외삼촌',
  nephew_niece:'조카', cousin:'사촌',
}

// 미등록 인물 자리표시자(부모 실루엣 등) — 사람모양 그림자 아이콘
function SilhouetteIcon({ size }) {
  return (
    <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="#cbd5e1">
      <circle cx="12" cy="8" r="4.2" />
      <path d="M4 21c0-4.6 3.6-8.2 8-8.2s8 3.6 8 8.2z" />
    </svg>
  )
}

function EFNode({ member, isAnchor, label, size, smallSize, pixX, pixY, onClick }) {
  const [hov, setHov] = useState(false)
  const isPlaceholder = !!member.__placeholder
  const color = genderColor(member.gender)
  const sz = isAnchor ? size : (hov ? size : smallSize)
  const anchorClass = isAnchor ? (member.gender !== 'M' ? styles.ftAnchorF : styles.ftAnchor) : ''
  return (
    <div
      style={{ position: 'absolute', left: pixX, top: pixY,
               transform: 'translate(-50%, -50%)', cursor: isPlaceholder ? 'default' : 'pointer', zIndex: hov ? 10 : 1 }}
      onClick={isPlaceholder ? undefined : onClick}
      onMouseEnter={() => !isPlaceholder && setHov(true)}
      onMouseLeave={() => !isPlaceholder && setHov(false)}
    >
      {/* circle 이 좌표의 정확한 중심 — 레이블은 절대위치로 circle 아래 배치 */}
      <div
        className={`${styles.ftCircle} ${anchorClass}`}
        style={{ width: sz, height: sz, borderColor: isAnchor ? undefined : (isPlaceholder ? '#e2e8f0' : color),
                 transition: 'width 0.15s, height 0.15s' }}
      >
        {isPlaceholder
          ? <SilhouetteIcon size={sz} />
          : member.photo_url
            ? <img src={member.photo_url} alt={member.name} />
            : <span style={{ fontSize: sz * 0.36, color: isAnchor ? undefined : color }}>
                {(member.name || '?')[0]}
              </span>
        }
      </div>
      {!isPlaceholder && (
        <div style={{ position: 'absolute', top: '100%', left: '50%',
                      transform: 'translateX(-50%)', paddingTop: 5,
                      whiteSpace: 'nowrap', pointerEvents: 'none', textAlign: 'center' }}>
          <div className={styles.ftLabel}>{member.name}</div>
        </div>
      )}
    </div>
  )
}

// 한글·영문 혼용 relation_type 을 영문으로 정규화
function normalizeRel(type) {
  const m = {
    '배우자':'spouse','남편':'spouse','아내':'spouse',
    '부모':'parent','부':'parent','모':'parent','아버지':'parent','어머니':'parent',
    '자녀':'child','아들':'child','딸':'child',
    '형제·자매':'sibling','형제자매':'sibling','형':'sibling','누나':'sibling','오빠':'sibling','언니':'sibling','동생':'sibling',
    '조부모':'grandparent','손자녀':'grandchild',
    'father':'parent','mother':'parent',
    'paternal_grandfather':'grandparent','paternal_grandmother':'grandparent',
    'maternal_grandfather':'grandparent','maternal_grandmother':'grandparent',
  }
  return m[type] ?? type
}

// ── 핵가족 가계도 (가족 탭) — 세로 레이아웃 ─────────────────
const NYL = { par: 80, self: 210, ch: 340 }
const NF_LINE = { stroke: '#cbd5e1', strokeWidth: 1.8, strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke' }

function NuclearFamilyView({ memberId, isMobileScreen }) {
  const navigate = useNavigate()
  const [selfData, setSelfData] = useState(null)
  const [spouseParentsData, setSpouseParentsData] = useState([])
  const [childrenSpousesMap, setChildrenSpousesMap] = useState({})
  const [siblingsSpousesMap, setSiblingsSpousesMap] = useState({})
  const [loading, setLoading] = useState(true)
  const stageRef = useRef(null)
  const [containerSize, setContainerSize] = useState({ w: null, h: null })
  // 가로 스크롤 발생 시 본인/배우자 앵커가 중앙에 오도록 할 목표 scrollLeft.
  // 렌더 중(레이아웃 계산 이후) 값을 채워두고, 커밋 후 아래 useLayoutEffect가 적용한다.
  const pendingScrollCenterRef = useRef(0)

  // selfData?.id 의존: 첫 렌더(loading=true)엔 stageRef.current=null → 데이터 로드 후 재실행
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    if (width > 0 && height > 0) setContainerSize({ w: width, h: height })
    const ro = new ResizeObserver(([e]) => setContainerSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [selfData?.id])

  // 매 렌더 커밋 후 실행 — pendingScrollCenterRef는 로딩/데이터없음 분기에서는 갱신되지 않아
  // 값이 그대로지만, 그 경우 stageRef.current도 null이라 아래에서 바로 반환된다.
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    el.scrollLeft = pendingScrollCenterRef.current
  })

  useEffect(() => {
    let active = true
    setLoading(true); setSelfData(null); setSpouseParentsData([]); setChildrenSpousesMap({}); setSiblingsSpousesMap({})
    ;(async () => {
      try {
        const { data: self } = await api.get(memberId)
        const fam = self.family || []
        const spouseList = fam.filter(f => normalizeRel(f.relation_type) === 'spouse')
        const childList = fam.filter(f => normalizeRel(f.relation_type) === 'child')
        const siblingList = fam.filter(f => normalizeRel(f.relation_type) === 'sibling')
        const directInLaws = fam.filter(f => ['시부','시모','장인','장모'].includes(f.relation_type))
        const myIds = new Set([self.id, ...fam.map(f => f.id)])

        // 배우자 부모: 직접 시부/시모/장인/장모로 등록된 경우 우선, 없으면 배우자 가족 조회
        let spParents = directInLaws
        if (spParents.length === 0 && spouseList.length > 0) {
          const spouseData = await api.get(spouseList[0].id).then(r => r.data).catch(() => null)
          if (spouseData) {
            spParents = (spouseData.family || []).filter(f =>
              (f.relation_type === 'father' || f.relation_type === 'mother' || normalizeRel(f.relation_type) === 'parent')
              && !myIds.has(f.id)
            )
          }
        }

        // 자녀의 배우자 / 형제자매의 배우자 조회 — 트리에는 그리지 않고 사이드리스트에 표시
        const spouseMap = {}
        const sibSpouseMap = {}
        await Promise.all([
          ...childList.map(async child => {
            try {
              const childData = await api.get(child.id).then(r => r.data)
              const sp = (childData.family || []).find(f => normalizeRel(f.relation_type) === 'spouse')
              if (sp) spouseMap[child.id] = sp
            } catch {}
          }),
          ...siblingList.map(async sib => {
            try {
              const sibData = await api.get(sib.id).then(r => r.data)
              const sp = (sibData.family || []).find(f => normalizeRel(f.relation_type) === 'spouse')
              if (sp) sibSpouseMap[sib.id] = sp
            } catch {}
          }),
        ])

        if (active) {
          setSelfData(self)
          setSpouseParentsData(spParents)
          setChildrenSpousesMap(spouseMap)
          setSiblingsSpousesMap(sibSpouseMap)
          setLoading(false)
        }
      } catch { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [memberId])

  if (loading) return <div className={styles.cvLoading}>불러오는 중...</div>
  if (!selfData) return <div className={styles.cvLoading}>데이터를 불러올 수 없습니다.</div>

  const fam = selfData.family || []
  const myParentsRaw = fam.filter(f =>
    f.relation_type === 'father' || f.relation_type === 'mother' || normalizeRel(f.relation_type) === 'parent'
  )
  const spouses = fam.filter(f => normalizeRel(f.relation_type) === 'spouse')
  const childrenRaw = fam.filter(f => normalizeRel(f.relation_type) === 'child')
    .sort((a, b) => (a.birth_date ?? '9999') < (b.birth_date ?? '9999') ? -1 : 1)
  const siblings = fam.filter(f => normalizeRel(f.relation_type) === 'sibling')
    .sort((a, b) => (a.birth_date ?? '9999') < (b.birth_date ?? '9999') ? -1 : 1)

  const hasSpouse = spouses.length > 0
  const spouse = spouses[0] || null
  // 부모: 남자 왼쪽, 여자 오른쪽
  const myParents = [...myParentsRaw].sort((a, b) => (a.gender === 'M' ? -1 : 1) - (b.gender === 'M' ? -1 : 1))
  const spParents = [...spouseParentsData].sort((a, b) => (a.gender === 'M' ? -1 : 1) - (b.gender === 'M' ? -1 : 1))
  const children = childrenRaw

  const totalFam = myParents.length + (hasSpouse ? 1 : 0) + children.length + siblings.length + spParents.length
  if (totalFam === 0) return <div className={styles.cvLoading}>등록된 가족이 없습니다.</div>

  // 관계도에 그려지지 않는 관계(조부모·고모·이모·사촌·조카 등) 존재 여부
  const drawnRels = new Set(['parent', 'spouse', 'child', 'sibling'])
  const extraFamily = fam.filter(f =>
    !drawnRels.has(normalizeRel(f.relation_type)) && !['시부', '시모', '장인', '장모'].includes(f.relation_type)
  )

  // ── 레이아웃 상수 ──────────────────────────────────────────
  const NODE_GAP = 130
  const NF_PAD = 20
  const SMALL_SIZE = 42
  const ANCHOR_SIZE = 54           // 본인/배우자 타일 지름

  // ── 본인 행: [형제(연장순)...] [본인] [배우자?] ──────────
  const selfRowCount = siblings.length + 1 + (hasSpouse ? 1 : 0)
  const NFW = Math.max(560, selfRowCount * NODE_GAP + 200)

  // PAR_OFFSET: 원 지름의 절반 = 접선 조건 (2×PAR_OFFSET = SMALL_SIZE, scale 후에도 유지)
  const PAR_OFFSET = SMALL_SIZE / 2
  // 형제·자녀 등 "당사자는 고정 위치, 배우자만 옆에 맞닿게(터치)" 배치용 — 남자 왼쪽, 여자 오른쪽.
  // 당사자 위치는 절대 움직이지 않아 부모→당사자 연결선이 항상 당사자 타일 중앙에 정확히 닿는다.
  const attachSide = spouseGender => (spouseGender === 'M' ? -1 : 1) * SMALL_SIZE

  const selfRowWidth = (selfRowCount - 1) * NODE_GAP
  const selfRowStart = (NFW - selfRowWidth) / 2

  const sibXs = siblings.map((_, i) => selfRowStart + i * NODE_GAP)
  const baseX = selfRowStart + siblings.length * NODE_GAP
  // 여자→오른쪽, 남자→왼쪽: 본인·배우자 성별 모두 참조해 결정.
  // 단, 형제자매가 있으면 본인은 반드시 형제자매 옆(baseX)에 붙어야 함 — 그래야
  // 부모→형제자매+본인 연결선이 배우자를 사이에 두지 않고 올바르게 그려짐.
  // (성별로 자리를 바꾸면 배우자가 형제자매와 본인 사이에 끼어 보이는 버그가 있었음)
  const selfIsF   = selfData.gender === 'F'
  const selfIsM   = selfData.gender === 'M'
  const spouseIsM = hasSpouse && spouse.gender === 'M'
  const selfOnRight = siblings.length === 0 && hasSpouse && (selfIsF || (!selfIsM && spouseIsM))
  const selfX   = selfOnRight ? baseX + NODE_GAP : baseX
  const spouseX = hasSpouse ? (selfOnRight ? baseX : baseX + NODE_GAP) : baseX

  // 출생 가족 그룹 (형제 + 본인): 부모 연결선 대상
  const birthFamilyXs = [...sibXs, selfX]
  const birthFamilyMinX = Math.min(...birthFamilyXs)
  const birthFamilyMaxX = Math.max(...birthFamilyXs)
  const birthFamilyMidX = (birthFamilyMinX + birthFamilyMaxX) / 2

  // 형제자매는 있는데 본인 부모가 하나도 등록 안 된 경우, 이름 없는 실루엣을 부모 자리에
  // 두고 연결선을 그려 형제자매+본인이 서로 이어져 보이게 함
  const showParentPlaceholder = siblings.length > 0 && myParents.length === 0

  // ── 부모 위치 (붙어있는 쌍, 남자 왼쪽) ───────────────────
  const myParentMidX = birthFamilyMidX
  const myParentXs =
    myParents.length === 0 ? [] :
    myParents.length === 1 ? [myParentMidX] :
    myParents.length === 2 ? [myParentMidX - PAR_OFFSET, myParentMidX + PAR_OFFSET] :
    myParents.map((_, i) => myParentMidX - ((myParents.length - 1) / 2) * NODE_GAP + i * NODE_GAP)

  const spParentMidX = spouseX
  const spParentXs =
    spParents.length === 0 ? [] :
    spParents.length === 1 ? [spParentMidX] :
    spParents.length === 2 ? [spParentMidX - PAR_OFFSET, spParentMidX + PAR_OFFSET] :
    spParents.map((_, i) => spParentMidX - ((spParents.length - 1) / 2) * NODE_GAP + i * NODE_GAP)

  // ── 부부 중심 ─────────────────────────────────────────────
  const coupleCenter = hasSpouse ? (selfX + spouseX) / 2 : selfX

  // ── 자녀 위치 (자녀의 배우자는 트리에 그리지 않고 사이드리스트로 분리 — NODE_GAP 균등 배치) ──
  const chTotalSpan = Math.max(0, (children.length - 1) * NODE_GAP)
  const unitStartX = coupleCenter - chTotalSpan / 2
  const chXs = children.map((_, i) => unitStartX + i * NODE_GAP)

  // ── 노드·선 빌더 ──────────────────────────────────────────
  const nodes = [], lines = []
  const N = (m, x, y, label, isAnchor = false) =>
    nodes.push({ ...m, _x: x, _y: y, label, isAnchor })
  const L = (x1, y1, x2, y2, key) => lines.push({ x1, y1, x2, y2, key })

  N(selfData, selfX, NYL.self, '본인', true)
  if (hasSpouse) N(spouse, spouseX, NYL.self, '배우자')
  siblings.forEach((s, i) => {
    N(s, sibXs[i], NYL.self, '형제·자매')
    const sp = siblingsSpousesMap[s.id]
    if (sp) N(sp, sibXs[i] + attachSide(sp.gender), NYL.self, '')
  })
  myParents.forEach((p, i) => N(p, myParentXs[i], NYL.par, EF_REL[p.relation_type] ?? '부모'))
  if (showParentPlaceholder) {
    nodes.push({
      id: `parent-placeholder-${selfData.id}`, name: '', gender: null, photo_url: null,
      _x: myParentMidX, _y: NYL.par, label: '', isAnchor: false, __placeholder: true,
    })
  }
  spParents.forEach((p, i) => {
    const lbl = ({ 시부:'시부', 시모:'시모', 장인:'장인', 장모:'장모' })[p.relation_type]
      ?? (EF_REL[p.relation_type] ?? '배우자 부모')
    N(p, spParentXs[i], NYL.par, lbl)
  })
  children.forEach((c, i) => {
    N(c, chXs[i], NYL.ch, '자녀')
    const sp = childrenSpousesMap[c.id]
    if (sp) {
      const relLabel = sp.gender === 'F' ? '며느리' : sp.gender === 'M' ? '사위' : ''
      N(sp, chXs[i] + attachSide(sp.gender), NYL.ch, relLabel)
    }
  })

  // ── 연결선 ────────────────────────────────────────────────
  const elbY_par = (NYL.par + NYL.self) / 2
  const elbY_ch = (NYL.self + NYL.ch) / 2

  // 선을 원 중심까지 그림 — 원 div가 SVG 위에 렌더돼 내부 선을 가려줌
  // 본인 ↔ 배우자
  if (hasSpouse) L(selfX, NYL.self, spouseX, NYL.self, 'spline')

  // 부모 → 출생가족(형제+본인) — 부모가 실제 등록 안 됐어도 실루엣 placeholder가 있으면 그림
  if (myParents.length > 0 || showParentPlaceholder) {
    L(myParentMidX, NYL.par, myParentMidX, elbY_par, 'pel1')
    if (birthFamilyXs.length === 1) {
      L(selfX, elbY_par, selfX, NYL.self, 'pel3')
    } else {
      L(birthFamilyMinX, elbY_par, birthFamilyMaxX, elbY_par, 'pbar')
      birthFamilyXs.forEach((bx, i) => L(bx, elbY_par, bx, NYL.self, `pbd${i}`))
    }
  }

  // 배우자 부모 → 배우자
  if (hasSpouse && spParents.length > 0) {
    L(spParentMidX, NYL.par, spParentMidX, NYL.self, 'spel')
  }

  // 부부 → 자녀 (세로선은 자녀 타일 중심으로)
  if (children.length > 0) {
    if (children.length === 1) {
      L(coupleCenter, NYL.self, coupleCenter, elbY_ch, 'cel1')
      L(coupleCenter, elbY_ch, chXs[0], elbY_ch, 'cel2')
      L(chXs[0], elbY_ch, chXs[0], NYL.ch, 'cel3')
    } else {
      const chMinX = Math.min(...chXs), chMaxX = Math.max(...chXs)
      L(coupleCenter, NYL.self, coupleCenter, elbY_ch, 'cu')
      L(chMinX, elbY_ch, chMaxX, elbY_ch, 'cbar')
      chXs.forEach((cx, i) => L(cx, elbY_ch, cx, NYL.ch, `cd${i}`))
    }
  }

  // ── 동적 viewBox ──────────────────────────────────────────
  // 실제 노드 위치만으로 뷰박스를 타이트하게 잡음(NFW는 정렬용 가상 캔버스일 뿐,
  // 뷰박스에 그대로 반영하면 인원이 적을 때 여백만 커져 화면에 작게 보이는 문제가 있었음)
  const usedXs = nodes.map(n => n._x)
  const usedYs = nodes.map(n => n._y)
  const vbMinX_base = Math.min(...usedXs) - NF_PAD
  const vbMaxX_base = Math.max(...usedXs) + NF_PAD
  const vbMinY_base = Math.min(...usedYs) - NF_PAD
  const vbMaxY_base = Math.max(...usedYs) + NF_PAD + 44

  // 앵커 계산 (층수에 따라 세로 중심 결정)
  const hasParentLayer = myParents.length > 0 || spParents.length > 0 || showParentPlaceholder
  const hasChildLayer  = children.length > 0

  // 레이블은 원 아래에만 존재하므로, 위아래 시각 범위가 비대칭
  // → anchorY를 시각 중심으로 보정해 위아래 여백을 균등하게 만듦
  const LABEL_EXTRA = 23  // paddingTop(5) + 레이블 높이(18)
  const topRadius = hasParentLayer ? SMALL_SIZE / 2 : ANCHOR_SIZE / 2
  const botLabel  = hasChildLayer  ? SMALL_SIZE / 2 + LABEL_EXTRA : ANCHOR_SIZE / 2 + LABEL_EXTRA
  const visualShift = (botLabel - topRadius) / 2

  const anchorY = (
    hasParentLayer && !hasChildLayer ? (NYL.par  + NYL.self) / 2 :
    !hasParentLayer && hasChildLayer ? (NYL.self + NYL.ch)  / 2 :
    NYL.self
  ) + visualShift

  // viewBox 세로: 앵커 기준 상하 대칭화 → anchorY가 항상 vbH/2에 위치
  const halfH = Math.max(anchorY - vbMinY_base, vbMaxY_base - anchorY)
  const vbMinY = anchorY - halfH
  const vbH    = halfH * 2
  // viewBox 가로: 본인이 정중앙에 올 필요는 없음(펄스 애니메이션으로 이미 식별됨) —
  // 실제 표시되는 노드 전체를 하나의 덩어리로 보고 좌우 여백이 균등하도록 타이트하게 감쌈
  const vbMinX = vbMinX_base
  const vbW    = vbMaxX_base - vbMinX_base

  nodes.forEach(n => {
    n.pixX = n._x - vbMinX
    n.pixY = n._y - vbMinY
  })

  // 본인(앵커) 원의 최종 렌더 크기가 상단 프로필 사진 크기를 넘지 않도록 상한선을 둠
  // (폰: mDetailPhoto 72px, PC: profilePhoto 100px에 맞춰 기존 1.5배율 유지)
  const MOBILE_ANCHOR_PX = 72
  const maxScale = isMobileScreen ? MOBILE_ANCHOR_PX / ANCHOR_SIZE : 1.5

  // 형제/자녀가 많아 자연 축소값(scaleW)이 이 아래로 내려가면 더 줄이지 않고
  // 가로 스크롤로 전환한다. 세로는 3세대 고정이라 scaleH는 그대로 상한으로 유지.
  const MIN_TILE_PX = 32          // SMALL_SIZE(42) 타일의 최소 렌더 크기 — 실측하며 조정 가능
  const MIN_SCALE = MIN_TILE_PX / SMALL_SIZE

  const scaleW = containerSize.w ? containerSize.w / vbW : 1
  const scaleH = containerSize.h ? containerSize.h / vbH : 1
  const fitScale   = Math.min(scaleW, scaleH, maxScale)
  const floorScale = Math.min(MIN_SCALE, scaleH, maxScale)
  const scale = Math.max(fitScale, floorScale)

  // Safari/iOS: flex로 결정된 높이에서 calc(50%) 오작동 → 측정값으로 직접 계산
  const contentPxW = containerSize.w ? Math.max(containerSize.w, vbW * scale) : vbW * scale
  const stageH      = containerSize.h || vbH * scale
  const scalerLeft  = (contentPxW - vbW * scale) / 2
  const scalerTop   = (stageH - vbH * scale) / 2

  const overflowW = contentPxW - (containerSize.w || contentPxW)
  pendingScrollCenterRef.current = overflowW > 0 ? overflowW / 2 : 0

  return (
    <div className={styles.ftPanel}>
      <div className={styles.ftBody}>
        <div className={styles.ftStage} ref={stageRef}>
          <div style={{ position: 'relative', width: contentPxW, height: stageH }}>
            <div style={{
              position: 'absolute',
              left: scalerLeft,
              top:  scalerTop,
              width: vbW,
              height: vbH,
              transformOrigin: 'top left',
              transform: `scale(${scale})`,
            }}>
              <svg
                className={styles.ftSvg}
                width={vbW}
                height={vbH}
                viewBox={`${vbMinX} ${vbMinY} ${vbW} ${vbH}`}
              >
                {lines.map(l => <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} {...NF_LINE} />)}
              </svg>
              {nodes.map(node => (
                <EFNode
                  key={`nf-${node.id}-${node._x}`}
                  member={node}
                  isAnchor={node.isAnchor}
                  label={node.label}
                  size={54}
                  smallSize={42}
                  pixX={node.pixX}
                  pixY={node.pixY}
                  onClick={() => navigate(`/members/${node.id}`)}
                />
              ))}
            </div>
          </div>
        </div>
        {extraFamily.length > 0 && (
          <div className={styles.ftExtraList}>
            <div className={styles.ftExtraListTitle}>관계도 외 가족</div>
            {extraFamily.map(f => (
              <div key={f.id} className={styles.ftExtraListItem} onClick={() => navigate(`/members/${f.id}`)}>
                <span className={styles.ftExtraListName}>{f.name}</span>
                <span className={styles.ftExtraListRel}>{EF_REL[f.relation_type] ?? f.relation_type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}







function GroupMemberView({ groupId, groupType, currentMemberId }) {
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setGroup(null)
    const fetch = groupType === 'dept' ? deptApi.get(groupId) : communityApi.get(groupId)
    fetch.then(r => setGroup(r.data)).catch(() => setGroup(null)).finally(() => setLoading(false))
  }, [groupId, groupType])

  if (loading) return <div className={styles.cvLoading}>불러오는 중...</div>
  if (!group) return <div className={styles.cvLoading}>데이터를 불러올 수 없습니다.</div>

  const isHead = m => groupType === 'dept' ? m.id === group.head_id : m.role === 'leader'

  const sorted = [...(group.members || [])].sort((a, b) => {
    const aHead = isHead(a), bHead = isHead(b)
    if (aHead !== bHead) return aHead ? -1 : 1
    const aMe = a.id === currentMemberId, bMe = b.id === currentMemberId
    if (aMe !== bMe) return aMe ? -1 : 1
    const aDate = a.birth_date || '9999', bDate = b.birth_date || '9999'
    return aDate < bDate ? -1 : aDate > bDate ? 1 : 0
  })

  return (
    <div className={styles.cvWrap}>
      <div className={styles.cvGrid}>
        {sorted.map(m => (
          <HoverMemberNode
            key={m.id}
            member={m}
            isAnchor={m.id === currentMemberId}
            label={isHead(m) ? (groupType === 'dept' ? '부서장' : '리더') : (m.job_title || '')}
            size={52}
            smallSize={36}
            onClick={() => navigate(`/members/${m.id}`)}
          />
        ))}
      </div>
    </div>
  )
}

