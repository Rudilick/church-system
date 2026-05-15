import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { calendar as calApi, auth as authApi } from '../../api'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import styles from './Calendar.module.css'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export const EVENT_TYPES = {
  '특이사항': '❗',
  '추후일정': '📌',
  '생일':    '🎂',
  '행사':    '🎉',
  '절기':    '✝️',
  '심방':    '🤝',
  '기도제목':'🙏',
  '기타':    '📌',
}

const COLORS = [
  { label: '파랑',   value: '#3b82f6' },
  { label: '초록',   value: '#10b981' },
  { label: '주황',   value: '#f97316' },
  { label: '보라',   value: '#8b5cf6' },
  { label: '빨강',   value: '#ef4444' },
  { label: '분홍',   value: '#ec4899' },
  { label: '하늘',   value: '#06b6d4' },
  { label: '노랑',   value: '#eab308' },
]

const SWIPE_LIMIT = 10

function initForm(date = '') {
  return {
    title: '', date, end_date: '', time: '', location: '',
    color: '#3b82f6', recurrence_type: 'none', recurrence_end: '',
    event_type: '기타',
  }
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const [cur, setCur]               = useState(dayjs().startOf('month'))
  const [dataCache, setDataCache]   = useState({})
  const [swipeCount, setSwipeCount] = useState(0)
  const [addModal, setAddModal]     = useState(null)
  const [detailModal, setDetailModal] = useState(null)
  const [form, setForm]             = useState(initForm())
  const [saving, setSaving]         = useState(false)
  const [tooltip, setTooltip]       = useState(null)
  const [morePopup, setMorePopup]   = useState(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showBirthdays, setShowBirthdays] = useState(true)
  const [showIcal, setShowIcal]         = useState(false)
  const [icalToken, setIcalToken]       = useState('')

  const icalUrl = icalToken
    ? `${import.meta.env.VITE_API_URL ?? '/api'}/calendar/ical?token=${icalToken}`
    : ''

  const openIcal = async () => {
    try {
      const { data } = await authApi.icalToken()
      setIcalToken(data.token || '')
    } catch { setIcalToken('') }
    setShowIcal(true)
  }

  const handleRegenerate = async () => {
    if (!confirm('URL을 재발급하면 기존 구독이 끊깁니다. 계속할까요?')) return
    try {
      const { data } = await authApi.regenerateIcal()
      setIcalToken(data.token)
      toast.success('URL이 재발급됐습니다.')
    } catch { toast.error('재발급에 실패했습니다.') }
  }

  const [wrapperWidth, setWrapperWidth] = useState(0)

  const touchStartX   = useRef(null)
  const wrapperRef    = useRef(null)
  const loadedKeys    = useRef(new Set())
  const morePopupTimerRef = useRef(null)

  useLayoutEffect(() => {
    if (!wrapperRef.current) return
    setWrapperWidth(wrapperRef.current.offsetWidth)
    const ro = new ResizeObserver(entries => {
      setWrapperWidth(entries[0].contentRect.width)
    })
    ro.observe(wrapperRef.current)
    return () => ro.disconnect()
  }, [])

  const today = dayjs().format('YYYY-MM-DD')

  // ── 데이터 로드 (캐시 기반) ────────────────────────────────
  const fetchMonth = useCallback((m) => {
    const key = m.format('YYYY-MM')
    if (loadedKeys.current.has(key)) return
    loadedKeys.current.add(key)
    calApi.list(m.year(), m.month() + 1)
      .then(r => {
        setDataCache(prev => ({
          ...prev,
          [key]: {
            events:      r.data.events       || [],
            birthdays:   r.data.birthdays    || [],
            prayerEvents: r.data.prayerEvents || [],
          },
        }))
      })
      .catch(() => { loadedKeys.current.delete(key) })
  }, [])

  const refetchCur = useCallback(() => {
    const key = cur.format('YYYY-MM')
    loadedKeys.current.delete(key)
    fetchMonth(cur)
  }, [cur, fetchMonth])

  // cur이 바뀌면 인접 월 포함 3개 월 미리 로드
  useEffect(() => {
    fetchMonth(cur.subtract(1, 'month'))
    fetchMonth(cur)
    fetchMonth(cur.add(1, 'month'))
  }, [cur, fetchMonth])

  // ── 일정 추가 ──────────────────────────────────────────────
  const openAdd = (dateStr) => {
    setForm(initForm(dateStr))
    setAddModal(dateStr)
  }

  const handleAdd = async () => {
    if (!form.title.trim()) { toast.error('제목을 입력하세요.'); return }
    setSaving(true)
    try {
      const res = await calApi.add(form)
      const cnt = res.data.count
      toast.success(cnt ? `반복 일정 ${cnt}건 추가` : '일정을 추가했습니다.')
      setAddModal(null)
      refetchCur()
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // ── 일정 삭제 ──────────────────────────────────────────────
  const handleDeleteOne = async (ev) => {
    await calApi.remove(ev.id)
    toast.success('삭제했습니다.')
    setDetailModal(null)
    refetchCur()
  }

  const handleDeleteAll = async (ev) => {
    await calApi.removeGroup(ev.recurrence_group_id)
    toast.success('반복 일정 전체 삭제')
    setDetailModal(null)
    refetchCur()
  }

  // ── 스와이프 ───────────────────────────────────────────────
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
    setIsAnimating(false)
  }

  const handleTouchMove = (e) => {
    if (touchStartX.current === null) return
    const dx = e.touches[0].clientX - touchStartX.current
    setDragOffset(dx)
  }

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    const w = wrapperRef.current?.offsetWidth || 400

    if (Math.abs(dx) > 80) {
      const goingPrev = dx > 0

      // 스와이프 한계 체크
      if (goingPrev && swipeCount <= -SWIPE_LIMIT) {
        setIsAnimating(true)
        setDragOffset(0)
        setTimeout(() => setIsAnimating(false), 350)
        return
      }
      if (!goingPrev && swipeCount >= SWIPE_LIMIT) {
        setIsAnimating(true)
        setDragOffset(0)
        setTimeout(() => setIsAnimating(false), 350)
        return
      }

      // 끝까지 슬라이드
      setIsAnimating(true)
      setDragOffset(goingPrev ? w : -w)

      setTimeout(() => {
        setCur(d => goingPrev ? d.subtract(1, 'month') : d.add(1, 'month'))
        setSwipeCount(c => goingPrev ? c - 1 : c + 1)
        setIsAnimating(false)
        setDragOffset(0)
      }, 300)
    } else {
      setIsAnimating(true)
      setDragOffset(0)
      setTimeout(() => setIsAnimating(false), 350)
    }
  }

  // ── 월 이동 버튼 ───────────────────────────────────────────
  const goPrev = () => {
    if (swipeCount <= -SWIPE_LIMIT) return
    setCur(d => d.subtract(1, 'month'))
    setSwipeCount(c => c - 1)
  }
  const goNext = () => {
    if (swipeCount >= SWIPE_LIMIT) return
    setCur(d => d.add(1, 'month'))
    setSwipeCount(c => c + 1)
  }
  const goToday = () => {
    setCur(dayjs().startOf('month'))
    setSwipeCount(0)
  }

  // ── 달력 그리드 렌더 (클로저) ──────────────────────────────
  const renderGrid = (month, data = {}) => {
    const { events = [], birthdays = [], prayerEvents = [] } = data
    const startPad    = month.day()
    const daysInMonth = month.daysInMonth()
    const cells       = []

    for (let i = startPad - 1; i >= 0; i--)
      cells.push({ d: month.subtract(i + 1, 'day'), isCur: false })
    for (let d = 1; d <= daysInMonth; d++)
      cells.push({ d: month.date(d), isCur: true })
    const tail   = (7 - cells.length % 7) % 7
    const lastDay = month.date(daysInMonth)
    for (let i = 1; i <= tail; i++)
      cells.push({ d: lastDay.add(i, 'day'), isCur: false })

    const singleEvs = events.filter(e => {
      const s = e.start_at.slice(0, 10)
      const en = e.end_at ? e.end_at.slice(0, 10) : s
      return s === en
    })
    const multiEvs = events.filter(e => {
      const s = e.start_at.slice(0, 10)
      const en = e.end_at ? e.end_at.slice(0, 10) : s
      return s !== en
    })

    const evMap = {}
    singleEvs.forEach(e => {
      const k = e.start_at.slice(0, 10)
      ;(evMap[k] ??= []).push(e)
    })

    const multiMap = {}
    multiEvs.forEach(e => {
      const startD = dayjs(e.start_at.slice(0, 10))
      const endD   = dayjs(e.end_at ? e.end_at.slice(0, 10) : e.start_at.slice(0, 10))
      let d = startD
      while (!d.isAfter(endD)) {
        const k = d.format('YYYY-MM-DD')
        ;(multiMap[k] ??= []).push({
          event: e,
          isStart: k === e.start_at.slice(0, 10),
          isEnd:   k === (e.end_at ? e.end_at.slice(0, 10) : e.start_at.slice(0, 10)),
        })
        d = d.add(1, 'day')
      }
    })

    const yr = month.year()
    const bdMap = {}
    birthdays.forEach(b => {
      const dayPart = b.birth_date.slice(5, 10)
      const k = `${yr}-${dayPart}`
      ;(bdMap[k] ??= []).push(b)
    })

    const prayMap = {}
    prayerEvents.forEach(pe => {
      const k = (pe.event_date || '').slice(0, 10)
      if (k) (prayMap[k] ??= []).push(pe)
    })

    return (
      <div className={styles.grid}>
        {cells.map(({ d, isCur }, idx) => {
          const ds   = d.format('YYYY-MM-DD')
          const evs  = evMap[ds]    || []
          const bds  = bdMap[ds]    || []
          const mds  = multiMap[ds] || []
          const prs  = prayMap[ds]  || []
          const isToday = ds === today
          const isSun   = idx % 7 === 0
          const isSat   = idx % 7 === 6
          const MAX = 3
          let shown = 0
          const visibleBds = showBirthdays ? bds : []
          const allDayItems = [
            ...mds.map(({ event: ev }) => ({ kind: 'multi', ev })),
            ...visibleBds.map(b => ({ kind: 'bd', b })),
            ...prs.map(pr => ({ kind: 'pr', pr })),
            ...evs.map(ev => ({ kind: 'ev', ev })),
          ]

          return (
            <div key={ds + idx} className={`${styles.cell} ${!isCur ? styles.cellOther : ''}`}>
              <div className={styles.cellHead}>
                <span className={[
                  styles.dayNum,
                  isToday           ? styles.dayToday : '',
                  isSun && !isToday ? styles.daySun   : '',
                  isSat && !isToday ? styles.daySat   : '',
                ].join(' ')}>
                  {d.date()}
                </span>
                {isCur && (
                  <button className={styles.addBtn} onClick={() => openAdd(ds)} title="일정 추가">+</button>
                )}
              </div>

              {mds.map(({ event: ev, isStart, isEnd }) => {
                if (shown >= MAX) return null
                shown++
                return (
                  <div key={`md${ev.id}`}
                    className={[
                      styles.chip,
                      styles.chipBar,
                      isStart && isEnd ? '' : isStart ? styles.chipBarStart : isEnd ? styles.chipBarEnd : styles.chipBarMid,
                    ].join(' ')}
                    style={{ background: ev.color || '#3b82f6', color: '#fff' }}
                    onClick={() => setDetailModal(ev)}
                  >
                    {isStart ? (
                      <>
                        <span className={styles.chipEm}>{EVENT_TYPES[ev.event_type] || '📌'}</span>
                        <span className={styles.chipLabel}>{ev.title}</span>
                      </>
                    ) : <span>&nbsp;</span>}
                  </div>
                )
              })}

              {visibleBds.map(b => {
                if (shown >= MAX) return null
                shown++
                return (
                  <div key={`b${b.id}`} className={styles.chip} style={{ background: '#dcfce7', color: '#14532d', cursor: 'pointer' }}
                    onClick={() => b.id && navigate(`/members/${b.id}`)}>
                    <span className={styles.chipEm}>🎂</span>
                    <span className={styles.chipLabel}>{b.name}</span>
                  </div>
                )
              })}

              {prs.map(pr => {
                if (shown >= MAX) return null
                shown++
                return (
                  <div key={`pr${pr.id}`} className={styles.chip}
                    style={{ background: '#fdf4ff', color: '#7c3aed', border: '1px solid #e9d5ff' }}
                    onClick={() => navigate('/pastoral')}
                    onMouseEnter={(me) => {
                      const rect = me.currentTarget.getBoundingClientRect()
                      setTooltip({ description: pr.content, x: rect.left, y: rect.bottom + 6 })
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <span className={styles.chipEm}>🙏</span>
                    <span className={styles.chipLabel}>{pr.member_name || pr.title}</span>
                  </div>
                )
              })}

              {evs.map(ev => {
                if (shown >= MAX) return null
                shown++
                return (
                  <div key={ev.id} className={styles.chip}
                    style={{ background: ev.color || '#3b82f6', color: '#fff' }}
                    onClick={() => setDetailModal(ev)}
                    onMouseEnter={ev.description ? (me) => {
                      const rect = me.currentTarget.getBoundingClientRect()
                      setTooltip({ description: ev.description, x: rect.left, y: rect.bottom + 6 })
                    } : undefined}
                    onMouseLeave={ev.description ? () => setTooltip(null) : undefined}
                  >
                    {EVENT_TYPES[ev.event_type] && (
                      <span className={styles.chipEm}>{EVENT_TYPES[ev.event_type]}</span>
                    )}
                    {!ev.is_all_day && ev.start_at.slice(11, 16) !== '00:00' && (
                      <span className={styles.chipTime}>{ev.start_at.slice(11, 16)}</span>
                    )}
                    <span className={styles.chipLabel}>{ev.title}</span>
                    {ev.description && <span className={styles.chipDescDot}>·</span>}
                  </div>
                )
              })}

              {allDayItems.length > MAX && (
                <div className={styles.moreChip}
                  onMouseEnter={e => {
                    clearTimeout(morePopupTimerRef.current)
                    const rect = e.currentTarget.getBoundingClientRect()
                    setMorePopup({ ds, items: allDayItems, x: rect.left, y: rect.bottom + 4 })
                  }}
                  onMouseLeave={() => { morePopupTimerRef.current = setTimeout(() => setMorePopup(null), 200) }}
                  onTouchStart={e => {
                    e.stopPropagation()
                    const rect = e.currentTarget.getBoundingClientRect()
                    setMorePopup(mp => mp?.ds === ds ? null : { ds, items: allDayItems, x: rect.left, y: rect.bottom + 4 })
                  }}
                >
                  +{allDayItems.length - MAX}개 더
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const w = wrapperWidth
  const months = [cur.subtract(1, 'month'), cur, cur.add(1, 'month')]

  return (
    <div className={styles.page}>

      {/* ── 헤더 ──────────────────────────────────────────────── */}
      <div className={styles.header}>
        <button className={styles.navBtn} onClick={goPrev} disabled={swipeCount <= -SWIPE_LIMIT}>◀</button>
        <h2 className={styles.monthTitle}>{cur.format('YYYY년 M월')}</h2>
        <button className={styles.navBtn} onClick={goNext} disabled={swipeCount >= SWIPE_LIMIT}>▶</button>
        <button className={styles.todayBtn} onClick={goToday}>오늘</button>
        <button
          className={styles.todayBtn}
          style={{ opacity: showBirthdays ? 1 : 0.5 }}
          onClick={() => setShowBirthdays(v => !v)}
          title={showBirthdays ? '생일 숨기기' : '생일 표시'}
        >{showBirthdays ? '🎂생일포함' : '🎂생일제외'}</button>
        <button className={styles.icalBtn} onClick={openIcal} title="구글/삼성 캘린더 구독">
          📅 구독
        </button>
      </div>

      {/* ── 요일 헤더 ─────────────────────────────────────────── */}
      <div className={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`${styles.weekCell} ${i === 0 ? styles.labelSun : i === 6 ? styles.labelSat : ''}`}>
            {w}
          </div>
        ))}
      </div>

      {/* ── 멀티월 스트립 (스와이프 적용) ────────────────────── */}
      <div ref={wrapperRef} className={styles.stripWrapper}>
        <div
          className={styles.strip}
          style={{
            transform: `translateX(${-(w || 0) + dragOffset}px)`,
            transition: isAnimating ? 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {months.map(m => {
            const key = m.format('YYYY-MM')
            return (
              <div key={key} className={styles.monthPage} style={{ width: w > 0 ? w : undefined }}>
                {renderGrid(m, dataCache[key])}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 설명 툴팁 ─────────────────────────────────────────── */}
      {tooltip && (
        <div className={styles.chipTooltip} style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.description}
        </div>
      )}

      {/* ── 더보기 팝업 ───────────────────────────────────────── */}
      {morePopup && (
        <div className={styles.morePopup}
          style={{ left: morePopup.x, top: morePopup.y }}
          onMouseEnter={() => clearTimeout(morePopupTimerRef.current)}
          onMouseLeave={() => { morePopupTimerRef.current = setTimeout(() => setMorePopup(null), 200) }}
        >
          <div className={styles.morePopupTitle}>{dayjs(morePopup.ds).format('M월 D일')} 전체 일정</div>
          {morePopup.items.map((item, i) => {
            if (item.kind === 'multi') {
              const { ev } = item
              return (
                <div key={i} className={styles.morePopupItem}
                  style={{ color: ev.color || '#3b82f6' }}
                  onClick={() => { setMorePopup(null); setDetailModal(ev) }}
                >
                  {EVENT_TYPES[ev.event_type] || '📌'} {ev.title}
                </div>
              )
            }
            if (item.kind === 'bd') {
              return (
                <div key={i} className={styles.morePopupItem}
                  onClick={() => { setMorePopup(null); if (item.b.id) navigate(`/members/${item.b.id}`) }}
                >🎂 {item.b.name}</div>
              )
            }
            if (item.kind === 'pr') {
              return (
                <div key={i} className={styles.morePopupItem} style={{ color: '#7c3aed' }}
                  onClick={() => { setMorePopup(null); navigate('/pastoral') }}
                >
                  🙏 {item.pr.member_name || item.pr.title}
                </div>
              )
            }
            const { ev } = item
            return (
              <div key={i} className={styles.morePopupItem}
                style={{ color: ev.color || '#3b82f6' }}
                onClick={() => { setMorePopup(null); setDetailModal(ev) }}
              >
                {EVENT_TYPES[ev.event_type] || '📌'} {ev.title}
              </div>
            )
          })}
        </div>
      )}

      {/* ── 일정 추가 모달 ────────────────────────────────────── */}
      {addModal && (
        <div className={styles.overlay} onClick={() => setAddModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>일정 추가</h3>
            <p className={styles.modalDate}>{dayjs(addModal).format('YYYY년 M월 D일 (ddd)')}</p>

            <div className={styles.formGroup}>
              <label>분류</label>
              <select className={styles.inp} value={form.event_type}
                onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>
                {Object.entries(EVENT_TYPES).map(([type, emoji]) => (
                  <option key={type} value={type}>{emoji} {type}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>제목 *</label>
              <input className={styles.inp} value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="일정 제목" autoFocus />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>시간 (선택)</label>
                <input type="time" className={styles.inp} value={form.time}
                  onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              <div className={styles.formGroup}>
                <label>종료일 (선택)</label>
                <input type="date" className={styles.inp} value={form.end_date}
                  min={addModal}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>장소 (선택)</label>
              <input className={styles.inp} value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="장소" />
            </div>

            <div className={styles.formGroup}>
              <label>색상</label>
              <div className={styles.colorRow}>
                {COLORS.map(c => (
                  <button key={c.value}
                    className={`${styles.colorDot} ${form.color === c.value ? styles.colorDotActive : ''}`}
                    style={{ background: c.value }}
                    onClick={() => setForm(f => ({ ...f, color: c.value }))}
                    title={c.label} />
                ))}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>반복</label>
              <div className={styles.segmented}>
                {[['none','없음'], ['weekly','매주'], ['monthly','매월']].map(([v, l]) => (
                  <button key={v}
                    className={`${styles.seg} ${form.recurrence_type === v ? styles.segActive : ''}`}
                    onClick={() => setForm(f => ({ ...f, recurrence_type: v }))}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {form.recurrence_type !== 'none' && (
              <div className={styles.formGroup}>
                <label>반복 종료일 <span className={styles.hint}>(비워두면 2년 자동 적용)</span></label>
                <input type="date" className={styles.inp} value={form.recurrence_end}
                  onChange={e => setForm(f => ({ ...f, recurrence_end: e.target.value }))} />
              </div>
            )}

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setAddModal(null)}>취소</button>
              <button className={styles.confirmBtn} onClick={handleAdd} disabled={saving}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 일정 상세/삭제 모달 ───────────────────────────────── */}
      {detailModal && (
        <div className={styles.overlay} onClick={() => setDetailModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.detailBadge} style={{ background: detailModal.color || '#3b82f6' }}>
              {EVENT_TYPES[detailModal.event_type] && `${EVENT_TYPES[detailModal.event_type]} `}
              {detailModal.title}
            </div>

            <div className={styles.detailInfoWrap}>
              <p className={styles.detailInfo}>
                📅 {dayjs(detailModal.start_at).format('YYYY년 M월 D일')}
                {detailModal.end_at && detailModal.end_at.slice(0, 10) !== detailModal.start_at.slice(0, 10) && (
                  <> ~ {dayjs(detailModal.end_at).format('M월 D일')}</>
                )}
                {!detailModal.is_all_day && detailModal.start_at.slice(11, 16) !== '00:00' && (
                  <> · {detailModal.start_at.slice(11, 16)}</>
                )}
              </p>
              {detailModal.location && (
                <p className={styles.detailInfo}>📍 {detailModal.location}</p>
              )}
              {detailModal.description && (
                <p className={styles.detailDesc}>💬 {detailModal.description}</p>
              )}
              {detailModal.recurrence_group_id && (
                <p className={styles.detailRepeat}>🔁 반복 일정</p>
              )}
            </div>

            {detailModal.recurrence_group_id ? (
              <>
                <p className={styles.detailHint}>어떻게 삭제할까요?</p>
                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={() => setDetailModal(null)}>취소</button>
                  <button className={styles.warnBtn} onClick={() => handleDeleteOne(detailModal)}>이 날만 삭제</button>
                  <button className={styles.dangerBtn} onClick={() => handleDeleteAll(detailModal)}>전체 삭제</button>
                </div>
              </>
            ) : (
              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setDetailModal(null)}>취소</button>
                <button className={styles.dangerBtn} onClick={() => handleDeleteOne(detailModal)}>삭제</button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── ICS 구독 URL 모달 ─────────────────────────────────── */}
      {showIcal && (
        <div className={styles.overlay} onClick={() => setShowIcal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>캘린더 구독 URL</h3>
            <p className={styles.icalDesc}>
              아래 URL을 구글/삼성/애플 캘린더에 추가하면<br />교회 일정이 자동으로 표시됩니다.
            </p>
            <div className={styles.icalUrlRow}>
              <input
                readOnly
                value={icalUrl}
                className={styles.icalUrlInput}
                onClick={e => e.target.select()}
              />
              <button
                className={styles.confirmBtn}
                onClick={() => { navigator.clipboard.writeText(icalUrl); toast.success('복사됐습니다.') }}
              >복사</button>
            </div>
            <details className={styles.icalGuide}>
              <summary>사용 방법</summary>
              <ul>
                <li>구글 캘린더: 다른 캘린더 + → URL로 추가</li>
                <li>삼성 캘린더: 구글 계정으로 구글 캘린더 구독 URL 추가</li>
                <li>아이폰: 설정 → 캘린더 → 계정 추가 → 기타 → 구독 캘린더</li>
              </ul>
            </details>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowIcal(false)}>닫기</button>
              <button className={styles.warnBtn} onClick={handleRegenerate}>URL 재발급</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
