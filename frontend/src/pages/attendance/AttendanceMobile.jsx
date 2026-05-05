import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { attendance as api, members as membersApi } from '../../api'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import { Toaster } from 'react-hot-toast'
import styles from './AttendanceMobile.module.css'

export default function AttendanceMobile() {
  const navigate = useNavigate()
  const [services,    setServices]    = useState([])
  const [serviceId,   setServiceId]   = useState('')
  const [date,        setDate]        = useState(dayjs().format('YYYY-MM-DD'))
  const [allMembers,  setAllMembers]  = useState([])
  const [checked,     setChecked]     = useState(new Set())
  const [existing,    setExisting]    = useState([])   // already saved attendance records
  const [saving,      setSaving]      = useState(false)
  const [search,      setSearch]      = useState('')

  // 서비스 목록 로드
  useEffect(() => {
    api.services().then(r => {
      const list = r.data || []
      setServices(list)
      if (list.length > 0) setServiceId(String(list[0].id))
    }).catch(() => {})
    membersApi.list({ limit: 9999 }).then(r => {
      setAllMembers(r.data?.members || r.data || [])
    }).catch(() => {})
  }, [])

  // 기존 출석 로드
  const loadExisting = useCallback(() => {
    if (!serviceId || !date) return
    api.list({ service_id: serviceId, date })
      .then(r => {
        const rows = r.data || []
        setExisting(rows)
        setChecked(new Set(rows.map(a => a.member_id)))
      })
      .catch(() => {})
  }, [serviceId, date])

  useEffect(() => { loadExisting() }, [loadExisting])

  // 지난주 불러오기
  const copyLastWeek = async () => {
    if (!serviceId) return
    const lastWeek = dayjs(date).subtract(7, 'day').format('YYYY-MM-DD')
    try {
      const r = await api.list({ service_id: serviceId, date: lastWeek })
      const ids = new Set((r.data || []).map(a => a.member_id))
      if (ids.size === 0) { toast('지난주 출석 데이터가 없습니다.'); return }
      setChecked(ids)
      toast.success(`지난주 ${ids.size}명 불러왔습니다.`)
    } catch {
      toast.error('불러오기 실패')
    }
  }

  // 전체 선택 / 해제
  const toggleAll = () => {
    if (checked.size === filtered.length) setChecked(new Set())
    else setChecked(new Set(filtered.map(m => m.id)))
  }

  // 저장
  const save = async () => {
    if (!serviceId) { toast.error('예배를 선택하세요.'); return }
    setSaving(true)
    try {
      // 기존 체크 해제된 항목 삭제
      const toDelete = existing.filter(a => !checked.has(a.member_id))
      await Promise.all(toDelete.map(a => api.remove(a.id)))

      // 새로 체크된 항목 추가
      const existingIds = new Set(existing.map(a => a.member_id))
      const toAdd = [...checked].filter(id => !existingIds.has(id))
      await Promise.all(toAdd.map(id => api.add({ member_id: id, service_id: Number(serviceId), date })))

      toast.success(`저장 완료 (${checked.size}명)`)
      loadExisting()
    } catch {
      toast.error('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const toggle = (id) => {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filtered = allMembers.filter(m =>
    !search || m.name.includes(search)
  )

  const selectedService = services.find(s => String(s.id) === serviceId)

  return (
    <div className={styles.page}>
      <Toaster position="top-center" />

      {/* ── 헤더 ── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/attendance')}>←</button>
        <span className={styles.headerTitle}>모바일 출결</span>
      </div>

      {/* ── 컨트롤 바 ── */}
      <div className={styles.controls}>
        <select className={styles.select} value={serviceId}
          onChange={e => setServiceId(e.target.value)}>
          <option value="">예배 선택</option>
          {services.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <input type="date" className={styles.datePicker} value={date}
          onChange={e => setDate(e.target.value)} />
      </div>

      {/* ── 액션 바 ── */}
      <div className={styles.actionBar}>
        <span className={styles.countBadge}>{checked.size}명 선택</span>
        <button className={styles.actionBtn} onClick={copyLastWeek}>📅 지난주</button>
        <button className={styles.actionBtn} onClick={toggleAll}>
          {checked.size === filtered.length ? '전체해제' : '전체선택'}
        </button>
      </div>

      {/* ── 검색 ── */}
      <div className={styles.searchWrap}>
        <input className={styles.search} placeholder="이름 검색…" value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>

      {/* ── 성도 그리드 ── */}
      <div className={styles.grid}>
        {filtered.map(m => {
          const on = checked.has(m.id)
          return (
            <button key={m.id}
              className={`${styles.memberTile} ${on ? styles.memberTileOn : ''}`}
              onClick={() => toggle(m.id)}
            >
              {m.photo_url
                ? <img src={m.photo_url} alt={m.name} className={styles.tileImg} />
                : <div className={styles.tileAvatar}
                    style={{ background: on ? '#3b82f6' : '#e2e8f0' }}>
                    <span style={{ color: on ? '#fff' : '#64748b', fontWeight: 700, fontSize: '1.1rem' }}>
                      {m.name[0]}
                    </span>
                  </div>
              }
              <span className={styles.tileName}>{m.name}</span>
              {on && <span className={styles.tileCheck}>✓</span>}
            </button>
          )
        })}
      </div>

      {/* ── 저장 플로팅 버튼 ── */}
      <button className={styles.saveBtn} onClick={save} disabled={saving}>
        {saving ? '저장 중…' : `저장 (${checked.size}명)`}
      </button>
    </div>
  )
}
