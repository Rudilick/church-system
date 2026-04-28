import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { members as memberApi, families as familyApi, communities as communityApi, departments as deptApi, positions as positionsApi, enumValues as enumValuesApi } from '../../api'
import { genderColor } from '../../utils'
import toast from 'react-hot-toast'
import styles from './Members.module.css'

// ─── Photo Upload ──────────────────────────────────────────
function PhotoUpload({ value, onChange }) {
  const inputRef = useRef()
  const handleFile = e => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { toast.error('3MB 이하 이미지만 등록 가능합니다.'); return }
    const reader = new FileReader()
    reader.onload = ev => onChange(ev.target.result)
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

// ─── AutoSuggest (localStorage 기반) ──────────────────────
function AutoSuggest({ fieldKey, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`ac_${fieldKey}`) || '[]') } catch { return [] }
  })

  const filtered = history.filter(h =>
    h.toLowerCase().includes((value || '').toLowerCase()) && h !== value
  )

  const select = item => { onChange(item); setOpen(false) }

  const remove = (item, e) => {
    e.stopPropagation()
    const next = history.filter(h => h !== item)
    setHistory(next)
    localStorage.setItem(`ac_${fieldKey}`, JSON.stringify(next))
  }

  const saveHistory = val => {
    if (!val?.trim()) return
    const next = [val, ...history.filter(h => h !== val)].slice(0, 30)
    setHistory(next)
    localStorage.setItem(`ac_${fieldKey}`, JSON.stringify(next))
  }

  return (
    <div className={styles.autoSuggest}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => { if (e.key === 'Enter') saveHistory(value) }}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <ul className={styles.suggestList}>
          {filtered.map(item => (
            <li key={item} className={styles.suggestItem}>
              <span onMouseDown={() => select(item)}>{item}</span>
              <button type="button" onMouseDown={e => remove(item, e)}>×</button>
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

// ─── 셀모임 타일 ───────────────────────────────────────────
const FALLBACK_CELLS = ['은혜셀','사랑셀','소망셀','믿음셀','기쁨셀','평화셀','인내셀','감사셀']
  .map((name, i) => ({ id: `f${i}`, name }))

function CommunityTiles({ selected, onChange }) {
  const [cells, setCells] = useState(FALLBACK_CELLS)

  useEffect(() => {
    communityApi.list().then(r => {
      const data = Array.isArray(r.data) ? r.data : []
      setCells(data.length > 0 ? data : FALLBACK_CELLS)
    }).catch(() => {})
  }, [])

  const toggle = id => {
    const sid = String(id)
    onChange(selected.includes(sid) ? selected.filter(x => x !== sid) : [...selected, sid])
  }

  return (
    <div className={styles.cellTiles}>
      {cells.map(c => (
        <button key={c.id} type="button"
          className={`${styles.cellTile} ${selected.includes(String(c.id)) ? styles.cellActive : ''}`}
          onClick={() => toggle(c.id)}>
          {c.name}
        </button>
      ))}
    </div>
  )
}

// ─── 가족관계 패널 ─────────────────────────────────────────
const RELATION_LABELS = {
  spouse: '배우자',
  parent: '부모', child: '자녀',
  sibling: '형제·자매',
  grandparent: '조부모', grandchild: '손자녀',
  great_grandparent: '증조부모', great_grandchild: '증손자녀',
  aunt_paternal: '고모', uncle_paternal: '삼촌',
  aunt_maternal: '이모', uncle_maternal: '외삼촌',
  nephew_niece: '조카',
  cousin: '사촌',
}
const RELATION_OPTIONS = [
  { value: 'spouse',                label: '배우자' },
  { value: 'father',                label: '부' },
  { value: 'mother',                label: '모' },
  { value: 'child',                 label: '자녀' },
  { value: 'sibling',               label: '형제·자매' },
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

function TreeNode({ m, relation }) {
  const borderColor = genderColor(m.gender)
  return (
    <div className={styles.treeNode}>
      <div className={styles.treeCircle} style={{ borderColor }}>
        {m.photo_url ? <img src={m.photo_url} alt={m.name} /> : <span>{m.name[0]}</span>}
      </div>
      <div className={styles.treeName}>{m.name}</div>
      <div className={styles.treeRelLabel}>{relation}</div>
    </div>
  )
}

function FamilyPanel({ memberId, family, onRefresh }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [relation, setRelation] = useState('spouse')

  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    const t = setTimeout(() => {
      memberApi.list({ q: search, limit: 8 }).then(r => {
        setResults((r.data.data || []).filter(m => m.id !== Number(memberId)))
      })
    }, 300)
    return () => clearTimeout(t)
  }, [search, memberId])

  const add = async m => {
    try {
      await familyApi.add({ member_id: Number(memberId), related_member_id: m.id, relation_type: relation })
      toast.success(`${m.name}을(를) ${RELATION_LABELS[relation]}으로 추가했습니다.`)
      setSearch(''); setResults([])
      onRefresh()
    } catch { toast.error('추가에 실패했습니다.') }
  }

  const remove = async relatedId => {
    await familyApi.remove({ member_id: Number(memberId), related_member_id: relatedId })
    toast.success('삭제했습니다.')
    onRefresh()
  }

  const byType = t => family.filter(f => f.relation_type === t)
  const greatGrandparents = byType('great_grandparent')
  const grandparents      = byType('grandparent')
  const parents           = byType('parent')
  const spouses           = byType('spouse')
  const children          = byType('child')
  const grandchildren     = byType('grandchild')
  const greatGrandchildren = byType('great_grandchild')
  const siblings          = byType('sibling')
  const lateralFamily     = family.filter(f =>
    ['aunt_paternal','uncle_paternal','aunt_maternal','uncle_maternal','nephew_niece','cousin'].includes(f.relation_type)
  )

  return (
    <div className={styles.familyPanel}>
      <h3 className={styles.panelTitle}>가족관계</h3>

      {/* 가계도 — 직계 */}
      {family.length > 0 ? (
        <div className={styles.familyTree}>
          {greatGrandparents.length > 0 && (
            <div className={styles.treeRow}>
              {greatGrandparents.map(m => <TreeNode key={m.id} m={m} relation="증조부모" />)}
            </div>
          )}
          {grandparents.length > 0 && (
            <div className={styles.treeRow}>
              {grandparents.map(m => <TreeNode key={m.id} m={m} relation="조부모" />)}
            </div>
          )}
          {parents.length > 0 && (
            <div className={styles.treeRow}>
              {parents.map(m => <TreeNode key={m.id} m={m} relation="부모" />)}
            </div>
          )}
          <div className={styles.treeRow}>
            {siblings.map(m => <TreeNode key={m.id} m={m} relation="형제자매" />)}
            <div className={styles.treeNodeSelf}>
              <div className={styles.treeCircleSelf}>본인</div>
            </div>
            {spouses.map(m => <TreeNode key={m.id} m={m} relation="배우자" />)}
          </div>
          {children.length > 0 && (
            <div className={styles.treeRow}>
              {children.map(m => <TreeNode key={m.id} m={m} relation="자녀" />)}
            </div>
          )}
          {grandchildren.length > 0 && (
            <div className={styles.treeRow}>
              {grandchildren.map(m => <TreeNode key={m.id} m={m} relation="손자녀" />)}
            </div>
          )}
          {greatGrandchildren.length > 0 && (
            <div className={styles.treeRow}>
              {greatGrandchildren.map(m => <TreeNode key={m.id} m={m} relation="증손자녀" />)}
            </div>
          )}
          {/* 방계 */}
          {lateralFamily.length > 0 && (
            <div className={styles.treeRowLateral}>
              <div className={styles.treeRowLateralLabel}>방계</div>
              <div className={styles.treeRow} style={{ marginTop: 0 }}>
                {lateralFamily.map(m => <TreeNode key={m.id} m={m} relation={RELATION_LABELS[m.relation_type]} />)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className={styles.emptyNote}>등록된 가족관계가 없습니다.</p>
      )}

      {/* 가족 추가 */}
      <div className={styles.familyAdd}>
        <select value={relation} onChange={e => setRelation(e.target.value)} className={styles.relationSelect}>
          {RELATION_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <div className={styles.searchWrap}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="교인 이름으로 검색…"
          />
          {results.length > 0 && (
            <ul className={styles.familyResults}>
              {results.map(m => (
                <li key={m.id} onMouseDown={() => add(m)}>
                  {m.name}{m.phone ? ` · ${m.phone}` : ''}
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

// ─── 부서/직책 배정 패널 ───────────────────────────────────
function DeptAssignPanel({ assignments, onChange }) {
  const [deptList, setDeptList] = useState([])

  useEffect(() => {
    deptApi.list().then(r => setDeptList(r.data || [])).catch(() => {})
  }, [])

  const addRow = () => onChange([...assignments, { department_id: '', job_title: '' }])

  const updateRow = (i, field, val) => {
    const next = assignments.map((a, idx) => idx === i ? { ...a, [field]: val } : a)
    onChange(next)
  }

  const removeRow = i => onChange(assignments.filter((_, idx) => idx !== i))

  const usedIds = assignments.map(a => String(a.department_id)).filter(Boolean)

  return (
    <div className={styles.deptPanel}>
      <div className={styles.deptPanelHeader}>
        <span className={styles.deptPanelTitle}>부서 배정</span>
        <button type="button" className={styles.deptAddBtn} onClick={addRow}>+ 부서 추가</button>
      </div>
      {assignments.length === 0 && (
        <p className={styles.deptEmpty}>배정된 부서가 없습니다.</p>
      )}
      {assignments.map((a, i) => (
        <div key={i} className={styles.deptRow}>
          <select
            value={a.department_id}
            onChange={e => updateRow(i, 'department_id', e.target.value)}
            className={styles.deptSelect}
          >
            <option value="">부서 선택</option>
            {deptList.map(d => (
              <option
                key={d.id}
                value={d.id}
                disabled={usedIds.includes(String(d.id)) && String(a.department_id) !== String(d.id)}
              >
                {d.name}
              </option>
            ))}
          </select>
          <input
            className={styles.deptJobInput}
            value={a.job_title}
            onChange={e => updateRow(i, 'job_title', e.target.value)}
            placeholder="직책 (예: 부장, 총무…)"
          />
          <button type="button" className={styles.deptRemoveBtn} onClick={() => removeRow(i)}>×</button>
        </div>
      ))}
    </div>
  )
}

// ─── 메인 폼 ───────────────────────────────────────────────
const EMPTY = {
  name: '', name_en: '', gender: '', birth_date: '', birth_lunar: false,
  phone: '', email: '', address: '', address_detail: '',
  workplace: '', school: '', membership_type: 'active', position: '',
  registered_at: '', baptism_date: '', note: '', photo_url: '',
  resident_id: '', membership_category: '', faith_level: '',
  household_head_name: '', household_relation: '',
  introducer_name: '', previous_church: '', previous_church_position: '',
  occupation: '', anniversary_date: '',
}

export default function MemberForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(EMPTY)
  const [selectedCells, setSelectedCells] = useState([])
  const [initCells, setInitCells] = useState([])
  const [family, setFamily] = useState([])
  const [deptAssignments, setDeptAssignments] = useState([])
  const [positionList, setPositionList] = useState([])
  const [memberCategories, setMemberCategories] = useState([])
  const [faithLevels, setFaithLevels] = useState([])

  useEffect(() => {
    positionsApi.list().then(r => setPositionList(Array.isArray(r.data) ? r.data : [])).catch(() => {})
    enumValuesApi.list('membership_category').then(r => setMemberCategories(Array.isArray(r.data) ? r.data : [])).catch(() => {})
    enumValuesApi.list('faith_level').then(r => setFaithLevels(Array.isArray(r.data) ? r.data : [])).catch(() => {})
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
      phone: d.phone ?? '', email: d.email ?? '',
      address: d.address ?? '', address_detail: d.address_detail ?? '',
      workplace: d.workplace ?? '', school: d.school ?? '',
      membership_type: d.membership_type ?? 'active',
      position: d.position ?? '',
      registered_at: d.registered_at ? d.registered_at.slice(0, 10) : '',
      baptism_date: d.baptism_date ? d.baptism_date.slice(0, 10) : '',
      note: d.note ?? '', photo_url: d.photo_url ?? '',
      resident_id: d.resident_id ?? '',
      membership_category: d.membership_category ?? '',
      faith_level: d.faith_level ?? '',
      household_head_name: d.household_head_name ?? '',
      household_relation: d.household_relation ?? '',
      introducer_name: d.introducer_name ?? '',
      previous_church: d.previous_church ?? '',
      previous_church_position: d.previous_church_position ?? '',
      occupation: d.occupation ?? '',
      anniversary_date: d.anniversary_date ? d.anniversary_date.slice(0, 10) : '',
    })
    setFamily(d.family ?? [])
    const cids = (d.communities ?? []).map(c => String(c.id))
    setSelectedCells(cids)
    setInitCells(cids)
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

      // fallback ID(f0~f7)는 DB 없는 샘플 → 스킵, 실제 ID만 동기화
      const realSelected = selectedCells.filter(x => !x.startsWith('f'))
      const realInit     = initCells.filter(x => !x.startsWith('f'))
      const toAdd    = realSelected.filter(x => !realInit.includes(x))
      const toRemove = realInit.filter(x => !realSelected.includes(x))
      await Promise.all([
        ...toAdd.map(cid => communityApi.addMember(cid, { member_id: Number(memberId) })),
        ...toRemove.map(cid => communityApi.removeMember(cid, memberId)),
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
    <div className={styles.formOuter}>
      {/* 왼쪽: 입력 폼 */}
      <form className={styles.formLeft} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <h1 className={styles.formTitle}>{isEdit ? '교인 수정' : '교인 등록'}</h1>
        </div>

        <div className={styles.formCard}>
          {/* 사진 + 이름 */}
          <div className={styles.photoRow}>
            <PhotoUpload value={form.photo_url} onChange={v => set('photo_url', v)} />
            <div className={styles.nameBlock}>
              <div className={styles.formGroup}>
                <label>이름 *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label>영문 이름</label>
                <input value={form.name_en} onChange={e => set('name_en', e.target.value)} />
              </div>
            </div>
          </div>

          <div className={styles.formGrid}>
            {/* ── 기본 정보 ── */}
            <div className={styles.span2} style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: 4, marginTop: 4 }}>기본 정보</div>
            <div className={styles.formGroup}>
              <label>성별</label>
              <GenderToggle value={form.gender} onChange={v => set('gender', v)} />
            </div>
            <div className={styles.formGroup}>
              <label>생년월일</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <DateInput value={form.birth_date} onChange={v => set('birth_date', v)} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.birth_lunar} onChange={e => set('birth_lunar', e.target.checked)} />
                  음력
                </label>
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>주민등록번호</label>
              <input value={form.resident_id} onChange={e => set('resident_id', e.target.value)} placeholder="000000-0000000" />
            </div>

            {/* ── 연락처 / 주소 ── */}
            <div className={styles.span2} style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: 4, marginTop: 8 }}>연락처 / 주소</div>
            <div className={styles.formGroup}>
              <label>연락처</label>
              <PhoneInput value={form.phone} onChange={v => set('phone', v)} />
            </div>
            <div className={styles.formGroup}>
              <label>이메일</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className={`${styles.formGroup} ${styles.span2}`}>
              <label>주소</label>
              <div className={styles.addressRow}>
                <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="도로명 주소" />
                <KakaoAddressBtn onSelect={v => set('address', v)} />
              </div>
            </div>
            <div className={`${styles.formGroup} ${styles.span2}`}>
              <label>상세 주소</label>
              <input value={form.address_detail} onChange={e => set('address_detail', e.target.value)} />
            </div>

            {/* ── 신앙 정보 ── */}
            <div className={styles.span2} style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: 4, marginTop: 8 }}>신앙 정보</div>
            <div className={styles.formGroup}>
              <label>교인구분</label>
              <select value={form.membership_category} onChange={e => set('membership_category', e.target.value)}>
                <option value="">선택</option>
                {memberCategories.map(c => <option key={c.id} value={c.value}>{c.value}</option>)}
              </select>
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
                <option value="active">현재 교인</option>
                <option value="inactive">비활성</option>
                <option value="transfer_out">이적</option>
                <option value="deceased">소천</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>직분</label>
              <select value={form.position} onChange={e => set('position', e.target.value)}>
                <option value="">없음</option>
                {positionList.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
              <input value={form.introducer_name} onChange={e => set('introducer_name', e.target.value)} placeholder="인도한 교인 이름" />
            </div>
            <div className={styles.formGroup}>
              <label>이전 교회</label>
              <input value={form.previous_church} onChange={e => set('previous_church', e.target.value)} placeholder="이전 교회명" />
            </div>
            <div className={styles.formGroup}>
              <label>이전교회 직분</label>
              <input value={form.previous_church_position} onChange={e => set('previous_church_position', e.target.value)} placeholder="집사, 권사 등" />
            </div>

            {/* ── 개인 / 가정 정보 ── */}
            <div className={styles.span2} style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: 4, marginTop: 8 }}>개인 / 가정 정보</div>
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
              <AutoSuggest fieldKey="workplace" value={form.workplace}
                onChange={v => set('workplace', v)} placeholder="직장명" />
            </div>
            <div className={styles.formGroup}>
              <label>학교</label>
              <AutoSuggest fieldKey="school" value={form.school}
                onChange={v => set('school', v)} placeholder="학교명" />
            </div>

            {/* ── 메모 ── */}
            <div className={`${styles.formGroup} ${styles.span2}`} style={{ marginTop: 8 }}>
              <label>메모</label>
              <textarea rows={3} value={form.note} onChange={e => set('note', e.target.value)} />
            </div>
          </div>

          {/* 셀모임 */}
          <div className={styles.formGroup} style={{ marginTop: 20 }}>
            <label>셀모임</label>
            <CommunityTiles selected={selectedCells} onChange={setSelectedCells} />
          </div>

          {/* 부서/직책 배정 */}
          <div style={{ marginTop: 20 }}>
            <DeptAssignPanel assignments={deptAssignments} onChange={setDeptAssignments} />
          </div>
        </div>

        <div className={styles.formActions}>
          <Link to={isEdit ? `/members/${id}` : '/members'} className={styles.btnSecondary}>취소</Link>
          <button type="submit" className={styles.btnPrimary}>{isEdit ? '저장' : '등록'}</button>
        </div>
      </form>

      {/* 오른쪽: 가족관계 패널 */}
      {isEdit
        ? <FamilyPanel memberId={id} family={family} onRefresh={loadMember} />
        : (
          <div className={styles.familyPanel}>
            <h3 className={styles.panelTitle}>가족관계</h3>
            <p className={styles.emptyNote}>교인 등록 후 가족관계를 추가할 수 있습니다.</p>
          </div>
        )
      }
    </div>
  )
}
