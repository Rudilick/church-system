import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { pastoral as api, members as memberApi } from '../api'
import { useMemberAll } from '../hooks/useMemberAll'
import { useAutocompleteKeyNav } from '../hooks/useAutocompleteKeyNav'
import { genderColor } from '../utils'
import { HYMNALS } from '../data/hymnals'
import { BIBLE_BOOKS } from '../data/bibleBooks'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import styles from '../pages/pastoral/Pastoral.module.css'

// 찬송가 장번호로 제목 조회
const hymnByNumber = num => HYMNALS.find(h => h.number === Number(num))
// 찬송가 제목 검색 (자동완성용)
const searchHymnals = q => {
  if (!q.trim()) return []
  return HYMNALS.filter(h => h.title.includes(q) || String(h.number).startsWith(q)).slice(0, 10)
}
// 찬송가 hymn 문자열 파싱: "새찬송가 204장 주 예수보다…" → { number: '204', title: '주 예수보다…' }
const parseHymn = (str) => {
  if (!str) return { number: '', title: '' }
  const m = str.match(/(\d+)장\s*(.*)/)
  if (m) return { number: m[1], title: m[2].trim() }
  return { number: '', title: str }
}
// 성경 책명 검색
const searchBibleBooks = q => {
  if (!q.trim()) return []
  return BIBLE_BOOKS.filter(b => b.includes(q)).slice(0, 10)
}

const VISIT_TYPES = ['가정', '병원', '이사', '개업', '전화', '구역', '기타']

const today = dayjs()
const EMPTY_VFORM = {
  visit_date: today.format('YYYY-MM-DD'),
  visit_type: '가정',
  location: '',
  content: '',
  hymn: '',
  hymn_number: '',
  hymn_title: '',
  bible_book: '',
  bible_ref: '',
  bible_verse: '',
  companions: [],
  next_plan: '',
  next_plan_is_event: false,
  next_plan_event_date: '',
  visiting_pastor: '',
}

// 교인 검색 드롭다운 (키보드 네비 포함, 심방 폼 전용)
function MemberSearchInput({ value, onChange, suggestions, onSelect, onClose, placeholder, disabled }) {
  const { activeIndex, handleKeyDown, resetIndex } = useAutocompleteKeyNav(suggestions, onSelect, onClose)

  useEffect(() => { resetIndex() }, [suggestions, resetIndex])

  return (
    <div style={{ position: 'relative' }}>
      <input
        className={styles.formInput}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? '이름으로 검색...'}
        disabled={disabled}
        autoComplete="off"
      />
      {suggestions.length > 0 && (
        <ul className={styles.suggestions}>
          {suggestions.map((m, i) => (
            <li
              key={m.id}
              className={i === activeIndex ? styles.suggActive : ''}
              onMouseDown={() => onSelect(m)}
            >
              {m.photo_url
                ? <img src={m.photo_url} alt={m.name} className={styles.suggAvatar} />
                : <div className={styles.suggAvatar} style={{ background: genderColor(m.gender) }}>
                    {m.name[0]}
                  </div>
              }
              <div className={styles.suggInfo}>
                <span className={styles.suggestName}>{m.name}</span>
                {m.position && <span className={styles.suggPos}>{m.position}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// 선택된 교인 타일
function MemberTile({ member, onRemove, small }) {
  if (!member) return null
  const inner = (
    <>
      {member.photo_url
        ? <img src={member.photo_url} alt={member.name} className={styles.memberTileAvatar} />
        : <div className={styles.memberTileAvatar} style={{ background: genderColor(member.gender) }}>
            {member.name[0]}
          </div>
      }
      <div className={styles.memberTileInfo}>
        <span className={styles.memberTileName}>{member.name}</span>
        <span className={styles.memberTilePos}>
          {[member.position, member.phone].filter(Boolean).join(' · ')}
        </span>
      </div>
      {onRemove && (
        <button className={styles.memberTileRemove} onClick={e => { e.preventDefault(); onRemove() }} type="button">✕</button>
      )}
    </>
  )
  return member.id
    ? <Link to={`/members/${member.id}`} className={small ? styles.memberTileSmall : styles.memberTile}>{inner}</Link>
    : <div className={small ? styles.memberTileSmall : styles.memberTile}>{inner}</div>
}

// 심방 등록/수정 모달 — 심방관리(Pastoral) 페이지와 교적관리(MemberList) 페이지에서 공유
export default function VisitFormModal({ open, onClose, editingVisit = null, initialMember = null, onSaved }) {
  const [vForm, setVForm]               = useState(EMPTY_VFORM)
  const [vMemberQ, setVMemberQ]         = useState('')
  const [vMemberSugg, setVMemberSugg]   = useState([])
  const [vSelMember, setVSelMember]     = useState(null)
  const [pastoralMembers, setPastoralMembers] = useState([])

  // 동행자 검색
  const [companionQ, setCompanionQ]       = useState('')
  const [companionSugg, setCompanionSugg] = useState([])

  // 찬송가 자동완성
  const [hymnTitleSugg, setHymnTitleSugg] = useState([])
  // 성경 책명 자동완성
  const [bibleBookSugg, setBibleBookSugg] = useState([])

  const { search: filterMembers } = useMemberAll()

  // 목회자 직분 교인 목록 (교역자 선택용)
  useEffect(() => {
    memberApi.list({ category: 'pastoral', limit: 100 })
      .then(r => setPastoralMembers(r.data?.data ?? []))
      .catch(() => {})
  }, [])

  // 모달이 열릴 때 모드(수정/사전선택/신규)에 따라 폼을 초기화
  useEffect(() => {
    if (!open) return
    setVMemberSugg([])
    setCompanionQ('')
    setCompanionSugg([])
    setHymnTitleSugg([])
    setBibleBookSugg([])

    if (editingVisit) {
      const v = editingVisit
      const { number: hn, title: ht } = parseHymn(v.hymn ?? '')
      const bvParts = (v.bible_verse ?? '').split(' ')
      const bb = bvParts.length > 1 ? bvParts[0] : ''
      const br = bvParts.length > 1 ? bvParts.slice(1).join(' ') : v.bible_verse ?? ''
      setVForm({
        visit_date: v.visit_date?.slice(0, 10) ?? today.format('YYYY-MM-DD'),
        visit_type: v.visit_type ?? '가정',
        location:   v.location   ?? '',
        content:    v.content    ?? '',
        hymn:       v.hymn       ?? '',
        hymn_number: hn,
        hymn_title:  ht,
        bible_verse: v.bible_verse ?? '',
        bible_book:  bb,
        bible_ref:   br,
        companions: Array.isArray(v.companions) ? v.companions : [],
        next_plan:  v.next_plan  ?? '',
        next_plan_is_event:    !!v.next_plan_event_id,
        next_plan_event_date:  v.next_plan_event_date ?? '',
        visiting_pastor: v.visiting_pastor ?? '',
      })
      setVSelMember({ id: v.member_id, name: v.member_name, photo_url: v.photo_url,
                      position: v.member_position, gender: v.member_gender })
      setVMemberQ(v.member_name ?? '')
    } else {
      setVForm(EMPTY_VFORM)
      setVSelMember(initialMember)
      setVMemberQ(initialMember ? initialMember.name : '')
    }
  }, [open, editingVisit, initialMember])

  const handleVisitSubmit = async () => {
    if (!vSelMember)           { toast.error('교인을 선택해주세요.'); return }
    if (!vForm.visit_date)     { toast.error('날짜를 입력하세요.');   return }
    if (!vForm.content.trim()) { toast.error('내용을 입력하세요.');   return }
    try {
      const hymnStr = vForm.hymn_number
        ? `새찬송가 ${vForm.hymn_number}장${vForm.hymn_title ? ' ' + vForm.hymn_title : ''}`
        : vForm.hymn_title || ''
      const bvStr = vForm.bible_book
        ? `${vForm.bible_book}${vForm.bible_ref ? ' ' + vForm.bible_ref : ''}`
        : vForm.bible_ref || ''
      const payload = {
        ...vForm,
        member_id: vSelMember.id,
        hymn: hymnStr,
        bible_verse: bvStr,
      }
      if (editingVisit) {
        await api.update(editingVisit.id, payload)
        toast.success('수정했습니다.')
      } else {
        await api.add(payload)
        toast.success('심방 기록을 저장했습니다.')
      }
      onClose()
      onSaved?.()
    } catch { toast.error('저장하지 못했습니다.') }
  }

  // ── 동행자 추가/제거 ───────────────────────────────────────────
  const addCompanion = (m) => {
    if (vForm.companions.some(c => c.id === m.id)) return
    setVForm(f => ({ ...f, companions: [...f.companions, { id: m.id, name: m.name,
      photo_url: m.photo_url, position: m.position, gender: m.gender }] }))
    setCompanionQ(''); setCompanionSugg([])
  }
  const removeCompanion = (id) => {
    setVForm(f => ({ ...f, companions: f.companions.filter(c => c.id !== id) }))
  }

  if (!open) return null

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>{editingVisit ? '심방 기록 수정' : '심방 등록'}</div>
        <div className={styles.modalBody}>

          {/* 교인 선택 — 사전 선택된 교인이 있으면 검색 없이 고정 표시 */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>교인 *</label>
            {initialMember
              ? <MemberTile member={initialMember} />
              : (vSelMember
                  ? <MemberTile member={vSelMember} onRemove={() => { setVSelMember(null); setVMemberQ('') }} />
                  : <MemberSearchInput
                      value={vMemberQ}
                      onChange={e => { setVMemberQ(e.target.value); setVMemberSugg(filterMembers(e.target.value)) }}
                      suggestions={vMemberSugg}
                      onSelect={m => { setVSelMember(m); setVMemberQ(m.name); setVMemberSugg([]) }}
                      onClose={() => setVMemberSugg([])}
                    />)
            }
          </div>

          {/* 날짜 + 구분 */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>날짜 *</label>
              <input type="date" className={styles.formInput}
                value={vForm.visit_date}
                onChange={e => setVForm(f => ({ ...f, visit_date: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>구분</label>
              <select className={styles.formInput}
                value={vForm.visit_type}
                onChange={e => setVForm(f => ({ ...f, visit_type: e.target.value }))}>
                {VISIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* 장소 */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>장소</label>
            <input className={styles.formInput}
              value={vForm.location}
              onChange={e => setVForm(f => ({ ...f, location: e.target.value }))}
              placeholder="선택사항" />
          </div>

          {/* 교역자 */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>교역자</label>
            <select className={styles.formInput}
              value={vForm.visiting_pastor}
              onChange={e => setVForm(f => ({ ...f, visiting_pastor: e.target.value }))}>
              <option value="">선택 안함</option>
              {pastoralMembers.map(m => (
                <option key={m.id} value={m.name}>{m.name}{m.position ? ` (${m.position})` : ''}</option>
              ))}
            </select>
          </div>

          {/* 찬송가 */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>찬송가</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {/* 장 번호 */}
              <input
                className={styles.formInput}
                style={{ width: 72, flexShrink: 0 }}
                placeholder="장"
                value={vForm.hymn_number}
                disabled={!!vForm.hymn_title && !vForm.hymn_number}
                onChange={e => {
                  const num = e.target.value.replace(/\D/g, '')
                  const found = hymnByNumber(num)
                  setVForm(f => ({ ...f, hymn_number: num, hymn_title: found ? found.title : f.hymn_title }))
                  setHymnTitleSugg([])
                }}
                onBlur={() => {
                  if (vForm.hymn_number && !hymnByNumber(vForm.hymn_number)) {
                    setVForm(f => ({ ...f, hymn_title: '' }))
                  }
                }}
              />
              {/* 제목 자동완성 */}
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  className={styles.formInput}
                  placeholder="제목 검색..."
                  value={vForm.hymn_title}
                  disabled={!!vForm.hymn_number && !!hymnByNumber(vForm.hymn_number)}
                  onChange={e => {
                    const v = e.target.value
                    setVForm(f => ({ ...f, hymn_title: v, hymn_number: '' }))
                    setHymnTitleSugg(searchHymnals(v))
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') setHymnTitleSugg([])
                  }}
                />
                {hymnTitleSugg.length > 0 && (
                  <ul className={styles.suggestions}>
                    {hymnTitleSugg.map((h, i) => (
                      <li key={h.number}
                        onMouseDown={() => {
                          setVForm(f => ({ ...f, hymn_number: String(h.number), hymn_title: h.title }))
                          setHymnTitleSugg([])
                        }}
                      >
                        <span style={{ color: '#94a3b8', marginRight: 8, fontSize: '0.8rem' }}>{h.number}장</span>
                        {h.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* 초기화 */}
              {(vForm.hymn_number || vForm.hymn_title) && (
                <button type="button" onClick={() => setVForm(f => ({ ...f, hymn_number: '', hymn_title: '' }))}
                  style={{ padding: '0 8px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#94a3b8', flexShrink: 0 }}>✕</button>
              )}
            </div>
          </div>

          {/* 성경본문 */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>성경본문</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {/* 책명 자동완성 */}
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  className={styles.formInput}
                  placeholder="책명"
                  value={vForm.bible_book}
                  onChange={e => {
                    const v = e.target.value
                    setVForm(f => ({ ...f, bible_book: v }))
                    setBibleBookSugg(searchBibleBooks(v))
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') setBibleBookSugg([])
                  }}
                />
                {bibleBookSugg.length > 0 && (
                  <ul className={styles.suggestions}>
                    {bibleBookSugg.map(b => (
                      <li key={b} onMouseDown={() => { setVForm(f => ({ ...f, bible_book: b })); setBibleBookSugg([]) }}>
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* 장:절 */}
              <input
                className={styles.formInput}
                style={{ width: 90, flexShrink: 0 }}
                placeholder="장:절"
                value={vForm.bible_ref}
                onChange={e => setVForm(f => ({ ...f, bible_ref: e.target.value }))}
              />
              {/* 초기화 */}
              {(vForm.bible_book || vForm.bible_ref) && (
                <button type="button" onClick={() => setVForm(f => ({ ...f, bible_book: '', bible_ref: '' }))}
                  style={{ padding: '0 8px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#94a3b8', flexShrink: 0 }}>✕</button>
              )}
            </div>
          </div>

          {/* 동행자 */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>동행자</label>
            <MemberSearchInput
              value={companionQ}
              onChange={e => { setCompanionQ(e.target.value); setCompanionSugg(filterMembers(e.target.value)) }}
              suggestions={companionSugg}
              onSelect={addCompanion}
              onClose={() => setCompanionSugg([])}
              placeholder="동행자 검색 (중복 선택 가능)..."
            />
            {vForm.companions.length > 0 && (
              <div className={styles.companionList}>
                {vForm.companions.map(c => (
                  <MemberTile key={c.id} member={c} small
                    onRemove={() => removeCompanion(c.id)} />
                ))}
              </div>
            )}
          </div>

          {/* 내용 */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>내용 *</label>
            <textarea className={styles.formTextarea} rows={4}
              value={vForm.content}
              onChange={e => setVForm(f => ({ ...f, content: e.target.value }))} />
          </div>

          {/* 후속계획 */}
          <div className={styles.formGroup}>
            <div className={styles.nextPlanLabelRow}>
              <label className={styles.formLabel} style={{ margin: 0 }}>후속 계획</label>
              <label className={styles.nextPlanEventCheck}>
                <input type="checkbox"
                  checked={vForm.next_plan_is_event}
                  onChange={e => setVForm(f => ({ ...f, next_plan_is_event: e.target.checked }))} />
                📅 캘린더 일정으로 등록
              </label>
            </div>
            <input className={styles.formInput}
              value={vForm.next_plan}
              onChange={e => setVForm(f => ({ ...f, next_plan: e.target.value }))}
              placeholder="선택사항" />
            {vForm.next_plan_is_event && (
              <input type="date" className={styles.nextPlanDateIcon}
                value={vForm.next_plan_event_date}
                onChange={e => setVForm(f => ({ ...f, next_plan_event_date: e.target.value }))} />
            )}
          </div>
        </div>
        <div className={styles.modalFoot}>
          <button className={styles.cancelBtn} onClick={onClose}>취소</button>
          <button className={styles.saveBtn} onClick={handleVisitSubmit}>저장</button>
        </div>
      </div>
    </div>
  )
}
