import { useEffect, useState, useCallback } from 'react'
import { vehicles as vehiclesApi } from '../../api'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'
import PageShell from '../../components/PageShell'
import styles from './VehicleDispatchPage.module.css'
import DeleteGuardModal from '../../components/DeleteGuardModal'
import { useDeleteGuard } from '../../hooks/useDeleteGuard'

const STATUS_LABEL = { pending: '검토중', approved: '승인', rejected: '거절' }
const STATUS_COLOR = { pending: '#f59e0b', approved: '#10b981', rejected: '#94a3b8' }
const STATUS_BG    = { pending: '#fffbeb', approved: '#f0fdf4', rejected: '#f8fafc' }

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const RECUR_TYPE_LABELS = { daily: '매일', weekly: '매주', monthly: '매월' }

function recurringLabel(r) {
  if (r.recurrence_type === 'daily') return '매일'
  if (r.recurrence_type === 'weekly') return `매주 ${DOW_LABELS[r.day_of_week]}요일`
  return `매월 ${r.day_of_month}일`
}

// 선택된 날짜에 해당 고정배차가 적용되는지 확인
function recurringAppliesOn(r, date) {
  const d = dayjs(date)
  if (r.recurrence_type === 'daily') return true
  if (r.recurrence_type === 'weekly') return d.day() === r.day_of_week
  if (r.recurrence_type === 'monthly') return d.date() === r.day_of_month
  return false
}

// ── 타임라인 그리드 (0~24시) ─────────────────────────────────────
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function timeToRatio(t) {
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return (h * 60 + m) / (24 * 60)
}

// 다중일(시작일~종료일) 배차의 경우, 표시 중인 날짜(date) 기준으로
// 그 날에 해당하는 구간만 잘라서 막대의 시작·끝 비율을 계산한다.
function dayRatioRange(d, date) {
  const startsBefore = d.dispatch_date && d.dispatch_date.slice(0, 10) < date
  const endsAfter    = d.end_date && d.end_date.slice(0, 10) > date
  return [
    startsBefore ? 0 : timeToRatio(d.start_time),
    endsAfter    ? 1 : timeToRatio(d.end_time),
  ]
}

function TimelineGrid({ dispatches, date, recurringSchedules = [] }) {
  const todaysRecurring = recurringSchedules.filter(r => recurringAppliesOn(r, date))

  if (!dispatches.length && !todaysRecurring.length) {
    return <p className={styles.timelineEmpty}>해당 날짜·차량에 배차 신청이 없습니다.</p>
  }
  return (
    <div className={styles.tlWrap}>
      {/* 시간 눈금 */}
      <div className={styles.tlRuler}>
        {HOURS.filter(h => h % 3 === 0).map(h => (
          <span key={h} className={styles.tlRulerTick} style={{ left: `${(h / 24) * 100}%` }}>
            {String(h).padStart(2, '0')}시
          </span>
        ))}
      </div>
      {/* 배차 블록 */}
      <div className={styles.tlTrack}>
        {/* 배경 격자 */}
        {HOURS.map(h => (
          <div key={h} className={styles.tlGrid} style={{ left: `${(h / 24) * 100}%` }} />
        ))}
        {/* 고정배차(반복 운행) — 점선 테두리로 실제 신청과 구분 */}
        {todaysRecurring.map(r => {
          const left  = timeToRatio(r.start_time) * 100
          const width = (timeToRatio(r.end_time) - timeToRatio(r.start_time)) * 100
          return (
            <div
              key={`recur-${r.id}`}
              className={styles.tlBlockRecurring}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`고정배차 · ${r.title} (${recurringLabel(r)}) · ${r.start_time.slice(0,5)}~${r.end_time.slice(0,5)}`}
            >
              <span className={styles.tlBlockText}>🔁 {r.title}</span>
            </div>
          )
        })}
        {dispatches.map(d => {
          const [startRatio, endRatio] = dayRatioRange(d, date)
          const left  = startRatio * 100
          const width = (endRatio - startRatio) * 100
          return (
            <div
              key={d.id}
              className={styles.tlBlock}
              style={{ left: `${left}%`, width: `${width}%`, background: STATUS_BG[d.status], borderColor: STATUS_COLOR[d.status] }}
              title={`${STATUS_LABEL[d.status]}${d.department ? ' · ' + d.department : ''} · ${d.start_time.slice(0,5)}~${d.end_time.slice(0,5)} ${d.requester_name} (${d.purpose})`}
            >
              <span className={styles.tlBlockText}>
                <strong style={{ color: STATUS_COLOR[d.status] }}>{STATUS_LABEL[d.status]}</strong>
                {d.department && <> · {d.department}</>} · {d.start_time.slice(0,5)}~{d.end_time.slice(0,5)} {d.requester_name}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 거절 사유 모달 ────────────────────────────────────────────────
function RejectModal({ dispatch, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  return (
    <div className={styles.modalBack} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>거절 사유 입력</h3>
        <p className={styles.modalDesc}>{dispatch.requester_name} · {dispatch.purpose}</p>
        <textarea
          className={styles.modalTextarea}
          rows={3}
          placeholder='거절 사유를 입력하세요 (선택)'
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <div className={styles.modalBtns}>
          <button className={styles.modalCancel} onClick={onClose}>취소</button>
          <button className={styles.modalConfirm} onClick={() => onConfirm(reason)}>거절 확정</button>
        </div>
      </div>
    </div>
  )
}

// ── 차량 등록 모달 ────────────────────────────────────────────────
function VehicleModal({ onSave, onClose }) {
  const [form, setForm] = useState({ name: '', plate: '', capacity: '', manager_phone: '' })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const handleSave = async () => {
    if (!form.name || !form.plate) return toast.error('차량명과 번호판은 필수입니다.')
    await onSave({ ...form, capacity: form.capacity ? Number(form.capacity) : null })
  }
  return (
    <div className={styles.modalBack} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>차량 등록</h3>
        <div className={styles.modalFields}>
          <input className={styles.modalInput} placeholder='차량명 *' value={form.name} onChange={e => set('name', e.target.value)} />
          <input className={styles.modalInput} placeholder='번호판 * (예: 12가 3456)' value={form.plate} onChange={e => set('plate', e.target.value)} />
          <input className={styles.modalInput} placeholder='최대 정원 (명)' type='number' value={form.capacity} onChange={e => set('capacity', e.target.value)} />
          <input className={styles.modalInput} placeholder='담당자 연락처' value={form.manager_phone} onChange={e => set('manager_phone', e.target.value)} />
        </div>
        <div className={styles.modalBtns}>
          <button className={styles.modalCancel} onClick={onClose}>취소</button>
          <button className={styles.modalConfirm} onClick={handleSave}>등록</button>
        </div>
      </div>
    </div>
  )
}

// ── 고정배차(반복 운행) 등록 모달 ───────────────────────────────────
function RecurringModal({ onSave, onClose }) {
  const [form, setForm] = useState({
    title: '', recurrence_type: 'weekly', day_of_week: 0, day_of_month: 1,
    start_time: '09:00', end_time: '11:00',
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const handleSave = async () => {
    if (!form.title.trim()) return toast.error('운행목적을 입력해주세요.')
    if (form.start_time >= form.end_time) return toast.error('종료 시간은 시작 시간보다 늦어야 합니다.')
    await onSave({
      title: form.title.trim(),
      recurrence_type: form.recurrence_type,
      day_of_week: form.recurrence_type === 'weekly' ? Number(form.day_of_week) : null,
      day_of_month: form.recurrence_type === 'monthly' ? Number(form.day_of_month) : null,
      start_time: form.start_time,
      end_time: form.end_time,
    })
  }
  return (
    <div className={styles.modalBack} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>고정배차 등록</h3>
        <div className={styles.modalFields}>
          <input className={styles.modalInput} placeholder='운행목적 * (예: 주일예배운행, 금요철야운행)'
            value={form.title} onChange={e => set('title', e.target.value)} />
          <select className={styles.modalInput} value={form.recurrence_type} onChange={e => set('recurrence_type', e.target.value)}>
            <option value='daily'>매일</option>
            <option value='weekly'>매주</option>
            <option value='monthly'>매월</option>
          </select>
          {form.recurrence_type === 'weekly' && (
            <select className={styles.modalInput} value={form.day_of_week} onChange={e => set('day_of_week', e.target.value)}>
              {DOW_LABELS.map((label, i) => <option key={i} value={i}>{label}요일</option>)}
            </select>
          )}
          {form.recurrence_type === 'monthly' && (
            <select className={styles.modalInput} value={form.day_of_month} onChange={e => set('day_of_month', e.target.value)}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}일</option>)}
            </select>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className={styles.modalInput} type='time' value={form.start_time} onChange={e => set('start_time', e.target.value)} />
            <span>~</span>
            <input className={styles.modalInput} type='time' value={form.end_time} onChange={e => set('end_time', e.target.value)} />
          </div>
        </div>
        <div className={styles.modalBtns}>
          <button className={styles.modalCancel} onClick={onClose}>취소</button>
          <button className={styles.modalConfirm} onClick={handleSave}>등록</button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────
export default function VehicleDispatchPage() {
  const [tab, setTab] = useState('timeline')
  const [vehicleList, setVehicleList] = useState([])
  const [dispatches, setDispatches] = useState([])
  const [selVehicle, setSelVehicle] = useState('')
  const [selDate, setSelDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [listFilter, setListFilter] = useState({ status: '', from: dayjs().format('YYYY-MM-DD'), to: '' })
  const [rejectTarget, setRejectTarget] = useState(null)
  const [showVehicleModal, setShowVehicleModal] = useState(false)
  const [recurringList, setRecurringList] = useState([])
  const [showRecurringModal, setShowRecurringModal] = useState(false)

  const PUBLIC_URL = `${window.location.origin}/vehicle-request`

  const loadVehicles = useCallback(() => {
    vehiclesApi.list().then(r => {
      setVehicleList(r.data)
      if (!selVehicle && r.data.length) setSelVehicle(String(r.data[0].id))
    }).catch(() => {})
  }, [selVehicle])

  const loadRecurring = useCallback(() => {
    if (!selVehicle) { setRecurringList([]); return }
    vehiclesApi.recurringSchedules(selVehicle).then(r => setRecurringList(r.data)).catch(() => {})
  }, [selVehicle])

  const loadDispatches = useCallback(() => {
    if (tab === 'timeline') {
      if (!selVehicle || !selDate) return
      vehiclesApi.dispatches({ vehicle_id: selVehicle, date: selDate })
        .then(r => setDispatches(r.data))
        .catch(() => {})
    } else {
      const params = { from: listFilter.from || undefined, to: listFilter.to || undefined, status: listFilter.status || undefined }
      vehiclesApi.dispatches(params).then(r => setDispatches(r.data)).catch(() => {})
    }
  }, [tab, selVehicle, selDate, listFilter])

  useEffect(() => { loadVehicles() }, [])
  useEffect(() => { loadDispatches() }, [loadDispatches])
  useEffect(() => { loadRecurring() }, [loadRecurring])

  const handleStatus = async (id, status, reason) => {
    try {
      await vehiclesApi.updateDispatch(id, { status, rejected_reason: reason || null })
      toast.success(status === 'approved' ? '승인되었습니다.' : '거절되었습니다.')
      loadDispatches()
    } catch { toast.error('처리 실패') }
  }

  const deleteGuard = useDeleteGuard()
  const handleDelete = (id) => {
    deleteGuard.request(async () => {
      try {
        await vehiclesApi.deleteDispatch(id)
        toast.success('삭제되었습니다.')
        loadDispatches()
      } catch { toast.error('삭제 실패') }
    })
  }

  const handleAddVehicle = async (data) => {
    try {
      await vehiclesApi.create(data)
      toast.success('차량이 등록되었습니다.')
      setShowVehicleModal(false)
      loadVehicles()
    } catch { toast.error('등록 실패') }
  }

  const handleAddRecurring = async (data) => {
    try {
      await vehiclesApi.createRecurringSchedule(selVehicle, data)
      toast.success('고정배차가 등록되었습니다.')
      setShowRecurringModal(false)
      loadRecurring()
    } catch { toast.error('등록 실패') }
  }

  const recurringDeleteGuard = useDeleteGuard()
  const handleDeleteRecurring = (id) => {
    recurringDeleteGuard.request(async () => {
      try {
        await vehiclesApi.deleteRecurringSchedule(id)
        toast.success('삭제되었습니다.')
        loadRecurring()
      } catch { toast.error('삭제 실패') }
    })
  }

  const timelineDispatches = dispatches

  const copyLink = () => {
    navigator.clipboard.writeText(PUBLIC_URL).then(() => toast.success('링크가 복사되었습니다.'))
  }

  return (
    <PageShell title="차량배차관리" actions={
      <>
        <button className={styles.linkBtn} onClick={copyLink} title='배차 신청 링크 복사'>
          🔗 신청 링크 복사
        </button>
        <a className={styles.linkBtn} href='/vehicle-request' target='_blank' rel='noopener noreferrer'>
          ↗ 신청 페이지 열기
        </a>
        <button className={styles.addVehicleBtn} onClick={() => setShowVehicleModal(true)}>
          + 차량 등록
        </button>
      </>
    }>
      {/* 상단 탭 — 출결관리·헌금관리와 동일한 천장 고정 형식 */}
      <div className={styles.tabRow}>
        <button className={`${styles.tabBtn} ${tab === 'timeline' ? styles.tabBtnActive : ''}`} onClick={() => setTab('timeline')}>
          📊 배차 현황 타임라인
        </button>
        <button className={`${styles.tabBtn} ${tab === 'list' ? styles.tabBtnActive : ''}`} onClick={() => setTab('list')}>
          📋 신청 목록
        </button>
        <button className={`${styles.tabBtn} ${tab === 'recurring' ? styles.tabBtnActive : ''}`} onClick={() => setTab('recurring')}>
          🔁 고정배차 설정
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className={styles.content}>
      {/* ── 타임라인 탭 ── */}
      {tab === 'timeline' && (
        <div className={styles.section}>
          <div className={styles.filterRow}>
            <input
              type='date'
              className={styles.filterInput}
              value={selDate}
              onChange={e => setSelDate(e.target.value)}
            />
            <select
              className={styles.filterSelect}
              value={selVehicle}
              onChange={e => setSelVehicle(e.target.value)}
            >
              <option value=''>— 차량 선택 —</option>
              {vehicleList.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.plate})</option>
              ))}
            </select>
          </div>
          <div className={styles.card}>
            <TimelineGrid dispatches={timelineDispatches} date={selDate} recurringSchedules={recurringList} />
          </div>

          {/* 해당 날짜·차량 신청 목록 미니 */}
          {timelineDispatches.length > 0 && (
            <div className={styles.miniList}>
              {timelineDispatches.map(d => (
                <div key={d.id} className={styles.miniItem} style={{ borderLeft: `4px solid ${STATUS_COLOR[d.status]}` }}>
                  <div className={styles.miniTop}>
                    <span className={styles.miniTime}>{d.start_time.slice(0,5)} ~ {d.end_time.slice(0,5)}</span>
                    <span className={styles.miniStatus} style={{ color: STATUS_COLOR[d.status] }}>{STATUS_LABEL[d.status]}</span>
                  </div>
                  <div className={styles.miniInfo}>
                    <strong>{d.requester_name}</strong>
                    {d.department && <span className={styles.miniDept}> · {d.department}</span>}
                    {d.requester_phone && <span className={styles.miniPhone}> · {d.requester_phone}</span>}
                  </div>
                  <div className={styles.miniPurpose}>{d.purpose}</div>
                  {d.passenger_count && <div className={styles.miniMeta}>탑승 {d.passenger_count}명</div>}
                  {d.status === 'pending' && (
                    <div className={styles.miniActions}>
                      <button className={styles.approveBtn} onClick={() => handleStatus(d.id, 'approved')}>승인</button>
                      <button className={styles.rejectBtn} onClick={() => setRejectTarget(d)}>거절</button>
                    </div>
                  )}
                  {d.status === 'rejected' && d.rejected_reason && (
                    <div className={styles.rejectedReason}>거절 사유: {d.rejected_reason}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 신청 목록 탭 ── */}
      {tab === 'list' && (
        <div className={styles.section}>
          <div className={styles.filterRow}>
            <input type='date' className={styles.filterInput} value={listFilter.from}
              onChange={e => setListFilter(p => ({ ...p, from: e.target.value }))} />
            <span className={styles.filterDash}>~</span>
            <input type='date' className={styles.filterInput} value={listFilter.to}
              onChange={e => setListFilter(p => ({ ...p, to: e.target.value }))} />
            <select className={styles.filterSelect} value={listFilter.status}
              onChange={e => setListFilter(p => ({ ...p, status: e.target.value }))}>
              <option value=''>전체 상태</option>
              <option value='pending'>검토중</option>
              <option value='approved'>승인</option>
              <option value='rejected'>거절</option>
            </select>
          </div>

          {dispatches.length === 0 ? (
            <div className={styles.card}><p className={styles.emptyText}>조건에 맞는 배차 신청이 없습니다.</p></div>
          ) : (
            <div className={styles.dispatchList}>
              {dispatches.map(d => (
                <div key={d.id} className={styles.dispatchItem} style={{ borderLeft: `4px solid ${STATUS_COLOR[d.status]}` }}>
                  <div className={styles.dispatchHeader}>
                    <div>
                      <span className={styles.dispatchDate}>{d.dispatch_date}</span>
                      <span className={styles.dispatchTimeRange}> {d.start_time.slice(0,5)}~{d.end_time.slice(0,5)}</span>
                      <span className={styles.dispatchVehicle}> · {d.vehicle_name} ({d.vehicle_plate})</span>
                    </div>
                    <span className={styles.dispatchStatus} style={{ color: STATUS_COLOR[d.status], background: STATUS_BG[d.status] }}>
                      {STATUS_LABEL[d.status]}
                    </span>
                  </div>
                  <div className={styles.dispatchBody}>
                    <div className={styles.dispatchRequester}>
                      <strong>{d.requester_name}</strong>
                      {d.department && <span> · {d.department}</span>}
                      {d.requester_phone && <span> · {d.requester_phone}</span>}
                    </div>
                    <div className={styles.dispatchPurpose}>{d.purpose}</div>
                    {d.passenger_count && <div className={styles.dispatchMeta}>탑승 {d.passenger_count}명</div>}
                    {d.memo && <div className={styles.dispatchMemo}>{d.memo}</div>}
                    {d.rejected_reason && <div className={styles.dispatchRejectReason}>거절 사유: {d.rejected_reason}</div>}
                  </div>
                  <div className={styles.dispatchActions}>
                    {d.status === 'pending' && <>
                      <button className={styles.approveBtn} onClick={() => handleStatus(d.id, 'approved')}>승인</button>
                      <button className={styles.rejectBtn} onClick={() => setRejectTarget(d)}>거절</button>
                    </>}
                    {d.status === 'rejected' && (
                      <button className={styles.approveBtn} onClick={() => handleStatus(d.id, 'approved')}>승인으로 변경</button>
                    )}
                    {d.status === 'approved' && (
                      <button className={styles.rejectBtn} onClick={() => setRejectTarget(d)}>거절로 변경</button>
                    )}
                    <button className={styles.deleteBtn} onClick={() => handleDelete(d.id)}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 고정배차 설정 탭 ── */}
      {tab === 'recurring' && (
        <div className={styles.section}>
          <div className={styles.filterRow}>
            <select
              className={styles.filterSelect}
              value={selVehicle}
              onChange={e => setSelVehicle(e.target.value)}
            >
              <option value=''>— 차량 선택 —</option>
              {vehicleList.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.plate})</option>
              ))}
            </select>
            <button className={styles.addVehicleBtn} onClick={() => setShowRecurringModal(true)} disabled={!selVehicle}>
              + 고정배차 등록
            </button>
          </div>

          {!selVehicle ? (
            <div className={styles.card}><p className={styles.emptyText}>차량을 먼저 선택해주세요.</p></div>
          ) : recurringList.length === 0 ? (
            <div className={styles.card}><p className={styles.emptyText}>등록된 고정배차 일정이 없습니다.</p></div>
          ) : (
            <div className={styles.dispatchList}>
              {recurringList.map(r => (
                <div key={r.id} className={styles.dispatchItem} style={{ borderLeft: '4px solid #94a3b8' }}>
                  <div className={styles.dispatchHeader}>
                    <div>
                      <span className={styles.dispatchDate}>🔁 {recurringLabel(r)}</span>
                      <span className={styles.dispatchTimeRange}> {r.start_time.slice(0,5)}~{r.end_time.slice(0,5)}</span>
                    </div>
                  </div>
                  <div className={styles.dispatchBody}>
                    <div className={styles.dispatchPurpose}>{r.title}</div>
                  </div>
                  <div className={styles.dispatchActions}>
                    <button className={styles.deleteBtn} onClick={() => handleDeleteRecurring(r.id)}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>

      {/* 모달들 */}
      {rejectTarget && (
        <RejectModal
          dispatch={rejectTarget}
          onConfirm={(reason) => { handleStatus(rejectTarget.id, 'rejected', reason); setRejectTarget(null) }}
          onClose={() => setRejectTarget(null)}
        />
      )}
      {showVehicleModal && (
        <VehicleModal onSave={handleAddVehicle} onClose={() => setShowVehicleModal(false)} />
      )}
      {showRecurringModal && (
        <RecurringModal onSave={handleAddRecurring} onClose={() => setShowRecurringModal(false)} />
      )}
      <DeleteGuardModal {...deleteGuard.modalProps} message="배차 신청을 삭제하시겠습니까?" />
      <DeleteGuardModal {...recurringDeleteGuard.modalProps} message="고정배차 일정을 삭제하시겠습니까?" />
    </PageShell>
  )
}
