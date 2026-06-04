import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { members as api } from '../../api'
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus'
import { genderColor } from '../../utils'
import dayjs from 'dayjs'
import styles from './Members.module.css'

const TYPES = [
  { value: '', label: '전체' },
  { value: 'active', label: '현재제적' },
  { value: 'inactive', label: '제적 외' },
  { value: 'transfer_out', label: '이명' },
  { value: 'deceased', label: '소천' },
]

const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent)

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
]

const FIELD_DISPLAY = {
  gender: v => v === 'M' ? '남' : v === 'F' ? '여' : v,
  membership_type: v => ({ active: '현재제적', inactive: '제적 외', transfer_out: '이명', deceased: '소천' }[v] ?? v),
}

function findFirstMatch(member, query) {
  if (!query?.trim()) return null
  const q = query.trim().toLowerCase()

  for (const [field, label] of SEARCH_FIELDS) {
    const raw = member[field]
    if (!raw) continue
    const displayVal = FIELD_DISPLAY[field] ? FIELD_DISPLAY[field](raw) : raw
    const str = String(displayVal)
    const idx = str.toLowerCase().indexOf(q)
    if (idx === -1) continue
    const before  = str.slice(Math.max(0, idx - 8), idx)
    const matched = str.slice(idx, idx + q.length)
    const after   = str.slice(idx + q.length, idx + q.length + 10)
    return { label, before, matched, after: after + ((idx + q.length + 10 < str.length) ? '…' : '') }
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

function StatusBadge({ type }) {
  const map = {
    active:       { label: '현재제적', color: '#22c55e' },
    inactive:     { label: '제적 외',  color: '#f59e0b' },
    transfer_out: { label: '이명',    color: '#94a3b8' },
    deceased:     { label: '소천',    color: '#6b7280' },
  }
  const s = map[type] ?? { label: type, color: '#94a3b8' }
  return (
    <span style={{ background: s.color, color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem' }}>
      {s.label}
    </span>
  )
}

export default function MemberList() {
  const navigate = useNavigate()

  // ── 일반 목록 state ───────────────────────────────────────
  const [data, setData]   = useState([])
  const [total, setTotal] = useState(0)
  const [q, setQ]         = useState('')
  const [type, setType]   = useState('active')
  const [page, setPage]   = useState(1)
  const [limit, setLimit] = useState(50)

  // ── 조건검색 state ────────────────────────────────────────
  const [conditions, setConditions] = useState([{ q: '' }])
  const [sort, setSort]             = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching]   = useState(false)

  // ── 뷰 모드 + 타일 페이지네이션 ──────────────────────────────
  const [viewMode, setViewMode] = useState('list')
  const [tilePage, setTilePage] = useState(1)
  const [tileCols, setTileCols] = useState(4)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const tileGridRef = useRef(null)

  const loadVerRef = useRef(0)

  // ── 일반 목록 로드 ────────────────────────────────────────
  const load = useCallback(async () => {
    if (searchResults !== null) return
    const ver = ++loadVerRef.current
    try {
      const res = await api.list({ q, type, page, limit, sort: sort || undefined, name_only: 1 })
      if (ver !== loadVerRef.current) return
      setData(res.data.data)
      setTotal(res.data.total)
    } catch { /* silent */ }
  }, [q, type, page, limit, sort, searchResults])

  useEffect(() => { load() }, [load])
  useRefreshOnFocus(load)

  // ── 타일 열 수 감지 (ResizeObserver) ─────────────────────
  useEffect(() => {
    if (viewMode !== 'tile') return
    const el = tileGridRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      setTileCols(Math.max(2, Math.floor(w / 100)))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [viewMode])

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
        if (sort === 'name_asc')   sorted.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
        if (sort === 'name_desc')  sorted.sort((a, b) => b.name.localeCompare(a.name, 'ko'))
        if (sort === 'birth_asc')  sorted.sort((a, b) => (a.birth_date || '9999') > (b.birth_date || '9999') ? 1 : -1)
        if (sort === 'birth_desc') sorted.sort((a, b) => (a.birth_date || '0000') < (b.birth_date || '0000') ? 1 : -1)
        return sorted
      })
    }
  }, [sort])

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
          직분: m.position || '',
          교인구분: m.membership_category || '',
          등록일: m.registered_at ? dayjs(m.registered_at).format('YYYY.MM.DD') : '',
          상태: { active: '현재제적', inactive: '제적 외', transfer_out: '이명', deceased: '소천' }[m.membership_type] || m.membership_type,
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

  const handleBulkDelete = async () => {
    const ids = [...selectedIds]
    if (!ids.length) return
    if (!confirm(`선택한 ${ids.length}명을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return
    try {
      await api.bulkRemove(ids)
      setSelectedIds(new Set())
      load()
    } catch {
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  const displayList  = searchResults ?? data
  const isSearchMode = searchResults !== null
  const sortLabel = (key) =>
    sort === `${key}_asc` ? ' ↑' : sort === `${key}_desc` ? ' ↓' : ''
  const hasCondInput = conditions.some(c => c.q?.trim())

  const tileLimit = 10
  const tileTotal = displayList.length
  const tilePaged = displayList.slice((tilePage - 1) * tileLimit, tilePage * tileLimit)

  return (
    <div>
      <div className={styles.header}>
        <h1>교적 관리</h1>
        <Link to="/members/new" className={styles.btnPrimary}>+ 교인 등록</Link>
      </div>

      {/* ── 통합 툴바 (1줄) ── */}
      <div className={styles.toolbar}>
        {/* 이름 빠른 검색 */}
        <input
          className={styles.searchInput}
          placeholder="이름검색"
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1) }}
          disabled={isSearchMode}
          style={isSearchMode ? { opacity: 0.4, width: 80, flexShrink: 0 } : { width: 80, flexShrink: 0 }}
        />

        {/* 조건 검색 인라인 영역 */}
        <div className={styles.condInline}>
          {conditions.map((cond, i) => (
            <div key={i} className={styles.condRow}>
              {i > 0 && (
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
                placeholder={i === 0 ? '조건 검색' : `조건 ${i + 1}`}
                value={cond.q}
                onChange={e => handleCondChange(i, e.target.value)}
              />
              {conditions.length > 1 && (
                <button className={styles.condRemoveBtn} onClick={() => removeCondition(i)}>×</button>
              )}
            </div>
          ))}
          {conditions.length < 3 && (
            <button className={styles.condAddBtn} onClick={addCondition} title="조건 추가">+</button>
          )}
          {isSearchMode && (
            <button className={styles.resetBtn} onClick={handleReset}>× 초기화</button>
          )}
        </div>

        {/* 타입 탭 — 검색 모드 아닐 때 */}
        {!isSearchMode && (
          <div className={styles.typeTabs}>
            {TYPES.map(t => (
              <button
                key={t.value}
                className={`${styles.tab} ${type === t.value ? styles.activeTab : ''}`}
                onClick={() => { setType(t.value); setPage(1) }}
              >{t.label}</button>
            ))}
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
          <button className={styles.bulkCancelBtn} onClick={() => setSelectedIds(new Set())}>
            취소
          </button>
        </div>
      )}

      {/* ── 카운트 + 정렬 + 뷰 전환 + Excel ── */}
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
      </div>

      {/* ── 타일 보기 ── */}
      {viewMode === 'tile' ? (
        <>
          <div className={styles.tileGrid} ref={tileGridRef}>
            {tilePaged.map(m => (
              <div key={m.id} className={styles.tileCard} onClick={() => navigate(`/members/${m.id}`)}>
                {m.photo_url
                  ? <img src={m.photo_url} className={styles.tilePhoto} alt={m.name} />
                  : <div className={styles.tileInitial} style={{ background: genderColor(m.gender) }}>
                      {m.name?.[0]}
                    </div>
                }
                <span className={styles.tileName}>{m.name}</span>
                <StatusBadge type={m.membership_type} />
              </div>
            ))}
            {tileTotal === 0 && (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '20px 0' }}>
                {isSearchMode ? '검색 결과가 없습니다.' : '교인이 없습니다.'}
              </p>
            )}
          </div>
          {tileTotal > tileLimit && (
            <div className={styles.pagination}>
              <button disabled={tilePage === 1} onClick={() => setTilePage(p => p - 1)}>이전</button>
              <span>{tilePage} / {Math.ceil(tileTotal / tileLimit)}</span>
              <button disabled={tilePage * tileLimit >= tileTotal} onClick={() => setTilePage(p => p + 1)}>다음</button>
            </div>
          )}
        </>
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
                <th>사진</th><th>이름</th><th>성별</th>
                <th>연락처</th><th>등록일</th><th>상태</th>
                {isSearchMode && conditions[0]?.q?.trim() && <th className={styles.matchTh}>조건1 매칭</th>}
                {isSearchMode && conditions[1]?.q?.trim() && <th className={styles.matchTh}>조건2 매칭</th>}
                {isSearchMode && conditions[2]?.q?.trim() && <th className={styles.matchTh}>조건3 매칭</th>}
              </tr>
            </thead>
            <tbody>
              {displayList.map(m => (
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
                  <td>
                    {m.photo_url
                      ? <img src={m.photo_url} alt={m.name} className={styles.thumb} />
                      : <div className={styles.thumbPlaceholder}
                          style={{ background: genderColor(m.gender) }}>
                          {m.name[0]}
                        </div>
                    }
                  </td>
                  <td className={styles.name}>{m.name}</td>
                  <td>{m.gender === 'M' ? '남' : m.gender === 'F' ? '여' : '-'}</td>
                  <td>
                    {m.phone ? (
                      <div className={styles.contactCell}>
                        <span className={styles.phoneNum}>{m.phone}</span>
                        <span className={styles.contactBtns}>
                          <a
                            href={isMobile ? `tel:${m.phone}` : undefined}
                            onClick={!isMobile ? (e) => { e.preventDefault(); e.stopPropagation() } : (e) => e.stopPropagation()}
                            style={{ textDecoration: 'none', lineHeight: 1, display: 'flex', alignItems: 'center' }}
                            title="전화"
                          ><PhoneIcon /></a>
                          <a
                            href={isMobile ? `sms:${m.phone}` : undefined}
                            onClick={!isMobile ? (e) => { e.preventDefault(); e.stopPropagation(); navigate('/sms') } : (e) => e.stopPropagation()}
                            style={{ textDecoration: 'none', lineHeight: 1, display: 'flex', alignItems: 'center' }}
                            title="문자"
                          ><MessageIcon /></a>
                        </span>
                      </div>
                    ) : '-'}
                  </td>
                  <td>{m.registered_at ? dayjs(m.registered_at).format('YYYY.MM.DD') : '-'}</td>
                  <td><StatusBadge type={m.membership_type} /></td>
                  {isSearchMode && conditions[0]?.q?.trim() && (
                    <td className={styles.matchTd}><MatchCell member={m} query={conditions[0].q} /></td>
                  )}
                  {isSearchMode && conditions[1]?.q?.trim() && (
                    <td className={styles.matchTd}><MatchCell member={m} query={conditions[1].q} /></td>
                  )}
                  {isSearchMode && conditions[2]?.q?.trim() && (
                    <td className={styles.matchTd}><MatchCell member={m} query={conditions[2].q} /></td>
                  )}
                </tr>
              ))}
              {displayList.length === 0 && (
                <tr><td colSpan={isSearchMode ? 7 + conditions.filter(c=>c.q?.trim()).length : 7} className={styles.empty}>
                  {isSearchMode ? '검색 결과가 없습니다.' : '교인이 없습니다.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 페이지네이션 (일반 목록 모드만) ── */}
      {!isSearchMode && total > limit && (
        <div className={styles.pagination}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>이전</button>
          <span>{page} / {Math.ceil(total / limit)}</span>
          <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}>다음</button>
        </div>
      )}
    </div>
  )
}
