import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { publicApi } from '../../api'
import styles from './VehicleRequestPage.module.css'

const STATUS_LABEL = { pending: '검토중', approved: '승인', rejected: '불가' }
const STATUS_COLOR = { pending: '#f59e0b', approved: '#10b981', rejected: '#94a3b8' }
const WEEKDAYS_KO  = ['일', '월', '화', '수', '목', '금', '토']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function timeToRatio(t) {
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return (h * 60 + m) / (24 * 60)
}

// 시작일~종료일 범위의 날짜 배열 (YYYY-MM-DD)
function dateRange(start, end) {
  const dates = []
  let cur = dayjs(start)
  const last = dayjs(end)
  while (cur.isValid() && last.isValid() && !cur.isAfter(last, 'day')) {
    dates.push(cur.format('YYYY-MM-DD'))
    cur = cur.add(1, 'day')
  }
  return dates
}

// 다중일 배차의 경우, 표시 중인 날짜 기준으로 막대의 시작·끝 비율만 잘라서 계산
function dayRatioRange(d, date) {
  const startsBefore = d.dispatch_date && d.dispatch_date.slice(0, 10) < date
  const endsAfter    = d.end_date && d.end_date.slice(0, 10) > date
  return [
    startsBefore ? 0 : timeToRatio(d.start_time),
    endsAfter    ? 1 : timeToRatio(d.end_time),
  ]
}

// 연락처 입력 시 숫자만 남겨 자동으로 하이픈을 채워준다 (010-0000-0000)
function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length > 7)  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  if (digits.length > 3)  return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return digits
}

// ── 일자별 배차 현황 막대그래프 (차량배차관리 페이지와 동일한 표시 방식) ──
function DispatchBarGraph({ dispatches, date }) {
  if (!dispatches.length) {
    return <p className={styles.timelineEmpty}>해당 날짜에 배차 신청이 없습니다.</p>
  }
  return (
    <div className={styles.tlWrap}>
      <div className={styles.tlRuler}>
        {HOURS.filter(h => h % 3 === 0).map(h => (
          <span key={h} className={styles.tlRulerTick} style={{ left: `${(h / 24) * 100}%` }}>
            {String(h).padStart(2, '0')}시
          </span>
        ))}
      </div>
      <div className={styles.tlTrack}>
        {HOURS.map(h => (
          <div key={h} className={styles.tlGrid} style={{ left: `${(h / 24) * 100}%` }} />
        ))}
        {dispatches.map((d, i) => {
          const [startRatio, endRatio] = dayRatioRange(d, date)
          const left  = startRatio * 100
          const width = (endRatio - startRatio) * 100
          return (
            <div
              key={i}
              className={styles.tlBlock}
              style={{ left: `${left}%`, width: `${width}%`, background: STATUS_COLOR[d.status] }}
              title={`${d.start_time.slice(0,5)}~${d.end_time.slice(0,5)} ${d.purpose} (${STATUS_LABEL[d.status]})`}
            />
          )
        })}
      </div>
    </div>
  )
}

export default function VehicleRequestPage() {
  const [vehicles, setVehicles] = useState([])
  const [existingByDate, setExistingByDate] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    vehicle_id: '',
    requester_name: '',
    requester_phone: '',
    department: '',
    purpose: '',
    start_date: today,
    end_date: today,
    start_time: '09:00',
    end_time: '11:00',
    passenger_count: '',
    memo: '',
  })

  useEffect(() => {
    publicApi.vehicleList()
      .then(data => { setVehicles(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!form.vehicle_id || !form.start_date || !form.end_date || form.end_date < form.start_date) {
      setExistingByDate([])
      return
    }
    const dates = dateRange(form.start_date, form.end_date)
    let cancelled = false
    Promise.all(dates.map(date =>
      publicApi.vehicleDispatches(form.vehicle_id, date)
        .then(dispatches => ({ date, dispatches }))
        .catch(() => ({ date, dispatches: [] }))
    )).then(result => { if (!cancelled) setExistingByDate(result) })
    return () => { cancelled = true }
  }, [form.vehicle_id, form.start_date, form.end_date])

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const setStartDate = (v) => {
    setForm(prev => ({ ...prev, start_date: v, end_date: prev.end_date < v ? v : prev.end_date }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.vehicle_id) return setError('차량을 선택해주세요.')
    if (!form.requester_name.trim()) return setError('신청자 이름을 입력해주세요.')
    if (!form.requester_phone.trim()) return setError('연락처를 입력해주세요.')
    if (!form.purpose.trim()) return setError('사용 목적을 입력해주세요.')
    if (form.end_date < form.start_date) return setError('종료일은 시작일보다 빠를 수 없습니다.')
    if (form.start_date === form.end_date && form.start_time >= form.end_time) {
      return setError('종료 시간은 시작 시간보다 늦어야 합니다.')
    }

    setSubmitting(true)
    try {
      const { start_date, end_date, ...rest } = form
      await publicApi.vehicleRequest({
        ...rest,
        dispatch_date: start_date,
        end_date,
        passenger_count: form.passenger_count ? Number(form.passenger_count) : null,
      })
      setDone(true)
    } catch (err) {
      setError(err.message || '오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className={styles.wrap}><p className={styles.loadingText}>불러오는 중…</p></div>

  if (done) return (
    <div className={styles.wrap}>
      <div className={styles.doneCard}>
        <div className={styles.doneIcon}>✅</div>
        <h2 className={styles.doneTitle}>배차 신청 완료</h2>
        <p className={styles.doneDesc}>신청이 접수되었습니다.<br />담당자 확인 후 연락드리겠습니다.</p>
        <button className={styles.doneBtn} onClick={() => { setDone(false); setForm(prev => ({ ...prev, purpose: '', memo: '', passenger_count: '' })) }}>
          추가 신청하기
        </button>
      </div>
    </div>
  )

  const selectedVehicle = vehicles.find(v => String(v.id) === String(form.vehicle_id))

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>🚌 차량 배차 신청</h1>
        <p className={styles.subtitle}>마석교회 차량 사용 신청서</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>

        {/* 차량 선택 */}
        <div className={styles.field}>
          <label className={styles.label}>차량 선택 <span className={styles.required}>*</span></label>
          <select
            className={styles.select}
            value={form.vehicle_id}
            onChange={e => set('vehicle_id', e.target.value)}
          >
            <option value=''>— 차량을 선택하세요 —</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.plate}){v.capacity ? ` · 최대 ${v.capacity}인` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 날짜 */}
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>시작일 <span className={styles.required}>*</span></label>
            <input
              type='date'
              className={styles.input}
              value={form.start_date}
              min={today}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>종료일 <span className={styles.required}>*</span></label>
            <input
              type='date'
              className={styles.input}
              value={form.end_date}
              min={form.start_date}
              onChange={e => set('end_date', e.target.value)}
            />
          </div>
        </div>

        {/* 기존 배차 현황 — 일자별 막대그래프 */}
        {form.vehicle_id && form.start_date && form.end_date && form.end_date >= form.start_date && (
          <div className={styles.timeline}>
            <div className={styles.timelineTitle}>
              {form.start_date === form.end_date ? form.start_date : `${form.start_date} ~ ${form.end_date}`} 배차 현황
              {selectedVehicle && <span className={styles.timelineVehicle}> — {selectedVehicle.name}</span>}
            </div>
            <div className={styles.tlDayList}>
              {existingByDate.map(({ date, dispatches }) => (
                <div key={date} className={styles.tlDayRow}>
                  {form.start_date !== form.end_date && (
                    <div className={styles.tlDayLabel}>
                      {dayjs(date).format('M/D')} ({WEEKDAYS_KO[dayjs(date).day()]})
                    </div>
                  )}
                  <DispatchBarGraph dispatches={dispatches} date={date} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 시간 */}
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>시작 시간 <span className={styles.required}>*</span></label>
            <input type='time' step={600} className={styles.input} value={form.start_time} onChange={e => set('start_time', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>종료 시간 <span className={styles.required}>*</span></label>
            <input type='time' step={600} className={styles.input} value={form.end_time} onChange={e => set('end_time', e.target.value)} />
          </div>
        </div>

        {/* 신청자 */}
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>신청자 이름 <span className={styles.required}>*</span></label>
            <input
              type='text'
              className={styles.input}
              placeholder='홍길동'
              value={form.requester_name}
              onChange={e => set('requester_name', e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>연락처 <span className={styles.required}>*</span></label>
            <input
              type='tel'
              className={styles.input}
              placeholder='010-0000-0000'
              maxLength={13}
              value={form.requester_phone}
              onChange={e => set('requester_phone', formatPhone(e.target.value))}
            />
          </div>
        </div>

        {/* 부서/모임 */}
        <div className={styles.field}>
          <label className={styles.label}>신청 부서 · 모임</label>
          <input
            type='text'
            className={styles.input}
            placeholder='예) 청년부, 유년주일학교, 구역 2구역 등'
            value={form.department}
            onChange={e => set('department', e.target.value)}
          />
        </div>

        {/* 목적 */}
        <div className={styles.field}>
          <label className={styles.label}>사용 목적 <span className={styles.required}>*</span></label>
          <input
            type='text'
            className={styles.input}
            placeholder='예) 수련회 짐 운반, 어르신 병원 이동 등'
            value={form.purpose}
            onChange={e => set('purpose', e.target.value)}
          />
        </div>

        {/* 탑승 인원 */}
        <div className={styles.field}>
          <label className={styles.label}>탑승 예정 인원</label>
          <input
            type='number'
            className={styles.input}
            min={1}
            max={selectedVehicle?.capacity || 99}
            placeholder='명'
            value={form.passenger_count}
            onChange={e => set('passenger_count', e.target.value)}
          />
        </div>

        {/* 메모 */}
        <div className={styles.field}>
          <label className={styles.label}>기타 메모</label>
          <textarea
            className={styles.textarea}
            rows={3}
            placeholder='특이사항이 있으면 입력해주세요.'
            value={form.memo}
            onChange={e => set('memo', e.target.value)}
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type='submit' className={styles.submitBtn} disabled={submitting}>
          {submitting ? '신청 중…' : '배차 신청하기'}
        </button>
      </form>
    </div>
  )
}
