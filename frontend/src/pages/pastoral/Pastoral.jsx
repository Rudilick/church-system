import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { pastoral as api, prayer as prayerApi, members as memberApi } from '../../api'
import { useMemberAll } from '../../hooks/useMemberAll'
import { useAutocompleteKeyNav } from '../../hooks/useAutocompleteKeyNav'
import { genderColor } from '../../utils'
import { HYMNALS } from '../../data/hymnals'
import { BIBLE_BOOKS } from '../../data/bibleBooks'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import styles from './Pastoral.module.css'

// 찬송가 장번호로 제목 조회
const hymnByNumber = num => HYMNALS.find(h => h.number === Number(num))
// 찬송가 제목 검색 (자동완성용)
const searchHymnals = q => {
  if (!q.trim()) return []
  const lower = q.toLowerCase()
  return HYMNALS.filter(h => h.title.includes(q) || String(h.number).startsWith(q)).slice(0, 10)
}
// 찬송가 hymn 문자열 파싱: "새찬송가 204장 주 예수보다…" → { number: '204', title: '주 예수보다…' }
const parseHymn = (str) => {
  if (!str) return { number: '', title: '' }
  const m = str.match(/(\d+)장\s*(.*)/)
  if (m) return { number: m[1], title: m[2].trim() }
  return { number: '', title: str }
}
// 성경 책명 검색
const searchBibleBooks = q => {
  if (!q.trim()) return []
  return BIBLE_BOOKS.filter(b => b.includes(q)).slice(0, 10)
}

const VISIT_TYPES = ['가정', '병원', '교회', '기타']

const today = dayjs()
const EMPTY_VFORM = {
  visit_date: today.format('YYYY-MM-DD'),
  visit_type: '가정',
  location: '',
  content: '',
  hymn: '',           // DB 저장용 (결합된 문자열)
  hymn_number: '',    // UI용
  hymn_title: '',     // UI용
  bible_book: '',     // UI용
  bible_ref: '',      // UI용 (장:절)
  bible_verse: '',    // DB 저장용 (결합된 문자열)
  companions: [],
  next_plan: '',
  next_plan_is_event: false,
  next_plan_event_date: '',
}

const EMPTY_PFORM = { is_event: false, event_date: '', event_title: '' }

// 교인 검색 드롭다운 (키보드 네비 포함 공용 컴포넌트)
function MemberSearchInput({ value, onChange, suggestions, onSelect, onClose, placeholder, disabled }) {
  const { activeIndex, handleKeyDown, resetIndex } = useAutocompleteKeyNav(suggestions, onSelect, onClose)

  useEffect(() => { resetIndex() }, [suggestions, resetIndex])

  return (
    <div style={{ position: 'relative' }}>
      <input
        className={styles.formInput}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? '이름으로 검색...'}
        disabled={disabled}
        autoComplete="off"
      />
      {suggestions.length > 0 && (
        <ul className={styles.suggestions}>
          {suggestions.map((m, i) => (
            <li
              key={m.id}
              className={i === activeIndex ? styles.suggActive : ''}
              onMouseDown={() => onSelect(m)}
            >
              {m.photo_url
                ? <img src={m.photo_url} alt={m.name} className={styles.suggAvatar} />
                : <div className={styles.suggAvatar} style={{ background: genderColor(m.gender) }}>
                    {m.name[0]}
                  </div>
              }
              <div className={styles.suggInfo}>
                <span className={styles.suggestName}>{m.name}</span>
                {m.position && <span className={styles.suggPos}>{m.position}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// 선택된 교인 타일
function MemberTile({ member, onRemove, small }) {
  if (!member) return null
  return (
    <div className={small ? styles.memberTileSmall : styles.memberTile}>
      {member.photo_url
        ? <img src={member.photo_url} alt={member.name} className={styles.memberTileAvatar} />
        : <div className={styles.memberTileAvatar} style={{ background: genderColor(member.gender) }}>
            {member.name[0]}
          </div>
      }
      <div className={styles.memberTileInfo}>
        <span className={styles.memberTileName}>{member.name}</span>
        {member.position && <span className={styles.memberTilePos}>{member.position}</span>}
      </div>
      {onRemove && (
        <button className={styles.memberTileRemove} onClick={onRemove} type="button">✕</button>
      )}
    </div>
  )
}

export default function Pastoral() {
  const [searchParams] = useSearchParams()
  const initMemberId = searchParams.get('member_id')

  const [tab, setTab] = useState('visits')

  // ── 심방기록 ─────────────────────────────────────────────────
  const [visits, setVisits] = useState([])
  const [vFrom, setVFrom] = useState(today.startOf('month').format('YYYY-MM-DD'))
  const [vTo, setVTo]     = useState(today.endOf('month').format('YYYY-MM-DD'))

  // 개인별 기록 필터
  const [personalMember, setPersonalMember] = useState(null)
  const [personalQ, setPersonalQ]       = useState('')
  const [personalSugg, setPersonalSugg] = useState([])
  const [showPersonalSearch, setShowPersonalSearch] = useState(false)

  // initMemberId가 있을 때 멤버 데이터 로드 (이름 없이 초기화하면 크래시 발생)
  useEffect(() => {
    if (!initMemberId) return
    memberApi.get(initMemberId)
      .then(r => {
        setPersonalMember(r.data)
        setPersonalQ(r.data.name)
        setShowPersonalSearch(false)
      })
      .catch(() => {})
  }, [initMemberId])

  // ── 기도제목 ─────────────────────────────────────────────────
  const [prayers, setPrayers] = useState([])
  const [pStatus, setPStatus] = useState('')

  // ── 미심방현황 ────────────────────────────────────────────────
  const [unvisited, setUnvisited] = useState([])
  const [months, setMonths]       = useState(3)
  const [uvLoading, setUvLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(new Set())

  // ── 심방 모달 ─────────────────────────────────────────────────
  const [visitModal, setVisitModal]     = useState(false)
  const [editingVisit, setEditingVisit] = useState(null)
  const [vForm, setVForm]               = useState(EMPTY_VFORM)
  const [vMemberQ, setVMemberQ]         = useState('')
  const [vMemberSugg, setVMemberSugg]   = useState([])
  const [vSelMember, setVSelMember]     = useState(null)

  // 동행자 검색
  const [companionQ, setCompanionQ]       = useState('')
  const [companionSugg, setCompanionSugg] = useState([])

  // 찬송가 자동완성
  const [hymnTitleSugg, setHymnTitleSugg] = useState([])
  // 성경 책명 자동완성
  const [bibleBookSugg, setBibleBookSugg] = useState([])

  // ── 기도제목 모달 ─────────────────────────────────────────────
  const [pModal, setPModal]           = useState(false)
  const [pContent, setPContent]       = useState('')
  const [pMemberQ, setPMemberQ]       = useState('')
  const [pMemberSugg, setPMemberSugg] = useState([])
  const [pSelMember, setPSelMember]   = useState(null)
  const [pEventForm, setPEventForm]   = useState(EMPTY_PFORM)

  // ── 응답 모달 ───────────────────────────────────────��─────────
  const [answerModal, setAnswerModal] = useState(null)
  const [answerNote, setAnswerNote]   = useState('')

  const { search: filterMembers } = useMemberAll()

  // ── 데이터 로드 ──────────────────────────────��────────────────
  const loadVisits = useCallback(() => {
    const params = {}
    if (vFrom) params.from = vFrom
    if (vTo)   params.to   = vTo
    const mid = personalMember?.id ?? (initMemberId ? Number(initMemberId) : null)
    if (mid) params.member_id = mid
    api.list(params).then(r => setVisits(r.data)).catch(() => {})
  }, [vFrom, vTo, personalMember, initMemberId])

  const loadPrayers = useCallback(() => {
    const params = {}
    if (pStatus) params.status = pStatus
    prayerApi.list(params).then(r => setPrayers(r.data)).catch(() => {})
  }, [pStatus])

  const loadUnvisited = useCallback(() => {
    setUvLoading(true)
    api.unvisited({ months })
      .then(r => setUnvisited(r.data))
      .catch(() => {})
      .finally(() => setUvLoading(false))
  }, [months])

  useEffect(() => { loadVisits() }, [loadVisits])
  useEffect(() => { loadPrayers() }, [loadPrayers])
  useEffect(() => { if (tab === 'unvisited') loadUnvisited() }, [tab, loadUnvisited])

  // 개인별 기록 선택 시 재로드
  useEffect(() => { if (tab === 'visits') loadVisits() }, [personalMember])

  // ── 심방 모달 열기 ─────────────────────────��──────────────────
  const openNewVisit = (member = null) => {
    setEditingVisit(null)
    setVForm(EMPTY_VFORM)
    setVSelMember(member)
    setVMemberQ(member ? member.name : '')
    setVMemberSugg([])
    setCompanionQ('')
    setCompanionSugg([])
    setVisitModal(true)
  }

  const openEditVisit = (v) => {
    setEditingVisit(v)
    const { number: hn, title: ht } = parseHymn(v.hymn ?? '')
    const bvParts = (v.bible_verse ?? '').split(' ')
    const bb = bvParts.length > 1 ? bvParts[0] : ''
    const br = bvParts.length > 1 ? bvParts.slice(1).join(' ') : v.bible_verse ?? ''
    setVForm({
      visit_date: v.visit_date?.slice(0, 10) ?? today.format('YYYY-MM-DD'),
      visit_type: v.visit_type ?? '가정',
      location:   v.location   ?? '',
      content:    v.content    ?? '',
      hymn:       v.hymn       ?? '',
      hymn_number: hn,
      hymn_title:  ht,
      bible_verse: v.bible_verse ?? '',
      bible_book:  bb,
      bible_ref:   br,
      companions: Array.isArray(v.companions) ? v.companions : [],
      next_plan:  v.next_plan  ?? '',
      next_plan_is_event:    !!v.next_plan_event_id,
      next_plan_event_date:  v.next_plan_event_date ?? '',
    })
    setVSelMember({ id: v.member_id, name: v.member_name, photo_url: v.photo_url,
                    position: v.member_position, gender: v.member_gender })
    setVMemberQ(v.member_name ?? '')
    setVMemberSugg([])
    setCompanionQ('')
    setCompanionSugg([])
    setVisitModal(true)
  }

  const handleVisitSubmit = async () => {
    if (!vSelMember)           { toast.error('교인을 선택해주세요.'); return }
    if (!vForm.visit_date)     { toast.error('날짜를 입력하세요.');   return }
    if (!vForm.content.trim()) { toast.error('내용을 입력하세요.');   return }
    try {
      const hymnStr = vForm.hymn_number
        ? `새찬송가 ${vForm.hymn_number}장${vForm.hymn_title ? ' ' + vForm.hymn_title : ''}`
        : vForm.hymn_title || ''
      const bvStr = vForm.bible_book
        ? `${vForm.bible_book}${vForm.bible_ref ? ' ' + vForm.bible_ref : ''}`
        : vForm.bible_ref || ''
      const payload = {
        ...vForm,
        member_id: vSelMember.id,
        hymn: hymnStr,
        bible_verse: bvStr,
      }
      if (editingVisit) {
        await api.update(editingVisit.id, payload)
        toast.success('수정했습니다.')
      } else {
        await api.add(payload)
        toast.success('심방 기록을 저장했습니다.')
      }
      setVisitModal(false)
      loadVisits()
    } catch { toast.error('저장하지 못했습니다.') }
  }

  const handleVisitDelete = async (id) => {
    if (!confirm('이 심방 기록을 삭제하시겠습니까?')) return
    await api.remove(id).catch(() => toast.error('삭제 실패'))
    toast.success('삭제했습니다.')
    loadVisits()
  }

  // ── 기도제목 ───────────────��────────────────────────────��────
  const openNewPrayer = () => {
    setPContent(''); setPSelMember(null); setPMemberQ(''); setPMemberSugg([])
    setPEventForm(EMPTY_PFORM); setPModal(true)
  }

  const handlePrayerSubmit = async () => {
    if (!pSelMember)        { toast.error('교인을 선택해주세요.');  return }
    if (!pContent.trim())   { toast.error('기도제목을 입력하세요.'); return }
    try {
      await prayerApi.add({
        member_id: pSelMember.id, content: pContent,
        is_event:    pEventForm.is_event,
        event_date:  pEventForm.event_date,
        event_title: pEventForm.event_title,
      })
      toast.success('기도제목을 등록했습니다.')
      setPModal(false)
      loadPrayers()
    } catch { toast.error('저장하지 못했습니다.') }
  }

  const handlePrayerDelete = async (id) => {
    if (!confirm('이 기도제목을 삭제하시겠습니까?')) return
    await prayerApi.remove(id).catch(() => toast.error('삭제 실패'))
    toast.success('삭제했습니다.')
    loadPrayers()
  }

  const handleAnswer = async () => {
    if (!answerModal) return
    try {
      await prayerApi.update(answerModal.id, { status: 'answered', answer_note: answerNote })
      toast.success('응답 처리했습니다.')
      setAnswerModal(null); setAnswerNote(''); loadPrayers()
    } catch { toast.error('처리 실패') }
  }

  // ── 동행자 추가 ───────────────────────────────────────────────
  const addCompanion = (m) => {
    if (vForm.companions.some(c => c.id === m.id)) return
    setVForm(f => ({ ...f, companions: [...f.companions, { id: m.id, name: m.name,
      photo_url: m.photo_url, position: m.position, gender: m.gender }] }))
    setCompanionQ(''); setCompanionSugg([])
  }
  const removeCompanion = (id) => {
    setVForm(f => ({ ...f, companions: f.companions.filter(c => c.id !== id) }))
  }

  // ── 미심방 그룹 ─────────────────────────────���─────────────────
  const uvGroups = unvisited.reduce((acc, m) => {
    const key = m.community_name ?? '미배정'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const toggleCollapse = (name) => setCollapsed(prev => {
    const next = new Set(prev)
    next.has(name) ? next.delete(name) : next.add(name)
    return next
  })

  // ── 월별 그룹 ──────────────────────────��──────────────────────
  const visitsByMonth = visits.reduce((acc, v) => {
    const month = v.visit_date?.slice(0, 7) ?? '알 수 없음'
    if (!acc[month]) acc[month] = []
    acc[month].push(v)
    return acc
  }, {})
  const monthKeys = Object.keys(visitsByMonth).sort((a, b) => b.localeCompare(a))

  return (
    <div className={styles.pageWrap}>

      {/* ── 좌측 사이드바 ── */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarLabel}>심방 관리</div>
        {[
          { key: 'visits',    label: '심방 기록' },
          { key: 'prayer',    label: '기도제목' },
          { key: 'unvisited', label: '미심방 현황' },
        ].map(t => (
          <button key={t.key}
            className={`${styles.sideTab} ${tab === t.key ? styles.sideTabActive : ''}`}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 우측 콘텐츠 ── */}
      <div className={styles.content}>

        {/* ── 심방기록 탭 ── */}
        {tab === 'visits' && (
          <>
            <div className={styles.contentHeader}>
              <h2 className={styles.contentTitle}>심방 기록</h2>
              <div className={styles.filterBar}>
                <input type="date" value={vFrom}
                  onChange={e => setVFrom(e.target.value)}
                  className={styles.filterInput} />
                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>~</span>
                <input type="date" value={vTo}
                  onChange={e => setVTo(e.target.value)}
                  className={styles.filterInput} />
                {/* 개인별 기록 버튼 */}
                <div style={{ position: 'relative' }}>
                  <button
                    className={`${styles.personalBtn} ${personalMember ? styles.personalBtnActive : ''}`}
                    onClick={() => setShowPersonalSearch(s => !s)}
                  >
                    👤 {personalMember ? personalMember.name : '개인별 기록'}
                    {personalMember && (
                      <span className={styles.personalClear}
                        onMouseDown={e => { e.stopPropagation(); setPersonalMember(null); setPersonalQ(''); setShowPersonalSearch(false) }}>
                        ✕
                      </span>
                    )}
                  </button>
                  {showPersonalSearch && !personalMember && (
                    <div className={styles.personalSearchBox}>
                      <MemberSearchInput
                        value={personalQ}
                        onChange={e => { setPersonalQ(e.target.value); setPersonalSugg(filterMembers(e.target.value)) }}
                        suggestions={personalSugg}
                        onSelect={m => { setPersonalMember(m); setPersonalQ(m.name); setPersonalSugg([]); setShowPersonalSearch(false) }}
                        onClose={() => setShowPersonalSearch(false)}
                        placeholder="교인 이름 검색..."
                      />
                    </div>
                  )}
                </div>
              </div>
              <button className={styles.addBtn} onClick={() => openNewVisit()}>+ 등록</button>
            </div>

            {personalMember && (
              <div className={styles.personalFilterBanner}>
                <MemberTile member={personalMember} small />
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>의 심방 기록만 표시 중</span>
                <button className={styles.clearPersonal}
                  onClick={() => { setPersonalMember(null); setPersonalQ('') }}>
                  전체 보기
                </button>
              </div>
            )}

            {monthKeys.length === 0 && <div className={styles.empty}>심방 기록이 없습니다.</div>}

            {monthKeys.map(month => (
              <div key={month} className={styles.monthGroup}>
                <div className={styles.monthLabel}>{month.replace('-', '년 ')}월</div>
                <div className={styles.visitList}>
                  {visitsByMonth[month].map(v => (
                    <div key={v.id} className={styles.visitCard}>
                      {/* 왼쪽: 얼굴 + 이름 */}
                      <div className={styles.visitCardAvatar}>
                        {v.photo_url
                          ? <img src={v.photo_url} alt={v.member_name} className={styles.visitAvatarLg} />
                          : <div className={styles.visitAvatarLg}
                              style={{ background: genderColor(v.member_gender), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
                              {(v.member_name ?? '?')[0]}
                            </div>
                        }
                        <div className={styles.visitAvatarName}>{v.member_name ?? '교인 미지정'}</div>
                      </div>
                      {/* 중앙: 상세 정보 */}
                      <div className={styles.visitCardBody}>
                        <div className={styles.visitMetaRow}>
                          <span className={styles.visitDate}>{dayjs(v.visit_date).format('YYYY.MM.DD')}</span>
                          {v.visit_type && <span className={styles.visitTypeBadge}>{v.visit_type}</span>}
                          {v.location && <span className={styles.visitLocation}>📍 {v.location}</span>}
                        </div>
                        {(v.hymn || v.bible_verse || (Array.isArray(v.companions) && v.companions.length > 0)) && (
                          <div className={styles.visitDetailRow}>
                            {v.hymn && <span>🎵 {v.hymn}</span>}
                            {v.bible_verse && <span>📖 {v.bible_verse}</span>}
                            {Array.isArray(v.companions) && v.companions.length > 0 && (
                              <span>👥 {v.companions.map(c => c.name).join(', ')}</span>
                            )}
                          </div>
                        )}
                        <div className={styles.visitContent}>{v.content}</div>
                        {v.next_plan && (
                          <div className={styles.visitNextPlan}>
                            {v.next_plan_event_date
                              ? `📌 ${dayjs(v.next_plan_event_date).format('MM/DD')} ${v.next_plan}`
                              : `→ ${v.next_plan}`}
                          </div>
                        )}
                      </div>
                      {/* 오른쪽: 작성자 + 버튼 */}
                      <div className={styles.visitCardRight}>
                        <span className={styles.visitPastor}>{v.created_by_name ?? v.pastor_name}</span>
                        <div className={styles.visitActions}>
                          <button onClick={() => openEditVisit(v)}>수정</button>
                          <button onClick={() => handleVisitDelete(v.id)}>삭제</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── 기도제목 탭 ── */}
        {tab === 'prayer' && (
          <>
            <div className={styles.contentHeader}>
              <h2 className={styles.contentTitle}>기도제목</h2>
              <div className={styles.filterBar}>
                {[['', '전체'], ['active', '진행중'], ['answered', '응답됨']].map(([v, label]) => (
                  <button key={v}
                    className={`${styles.statusFilter} ${pStatus === v ? styles.statusFilterActive : ''}`}
                    onClick={() => setPStatus(v)}>
                    {label}
                  </button>
                ))}
              </div>
              <button className={styles.addBtn} onClick={openNewPrayer}>+ 등록</button>
            </div>

            {prayers.length === 0 && <div className={styles.empty}>기도제목이 없습니다.</div>}

            <div className={styles.prayerList}>
              {prayers.map(p => (
                <div key={p.id} className={styles.prayerCard}>
                  <div className={styles.prayerCardLeft}>
                    {p.photo_url
                      ? <img src={p.photo_url} alt={p.member_name} className={styles.visitAvatar} />
                      : <div className={styles.visitAvatarFallback} style={{ background: '#6366f1' }}>
                          {(p.member_name ?? '?')[0]}
                        </div>
                    }
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className={styles.visitName}>{p.member_name}</div>
                      <div className={styles.prayerContent}>{p.content}</div>
                      {p.answer_note && (
                        <div className={styles.answerNote}>응답: {p.answer_note}</div>
                      )}
                      <div className={styles.prayerMeta}>
                        {dayjs(p.created_at).format('YYYY.MM.DD')}
                        {p.created_by_name && <span className={styles.authorTag}> • {p.created_by_name}</span>}
                        {p.answered_at && ` → 응답 ${dayjs(p.answered_at).format('YYYY.MM.DD')}`}
                      </div>
                    </div>
                  </div>
                  <div className={styles.prayerCardRight}>
                    <span className={p.status === 'answered' ? styles.badgeAnswered : styles.badgeActive}>
                      {p.status === 'answered' ? '응답됨' : '진행중'}
                    </span>
                    <div className={styles.visitActions}>
                      {p.status === 'active' && (
                        <button onClick={() => { setAnswerModal({ id: p.id }); setAnswerNote('') }}>응답</button>
                      )}
                      <button onClick={() => handlePrayerDelete(p.id)}>삭제</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── 미심방현황 탭 ── */}
        {tab === 'unvisited' && (
          <>
            <div className={styles.contentHeader}>
              <h2 className={styles.contentTitle}>미심방 현황</h2>
              <div className={styles.filterBar}>
                {[3, 6, 9, 12].map(m => (
                  <button key={m}
                    className={`${styles.monthsBtn} ${months === m ? styles.monthsBtnActive : ''}`}
                    onClick={() => { setMonths(m); setTimeout(loadUnvisited, 0) }}>
                    {m}개월
                  </button>
                ))}
              </div>
            </div>

            {uvLoading && <div className={styles.empty}>불러오는 중...</div>}

            {!uvLoading && Object.keys(uvGroups).length === 0 && (
              <div className={styles.empty}>미심방 교인이 없습니다.</div>
            )}

            {!uvLoading && Object.keys(uvGroups).sort().map(communityName => (
              <div key={communityName} className={styles.uvGroup}>
                <button className={styles.uvGroupHeader} onClick={() => toggleCollapse(communityName)}>
                  <span>{communityName}</span>
                  <span className={styles.uvCount}>{uvGroups[communityName].length}명</span>
                  <span className={styles.uvChevron}>{collapsed.has(communityName) ? '▶' : '▼'}</span>
                </button>
                {!collapsed.has(communityName) && (
                  <div className={styles.uvTileGrid}>
                    {uvGroups[communityName].map(m => (
                      <button key={m.id} className={styles.uvTile}
                        onClick={() => openNewVisit({ id: m.id, name: m.name,
                          photo_url: m.photo_url, gender: m.gender, position: m.position })}>
                        {m.photo_url
                          ? <img src={m.photo_url} alt={m.name} className={styles.uvTilePhoto} />
                          : <div className={styles.uvTilePlaceholder} style={{ background: genderColor(m.gender) }}>
                              {m.name[0]}
                            </div>
                        }
                        <div className={styles.uvTileName}>{m.name}</div>
                        <div className={styles.uvTileDate}>
                          {m.last_visit_date ? dayjs(m.last_visit_date).format('YY.MM.DD') : '미심방'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── 심방 등록/수정 모달 ── */}
      {visitModal && (
        <div className={styles.modalOverlay} onClick={() => setVisitModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>{editingVisit ? '심방 기록 수정' : '심방 등록'}</div>
            <div className={styles.modalBody}>

              {/* 교인 선택 */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>교인 *</label>
                {vSelMember
                  ? <MemberTile member={vSelMember} onRemove={() => { setVSelMember(null); setVMemberQ('') }} />
                  : <MemberSearchInput
                      value={vMemberQ}
                      onChange={e => { setVMemberQ(e.target.value); setVMemberSugg(filterMembers(e.target.value)) }}
                      suggestions={vMemberSugg}
                      onSelect={m => { setVSelMember(m); setVMemberQ(m.name); setVMemberSugg([]) }}
                      onClose={() => setVMemberSugg([])}
                    />
                }
              </div>

              {/* 날짜 + 구분 */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>날짜 *</label>
                  <input type="date" className={styles.formInput}
                    value={vForm.visit_date}
                    onChange={e => setVForm(f => ({ ...f, visit_date: e.target.value }))} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>구분</label>
                  <select className={styles.formInput}
                    value={vForm.visit_type}
                    onChange={e => setVForm(f => ({ ...f, visit_type: e.target.value }))}>
                    {VISIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* 장소 */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>장소</label>
                <input className={styles.formInput}
                  value={vForm.location}
                  onChange={e => setVForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="선택사항" />
              </div>

              {/* 찬송가 */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>찬송가</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {/* 장 번호 */}
                  <input
                    className={styles.formInput}
                    style={{ width: 72, flexShrink: 0 }}
                    placeholder="장"
                    value={vForm.hymn_number}
                    disabled={!!vForm.hymn_title && !vForm.hymn_number}
                    onChange={e => {
                      const num = e.target.value.replace(/\D/g, '')
                      const found = hymnByNumber(num)
                      setVForm(f => ({ ...f, hymn_number: num, hymn_title: found ? found.title : f.hymn_title }))
                      setHymnTitleSugg([])
                    }}
                    onBlur={() => {
                      if (vForm.hymn_number && !hymnByNumber(vForm.hymn_number)) {
                        setVForm(f => ({ ...f, hymn_title: '' }))
                      }
                    }}
                  />
                  {/* 제목 자동완성 */}
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      className={styles.formInput}
                      placeholder="제목 검색..."
                      value={vForm.hymn_title}
                      disabled={!!vForm.hymn_number && !!hymnByNumber(vForm.hymn_number)}
                      onChange={e => {
                        const v = e.target.value
                        setVForm(f => ({ ...f, hymn_title: v, hymn_number: '' }))
                        setHymnTitleSugg(searchHymnals(v))
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Escape') setHymnTitleSugg([])
                      }}
                    />
                    {hymnTitleSugg.length > 0 && (
                      <ul className={styles.suggestions}>
                        {hymnTitleSugg.map((h, i) => (
                          <li key={h.number}
                            onMouseDown={() => {
                              setVForm(f => ({ ...f, hymn_number: String(h.number), hymn_title: h.title }))
                              setHymnTitleSugg([])
                            }}
                          >
                            <span style={{ color: '#94a3b8', marginRight: 8, fontSize: '0.8rem' }}>{h.number}장</span>
                            {h.title}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {/* 초기화 */}
                  {(vForm.hymn_number || vForm.hymn_title) && (
                    <button type="button" onClick={() => setVForm(f => ({ ...f, hymn_number: '', hymn_title: '' }))}
                      style={{ padding: '0 8px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#94a3b8', flexShrink: 0 }}>✕</button>
                  )}
                </div>
              </div>

              {/* 성경본문 */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>성경본문</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {/* 책명 자동완성 */}
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      className={styles.formInput}
                      placeholder="책명"
                      value={vForm.bible_book}
                      onChange={e => {
                        const v = e.target.value
                        setVForm(f => ({ ...f, bible_book: v }))
                        setBibleBookSugg(searchBibleBooks(v))
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Escape') setBibleBookSugg([])
                      }}
                    />
                    {bibleBookSugg.length > 0 && (
                      <ul className={styles.suggestions}>
                        {bibleBookSugg.map(b => (
                          <li key={b} onMouseDown={() => { setVForm(f => ({ ...f, bible_book: b })); setBibleBookSugg([]) }}>
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {/* 장:절 */}
                  <input
                    className={styles.formInput}
                    style={{ width: 90, flexShrink: 0 }}
                    placeholder="장:절"
                    value={vForm.bible_ref}
                    onChange={e => setVForm(f => ({ ...f, bible_ref: e.target.value }))}
                  />
                  {/* 초기화 */}
                  {(vForm.bible_book || vForm.bible_ref) && (
                    <button type="button" onClick={() => setVForm(f => ({ ...f, bible_book: '', bible_ref: '' }))}
                      style={{ padding: '0 8px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#94a3b8', flexShrink: 0 }}>✕</button>
                  )}
                </div>
              </div>

              {/* 동행자 */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>동행자</label>
                <MemberSearchInput
                  value={companionQ}
                  onChange={e => { setCompanionQ(e.target.value); setCompanionSugg(filterMembers(e.target.value)) }}
                  suggestions={companionSugg}
                  onSelect={addCompanion}
                  onClose={() => setCompanionSugg([])}
                  placeholder="동행자 검색 (중복 선택 가능)..."
                />
                {vForm.companions.length > 0 && (
                  <div className={styles.companionList}>
                    {vForm.companions.map(c => (
                      <MemberTile key={c.id} member={c} small
                        onRemove={() => removeCompanion(c.id)} />
                    ))}
                  </div>
                )}
              </div>

              {/* 내용 */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>내용 *</label>
                <textarea className={styles.formTextarea} rows={4}
                  value={vForm.content}
                  onChange={e => setVForm(f => ({ ...f, content: e.target.value }))} />
              </div>

              {/* 후속계획 */}
              <div className={styles.formGroup}>
                <div className={styles.nextPlanLabelRow}>
                  <label className={styles.formLabel} style={{ margin: 0 }}>후속 계획</label>
                  <label className={styles.nextPlanEventCheck}>
                    <input type="checkbox"
                      checked={vForm.next_plan_is_event}
                      onChange={e => setVForm(f => ({ ...f, next_plan_is_event: e.target.checked }))} />
                    📅 캘린더 일정으로 등록
                  </label>
                </div>
                <input className={styles.formInput}
                  value={vForm.next_plan}
                  onChange={e => setVForm(f => ({ ...f, next_plan: e.target.value }))}
                  placeholder="선택사항" />
                {vForm.next_plan_is_event && (
                  <input type="date" className={styles.nextPlanDateIcon}
                    value={vForm.next_plan_event_date}
                    onChange={e => setVForm(f => ({ ...f, next_plan_event_date: e.target.value }))} />
                )}
              </div>
            </div>
            <div className={styles.modalFoot}>
              <button className={styles.cancelBtn} onClick={() => setVisitModal(false)}>취소</button>
              <button className={styles.saveBtn} onClick={handleVisitSubmit}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 기도제목 등록 모달 ── */}
      {pModal && (
        <div className={styles.modalOverlay} onClick={() => setPModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>기도제목 등록</div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>교인 *</label>
                {pSelMember
                  ? <MemberTile member={pSelMember} onRemove={() => { setPSelMember(null); setPMemberQ('') }} />
                  : <MemberSearchInput
                      value={pMemberQ}
                      onChange={e => { setPMemberQ(e.target.value); setPMemberSugg(filterMembers(e.target.value)) }}
                      suggestions={pMemberSugg}
                      onSelect={m => { setPSelMember(m); setPMemberQ(m.name); setPMemberSugg([]) }}
                      onClose={() => setPMemberSugg([])}
                    />
                }
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>기도제목 *</label>
                <textarea className={styles.formTextarea} rows={4}
                  value={pContent}
                  onChange={e => setPContent(e.target.value)} />
              </div>
              {/* 캘린더 등록 */}
              <div className={styles.formGroup}>
                <label className={styles.nextPlanEventCheck}>
                  <input type="checkbox"
                    checked={pEventForm.is_event}
                    onChange={e => setPEventForm(f => ({ ...f, is_event: e.target.checked }))} />
                  📅 캘린더에 등록
                </label>
                {pEventForm.is_event && (
                  <div className={styles.nextPlanEventRow} style={{ marginTop: 8 }}>
                    <input type="date" className={styles.nextPlanDateIcon}
                      value={pEventForm.event_date}
                      onChange={e => setPEventForm(f => ({ ...f, event_date: e.target.value }))} />
                    <input className={styles.nextPlanTitleInput}
                      value={pEventForm.event_title}
                      onChange={e => setPEventForm(f => ({ ...f, event_title: e.target.value }))}
                      placeholder="캘린더 표시 제목 (선택)" />
                  </div>
                )}
              </div>
            </div>
            <div className={styles.modalFoot}>
              <button className={styles.cancelBtn} onClick={() => setPModal(false)}>취소</button>
              <button className={styles.saveBtn} onClick={handlePrayerSubmit}>등록</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 기도 응답 처리 모달 ── */}
      {answerModal && (
        <div className={styles.modalOverlay} onClick={() => setAnswerModal(null)}>
          <div className={styles.modal} style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>기도 응답 처리</div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>응답 내용 (선택)</label>
                <textarea className={styles.formTextarea} rows={3}
                  value={answerNote}
                  onChange={e => setAnswerNote(e.target.value)}
                  placeholder="응답 내용을 입력하세요..." />
              </div>
            </div>
            <div className={styles.modalFoot}>
              <button className={styles.cancelBtn} onClick={() => setAnswerModal(null)}>취소</button>
              <button className={styles.saveBtn} style={{ background: '#10b981' }} onClick={handleAnswer}>
                응답 처리
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
