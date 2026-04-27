import { useEffect, useRef, useState, useCallback } from 'react'
import { offering as offeringApi, members as membersApi } from '../../api'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import styles from './Offering.module.css'
import WeekPicker, { toThisSunday, weekLabel } from '../../components/WeekPicker'

const INIT_ROWS = 50

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
