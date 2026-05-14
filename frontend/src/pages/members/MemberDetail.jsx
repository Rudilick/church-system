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
  const [showPrivate, setShowPrivate] = useState(false)
  const [pinModal, setPinModal] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [pinAction, setPinAction] = useState(null) // 'view' | 'edit'
  const textareaRef = useRef(null)
  const [navCoords, setNavCoords] = useState(null)

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
            {member.phone && (
              <div className={styles.addressRow}>
                <span className={styles.addrLabel}>전화번호</span>
                <span className={styles.addrValue}>
                  {/Android|iPhone|iPad/i.test(navigator.userAgent)
                    ? <a href={`tel:${member.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{member.phone}</a>
                    : member.phone}
                </span>
              </div>
            )}

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
              {String(activeTab).startsWith('dept-') && (
                <DeptMemberView
                  deptId={Number(String(activeTab).replace('dept-', ''))}
                  currentMemberId={Number(id)}
                />
              )}
              {activeTab !== 'family' && !String(activeTab).startsWith('dept-') && (
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
                  onClick={openNaver}
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

// ── 핵가족 가계도 (가족 탭) — 세로 레이아웃 ─────────────────
const NYL = { par: 80, self: 210, ch: 340 }
const NF_R = 27   // node radius (half of 54px)
const NF_LINE = { stroke: '#cbd5e1', strokeWidth: 1.8, strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke' }

function NuclearFamilyView({ memberId }) {
  const navigate = useNavigate()
  const [selfData, setSelfData] = useState(null)
  const [spouseParentsData, setSpouseParentsData] = useState([])
  const [childrenSpousesMap, setChildrenSpousesMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true); setSelfData(null); setSpouseParentsData([]); setChildrenSpousesMap({})
    ;(async () => {
      try {
        const { data: self } = await api.get(memberId)
        const fam = self.family || []
        const spouseList = fam.filter(f => normalizeRel(f.relation_type) === 'spouse')
        const childList = fam.filter(f => normalizeRel(f.relation_type) === 'child')
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

        // 자녀의 배우자 조회
        const spouseMap = {}
        await Promise.all(childList.map(async child => {
          try {
            const childData = await api.get(child.id).then(r => r.data)
            const sp = (childData.family || []).find(f => normalizeRel(f.relation_type) === 'spouse')
            if (sp) spouseMap[child.id] = sp
          } catch {}
        }))

        if (active) {
          setSelfData(self)
          setSpouseParentsData(spParents)
          setChildrenSpousesMap(spouseMap)
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

  // ── 레이아웃 상수 ──────────────────────────────────────────
  const NODE_GAP = 100
  const PAR_OFFSET = 22  // smallSize(42) 반지름 21 + 1px 여백 → 원이 딱 붙음

  // ── 본인 행: [형제(연장순)...] [본인] [배우자?] ──────────
  const selfRowCount = siblings.length + 1 + (hasSpouse ? 1 : 0)
  const NFW = Math.max(560, selfRowCount * NODE_GAP + 200)

  const selfRowWidth = (selfRowCount - 1) * NODE_GAP
  const selfRowStart = (NFW - selfRowWidth) / 2

  const sibXs = siblings.map((_, i) => selfRowStart + i * NODE_GAP)
  const selfX = selfRowStart + siblings.length * NODE_GAP
  const spouseX = hasSpouse ? selfX + NODE_GAP : selfX

  // 출생 가족 그룹 (형제 + 본인): 부모 연결선 대상
  const birthFamilyXs = [...sibXs, selfX]
  const birthFamilyMinX = Math.min(...birthFamilyXs)
  const birthFamilyMaxX = Math.max(...birthFamilyXs)
  const birthFamilyMidX = (birthFamilyMinX + birthFamilyMaxX) / 2

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

  // ── 자녀 위치 (자녀 배우자 포함한 슬롯 계산) ─────────────
  const totalChildItems = children.reduce((acc, c) => acc + 1 + (childrenSpousesMap[c.id] ? 1 : 0), 0)
  const chTotalSpan = Math.max(0, (totalChildItems - 1) * NODE_GAP)
  const chStartX = coupleCenter - chTotalSpan / 2
  let chRelCursor = 0
  const chXs = [], chSpouseXs = []
  children.forEach(c => {
    chXs.push(chStartX + chRelCursor)
    if (childrenSpousesMap[c.id]) {
      chRelCursor += NODE_GAP
      chSpouseXs.push(chStartX + chRelCursor)
      chRelCursor += NODE_GAP
    } else {
      chSpouseXs.push(null)
      chRelCursor += NODE_GAP
    }
  })

  // ── 노드·선 빌더 ──────────────────────────────────────────
  const nodes = [], lines = []
  const N = (m, x, y, label, isAnchor = false) =>
    nodes.push({ ...m, _x: x, _y: y, label, isAnchor })
  const L = (x1, y1, x2, y2, key) => lines.push({ x1, y1, x2, y2, key })

  N(selfData, selfX, NYL.self, '본인', true)
  if (hasSpouse) N(spouse, spouseX, NYL.self, '배우자')
  siblings.forEach((s, i) => N(s, sibXs[i], NYL.self, '형제·자매'))
  myParents.forEach((p, i) => N(p, myParentXs[i], NYL.par, EF_REL[p.relation_type] ?? '부모'))
  spParents.forEach((p, i) => {
    const lbl = ({ 시부:'시부', 시모:'시모', 장인:'장인', 장모:'장모' })[p.relation_type]
      ?? (EF_REL[p.relation_type] ?? '배우자 부모')
    N(p, spParentXs[i], NYL.par, lbl)
  })
  children.forEach((c, i) => {
    N(c, chXs[i], NYL.ch, '자녀')
    const childSpouse = childrenSpousesMap[c.id]
    if (childSpouse && chSpouseXs[i] !== null) N(childSpouse, chSpouseXs[i], NYL.ch, '자녀 배우자')
  })

  // ── 연결선 ────────────────────────────────────────────────
  const elbY_par = (NYL.par + NYL.self) / 2
  const elbY_ch = (NYL.self + NYL.ch) / 2

  // 본인 ↔ 배우자
  if (hasSpouse) L(selfX + NF_R, NYL.self, spouseX - NF_R, NYL.self, 'spline')

  // 자녀 ↔ 자녀 배우자
  children.forEach((c, i) => {
    if (chSpouseXs[i] !== null) L(chXs[i] + NF_R, NYL.ch, chSpouseXs[i] - NF_R, NYL.ch, `chsp_${i}`)
  })

  // 부모 → 출생가족(형제+본인)
  if (myParents.length > 0) {
    L(myParentMidX, NYL.par + NF_R, myParentMidX, elbY_par, 'pel1')
    if (birthFamilyXs.length === 1) {
      L(selfX, elbY_par, selfX, NYL.self - NF_R, 'pel3')
    } else {
      L(birthFamilyMinX, elbY_par, birthFamilyMaxX, elbY_par, 'pbar')
      birthFamilyXs.forEach((bx, i) => L(bx, elbY_par, bx, NYL.self - NF_R, `pbd${i}`))
    }
  }

  // 배우자 부모 → 배우자
  if (hasSpouse && spParents.length > 0) {
    L(spParentMidX, NYL.par + NF_R, spParentMidX, NYL.self - NF_R, 'spel')
  }

  // 부부 → 자녀
  if (children.length > 0) {
    const chStartY = hasSpouse ? NYL.self : NYL.self + NF_R
    if (children.length === 1) {
      L(coupleCenter, chStartY, coupleCenter, elbY_ch, 'cel1')
      L(coupleCenter, elbY_ch, chXs[0], elbY_ch, 'cel2')
      L(chXs[0], elbY_ch, chXs[0], NYL.ch - NF_R, 'cel3')
    } else {
      const chMinX = Math.min(...chXs), chMaxX = Math.max(...chXs)
      L(coupleCenter, chStartY, coupleCenter, elbY_ch, 'cu')
      L(chMinX, elbY_ch, chMaxX, elbY_ch, 'cbar')
      chXs.forEach((cx, i) => L(cx, elbY_ch, cx, NYL.ch - NF_R, `cd${i}`))
    }
  }

  // ── 동적 viewBox ──────────────────────────────────────────
  const NF_PAD = 60
  const usedXs = nodes.map(n => n._x)
  const usedYs = nodes.map(n => n._y)
  // NFW 기준으로 최소 너비 보장 → 부모 ±22 간격이 실제 화면에서 인접하게 보임
  const vbMinX = Math.min(Math.min(...usedXs) - NF_PAD, -NF_PAD)
  const vbMaxX = Math.max(Math.max(...usedXs) + NF_PAD, NFW + NF_PAD)
  const vbMinY = Math.min(...usedYs) - NF_PAD
  const vbMaxY = Math.max(...usedYs) + NF_PAD + 44
  const vbW = vbMaxX - vbMinX
  const vbH = vbMaxY - vbMinY
  nodes.forEach(n => {
    n.pctX = ((n._x - vbMinX) / vbW) * 100
    n.pctY = ((n._y - vbMinY) / vbH) * 100
  })

  return (
    <div className={styles.ftPanel}>
      <div className={styles.ftStage}>
        <svg className={styles.ftSvg} viewBox={`${vbMinX} ${vbMinY} ${vbW} ${vbH}`} preserveAspectRatio="none">
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
