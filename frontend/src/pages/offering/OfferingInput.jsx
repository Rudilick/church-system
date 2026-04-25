import { useEffect, useRef, useState, useCallback } from 'react'
import { offering as offeringApi, members as membersApi } from '../../api'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import styles from './Offering.module.css'

const INIT_ROWS = 50

function toThisSunday() {
  return dayjs().startOf('week').format('YYYY-MM-DD')
}

function weekLabel(sundayStr) {
  const sun = dayjs(sundayStr)
  const weekNum = Math.ceil(sun.date() / 7)
  return `${sun.year()}년 ${sun.month() + 1}월 ${weekNum}주차 (${sun.month() + 1}월 ${sun.date()}일)`
}

function getSundaysInMonth(year, month) {
  const sundays = []
  const d = new Date(Date.UTC(year, month - 1, 1))
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1)
  while (d.getUTCMonth() === month - 1) {
    sundays.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 7)
  }
  return sundays
}

function WeekPicker({ current, onSelect }) {
  const cur = dayjs(current)
  const [view, setView] = useState('week')
  const [pYear, setPYear] = useState(cur.year())
  const [pMonth, setPMonth] = useState(cur.month() + 1)
  const [decadeStart, setDecadeStart] = useState(Math.floor(cur.year() / 10) * 10)

  const adjMonth = delta => {
    const d = dayjs(`${pYear}-${String(pMonth).padStart(2, '0')}-01`).add(delta, 'month')
    setPYear(d.year()); setPMonth(d.month() + 1)
  }

  if (view === 'week') {
    const sundays = getSundaysInMonth(pYear, pMonth)
    return (
      <div className={styles.picker}>
        <div className={styles.pickerNav}>
          <button className={styles.pickerArrow} onClick={() => adjMonth(-1)}>◀</button>
          <button className={styles.pickerDrillUp} onClick={() => setView('month')}>{pYear}년 {pMonth}월 ↑</button>
          <button className={styles.pickerArrow} onClick={() => adjMonth(1)}>▶</button>
        </div>
        <div className={styles.pickerWeeks}>
          {sundays.map(s => {
            const d = dayjs(s)
            const wn = Math.ceil(d.date() / 7)
            return (
              <button key={s} className={`${styles.pickerWeekRow} ${s === current ? styles.pickerActive : ''}`} onClick={() => onSelect(s)}>
                <strong>{wn}주차</strong><span className={styles.pickerWeekDate}>({pMonth}월 {d.date()}일)</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (view === 'month') {
    const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
    return (
      <div className={styles.picker}>
        <div className={styles.pickerNav}>
          <button className={styles.pickerArrow} onClick={() => setPYear(y => y - 1)}>◀</button>
          <button className={styles.pickerDrillUp} onClick={() => setView('year')}>{pYear}년 ↑</button>
          <button className={styles.pickerArrow} onClick={() => setPYear(y => y + 1)}>▶</button>
        </div>
        <div className={styles.pickerGrid}>
          {MONTHS.map((m, i) => (
            <button key={i}
              className={`${styles.pickerCell} ${i + 1 === pMonth ? styles.pickerActive : ''}`}
              onClick={() => { setPMonth(i + 1); setView('week') }}>
              {m}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const years = Array.from({ length: 10 }, (_, i) => decadeStart + i)
  return (
    <div className={styles.picker}>
      <div className={styles.pickerNav}>
        <button className={styles.pickerArrow} onClick={() => setDecadeStart(s => s - 10)}>◀</button>
        <span className={styles.pickerDrillUp}>{decadeStart}–{decadeStart + 9}</span>
        <button className={styles.pickerArrow} onClick={() => setDecadeStart(s => s + 10)}>▶</button>
      </div>
      <div className={styles.pickerGrid}>
        {years.map(y => (
          <button key={y}
            className={`${styles.pickerCell} ${y === pYear ? styles.pickerActive : ''}`}
            onClick={() => { setPYear(y); setView('month') }}>
            {y}
          </button>
        ))}
      </div>
    </div>
  )
}

const makeBlankRow = (key) => ({
  key, id: null, name: '', memberId: null, amount: '', memo: '', saved: false, editing: false,
})

const makeRows = () => Array.from({ length: INIT_ROWS }, (_, i) => makeBlankRow(i))

const TYPE_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ec4899',
  '#ef4444','#84cc16','#f97316','#6366f1','#0ea5e9','#d946ef',
]

const TYPE_ICONS = {
  '주정헌금':  '⛪',
  '십일조헌금': '💰',
  '감사헌금':  '🌸',
  '건축헌금':  '🏗️',
  '선교헌금':  '✈️',
  '구제헌금':  '🤝',
  '절기헌금':  '🌟',
  '특별헌금':  '⭐',
  '교육헌금':  '📚',
  '구역헌금':  '🏠',
  '봉헌':     '🕊️',
  '장학헌금':  '🎓',
}

export default function OfferingInput() {
  const [date, setDate] = useState(toThisSunday)
  const [showPicker, setShowPicker] = useState(false)
  const [types, setTypes] = useState([])
  const [counts, setCounts] = useState({})
  const [selectedType, setSelectedType] = useState(null)
  const [rows, setRows] = useState(makeRows)
  const [suggest, setSuggest] = useState({ idx: -1, items: [] })

  const nameRefs   = useRef([])
  const amountRefs = useRef([])
  const suggestTimer = useRef(null)

  useEffect(() => {
    offeringApi.types().then(r => setTypes(r.data))
  }, [])

  const refreshCounts = useCallback(async () => {
    const r = await offeringApi.dailyCounts(date)
    const map = {}
    r.data.forEach(c => { map[c.offering_type_id] = c.count })
    setCounts(map)
  }, [date])

  useEffect(() => { refreshCounts() }, [refreshCounts])

  const loadExisting = useCallback(async (typeId, selectedDate) => {
    try {
      const r = await offeringApi.list({ from: selectedDate, to: selectedDate, type_id: typeId, limit: 200 })
      const existing = (r.data.data || []).map((item, i) => ({
        key: i,
        id: item.id,
        name: item.member_name || item.name || '',
        memberId: item.member_id,
        amount: String(Number(item.amount) || ''),
        memo: item.memo || '',
        saved: true,
        editing: false,
      }))
      const padCount = Math.max(0, INIT_ROWS - existing.length)
      setRows([
        ...existing,
        ...Array.from({ length: padCount }, (_, j) => makeBlankRow(existing.length + j))
      ])
    } catch {
      setRows(makeRows())
    }
  }, [])

  const prevWeek = () => setDate(d => dayjs(d).subtract(1, 'week').format('YYYY-MM-DD'))
  const nextWeek = () => setDate(d => {
    const next = dayjs(d).add(1, 'week').format('YYYY-MM-DD')
    return next <= toThisSunday() ? next : d
  })

  const selectType = async type => {
    setSelectedType(type)
    setSuggest({ idx: -1, items: [] })
    await loadExisting(type.id, date)
  }

  const selectedTypeId = selectedType?.id
  useEffect(() => {
    if (selectedTypeId) loadExisting(selectedTypeId, date)
  }, [date, selectedTypeId, loadExisting])

  const updateRow = (idx, patch) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  const handleNameChange = (idx, val) => {
    updateRow(idx, { name: val, memberId: null })
    clearTimeout(suggestTimer.current)
    if (val.length < 2) { setSuggest({ idx: -1, items: [] }); return }
    suggestTimer.current = setTimeout(async () => {
      const r = await membersApi.list({ q: val, limit: 8 })
      setSuggest({ idx, items: r.data.data || [] })
    }, 200)
  }

  const pickSuggest = (idx, member) => {
    updateRow(idx, { name: member.name, memberId: member.id })
    setSuggest({ idx: -1, items: [] })
    setTimeout(() => amountRefs.current[idx]?.focus(), 50)
  }

  const handleAmountKeyDown = (idx, e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      nameRefs.current[idx + 1]?.focus()
    }
  }

  const handleSave = async () => {
    const toSave = rows.filter(r => r.name.trim() && r.amount && !r.saved)
    if (!toSave.length) { toast.error('저장할 항목이 없습니다.'); return }
    try {
      const results = await Promise.all(toSave.map(r =>
        offeringApi.add({
          member_id: r.memberId ?? null,
          name: r.name,
          offering_type_id: selectedType.id,
          amount: Number(r.amount),
          date,
          memo: r.memo || null,
        })
      ))
      let ri = 0
      setRows(prev => prev.map(r =>
        toSave.some(s => s.key === r.key)
          ? { ...r, saved: true, editing: false, id: results[ri++].data.id }
          : r
      ))
      await refreshCounts()
      toast.success(`${toSave.length}건 저장했습니다.`)
    } catch {
      toast.error('저장에 실패했습니다.')
    }
  }

  const handleUpdate = async (idx) => {
    const row = rows[idx]
    try {
      await offeringApi.update(row.id, {
        name: row.name,
        member_id: row.memberId ?? null,
        amount: Number(row.amount),
        memo: row.memo || null,
      })
      updateRow(idx, { editing: false })
      toast.success('수정했습니다.')
    } catch {
      toast.error('수정에 실패했습니다.')
    }
  }

  const handleDeleteRow = async (idx) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return
    try {
      await offeringApi.remove(rows[idx].id)
      setRows(prev => prev.map((r, i) => i === idx ? makeBlankRow(r.key) : r))
      await refreshCounts()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  // saved 행도 filled로 처리 (연번·합계 계산)
  let seqCounter = 0
  let totalShown = false
  const rowDisplay = rows.map(r => {
    const filled = r.name.trim() !== '' || r.saved
    if (filled) { seqCounter++; return { seq: String(seqCounter), isTotal: false } }
    if (!totalShown) { totalShown = true; return { seq: '합계', isTotal: true } }
    return { seq: '', isTotal: false }
  })

  const filledCount = rows.filter(r => r.name.trim() !== '' || r.saved).length
  const totalAmount = rows
    .filter(r => r.name.trim() !== '' || r.saved)
    .reduce((s, r) => s + (Number(r.amount) || 0), 0)

  if (!selectedType) {
    return (
      <div>
        <div className={styles.inputHeader}>
          <button className={styles.backBtn} onClick={() => window.history.back()}>← 헌금 관리</button>
          <h2 className={styles.inputTitle}>헌금내역 입력</h2>
          <div className={styles.weekNavWrap}>
            <div className={styles.weekNav}>
              <button className={styles.weekNavBtn} onClick={prevWeek}>◀</button>
              <button className={styles.weekLabel} onClick={() => setShowPicker(p => !p)}>{weekLabel(date)}</button>
              <button className={styles.weekNavBtn} onClick={nextWeek} disabled={date >= toThisSunday()}>▶</button>
            </div>
            {showPicker && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => setShowPicker(false)} />
                <WeekPicker current={date} onSelect={d => { setDate(d); setShowPicker(false) }} />
              </>
            )}
          </div>
        </div>

        <p className={styles.pickHint}>헌금 종류를 선택하세요</p>

        <div className={styles.typeGrid}>
          {types.map((t, i) => (
            <button
              key={t.id}
              className={styles.typeTile}
              onClick={() => selectType(t)}
              style={{ '--accent': TYPE_COLORS[i % TYPE_COLORS.length] }}
            >
              <div className={styles.typeTileIcon}>{TYPE_ICONS[t.name] ?? '💛'}</div>
              <div className={styles.typeTileName}>{t.name}</div>
              <div className={styles.typeTileCount}>
                {counts[t.id] ? <span className={styles.countBadge}>{counts[t.id]}건</span> : <span className={styles.countZero}>0건</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className={styles.inputHeader}>
        <button className={styles.backBtn} onClick={() => setSelectedType(null)}>← 종류 선택</button>
        <h2 className={styles.inputTitle}>{selectedType.name}</h2>
        <div className={styles.weekNav}>
          <button className={styles.weekNavBtn} onClick={prevWeek}>◀</button>
          <span className={styles.weekLabel}>{weekLabel(date)}</span>
          <button className={styles.weekNavBtn} onClick={nextWeek} disabled={date >= toThisSunday()}>▶</button>
        </div>
      </div>

      <div className={styles.summaryBar}>
        <span>입력 <strong>{filledCount}</strong>건</span>
        <span>합계 <strong>{totalAmount.toLocaleString('ko-KR')}원</strong></span>
        {rows.some(r => r.saved) && <span className={styles.savedBadge}>✓ 저장됨</span>}
        <button className={styles.saveBtn} onClick={handleSave}>저장하기</button>
      </div>

      <div className={styles.sheetWrap}>
        <table className={styles.sheet}>
          <thead>
            <tr>
              <th className={styles.colSeq}>연번</th>
              <th className={styles.colName}>이름</th>
              <th className={styles.colAmt}>금액</th>
              <th className={styles.colMemo}>메모</th>
              <th className={styles.colAction}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const { seq, isTotal } = rowDisplay[idx]
              const isEditing = row.saved && row.editing
              const isReadOnly = row.saved && !row.editing

              return (
                <tr
                  key={row.key}
                  className={`
                    ${styles.sheetRow}
                    ${isTotal ? styles.sheetRowTotal : ''}
                    ${row.saved && !row.editing ? styles.sheetRowSaved : ''}
                  `}
                >
                  <td className={`${styles.sheetCell} ${styles.seqCell} ${isTotal ? styles.totalLabel : ''}`}>
                    {seq}
                  </td>

                  <td className={styles.sheetCell} style={{ position: 'relative' }}>
                    <input
                      ref={el => nameRefs.current[idx] = el}
                      className={`${styles.cellInput} ${isReadOnly ? styles.savedInput : ''}`}
                      value={row.name}
                      onChange={e => handleNameChange(idx, e.target.value)}
                      onBlur={() => setTimeout(() => setSuggest({ idx: -1, items: [] }), 150)}
                      readOnly={isReadOnly}
                      placeholder={isTotal ? `${filledCount}건 · ${totalAmount.toLocaleString('ko-KR')}원` : ''}
                    />
                    {suggest.idx === idx && suggest.items.length > 0 && (
                      <ul className={styles.suggestions}>
                        {suggest.items.map(m => (
                          <li key={m.id} onMouseDown={() => pickSuggest(idx, m)}>
                            <span className={styles.suggestName}>{m.name}</span>
                            {m.phone && <span className={styles.suggestPhone}>{m.phone}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>

                  <td className={styles.sheetCell}>
                    <input
                      ref={el => amountRefs.current[idx] = el}
                      className={`${styles.cellInput} ${styles.amtInput} ${isReadOnly ? styles.savedInput : ''}`}
                      value={row.amount}
                      onChange={e => updateRow(idx, { amount: e.target.value.replace(/\D/g, '') })}
                      onKeyDown={e => handleAmountKeyDown(idx, e)}
                      readOnly={isReadOnly}
                      placeholder="0"
                    />
                  </td>

                  <td className={styles.sheetCell}>
                    <input
                      className={`${styles.cellInput} ${isReadOnly ? styles.savedInput : ''}`}
                      value={row.memo}
                      onChange={e => updateRow(idx, { memo: e.target.value })}
                      readOnly={isReadOnly}
                    />
                  </td>

                  <td className={styles.sheetCell}>
                    {row.saved && !row.editing && (
                      <div className={styles.rowActions}>
                        <button onClick={() => updateRow(idx, { editing: true })}>수정</button>
                        <button onClick={() => handleDeleteRow(idx)}>삭제</button>
                      </div>
                    )}
                    {row.saved && row.editing && (
                      <div className={styles.rowActions}>
                        <button onClick={() => handleUpdate(idx)}>저장</button>
                        <button onClick={() => updateRow(idx, { editing: false })}>취소</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
