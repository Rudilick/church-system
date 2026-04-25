import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import { expenses as expensesApi } from '../../api'
import styles from './AccountingPage.module.css'

const THIS_YEAR  = dayjs().year()
const YEARS      = Array.from({ length: 5 }, (_, i) => THIS_YEAR - i)
const MONTHS     = ['전체', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

const SIDE_TABS  = ['전체', '총무부', '재정부', '교육부', '관리부', '차량부', '전도부']
const EDU_SUBS   = ['전체', '유아부', '유치부', '유년부', '초등부', '청소년부', '청년부']
const EDU_RELATED = ['교육부', '유아부', '유치부', '유년부', '초등부', '청소년부', '청년부']

function compressImage(file, maxSide = 1200, quality = 0.75) {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxSide || height > maxSide) {
          if (width > height) { height = Math.round(height * maxSide / width); width = maxSide }
          else { width = Math.round(width * maxSide / height); height = maxSide }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

const INIT_FORM = { department_id: '', date: dayjs().format('YYYY-MM-DD'), description: '', amount: '', memo: '', receipt_url: '' }

export default function AccountingPage() {
  const [searchParams] = useSearchParams()

  const [year, setYear]           = useState(THIS_YEAR)
  const [month, setMonth]         = useState(0)
  const [expenses, setExpenses]   = useState([])
  const [loading, setLoading]     = useState(false)

  const [activeSideTab, setActiveSideTab] = useState(() => {
    const d = searchParams.get('dept')
    return d && SIDE_TABS.includes(d) ? d : '전체'
  })
  const [eduSubFilter, setEduSubFilter] = useState(() => {
    const s = searchParams.get('sub')
    return s && EDU_SUBS.includes(s) ? s : '전체'
  })

  // 편집 폼 (새 추가 폼 없음 — 새 추가는 /accountinput 에서)
  const [editId, setEditId]       = useState(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [form, setForm]           = useState(INIT_FORM)

  // 영수증 hover 툴팁
  const [tooltip, setTooltip]     = useState(null)
  const tooltipTimer              = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { year }
      if (month > 0) params.month = month
      const r = await expensesApi.list(params)
      setExpenses(r.data)
    } catch {
      toast.error('조회 실패')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])

  // 클라이언트 사이드 필터링
  const displayExpenses = useMemo(() => {
    if (activeSideTab === '전체') return expenses
    if (activeSideTab === '교육부') {
      const byEdu = expenses.filter(e => EDU_RELATED.includes(e.department_name))
      if (eduSubFilter === '전체') return byEdu
      return byEdu.filter(e => e.department_name === eduSubFilter)
    }
    return expenses.filter(e => e.department_name === activeSideTab)
  }, [expenses, activeSideTab, eduSubFilter])

  const totalAmount = displayExpenses.reduce((s, e) => s + Number(e.amount), 0)

  // ── 편집 폼 ──
  const openEdit = (exp) => {
    setEditId(exp.id)
    setForm({
      department_id: exp.department_id ? String(exp.department_id) : '',
      date:          dayjs(exp.date).format('YYYY-MM-DD'),
      description:   exp.description,
      amount:        String(exp.amount),
      memo:          exp.memo ?? '',
      receipt_url:   exp.receipt_url ?? '',
    })
    setShowEditForm(true)
    setTimeout(() => document.getElementById('expenseFormAnchor')?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const cancelForm = () => { setShowEditForm(false); setEditId(null); setForm(INIT_FORM) }

  const handleReceiptFile = async e => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast.error('파일 크기는 10MB 이하여야 합니다.'); return }
    const url = await compressImage(file)
    setForm(f => ({ ...f, receipt_url: url }))
  }

  const handleSave = async () => {
    if (!form.date || !form.description || !form.amount) {
      toast.error('날짜, 지출내용, 금액은 필수입니다.')
      return
    }
    try {
      await expensesApi.update(editId, { ...form, amount: Number(form.amount), department_id: form.department_id || null })
      toast.success('수정했습니다.')
      cancelForm()
      load()
    } catch {
      toast.error('저장에 실패했습니다.')
    }
  }

  const handleDelete = async id => {
    if (!confirm('삭제하시겠습니까?')) return
    try {
      await expensesApi.remove(id)
      setExpenses(list => list.filter(e => e.id !== id))
      toast.success('삭제했습니다.')
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const handleReceiptEnter = (e, url) => {
    clearTimeout(tooltipTimer.current)
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({ url, x: rect.left - 220, y: rect.top - 10 })
  }
  const handleReceiptLeave = () => {
    tooltipTimer.current = setTimeout(() => setTooltip(null), 200)
  }

  return (
    <div className={styles.page}>
      {/* 영수증 이미지 tooltip */}
      {tooltip && (
        <div className={styles.receiptTooltip}
          style={{ top: tooltip.y, left: Math.max(8, tooltip.x) }}
          onMouseEnter={() => clearTimeout(tooltipTimer.current)}
          onMouseLeave={handleReceiptLeave}
        >
          <img src={tooltip.url} alt="영수증 미리보기" />
        </div>
      )}

      {/* 헤더 */}
      <div className={styles.header}>
        <h2 className={styles.title}>지출 회계</h2>
        <div className={styles.filters}>
          <select className={styles.filterSel} value={year} onChange={e => setYear(Number(e.target.value))}>
            {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select className={styles.filterSel} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <a href="/accountinput" target="_blank" rel="noreferrer" className={styles.mobileLink}>
            📱 지출 입력
          </a>
        </div>
      </div>

      {/* 2열 레이아웃: 좌측 탭 + 우측 메인 */}
      <div className={styles.layout}>

        {/* 좌측 사이드바 탭 */}
        <aside className={styles.sidebar}>
          <div className={styles.sideHeader}>부서별</div>
          {SIDE_TABS.map(tab => (
            <button
              key={tab}
              className={`${styles.sideTab} ${activeSideTab === tab ? styles.sideTabActive : ''}`}
              onClick={() => { setActiveSideTab(tab); setEduSubFilter('전체') }}
            >
              {tab}
            </button>
          ))}
        </aside>

        {/* 우측 메인 */}
        <div className={styles.main}>

          {/* 교육부 하위 sort 박스 */}
          {activeSideTab === '교육부' && (
            <div className={styles.sortBoxes}>
              {EDU_SUBS.map(sub => (
                <button
                  key={sub}
                  className={`${styles.sortBox} ${eduSubFilter === sub ? styles.sortBoxActive : ''}`}
                  onClick={() => setEduSubFilter(sub)}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}

          {/* 요약 바 */}
          <div className={styles.summaryBar}>
            <span>총 <strong>{displayExpenses.length}</strong>건</span>
            <span>합계 <strong>{totalAmount.toLocaleString('ko-KR')}원</strong></span>
            <a href="/accountinput" target="_blank" rel="noreferrer" className={styles.addBtn}>
              + 지출 입력
            </a>
          </div>

          {/* 지출 목록 */}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.cSeq}>연번</th>
                  <th className={styles.cDate}>날짜</th>
                  <th className={styles.cDesc}>지출내용</th>
                  <th className={styles.cAmt}>금액</th>
                  <th className={styles.cMemo}>비고</th>
                  <th className={styles.cRcpt}>증빙</th>
                  <th className={styles.cAct}></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className={styles.empty}>조회 중…</td></tr>
                ) : displayExpenses.length === 0 ? (
                  <tr><td colSpan={7} className={styles.empty}>지출 내역이 없습니다.</td></tr>
                ) : (
                  displayExpenses.map((exp, idx) => (
                    <tr key={exp.id} className={styles.row}>
                      <td className={styles.seqCell}>{idx + 1}</td>
                      <td className={styles.dateCell}>{dayjs(exp.date).format('YYYY.MM.DD')}</td>
                      <td className={styles.descCell}>{exp.description}</td>
                      <td className={styles.amtCell}>{Number(exp.amount).toLocaleString('ko-KR')}</td>
                      <td className={styles.memoCell}>{exp.memo ?? ''}</td>
                      <td className={styles.rcptCell}>
                        {exp.receipt_url ? (
                          <button
                            className={styles.rcptBtn}
                            onMouseEnter={e => handleReceiptEnter(e, exp.receipt_url)}
                            onMouseLeave={handleReceiptLeave}
                            onClick={() => {
                              const w = window.open()
                              w.document.write(`<img src="${exp.receipt_url}" style="max-width:100%;"/>`)
                              w.document.close()
                            }}
                            title="클릭하면 원본을 새 창에서 봅니다"
                          >🖼️</button>
                        ) : <span className={styles.noRcpt}>—</span>}
                      </td>
                      <td className={styles.actCell}>
                        <div className={styles.rowActions}>
                          <button onClick={() => openEdit(exp)}>수정</button>
                          <button onClick={() => handleDelete(exp.id)}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 수정 폼 (편집 시에만 표시) */}
          {showEditForm && (
            <div className={styles.formPanel} id="expenseFormAnchor">
              <h3 className={styles.formTitle}>지출 수정</h3>
              <div className={styles.formGrid}>
                <label className={styles.formField}>
                  <span>날짜 <em className={styles.req}>*</em></span>
                  <input type="date" className={styles.formInput} value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </label>
                <label className={styles.formField}>
                  <span>금액 (원) <em className={styles.req}>*</em></span>
                  <input type="text" className={styles.formInput} value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/\D/g, '') }))}
                    placeholder="0" />
                </label>
                <label className={`${styles.formField} ${styles.span2}`}>
                  <span>지출내용 <em className={styles.req}>*</em></span>
                  <input className={styles.formInput} value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="예) 주일 식재료 구입" />
                </label>
                <label className={`${styles.formField} ${styles.span2}`}>
                  <span>비고</span>
                  <input className={styles.formInput} value={form.memo}
                    onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} />
                </label>
                <label className={`${styles.formField} ${styles.span2}`}>
                  <span>영수증 사진</span>
                  <div className={styles.receiptUpload}>
                    <input type="file" accept="image/*" onChange={handleReceiptFile}
                      className={styles.fileInput} id="desktopReceiptFile" />
                    <label htmlFor="desktopReceiptFile" className={styles.fileLabel}>
                      {form.receipt_url ? '📷 사진 변경' : '📷 사진 첨부'}
                    </label>
                    {form.receipt_url && (
                      <div className={styles.receiptPreviewSmall}>
                        <img src={form.receipt_url} alt="미리보기" />
                        <button type="button" className={styles.removeRcpt}
                          onClick={() => setForm(f => ({ ...f, receipt_url: '' }))}>×</button>
                      </div>
                    )}
                  </div>
                </label>
              </div>
              <div className={styles.formActions}>
                <button className={styles.saveBtn} onClick={handleSave}>수정 저장</button>
                <button className={styles.cancelBtn} onClick={cancelForm}>취소</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
