import { useEffect, useState } from 'react'
import { calendar as calApi } from '../../api'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import styles from './Calendar.module.css'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

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
  return { title: '', date, time: '', location: '', color: '#3b82f6', recurrence_type: 'none', recurrence_end: '' }
}

export default function CalendarPage() {
  const [cur, setCur]               = useState(dayjs().startOf('month'))
  const [events, setEvents]         = useState([])
  const [birthdays, setBirthdays]   = useState([])
  const [addModal, setAddModal]       = useState(null)   // date string
  const [detailModal, setDetailModal] = useState(null)   // event object
  const [form, setForm]               = useState(initForm())
  const [saving, setSaving]           = useState(false)
  const [tooltip, setTooltip]         = useState(null)   // { description, x, y }

  const year  = cur.year()
  const month = cur.month() + 1

  const load = () => {
    calApi.list(year, month)
      .then(r => {
        setEvents(r.data.events || [])
        setBirthdays(r.data.birthdays || [])
      })
      .catch(() => {})
  }

  useEffect(() => { load() }, [year, month])

  // ── 달력 칸 생성 ──────────────────────────────────────────
  const startPad    = cur.day()           // 0=일
  const daysInMonth = cur.daysInMonth()
  const cells       = []

  for (let i = startPad - 1; i >= 0; i--)
    cells.push({ d: cur.subtract(i + 1, 'day'), isCur: false })
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ d: cur.date(d), isCur: true })
  const tail = (7 - cells.length % 7) % 7
  const lastDay = cur.date(daysInMonth)
  for (let i = 1; i <= tail; i++)
    cells.push({ d: lastDay.add(i, 'day'), isCur: false })

  // ── 날짜별 인덱싱 ─────────────────────────────────────────
  const evMap = {}
  events.forEach(e => {
    const k = e.start_at.slice(0, 10)
    ;(evMap[k] ??= []).push(e)
  })

  const bdMap = {}
  birthdays.forEach(b => {
    const dayPart = b.birth_date.slice(5, 10) // MM-DD
    const k = `${year}-${dayPart}`
    ;(bdMap[k] ??= []).push(b)
  })

  // ── 일정 추가 ─────────────────────────────────────────────
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

  // ── 일정 삭제 ─────────────────────────────────────────────
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

  const today = dayjs().format('YYYY-MM-DD')

  return (
    <div className={styles.page}>

      {/* ── 헤더 ────────────────────────────────────────────── */}
      <div className={styles.header}>
        <button className={styles.navBtn} onClick={() => setCur(d => d.subtract(1, 'month'))}>◀</button>
        <h2 className={styles.monthTitle}>{cur.format('YYYY년 M월')}</h2>
        <button className={styles.navBtn} onClick={() => setCur(d => d.add(1, 'month'))}>▶</button>
        <button className={styles.todayBtn} onClick={() => setCur(dayjs().startOf('month'))}>오늘</button>
      </div>

      {/* ── 요일 헤더 ──────────────────────────────────────── */}
      <div className={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`${styles.weekCell} ${i === 0 ? styles.labelSun : i === 6 ? styles.labelSat : ''}`}>
            {w}
          </div>
        ))}
      </div>

      {/* ── 달력 그리드 ────────────────────────────────────── */}
      <div className={styles.grid}>
        {cells.map(({ d, isCur }, idx) => {
          const ds  = d.format('YYYY-MM-DD')
          const evs = evMap[ds] || []
          const bds = bdMap[ds] || []
          const isToday = ds === today
          const isSun   = idx % 7 === 0
          const isSat   = idx % 7 === 6
          const MAX = 3
          let shown = 0

          return (
            <div key={ds + idx} className={`${styles.cell} ${!isCur ? styles.cellOther : ''}`}>
              <div className={styles.cellHead}>
                <span className={[
                  styles.dayNum,
                  isToday        ? styles.dayToday : '',
                  isSun && !isToday ? styles.daySun : '',
                  isSat && !isToday ? styles.daySat : '',
                ].join(' ')}>
                  {d.date()}
                </span>
                {isCur && (
                  <button className={styles.addBtn} onClick={() => openAdd(ds)} title="일정 추가">+</button>
                )}
              </div>

              {/* 생일 */}
              {bds.map(b => {
                if (shown >= MAX) return null
                shown++
                return (
                  <div key={`b${b.id}`} className={styles.chip} style={{ background: '#dcfce7', color: '#14532d' }}>
                    🎂 {b.name}
                  </div>
                )
              })}

              {/* 일정 */}
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
                    {!ev.is_all_day && ev.start_at.slice(11, 16) !== '00:00' && (
                      <span className={styles.chipTime}>{ev.start_at.slice(11, 16)}</span>
                    )}
                    {ev.title}
                    {ev.description && <span className={styles.chipDescDot}>·</span>}
                  </div>
                )
              })}

              {/* 더보기 */}
              {evs.length + bds.length > MAX && (
                <div className={styles.moreChip}>+{evs.length + bds.length - MAX}개 더</div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── 설명 툴팁 (PC hover) ────────────────────────────── */}
      {tooltip && (
        <div className={styles.chipTooltip} style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.description}
        </div>
      )}

      {/* ── 일정 추가 모달 ──────────────────────────────────── */}
      {addModal && (
        <div className={styles.overlay} onClick={() => setAddModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>일정 추가</h3>
            <p className={styles.modalDate}>{dayjs(addModal).format('YYYY년 M월 D일 (ddd)')}</p>

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
                <label>장소 (선택)</label>
                <input className={styles.inp} value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="장소" />
              </div>
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

      {/* ── 일정 상세/삭제 모달 ─────────────────────────────── */}
      {detailModal && (
        <div className={styles.overlay} onClick={() => setDetailModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.detailBadge} style={{ background: detailModal.color || '#3b82f6' }}>
              {detailModal.title}
            </div>

            <div className={styles.detailInfoWrap}>
              <p className={styles.detailInfo}>
                📅 {dayjs(detailModal.start_at).format('YYYY년 M월 D일')}
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
