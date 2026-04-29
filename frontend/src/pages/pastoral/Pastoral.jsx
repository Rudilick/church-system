import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { pastoral as api, prayer as prayerApi } from '../../api'
import { useMemberAll } from '../../hooks/useMemberAll'
import { genderColor } from '../../utils'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import styles from './Pastoral.module.css'

const VISIT_TYPES = ['가정', '병원', '교회', '기타']

const EMPTY_VFORM = {
  visit_date: dayjs().format('YYYY-MM-DD'),
  visit_type: '가정',
  location: '',
  content: '',
  next_plan: '',
  next_plan_is_event: false,
  next_plan_event_date: '',
  next_plan_event_title: '',
}

export default function Pastoral() {
  const [searchParams] = useSearchParams()
  const initMemberId = searchParams.get('member_id')

  const [tab, setTab] = useState('visits')

  // ── 심방기록 ────────────────────────────────────────────────
  const [visits, setVisits] = useState([])
  const [vFrom, setVFrom] = useState('')
  const [vTo, setVTo]     = useState('')

  // ── 기도제목 ────────────────────────────────────────────────
  const [prayers, setPrayers] = useState([])
  const [pStatus, setPStatus] = useState('')

  // ── 미심방현황 ───────────────────────────────────────────────
  const [unvisited, setUnvisited] = useState([])
  const [months, setMonths]       = useState(3)
  const [uvLoading, setUvLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(new Set())

  // ── 심방 모달 (등록/수정 공용) ───────────────────────────────
  const [visitModal, setVisitModal]     = useState(false)
  const [editingVisit, setEditingVisit] = useState(null)
  const [vForm, setVForm]               = useState(EMPTY_VFORM)
  const [vMemberQ, setVMemberQ]         = useState('')
  const [vMemberSugg, setVMemberSugg]   = useState([])
  const [vSelMember, setVSelMember]     = useState(null)

  // ── 기도제목 모달 ────────────────────────────────────────────
  const [pModal, setPModal]           = useState(false)
  const [pContent, setPContent]       = useState('')
  const [pMemberQ, setPMemberQ]       = useState('')
  const [pMemberSugg, setPMemberSugg] = useState([])
  const [pSelMember, setPSelMember]   = useState(null)

  // ── 응답 모달 ────────────────────────────────────────────────
  const [answerModal, setAnswerModal] = useState(null) // { id }
  const [answerNote, setAnswerNote]   = useState('')

  // ── 데이터 로드 ──────────────────────────────────────────────
  const loadVisits = useCallback(() => {
    const params = {}
    if (vFrom)        params.from = vFrom
    if (vTo)          params.to   = vTo
    if (initMemberId) params.member_id = initMemberId
    api.list(params).then(r => setVisits(r.data)).catch(() => {})
  }, [vFrom, vTo, initMemberId])

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

  // ── 교인 로컬 자동완성 ──────────────────────────────────────
  const { search: filterMembers } = useMemberAll()

  // ── 심방 모달 열기 ───────────────────────────────────────────
  const openNewVisit = (member = null) => {
    setEditingVisit(null)
    setVForm(EMPTY_VFORM)
    setVSelMember(member)
    setVMemberQ(member ? member.name : '')
    setVMemberSugg([])
    setVisitModal(true)
  }

  const openEditVisit = (v) => {
    setEditingVisit(v)
    setVForm({
      visit_date: v.visit_date?.slice(0, 10) ?? dayjs().format('YYYY-MM-DD'),
      visit_type: v.visit_type ?? '가정',
      location:   v.location   ?? '',
      content:    v.content    ?? '',
      next_plan:  v.next_plan  ?? '',
      next_plan_is_event: false,
      next_plan_event_date: '',
      next_plan_event_title: '',
    })
    setVSelMember({ id: v.member_id, name: v.member_name, photo_url: v.photo_url })
    setVMemberQ(v.member_name ?? '')
    setVMemberSugg([])
    setVisitModal(true)
  }

  // ── 심방 저장 ────────────────────────────────────────────────
  const handleVisitSubmit = async () => {
    if (!vSelMember)           { toast.error('교인을 선택해주세요.'); return }
    if (!vForm.visit_date)     { toast.error('날짜를 입력하세요.');   return }
    if (!vForm.content.trim()) { toast.error('내용을 입력하세요.');   return }
    try {
      if (editingVisit) {
        await api.update(editingVisit.id, { ...vForm, member_id: vSelMember.id })
        toast.success('수정했습니다.')
      } else {
        await api.add({ ...vForm, member_id: vSelMember.id })
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

  // ── 기도제목 저장 ────────────────────────────────────────────
  const openNewPrayer = () => {
    setPContent('')
    setPSelMember(null)
    setPMemberQ('')
    setPMemberSugg([])
    setPModal(true)
  }

  const handlePrayerSubmit = async () => {
    if (!pSelMember)        { toast.error('교인을 선택해주세요.');  return }
    if (!pContent.trim())   { toast.error('기도제목을 입력하세요.'); return }
    try {
      await prayerApi.add({ member_id: pSelMember.id, content: pContent })
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
      setAnswerModal(null)
      setAnswerNote('')
      loadPrayers()
    } catch { toast.error('처리 실패') }
  }

  // ── 미심방 그룹 ──────────────────────────────────────────────
  const uvGroups = unvisited.reduce((acc, m) => {
    const key = m.community_name ?? '미배정'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const toggleCollapse = (name) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  // ── 월별 그룹 ────────────────────────────────────────────────
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
          <button
            key={t.key}
            className={`${styles.sideTab} ${tab === t.key ? styles.sideTabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
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
              </div>
              <button className={styles.addBtn} onClick={() => openNewVisit()}>+ 등록</button>
            </div>

            {monthKeys.length === 0 && (
              <div className={styles.empty}>심방 기록이 없습니다.</div>
            )}

            {monthKeys.map(month => (
              <div key={month} className={styles.monthGroup}>
                <div className={styles.monthLabel}>
                  {month.replace('-', '년 ')}월
                </div>
                <div className={styles.visitList}>
                  {visitsByMonth[month].map(v => (
                    <div key={v.id} className={styles.visitCard}>
                      <div className={styles.visitCardLeft}>
                        {v.photo_url
                          ? <img src={v.photo_url} alt={v.member_name} className={styles.visitAvatar} />
                          : <div className={styles.visitAvatarFallback}
                              style={{ background: '#3b82f6' }}>
                              {(v.member_name ?? '?')[0]}
                            </div>
                        }
                        <div className={styles.visitInfo}>
                          <div className={styles.visitName}>{v.member_name ?? '교인 미지정'}</div>
                          <div className={styles.visitMeta}>
                            <span>{dayjs(v.visit_date).format('YYYY.MM.DD')}</span>
                            {v.visit_type && <span className={styles.visitTypeBadge}>{v.visit_type}</span>}
                            {v.location   && <span className={styles.visitLocation}>{v.location}</span>}
                          </div>
                          <div className={styles.visitContent}>{v.content}</div>
                          {v.next_plan && (
                            <div className={styles.visitNextPlan}>→ {v.next_plan}</div>
                          )}
                        </div>
                      </div>
                      <div className={styles.visitCardRight}>
                        <span className={styles.visitPastor}>{v.pastor_name}</span>
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
                    onClick={() => setPStatus(v)}
                  >{label}</button>
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
                      : <div className={styles.visitAvatarFallback}
                          style={{ background: '#6366f1' }}>
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
                        <button onClick={() => { setAnswerModal({ id: p.id }); setAnswerNote('') }}>
                          응답
                        </button>
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
                <span style={{ fontSize: '0.875rem', color: '#475569' }}>최근</span>
                <input type="number" min={1} max={24} value={months}
                  onChange={e => setMonths(Number(e.target.value))}
                  className={styles.monthInput} />
                <span style={{ fontSize: '0.875rem', color: '#475569' }}>개월 이상 미심방</span>
                <button className={styles.refreshBtn} onClick={loadUnvisited}>조회</button>
              </div>
            </div>

            {uvLoading && <div className={styles.empty}>불러오는 중...</div>}

            {!uvLoading && Object.keys(uvGroups).length === 0 && (
              <div className={styles.empty}>미심방 교인이 없습니다.</div>
            )}

            {!uvLoading && Object.keys(uvGroups).sort().map(communityName => (
              <div key={communityName} className={styles.uvGroup}>
                <button
                  className={styles.uvGroupHeader}
                  onClick={() => toggleCollapse(communityName)}
                >
                  <span>{communityName}</span>
                  <span className={styles.uvCount}>{uvGroups[communityName].length}명</span>
                  <span className={styles.uvChevron}>
                    {collapsed.has(communityName) ? '▶' : '▼'}
                  </span>
                </button>
                {!collapsed.has(communityName) && (
                  <div className={styles.uvTileGrid}>
                    {uvGroups[communityName].map(m => (
                      <button key={m.id} className={styles.uvTile}
                        onClick={() => openNewVisit({ id: m.id, name: m.name, photo_url: m.photo_url })}>
                        {m.photo_url
                          ? <img src={m.photo_url} alt={m.name} className={styles.uvTilePhoto} />
                          : <div className={styles.uvTilePlaceholder}
                              style={{ background: genderColor(m.gender) }}>
                              {m.name[0]}
                            </div>
                        }
                        <div className={styles.uvTileName}>{m.name}</div>
                        <div className={styles.uvTileDate}>
                          {m.last_visit_date
                            ? dayjs(m.last_visit_date).format('YY.MM.DD')
                            : '미심방'}
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
            <div className={styles.modalHead}>
              {editingVisit ? '심방 기록 수정' : '심방 등록'}
            </div>
            <div className={styles.modalBody}>

              {/* 교인 검색 */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>교인 *</label>
                <div style={{ position: 'relative' }}>
                  <input className={styles.formInput}
                    value={vMemberQ}
                    onChange={e => {
                      setVMemberQ(e.target.value)
                      setVSelMember(null)
                      setVMemberSugg(filterMembers(e.target.value))
                    }}
                    placeholder="이름으로 검색..." />
                  {vMemberSugg.length > 0 && (
                    <ul className={styles.suggestions}>
                      {vMemberSugg.map(m => (
                        <li key={m.id} onMouseDown={() => {
                          setVSelMember(m)
                          setVMemberQ(m.name)
                          setVMemberSugg([])
                        }}>
                          {m.photo_url
                            ? <img src={m.photo_url} alt={m.name} className={styles.suggAvatar} />
                            : <div className={styles.suggAvatar}
                                style={{ background: genderColor(m.gender) }}>
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

              {/* 내용 */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>내용 *</label>
                <textarea className={styles.formTextarea} rows={4}
                  value={vForm.content}
                  onChange={e => setVForm(f => ({ ...f, content: e.target.value }))} />
              </div>

              {/* 후속계획 */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>후속 계획</label>
                <input className={styles.formInput}
                  value={vForm.next_plan}
                  onChange={e => setVForm(f => ({ ...f, next_plan: e.target.value }))}
                  placeholder="선택사항" />
                <div className={styles.nextPlanEventRow}>
                  <label className={styles.nextPlanEventCheck}>
                    <input
                      type="checkbox"
                      checked={vForm.next_plan_is_event}
                      onChange={e => setVForm(f => ({ ...f, next_plan_is_event: e.target.checked }))}
                    />
                    📅 캘린더 일정으로 등록
                  </label>
                  {vForm.next_plan_is_event && (
                    <>
                      <input
                        type="date"
                        className={styles.nextPlanDateIcon}
                        value={vForm.next_plan_event_date}
                        onChange={e => setVForm(f => ({ ...f, next_plan_event_date: e.target.value }))}
                      />
                      <input
                        className={styles.nextPlanTitleInput}
                        value={vForm.next_plan_event_title}
                        onChange={e => setVForm(f => ({ ...f, next_plan_event_title: e.target.value }))}
                        placeholder="캘린더 표시 제목"
                      />
                    </>
                  )}
                </div>
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
                <div style={{ position: 'relative' }}>
                  <input className={styles.formInput}
                    value={pMemberQ}
                    onChange={e => {
                      setPMemberQ(e.target.value)
                      setPSelMember(null)
                      setPMemberSugg(filterMembers(e.target.value))
                    }}
                    placeholder="이름으로 검색..." />
                  {pMemberSugg.length > 0 && (
                    <ul className={styles.suggestions}>
                      {pMemberSugg.map(m => (
                        <li key={m.id} onMouseDown={() => {
                          setPSelMember(m)
                          setPMemberQ(m.name)
                          setPMemberSugg([])
                        }}>
                          {m.photo_url
                            ? <img src={m.photo_url} alt={m.name} className={styles.suggAvatar} />
                            : <div className={styles.suggAvatar}
                                style={{ background: genderColor(m.gender) }}>
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
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>기도제목 *</label>
                <textarea className={styles.formTextarea} rows={4}
                  value={pContent}
                  onChange={e => setPContent(e.target.value)} />
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
              <button className={styles.saveBtn}
                style={{ background: '#10b981' }}
                onClick={handleAnswer}>
                응답 처리
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
