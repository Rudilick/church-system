// /-/
import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { members as memberApi, families as familyApi, communities as communityApi, departments as deptApi, positions as positionsApi, enumValues as enumValuesApi } from '../../api'
import BulkUploadModal from './BulkUploadModal'
import { useMemberAll } from '../../hooks/useMemberAll'
import { useAutocompleteKeyNav } from '../../hooks/useAutocompleteKeyNav'
import { genderColor } from '../../utils'
import toast from 'react-hot-toast'
import styles from './Members.module.css'

// ─── Photo Crop Modal ─────────────────────────────────────
const CROP_SIZE = 300
const VIEWPORT = 220

function PhotoCropModal({ src, onConfirm, onCancel }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const imgRef = useRef()

  const onMouseDown = e => {
    dragging.current = true
    last.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseMove = e => {
    if (!dragging.current) return
    setOffset(o => ({ x: o.x + e.clientX - last.current.x, y: o.y + e.clientY - last.current.y }))
    last.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseUp = () => { dragging.current = false }

  const onTouchStart = e => {
    dragging.current = true
    last.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchMove = e => {
    if (!dragging.current) return
    e.preventDefault()
    setOffset(o => ({
      x: o.x + e.touches[0].clientX - last.current.x,
      y: o.y + e.touches[0].clientY - last.current.y,
    }))
    last.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = () => { dragging.current = false }

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }) // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = () => {
    const img = imgRef.current
    if (!img) return
    const ratio = CROP_SIZE / VIEWPORT
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = CROP_SIZE
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2)
    ctx.clip()
    const scaledW = img.naturalWidth * scale * ratio
    const scaledH = img.naturalHeight * scale * ratio
    const dx = (CROP_SIZE - scaledW) / 2 + offset.x * ratio
    const dy = (CROP_SIZE - scaledH) / 2 + offset.y * ratio
    ctx.drawImage(img, dx, dy, scaledW, scaledH)
    onConfirm(canvas.toDataURL('image/jpeg', 0.9))
  }

  return (
    <div className={styles.cropModal}>
      <div className={styles.cropBox}>
        <p className={styles.cropTitle}>얼굴 위치 조정</p>
        <div
          className={styles.cropViewport}
          style={{ touchAction: 'none' }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
        >
          <img
            ref={imgRef}
            src={src}
            alt="crop"
            className={styles.cropImg}
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
            draggable={false}
          />
        </div>
        <div className={styles.cropZoomRow}>
          <span className={styles.cropZoomLabel}>축소</span>
          <input
            type="range" min="0.3" max="3" step="0.01" value={scale}
            onChange={e => setScale(Number(e.target.value))}
            className={styles.cropSlider}
          />
          <span className={styles.cropZoomLabel}>확대</span>
        </div>
        <div className={styles.cropActions}>
          <button type="button" className={styles.btnSecondary} onClick={onCancel}>취소</button>
          <button type="button" className={styles.btnPrimary} onClick={confirm}>확인</button>
        </div>
      </div>
    </div>
  )
}

// ─── Photo Upload ──────────────────────────────────────────
function PhotoUpload({ value, onFileSelect }) {
  const inputRef = useRef()
  const handleFile = e => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { toast.error('3MB 이하 이미지만 등록 가능합니다.'); return }
    const reader = new FileReader()
    reader.onload = ev => onFileSelect(ev.target.result)
    reader.readAsDataURL(file)
  }
  return (
    <div className={styles.photoUpload} onClick={() => inputRef.current.click()}>
      {value
        ? <img src={value} alt="프로필" className={styles.photoPreview} />
        : <div className={styles.photoPlaceholderBox}><span>📷</span><span>사진 등록</span></div>
      }
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
    </div>
  )
}

// ─── Birth Date Picker (타일 선택기) ───────────────────────
const DECADES = [1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020]
const STEP_PREV = { year: 'decade', month: 'year', day: 'month' }
const STEP_LABEL = { decade: '년대 선택', year: '연도 선택', month: '월 선택', day: '일 선택' }

function BirthDatePicker({ value, onChange, lunar, onLunarChange }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState('decade')
  const [sel, setSel] = useState({ decade: null, year: null, month: null })
  const ref = useRef()

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (value) {
      const parts = value.split('-').map(Number)
      const y = parts[0], m = parts[1]
      if (y) setSel({ decade: Math.floor(y / 10) * 10, year: y, month: m || null })
    }
  }, [value])

  const back = () => setStep(s => STEP_PREV[s])
  const daysInMonth = (y, m) => (y && m) ? new Date(y, m, 0).getDate() : 31
  const curDay = value ? Number(value.split('-')[2]) : null

  const selectDay = d => {
    const mm = String(sel.month).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    onChange(`${sel.year}-${mm}-${dd}`)
    setOpen(false)
    setStep('decade')
  }

  const displayValue = value
    ? `${value.split('-')[0]}년 ${Number(value.split('-')[1]) || ''}월 ${Number(value.split('-')[2]) || ''}일`
    : '날짜 선택'

  return (
    <div ref={ref} className={styles.datePicker}>
      <div className={styles.datePickerTrigger}>
        <button type="button" className={styles.datePickerBtn} onClick={() => setOpen(o => !o)}>
          {displayValue}
        </button>
        <label className={styles.lunarLabel}>
          <input type="checkbox" checked={lunar} onChange={e => onLunarChange(e.target.checked)} />
          음력
        </label>
      </div>
      {open && (
        <div className={styles.datePickerPanel}>
          <div className={styles.datePickerHeader}>
            {step !== 'decade' && (
              <button type="button" className={styles.dateBackBtn} onClick={back}>← 이전</button>
            )}
            <span className={styles.dateStepLabel}>{STEP_LABEL[step]}</span>
          </div>
          <div className={`${styles.dateTileGrid} ${styles[`dateTile_${step}`] || ''}`}>
            {step === 'decade' && DECADES.map(d => (
              <button key={d} type="button"
                className={`${styles.dateTile} ${sel.decade === d ? styles.dateTileActive : ''}`}
                onClick={() => { setSel(s => ({ ...s, decade: d })); setStep('year') }}>
                {d}년대
              </button>
            ))}
            {step === 'year' && Array.from({ length: 10 }, (_, i) => sel.decade + i).map(y => (
              <button key={y} type="button"
                className={`${styles.dateTile} ${sel.year === y ? styles.dateTileActive : ''}`}
                onClick={() => { setSel(s => ({ ...s, year: y })); setStep('month') }}>
                {y}
              </button>
            ))}
            {step === 'month' && Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <button key={m} type="button"
                className={`${styles.dateTile} ${sel.month === m ? styles.dateTileActive : ''}`}
                onClick={() => { setSel(s => ({ ...s, month: m })); setStep('day') }}>
                {m}월
              </button>
            ))}
            {step === 'day' && Array.from({ length: daysInMonth(sel.year, sel.month) }, (_, i) => i + 1).map(d => (
              <button key={d} type="button"
                className={`${styles.dateTile} ${curDay === d ? styles.dateTileActive : ''}`}
                onClick={() => selectDay(d)}>
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Gender Toggle ─────────────────────────────────────────
function GenderToggle({ value, onChange }) {
  return (
    <div className={styles.genderToggle}>
      <button type="button"
        className={`${styles.genderBtn} ${value === 'M' ? styles.genderM : ''}`}
        onClick={() => onChange(value === 'M' ? '' : 'M')}>남</button>
      <button type="button"
        className={`${styles.genderBtn} ${value === 'F' ? styles.genderF : ''}`}
        onClick={() => onChange(value === 'F' ? '' : 'F')}>여</button>
    </div>
  )
}

// ─── Date Input (8자리 자동 포맷) ─────────────────────────
function DateInput({ value, onChange, placeholder = 'YYYYMMDD' }) {
  const handleChange = e => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 8)
    let out = raw
    if (raw.length > 4) out = raw.slice(0, 4) + '-' + raw.slice(4)
    if (raw.length > 6) out = raw.slice(0, 4) + '-' + raw.slice(4, 6) + '-' + raw.slice(6)
    onChange(out)
  }
  return <input value={value} onChange={handleChange} placeholder={placeholder} maxLength={10} />
}

// ─── Phone Input ───────────────────────────────────────────
function PhoneInput({ value, onChange }) {
  const handleChange = e => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 11)
    let out = raw
    if (raw.length > 3 && raw.length <= 7) out = raw.slice(0, 3) + '-' + raw.slice(3)
    if (raw.length > 7) out = raw.slice(0, 3) + '-' + raw.slice(3, 7) + '-' + raw.slice(7)
    onChange(out)
  }
  return <input value={value} onChange={handleChange} placeholder="010-0000-0000" />
}

// ─── Home Phone Input (유선전화 자동 포맷) ─────────────────
function formatHomePhone(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.startsWith('02')) {
    const local = d.slice(2)
    if (local.length === 0) return '02'
    if (local.length <= 3) return `02-${local}`
    if (local.length < 8) return `02-${local.slice(0,3)}-${local.slice(3)}`
    return `02-${local.slice(0,4)}-${local.slice(4,8)}`
  }
  const area = d.slice(0, 3)
  const local = d.slice(3)
  if (local.length === 0) return area
  if (local.length <= 3) return `${area}-${local}`
  if (local.length < 8) return `${area}-${local.slice(0,3)}-${local.slice(3)}`
  return `${area}-${local.slice(0,4)}-${local.slice(4,8)}`
}

function HomePhoneInput({ value, onChange }) {
  return (
    <input
      value={value}
      onChange={e => onChange(formatHomePhone(e.target.value))}
      placeholder="02-000-0000"
      maxLength={13}
    />
  )
}

// ─── AutoSuggest (DB 기반) ────────────────────────────────
function AutoSuggest({ value, onChange, placeholder, apiField }) {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState([])

  useEffect(() => {
    if (!apiField || !value?.trim()) { setSuggestions([]); return }
    let cancelled = false
    memberApi.suggest(apiField, value)
      .then(r => { if (!cancelled) setSuggestions(Array.isArray(r) ? r : []) })
      .catch(() => { if (!cancelled) setSuggestions([]) })
    return () => { cancelled = true }
  }, [value, apiField])

  const filtered = suggestions.filter(h => h !== value)

  const select = item => { onChange(item); setOpen(false) }

  const { activeIndex, handleKeyDown, resetIndex } = useAutocompleteKeyNav(
    filtered,
    item => select(item),
    () => setOpen(false)
  )

  return (
    <div className={styles.autoSuggest}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); resetIndex() }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => {
          if (open && filtered.length > 0) { handleKeyDown(e) }
        }}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <ul className={styles.suggestList}>
          {filtered.map((item, i) => (
            <li key={item} className={`${styles.suggestItem} ${i === activeIndex ? styles.suggestItemActive : ''}`}>
              <span onMouseDown={() => select(item)}>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Kakao 주소 검색 ───────────────────────────────────────
function KakaoAddressBtn({ onSelect }) {
  const open = () => {
    if (!window.daum?.Postcode) { toast.error('주소 검색 서비스를 로드 중입니다.'); return }
    new window.daum.Postcode({ oncomplete: d => onSelect(d.roadAddress || d.address) }).open()
  }
  return <button type="button" className={styles.addressBtn} onClick={open}>🔍 주소 검색</button>
}

// ─── 교구 계층 드롭박스 (단일 선택) ─────────────────────────
function CommunityDropdowns({ value, onChange }) {
  const [levels, setLevels] = useState([])
  const [tree, setTree] = useState([])
  const [path, setPath] = useState([])

  useEffect(() => {
    Promise.all([communityApi.getSettings(), communityApi.tree()])
      .then(([sRes, tRes]) => {
        setLevels(sRes.data?.levels || [])
        const treeData = Array.isArray(tRes.data) ? tRes.data : []
        setTree(treeData)
        if (value) {
          const found = findPathInTree(treeData, value)
          if (found) setPath(found)
        }
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (lvl, id) => {
    const newPath = [...path.slice(0, lvl), id].filter(Boolean)
    setPath(newPath)
    const children = getChildrenAt(tree, newPath)
    if (children.length === 0) onChange(id)
    else onChange('')
  }

  const levelCount = Math.max(levels.length, 1)

  return (
    <div className={styles.communityDropdowns}>
      {Array.from({ length: levelCount }, (_, lvl) => {
        const options = getChildrenAt(tree, path.slice(0, lvl))
        if (lvl > 0 && options.length === 0) return null
        const label = levels[lvl]?.name || (lvl === 0 ? '교구 선택' : '하위 선택')
        return (
          <select key={lvl} value={path[lvl] || ''}
            onChange={e => handleSelect(lvl, e.target.value)}
            className={styles.deptSelect}>
            <option value="">— {label} —</option>
            {options.map(n => <option key={n.id} value={String(n.id)}>{n.name}</option>)}
          </select>
        )
      })}
    </div>
  )
}

// ─── 인도자 자동완성 입력 ──────────────────────────────────
function IntroducerInput({ value, onChange }) {
  const { search } = useMemberAll()
  const [q, setQ] = useState(value || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => { setQ(value || '') }, [value])

  const select = m => {
    onChange(m.name)
    setQ(m.name)
    setResults([])
    setOpen(false)
  }

  const { activeIndex, handleKeyDown, resetIndex } = useAutocompleteKeyNav(
    results,
    m => select(m),
    () => setOpen(false)
  )

  const handleInput = val => {
    setQ(val)
    setOpen(true)
    setResults(val.trim() ? search(val) : [])
    resetIndex()
  }

  return (
    <div className={styles.searchWrap}>
      <input
        value={q}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => { if (q.trim()) setOpen(true) }}
        onBlur={() => setTimeout(() => { setResults([]); setOpen(false) }, 150)}
        onKeyDown={e => { if (open && results.length > 0) handleKeyDown(e) }}
        placeholder="인도한 교인 이름"
      />
      {open && results.length > 0 && (
        <ul className={styles.familyResults}>
          {results.map((m, i) => (
            <li key={m.id}
              className={i === activeIndex ? styles.familyResultActive : ''}
              onMouseDown={() => select(m)}>
              {m.photo_url
                ? <img src={m.photo_url} alt={m.name} className={styles.suggAvatar} />
                : <div className={styles.suggAvatar} style={{ background: genderColor(m.gender) }}>{m.name[0]}</div>}
              <div className={styles.suggInfo}>
                <span className={styles.suggestName}>{m.name}</span>
                {m.position && <span className={styles.suggestPos}>{m.position}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── 가족관계 패널 ─────────────────────────────────────────
const RELATION_LABELS = {
  spouse: '배우자',
  parent: '부모', child: '자녀',
  father: '부', mother: '모',
  sibling: '형제·자매',
  grandparent: '조부모', grandchild: '손자녀',
  paternal_grandfather: '조부', paternal_grandmother: '조모',
  maternal_grandfather: '외조부', maternal_grandmother: '외조모',
  great_grandparent: '증조부모', great_grandchild: '증손자녀',
  aunt_paternal: '고모', uncle_paternal: '삼촌',
  aunt_maternal: '이모', uncle_maternal: '외삼촌',
  nephew_niece: '조카',
  cousin: '사촌',
  시부: '시부', 시모: '시모',
  장인: '장인', 장모: '장모',
  며느리: '며느리', 사위: '사위',
}
const RELATION_OPTIONS = [
  { value: 'spouse',                label: '배우자' },
  { value: 'father',                label: '부' },
  { value: 'mother',                label: '모' },
  { value: 'child',                 label: '자녀' },
  { value: 'sibling',               label: '형제·자매' },
  { value: '시부',                  label: '시부 (남편 아버지)' },
  { value: '시모',                  label: '시모 (남편 어머니)' },
  { value: '장인',                  label: '장인 (아내 아버지)' },
  { value: '장모',                  label: '장모 (아내 어머니)' },
  { value: 'paternal_grandfather',  label: '조부' },
  { value: 'paternal_grandmother',  label: '조모' },
  { value: 'maternal_grandfather',  label: '외조부' },
  { value: 'maternal_grandmother',  label: '외조모' },
  { value: 'grandchild',            label: '손자녀' },
  { value: 'great_grandparent',     label: '증조부모' },
  { value: 'great_grandchild',      label: '증손자녀' },
  { value: 'aunt_paternal',         label: '고모' },
  { value: 'uncle_paternal',        label: '삼촌' },
  { value: 'aunt_maternal',         label: '이모' },
  { value: 'uncle_maternal',        label: '외삼촌' },
  { value: 'nephew_niece',          label: '조카' },
  { value: 'cousin',                label: '사촌' },
]

// 시부/시모/장인/장모 추가 시, 현재 교인의 배우자에게도 부/모 관계 자동 연결
const INLAW_RULES = {
  '시부': 'father',
  '시모': 'mother',
  '장인': 'father',
  '장모': 'mother',
}

const AUTO_RULES = {
  father: [
    { sourceRel: 'spouse', myRel: 'mother' },
    { sourceRel: 'father', myRel: 'paternal_grandfather' },
    { sourceRel: 'mother', myRel: 'paternal_grandmother' },
  ],
  mother: [
    { sourceRel: 'spouse', myRel: 'father' },
    { sourceRel: 'father', myRel: 'maternal_grandfather' },
    { sourceRel: 'mother', myRel: 'maternal_grandmother' },
  ],
}

function normAutoRel(type) {
  const m = { spouse: 'spouse', '배우자': 'spouse', father: 'father', mother: 'mother', parent: 'parent', '부모': 'parent' }
  return m[type] ?? type
}

function FamilyPanel({ memberId, family, onRefresh }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [relation, setRelation] = useState('spouse')
  const { search: filterMembers } = useMemberAll()

  const handleSearch = (val) => {
    setSearch(val)
    setResults(val.trim()
      ? filterMembers(val).filter(m => m.id !== Number(memberId))
      : []
    )
  }

  const add = async m => {
    try {
      await familyApi.add({ member_id: Number(memberId), related_member_id: m.id, relation_type: relation })

      let autoCount = 0

      // 기존 AUTO_RULES: 추가된 교인(m)의 가족 조회 후 자동 연결
      const rules = AUTO_RULES[relation]
      if (rules) {
        const { data } = await memberApi.get(m.id)
        const relFam = data.family || []
        const myIds = new Set([...family.map(f => f.id), Number(memberId)])
        for (const rule of rules) {
          const targets = relFam.filter(f =>
            (f.relation_type === rule.sourceRel || normAutoRel(f.relation_type) === rule.sourceRel)
            && !myIds.has(f.id)
          )
          for (const t of targets) {
            try {
              await familyApi.add({ member_id: Number(memberId), related_member_id: t.id, relation_type: rule.myRel })
              autoCount++
            } catch { /* 중복 무시 */ }
          }
        }
      }

      // INLAW_RULES: 현재 교인의 배우자 → 추가된 교인(m)을 부/모로 자동 연결
      const inlawSpouseRel = INLAW_RULES[relation]
      if (inlawSpouseRel) {
        const mySpouses = family.filter(f => normAutoRel(f.relation_type) === 'spouse')
        for (const sp of mySpouses) {
          try {
            await familyApi.add({ member_id: sp.id, related_member_id: m.id, relation_type: inlawSpouseRel })
            autoCount++
          } catch { /* 중복 무시 */ }
        }
      }

      toast.success(autoCount > 0
        ? `${m.name} 추가 + 연결 가족 ${autoCount}명 자동 등록됐습니다.`
        : `${m.name}을(를) ${RELATION_LABELS[relation] ?? relation}으로 추가했습니다.`)
      setSearch(''); setResults([])
      onRefresh()
    } catch { toast.error('추가에 실패했습니다.') }
  }

  const remove = async relatedId => {
    await familyApi.remove({ member_id: Number(memberId), related_member_id: relatedId })
    toast.success('삭제했습니다.')
    onRefresh()
  }

  return (
    <div className={styles.familyPanel}>
      {/* 가족 추가 */}
      <div className={styles.familyAdd}>
        <select value={relation} onChange={e => setRelation(e.target.value)} className={styles.relationSelect}>
          {RELATION_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <div className={styles.searchWrap}>
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="교인 이름으로 검색…"
          />
          {results.length > 0 && (
            <ul className={styles.familyResults}>
              {results.map(m => (
                <li key={m.id} onMouseDown={() => add(m)}>
                  {m.photo_url
                    ? <img src={m.photo_url} alt={m.name} className={styles.suggAvatar} />
                    : <div className={styles.suggAvatar}
                        style={{ background: genderColor(m.gender) }}>
                        {m.name[0]}
                      </div>
                  }
                  <div className={styles.suggInfo}>
                    <span className={styles.suggestName}>{m.name}</span>
                    {m.position && <span className={styles.suggestPos}>{m.position}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 현재 가족 목록 */}
      {family.length > 0 && (
        <ul className={styles.familyList}>
          {family.map(m => (
            <li key={m.id} className={styles.familyListItem}>
              <span className={styles.relTag}>{RELATION_LABELS[m.relation_type]}</span>
              <span className={styles.relName}>{m.name}</span>
              <button type="button" onClick={() => remove(m.id)}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── 특정 레벨의 children 반환 ────────────────────────────
function getChildrenAt(tree, path) {
  let current = tree
  for (const id of path) {
    const found = current.find(n => String(n.id) === String(id))
    if (!found) return []
    current = found.children || []
  }
  return current
}

// ─── 트리에서 특정 id까지의 경로 탐색 ────────────────────
function findPathInTree(nodes, targetId, current = []) {
  for (const node of nodes) {
    const path = [...current, String(node.id)]
    if (String(node.id) === String(targetId)) return path
    const found = findPathInTree(node.children || [], targetId, path)
    if (found) return found
  }
  return null
}

// ─── 부서/직책 배정 패널 ───────────────────────────────────
function DeptAssignPanel({ assignments, onChange }) {
  const [deptTree, setDeptTree] = useState([])

  useEffect(() => {
    deptApi.tree().then(r => {
      const tree = r.data || []
      setDeptTree(tree)
      // 기존 배정에 _path 복원 (수정 모드)
      onChange(assignments.map(a => {
        if (a._path && a._path.length > 0) return a
        if (!a.department_id) return a
        const path = findPathInTree(tree, a.department_id)
        return { ...a, _path: path || [String(a.department_id)] }
      }))
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const addRow = () => onChange([...assignments, { department_id: '', job_title: '', _path: [] }])

  const updateRow = (i, field, val) => {
    const next = assignments.map((a, idx) => idx === i ? { ...a, [field]: val } : a)
    onChange(next)
  }

  const updatePath = (i, levelIdx, val) => {
    const a = assignments[i]
    const newPath = [...(a._path || []).slice(0, levelIdx), val].filter(Boolean)
    // 선택된 최하위 id를 department_id로 저장
    const children = getChildrenAt(deptTree, newPath)
    const isLeaf = children.length === 0
    onChange(assignments.map((row, idx) =>
      idx === i ? { ...row, _path: newPath, department_id: isLeaf ? val : '' } : row
    ))
  }

  const removeRow = i => onChange(assignments.filter((_, idx) => idx !== i))

  return (
    <div className={styles.deptPanel}>
      <div className={styles.deptPanelHeader}>
        <span className={styles.deptPanelTitle}>부서 배정</span>
        <button type="button" className={styles.deptAddBtn} onClick={addRow}>+ 부서 추가</button>
      </div>
      {assignments.length === 0 && (
        <p className={styles.deptEmpty}>배정된 부서가 없습니다.</p>
      )}
      {assignments.map((a, i) => {
        const path = a._path || []
        const selects = []
        for (let lvl = 0; lvl <= path.length; lvl++) {
          const options = getChildrenAt(deptTree, path.slice(0, lvl))
          if (lvl > 0 && options.length === 0) break
          selects.push(
            <select
              key={lvl}
              value={path[lvl] || ''}
              onChange={e => updatePath(i, lvl, e.target.value)}
              className={styles.deptSelect}
              style={{ flex: '1 1 120px', minWidth: 100 }}
            >
              <option value="">{lvl === 0 ? '부서 선택' : '하위 선택'}</option>
              {options.map(d => (
                <option key={d.id} value={String(d.id)}>{d.name}</option>
              ))}
            </select>
          )
        }
        return (
          <div key={i} className={styles.deptRow} style={{ flexWrap: 'wrap', gap: 6 }}>
            {selects}
            <input
              className={styles.deptJobInput}
              value={a.job_title}
              onChange={e => updateRow(i, 'job_title', e.target.value)}
              placeholder="직책 (예: 부장, 총무…)"
              style={{ flex: '1 1 100px', minWidth: 80 }}
            />
            <button type="button" className={styles.deptRemoveBtn} onClick={() => removeRow(i)}>×</button>
          </div>
        )
      })}
    </div>
  )
}

// ─── 메인 폼 ───────────────────────────────────────────────
const EMPTY = {
  name: '', name_en: '', gender: '', birth_date: '', birth_lunar: false,
  phone: '', home_phone: '', email: '', address: '', address_detail: '',
  workplace: '', school: '', membership_type: 'active', position: '',
  registered_at: '', baptism_date: '', note: '', photo_url: '',
  membership_category: '', faith_level: '', school_department: '',
  household_head_name: '', household_relation: '',
  introducer_name: '', previous_church: '', previous_church_position: '',
  occupation: '', anniversary_date: '',
  staff_category: '', staff_role: '',
}

export default function MemberForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(EMPTY)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [selectedCommunity, setSelectedCommunity] = useState('')
  const [initCommunity, setInitCommunity] = useState('')
  const [family, setFamily] = useState([])
  const [deptAssignments, setDeptAssignments] = useState([])
  const [cropSrc, setCropSrc] = useState(null)
  const [positionList, setPositionList] = useState([])
  const [memberCategories, setMemberCategories] = useState([])
  const [faithLevels, setFaithLevels] = useState([])
  const [schoolDepts, setSchoolDepts] = useState([])

  useEffect(() => {
    positionsApi.list().then(r => setPositionList(Array.isArray(r.data) ? r.data : [])).catch(() => {})
    enumValuesApi.list('membership_category').then(r => setMemberCategories(Array.isArray(r.data) ? r.data : [])).catch(() => {})
    enumValuesApi.list('faith_level').then(r => setFaithLevels(Array.isArray(r.data) ? r.data : [])).catch(() => {})
    enumValuesApi.list('school_department').then(r => setSchoolDepts(Array.isArray(r.data) ? r.data : [])).catch(() => {})
  }, [])

  const loadMember = useCallback(async () => {
    if (!isEdit) return
    const [memberRes, deptRes] = await Promise.all([
      memberApi.get(id),
      deptApi.byMember(id),
    ])
    const d = memberRes.data
    setForm({
      name: d.name ?? '', name_en: d.name_en ?? '', gender: d.gender ?? '',
      birth_date: d.birth_date ? d.birth_date.slice(0, 10) : '',
      birth_lunar: d.birth_lunar ?? false,
      phone: d.phone ?? '', home_phone: d.home_phone ?? '', email: d.email ?? '',
      address: d.address ?? '', address_detail: d.address_detail ?? '',
      workplace: d.workplace ?? '', school: d.school ?? '',
      membership_type: d.membership_type ?? 'active',
      position: d.position ?? '',
      registered_at: d.registered_at ? d.registered_at.slice(0, 10) : '',
      baptism_date: d.baptism_date ? d.baptism_date.slice(0, 10) : '',
      note: d.note ?? '', photo_url: d.photo_url ?? '',
      membership_category: d.membership_category ?? '',
      faith_level: d.faith_level ?? '',
      school_department: d.school_department ?? '',
      household_head_name: d.household_head_name ?? '',
      household_relation: d.household_relation ?? '',
      introducer_name: d.introducer_name ?? '',
      previous_church: d.previous_church ?? '',
      previous_church_position: d.previous_church_position ?? '',
      occupation: d.occupation ?? '',
      anniversary_date: d.anniversary_date ? d.anniversary_date.slice(0, 10) : '',
      staff_category: d.staff_category ?? '',
      staff_role: d.staff_role ?? '',
    })
    setFamily(d.family ?? [])
    const cids = (d.communities ?? []).map(c => String(c.id))
    const firstCid = cids[0] ?? ''
    setSelectedCommunity(firstCid)
    setInitCommunity(firstCid)
    setDeptAssignments(
      (deptRes.data || []).map(a => ({
        department_id: String(a.department_id),
        job_title: a.job_title ?? '',
      }))
    )
  }, [id, isEdit])

  useEffect(() => { loadMember() }, [loadMember])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('이름을 입력하세요.'); return }
    try {
      let memberId = id
      if (isEdit) {
        await memberApi.update(id, form)
        toast.success('수정했습니다.')
      } else {
        const res = await memberApi.create(form)
        memberId = res.data.id
        toast.success('등록했습니다.')
      }

      // 교구 단일 선택 동기화
      const realSelected = selectedCommunity && !selectedCommunity.startsWith('f') ? selectedCommunity : ''
      const realInit     = initCommunity && !initCommunity.startsWith('f') ? initCommunity : ''
      const toAdd    = realSelected && realSelected !== realInit ? [realSelected] : []
      const toRemove = realInit && realInit !== realSelected ? [realInit] : []
      const toUpdate = realSelected && realSelected === realInit ? [realSelected] : []
      await Promise.all([
        ...toAdd.map(cid => communityApi.addMember(cid, { member_id: Number(memberId), role: 'member' })),
        ...toRemove.map(cid => communityApi.removeMember(cid, memberId)),
        ...toUpdate.map(cid => communityApi.addMember(cid, { member_id: Number(memberId), role: 'member' })),
      ])

      // 부서 배정: 전체 삭제 후 재삽입
      const validAssignments = deptAssignments.filter(a => a.department_id)
      await deptApi.clearMember(memberId)
      await Promise.all(
        validAssignments.map(a =>
          deptApi.addMember(a.department_id, { member_id: Number(memberId), job_title: a.job_title || null })
        )
      )

      navigate(isEdit ? `/members/${id}` : `/members/${memberId}`)
    } catch {
      toast.error('저장에 실패했습니다.')
    }
  }

  return (
    <form className={styles.formOuter} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h1 className={styles.formTitle}>{isEdit ? '교인 수정' : '교인 등록'}</h1>
      </div>

      {/* 사진 크롭 모달 */}
      {cropSrc && (
        <PhotoCropModal
          src={cropSrc}
          onConfirm={result => { set('photo_url', result); setCropSrc(null) }}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {/* ── 섹션 1: 기본 정보 ── */}
      <div className={styles.formCard}>
        <div className={styles.formSectionTitle}>기본 정보</div>
        <div className={styles.photoInfoGrid}>
          <div className={styles.photoCol}>
            <PhotoUpload value={form.photo_url} onFileSelect={src => setCropSrc(src)} />
          </div>
          <div className={styles.infoRows}>
            {/* 이름 + 생년월일 + 성별 */}
            <div className={styles.infoRow1}>
              <div className={styles.formGroup}>
                <label>이름</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label>생년월일</label>
                <BirthDatePicker
                  value={form.birth_date}
                  onChange={v => set('birth_date', v)}
                  lunar={form.birth_lunar}
                  onLunarChange={v => set('birth_lunar', v)}
                />
              </div>
              <div className={styles.formGroup}>
                <label>성별</label>
                <GenderToggle value={form.gender} onChange={v => set('gender', v)} />
              </div>
            </div>
            {/* 주소 + 상세주소 밀착 */}
            <div className={styles.addressBlock}>
              <div className={styles.formGroup}>
                <label>주소</label>
                <div className={styles.addressRow}>
                  <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="도로명 주소" />
                  <KakaoAddressBtn onSelect={v => set('address', v)} />
                </div>
              </div>
              <input
                value={form.address_detail}
                onChange={e => set('address_detail', e.target.value)}
                placeholder="상세주소 (동·호수, 층 등)"
                className={styles.addressDetailInput}
              />
            </div>
          </div>
        </div>
        {/* 핸드폰번호 + 집전화 + 이메일 */}
        <div className={styles.contactRow3}>
          <div className={styles.formGroup}>
            <label>핸드폰번호</label>
            <PhoneInput value={form.phone} onChange={v => set('phone', v)} />
          </div>
          <div className={styles.formGroup}>
            <label>집전화</label>
            <HomePhoneInput value={form.home_phone} onChange={v => set('home_phone', v)} />
          </div>
          <div className={styles.formGroup}>
            <label>이메일</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── 섹션 2: 신앙 정보 ── */}
      <div className={styles.formCard}>
        <div className={styles.formSectionTitle}>신앙 정보</div>
        <div className={styles.formGrid}>
          {/* 교인구분 — 전체폭 버튼 그룹 */}
          <div className={`${styles.formGroup} ${styles.span2}`}>
            <label>교인구분</label>
            <div className={form.membership_category === '교회학교' ? styles.memberCatSchoolRow : styles.memberCatRow}>
              <div className={styles.memberCatBtns}>
                {['', ...memberCategories.map(c => c.value)].map(v => (
                  <button key={v || '__none'} type="button"
                    className={`${styles.catBtn} ${form.membership_category === v ? styles.catBtnActive : ''}`}
                    onClick={() => { set('membership_category', v); if (v !== '교회학교') set('school_department', '') }}>
                    {v || '없음'}
                  </button>
                ))}
              </div>
              {form.membership_category === '교회학교' && (
                <select value={form.school_department} onChange={e => set('school_department', e.target.value)}>
                  <option value="">교회학교부서 선택</option>
                  {schoolDepts.map(d => <option key={d.id} value={d.value}>{d.value}</option>)}
                </select>
              )}
            </div>
          </div>
          <div className={styles.formGroup}>
            <label>신급</label>
            <select value={form.faith_level} onChange={e => set('faith_level', e.target.value)}>
              <option value="">선택</option>
              {faithLevels.map(f => <option key={f.id} value={f.value}>{f.value}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>교인 상태</label>
            <select value={form.membership_type} onChange={e => set('membership_type', e.target.value)}>
              <option value="active">현재제적</option>
              <option value="inactive">제적 외</option>
              <option value="transfer_out">이적</option>
              <option value="deceased">소천</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>직분</label>
            <select value={form.position} onChange={e => set('position', e.target.value)}>
              <option value="">없음</option>
              {positionList.filter(p => p.category === 'deacon').map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>등록일</label>
            <DateInput value={form.registered_at} onChange={v => set('registered_at', v)} />
          </div>
          <div className={styles.formGroup}>
            <label>세례일</label>
            <DateInput value={form.baptism_date} onChange={v => set('baptism_date', v)} />
          </div>
          <div className={styles.formGroup}>
            <label>인도자</label>
            <IntroducerInput value={form.introducer_name} onChange={v => set('introducer_name', v)} />
          </div>
          <div className={styles.formGroup}>
            <label>이전 교회</label>
            <input value={form.previous_church} onChange={e => set('previous_church', e.target.value)} placeholder="이전 교회명" />
          </div>
          <div className={styles.formGroup}>
            <label>이전교회 직분</label>
            <input value={form.previous_church_position} onChange={e => set('previous_church_position', e.target.value)} placeholder="집사, 권사 등" />
          </div>
        </div>
      </div>

      {/* ── 섹션 3+4: 개인 / 가정 정보 (가족관계 통합) ── */}
      <div className={styles.formCard}>
        <div className={styles.formSectionTitle}>개인 / 가정 정보</div>

        {/* 가족관계 */}
        <div className={styles.familySection}>
          <span className={styles.subSectionLabel}>가족관계</span>
          {isEdit
            ? <FamilyPanel memberId={id} family={family} onRefresh={loadMember} />
            : <p className={styles.emptyNote}>교인 등록 후 가족관계를 추가할 수 있습니다.</p>
          }
        </div>

        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label>직업</label>
            <input value={form.occupation} onChange={e => set('occupation', e.target.value)} placeholder="직업" />
          </div>
          <div className={styles.formGroup}>
            <label>결혼기념일</label>
            <DateInput value={form.anniversary_date} onChange={v => set('anniversary_date', v)} />
          </div>
          <div className={styles.formGroup}>
            <label>신앙세대주</label>
            <input value={form.household_head_name} onChange={e => set('household_head_name', e.target.value)} placeholder="세대주 이름" />
          </div>
          <div className={styles.formGroup}>
            <label>세대주와의 관계</label>
            <input value={form.household_relation} onChange={e => set('household_relation', e.target.value)} placeholder="본인, 배우자, 자녀 등" />
          </div>
          <div className={styles.formGroup}>
            <label>직장</label>
            <AutoSuggest apiField="workplace" value={form.workplace}
              onChange={v => set('workplace', v)} placeholder="직장명" />
          </div>
          <div className={styles.formGroup}>
            <label>학교</label>
            <AutoSuggest apiField="school" value={form.school}
              onChange={v => set('school', v)} placeholder="학교명" />
          </div>
        </div>
      </div>

      {/* ── 섹션 5: 교회 내 소속 및 기타 ── */}
      <div className={styles.formCard}>
        <div className={styles.formSectionTitle}>교회 내 소속 및 기타</div>

        <div className={styles.formGroup} style={{ marginBottom: 20 }}>
          <label>교구</label>
          <CommunityDropdowns value={selectedCommunity} onChange={setSelectedCommunity} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <DeptAssignPanel assignments={deptAssignments} onChange={setDeptAssignments} />
        </div>

        <div className={styles.staffBox}>
          <div className={styles.staffBoxTitle}>교역자 / 직원</div>
          <div className={styles.staffRadioGroup}>
            {[['', '해당없음'], ['pastoral', '교역자'], ['other', '직원']].map(([val, label]) => (
              <label key={val} className={styles.staffRadioLabel}>
                <input
                  type="radio"
                  name="staff_category"
                  value={val}
                  checked={form.staff_category === val}
                  onChange={() => { set('staff_category', val); set('staff_role', '') }}
                />
                {label}
              </label>
            ))}
          </div>
          {form.staff_category && (
            <select
              value={form.staff_role}
              onChange={e => set('staff_role', e.target.value)}
              className={styles.staffRoleSelect}
            >
              <option value="">직함 선택</option>
              {positionList.filter(p => p.category === form.staff_category).map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className={`${styles.formGroup} ${styles.span2}`} style={{ marginTop: 20 }}>
          <label>메모</label>
          <textarea rows={3} value={form.note} onChange={e => set('note', e.target.value)} />
        </div>
      </div>

      <div className={styles.formActions}>
        <Link to={isEdit ? `/members/${id}` : '/members'} className={styles.btnSecondary}>취소</Link>
        <button type="submit" className={styles.btnPrimary}>{isEdit ? '저장' : '등록'}</button>
        {!isEdit && (
          <button type="button" className={styles.btnSecondary} onClick={() => setBulkOpen(true)}>
            엑셀로 일괄등록
          </button>
        )}
      </div>
      {bulkOpen && (
        <BulkUploadModal
          onClose={() => setBulkOpen(false)}
          onDone={() => navigate('/members')}
        />
      )}
    </form>
  )
}
