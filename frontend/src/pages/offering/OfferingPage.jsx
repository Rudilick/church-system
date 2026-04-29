import { useCallback, useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import { offering as offeringApi, members as membersApi } from '../../api'
import WeekPicker, { toThisSunday, weekLabel } from '../../components/WeekPicker'
import OfferingReceipt from './OfferingReceipt'
import styles from './OfferingPage.module.css'

const MENU_INPUT   = 'input'
const MENU_STATS   = 'stats'
const MENU_HISTORY = 'history'
const MENU_RECEIPT = 'receipt'

const MENU_ITEMS = [
  { key: MENU_INPUT,   label: '헌금내역 입력' },
  { key: MENU_STATS,   label: '헌금 통계' },
  { key: MENU_HISTORY, label: '헌금 정보조회' },
  { key: MENU_RECEIPT, label: '기부금 영수증' },
]

const INIT_ROWS = 50
const makeBlankRow = key => ({ key, id: null, name: '', memberId: null, amount: '', memo: '', saved: false, editing: false })
const makeRows = () => Array.from({ length: INIT_ROWS }, (_, i) => makeBlankRow(i))

// ──────────────────────────────────────────────
// 헌금내역 입력 섹션
// ──────────────────────────────────────────────
function InputSection({ selectedType, date, setDate }) {
  const [rows, setRows]             = useState(makeRows)
  const [suggest, setSuggest]       = useState({ idx: -1, items: [] })
  const [showPicker, setShowPicker] = useState(false)
  const nameRefs    = useRef([])
  const amountRefs  = useRef([])
  const suggestTimer = useRef(null)

  const prevWeek = () => setDate(d => dayjs(d).subtract(1, 'week').format('YYYY-MM-DD'))
  const nextWeek = () => setDate(d => {
    const next = dayjs(d).add(1, 'week').format('YYYY-MM-DD')
    return next <= toThisSunday() ? next : d
  })

  const loadExisting = useCallback(async (typeId, d) => {
    try {
      const r = await offeringApi.list({ from: d, to: d, type_id: typeId, limit: 200 })
      const existing = (r.data.data || []).map((item, i) => ({
        key: i, id: item.id,
        name: item.member_name || item.name || '',
        memberId: item.member_id,
        amount: String(Number(item.amount) || ''),
        memo: item.memo || '',
        saved: true, editing: false,
      }))
      const padCount = Math.max(0, INIT_ROWS - existing.length)
      setRows([...existing, ...Array.from({ length: padCount }, (_, j) => makeBlankRow(existing.length + j))])
    } catch {
      setRows(makeRows())
    }
  }, [])

  useEffect(() => {
    if (selectedType) loadExisting(selectedType.id, date)
    else setRows(makeRows())
  }, [date, selectedType, loadExisting])

  const updateRow = (idx, patch) => setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))

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
    if (e.key === 'Enter') { e.preventDefault(); nameRefs.current[idx + 1]?.focus() }
  }

  const handleSave = async () => {
    if (!selectedType) { toast.error('헌금 종류를 선택하세요.'); return }
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
      toast.success(`${toSave.length}건 저장했습니다.`)
    } catch {
      toast.error('저장에 실패했습니다.')
    }
  }

  const handleUpdate = async idx => {
    const row = rows[idx]
    try {
      await offeringApi.update(row.id, {
        name: row.name, member_id: row.memberId ?? null,
        amount: Number(row.amount), memo: row.memo || null,
      })
      updateRow(idx, { editing: false })
      toast.success('수정했습니다.')
    } catch {
      toast.error('수정에 실패했습니다.')
    }
  }

  const handleDeleteRow = async idx => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return
    try {
      await offeringApi.remove(rows[idx].id)
      setRows(prev => prev.map((r, i) => i === idx ? makeBlankRow(r.key) : r))
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  let seqCounter = 0, totalShown = false
  const rowDisplay = rows.map(r => {
    const filled = r.name.trim() !== '' || r.saved
    if (filled) { seqCounter++; return { seq: String(seqCounter), isTotal: false } }
    if (!totalShown) { totalShown = true; return { seq: '합계', isTotal: true } }
    return { seq: '', isTotal: false }
  })

  const filledCount = rows.filter(r => r.name.trim() !== '' || r.saved).length
  const totalAmount = rows.filter(r => r.name.trim() !== '' || r.saved).reduce((s, r) => s + (Number(r.amount) || 0), 0)

  return (
    <div>
      <div className={styles.contentHeader}>
        <h2 className={styles.contentTitle}>
          헌금내역 입력{selectedType ? ` · ${selectedType.name}` : ''}
        </h2>
        <div className={styles.weekNavWrap}>
          <div className={styles.weekNav}>
            <button className={styles.weekNavBtn} onClick={prevWeek}>◀</button>
            <button className={styles.weekLabel} onClick={() => setShowPicker(p => !p)}>
              {weekLabel(date)}
            </button>
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

      {!selectedType ? (
        <div className={styles.hintWrap}>
          <p className={styles.hintText}>← 헌금 종류를 선택하세요</p>
        </div>
      ) : (
        <>
          <div className={styles.summaryBar}>
            <span>입력 <strong>{filledCount}</strong>건</span>
            <span>합계 <strong>{totalAmount.toLocaleString('ko-KR')}원</strong></span>
            {rows.some(r => r.saved) && <span className={styles.savedBadge}>✓ 저장됨</span>}
            <button className={styles.addBtn} onClick={handleSave}>저장하기</button>
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
                  const isReadOnly = row.saved && !row.editing
                  return (
                    <tr
                      key={row.key}
                      className={`${styles.sheetRow} ${isTotal ? styles.sheetRowTotal : ''} ${isReadOnly ? styles.sheetRowSaved : ''}`}
                    >
                      <td className={`${styles.sheetCell} ${styles.seqCell} ${isTotal ? styles.totalLabel : ''}`}>{seq}</td>
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
                          className={`${styles.cellInput} ${styles.amtInput} amountInput ${isReadOnly ? styles.savedInput : ''}`}
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
        </>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// 헌금 정보조회 섹션
// ──────────────────────────────────────────────
function HistorySection({ selectedType, date, setDate }) {
  const [rows, setRows]             = useState([])
  const [total, setTotal]           = useState(0)
  const [showPicker, setShowPicker] = useState(false)

  const prevWeek = () => setDate(d => dayjs(d).subtract(1, 'week').format('YYYY-MM-DD'))
  const nextWeek = () => setDate(d => {
    const next = dayjs(d).add(1, 'week').format('YYYY-MM-DD')
    return next <= toThisSunday() ? next : d
  })

  const load = useCallback(async () => {
    try {
      const params = { from: date, to: date, limit: 500 }
      if (selectedType) params.type_id = selectedType.id
      const res = await offeringApi.list(params)
      setRows(res.data.data || [])
      setTotal(res.data.total || 0)
    } catch {
      toast.error('조회 실패')
    }
  }, [date, selectedType])

  useEffect(() => { load() }, [load])

  const sum = rows.reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div>
      <div className={styles.contentHeader}>
        <h2 className={styles.contentTitle}>
          헌금 정보조회{selectedType ? ` · ${selectedType.name}` : ''}
        </h2>
        <div className={styles.weekNavWrap}>
          <div className={styles.weekNav}>
            <button className={styles.weekNavBtn} onClick={prevWeek}>◀</button>
            <button className={styles.weekLabel} onClick={() => setShowPicker(p => !p)}>
              {weekLabel(date)}
            </button>
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

      <div className={styles.summaryBar}>
        <span>합계 <strong>{sum.toLocaleString('ko-KR')}원</strong></span>
        <span>({total}건)</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>날짜</th>
              <th>교인</th>
              <th>헌금 종류</th>
              <th>금액</th>
              <th>메모</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className={styles.empty}>데이터 없음</td></tr>
            ) : (
              rows.map(r => (
                <tr key={r.id} className={styles.histRow}>
                  <td className={styles.histDate}>{dayjs(r.date).format('YYYY.MM.DD')}</td>
                  <td className={styles.histName}>{r.member_name ?? '미상'}</td>
                  <td className={styles.histType}>{r.type_name}</td>
                  <td className={styles.histAmt}>{Number(r.amount).toLocaleString('ko-KR')}원</td>
                  <td className={styles.histMemo}>{r.memo ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// 메인 페이지
// ──────────────────────────────────────────────
export default function OfferingPage() {
  const [activeMenu, setActiveMenu]   = useState(MENU_INPUT)
  const [types, setTypes]             = useState([])
  const [selectedType, setSelectedType] = useState(null)
  const [date, setDate]               = useState(toThisSunday)

  const hasTypeSidebar = activeMenu === MENU_INPUT || activeMenu === MENU_HISTORY

  useEffect(() => {
    offeringApi.types().then(r => setTypes(r.data))
  }, [])

  const handleMenuChange = menu => {
    setActiveMenu(menu)
    if (menu !== MENU_INPUT && menu !== MENU_HISTORY) setSelectedType(null)
  }

  return (
    <div className={styles.pageWrap}>
      {/* ── 1차 사이드바: 메뉴 (2차탭) ── */}
      <div className={styles.sidebar1}>
        <div className={styles.sidebarLabel}>헌금 관리</div>
        {MENU_ITEMS.map(item => (
          <button
            key={item.key}
            className={`${styles.sideTabItem} ${activeMenu === item.key ? styles.sideTabItemActive : ''}`}
            onClick={() => handleMenuChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* ── 2차 사이드바: 헌금 종류 (3차탭) ── */}
      {hasTypeSidebar && (
        <div className={styles.sidebar2}>
          <div className={styles.sidebarLabel}>헌금 종류</div>
          <button
            className={`${styles.sideTabAll} ${selectedType === null ? styles.sideTabAllActive : ''}`}
            onClick={() => setSelectedType(null)}
          >전체</button>
          {types.map(t => (
            <button
              key={t.id}
              className={`${styles.sideTabItem} ${selectedType?.id === t.id ? styles.sideTabItemActive : ''}`}
              onClick={() => setSelectedType(t)}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* ── 콘텐츠 영역 ── */}
      <div className={styles.content}>
        {activeMenu === MENU_INPUT && (
          <InputSection selectedType={selectedType} date={date} setDate={setDate} />
        )}
        {activeMenu === MENU_STATS && (
          <div className={styles.hintWrap}>
            <p className={styles.hintText}>헌금 통계 (준비 중)</p>
          </div>
        )}
        {activeMenu === MENU_HISTORY && (
          <HistorySection selectedType={selectedType} date={date} setDate={setDate} />
        )}
        {activeMenu === MENU_RECEIPT && (
          <OfferingReceipt embedded />
        )}
      </div>
    </div>
  )
}
