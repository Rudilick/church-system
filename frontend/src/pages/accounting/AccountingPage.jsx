import { useCallback, useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import { departments as deptsApi, expenses as expensesApi } from '../../api'
import { compressToTarget } from '../../utils/imageProcessor'
import styles from './AccountingPage.module.css'

const THIS_YEAR = dayjs().year()
const YEARS     = Array.from({ length: 5 }, (_, i) => THIS_YEAR - i)
const MONTHS    = ['전체', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

const INIT_FORM = { department_id: '', date: dayjs().format('YYYY-MM-DD'), description: '', amount: '', memo: '', receipt_url: '', author_name: '' }

// ── 예산 경로 트리 (budget dept 가 포함된 경로만) ─────────────
function buildBudgetPathTree(flat) {
  const budgetIds = new Set(flat.filter(d => d.is_budget_dept).map(d => d.id))

  function hasBudget(id) {
    if (budgetIds.has(id)) return true
    return flat.filter(d => d.parent_id === id).some(c => hasBudget(c.id))
  }

  function build(parentId) {
    return flat
      .filter(d => d.parent_id === (parentId ?? null) && hasBudget(d.id))
      .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))
      .map(d => ({ ...d, children: build(d.id) }))
  }

  return build(null)
}

// 특정 dept id 의 조상 경로 (root → leaf)
function getDeptPath(flat, deptId) {
  if (!deptId) return []
  const path = []
  let cur = flat.find(d => d.id === Number(deptId))
  while (cur) {
    path.unshift(cur.id)
    cur = cur.parent_id ? flat.find(d => d.id === cur.parent_id) : null
  }
  return path
}

// ── 계층 드롭다운 ─────────────────────────────────────────────
function CascadingDeptSelect({ tree, flat, value, onChange }) {
  const [path, setPath] = useState([])

  // value(외부) 변경 시 path 재계산
  useEffect(() => {
    setPath(getDeptPath(flat, value))
  }, [value, flat])

  const getOptions = level => {
    if (level === 0) return tree
    const parentId = path[level - 1]
    if (!parentId) return []
    const findNode = (nodes, id) => {
      for (const n of nodes) {
        if (n.id === id) return n
        const f = findNode(n.children, id)
        if (f) return f
      }
      return null
    }
    return findNode(tree, parentId)?.children ?? []
  }

  const handleChange = (level, id) => {
    const newPath = [...path.slice(0, level)]
    if (id) newPath.push(Number(id))
    setPath(newPath)

    // 선택된 노드가 budget dept면 onChange 호출, 아니면 null
    const node = flat.find(d => d.id === Number(id))
    onChange(node?.is_budget_dept ? Number(id) : null)
  }

  const dropdowns = []
  for (let i = 0; i <= path.length; i++) {
    const opts = getOptions(i)
    if (opts.length === 0) break
    const selected = path[i] ?? ''
    dropdowns.push(
      <select
        key={i}
        className={styles.cascadeSelect}
        value={selected}
        onChange={e => handleChange(i, e.target.value)}
      >
        <option value="">{i === 0 ? '부서 선택 (선택)' : '세부 선택'}</option>
        {opts.map(d => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
    )
    if (!selected) break
  }

  return <div className={styles.cascadeWrap}>{dropdowns}</div>
}

// ── 사이드바 섹션 ─────────────────────────────────────────────
function buildSidebarSections(flat) {
  const budgetDepts = flat.filter(d => d.is_budget_dept)
    .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))

  // 부모별 그루핑
  const parentMap = {}
  for (const d of budgetDepts) {
    const key = d.parent_id ?? '__root__'
    if (!parentMap[key]) parentMap[key] = []
    parentMap[key].push(d)
  }

  const sections = []

  // 부모 없는 budget depts → 바로 아이템
  if (parentMap['__root__']) {
    sections.push({ header: null, items: parentMap['__root__'] })
  }

  // 부모 있는 경우 → 부모별로 섹션
  const processedParents = new Set()
  for (const d of budgetDepts) {
    if (!d.parent_id || processedParents.has(d.parent_id)) continue
    processedParents.add(d.parent_id)
    const parent = flat.find(p => p.id === d.parent_id)
    sections.push({ header: parent, items: parentMap[d.parent_id] ?? [] })
  }

  return sections
}

export default function AccountingPage() {
  const [allDepts, setAllDepts]     = useState([])
  const [activeDept, setActiveDept] = useState(null)
  const [year, setYear]             = useState(THIS_YEAR)
  const [month, setMonth]           = useState(0)
  const [expenses, setExpenses]     = useState([])
  const [loading, setLoading]       = useState(false)

  const [showForm, setShowForm]       = useState(false)
  const [editId, setEditId]           = useState(null)
  const [form, setForm]               = useState(INIT_FORM)
  const [compressing, setCompressing] = useState(false)
  const [sizeKb, setSizeKb]           = useState(null)

  const [openSections, setOpenSections] = useState({})
  const [tooltip, setTooltip]           = useState(null)
  const tooltipTimer                    = useRef(null)

  useEffect(() => {
    deptsApi.list().then(r => setAllDepts(r.data))
  }, [])

  const budgetTree     = buildBudgetPathTree(allDepts)
  const sidebarSections = buildSidebarSections(allDepts)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { year }
      if (activeDept) params.department_id = activeDept
      if (month > 0)  params.month = month
      const r = await expensesApi.list(params)
      setExpenses(r.data)
    } catch {
      toast.error('조회 실패')
    } finally {
      setLoading(false)
    }
  }, [activeDept, year, month])

  useEffect(() => { load() }, [load])

  const totalAmount = expenses.reduce((s, e) => s + Number(e.amount), 0)

  const openAdd = () => {
    setEditId(null)
    setForm({ ...INIT_FORM, department_id: activeDept ? String(activeDept) : '' })
    setShowForm(true)
  }

  const openEdit = exp => {
    setEditId(exp.id)
    setForm({
      department_id: exp.department_id ? String(exp.department_id) : '',
      date:          dayjs(exp.date).format('YYYY-MM-DD'),
      description:   exp.description,
      amount:        String(exp.amount),
      memo:          exp.memo ?? '',
      receipt_url:   exp.receipt_url ?? '',
      author_name:   exp.author_name ?? '',
    })
    resetScanState()
    setShowForm(true)
    setTimeout(() => document.getElementById('expenseFormAnchor')?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const resetScanState = () => { setCompressing(false); setSizeKb(null) }
  const cancelForm = () => { setShowForm(false); setEditId(null); setForm(INIT_FORM); resetScanState() }

  const handleReceiptFile = async e => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast.error('파일 크기는 10MB 이하여야 합니다.'); return }
    setCompressing(true)
    setSizeKb(null)
    try {
      const { dataUrl, bytes } = await compressToTarget(file)
      setForm(f => ({ ...f, receipt_url: dataUrl }))
      setSizeKb(Math.round(bytes / 1024))
    } catch {
      toast.error('이미지 처리에 실패했습니다.')
    } finally {
      setCompressing(false)
    }
  }

  const handleSave = async () => {
    if (!form.date || !form.description || !form.amount) {
      toast.error('날짜, 지출내용, 금액은 필수입니다.')
      return
    }
    try {
      const payload = { ...form, amount: Number(form.amount), department_id: form.department_id || null }
      if (editId) {
        await expensesApi.update(editId, payload)
        toast.success('수정했습니다.')
      } else {
        await expensesApi.add(payload)
        toast.success('저장했습니다.')
      }
      cancelForm(); load()
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

  const toggleSection = key => setOpenSections(s => ({ ...s, [key]: !s[key] }))

  // 사이드바에서 부서명 찾기
  const activeDeptName = activeDept
    ? (allDepts.find(d => d.id === activeDept)?.name ?? '')
    : '전체'

  return (
    <div className={styles.pageWrap}>
      {/* 영수증 tooltip */}
      {tooltip && (
        <div className={styles.receiptTooltip}
          style={{ top: tooltip.y, left: Math.max(8, tooltip.x) }}
          onMouseEnter={() => clearTimeout(tooltipTimer.current)}
          onMouseLeave={handleReceiptLeave}
        >
          <img src={tooltip.url} alt="영수증 미리보기" />
        </div>
      )}

      {/* ── 왼쪽 사이드바 ── */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarLabel}>지출 회계</div>

        <button
          className={`${styles.sideTabAll} ${activeDept === null ? styles.sideTabAllActive : ''}`}
          onClick={() => setActiveDept(null)}
        >전체</button>

        {sidebarSections.length === 0 && (
          <span className={styles.sideEmpty}>교회설정 → 조직관리에서<br/>예산부서를 체크해주세요</span>
        )}

        {sidebarSections.map((sec, si) => (
          sec.header
            ? (
              <div key={sec.header.id} className={styles.sideSection}>
                <button
                  className={styles.sideSectionHeader}
                  onClick={() => toggleSection(sec.header.id)}
                >
                  <span>{sec.header.name}</span>
                  <span className={styles.sideSectionArrow}>
                    {openSections[sec.header.id] ? '▲' : '▼'}
                  </span>
                </button>
                {openSections[sec.header.id] && sec.items.map(d => (
                  <button
                    key={d.id}
                    className={`${styles.sideTabItem} ${activeDept === d.id ? styles.sideTabItemActive : ''}`}
                    onClick={() => setActiveDept(d.id)}
                  >{d.name}</button>
                ))}
              </div>
            )
            : sec.items.map(d => (
              <button
                key={d.id}
                className={`${styles.sideTabItem} ${activeDept === d.id ? styles.sideTabItemActive : ''}`}
                style={{ paddingLeft: 14 }}
                onClick={() => setActiveDept(d.id)}
              >{d.name}</button>
            ))
        ))}
      </div>

      {/* ── 오른쪽 콘텐츠 ── */}
      <div className={styles.content}>
        {/* 헤더 */}
        <div className={styles.header}>
          <h2 className={styles.title}>지출 회계 · {activeDeptName}</h2>
          <div className={styles.filters}>
            <select className={styles.filterSel} value={year} onChange={e => setYear(Number(e.target.value))}>
              {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <select className={styles.filterSel} value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <a href="/accountinput" target="_blank" rel="noreferrer" className={styles.mobileLink}>
              📱 모바일 입력
            </a>
          </div>
        </div>

        {/* 요약 바 */}
        <div className={styles.summaryBar}>
          <span>총 <strong>{expenses.length}</strong>건</span>
          <span>합계 <strong>{totalAmount.toLocaleString('ko-KR')}원</strong></span>
          <button className={styles.addBtn} onClick={openAdd}>+ 지출 추가</button>
        </div>

        {/* 지출 목록 */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.cSeq}>순번</th>
                <th className={styles.cDate}>날짜</th>
                {activeDept === null && <th className={styles.cDept}>부서</th>}
                <th className={styles.cDesc}>지출내용</th>
                <th className={styles.cAmt}>금액</th>
                <th className={styles.cMemo}>비고</th>
                <th className={styles.cAuthor}>작성자</th>
                <th className={styles.cRcpt}>영수증</th>
                <th className={styles.cAct}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={activeDept === null ? 9 : 8} className={styles.empty}>조회 중…</td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan={activeDept === null ? 9 : 8} className={styles.empty}>지출 내역이 없습니다.</td></tr>
              ) : (
                expenses.map((exp, idx) => (
                  <tr key={exp.id} className={styles.row}>
                    <td className={styles.seqCell}>{idx + 1}</td>
                    <td className={styles.dateCell}>{dayjs(exp.date).format('YYYY.MM.DD')}</td>
                    {activeDept === null && <td className={styles.deptCell}>{exp.department_name ?? '—'}</td>}
                    <td className={styles.descCell}>{exp.description}</td>
                    <td className={styles.amtCell}>{Number(exp.amount).toLocaleString('ko-KR')}</td>
                    <td className={styles.memoCell}>{exp.memo ?? ''}</td>
                    <td className={styles.authorCell}>{exp.author_name ?? ''}</td>
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

        {/* 입력/수정 폼 */}
        {showForm && (
          <div className={styles.formPanel} id="expenseFormAnchor">
            <h3 className={styles.formTitle}>{editId ? '지출 수정' : '새 지출 추가'}</h3>
            <div className={styles.formGrid}>
              <label className={`${styles.formField} ${styles.span2}`}>
                <span>부서</span>
                <CascadingDeptSelect
                  tree={budgetTree}
                  flat={allDepts}
                  value={form.department_id}
                  onChange={id => setForm(f => ({ ...f, department_id: id ? String(id) : '' }))}
                />
              </label>
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
              <label className={styles.formField}>
                <span>비고</span>
                <input className={styles.formInput} value={form.memo}
                  onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} />
              </label>
              <label className={styles.formField}>
                <span>작성자</span>
                <input className={styles.formInput} value={form.author_name}
                  onChange={e => setForm(f => ({ ...f, author_name: e.target.value }))}
                  placeholder="작성자 이름" />
              </label>
              <label className={styles.formField}>
                <span>영수증 사진</span>
                <div className={styles.receiptUpload}>
                  <input type="file" accept="image/*" onChange={handleReceiptFile}
                    className={styles.fileInput} id="desktopReceiptFile"
                    disabled={compressing} />
                  <label htmlFor="desktopReceiptFile" className={styles.fileLabel}>
                    {compressing ? '⏳ 처리 중...' : form.receipt_url ? '📷 사진 변경' : '📷 사진 첨부'}
                  </label>
                  {form.receipt_url && (
                    <div className={styles.receiptPreviewSmall}>
                      <img src={form.receipt_url} alt="미리보기" />
                      <button type="button" className={styles.removeRcpt}
                        onClick={() => { setForm(f => ({ ...f, receipt_url: '' })); resetScanState() }}>×</button>
                    </div>
                  )}
                </div>
                {sizeKb && (
                  <span className={styles.scanMsg}>✅ 압축 완료 · {sizeKb}KB</span>
                )}
              </label>
            </div>
            <div className={styles.formActions}>
              <button className={styles.saveBtn} onClick={handleSave}>
                {editId ? '수정 저장' : '저장'}
              </button>
              <button className={styles.cancelBtn} onClick={cancelForm}>취소</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
