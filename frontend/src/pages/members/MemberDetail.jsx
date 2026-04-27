import { useEffect, useState, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { members as api, departments as deptApi, settings as settingsApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
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
  const [noteText, setNoteText]           = useState('')
  const [noteIsEvent, setNoteIsEvent]     = useState(false)
  const [noteEventDate, setNoteEventDate] = useState('')
  const [noteEventTitle, setNoteEventTitle] = useState('')
  const [noteSaving, setNoteSaving]       = useState(false)
  const { user } = useAuth()
  const canViewDetail = ['super_admin', 'church_admin', 'pastor'].includes(user?.role)

  const [activeTab, setActiveTab] = useState('family')
  const [hasExtended, setHasExtended] = useState(false)
  const [unlocked, setUnlocked]     = useState(false)
  const [pinModal, setPinModal]     = useState(false)
  const [pinInput, setPinInput]     = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    setHasExtended(false)
    setActiveTab('family')
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
      const r = await api.addNote(id, noteText, eventData)
      setNotes(prev => [r.data, ...prev])
      setNoteText('')
      setNoteIsEvent(false)
      setNoteEventDate('')
      setNoteEventTitle('')
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

  const verifyPin = async () => {
    if (!pinInput.trim()) return
    setPinLoading(true)
    try {
      await settingsApi.verifyMemberPin(pinInput)
      setUnlocked(true)
      setPinModal(false)
      setPinInput('')
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
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link to={`/members/${id}/edit`} className={styles.btnSecondary}>수정</Link>
                  <button className={styles.btnSecondary} style={{ color: '#ef4444', borderColor: '#fca5a5' }} onClick={handleDelete}>삭제</button>
                  {canViewDetail ? (
                    !unlocked
                      ? <button className={styles.btnSecondary} style={{ color: '#7c3aed', borderColor: '#c4b5fd' }} onClick={() => setPinModal(true)}>상세정보 🔒</button>
                      : <button className={styles.btnSecondary} style={{ color: '#059669', borderColor: '#6ee7b7' }} onClick={() => setUnlocked(false)}>잠금 🔓</button>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', alignSelf: 'center' }}>상세정보 — 목회자 전용</span>
                  )}
                </div>
              </div>
            </div>

            {/* 2열 정보 그리드 — 핵심 4개만 표면에 표시, 상세정보는 잠금 해제 후 */}
            <div className={styles.infoGrid}>
              <InfoItem label="성별"    value={member.gender === 'M' ? '남' : member.gender === 'F' ? '여' : '-'} />
              <InfoItem label="생년월일" value={member.birth_date ? dayjs(member.birth_date).format('YYYY년 MM월 DD일') + (member.birth_lunar ? ' (음력)' : '') : '-'} />
              <InfoItem label="직분"    value={member.position ?? '-'} />
              <InfoItem label="주소"    value={fullAddress || '-'} />
            </div>

            {/* 상세정보 패널 (PIN 해제 후 표시) */}
            {unlocked && (
              <div style={{ marginTop: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#065f46', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  🔓 상세 정보 (잠금 해제됨)
                </div>
                <div className={styles.infoGrid}>
                  <InfoItem label="주민등록번호" value={member.resident_id ?? '-'} />
                  <InfoItem label="교인구분"     value={member.membership_category ?? '-'} />
                  <InfoItem label="신급"         value={member.faith_level ?? '-'} />
                  <InfoItem label="신앙세대주"   value={member.household_head_name ?? '-'} />
                  <InfoItem label="세대주관계"   value={member.household_relation ?? '-'} />
                  <InfoItem label="직업"         value={member.occupation ?? '-'} />
                  <InfoItem label="결혼기념일"   value={member.anniversary_date ? dayjs(member.anniversary_date).format('YYYY.MM.DD') : '-'} />
                  <InfoItem label="인도자"       value={member.introducer_name ?? '-'} />
                  <InfoItem label="이전교회"     value={member.previous_church ?? '-'} />
                  <InfoItem label="이전교회직분" value={member.previous_church_position ?? '-'} />
                  <InfoItem label="상세주소"     value={member.address_detail ?? '-'} />
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
            <div className={styles.noteCardScroll}>
              <div className={styles.noteInputWrap}>
                <label className={styles.noteEventCheck}>
                  <input
                    type="checkbox"
                    checked={noteIsEvent}
                    onChange={e => setNoteIsEvent(e.target.checked)}
                  />
                  📅 일정으로 등록
                </label>

                {noteIsEvent && (
                  <div className={styles.noteEventFields}>
                    <input
                      type="date"
                      className={styles.noteEventInput}
                      value={noteEventDate}
                      onChange={e => setNoteEventDate(e.target.value)}
                    />
                    <input
                      className={styles.noteEventInput}
                      value={noteEventTitle}
                      onChange={e => setNoteEventTitle(e.target.value)}
                      placeholder="캘린더 표시 제목 *"
                    />
                  </div>
                )}

                <textarea
                  ref={textareaRef}
                  className={styles.noteTextarea}
                  placeholder={noteIsEvent ? '일정 내용 (캘린더에서 마우스 오버/터치 시 표시)' : '특이사항을 입력하세요...'}
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
                <div key={n.id} className={`${styles.noteItem} ${n.event_id ? styles.noteItemEvent : ''}`}>
                  {n.event_id && (
                    <div className={styles.noteEventBadge}>
                      📅 {n.event_title}
                      {n.event_date && <span className={styles.noteEventBadgeDate}> · {dayjs(n.event_date).format('YYYY.MM.DD')}</span>}
                    </div>
                  )}
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
            </div>
            <div className={styles.rightCardBody}>
              <KakaoMap address={fullAddress || null} />
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
      />
    )}
    </>
  )
}

function PinModal({ pinInput, setPinInput, onVerify, onClose, loading }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', width: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>상세정보 열람</div>
        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 18 }}>민감 정보를 열람하려면 암호키를 입력하세요.</div>
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

function InfoItem({ label, value }) {
  return (
    <div className={styles.infoItem}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{value}</span>
    </div>
  )
}

function HoverMemberNode({ member, isAnchor, label, size, smallSize, onClick }) {
  const [hov, setHov] = useState(false)
  const color = member.gender === 'M' ? '#3b82f6' : member.gender === 'F' ? '#f472b6' : '#94a3b8'
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
const EFW = 800, EFH = 520, ECX = 400
const EROW = { ggp: 38, gp: 118, par: 210, sel: 305, ch: 392, gch: 460 }
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
  const color = member.gender === 'M' ? '#3b82f6' : member.gender === 'F' ? '#f472b6' : '#94a3b8'
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
                    transform: 'translateX(-50%)', textAlign: 'center',
                    paddingTop: 3, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
        <div className={styles.ftLabel}>{member.name}</div>
        {label && label !== '본인' && <div className={styles.ftRelLabel}>{label}</div>}
      </div>
    </div>
  )
}

// 한글·영문 혼용 relation_type 을 영문으로 정규화
function normalizeRel(type) {
  const m = {
    '배우자':'spouse','부모':'parent','자녀':'child','형제·자매':'sibling','형제자매':'sibling',
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

// ── 핵가족 가계도 (가족 탭) ───────────────────────────────
const NFW = 700, NFH = 320
const NROW = { par: 42, self: 168, ch: 285 }
const NF_LINE = { stroke: '#cbd5e1', strokeWidth: 1.8, strokeLinecap: 'round' }

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
  const myParents  = fam.filter(f => normalizeRel(f.relation_type) === 'parent')
  const spouses    = fam.filter(f => normalizeRel(f.relation_type) === 'spouse')
  const children   = fam.filter(f => normalizeRel(f.relation_type) === 'child')
  const siblings   = fam.filter(f => normalizeRel(f.relation_type) === 'sibling')
    .sort((a, b) => (a.birth_date ?? '9999') < (b.birth_date ?? '9999') ? -1 : 1)
  const myIds      = new Set([selfData.id, ...fam.map(f => f.id)])
  const filteredSP = spouseParents.filter(p => !myIds.has(p.id))

  const selfX   = spouses.length > 0 ? NFW / 2 - 48 : NFW / 2
  const spouseX = NFW / 2 + 48
  const midX    = spouses.length > 0 ? (selfX + spouseX) / 2 : selfX

  const nodes = [], lines = []
  const N = (m, x, y, label, isAnchor = false) =>
    nodes.push({ ...m, _x: x, _y: y, label, isAnchor, pctX: (x / NFW) * 100, pctY: (y / NFH) * 100 })
  const L = (x1, y1, x2, y2, key) => lines.push({ x1, y1, x2, y2, key })

  // 본인·배우자
  N(selfData, selfX, NROW.self, '본인', true)
  spouses.forEach((s, i) => N(s, spouseX + i * 80, NROW.self, '배우자'))

  // 부모
  const myPXs = myParents.length === 0 ? [] :
    myParents.length === 1 ? [selfX] :
    myParents.map((_, i) => selfX - (myParents.length - 1) * 48 + i * 96)
  myParents.forEach((p, i) => N(p, myPXs[i], NROW.par, '부모'))

  // 배우자 부모 (배우자가 있을 때만)
  const spPCX = spouses.length > 0 ? spouseX : NFW / 2 + 130
  const spPXs = filteredSP.length === 0 ? [] :
    filteredSP.length === 1 ? [spPCX] :
    filteredSP.map((_, i) => spPCX - (filteredSP.length - 1) * 48 + i * 96)
  filteredSP.forEach((p, i) => N(p, spPXs[i], NROW.par, '배우자 부모'))

  // 자녀
  const chXs = children.length === 0 ? [] :
    children.length === 1 ? [midX] :
    children.map((_, i) => midX - (children.length - 1) * 62 + i * 124)
  children.forEach((c, i) => N(c, chXs[i], NROW.ch, '자녀'))

  // 연결선: 부모 → 본인
  if (myParents.length > 0) {
    const jY = (NROW.par + NROW.self) / 2
    L(selfX, NROW.self, selfX, jY, 'su')
    if (myPXs.length > 1) L(myPXs[0], jY, myPXs[myPXs.length - 1], jY, 'pbar')
    myPXs.forEach((px, i) => L(px, NROW.par, px, jY, `pd${i}`))
  }
  // 연결선: 배우자 부모 → 배우자
  if (filteredSP.length > 0 && spouses.length > 0) {
    const jY = (NROW.par + NROW.self) / 2
    L(spouseX, NROW.self, spouseX, jY, 'spsu')
    if (spPXs.length > 1) L(spPXs[0], jY, spPXs[spPXs.length - 1], jY, 'sppbar')
    spPXs.forEach((px, i) => L(px, NROW.par, px, jY, `sppd${i}`))
  }
  // 연결선: 본인 — 배우자
  if (spouses.length > 0) L(selfX, NROW.self, spouseX, NROW.self, 'spline')
  // 연결선: 본인 → 자녀
  if (children.length > 0) {
    const jY = (NROW.self + NROW.ch) / 2
    L(midX, NROW.self, midX, jY, 'cu')
    if (chXs.length > 1) L(chXs[0], jY, chXs[chXs.length - 1], jY, 'cbar')
    chXs.forEach((cx, i) => L(cx, jY, cx, NROW.ch, `cd${i}`))
  }

  const totalFam = myParents.length + spouses.length + children.length + filteredSP.length
  if (totalFam === 0) return <div className={styles.cvLoading}>등록된 가족이 없습니다.</div>

  // 실제 사용된 Y 범위로 viewBox 동적 계산 (빈 행 공간 제거)
  const NF_PAD = 40
  const usedYs = nodes.map(n => n._y)
  const nfMinY = Math.min(...usedYs) - NF_PAD
  const nfMaxY = Math.max(...usedYs) + NF_PAD
  const nfViewH = nfMaxY - nfMinY
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
        const addEntry = (m, inferredRel) => {
          if (seen.has(m.id)) return
          const rel = inferredRel === '_lat' ? latRelType(m.gender) : inferredRel
          seen.set(m.id, rel)
          entries.push({ ...m, inferredRel: rel })
        }

        // ── 1촌: 직접 저장된 관계 (relation_type 정규화) ─────────
        const fam1 = self.family || []
        for (const f of fam1) addEntry(f, normalizeRel(f.relation_type))

        // ── 2촌: 1촌 각각의 가족 조회 ────────────────────────
        const fam1Fetched = await Promise.all(
          fam1.map(f => api.get(f.id).then(r => ({ via: f.relation_type, fam: r.data.family || [] })).catch(() => ({ via: f.relation_type, fam: [] })))
        )
        const gpIds = []  // 조부모 ID 모음 (3촌용)
        for (const { via, fam } of fam1Fetched) {
          for (const f of fam) {
            if (seen.has(f.id)) continue
            const inferred = inferRel(via, f.relation_type)
            if (!inferred) continue
            const rel = inferred === '_lat' ? latRelType(f.gender) : inferred
            addEntry(f, rel)
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
  const patLat     = byAge(ofType('aunt_paternal', 'uncle_paternal'))   // 고모, 삼촌
  const matLat     = byAge(ofType('aunt_maternal', 'uncle_maternal'))   // 이모, 외삼촌
  const nephews    = ofType('nephew_niece')
  const cousins   = ofType('cousin')

  const nodes = [], lines = []
  const N = (m, x, y, label, isAnchor = false) =>
    nodes.push({ ...m, _x: x, _y: y, label, isAnchor,
      pctX: (x / EFW) * 100, pctY: (y / EFH) * 100 })
  const L = (x1, y1, x2, y2, key) => lines.push({ x1, y1, x2, y2, key })

  // ── 좌표 계산 ──────────────────────────────────────────
  const selfX = spouses.length > 0 ? ECX - 45 : ECX
  const spouseX = ECX + 45
  const midX = spouses.length > 0 ? (selfX + spouseX) / 2 : selfX

  // 본인 · 배우자 · 형제자매 · 사촌 (같은 행)
  N(selfData, selfX, EROW.sel, '본인', true)
  spouses.forEach((s, i) => N(s, spouseX + i * 70, EROW.sel, '배우자'))
  siblings.forEach((s, i) => N(s, selfX - (siblings.length - i) * 72, EROW.sel, '형제자매'))
  cousins.forEach((c, i) => N(c, selfX - (siblings.length + cousins.length - i) * 72 - 30, EROW.sel, '사촌'))

  // 부모 · 고모/삼촌 · 이모/외삼촌 (같은 행) — 부모는 본인(selfX) 위에 중앙 정렬
  const parCenter = selfX
  const parentXs = parents.length === 0 ? [] :
    parents.length === 1 ? [parCenter] :
    parents.map((_, i) => parCenter - (parents.length - 1) * 50 + i * 100)
  parents.forEach((p, i) => N(p, parentXs[i], EROW.par, EF_REL[p.relation_type] ?? '부모'))
  const leftPX  = parentXs.length > 0 ? Math.min(...parentXs) : parCenter
  const rightPX = parentXs.length > 0 ? Math.max(...parentXs) : parCenter
  patLat.forEach((a, i) => N(a, leftPX  - (patLat.length - i) * 72, EROW.par, EF_REL[a.inferredRel] ?? a.inferredRel))
  matLat.forEach((a, i) => N(a, rightPX + (i + 1) * 72,              EROW.par, EF_REL[a.inferredRel] ?? a.inferredRel))

  // 조부모
  const gpBaseX = parentXs.length > 0 ? (leftPX + rightPX) / 2 : parCenter
  const gpXs = gParents.length === 0 ? [] :
    gParents.map((_, i) =>
      gParents.length === 1 ? gpBaseX :
      gpBaseX - (gParents.length - 1) * 60 + i * 120)
  gParents.forEach((gp, i) => N(gp, gpXs[i], EROW.gp, '조부모'))

  // 증조부모
  const gpCenter = gpXs.length > 0 ? gpXs.reduce((a, b) => a + b, 0) / gpXs.length : gpBaseX
  const ggpXs = ggParents.map((_, i) =>
    ggParents.length === 1 ? gpCenter :
    gpCenter - (ggParents.length - 1) * 55 + i * 110)
  ggParents.forEach((ggp, i) => N(ggp, ggpXs[i], EROW.ggp, '증조부모'))

  // 자녀 · 조카
  const childXs = children.map((_, i) =>
    children.length === 1 ? midX : midX - (children.length - 1) * 65 + i * 130)
  children.forEach((c, i) => N(c, childXs[i], EROW.ch, '자녀'))
  const rightCX = childXs.length > 0 ? Math.max(...childXs) : midX
  nephews.forEach((n, i) => N(n, rightCX + (i + 1) * 65, EROW.ch, '조카'))

  // 손자녀 · 증손자녀
  const gcXs = gChildren.map((_, i) =>
    gChildren.length === 1 ? midX : midX - (gChildren.length - 1) * 55 + i * 110)
  gChildren.forEach((gc, i) => N(gc, gcXs[i], EROW.gch, '손자녀'))
  const rightGCX = gcXs.length > 0 ? Math.max(...gcXs) : midX
  ggChildren.forEach((ggc, i) => N(ggc, rightGCX + (i + 1) * 55, EROW.gch, '증손자녀'))

  // ── SVG 연결선 ──────────────────────────────────────────
  if (spouses.length > 0) L(selfX, EROW.sel, spouseX, EROW.sel, 'sp')

  // 부모 → 본인 Y 분기
  if (parents.length > 0) {
    const jY = (EROW.par + EROW.sel) / 2
    L(selfX, EROW.sel, selfX, jY, 'su')
    if (parentXs.length > 1) L(parentXs[0], jY, parentXs[parentXs.length - 1], jY, 'pbar')
    parentXs.forEach((px, i) => L(px, EROW.par, px, jY, `pd${i}`))
  }

  // 조부모 → 부모(+방계) Y 분기
  if (gParents.length > 0) {
    const jY = (EROW.gp + EROW.par) / 2
    // 조부모들 아래로
    if (gpXs.length > 1) L(gpXs[0], jY, gpXs[gpXs.length - 1], jY, 'gpbar')
    gpXs.forEach((gx, i) => L(gx, EROW.gp, gx, jY, `gpd${i}`))
    // 부모 + 방계 모두 위로 연결 (같은 줄에 있음을 시각적으로 표현)
    const allParXs = [...patLat.map((_, i) => leftPX - (patLat.length - i) * 72),
                      ...parentXs,
                      ...matLat.map((_, i) => rightPX + (i + 1) * 72)]
    if (allParXs.length > 0) {
      L(Math.min(...allParXs), jY, Math.max(...allParXs), jY, 'parlat_bar')
      allParXs.forEach((px, i) => L(px, EROW.par, px, jY, `plup${i}`))
    }
  }

  // 증조부모 → 조부모 Y 분기
  if (ggParents.length > 0 && gParents.length > 0) {
    const jY = (EROW.ggp + EROW.gp) / 2
    if (ggpXs.length > 1) L(ggpXs[0], jY, ggpXs[ggpXs.length - 1], jY, 'ggpbar')
    ggpXs.forEach((gx, i) => L(gx, EROW.ggp, gx, jY, `ggpd${i}`))
    L(gpCenter, EROW.gp, gpCenter, jY, 'gpsu')
  }

  // 본인 → 자녀 Y 분기
  if (children.length > 0) {
    const jY = (EROW.sel + EROW.ch) / 2
    L(midX, EROW.sel, midX, jY, 'cu')
    if (childXs.length > 1) L(childXs[0], jY, childXs[childXs.length - 1], jY, 'cbar')
    childXs.forEach((cx, i) => L(cx, jY, cx, EROW.ch, `cd${i}`))
  }

  // 자녀 → 손자녀 Y 분기
  if (gChildren.length > 0 && children.length > 0) {
    const jY = (EROW.ch + EROW.gch) / 2
    L(midX, EROW.ch, midX, jY, 'gcu')
    if (gcXs.length > 1) L(gcXs[0], jY, gcXs[gcXs.length - 1], jY, 'gcbar')
    gcXs.forEach((gx, i) => L(gx, jY, gx, EROW.gch, `gcd${i}`))
  }

  if (nodes.length <= 1) return <div className={styles.cvLoading}>등록된 가족이 없습니다.</div>

  // 실제 사용된 Y 범위로 viewBox 동적 계산 (빈 행 공간 제거)
  const EF_PAD = 40
  const efUsedYs = nodes.map(n => n._y)
  const efMinY = Math.min(...efUsedYs) - EF_PAD
  const efMaxY = Math.max(...efUsedYs) + EF_PAD
  const efViewH = efMaxY - efMinY
  nodes.forEach(n => { n.pctY = ((n._y - efMinY) / efViewH) * 100 })

  return (
    <div className={styles.ftPanel}>
      <div className={styles.ftStage}>
        <svg className={styles.ftSvg} viewBox={`0 ${efMinY} ${EFW} ${efViewH}`} preserveAspectRatio="none">
          {lines.map(l => (
            <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} {...ELINE_PROPS} />
          ))}
        </svg>
        {nodes.map(node => (
          <EFNode
            key={`ef-${node.id}-${node._x}`}
            member={node}
            isAnchor={node.isAnchor}
            label={node.label}
            size={54}
            smallSize={38}
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
