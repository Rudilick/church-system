import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { members as api } from '../../api'
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus'
import { useIsMobile } from '../../hooks/useIsMobile'
import { genderColor, displayPosition, compareName } from '../../utils'
import { usePositionRanks, positionRankColor } from '../../hooks/usePositionRanks'
import dayjs from 'dayjs'
import VisitFormModal from '../../components/VisitFormModal'
import MemberNotesModal from './MemberNotesModal'
import BulkVisitModal from './BulkVisitModal'
import BulkNoteModal from './BulkNoteModal'
import DeleteGuardModal from '../../components/DeleteGuardModal'
import { useDeleteGuard } from '../../hooks/useDeleteGuard'
import SmsSendModal from '../../components/SmsSendModal'
import PageShell from '../../components/PageShell'
import styles from './Members.module.css'

const TYPES = [
  { value: '', label: '전체' },
  { value: 'active', label: '현재재적' },
  { value: 'inactive', label: '재적 외' },
  { value: 'transfer_out', label: '이명' },
  { value: 'deceased', label: '소천' },
]

const STATUS_SHORT = { active: '재적', inactive: '재외', transfer_out: '이명', deceased: '소천' }

const isMobileUA = /Android|iPhone|iPad/i.test(navigator.userAgent)

// 교인 상세로 들어갔다 돌아왔을 때(컴포넌트 리마운트) 목록 스크롤/페이지 위치를
// 그대로 유지하기 위해 모듈 스코프(탭 세션 동안 유지)에 기억해둠
const listPositionMemory = {
  page: 1,
  tilePage: 1,
  viewMode: 'list',
  scrollByPageKey: new Map(),
}

const SEARCH_FIELDS = [
  ['name',                     '이름'],
  ['name_en',                  '영문이름'],
  ['phone',                    '전화'],
  ['home_phone',               '유선전화'],
  ['birth_date',               '생년월일'],
  ['address',                  '주소'],
  ['address_detail',           '주소(상세)'],
  ['email',                    '이메일'],
  ['gender',                   '성별'],
  ['position',                 '직분'],
  ['membership_type',          '교인상태'],
  ['membership_category',      '교인구분'],
  ['faith_level',              '신앙등급'],
  ['school_department',        '학교부서'],
  ['workplace',                '직장'],
  ['school',                   '학교'],
  ['introducer_name',          '인도자'],
  ['previous_church',          '이전교회'],
  ['previous_church_position', '이전교회직분'],
  ['occupation',               '직업'],
  ['household_head_name',      '신앙세대주'],
  ['household_relation',       '세대주관계'],
  ['note',                     '특이사항'],
  ['staff_category',           '교역자직원여부'],
  ['staff_role',               '교역자직원직함'],
]

const FIELD_DISPLAY = {
  gender: v => v === 'M' ? '남' : v === 'F' ? '여' : v,
  membership_type: v => ({ active: '현재재적', inactive: '재적 외', transfer_out: '이명', deceased: '소천' }[v] ?? v),
  staff_category: v => ({ pastoral: '교역자', other: '직원' }[v] ?? v),
}

// 코드값 하나가 여러 동의어로 검색되는 필드 — 백엔드 buildFieldSearch()의 CASE 매핑과 동일하게 유지
// (예: 성별 'M'은 "남"/"남성"/"남자" 어느 것으로 검색해도 매칭되므로, 매칭 미리보기도 실제 검색어가
// 포함된 동의어를 찾아 보여줘야 함)
const FIELD_SYNONYMS = {
  gender: { M: ['남', '남성', '남자'], F: ['여', '여성', '여자'] },
}

// 필드 검색어 매칭에 실제로 사용되는 표시값 후보 목록 (동의어 필드는 여러 개, 그 외엔 1개)
function fieldDisplayCandidates(field, raw) {
  const syn = FIELD_SYNONYMS[field]
  if (syn) return syn[raw] ?? [String(raw)]
  const disp = FIELD_DISPLAY[field] ? FIELD_DISPLAY[field](raw) : raw
  return [String(disp)]
}

function calcAge(birthDate) {
  if (!birthDate) return null
  return dayjs().year() - dayjs(birthDate).year() + 1
}

function findFirstMatch(member, query) {
  if (!query?.trim()) return null
  const q = query.trim().toLowerCase()

  for (const [field, label] of SEARCH_FIELDS) {
    const raw = member[field]
    if (!raw) continue
    for (const str of fieldDisplayCandidates(field, raw)) {
      const idx = str.toLowerCase().indexOf(q)
      if (idx === -1) continue
      const before  = str.slice(Math.max(0, idx - 8), idx)
      const matched = str.slice(idx, idx + q.length)
      const after   = str.slice(idx + q.length, idx + q.length + 10)
      return { label, before, matched, after: after + ((idx + q.length + 10 < str.length) ? '…' : '') }
    }
  }

  for (const c of (member.communities ?? [])) {
    const idx = c.name?.toLowerCase().indexOf(q) ?? -1
    if (idx !== -1) return { label: '공동체', before: '', matched: c.name.slice(idx, idx + q.length), after: '' }
  }

  for (const d of (member.departments ?? [])) {
    const idx = d.name?.toLowerCase().indexOf(q) ?? -1
    if (idx !== -1) return { label: '부서', before: '', matched: d.name.slice(idx, idx + q.length), after: '' }
  }

  for (const f of (member.families ?? [])) {
    const idx = f.name?.toLowerCase().indexOf(q) ?? -1
    if (idx !== -1) return { label: '가족', before: '', matched: f.name.slice(idx, idx + q.length), after: '' }
  }

  return null
}

function getMatchPlainText(member, query) {
  const m = findFirstMatch(member, query)
  if (!m) return ''
  return `${m.label}: ${m.before}${m.matched}${m.after}`
}

function MatchCell({ member, query }) {
  const m = findFirstMatch(member, query)
  if (!m) return <span className={styles.matchEmpty}>-</span>
  return (
    <span className={styles.matchCell}>
      <span className={styles.matchLabel}>{m.label}: </span>
      <span>{m.before}</span>
      <strong className={styles.matchHighlight}>{m.matched}</strong>
      <span>{m.after}</span>
    </span>
  )
}

// 공동체 계층 경로(예: "요셉마을 레위공동체 1그룹 243가족")를 가로폭에 맞춰
// 계층 단위(공백)로만 앞쪽을 잘라내고 "…"로 표시 — 글자 중간이 잘리지 않도록 함
let measureCanvas = null
function useHierarchyTruncate(text) {
  const ref = useRef(null)
  const [display, setDisplay] = useState(text)

  useEffect(() => {
    const el = ref.current
    if (!el || !text) { setDisplay(text ?? ''); return }

    const measure = () => {
      const available = el.clientWidth
      if (available <= 0) return
      const cs = getComputedStyle(el)
      if (!measureCanvas) measureCanvas = document.createElement('canvas')
      const ctx = measureCanvas.getContext('2d')
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`

      const tokens = text.split(' ')
      if (ctx.measureText(text).width <= available) { setDisplay(text); return }
      for (let i = 1; i < tokens.length; i++) {
        const candidate = '…' + tokens.slice(i).join(' ')
        if (ctx.measureText(candidate).width <= available || i === tokens.length - 1) {
          setDisplay(candidate)
          return
        }
      }
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text])

  return [ref, display]
}

function CommunityText({ text, className }) {
  const [ref, display] = useHierarchyTruncate(text)
  return (
    <div ref={ref} className={className} style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
      {display}
    </div>
  )
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="3" width="12" height="2" rx="1"/>
      <rect x="2" y="7" width="12" height="2" rx="1"/>
      <rect x="2" y="11" width="12" height="2" rx="1"/>
    </svg>
  )
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="2" width="5" height="5" rx="1"/>
      <rect x="9" y="2" width="5" height="5" rx="1"/>
      <rect x="2" y="9" width="5" height="5" rx="1"/>
      <rect x="9" y="9" width="5" height="5" rx="1"/>
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#22c55e">
      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.56.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.56 1 1 0 01-.24 1.01l-2.21 2.22z"/>
    </svg>
  )
}

function MessageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#3b82f6">
      <path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"/>
    </svg>
  )
}

function StatusBadge({ type, short }) {
  const map = {
    active:       { label: '현재재적', color: '#22c55e' },
    inactive:     { label: '재적 외',  color: '#f59e0b' },
    transfer_out: { label: '이명',    color: '#94a3b8' },
    deceased:     { label: '소천',    color: '#6b7280' },
  }
  const s = map[type] ?? { label: type, color: '#94a3b8' }
  return (
    <span style={{ background: s.color, color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
      {short ? (STATUS_SHORT[type] ?? s.label) : s.label}
    </span>
  )
}

export default function MemberList() {
  const navigate = useNavigate()
  const isMobileScreen = useIsMobile(768)
  const rankMap = usePositionRanks()

  // ── 일반 목록 state ───────────────────────────────────────
  const [data, setData]   = useState([])
  const [total, setTotal] = useState(0)
  const [q, setQ]         = useState('')
  const [type, setType]   = useState('active')
  const [page, setPage]   = useState(listPositionMemory.page)
  const [limit, setLimit] = useState(50)

  // ── 조건검색 state (폰 화면은 조건검색1·2를 항상 노출) ─────────
  const [conditions, setConditions] = useState(() =>
    isMobileScreen ? [{ q: '' }, { q: '', op: 'AND' }] : [{ q: '' }]
  )
  const [sort, setSort]             = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching]   = useState(false)

  // ── 뷰 모드 + 타일 페이지네이션 ──────────────────────────────
  const [viewMode, setViewMode] = useState(listPositionMemory.viewMode)
  const [tilePage, setTilePage] = useState(listPositionMemory.tilePage)
  const [selectedIds, setSelectedIds] = useState(new Set())

  // ── 행 액션 모달 (특이사항 / 심방등록) ──────────────────────
  const [notesModalMember, setNotesModalMember] = useState(null)
  const [visitModalMember, setVisitModalMember] = useState(null)
  const [bulkVisitMembers, setBulkVisitMembers] = useState(null)
  const [bulkNoteMembers, setBulkNoteMembers]   = useState(null)

  // ── 문자 발송 모달 ────────────────────────────────────────
  const [smsModal, setSmsModal] = useState({ open: false, recipients: [] })

  const loadVerRef = useRef(0)

  // ── 폰 화면 좌우 스와이프로 페이지 이동 시 끊김 없이 보이도록,
  //    서버 목록(page) ±1 페이지를 미리 불러와 캐싱해둠 ─────────
  const pageCacheRef = useRef({ key: '', pages: new Map() })
  const cacheKey = `${q}|${type}|${limit}|${sort}`
  // 스와이프 중 옆에 이미 걸려있어야 하는 이전/다음 페이지 데이터(목록 보기용)
  const [neighborPages, setNeighborPages] = useState({ prev: null, next: null })

  // ── 일반 목록 로드 ────────────────────────────────────────
  const load = useCallback(async () => {
    if (searchResults !== null) return
    if (pageCacheRef.current.key !== cacheKey) pageCacheRef.current = { key: cacheKey, pages: new Map() }
    const cached = pageCacheRef.current.pages.get(page)
    if (cached) { setData(cached.data); setTotal(cached.total) }
    const ver = ++loadVerRef.current
    try {
      const res = await api.list({ q, type, page, limit, sort: sort || undefined, name_only: 1 })
      if (ver !== loadVerRef.current) return
      pageCacheRef.current.pages.set(page, { data: res.data.data, total: res.data.total })
      setData(res.data.data)
      setTotal(res.data.total)
    } catch { /* silent */ }
  }, [q, type, page, limit, sort, searchResults, cacheKey])

  useEffect(() => { load() }, [load])
  useRefreshOnFocus(load)

  // ── 다음/이전 페이지 미리 불러오기(prefetch) — 캐시에 있으면 즉시,
  //    없으면 받아오는 대로 neighborPages에 반영해 스와이프 옆 패널에 표시 ──
  useEffect(() => {
    if (searchResults !== null || !isMobileScreen) return
    if (pageCacheRef.current.key !== cacheKey) pageCacheRef.current = { key: cacheKey, pages: new Map() }
    const cache = pageCacheRef.current.pages
    const maxPage = Math.max(1, Math.ceil(total / limit))

    const sync = () => {
      setNeighborPages({
        prev: page > 1 ? (cache.get(page - 1)?.data ?? null) : null,
        next: page < maxPage ? (cache.get(page + 1)?.data ?? null) : null,
      })
    }
    sync()

    ;[page - 1, page + 1].forEach(p => {
      if (p < 1 || p > maxPage || cache.has(p)) return
      api.list({ q, type, page: p, limit, sort: sort || undefined, name_only: 1 })
        .then(res => {
          if (pageCacheRef.current.key !== cacheKey) return
          cache.set(p, { data: res.data.data, total: res.data.total })
          sync()
        })
        .catch(() => {})
    })
  }, [page, total, q, type, limit, sort, searchResults, isMobileScreen, cacheKey])

  const searchVerRef = useRef(0)

  // ── 조건 검색 ─────────────────────────────────────────────
  const handleSearch = useCallback(async (conds) => {
    const validConds = (conds ?? conditions).filter(c => c.q?.trim())
    if (validConds.length === 0) { setSearchResults(null); return }
    setViewMode('list')
    const ver = ++searchVerRef.current
    setSearching(true)
    try {
      const res = await api.search(validConds, sort || undefined)
      if (ver !== searchVerRef.current) return
      setSearchResults(res.data.data ?? [])
    } catch (e) {
      console.error('search error', e)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [conditions, sort])

  // 조건 변경 시 즉시 자동 검색
  useEffect(() => {
    handleSearch(conditions)
  }, [conditions])

  const handleReset = () => {
    setSearchResults(null)
    setConditions([{ q: '' }])
    setSort('')
    setPage(1)
  }

  const handleCondChange = (i, val) => {
    setConditions(prev => prev.map((c, idx) => idx === i ? { ...c, q: val } : c))
  }

  const handleOpChange = (i, op) => {
    setConditions(prev => prev.map((c, idx) => idx === i ? { ...c, op } : c))
  }

  const addCondition = () => {
    if (conditions.length >= 3) return
    setConditions(prev => [...prev, { q: '', op: 'OR' }])
  }

  const removeCondition = (i) => {
    setConditions(prev => prev.filter((_, idx) => idx !== i))
  }

  // ── 정렬 ──────────────────────────────────────────────────
  const toggleSort = (key) => {
    setSort(prev =>
      prev === `${key}_asc` ? `${key}_desc`
      : prev === `${key}_desc` ? ''
      : `${key}_asc`
    )
  }

  useEffect(() => {
    if (searchResults !== null) {
      setSearchResults(prev => {
        if (!prev) return prev
        const sorted = [...prev]
        if (sort === 'name_asc')   sorted.sort((a, b) => compareName(a.name, b.name))
        if (sort === 'name_desc')  sorted.sort((a, b) => compareName(b.name, a.name))
        if (sort === 'birth_asc')  sorted.sort((a, b) => (a.birth_date || '9999') > (b.birth_date || '9999') ? 1 : -1)
        if (sort === 'birth_desc') sorted.sort((a, b) => (a.birth_date || '0000') < (b.birth_date || '0000') ? 1 : -1)
        return sorted
      })
    }
  }, [sort])

  // ── 교적 전체 내보내기 (업로드 양식과 동일 30컬럼) ──────────
  const handleFullExport = async () => {
    try {
      const ids = selectedIds.size > 0 ? [...selectedIds] : []
      const res = await api.fullExport(ids)
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `교적전체_${date}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('내보내기 중 오류가 발생했습니다.')
    }
  }

  // ── Excel 다운로드 ────────────────────────────────────────
  const handleExcelDownload = async () => {
    const base = searchResults ?? data
    const list = selectedIds.size > 0 ? base.filter(m => selectedIds.has(m.id)) : base
    if (!list.length) return
    try {
      const XLSX = await import('xlsx')
      const rows = list.map(m => {
        const row = {
          이름: m.name,
          성별: m.gender === 'M' ? '남' : m.gender === 'F' ? '여' : '',
          생년월일: m.birth_date ? dayjs(m.birth_date).format('YYYY.MM.DD') : '',
          전화: m.phone || '',
          주소: [m.address, m.address_detail].filter(Boolean).join(' '),
          직분: displayPosition(m) || '',
          교인구분: m.membership_category || '',
          등록일: m.registered_at ? dayjs(m.registered_at).format('YYYY.MM.DD') : '',
          상태: { active: '현재재적', inactive: '재적 외', transfer_out: '이명', deceased: '소천' }[m.membership_type] || m.membership_type,
        }
        if (searchResults !== null) {
          if (conditions[0]?.q) row['조건1 매칭'] = getMatchPlainText(m, conditions[0].q)
          if (conditions[1]?.q) row['조건2 매칭'] = getMatchPlainText(m, conditions[1].q)
          if (conditions[2]?.q) row['조건3 매칭'] = getMatchPlainText(m, conditions[2].q)
        }
        return row
      })
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '교인목록')
      XLSX.writeFile(wb, `교인목록_${dayjs().format('YYYYMMDD')}.xlsx`)
    } catch (e) {
      console.error(e)
    }
  }

  const toggleSelect = (id, e) => {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    const visible = displayList.map(m => m.id)
    const allSelected = visible.every(id => selectedIds.has(id))
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        visible.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelectedIds(prev => new Set([...prev, ...visible]))
    }
  }

  const deleteGuard = useDeleteGuard()
  const handleBulkDelete = () => {
    const ids = [...selectedIds]
    if (!ids.length) return
    deleteGuard.request(async () => {
      try {
        await api.bulkRemove(ids)
        setSelectedIds(new Set())
        load()
      } catch {
        alert('삭제 중 오류가 발생했습니다.')
      }
    })
  }

  const displayList  = searchResults ?? data
  const isSearchMode = searchResults !== null
  const sortLabel = (key) =>
    sort === `${key}_asc` ? ' ↑' : sort === `${key}_desc` ? ' ↓' : ''
  const hasCondInput = conditions.some(c => c.q?.trim())

  const tileLimit = isMobileScreen ? 100 : 9  // 폰: 5열 × 20행
  const tileTotal = displayList.length
  const tilePaged = displayList.slice((tilePage - 1) * tileLimit, tilePage * tileLimit)

  // ── 폰 화면: 목록/타일 좌우 스와이프로 이전/다음 페이지 이동 ──
  // 이전/다음 페이지 콘텐츠를 항상 현재 페이지 옆(화면 밖)에 같이 걸어두고,
  // 손가락을 따라 셋이 한 덩어리로 같이 움직이다가 손을 떼면 ease-out으로
  // 다음/이전 페이지로 넘어가거나 제자리로 되돌아와 고정됨(끊김/빈 화면 없음)
  const swipeStageRef = useRef(null)
  const prevPanelRef = useRef(null)
  const currentPanelRef = useRef(null)
  const nextPanelRef = useRef(null)
  const EASE = 'transform 0.3s ease-out'

  const tileMaxPage = Math.max(1, Math.ceil(tileTotal / tileLimit))
  const tilePrevData = tilePage > 1 ? displayList.slice((tilePage - 2) * tileLimit, (tilePage - 1) * tileLimit) : null
  const tileNextData = tilePage < tileMaxPage ? displayList.slice(tilePage * tileLimit, (tilePage + 1) * tileLimit) : null

  const listMaxPage = Math.max(1, Math.ceil(total / limit))
  const listPrevData = (!isSearchMode && page > 1) ? neighborPages.prev : null
  const listNextData = (!isSearchMode && page < listMaxPage) ? neighborPages.next : null

  const currentList = viewMode === 'tile' ? tilePaged : displayList
  const prevData = viewMode === 'tile' ? tilePrevData : listPrevData
  const nextData = viewMode === 'tile' ? tileNextData : listNextData

  const goPage = useCallback((dir) => {
    if (viewMode === 'tile') {
      setTilePage(p => {
        const maxP = Math.max(1, Math.ceil(tileTotal / tileLimit))
        const next = p + dir
        return next >= 1 && next <= maxP ? next : p
      })
    } else if (!isSearchMode) {
      setPage(p => {
        const maxP = Math.max(1, Math.ceil(total / limit))
        const next = p + dir
        if (next < 1 || next > maxP) return p
        // 목록 보기는 서버 페이지네이션이라 page만 바꾸면 실제 목록(data)은
        // 뒤늦게(비동기 load 완료 후) 갱신되어, 그 사이 한 프레임 이전 페이지
        // 내용이 화면에 잠깐 비치는 깜빡임이 있었음. 캐시에 이미 있으면
        // page/데이터를 한 번에 같이 갱신해 그 프레임 자체를 없앰
        if (pageCacheRef.current.key === cacheKey) {
          const cached = pageCacheRef.current.pages.get(next)
          if (cached) { setData(cached.data); setTotal(cached.total) }
        }
        return next
      })
    }
  }, [viewMode, tileTotal, tileLimit, isSearchMode, total, limit, cacheKey])

  // 끌고 간 거리에 비례해 기존(현재) 화면은 점점 흐려지고, 옆에서 드러나는
  // 페이지는 점점 선명해짐 — 넘기다 말고 되돌아오면 그 비율 그대로 다시 선명해짐
  const MAX_BLUR = 6 // px
  const FILTER_EASE = 'filter 0.3s ease-out'
  const PANEL_GAP = 14 // px — 두 페이지 사이에 항상 두는 간격

  const applyTransforms = (dragX, withTransition) => {
    const stage = swipeStageRef.current
    if (!stage) return
    const w = stage.clientWidth || window.innerWidth
    const transition = withTransition ? `${EASE}, ${FILTER_EASE}` : 'none'
    const progress = Math.min(Math.abs(dragX) / w, 1)
    // 기존(현재) 페이지만 이동 거리에 비례해 흐려짐 — 새로 드러나는 페이지는
    // 항상 선명하게 유지. 두 페이지 사이엔 PANEL_GAP만큼 항상 틈을 둠
    if (currentPanelRef.current) {
      currentPanelRef.current.style.transition = transition
      currentPanelRef.current.style.transform = `translateX(${dragX}px)`
      currentPanelRef.current.style.filter = `blur(${progress * MAX_BLUR}px)`
    }
    if (prevPanelRef.current) {
      prevPanelRef.current.style.transition = transition
      prevPanelRef.current.style.transform = `translateX(${dragX - w - PANEL_GAP}px)`
      prevPanelRef.current.style.filter = 'blur(0px)'
    }
    if (nextPanelRef.current) {
      nextPanelRef.current.style.transition = transition
      nextPanelRef.current.style.transform = `translateX(${dragX + w + PANEL_GAP}px)`
      nextPanelRef.current.style.filter = 'blur(0px)'
    }
  }

  // prev/next 패널은 position:absolute라 transform을 안 걸어두면 current 패널과
  // 같은 자리(0,0)에 겹쳐 그 위에 그려짐(나중에 마운트된 형제가 위로 쌓임) —
  // 터치 전에도 항상 화면 밖(±w)에 나가 있도록 렌더 직후(페인트 전) 위치를 고정.
  // 손가락으로 끌고 있는 도중엔(isDraggingRef) 무관한 리렌더가 드래그 위치를
  // 덮어쓰지 않도록 건너뜀
  const isDraggingRef = useRef(false)

  // ── 페이지별 세로 스크롤 위치 기억 ──────────────────────────
  // 목록/타일 스크롤은 .content 하나를 공유하므로, 페이지를 넘길 때마다
  // 그 페이지에서 마지막으로 보던 위치를 저장해뒀다가 다시 그 페이지로
  // 오면 복원함. 화면(위치/블러) 리셋과 같은 페인트 전 타이밍에 처리해
  // 눈에 튀지 않게(안 끊기게) 함
  const contentRef = useRef(null)
  // 리마운트(상세 진입 후 복귀)에도 스크롤 기억이 살아있도록 모듈 스코프 Map을 그대로 재사용
  const scrollMemoryRef = useRef(listPositionMemory.scrollByPageKey)
  const lastScrollPageRef = useRef(null)
  const pageKey = viewMode === 'tile' ? `tile:${tilePage}` : `list:${page}`

  // 현재 페이지/뷰모드를 모듈 스코프에 계속 기록 — 상세 진입 후 돌아오면 이 값으로 재시작
  useEffect(() => {
    listPositionMemory.page = page
    listPositionMemory.tilePage = tilePage
    listPositionMemory.viewMode = viewMode
  }, [page, tilePage, viewMode])

  useLayoutEffect(() => {
    if (isDraggingRef.current) return
    applyTransforms(0, false)
    if (lastScrollPageRef.current !== pageKey) {
      lastScrollPageRef.current = pageKey
      if (contentRef.current) {
        contentRef.current.scrollTop = scrollMemoryRef.current.get(pageKey) ?? 0
      }
    }
  })

  // 리마운트 직후엔 목록(data)이 비동기로 늦게 채워져 위 useLayoutEffect가
  // 콘텐츠 높이 0인 상태에서 스크롤을 시도해 무의미해지는 경우가 있어,
  // 데이터가 실제로 채워진 다음에 한 번 더 복원을 시도한다.
  const restoredOnceRef = useRef(false)
  useEffect(() => {
    if (restoredOnceRef.current) return
    if (!contentRef.current || currentList.length === 0) return
    restoredOnceRef.current = true
    contentRef.current.scrollTop = scrollMemoryRef.current.get(pageKey) ?? 0
  }, [currentList, pageKey])

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const onScroll = () => { scrollMemoryRef.current.set(pageKey, el.scrollTop) }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [pageKey])

  const handleSwipeTouchStart = useCallback((e) => {
    const stage = swipeStageRef.current
    if (!stage) return
    const touch = e.touches[0]
    const startX = touch.clientX
    const startY = touch.clientY
    let dx = 0, dy = 0, axis = null
    isDraggingRef.current = true

    const onMove = (ev) => {
      const t = ev.touches[0]
      dx = t.clientX - startX
      dy = t.clientY - startY
      if (!axis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y'
      }
      if (axis === 'x') {
        if (ev.cancelable) ev.preventDefault()
        // 넘길 페이지가 없는 방향(옆 패널 없음)으로 끌면 고무줄처럼 저항감을 줌
        const hasSide = dx < 0 ? !!nextPanelRef.current : !!prevPanelRef.current
        applyTransforms(hasSide ? dx : dx * 0.3, false)
      }
    }
    const onEnd = () => {
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
      isDraggingRef.current = false
      const dir = dx < 0 ? 1 : -1
      const hasSide = dir === 1 ? !!nextPanelRef.current : !!prevPanelRef.current
      const commit = axis === 'x' && Math.abs(dx) > 60 && hasSide
      if (!commit) {
        applyTransforms(0, true)
        return
      }
      const w = stage.clientWidth || window.innerWidth
      // 목표 지점을 PANEL_GAP만큼 더 밀어서, 새 페이지가 정확히 0(제자리)까지
      // 들어와 멈추도록 함(간격이 그대로 유지되며 끝에 어긋남 없이 딱 맞물림)
      applyTransforms(dir === 1 ? -(w + PANEL_GAP) : (w + PANEL_GAP), true)
      const onOut = () => {
        currentPanelRef.current?.removeEventListener('transitionend', onOut)
        // 위치 리셋은 위 useLayoutEffect가 리렌더 직후(페인트 전) 처리함
        goPage(dir)
      }
      currentPanelRef.current?.addEventListener('transitionend', onOut, { once: true })
    }
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
  }, [goPage])

  // ── 폰 화면 스와이프 패널용 카드 렌더러 ──────────────────
  const renderMobileTiles = (list) => (
    <div className={`${styles.tileGrid} ${styles.tileGridMobile}`}>
      {list.map(m => (
        <div key={m.id} className={styles.tileCardMobile} onClick={() => navigate(`/members/${m.id}`)}>
          <div className={styles.tilePhotoBox}>
            {m.photo_url
              ? <img src={m.photo_url} className={styles.tilePhotoSquare} alt={m.name} />
              : <div className={styles.tileInitialSquare} style={{ background: genderColor(m.gender) }}>
                  {m.name?.[0]}
                </div>
            }
          </div>
          <div className={styles.tileInfoMobile}>
            <span className={styles.tileNameMobile}>{m.name}</span>
            <span className={styles.tileAgeMobile}>{calcAge(m.birth_date) != null ? `${calcAge(m.birth_date)}세` : '-'}</span>
          </div>
        </div>
      ))}
      {list.length === 0 && (
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '20px 0' }}>
          {isSearchMode ? '검색 결과가 없습니다.' : '교인이 없습니다.'}
        </p>
      )}
    </div>
  )

  const renderMobileList = (list) => (
    <div className={styles.mListWrap}>
      {list.map(m => {
        const age = calcAge(m.birth_date)
        return (
          <div key={m.id} className={styles.mCard} onClick={() => navigate(`/members/${m.id}`)}>
            <div className={styles.mPhotoBox}>
              {m.photo_url
                ? <img src={m.photo_url} alt={m.name} className={styles.mPhoto} />
                : <div className={styles.mPhotoPlaceholder} style={{ background: genderColor(m.gender) }}>
                    {m.name[0]}
                  </div>
              }
            </div>
            <div className={styles.mRight}>
              <div className={styles.mLeftCol}>
                <div className={styles.mNameRow}>
                  <span className={styles.mName}>{m.name}</span>
                  {displayPosition(m) && <span className={styles.mPosBadge} style={positionRankColor(m.position, rankMap)}>{displayPosition(m)}</span>}
                  <span className={styles.mAgeGender}>{age != null ? `${age}세` : '-'} · {m.gender === 'M' ? '남' : m.gender === 'F' ? '여' : '-'}</span>
                </div>
                {m.community_text && (
                  <CommunityText text={m.community_text} className={styles.mCommunityRow} />
                )}
              </div>
              <div className={styles.mRightCol}>
                <div className={styles.mIconBtns}>
                  <a
                    className={styles.mIconBtn}
                    href={m.phone && isMobileUA ? `tel:${m.phone}` : undefined}
                    onClick={e => { e.stopPropagation(); if (!m.phone) e.preventDefault() }}
                    title="전화"
                  ><PhoneIcon /></a>
                  <a
                    className={styles.mIconBtn}
                    href={m.phone && isMobileUA ? `sms:${m.phone}` : undefined}
                    onClick={e => { e.stopPropagation(); if (!m.phone) e.preventDefault() }}
                    title="문자"
                  ><MessageIcon /></a>
                  <StatusBadge type={m.membership_type} short />
                </div>
                <div className={styles.mActionRow}>
                  <button className={`${styles.btnSm} ${styles.btnSmViolet}`}
                    onClick={e => { e.stopPropagation(); setNotesModalMember(m) }}>특이사항</button>
                  <button className={`${styles.btnSm} ${styles.btnSmGreen}`}
                    onClick={e => { e.stopPropagation(); setVisitModalMember(m) }}>심방</button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
      {list.length === 0 && (
        <p className={styles.empty}>{isSearchMode ? '검색 결과가 없습니다.' : '교인이 없습니다.'}</p>
      )}
    </div>
  )

  const renderMobilePanel = viewMode === 'tile' ? renderMobileTiles : renderMobileList

  return (
    <PageShell title="교적 관리" actions={
      <Link to="/members/new" className={styles.btnPrimary}>+ 교인 등록</Link>
    }>
      <div className={styles.content} ref={contentRef}>

      <div className={styles.stickyTop}>
      {/* ── 통합 툴바 (1줄) ── */}
      <div className={styles.toolbar}>
        {/* 이름 빠른 검색 */}
        <input
          className={styles.searchInput}
          placeholder="이름검색"
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1) }}
          disabled={isSearchMode}
          style={isSearchMode ? { opacity: 0.4 } : undefined}
        />

        {/* 조건 검색 인라인 영역 */}
        <div className={styles.condInline}>
          {conditions.map((cond, i) => (
            <div key={i} className={styles.condRow}>
              {i > 0 && !isMobileScreen && (
                <div className={styles.condOp}>
                  <button
                    className={`${styles.condOpBtn} ${(cond.op || 'OR') === 'OR' ? styles.condOpActive : ''}`}
                    onClick={() => handleOpChange(i, 'OR')}
                  >OR</button>
                  <button
                    className={`${styles.condOpBtn} ${cond.op === 'AND' ? styles.condOpActive : ''}`}
                    onClick={() => handleOpChange(i, 'AND')}
                  >AND</button>
                </div>
              )}
              <input
                className={styles.condInput}
                placeholder={isMobileScreen ? `조건검색${i + 1}` : (i === 0 ? '조건 검색' : `조건 ${i + 1}`)}
                value={cond.q}
                onChange={e => handleCondChange(i, e.target.value)}
              />
              {conditions.length > 1 && !isMobileScreen && (
                <button className={styles.condRemoveBtn} onClick={() => removeCondition(i)}>×</button>
              )}
            </div>
          ))}
          {conditions.length < 3 && !isMobileScreen && (
            <button className={styles.condAddBtn} onClick={addCondition} title="조건 추가">+</button>
          )}
          {isSearchMode && (
            <button className={styles.resetBtn} onClick={handleReset}>× 초기화</button>
          )}
        </div>

        {/* 타입 탭 — 검색 모드 아닐 때 (폰 화면은 정렬·뷰전환 버튼도 같은 줄에 배치) */}
        {!isSearchMode && (
          <div className={styles.typeTabs}>
            {TYPES.map(t => (
              <button
                key={t.value}
                className={`${styles.tab} ${type === t.value ? styles.activeTab : ''}`}
                onClick={() => { setType(t.value); setPage(1) }}
              >{isMobileScreen ? (STATUS_SHORT[t.value] ?? t.label) : t.label}</button>
            ))}
            {isMobileScreen && (
              <div className={styles.mobileViewControls}>
                <button
                  className={`${styles.typeChip} ${sort.startsWith('name') ? styles.typeChipActive : ''}`}
                  onClick={() => toggleSort('name')}
                >이름{sortLabel('name')}</button>
                <button
                  className={`${styles.typeChip} ${sort.startsWith('birth') ? styles.typeChipActive : ''}`}
                  onClick={() => toggleSort('birth')}
                >나이{sortLabel('birth')}</button>
                <button
                  className={styles.viewToggleSingle}
                  onClick={() => {
                    if (viewMode === 'list') { setViewMode('tile'); setTilePage(1) }
                    else setViewMode('list')
                  }}
                  title={viewMode === 'list' ? '타일 보기' : '목록 보기'}
                >
                  {viewMode === 'list' ? <GridIcon /> : <ListIcon />}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 일괄 삭제 바 ── */}
      {selectedIds.size > 0 && (
        <div className={styles.bulkBar}>
          <span>{selectedIds.size}명 선택됨</span>
          <button className={styles.bulkDeleteBtn} onClick={handleBulkDelete}>
            🗑 선택 삭제
          </button>
          <button className={styles.bulkExcelBtn} onClick={handleExcelDownload}>
            📥 Excel 저장
          </button>
          <button
            className={styles.bulkExcelBtn}
            onClick={() => setBulkVisitMembers((searchResults ?? data).filter(m => selectedIds.has(m.id)))}
          >
            🙏 심방등록
          </button>
          <button
            className={styles.bulkExcelBtn}
            onClick={() => setBulkNoteMembers((searchResults ?? data).filter(m => selectedIds.has(m.id)))}
          >
            📝 특이사항입력
          </button>
          <button
            className={styles.bulkSmsBtn}
            onClick={() => {
              const recipients = (searchResults ?? data)
                .filter(m => selectedIds.has(m.id) && m.phone)
                .map(m => ({ id: m.id, name: m.name, phone: m.phone }))
              setSmsModal({ open: true, recipients })
            }}
          >
            📱 문자 발송
          </button>
          <button className={styles.bulkCancelBtn} onClick={() => setSelectedIds(new Set())}>
            취소
          </button>
        </div>
      )}

      {/* ── 카운트 + 정렬 + 뷰 전환 + Excel — 폰 화면은 그룹탭 줄에 통합되어 이 블록을 렌더링하지 않음 ── */}
      {!isMobileScreen && (
        <div className={styles.listControls}>
          <span className={styles.countLabel}>
            {isSearchMode ? `검색 결과 ${displayList.length}명` : `총 ${total}명`}
          </span>
          <div className={styles.sortBtns}>
            <button
              className={`${styles.typeChip} ${sort.startsWith('name') ? styles.typeChipActive : ''}`}
              onClick={() => toggleSort('name')}
            >이름 {sortLabel('name')}</button>
            <button
              className={`${styles.typeChip} ${sort.startsWith('birth') ? styles.typeChipActive : ''}`}
              onClick={() => toggleSort('birth')}
            >나이 {sortLabel('birth')}</button>
          </div>
          {!isSearchMode && (
            <select
              className={styles.limitSelect}
              value={limit}
              onChange={e => { setLimit(Number(e.target.value)); setPage(1) }}
              disabled={viewMode === 'tile'}
              style={viewMode === 'tile' ? { opacity: 0.4 } : undefined}
            >
              {[20, 30, 40, 50].map(n => (
                <option key={n} value={n}>{n}명</option>
              ))}
            </select>
          )}
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('list')}
              title="목록 보기"
            ><ListIcon /></button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'tile' ? styles.viewBtnActive : ''}`}
              onClick={() => { setViewMode('tile'); setTilePage(1) }}
              title="타일 보기"
            ><GridIcon /></button>
          </div>
          <button
            className={styles.bulkExcelBtn}
            onClick={handleFullExport}
            title="업로드 양식과 동일한 30컬럼 전체 내보내기 (업데이트 작업용)"
            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
          >
            📋 교적 전체 내보내기
          </button>
        </div>
      )}
      </div>

      {/* ── 타일/목록 보기 ── */}
      {isMobileScreen ? (
        /* 폰 화면: 좌우 스와이프 시 이전/다음 페이지가 옆에 이미 걸려있다가
           손가락을 따라 함께 움직이는 3패널 캐러셀 구조 */
        <div
          ref={swipeStageRef}
          className={styles.swipeStage}
          onTouchStart={handleSwipeTouchStart}
        >
          {prevData && (
            <div key="prev" ref={prevPanelRef} className={styles.swipePanelSide}>
              {renderMobilePanel(prevData)}
            </div>
          )}
          <div key="current" ref={currentPanelRef} className={styles.swipePanelCurrent}>
            {renderMobilePanel(currentList)}
          </div>
          {nextData && (
            <div key="next" ref={nextPanelRef} className={styles.swipePanelSide}>
              {renderMobilePanel(nextData)}
            </div>
          )}
        </div>
      ) : viewMode === 'tile' ? (
        <div className={styles.tileGrid}>
          {tilePaged.map(m => (
            <div key={m.id} className={styles.tileCard} onClick={() => navigate(`/members/${m.id}`)}>
              {m.photo_url
                ? <img src={m.photo_url} className={styles.tilePhoto} alt={m.name} />
                : <div className={styles.tileInitial} style={{ background: genderColor(m.gender) }}>
                    {m.name?.[0]}
                  </div>
              }
              <span className={styles.tileName}>{m.name}</span>
              {m.position && <span className={styles.tilePosition} style={{ color: positionRankColor(m.position, rankMap).color }}>{displayPosition(m)}</span>}
            </div>
          ))}
          {tileTotal === 0 && (
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '20px 0' }}>
              {isSearchMode ? '검색 결과가 없습니다.' : '교인이 없습니다.'}
            </p>
          )}
        </div>
      ) : (
        /* ── 목록 보기 ── */
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: 20, padding: '0 4px' }}>
                  <input
                    type="checkbox"
                    checked={displayList.length > 0 && displayList.every(m => selectedIds.has(m.id))}
                    onChange={toggleSelectAll}
                    onClick={e => e.stopPropagation()}
                  />
                </th>
                <th className={styles.colPhoto}>사진</th><th className={styles.colName}>이름</th><th className={styles.colGender}>성별</th>
                <th className={styles.colExtra}>나이</th><th className={styles.colExtra}>직분</th>
                <th className={styles.colCommunity}>공동체소속</th>
                <th className={styles.colPhone}>연락처</th><th className={styles.colRegDate}>등록일</th><th className={styles.colStatus}>상태</th>
                {isSearchMode && conditions[0]?.q?.trim() && <th className={styles.matchTh}>조건1 매칭</th>}
                {isSearchMode && conditions[1]?.q?.trim() && <th className={styles.matchTh}>조건2 매칭</th>}
                {isSearchMode && conditions[2]?.q?.trim() && <th className={styles.matchTh}>조건3 매칭</th>}
                <th className={styles.colMgmt}>관리</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map(m => {
                const age = calcAge(m.birth_date)
                return (
                <tr
                  key={m.id}
                  onClick={() => navigate(`/members/${m.id}`)}
                  className={`${styles.row} ${selectedIds.has(m.id) ? styles.rowSelected : ''}`}
                >
                  <td onClick={e => toggleSelect(m.id, e)} style={{ cursor: 'default' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(m.id)}
                      onChange={() => {}}
                      onClick={e => toggleSelect(m.id, e)}
                    />
                  </td>
                  <td className={styles.colPhoto}>
                    {m.photo_url
                      ? <img src={m.photo_url} alt={m.name} className={styles.thumb} />
                      : <div className={styles.thumbPlaceholder}
                          style={{ background: genderColor(m.gender) }}>
                          {m.name[0]}
                        </div>
                    }
                  </td>
                  <td className={`${styles.name} ${styles.colName}`}>{m.name}</td>
                  <td className={styles.colGender}>{m.gender === 'M' ? '남' : m.gender === 'F' ? '여' : '-'}</td>
                  <td className={styles.colExtra}>{age != null ? `${age}세` : '-'}</td>
                  <td className={styles.colExtra}>
                    {m.position
                      ? <span className={styles.mPosBadge} style={positionRankColor(m.position, rankMap)}>{displayPosition(m)}</span>
                      : '-'}
                  </td>
                  <td className={styles.colCommunity}>{m.community_text || '-'}</td>
                  <td className={styles.colPhone}>
                    {m.phone ? (
                      <div className={styles.contactCell}>
                        <span className={styles.phoneNum}>{m.phone}</span>
                        <span className={styles.contactBtns}>
                          <a
                            href={isMobileUA ? `tel:${m.phone}` : undefined}
                            onClick={!isMobileUA ? (e) => { e.preventDefault(); e.stopPropagation() } : (e) => e.stopPropagation()}
                            style={{ textDecoration: 'none', lineHeight: 1, display: 'flex', alignItems: 'center' }}
                            title="전화"
                          ><PhoneIcon /></a>
                          <a
                            href={isMobileUA ? `sms:${m.phone}` : undefined}
                            onClick={!isMobileUA ? (e) => { e.preventDefault(); e.stopPropagation(); navigate('/sms') } : (e) => e.stopPropagation()}
                            style={{ textDecoration: 'none', lineHeight: 1, display: 'flex', alignItems: 'center' }}
                            title="문자"
                          ><MessageIcon /></a>
                        </span>
                      </div>
                    ) : '-'}
                  </td>
                  <td className={styles.colRegDate}>{m.registered_at ? dayjs(m.registered_at).format('YYYY.MM.DD') : '-'}</td>
                  <td className={styles.colStatus}><StatusBadge type={m.membership_type} /></td>
                  {isSearchMode && conditions[0]?.q?.trim() && (
                    <td className={styles.matchTd}><MatchCell member={m} query={conditions[0].q} /></td>
                  )}
                  {isSearchMode && conditions[1]?.q?.trim() && (
                    <td className={styles.matchTd}><MatchCell member={m} query={conditions[1].q} /></td>
                  )}
                  {isSearchMode && conditions[2]?.q?.trim() && (
                    <td className={styles.matchTd}><MatchCell member={m} query={conditions[2].q} /></td>
                  )}
                  <td onClick={e => e.stopPropagation()} className={styles.colMgmt} style={{ cursor: 'default', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className={`${styles.btnSm} ${styles.btnSmViolet}`}
                        onClick={() => setNotesModalMember(m)}>특이사항</button>
                      <button className={`${styles.btnSm} ${styles.btnSmGreen}`}
                        onClick={() => setVisitModalMember(m)}>심방등록</button>
                    </div>
                  </td>
                </tr>
                )
              })}
              {displayList.length === 0 && (
                <tr><td colSpan={isSearchMode ? 11 + conditions.filter(c=>c.q?.trim()).length : 11} className={styles.empty}>
                  {isSearchMode ? '검색 결과가 없습니다.' : '교인이 없습니다.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 페이지네이션 — 목록/타일 공통, 화면 하단에 항상 노출(스크롤 불필요) ── */}
      {viewMode === 'tile' ? (
        tileTotal > tileLimit && (
          <div className={styles.stickyPagination}>
            <button disabled={tilePage === 1} onClick={() => setTilePage(p => p - 1)}>이전</button>
            <span>{tilePage} / {Math.ceil(tileTotal / tileLimit)}</span>
            <button disabled={tilePage * tileLimit >= tileTotal} onClick={() => setTilePage(p => p + 1)}>다음</button>
          </div>
        )
      ) : (
        !isSearchMode && total > limit && (
          <div className={styles.stickyPagination}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>이전</button>
            <span>{page} / {Math.ceil(total / limit)}</span>
            <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}>다음</button>
          </div>
        )
      )}
      </div>

      <MemberNotesModal member={notesModalMember} onClose={() => setNotesModalMember(null)} />
      <VisitFormModal
        open={!!visitModalMember}
        onClose={() => setVisitModalMember(null)}
        editingVisit={null}
        initialMember={visitModalMember}
        onSaved={() => setVisitModalMember(null)}
      />
      <SmsSendModal
        open={smsModal.open}
        onClose={() => setSmsModal({ open: false, recipients: [] })}
        targetType="individual"
        recipients={smsModal.recipients}
        onSent={() => setSmsModal({ open: false, recipients: [] })}
      />
      <BulkVisitModal
        members={bulkVisitMembers}
        onClose={() => setBulkVisitMembers(null)}
        onDone={() => setSelectedIds(new Set())}
      />
      <BulkNoteModal
        members={bulkNoteMembers}
        onClose={() => setBulkNoteMembers(null)}
        onDone={() => setSelectedIds(new Set())}
      />
      <DeleteGuardModal {...deleteGuard.modalProps} message={`선택한 ${selectedIds.size}명을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`} />
    </PageShell>
  )
}
