import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { calendar as calApi } from '../../api'
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
  const [events, setEvents]         = useState([])
  const [birthdays, setBirthdays]   = useState([])
  const [prayerEvents, setPrayerEvents] = useState([])
  const [addModal, setAddModal]     = useState(null)
  const [detailModal, setDetailModal] = useState(null)
  const [form, setForm]             = useState(initForm())
  const [saving, setSaving]         = useState(false)
  const [tooltip, setTooltip]       = useState(null)
  const [morePopup, setMorePopup]   = useState(null)
  const touchStartX = useRef(null)
  const morePopupTimerRef = useRef(null)

  const year  = cur.year()
  const month = cur.month() + 1

  const load = () => {
    calApi.list(year, month)
      .then(r => {
        setEvents(r.data.events || [])
        setBirthdays(r.data.birthdays || [])
        setPrayerEvents(r.data.prayerEvents || [])
      })
      .catch(() => {})
  }

  useEffect(() => { load() }, [year, month])

  // ── 달력 칸 생성 ──────────────────────────────────────────────
  const startPad    = cur.day()
  const daysInMonth = cur.daysInMonth()
  const cells       = []

  for (let i = startPad - 1; i >= 0; i--)
    cells.push({ d: cur.subtract(i + 1, 'day'), isCur: false })
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ d: cur.date(d), isCur: true })
  const tail   = (7 - cells.length % 7) % 7
  const lastDay = cur.date(daysInMonth)
  for (let i = 1; i <= tail; i++)
    cells.push({ d: lastDay.add(i, 'day'), isCur: false })

  // ── 단일일 vs 멀티일 분리 ──────────────────────────────────────
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

  // 단일일 인덱스
  const evMap = {}
  singleEvs.forEach(e => {
    const k = e.start_at.slice(0, 10)
    ;(evMap[k] ??= []).push(e)
  })

  // 멀티일 인덱스 (각 날짜마다 span 정보 포함)
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

  // 생일 인덱스
  const bdMap = {}
  birthdays.forEach(b => {
    const dayPart = b.birth_date.slice(5, 10)
    const k = `${year}-${dayPart}`
    ;(bdMap[k] ??= []).push(b)
  })

  // 기도제목 캘린더 인덱스
  const prayMap = {}
  prayerEvents.forEach(pe => {
    const k = (pe.event_date || '').slice(0, 10)
    if (k) (prayMap[k] ??= []).push(pe)
  })

  // ── 일정 추가 ──────────────────────────────────────────────────
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
      load()
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // ── 일정 삭제 ──────────────────────────────────────────────────
  const handleDeleteOne = async (ev) => {
    await calApi.remove(ev.id)
    toast.success('삭제했습니다.')
    setDetailModal(null)
    load()
  }

  const handleDeleteAll = async (ev) => {
    await calApi.removeGroup(ev.recurrence_group_id)
    toast.success('반복 일정 전체 삭제')
    setDetailModal(null)
    load()
  }

  // ── 태블릿 스와이프 ────────────────────────────────────────────
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50)
      setCur(d => dx < 0 ? d.add(1, 'month') : d.subtract(1, 'month'))
    touchStartX.current = null
  }

  const today = dayjs().format('YYYY-MM-DD')

  return (
    <div className={styles.page}>

      {/* ── 헤더 ──────────────────────────────────────────────── */}
      <div className={styles.header}>
        <button className={styles.navBtn} onClick={() => setCur(d => d.subtract(1, 'month'))}>◀</button>
        <h2 className={styles.monthTitle}>{cur.format('YYYY년 M월')}</h2>
        <button className={styles.navBtn} onClick={() => setCur(d => d.add(1, 'month'))}>▶</button>
        <button className={styles.todayBtn} onClick={() => setCur(dayjs().startOf('month'))}>오늘</button>
      </div>

      {/* ── 요일 헤더 ─────────────────────────────────────────── */}
      <div className={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`${styles.weekCell} ${i === 0 ? styles.labelSun : i === 6 ? styles.labelSat : ''}`}>
            {w}
          </div>
        ))}
      </div>

      {/* ── 달력 그리드 (스와이프 적용) ───────────────────────── */}
      <div className={styles.grid}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
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
          const allDayItems = [
            ...mds.map(({ event: ev }) => ({ kind: 'multi', ev })),
            ...bds.map(b => ({ kind: 'bd', b })),
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

              {/* 멀티일 바 */}
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

              {/* 생일 */}
              {bds.map(b => {
                if (shown >= MAX) return null
                shown++
                return (
                  <div key={`b${b.id}`} className={styles.chip} style={{ background: '#dcfce7', color: '#14532d' }}>
                    <span className={styles.chipEm}>🎂</span>
                    <span className={styles.chipLabel}>{b.name}</span>
                  </div>
                )
              })}

              {/* 기도제목 */}
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

              {/* 단일일 일정 */}
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

              {/* 더보기 */}
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
              return <div key={i} className={styles.morePopupItem}>🎂 {item.b.name}</div>
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
    </div>
  )
}
