import { useEffect, useState, useCallback } from 'react'
import { vehicles as vehiclesApi } from '../../api'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'
import styles from './VehicleDispatchPage.module.css'

const STATUS_LABEL = { pending: '검토중', approved: '승인', rejected: '거절' }
const STATUS_COLOR = { pending: '#f59e0b', approved: '#10b981', rejected: '#94a3b8' }
const STATUS_BG    = { pending: '#fffbeb', approved: '#f0fdf4', rejected: '#f8fafc' }

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

function TimelineGrid({ dispatches, date }) {
  if (!dispatches.length) {
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
        {dispatches.map(d => {
          const [startRatio, endRatio] = dayRatioRange(d, date)
          const left  = startRatio * 100
          const width = (endRatio - startRatio) * 100
          return (
            <div
              key={d.id}
              className={styles.tlBlock}
              style={{ left: `${left}%`, width: `${width}%`, background: STATUS_BG[d.status], borderColor: STATUS_COLOR[d.status] }}
              title={`${d.start_time.slice(0,5)}~${d.end_time.slice(0,5)} ${d.requester_name} (${d.purpose})`}
            >
              <span className={styles.tlBlockText}>
                {d.start_time.slice(0,5)}~{d.end_time.slice(0,5)} {d.requester_name}
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

  const PUBLIC_URL = `${window.location.origin}/vehicle-request`

  const loadVehicles = useCallback(() => {
    vehiclesApi.list().then(r => {
      setVehicleList(r.data)
      if (!selVehicle && r.data.length) setSelVehicle(String(r.data[0].id))
    }).catch(() => {})
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

  const handleStatus = async (id, status, reason) => {
    try {
      await vehiclesApi.updateDispatch(id, { status, rejected_reason: reason || null })
      toast.success(status === 'approved' ? '승인되었습니다.' : '거절되었습니다.')
      loadDispatches()
    } catch { toast.error('처리 실패') }
  }

  const handleDelete = async (id) => {
    if (!confirm('배차 신청을 삭제하시겠습니까?')) return
    try {
      await vehiclesApi.deleteDispatch(id)
      toast.success('삭제되었습니다.')
      loadDispatches()
    } catch { toast.error('삭제 실패') }
  }

  const handleAddVehicle = async (data) => {
    try {
      await vehiclesApi.create(data)
      toast.success('차량이 등록되었습니다.')
      setShowVehicleModal(false)
      loadVehicles()
    } catch { toast.error('등록 실패') }
  }

  const timelineDispatches = dispatches

  const copyLink = () => {
    navigator.clipboard.writeText(PUBLIC_URL).then(() => toast.success('링크가 복사되었습니다.'))
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>🚌 차량배차관리</h1>
        <div className={styles.headerActions}>
          <button className={styles.linkBtn} onClick={copyLink} title='배차 신청 링크 복사'>
            🔗 신청 링크 복사
          </button>
          <a className={styles.linkBtn} href='/vehicle-request' target='_blank' rel='noopener noreferrer'>
            ↗ 신청 페이지 열기
          </a>
          <button className={styles.addVehicleBtn} onClick={() => setShowVehicleModal(true)}>
            + 차량 등록
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'timeline' ? styles.tabActive : ''}`} onClick={() => setTab('timeline')}>
          📊 배차 현황 타임라인
        </button>
        <button className={`${styles.tab} ${tab === 'list' ? styles.tabActive : ''}`} onClick={() => setTab('list')}>
          📋 신청 목록
        </button>
      </div>

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
            <TimelineGrid dispatches={timelineDispatches} date={selDate} />
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
    </div>
  )
}
