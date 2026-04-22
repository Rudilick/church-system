import { useEffect, useRef, useState, useCallback } from 'react'
import { offering as offeringApi, members as membersApi } from '../../api'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import styles from './Offering.module.css'

const TODAY = dayjs().format('YYYY-MM-DD')
const INIT_ROWS = 50

const makeRows = () =>
  Array.from({ length: INIT_ROWS }, (_, i) => ({
    key: i, name: '', memberId: null, amount: '', memo: '', saved: false,
  }))

const TYPE_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ec4899']

export default function OfferingInput() {
  const [date, setDate] = useState(TODAY)
  const [types, setTypes] = useState([])
  const [counts, setCounts] = useState({})          // { typeId: count }
  const [selectedType, setSelectedType] = useState(null)
  const [rows, setRows] = useState(makeRows)
  const [suggest, setSuggest] = useState({ idx: -1, items: [] })

  const nameRefs   = useRef([])
  const amountRefs = useRef([])
  const suggestTimer = useRef(null)

  // 헌금 종류 로드
  useEffect(() => {
    offeringApi.types().then(r => setTypes(r.data))
  }, [])

  // 날짜별 건수 새로고침
  const refreshCounts = useCallback(async () => {
    const r = await offeringApi.dailyCounts(date)
    const map = {}
    r.data.forEach(c => { map[c.offering_type_id] = c.count })
    setCounts(map)
  }, [date])

  useEffect(() => { refreshCounts() }, [refreshCounts])

  // 종류 선택 시 rows 초기화
  const selectType = type => {
    setSelectedType(type)
    setRows(makeRows())
    setSuggest({ idx: -1, items: [] })
  }

  // 행 업데이트
  const updateRow = (idx, patch) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  // 이름 입력
  const handleNameChange = (idx, val) => {
    updateRow(idx, { name: val, memberId: null })
    clearTimeout(suggestTimer.current)
    if (val.length < 2) { setSuggest({ idx: -1, items: [] }); return }
    suggestTimer.current = setTimeout(async () => {
      const r = await membersApi.list({ q: val, limit: 8 })
      setSuggest({ idx, items: r.data.data || [] })
    }, 200)
  }

  // 자동완성 선택
  const pickSuggest = (idx, member) => {
    updateRow(idx, { name: member.name, memberId: member.id })
    setSuggest({ idx: -1, items: [] })
    setTimeout(() => amountRefs.current[idx]?.focus(), 50)
  }

  // 금액 입력 (Enter → 다음 행 이름)
  const handleAmountKeyDown = (idx, e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      nameRefs.current[idx + 1]?.focus()
    }
  }

  // 저장
  const handleSave = async () => {
    const toSave = rows.filter(r => r.name.trim() && r.amount && !r.saved)
    if (!toSave.length) { toast.error('저장할 항목이 없습니다.'); return }
    try {
      await Promise.all(toSave.map(r =>
        offeringApi.add({
          member_id: r.memberId ?? null,
          offering_type_id: selectedType.id,
          amount: Number(r.amount),
          date,
          memo: r.memo || null,
        })
      ))
      setRows(prev => prev.map(r =>
        toSave.some(s => s.key === r.key) ? { ...r, saved: true } : r
      ))
      await refreshCounts()
      toast.success(`${toSave.length}건 저장했습니다.`)
    } catch {
      toast.error('저장에 실패했습니다.')
    }
  }

  // 표시용 계산
  const filledCount = rows.filter(r => r.name.trim()).length
  const totalAmount = rows
    .filter(r => r.name.trim())
    .reduce((s, r) => s + (Number(r.amount) || 0), 0)

  // 연번 계산: 채워진 행에 1,2,3... / 첫 빈 행에 "합계"
  let seqCounter = 0
  let totalShown = false
  const rowDisplay = rows.map(r => {
    const filled = r.name.trim() !== ''
    if (filled) { seqCounter++; return { seq: String(seqCounter), isTotal: false } }
    if (!totalShown) { totalShown = true; return { seq: '합계', isTotal: true } }
    return { seq: '', isTotal: false }
  })

  // ── 종류 선택 화면 ────────────────────────────────────────
  if (!selectedType) {
    return (
      <div>
        <div className={styles.inputHeader}>
          <button className={styles.backBtn} onClick={() => window.history.back()}>← 헌금 관리</button>
          <h2 className={styles.inputTitle}>헌금내역 입력</h2>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={styles.dateInput} />
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
              <div className={styles.typeTileIcon} style={{ color: TYPE_COLORS[i % TYPE_COLORS.length] }}>💛</div>
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

  // ── 입력 스프레드시트 ─────────────────────────────────────
  return (
    <div>
      <div className={styles.inputHeader}>
        <button className={styles.backBtn} onClick={() => setSelectedType(null)}>← 종류 선택</button>
        <h2 className={styles.inputTitle}>{selectedType.name}</h2>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={styles.dateInput} />
      </div>

      {/* 요약 바 */}
      <div className={styles.summaryBar}>
        <span>입력 <strong>{filledCount}</strong>건</span>
        <span>합계 <strong>{totalAmount.toLocaleString('ko-KR')}원</strong></span>
        {rows.some(r => r.saved) && <span className={styles.savedBadge}>✓ 저장됨</span>}
        <button className={styles.saveBtn} onClick={handleSave}>저장하기</button>
      </div>

      {/* 스프레드시트 */}
      <div className={styles.sheetWrap}>
        <table className={styles.sheet}>
          <thead>
            <tr>
              <th className={styles.colSeq}>연번</th>
              <th className={styles.colName}>이름</th>
              <th className={styles.colAmt}>금액</th>
              <th className={styles.colMemo}>메모</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const { seq, isTotal } = rowDisplay[idx]
              return (
                <tr
                  key={row.key}
                  className={`
                    ${styles.sheetRow}
                    ${isTotal ? styles.sheetRowTotal : ''}
                    ${row.saved ? styles.sheetRowSaved : ''}
                  `}
                >
                  {/* 연번 */}
                  <td className={`${styles.sheetCell} ${styles.seqCell} ${isTotal ? styles.totalLabel : ''}`}>
                    {seq}
                  </td>

                  {/* 이름 */}
                  <td className={styles.sheetCell} style={{ position: 'relative' }}>
                    <input
                      ref={el => nameRefs.current[idx] = el}
                      className={`${styles.cellInput} ${row.saved ? styles.savedInput : ''}`}
                      value={row.name}
                      onChange={e => handleNameChange(idx, e.target.value)}
                      onBlur={() => setTimeout(() => setSuggest({ idx: -1, items: [] }), 150)}
                      readOnly={row.saved}
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

                  {/* 금액 */}
                  <td className={styles.sheetCell}>
                    <input
                      ref={el => amountRefs.current[idx] = el}
                      className={`${styles.cellInput} ${styles.amtInput} ${row.saved ? styles.savedInput : ''}`}
                      value={row.amount}
                      onChange={e => updateRow(idx, { amount: e.target.value.replace(/\D/g, '') })}
                      onKeyDown={e => handleAmountKeyDown(idx, e)}
                      readOnly={row.saved}
                      placeholder="0"
                    />
                  </td>

                  {/* 메모 */}
                  <td className={styles.sheetCell}>
                    <input
                      className={`${styles.cellInput} ${row.saved ? styles.savedInput : ''}`}
                      value={row.memo}
                      onChange={e => updateRow(idx, { memo: e.target.value })}
                      readOnly={row.saved}
                    />
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
