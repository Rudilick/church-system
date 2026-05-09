import { useEffect, useState, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { members as api, departments as deptApi, settings as settingsApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { genderColor } from '../../utils'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import styles from './Members.module.css'
import CommunityView from './CommunityView'
import KakaoMap from './KakaoMap'

export default function MemberDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [member, setMember] = useState(null)
  const [deptAssignments, setDeptAssignments] = useState([])
  const [notes, setNotes] = useState([])
  const [noteText, setNoteText]               = useState('')
  const [noteIsEvent, setNoteIsEvent]         = useState(false)
  const [noteEventDate, setNoteEventDate]     = useState('')
  const [noteEventTitle, setNoteEventTitle]   = useState('')
  const [noteIsSensitive, setNoteIsSensitive] = useState(false)
  const [noteSaving, setNoteSaving]           = useState(false)
  const { user } = useAuth()
  const canViewDetail = ['super_admin', 'church_admin', 'pastor'].includes(user?.role)

  const [activeTab, setActiveTab] = useState('family')
  const [hasExtended, setHasExtended] = useState(false)
  const [showPrivate, setShowPrivate] = useState(false)
  const [pinModal, setPinModal] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [pinAction, setPinAction] = useState(null) // 'view' | 'edit'
  const textareaRef = useRef(null)
  const [navPopup, setNavPopup] = useState(false)
  const [navCoords, setNavCoords] = useState(null)

  const formatAddress = (addr) => {
    if (!addr) return ''
    return addr.replace(/^[^\s]*도\s+/, '')
  }

  const openNavApp = (type) => {
    const rawAddr = formatAddress(fullAddress)
    const encoded = encodeURIComponent(rawAddr)
    setNavPopup(false)

    if (type === 'kakao') {
      const url = navCoords
        ? `https://map.kakao.com/link/to/${encoded},${navCoords.lat},${navCoords.lng}`
        : `https://map.kakao.com/?q=${encoded}`
      window.location.href = url
      return
    }

    if (type === 'naver') {
      const deeplink = navCoords
        ? `nmap://route/car?dlat=${navCoords.lat}&dlng=${navCoords.lng}&dname=${encoded}&appname=church`
        : `nmap://search?query=${encoded}&appname=church`
      window.location.href = deeplink
      setTimeout(() => {
        if (document.hasFocus()) window.open(`https://map.naver.com/v5/search/${encoded}`, '_blank')
      }, 1500)
      return
    }
  }

  useEffect(() => {
    setHasExtended(false)
    setActiveTab('family')
    setNavCoords(null)
    api.get(id).then(r => {
      setMember(r.data)
      hasExtendedFamily(r.data).then(setHasExtended).catch(() => setHasExtended(false))
    }).catch(() => toast.error('교인 정보를 불러오지 못했습니다.'))
    api.notes(id).then(r => setNotes(r.data)).catch(() => {})
    deptApi.byMember(id).then(r => setDeptAssignments(r.data || [])).catch(() => {})
  }, [id])


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
      const r = await api.addNote(id, noteText, { ...eventData, is_sensitive: noteIsSensitive })
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
    await api.removeNote(id, noteId).catch(() => toast.error('삭제 실패'))
    setNotes(prev => prev.filter(n => n.id !== noteId))
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
    } catch {
      toast.error('암호키가 올바르지 않습니다.')
    } finally {
      setPinLoading(false)
    }
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
    <>
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
                      style={{ background: genderColor(member.gender) }}>
                      {member.name[0]}
                    </div>
                }
                <div className={styles.profileInfo}>
                  <div className={styles.profileName}>
                    {member.name}
                    {member.position && <small style={{ fontWeight: 400, fontSize: '0.8rem', marginLeft: 8, color: '#94a3b8' }}>{member.position}</small>}
                  </div>
                </div>
              </div>
              <div className={styles.profileCardActions}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className={styles.btnSecondary} onClick={() => openPin('edit')}>수정</button>
                  <button className={styles.btnSecondary} style={{ color: '#ef4444', borderColor: '#fca5a5' }} onClick={handleDelete}>삭제</button>
                  <Link to={`/pastoral?member_id=${id}`} className={styles.btnSecondary} style={{ color: '#6366f1', borderColor: '#c7d2fe' }}>심방내역</Link>
                  {canViewDetail && (
                    showPrivate
                      ? <button className={styles.btnSecondary} style={{ color: '#059669', borderColor: '#6ee7b7' }} onClick={() => setShowPrivate(false)}>개인정보 숨기기</button>
                      : <button className={styles.btnSecondary} style={{ color: '#7c3aed', borderColor: '#c4b5fd' }} onClick={() => openPin('view')}>개인정보보기</button>
                  )}
                </div>
              </div>
            </div>

            {/* 기본 정보 — 항상 표시 */}
            <div className={styles.infoGrid3}>
              <InfoItem label="성별"    value={member.gender === 'M' ? '남' : member.gender === 'F' ? '여' : '-'} />
              <InfoItem label="직분"    value={member.position ?? '-'} />
              <InfoItem label="생년월일" value={member.birth_date ? dayjs(member.birth_date).format('YYYY.MM.DD') + (member.birth_lunar ? ' (음력)' : '') : '-'} />
            </div>
            <div className={styles.addressRow}>
              <span className={styles.addrLabel}>주소</span>
              <span className={styles.addrValue}>
                {[formatAddress(member.address), member.address_detail].filter(Boolean).join(' ') || '-'}
              </span>
            </div>

            {/* 개인정보 섹션 — 권한자에게만 표시, 기본은 각 값에 blur */}
            {canViewDetail && (
              <div>
                <div className={styles.infoGrid}>
                  <InfoItem label="주민등록번호" value={member.resident_id ?? '-'} blur={!showPrivate} />
                  <InfoItem label="교인구분"     value={member.membership_category ?? '-'} blur={!showPrivate} />
                  <InfoItem label="신급"         value={member.faith_level ?? '-'} blur={!showPrivate} />
                  <InfoItem label="신앙세대주"   value={member.household_head_name ?? '-'} blur={!showPrivate} />
                  <InfoItem label="세대주관계"   value={member.household_relation ?? '-'} blur={!showPrivate} />
                  <InfoItem label="직업"         value={member.occupation ?? '-'} blur={!showPrivate} />
                  <InfoItem label="결혼기념일"   value={member.anniversary_date ? dayjs(member.anniversary_date).format('YYYY.MM.DD') : '-'} blur={!showPrivate} />
                  <InfoItem label="인도자"       value={member.introducer_name ?? '-'} blur={!showPrivate} />
                  <InfoItem label="이전교회"     value={member.previous_church ?? '-'} blur={!showPrivate} />
                  <InfoItem label="이전교회직분" value={member.previous_church_position ?? '-'} blur={!showPrivate} />
                </div>
              </div>
            )}

          </div>
        </div>

        {/* 특이사항 카드 (남은 공간 + 내부 스크롤) */}
        <div className={styles.detailLeftSection}>
          <div className={styles.noteCard}>
            <div className={styles.noteCardHead}>
              <span className={styles.sectionTitle} style={{ margin: 0 }}>특이사항</span>
            </div>

            {/* 스크롤 영역: 입력창(sticky 고정) + 메모 목록 */}
            <div className={styles.noteCardScroll}>
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

              {notes.map(n => (
                <div key={n.id} className={`${styles.noteItem} ${n.event_id ? styles.noteItemEvent : ''} ${n.is_sensitive ? styles.noteItemSensitive : ''}`}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
                    {n.event_id && (
                      <span className={styles.noteEventBadge}>
                        📅 {n.event_date ? dayjs(n.event_date).format('YYYY.MM.DD') : n.event_title}
                      </span>
                    )}
                    {n.is_sensitive && (
                      <span className={styles.noteSensitiveBadge}>🔒 민감정보</span>
                    )}
                  </div>
                  <div
                    className={styles.noteContent}
                    style={n.is_sensitive && !showPrivate ? { filter: 'blur(4px)', userSelect: 'none' } : {}}
                  >
                    {n.content}
                  </div>
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
                {hasExtended && (
                  <button
                    className={activeTab === 'family+' ? styles.relationTabActive : styles.relationTab}
                    onClick={() => setActiveTab('family+')}
                  >가족+</button>
                )}
                {deptAssignments.map(a => (
                  <button
                    key={`dept-${a.department_id}`}
                    className={activeTab === `dept-${a.department_id}` ? styles.relationTabActive : styles.relationTab}
                    onClick={() => setActiveTab(`dept-${a.department_id}`)}
                  >{a.department_name}</button>
                ))}
                {member.communities?.map(c => (
                  <button
                    key={c.id}
                    className={activeTab === c.id ? styles.relationTabActive : styles.relationTab}
                    onClick={() => setActiveTab(c.id)}
                  >{c.name}</button>
                ))}
              </div>
            </div>
            <div className={styles.rightCardBody}>
              {activeTab === 'family' && <NuclearFamilyView memberId={Number(id)} />}
              {activeTab === 'family+' && <ExtendedFamilyView memberId={Number(id)} />}
              {String(activeTab).startsWith('dept-') && (
                <DeptMemberView
                  deptId={Number(String(activeTab).replace('dept-', ''))}
                  currentMemberId={Number(id)}
                />
              )}
              {activeTab !== 'family' && activeTab !== 'family+' && !String(activeTab).startsWith('dept-') && (
                <CommunityView communityId={activeTab} currentMemberId={Number(id)} />
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
                  onClick={() => setNavPopup(true)}
                  style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.82rem', color: '#3b82f6', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
                >🗺 길찾기</button>
              )}
            </div>
            <div className={styles.rightCardBody}>
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

    {navPopup && (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:9100, display:'flex', alignItems:'center', justifyContent:'center' }}
        onClick={() => setNavPopup(false)}>
        <div style={{ background:'#fff', borderRadius:14, padding:'22px 24px', width:280, boxShadow:'0 8px 32px rgba(0,0,0,.18)' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ fontSize:'0.95rem', fontWeight:700, color:'#1e293b', marginBottom:6 }}>내비게이션 앱으로 열기</div>
          <div style={{ fontSize:'0.8rem', color:'#64748b', marginBottom:16, wordBreak:'keep-all' }}>{formatAddress(fullAddress)}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[['kakao','카카오내비','#FEE500','#000'],['naver','네이버지도','#03C75A','#fff']].map(([type, label, bg, col]) => (
              <button key={type}
                style={{ padding:'10px 16px', borderRadius:10, border:'none', background:bg, color:col, fontWeight:700, fontSize:'0.9rem', cursor:'pointer', fontFamily:'inherit' }}
                onClick={() => openNavApp(type)}>
                {label}
              </button>
            ))}
          </div>
          <button style={{ marginTop:12, width:'100%', padding:'8px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', color:'#94a3b8', cursor:'pointer', fontFamily:'inherit', fontSize:'0.85rem' }}
            onClick={() => setNavPopup(false)}>취소</button>
        </div>
      </div>
    )}
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

function EFNode({ member, isAnchor, label, size, smallSize, pctX, pctY, onClick }) {
  const [hov, setHov] = useState(false)
  const color = genderColor(member.gender)
  const sz = isAnchor ? size : (hov ? size : smallSize)
  return (
    <div
      style={{ position: 'absolute', left: `${pctX}%`, top: `${pctY}%`,
               transform: 'translate(-50%, -50%)', cursor: 'pointer', zIndex: hov ? 10 : 1 }}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {/* circle 이 좌표의 정확한 중심 — 레이블은 절대위치로 circle 아래 배치 */}
      <div
        className={`${styles.ftCircle} ${isAnchor ? styles.ftAnchor : ''}`}
        style={{ width: sz, height: sz, borderColor: isAnchor ? undefined : color,
                 transition: 'width 0.15s, height 0.15s' }}
      >
        {member.photo_url
          ? <img src={member.photo_url} alt={member.name} />
          : <span style={{ fontSize: sz * 0.36, color: isAnchor ? undefined : color }}>
              {(member.name || '?')[0]}
            </span>
        }
      </div>
      <div style={{ position: 'absolute', top: '100%', left: '50%',
                    transform: 'translateX(-50%)', paddingTop: 5,
                    whiteSpace: 'nowrap', pointerEvents: 'none', textAlign: 'center' }}>
        <div className={styles.ftLabel}>{member.name}</div>
        {label && label !== '본인' && <div className={styles.ftRelLabel}>{label}</div>}
      </div>
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

// 2촌 관계 추론 규칙 (정규화된 영문 타입 사용)
function inferRel(via, rel) {
  const v = normalizeRel(via), r = normalizeRel(rel)
  if (v === 'parent') {
    if (r === 'parent')  return 'grandparent'
    if (r === 'spouse')  return 'parent'     // 아빠의 배우자 = 엄마
    if (r === 'sibling') return '_lat'        // 부모의 형제 = 이모/고모/삼촌
  }
  if (v === 'grandparent' && r === 'parent') return 'great_grandparent'
  if (v === 'sibling'     && r === 'child')  return 'nephew_niece'
  if (v === 'child'       && r === 'child')  return 'grandchild'
  if (['_lat','aunt_paternal','uncle_paternal','aunt_maternal','uncle_maternal'].includes(v)
      && r === 'child') return 'cousin'
  return null
}

// _lat → 성별 기반 aunt/uncle 타입
function latRelType(gender) {
  return gender === 'M' ? 'uncle_paternal' : 'aunt_paternal'
}

// ── 핵가족 유무 판별 (비동기) ─────────────────────────────
async function hasExtendedFamily(memberData) {
  const fam = memberData.family || []
  const nuclearTypes = new Set(['parent', 'child', 'spouse'])

  // 직접 저장된 관계 중 핵가족 밖이 있으면 바로 true
  if (fam.some(f => !nuclearTypes.has(normalizeRel(f.relation_type)))) return true

  if (fam.length === 0) return false
  const myIds = new Set([memberData.id, ...fam.map(f => f.id)])

  // 1촌 각각의 가족을 조회해 핵가족 밖이 있는지 확인
  const results = await Promise.all(
    fam.map(f =>
      api.get(f.id)
        .then(r => ({ selfRel: normalizeRel(f.relation_type), connFam: r.data.family || [] }))
        .catch(() => ({ selfRel: normalizeRel(f.relation_type), connFam: [] }))
    )
  )
  for (const { selfRel, connFam } of results) {
    for (const f of connFam) {
      if (myIds.has(f.id)) continue
      const r2 = normalizeRel(f.relation_type)
      if (selfRel === 'parent') {
        // 부모의 부모 = 조부모 / 부모의 형제 = 이모·고모·삼촌
        if (r2 === 'parent' || r2 === 'sibling') return true
      } else if (selfRel === 'spouse') {
        // 배우자의 형제 = 처남·시누이 등
        if (r2 === 'sibling') return true
        // 배우자의 자녀 중 내 자녀가 아닌 것
        if (r2 === 'child') return true
      } else if (selfRel === 'child') {
        // 자녀의 자녀 = 손자녀
        if (r2 === 'child') return true
      }
    }
  }
  return false
}

// ── 핵가족 가계도 (가족 탭) — 세로 레이아웃 ─────────────────
const NFW = 1000, NFH = 440
const NYL = { par: 80, self: 210, ch: 340 }
const NF_R = 27   // node radius (half of 54px)
const NF_LINE = { stroke: '#cbd5e1', strokeWidth: 1.8, strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke' }

function NuclearFamilyView({ memberId }) {
  const navigate = useNavigate()
  const [selfData, setSelfData] = useState(null)
  const [spouseParents, setSpouseParents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true); setSelfData(null); setSpouseParents([])
    ;(async () => {
      try {
        const { data: self } = await api.get(memberId)
        const fam = self.family || []
        const spouseList = fam.filter(f => normalizeRel(f.relation_type) === 'spouse')
        const spParents = []
        if (spouseList.length > 0) {
          const spouseDatas = await Promise.all(
            spouseList.map(s => api.get(s.id).then(r => r.data).catch(() => null))
          )
          for (const sd of spouseDatas) {
            if (!sd) continue
            for (const f of (sd.family || [])) {
              if (normalizeRel(f.relation_type) === 'parent') spParents.push(f)
            }
          }
        }
        if (active) { setSelfData(self); setSpouseParents(spParents); setLoading(false) }
      } catch { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [memberId])

  if (loading) return <div className={styles.cvLoading}>불러오는 중...</div>
  if (!selfData) return <div className={styles.cvLoading}>데이터를 불러올 수 없습니다.</div>

  const fam = selfData.family || []
  const myParents = fam.filter(f => normalizeRel(f.relation_type) === 'parent')
  const spouses   = fam.filter(f => normalizeRel(f.relation_type) === 'spouse')
  const children  = fam.filter(f => normalizeRel(f.relation_type) === 'child')
  const myIds     = new Set([selfData.id, ...fam.map(f => f.id)])
  const filteredSP = spouseParents.filter(p => !myIds.has(p.id))

  const totalFam = myParents.length + spouses.length + children.length + filteredSP.length
  if (totalFam === 0) return <div className={styles.cvLoading}>등록된 가족이 없습니다.</div>

  const hasSpouse = spouses.length > 0

  // 수평 분산 헬퍼
  const spreadX = (count, center, gap = 130) =>
    Array.from({ length: count }, (_, i) => center - ((count - 1) / 2) * gap + i * gap)

  // X 위치 계산 — 남편 항상 왼쪽, 아내 항상 오른쪽
  const selfIsMale = selfData.gender !== 'F'
  const selfX   = hasSpouse ? (selfIsMale ? NFW / 2 - 90 : NFW / 2 + 90) : NFW / 2
  const spouseX = selfIsMale ? NFW / 2 + 90 : NFW / 2 - 90

  const myParentXs = spreadX(myParents.length, selfX, 90)
  const spParentXs = spreadX(filteredSP.length, spouseX, 90)
  const spouseXs   = spouses.map(() => spouseX)
  const coupleCenter = hasSpouse ? (selfX + spouseX) / 2 : selfX
  const chXs = spreadX(children.length, coupleCenter, 90)

  const nodes = [], lines = []
  const N = (m, x, y, label, isAnchor = false) =>
    nodes.push({ ...m, _x: x, _y: y, label, isAnchor, pctX: (x / NFW) * 100, pctY: (y / NFH) * 100 })
  const L = (x1, y1, x2, y2, key) => lines.push({ x1, y1, x2, y2, key })

  N(selfData, selfX, NYL.self, '본인', true)
  spouses.forEach((s, i) => N(s, spouseXs[i], NYL.self, '배우자'))
  myParents.forEach((p, i) => N(p, myParentXs[i], NYL.par, EF_REL[p.relation_type] ?? '부모'))
  filteredSP.forEach((p, i) => N(p, spParentXs[i], NYL.par, '배우자 부모'))
  children.forEach((c, i) => N(c, chXs[i], NYL.ch, '자녀'))

  // 본인 ↔ 배우자 수평선 (min/max로 방향 무관)
  if (hasSpouse) L(Math.min(selfX, spouseX) + NF_R, NYL.self, Math.max(selfX, spouseX) - NF_R, NYL.self, 'spline')

  // 부모 → 본인: 꺾임 세로선
  if (myParents.length > 0) {
    const pMidX = myParents.length >= 2
      ? (Math.min(...myParentXs) + Math.max(...myParentXs)) / 2
      : myParentXs[0]
    const elbY = (NYL.par + NYL.self) / 2
    if (myParents.length >= 2) L(Math.min(...myParentXs), NYL.par, Math.max(...myParentXs), NYL.par, 'pcouple')
    L(pMidX, NYL.par + NF_R, pMidX, elbY,           'pel1')
    L(pMidX, elbY,           selfX,  elbY,            'pel2')
    L(selfX,  elbY,           selfX,  NYL.self - NF_R, 'pel3')
  }

  // 배우자 부모 → 배우자: 꺾임 세로선
  if (filteredSP.length > 0 && hasSpouse) {
    const spMidX = filteredSP.length >= 2
      ? (Math.min(...spParentXs) + Math.max(...spParentXs)) / 2
      : spParentXs[0]
    const elbY = (NYL.par + NYL.self) / 2
    if (filteredSP.length >= 2) L(Math.min(...spParentXs), NYL.par, Math.max(...spParentXs), NYL.par, 'sppcouple')
    L(spMidX,  NYL.par + NF_R, spMidX,  elbY,            'spel1')
    L(spMidX,  elbY,            spouseX, elbY,            'spel2')
    L(spouseX, elbY,            spouseX, NYL.self - NF_R, 'spel3')
  }

  // 부부 → 자녀: 꺾임 세로선
  if (children.length > 0) {
    const elbY = (NYL.self + NYL.ch) / 2
    if (children.length === 1) {
      L(coupleCenter, NYL.self + NF_R, coupleCenter, elbY,          'cel1')
      L(coupleCenter, elbY,            chXs[0],       elbY,          'cel2')
      L(chXs[0],      elbY,            chXs[0],       NYL.ch - NF_R, 'cel3')
    } else {
      const lC = Math.min(...chXs), rC = Math.max(...chXs)
      L(coupleCenter, NYL.self + NF_R, coupleCenter, elbY, 'cu')
      L(lC, elbY, rC, elbY, 'cbar')
      chXs.forEach((cx, i) => L(cx, elbY, cx, NYL.ch - NF_R, `cd${i}`))
    }
  }

  // 실제 사용 Y 범위로 viewBox 동적 계산
  const NF_PAD = 50
  const usedYs  = nodes.map(n => n._y)
  const nfMinY  = Math.min(...usedYs) - NF_PAD
  const nfViewH = Math.max(...usedYs) + NF_PAD - nfMinY
  nodes.forEach(n => { n.pctY = ((n._y - nfMinY) / nfViewH) * 100 })

  return (
    <div className={styles.ftPanel}>
      <div className={styles.ftStage}>
        <svg className={styles.ftSvg} viewBox={`0 ${nfMinY} ${NFW} ${nfViewH}`} preserveAspectRatio="none">
          {lines.map(l => <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} {...NF_LINE} />)}
        </svg>
        {nodes.map(node => (
          <EFNode
            key={`nf-${node.id}`}
            member={node}
            isAnchor={node.isAnchor}
            label={node.label}
            size={54}
            smallSize={42}
            pctX={node.pctX}
            pctY={node.pctY}
            onClick={() => navigate(`/members/${node.id}`)}
          />
        ))}
      </div>
    </div>
  )
}

function ExtendedFamilyView({ memberId }) {
  const navigate = useNavigate()
  const [selfData, setSelfData] = useState(null)
  const [famEntries, setFamEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true); setSelfData(null); setFamEntries([])
    ;(async () => {
      try {
        const { data: self } = await api.get(memberId)
        const seen = new Map([[self.id, 'self']])  // id → inferredRelType
        const entries = []
        const addEntry = (m, inferredRel, viaId = null) => {
          if (seen.has(m.id)) return
          const rel = inferredRel === '_lat' ? latRelType(m.gender) : inferredRel
          seen.set(m.id, rel)
          entries.push({ ...m, inferredRel: rel, viaId })
        }

        // ── 1촌: 직접 저장된 관계 (relation_type 정규화) ─────────
        const fam1 = self.family || []
        for (const f of fam1) addEntry(f, normalizeRel(f.relation_type))

        // ── 2촌: 1촌 각각의 가족 조회 ────────────────────────
        const fam1Fetched = await Promise.all(
          fam1.map(f => api.get(f.id).then(r => ({ via: f.relation_type, viaId: f.id, fam: r.data.family || [] })).catch(() => ({ via: f.relation_type, viaId: f.id, fam: [] })))
        )
        const gpIds = []  // 조부모 ID 모음 (3촌용)
        for (const { via, viaId, fam } of fam1Fetched) {
          for (const f of fam) {
            if (seen.has(f.id)) continue
            const inferred = inferRel(via, f.relation_type)
            if (!inferred) continue
            const rel = inferred === '_lat' ? latRelType(f.gender) : inferred
            addEntry(f, rel, viaId)
            if (rel === 'grandparent') gpIds.push(f.id)
          }
        }

        // ── 3촌: 조부모의 부모 = 증조부모 ────────────────────
        const gpFetched = await Promise.all(
          gpIds.map(gpId => api.get(gpId).then(r => r.data.family || []).catch(() => []))
        )
        for (const gpFam of gpFetched) {
          for (const f of gpFam) {
            if (seen.has(f.id)) continue
            const inferred = inferRel('grandparent', f.relation_type)
            if (inferred) addEntry(f, inferred === '_lat' ? latRelType(f.gender) : inferred)
          }
        }

        if (active) { setSelfData(self); setFamEntries(entries); setLoading(false) }
      } catch {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [memberId])

  if (loading) return <div className={styles.cvLoading}>불러오는 중...</div>
  if (!selfData) return <div className={styles.cvLoading}>데이터를 불러올 수 없습니다.</div>

  const ofType = (...types) => famEntries.filter(f => types.includes(f.inferredRel))
  const byAge = arr => [...arr].sort((a, b) => (a.birth_date ?? '9999') < (b.birth_date ?? '9999') ? -1 : 1)

  const ggParents  = ofType('great_grandparent')
  const gParents   = ofType('grandparent')
  const parents    = ofType('parent')
  const spouses    = ofType('spouse')
  const siblings   = byAge(ofType('sibling'))
  const children   = ofType('child')
  const gChildren  = ofType('grandchild')
  const ggChildren = ofType('great_grandchild')
  const patLat     = byAge(ofType('aunt_paternal', 'uncle_paternal'))
  const matLat     = byAge(ofType('aunt_maternal', 'uncle_maternal'))
  const nephews    = ofType('nephew_niece')
  const cousins    = ofType('cousin')

  // ── 세로 레이아웃 좌표 체계 ─────────────────────────────────
  const EF2W = 1400, EF2H = 820
  const ROW = { ggp: 70, gp: 190, par: 310, self: 430, ch: 550, gch: 670, ggch: 760 }
  const EF2R = 23
  const EL2 = { stroke: '#cbd5e1', strokeWidth: 1.8, strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke' }

  const spreadX2 = (count, center, gap = 120) =>
    count === 0 ? [] :
    Array.from({ length: count }, (_, i) => center - ((count - 1) / 2) * gap + i * gap)

  const nodes2 = [], lines2 = []
  const N2 = (m, x, y, label, isAnchor = false) =>
    nodes2.push({ ...m, _x: x, _y: y, label, isAnchor, pctX: 0, pctY: 0 })
  const L2 = (x1, y1, x2, y2, key) => lines2.push({ x1, y1, x2, y2, key })

  const hasSpouse = spouses.length > 0
  const selfIsMale2 = selfData.gender !== 'F'
  const selfXbase = EF2W / 2
  const selfX   = hasSpouse ? (selfIsMale2 ? selfXbase - 73 : selfXbase + 73) : selfXbase
  const spouseX = selfIsMale2 ? selfXbase + 73 : selfXbase - 73
  const coupleCenter = hasSpouse ? (selfX + spouseX) / 2 : selfX

  // ── 자신 행 (남편 왼쪽, 아내 오른쪽, 형제자매 왼쪽, 사촌 더 왼쪽) ────
  N2(selfData, selfX, ROW.self, '본인', true)
  spouses.forEach((s, i) => N2(s, selfIsMale2 ? spouseX + i * 130 : spouseX - i * 130, ROW.self, '배우자'))
  if (hasSpouse) L2(Math.min(selfX, spouseX) + EF2R, ROW.self, Math.max(selfX, spouseX) - EF2R, ROW.self, 'sp2')

  const siblingXs = siblings.map((_, i) => selfX - 130 - i * 120)
  siblings.forEach((s, i) => N2(s, siblingXs[i], ROW.self, '형제자매'))

  const cousinBase = siblingXs.length > 0 ? siblingXs[siblingXs.length - 1] - 130 : selfX - 260
  const cousinXs = cousins.map((_, i) => cousinBase - i * 110)
  cousins.forEach((c, i) => N2(c, cousinXs[i], ROW.self, '사촌'))

  // ── 부모 행 (부모 자신 위, 고모/삼촌 왼쪽, 이모/외삼촌 오른쪽) ─
  const parentXs = spreadX2(parents.length, selfX, 120)
  const patLatBase = parentXs.length > 0 ? Math.min(...parentXs) - 130 : selfX - 130
  const matLatBase = parentXs.length > 0 ? Math.max(...parentXs) + 130 : selfX + 130
  const patLatXs = patLat.map((_, i) => patLatBase - i * 110)
  const matLatXs = matLat.map((_, i) => matLatBase + i * 110)

  parents.forEach((p, i) => N2(p, parentXs[i], ROW.par, EF_REL[p.relation_type] ?? '부모'))
  patLat.forEach((a, i) => N2(a, patLatXs[i], ROW.par, EF_REL[a.inferredRel] ?? a.inferredRel))
  matLat.forEach((a, i) => N2(a, matLatXs[i], ROW.par, EF_REL[a.inferredRel] ?? a.inferredRel))

  // 부모 → 자신+형제자매 연결
  if (parents.length > 0) {
    const pLX = Math.min(...parentXs), pRX = Math.max(...parentXs)
    const pMidX = (pLX + pRX) / 2
    if (parents.length >= 2) L2(pLX, ROW.par, pRX, ROW.par, 'pcouple2')
    const selfSibXs = [selfX, ...siblingXs]
    const elbY = (ROW.par + ROW.self) / 2
    if (selfSibXs.length === 1) {
      L2(pMidX, ROW.par + EF2R, pMidX, elbY, 'pel2_1')
      L2(pMidX, elbY, selfX, elbY, 'pel2_2')
      L2(selfX, elbY, selfX, ROW.self - EF2R, 'pel2_3')
    } else {
      const lX = Math.min(...selfSibXs), rX = Math.max(...selfSibXs)
      const midX = (lX + rX) / 2
      L2(pMidX, ROW.par + EF2R, pMidX, elbY, 'pjoin2_1')
      L2(pMidX, elbY, midX, elbY, 'pjoin2_2')
      L2(lX, elbY, rX, elbY, 'pbar2')
      selfSibXs.forEach((sx, i) => L2(sx, elbY, sx, ROW.self - EF2R, `psd2_${i}`))
    }
  }

  // ── 조부모 행 — 각 부모 위에 해당 조부모 배치 ──────────────────
  const GP_TYPES2 = new Set(['paternal_grandfather','paternal_grandmother','maternal_grandfather','maternal_grandmother'])
  const gpLabel = gp =>
    GP_TYPES2.has(gp.relation_type) ? (EF_REL[gp.relation_type] ?? '조부모') :
    gp.gender === 'M' ? '조부' : gp.gender === 'F' ? '조모' : '조부모'

  // viaId 기준으로 조부모를 부모별 그룹핑
  const gpByVia = new Map()
  gParents.forEach(gp => {
    const key = gp.viaId ?? '_unknown'
    if (!gpByVia.has(key)) gpByVia.set(key, [])
    gpByVia.get(key).push(gp)
  })

  // 각 조부모의 x 계산: 해당 부모의 x 위에 분산
  const gpXs = gParents.map(() => selfX)
  parents.forEach((p, pi) => {
    const gps = gpByVia.get(p.id) || []
    const localXs = spreadX2(gps.length, parentXs[pi], 100)
    gps.forEach((gp, gi) => {
      const idx = gParents.indexOf(gp)
      if (idx >= 0) gpXs[idx] = localXs[gi]
    })
  })
  // 소속 불명 조부모는 selfX 위에 분산
  const unknownGps = gpByVia.get('_unknown') || []
  unknownGps.forEach((gp, gi) => {
    const idx = gParents.indexOf(gp)
    if (idx >= 0) gpXs[idx] = selfX - ((unknownGps.length - 1) / 2 - gi) * 100
  })

  gParents.forEach((gp, i) => N2(gp, gpXs[i], ROW.gp, gpLabel(gp)))

  // 부모별로 각자의 조부모와 연결선 그리기
  const elbYgp = (ROW.gp + ROW.par) / 2
  parents.forEach((p, pi) => {
    const gps = gpByVia.get(p.id) || []
    if (gps.length === 0) return
    const px = parentXs[pi]
    const localXs = spreadX2(gps.length, px, 100)
    const gpLX = Math.min(...localXs), gpRX = Math.max(...localXs)
    const gpMidX = (gpLX + gpRX) / 2
    if (gps.length >= 2) L2(gpLX, ROW.gp, gpRX, ROW.gp, `gpbar_${pi}`)
    L2(gpMidX, ROW.gp + EF2R, gpMidX, elbYgp, `gpel1_${pi}`)
    L2(gpMidX, elbYgp, px, elbYgp, `gpel2_${pi}`)
    L2(px, elbYgp, px, ROW.par - EF2R, `gpel3_${pi}`)
  })

  // ── 증조부모 행 — 각 조부모 위에 해당 증조부모 배치 ────────────
  const ggpByVia = new Map()
  ggParents.forEach(ggp => {
    const key = ggp.viaId ?? '_unknown'
    if (!ggpByVia.has(key)) ggpByVia.set(key, [])
    ggpByVia.get(key).push(ggp)
  })

  const ggpXs = ggParents.map(() => selfX)
  gParents.forEach((gp, gi) => {
    const ggps = ggpByVia.get(gp.id) || []
    const localXs = spreadX2(ggps.length, gpXs[gi], 90)
    ggps.forEach((ggp, i) => {
      const idx = ggParents.indexOf(ggp)
      if (idx >= 0) ggpXs[idx] = localXs[i]
    })
  })

  ggParents.forEach((ggp, i) => N2(ggp, ggpXs[i], ROW.ggp,
    ggp.gender === 'M' ? '증조부' : ggp.gender === 'F' ? '증조모' : '증조부모'))

  const elbYggp = (ROW.ggp + ROW.gp) / 2
  gParents.forEach((gp, gi) => {
    const ggps = ggpByVia.get(gp.id) || []
    if (ggps.length === 0) return
    const gpX = gpXs[gi]
    const localXs = spreadX2(ggps.length, gpX, 90)
    const ggpLX = Math.min(...localXs), ggpRX = Math.max(...localXs)
    const ggpMidX = (ggpLX + ggpRX) / 2
    if (ggps.length >= 2) L2(ggpLX, ROW.ggp, ggpRX, ROW.ggp, `ggpbar_${gi}`)
    L2(ggpMidX, ROW.ggp + EF2R, ggpMidX, elbYggp, `ggpel1_${gi}`)
    L2(ggpMidX, elbYggp, gpX, elbYggp, `ggpel2_${gi}`)
    L2(gpX, elbYggp, gpX, ROW.gp - EF2R, `ggpel3_${gi}`)
  })

  // ── 자녀 행 (자녀 중앙, 조카 오른쪽) ────────────────────────
  const childXs = spreadX2(children.length, coupleCenter, 120)
  const nephewBase = childXs.length > 0 ? Math.max(...childXs) + 130 : coupleCenter + 130
  const nephewXs = nephews.map((_, i) => nephewBase + i * 110)
  children.forEach((c, i) => N2(c, childXs[i], ROW.ch, '자녀'))
  nephews.forEach((n, i) => N2(n, nephewXs[i], ROW.ch, '조카'))

  if (children.length > 0) {
    const elbY = (ROW.self + ROW.ch) / 2
    if (children.length === 1) {
      L2(coupleCenter, ROW.self + EF2R, coupleCenter, elbY, 'cel2_1')
      L2(coupleCenter, elbY, childXs[0], elbY, 'cel2_2')
      L2(childXs[0], elbY, childXs[0], ROW.ch - EF2R, 'cel2_3')
    } else {
      const lC = Math.min(...childXs), rC = Math.max(...childXs)
      L2(coupleCenter, ROW.self + EF2R, coupleCenter, elbY, 'cu2')
      L2(lC, elbY, rC, elbY, 'cbar2')
      childXs.forEach((cx, i) => L2(cx, elbY, cx, ROW.ch - EF2R, `cd2_${i}`))
    }
  }

  // ── 손자녀 + 증손자녀 행 ──────────────────────────────────────
  const childMidX = childXs.length > 0 ? (Math.min(...childXs) + Math.max(...childXs)) / 2 : coupleCenter
  const gcXs = spreadX2(gChildren.length, childMidX, 110)
  const ggcXs = spreadX2(ggChildren.length, childMidX, 110)
  gChildren.forEach((gc, i) => N2(gc, gcXs[i], ROW.gch, '손자녀'))
  ggChildren.forEach((ggc, i) => N2(ggc, ggcXs[i], ROW.ggch, '증손자녀'))

  if (gChildren.length > 0 && children.length > 0) {
    const elbY = (ROW.ch + ROW.gch) / 2
    if (gChildren.length === 1) {
      L2(childMidX, ROW.ch + EF2R, childMidX, elbY, 'gcel2_1')
      L2(childMidX, elbY, gcXs[0], elbY, 'gcel2_2')
      L2(gcXs[0], elbY, gcXs[0], ROW.gch - EF2R, 'gcel2_3')
    } else {
      const lGC = Math.min(...gcXs), rGC = Math.max(...gcXs)
      L2(childMidX, ROW.ch + EF2R, childMidX, elbY, 'gcu2')
      L2(lGC, elbY, rGC, elbY, 'gcbar2')
      gcXs.forEach((gx, i) => L2(gx, elbY, gx, ROW.gch - EF2R, `gcd2_${i}`))
    }
  }

  if (nodes2.length <= 1) return <div className={styles.cvLoading}>등록된 가족이 없습니다.</div>

  // 실제 사용 범위로 viewBox 동적 계산
  const EF2_PAD = 50
  const ef2Ys = nodes2.map(n => n._y)
  const ef2Xs = nodes2.map(n => n._x)
  const ef2MinY = Math.min(...ef2Ys) - EF2_PAD
  const ef2MaxY = Math.max(...ef2Ys) + EF2_PAD + 44
  const ef2MinX = Math.min(...ef2Xs) - EF2_PAD
  const ef2MaxX = Math.max(...ef2Xs) + EF2_PAD
  const ef2VH = ef2MaxY - ef2MinY
  const ef2VW = ef2MaxX - ef2MinX

  nodes2.forEach(n => {
    n.pctX = ((n._x - ef2MinX) / ef2VW) * 100
    n.pctY = ((n._y - ef2MinY) / ef2VH) * 100
  })

  return (
    <div className={styles.ftPanel}>
      <div className={styles.ftStage}>
        <svg className={styles.ftSvg} viewBox={`${ef2MinX} ${ef2MinY} ${ef2VW} ${ef2VH}`} preserveAspectRatio="none">
          {lines2.map(l => (
            <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} {...EL2} />
          ))}
        </svg>
        {nodes2.map(node => (
          <EFNode
            key={`ef2-${node.id}-${node._x}`}
            member={node}
            isAnchor={node.isAnchor}
            label={node.label}
            size={46}
            smallSize={36}
            pctX={node.pctX}
            pctY={node.pctY}
            onClick={() => navigate(`/members/${node.id}`)}
          />
        ))}
      </div>
    </div>
  )
}

function DeptMemberView({ deptId, currentMemberId }) {
  const navigate = useNavigate()
  const [dept, setDept] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setDept(null)
    deptApi.get(deptId)
      .then(r => setDept(r.data))
      .catch(() => setDept(null))
      .finally(() => setLoading(false))
  }, [deptId])

  if (loading) return <div className={styles.cvLoading}>불러오는 중...</div>
  if (!dept) return <div className={styles.cvLoading}>데이터를 불러올 수 없습니다.</div>

  return (
    <div className={styles.cvWrap}>
      {dept.description && <p className={styles.cvDesc}>{dept.description}</p>}
      <div className={styles.cvGrid}>
        {(dept.members || []).map(m => (
          <HoverMemberNode
            key={m.id}
            member={m}
            isAnchor={m.id === currentMemberId}
            label={m.job_title || (m.role && m.role !== 'member' ? m.role : '')}
            size={52}
            smallSize={36}
            onClick={() => navigate(`/members/${m.id}`)}
          />
        ))}
      </div>
    </div>
  )
}
