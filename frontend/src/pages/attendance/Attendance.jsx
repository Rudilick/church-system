import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { attendance as api, members as memberApi, communities as communityApi, enumValues as enumApi } from '../../api'
import { genderColor } from '../../utils'
import { useAutocompleteKeyNav } from '../../hooks/useAutocompleteKeyNav'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import styles from './Attendance.module.css'
import WeekPicker, { toThisSunday, weekLabel } from '../../components/WeekPicker'

const shortName = s => s.name.replace('주일 ', '').replace(' 예배', '예배')

const GROUP_PALETTE = [
  '#3b82f6','#14b8a6','#6366f1','#f59e0b',
  '#8b5cf6','#10b981','#f97316','#06b6d4',
]
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff
  return Math.abs(h)
}
function groupGradient(name) {
  const hex = GROUP_PALETTE[hashStr(name) % GROUP_PALETTE.length]
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return `linear-gradient(135deg, rgba(${r},${g},${b},0.10) 0%, transparent 90%)`
}

function AttendTile({ a, onRemove }) {
  return (
    <div className={styles.attendeeTile}>
      <button className={styles.removeBtnTile} onClick={() => onRemove(a.id)}>×</button>
      {a.photo_url
        ? <img src={a.photo_url} alt={a.name} className={styles.tileThumb} />
        : <div className={styles.thumbPlaceholder}
               style={{ background: genderColor(a.gender) }}>
            {a.name[0]}
          </div>
      }
      {a.method === 'qr' && <span className={styles.tileMethodQr}>QR</span>}
      <span className={styles.attendeeName}>{a.name}</span>
      {a.position && <span className={styles.attendeePosition}>{a.position}</span>}
    </div>
  )
}

const SORT_LABELS = { name: '가나다순', age: '연령순', cell: '셀모임' }

function TileCheckView({ list, serviceId, date, onDone, schoolDepts, cells }) {
  const [allMembers, setAllMembers] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [sortMode, setSortMode] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [groupLevel, setGroupLevel] = useState(null)
  const [groupDir, setGroupDir] = useState('asc')

  useEffect(() => {
    memberApi.list({ limit: 999 }).then(r => {
      const attended = new Set(list.map(a => a.member_id))
      let members = (r.data.data || []).filter(m => !attended.has(m.id))
      if (schoolDepts?.length) {
        members = members.filter(m => schoolDepts.includes(m.school_department))
      }
      setAllMembers(members)
    })
  }, [list, schoolDepts])

  const toggle = id => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSortClick = mode => {
    if (sortMode !== mode) { setSortMode(mode); setSortDir('asc') }
    else if (sortDir === 'asc') setSortDir('desc')
    else { setSortMode(null); setSortDir('asc') }
  }

  const handleGroupClick = name => {
    if (groupLevel !== name) { setGroupLevel(name); setGroupDir('asc') }
    else if (groupDir === 'asc') setGroupDir('desc')
    else { setGroupLevel(null); setGroupDir('asc') }
  }

  const communityLevels = useMemo(() => {
    if (!cells?.length) return []
    const idToNode = Object.fromEntries(cells.map(c => [c.id, c]))
    const getDepth = c => {
      let depth = 0; let cur = c
      while (cur.parent_id != null) {
        const parent = idToNode[cur.parent_id]
        if (!parent) break
        depth++; cur = parent
      }
      return depth
    }
    const typeDepths = {}
    cells.forEach(c => {
      if (!c.type) return
      const d = getDepth(c)
      if (typeDepths[c.type] === undefined || d < typeDepths[c.type]) typeDepths[c.type] = d
    })
    return Object.entries(typeDepths)
      .sort((a, b) => a[1] - b[1])
      .map(([type, depth]) => ({ name: type, depth }))
  }, [cells])

  const { sortedGroups, ungrouped, sortedAll } = useMemo(() => {
    const sortMembers = arr => {
      const s = [...arr]
      const key = sortMode ?? 'name'
      if (key === 'name') s.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      else s.sort((a, b) => (a.birth_date ?? '9999').localeCompare(b.birth_date ?? '9999'))
      const dir = sortMode !== null ? sortDir : 'asc'
      return dir === 'asc' ? s : [...s].reverse()
    }

    if (groupLevel === null) {
      return { sortedGroups: [], ungrouped: [], sortedAll: sortMembers(allMembers) }
    }

    const idToCell = Object.fromEntries((cells ?? []).map(c => [c.id, c]))
    const commByKey = Object.fromEntries((cells ?? []).map(c => [`${c.name}||${c.type}`, c]))

    const findGroup = comms => {
      for (const comm of comms) {
        if (comm.type === groupLevel) return `${comm.name}${comm.type}`
        const node = commByKey[`${comm.name}||${comm.type}`]
        if (!node) continue
        let cur = node
        while (cur.parent_id != null) {
          const parent = idToCell[cur.parent_id]
          if (!parent) break
          if (parent.type === groupLevel) return `${parent.name}${parent.type}`
          cur = parent
        }
      }
      return null
    }

    const groups = {}
    const ung = []
    allMembers.forEach(m => {
      const comms = Array.isArray(m.communities) ? m.communities : []
      const groupName = findGroup(comms)
      if (groupName) (groups[groupName] ??= []).push(m)
      else ung.push(m)
    })

    const sorted = Object.keys(groups)
      .sort((a, b) => a.localeCompare(b, 'ko'))
      .map(name => ({ name, members: sortMembers(groups[name]) }))

    return {
      sortedGroups: groupDir === 'asc' ? sorted : [...sorted].reverse(),
      ungrouped: sortMembers(ung),
      sortedAll: null
    }
  }, [allMembers, groupLevel, sortMode, sortDir, groupDir, cells])

  const handleSave = async () => {
    setSaving(true)
    let count = 0
    for (const id of selectedIds) {
      try {
        await api.add({ member_id: id, service_id: serviceId, date })
        count++
      } catch {}
    }
    toast.success(`${count}명 출석 추가됨`)
    onDone()
  }

  const MemberTile = ({ m }) => (
    <div
      className={`${styles.tileMember} ${selectedIds.has(m.id) ? styles.tileMemberSelected : ''}`}
      onClick={() => toggle(m.id)}
    >
      {selectedIds.has(m.id) && <span className={styles.tileCheckMark}>✓</span>}
      {m.photo_url
        ? <img src={m.photo_url} alt={m.name} className={styles.tileMemberImg} />
        : <div className={styles.tileMemberAvatar} style={{ background: genderColor(m.gender) }}>{m.name[0]}</div>
      }
      <span className={styles.tileMemberName}>{m.name}</span>
      {m.position && <span className={styles.tileMemberPosition}>{m.position}</span>}
    </div>
  )

  return (
    <div className={styles.tileView}>
      <div className={styles.tileViewHeader}>
        <span className={styles.tileViewTitle}>
          일괄선택입력
          {selectedIds.size > 0 && (
            <span className={styles.tileViewCount}>{selectedIds.size}명 선택됨</span>
          )}
        </span>
        <button className={styles.tileViewClose} onClick={onDone}>✕ 취소</button>
      </div>
      <div className={styles.typeChipRow}>
        <button
          className={`${styles.typeChip} ${sortMode === 'name' ? styles.typeChipActive : ''}`}
          onClick={() => handleSortClick('name')}
        >
          가나다{sortMode === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </button>
        <button
          className={`${styles.typeChip} ${sortMode === 'age' ? styles.typeChipActive : ''}`}
          onClick={() => handleSortClick('age')}
        >
          나이{sortMode === 'age' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </button>
        {communityLevels.length > 0 && <div className={styles.chipDivider} />}
        {communityLevels.map(lvl => (
          <button
            key={lvl.name}
            className={`${styles.typeChip} ${groupLevel === lvl.name ? styles.typeChipActive : ''}`}
            onClick={() => handleGroupClick(lvl.name)}
          >
            {lvl.name}{groupLevel === lvl.name ? (groupDir === 'asc' ? '↑' : '↓') : ''}
          </button>
        ))}
      </div>
      {sortedAll ? (
        <div className={styles.tileGrid}>
          {sortedAll.map(m => <MemberTile key={m.id} m={m} />)}
          {sortedAll.length === 0 && (
            <div className={styles.tileEmpty}>미출석 교인이 없습니다.</div>
          )}
        </div>
      ) : (
        <div className={styles.cellGroupsScroll}>
          {sortedGroups.map(({ name, members }) => (
            <div key={name} className={styles.cellSortGroup} style={{ background: groupGradient(name), borderRadius: 8 }}>
              <div className={styles.cellSortLabel}>{name}</div>
              <div className={styles.tileGridInline}>
                {members.map(m => <MemberTile key={m.id} m={m} />)}
              </div>
            </div>
          ))}
          {ungrouped.length > 0 && (
            <div className={styles.cellSortGroup}>
              <div className={styles.cellSortLabel}>(미분류)</div>
              <div className={styles.tileGridInline}>
                {ungrouped.map(m => <MemberTile key={m.id} m={m} />)}
              </div>
            </div>
          )}
        </div>
      )}
      {selectedIds.size > 0 && (
        <div className={styles.tileSaveBar}>
          <button className={styles.tileSaveBtn} onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : `${selectedIds.size}명 출석 추가`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── 예배설정 모달 ─────────────────────────────────────────────
function ServiceSettingsModal({ onClose, onSaved }) {
  const [services, setServices]         = useState([])
  const [memberTypes, setMemberTypes]   = useState([])
  const [schoolDepts, setSchoolDepts]   = useState([])
  const [editSvc, setEditSvc]           = useState(null)

  useEffect(() => {
    api.services().then(r => setServices(r.data)).catch(() => {})
    enumApi.list('membership_category').then(r => setMemberTypes(r.data || [])).catch(() => {})
    enumApi.list('school_department').then(r => setSchoolDepts(r.data || [])).catch(() => {})
  }, [])

  const reloadAll = async () => {
    const svcs = await api.services()
    setServices(svcs.data)
    onSaved?.()
  }

  const saveSvc = async () => {
    if (!editSvc?.name?.trim()) { toast.error('예배 이름을 입력하세요.'); return }
    try {
      const payload = {
        name: editSvc.name,
        target_types: editSvc.target_types || [],
        target_school_depts: editSvc.target_school_depts || [],
      }
      if (editSvc.id) {
        await api.updateService(editSvc.id, payload)
      } else {
        await api.addService(payload)
      }
      toast.success('저장됐습니다.')
      setEditSvc(null)
      reloadAll()
    } catch { toast.error('저장 실패') }
  }

  const deleteSvc = async (id) => {
    if (!confirm('예배를 비활성화 하시겠습니까?')) return
    await api.removeService(id).catch(() => toast.error('삭제 실패'))
    toast.success('비활성화됐습니다.')
    reloadAll()
  }

  const toggleTargetType = (val) => {
    setEditSvc(s => {
      const arr = s.target_types || []
      const next = arr.includes(val) ? arr.filter(t => t !== val) : [...arr, val]
      return { ...s, target_types: next }
    })
  }

  const toggleSchoolDept = (val) => {
    setEditSvc(s => {
      const arr = s.target_school_depts || []
      const next = arr.includes(val) ? arr.filter(d => d !== val) : [...arr, val]
      return { ...s, target_school_depts: next }
    })
  }

  const hasSchoolTarget = (editSvc?.target_types || []).includes('교회학교')

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          ⚙️ 예배 설정
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {services.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#f8fafc', borderRadius: 8 }}>
                <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600 }}>{s.name}</span>
                <button style={{ fontSize: '0.78rem', padding: '3px 10px', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' }}
                  onClick={() => setEditSvc({ id: s.id, name: s.name, target_types: s.target_types || [], target_school_depts: s.target_school_depts || [] })}>수정</button>
                <button style={{ fontSize: '0.78rem', padding: '3px 10px', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', background: '#fff', color: '#ef4444', fontFamily: 'inherit' }}
                  onClick={() => deleteSvc(s.id)}>비활성화</button>
              </div>
            ))}
            {editSvc ? (
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                <input value={editSvc.name} onChange={e => setEditSvc(s => ({ ...s, name: e.target.value }))}
                  className={styles.formInput} placeholder="예배 이름 *" />
                {memberTypes.length > 0 && (
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginBottom: 6 }}>예배 참석 대상 (비워두면 전체)</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {memberTypes.map(t => (
                        <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', cursor: 'pointer' }}>
                          <input type="checkbox"
                            checked={(editSvc.target_types || []).includes(t.value)}
                            onChange={() => toggleTargetType(t.value)} />
                          {t.value}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {hasSchoolTarget && schoolDepts.length > 0 && (
                  <div style={{ paddingLeft: 12, borderLeft: '3px solid #a5b4fc' }}>
                    <label style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginBottom: 6 }}>교회학교 부서 선택 (비워두면 전체)</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {schoolDepts.map(d => (
                        <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', cursor: 'pointer' }}>
                          <input type="checkbox"
                            checked={(editSvc.target_school_depts || []).includes(d.value)}
                            onChange={() => toggleSchoolDept(d.value)} />
                          {d.value}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className={styles.cancelBtn} onClick={() => setEditSvc(null)}>취소</button>
                  <button className={styles.saveBtn} onClick={saveSvc}>저장</button>
                </div>
              </div>
            ) : (
              <button style={{ alignSelf: 'flex-start', padding: '6px 14px', border: '1px dashed #93c5fd', borderRadius: 8, background: '#eff6ff', color: '#2563eb', cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'inherit' }}
                onClick={() => setEditSvc({ name: '', target_types: [], target_school_depts: [] })}>+ 예배 추가</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Attendance() {
  const [services, setServices]         = useState([])
  const [serviceId, setServiceId]       = useState(null)
  const [date, setDate]                 = useState(toThisSunday)
  const [showPicker, setShowPicker]     = useState(false)
  const [list, setList]                 = useState([])
  const [lastWeekInfo, setLastWeekInfo] = useState(null)
  const [copying, setCopying]           = useState(false)
  const [confirmCopy, setConfirmCopy]   = useState(false)
  const [tileMode, setTileMode]         = useState(false)
  const [cells, setCells]               = useState([])
  const [search, setSearch]             = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showDrop, setShowDrop]         = useState(false)
  const [showServiceSettings, setShowServiceSettings] = useState(false)
  const [groupLevel, setGroupLevel]     = useState(null)
  const [sortMode, setSortMode]         = useState(null)  // null | 'name' | 'age'
  const [sortDir, setSortDir]           = useState('asc') // 가나다/나이 방향
  const [groupDir, setGroupDir]         = useState('asc') // 주머니 순서
  const searchRef = useRef(null)
  const searchVerRef = useRef(0)

  const { activeIndex: searchActiveIdx, handleKeyDown: searchKeyDown, resetIndex: resetSearchIdx }
    = useAutocompleteKeyNav(searchResults, (m) => handleAdd(m), () => setShowDrop(false))

  useEffect(() => { resetSearchIdx() }, [searchResults])

  useEffect(() => {
    loadServices()
    communityApi.list().then(r => setCells(Array.isArray(r.data) ? r.data : [])).catch(() => {})
  }, [])

  const loadServices = () => {
    api.services().then(r => {
      setServices(r.data)
      if (r.data.length) setServiceId(r.data[0].id)
    })
  }

  useEffect(() => {
    if (!serviceId || !date) return
    api.list({ service_id: serviceId, date }).then(r => setList(r.data))
    const lastWeekDate = dayjs(date).subtract(7, 'day').format('YYYY-MM-DD')
    api.list({ service_id: serviceId, date: lastWeekDate })
       .then(r => setLastWeekInfo({ count: r.data.length, date: lastWeekDate }))
  }, [serviceId, date])

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); setShowDrop(false); return }
    const ver = ++searchVerRef.current
    const svc = services.find(s => s.id === serviceId)
    const schoolDepts = svc?.target_school_depts || []
    memberApi.list({ q: search, limit: schoolDepts.length ? 30 : 8 }).then(r => {
      if (ver !== searchVerRef.current) return
      const existing = new Set(list.map(a => a.member_id))
      let results = (r.data.data || []).filter(m => !existing.has(m.id))
      if (schoolDepts.length) {
        results = results.filter(m => schoolDepts.includes(m.school_department))
      }
      setSearchResults(results.slice(0, 8))
      setShowDrop(true)
    })
  }, [search, list])

  useEffect(() => {
    const handler = e => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleRemove = async id => {
    await api.remove(id)
    setList(l => l.filter(a => a.id !== id))
    toast.success('출석 취소')
  }

  const handleAdd = async member => {
    try {
      await api.add({ member_id: member.id, service_id: serviceId, date })
      setSearch(''); setShowDrop(false)
      toast.success(`${member.name} 출석 등록`)
      api.list({ service_id: serviceId, date }).then(r => setList(r.data))
    } catch {
      toast.error('이미 등록되었거나 오류가 발생했습니다.')
    }
  }

  const communityLevels = useMemo(() => {
    if (!cells.length) return []
    const idToNode = Object.fromEntries(cells.map(c => [c.id, c]))
    const getDepth = c => {
      let depth = 0; let cur = c
      while (cur.parent_id != null) {
        const parent = idToNode[cur.parent_id]
        if (!parent) break
        depth++; cur = parent
      }
      return depth
    }
    const typeDepths = {}
    cells.forEach(c => {
      if (!c.type) return
      const d = getDepth(c)
      if (typeDepths[c.type] === undefined || d < typeDepths[c.type]) typeDepths[c.type] = d
    })
    return Object.entries(typeDepths)
      .sort((a, b) => a[1] - b[1])
      .map(([type, depth]) => ({ name: type, depth }))
  }, [cells])

  const { sortedGroups, ungrouped, sortedAll } = useMemo(() => {
    const sortMembers = arr => {
      const sorted = [...arr]
      const key = sortMode ?? 'name'
      if (key === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      else sorted.sort((a, b) => (a.birth_date ?? '9999').localeCompare(b.birth_date ?? '9999'))
      const dir = sortMode !== null ? sortDir : 'asc'
      return dir === 'asc' ? sorted : [...sorted].reverse()
    }

    if (groupLevel === null) {
      return { sortedGroups: [], ungrouped: [], sortedAll: sortMembers(list) }
    }

    // 레벨 기준 그루핑 (직접 소속 없으면 부모 체인 거슬러 올라가 대상 타입 탐색)
    const idToCell = Object.fromEntries(cells.map(c => [c.id, c]))
    const commByKey = Object.fromEntries(cells.map(c => [`${c.name}||${c.type}`, c]))

    const findGroup = allComms => {
      for (const comm of allComms) {
        if (comm.type === groupLevel) return `${comm.name}${comm.type}`
        const node = commByKey[`${comm.name}||${comm.type}`]
        if (!node) continue
        let cur = node
        while (cur.parent_id != null) {
          const parent = idToCell[cur.parent_id]
          if (!parent) break
          if (parent.type === groupLevel) return `${parent.name}${parent.type}`
          cur = parent
        }
      }
      return null
    }

    const groups = {}
    const ung = []
    list.forEach(a => {
      const allComms = Array.isArray(a.all_communities) ? a.all_communities : []
      const groupName = findGroup(allComms)
      if (groupName) (groups[groupName] ??= []).push(a)
      else ung.push(a)
    })

    const sorted = Object.keys(groups)
      .sort((a, b) => a.localeCompare(b, 'ko'))
      .map(name => ({ name, members: sortMembers(groups[name]) }))

    return {
      sortedGroups: groupDir === 'asc' ? sorted : [...sorted].reverse(),
      ungrouped: sortMembers(ung),
      sortedAll: null
    }
  }, [list, groupLevel, sortMode, sortDir, groupDir, cells])

  const handleSortClick = mode => {
    if (sortMode !== mode) { setSortMode(mode); setSortDir('asc') }
    else if (sortDir === 'asc') setSortDir('desc')
    else { setSortMode(null); setSortDir('asc') }
  }

  const handleGroupClick = name => {
    if (groupLevel !== name) { setGroupLevel(name); setGroupDir('asc') }
    else if (groupDir === 'asc') setGroupDir('desc')
    else { setGroupLevel(null); setGroupDir('asc') }
  }

  const handleCopyLastWeek = async () => {
    if (!lastWeekInfo?.count) return
    setCopying(true)
    try {
      const r = await api.copyLastWeek({ service_id: serviceId, date })
      toast.success(`${r.data.copied}명 불러왔습니다.`)
      api.list({ service_id: serviceId, date }).then(res => setList(res.data))
    } catch {
      toast.error('불러오기 실패')
    } finally {
      setCopying(false)
    }
  }

  const handleTileDone = () => {
    setTileMode(false)
    api.list({ service_id: serviceId, date }).then(r => setList(r.data))
  }

  const activeService = services.find(s => s.id === serviceId)

  if (tileMode) {
    return (
      <TileCheckView
        list={list}
        serviceId={serviceId}
        date={date}
        onDone={handleTileDone}
        schoolDepts={activeService?.target_school_depts || []}
        cells={cells}
      />
    )
  }

  return (
    <div className={styles.pageWrap}>

      {/* 1차탭: 예배 선택 */}
      <div className={styles.tabRow}>
        {services.map(s => (
          <button
            key={s.id}
            className={`${styles.tabBtn} ${s.id === serviceId ? styles.tabBtnActive : ''}`}
            onClick={() => setServiceId(s.id)}
          >
            {shortName(s)}
          </button>
        ))}
        <button
          className={styles.settingsTileBtn}
          onClick={() => setShowServiceSettings(true)}
        >
          ⚙️ 예배 관리
        </button>
      </div>

      {/* 2차탭: 정렬 핸들 | 그루핑 핸들 */}
      <div className={styles.typeChipRow}>
        <button
          className={`${styles.typeChip} ${sortMode === 'name' ? styles.typeChipActive : ''}`}
          onClick={() => handleSortClick('name')}
        >
          가나다{sortMode === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </button>
        <button
          className={`${styles.typeChip} ${sortMode === 'age' ? styles.typeChipActive : ''}`}
          onClick={() => handleSortClick('age')}
        >
          나이{sortMode === 'age' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </button>
        {communityLevels.length > 0 && <div className={styles.chipDivider} />}
        {communityLevels.map(lvl => (
          <button
            key={lvl.name}
            className={`${styles.typeChip} ${groupLevel === lvl.name ? styles.typeChipActive : ''}`}
            onClick={() => handleGroupClick(lvl.name)}
          >
            {lvl.name}{groupLevel === lvl.name ? (groupDir === 'asc' ? '↑' : '↓') : ''}
          </button>
        ))}
      </div>

      {/* 메인 콘텐츠 */}
      <div className={styles.content}>

        {/* 통합 툴바 */}
        <div className={styles.mainToolbar}>
          <div className={styles.weekNavWrap}>
            <div className={styles.weekNav}>
              <button className={styles.weekNavBtn}
                onClick={() => setDate(d => dayjs(d).subtract(1, 'week').format('YYYY-MM-DD'))}>◀</button>
              <button className={styles.weekLabel} onClick={() => setShowPicker(p => !p)}>{weekLabel(date)}</button>
              <button className={styles.weekNavBtn}
                onClick={() => setDate(d => dayjs(d).add(1, 'week').format('YYYY-MM-DD'))}>▶</button>
            </div>
            {showPicker && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => setShowPicker(false)} />
                <WeekPicker current={date} onSelect={d => { setDate(d); setShowPicker(false) }} />
              </>
            )}
          </div>
          <button
            className={styles.toolbarBtn}
            onClick={() => setConfirmCopy(true)}
            disabled={copying || !lastWeekInfo?.count}
            title={`지난주(${lastWeekInfo ? dayjs(lastWeekInfo.date).format('MM/DD') : '-'}) · ${activeService ? shortName(activeService) : ''}`}
          >
            지난주 출석인원 불러오기({lastWeekInfo?.count ?? 0}명)
          </button>
          <button className={styles.toolbarBtn} onClick={() => setTileMode(true)}>
            일괄선택하여 등록
          </button>
          <div className={styles.searchWrap} ref={searchRef} style={{ flex: 1, minWidth: '100px' }}>
            <input
              className={styles.searchInput}
              placeholder="🔍"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => searchResults.length && setShowDrop(true)}
              onKeyDown={searchKeyDown}
            />
            {showDrop && searchResults.length > 0 && (
              <div className={styles.searchDropdown}>
                {searchResults.map((m, i) => (
                  <div key={m.id}
                    className={`${styles.searchItem} ${i === searchActiveIdx ? styles.searchItemActive : ''}`}
                    onClick={() => handleAdd(m)}>
                    <div className={styles.searchThumb}
                         style={{ background: genderColor(m.gender) }}>
                      {m.photo_url
                        ? <img src={m.photo_url} alt={m.name} />
                        : m.name[0]}
                    </div>
                    <span className={styles.searchName}>{m.name}</span>
                    {m.position && <span className={styles.searchPos}>{m.position}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <span className={styles.countBadge}>{list.length}명</span>
          <Link to="/attendance/stats" className={styles.toolbarBtn}>출석통계</Link>
        </div>

        {/* 출석자 목록 */}
        <div className={styles.card}>
          <div className={styles.cellGroups}>
            {sortedAll ? (
              <div className={styles.attendeeGrid}>
                {sortedAll.map(a => <AttendTile key={a.id} a={a} onRemove={handleRemove} />)}
              </div>
            ) : (
              <>
                {sortedGroups.map(({ name, members }) => (
                  <div key={name} className={styles.cellGroup} style={{ background: groupGradient(name) }}>
                    <span className={styles.cellGroupLabel}>{name}</span>
                    <div className={styles.attendeeGrid}>
                      {members.map(a => <AttendTile key={a.id} a={a} onRemove={handleRemove} />)}
                    </div>
                  </div>
                ))}
                {ungrouped.length > 0 && (
                  <div className={styles.attendeeGrid}>
                    {ungrouped.map(a => <AttendTile key={a.id} a={a} onRemove={handleRemove} />)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>

      {/* 예배 설정 모달 */}
      {showServiceSettings && (
        <ServiceSettingsModal
          onClose={() => setShowServiceSettings(false)}
          onSaved={loadServices}
        />
      )}

      {/* 불러오기 확인 모달 */}
      {confirmCopy && (
        <div className={styles.modalOverlay} onClick={() => setConfirmCopy(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p className={styles.modalMsg}>
              지난 주 <strong>{activeService ? shortName(activeService) : ''}</strong> 출석인원을 추가하시겠습니까?
            </p>
            <div className={styles.modalBtns}>
              <button className={styles.modalCancel} onClick={() => setConfirmCopy(false)}>취소</button>
              <button className={styles.modalConfirm} onClick={async () => {
                setConfirmCopy(false)
                await handleCopyLastWeek()
              }}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
