import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { publicApi } from '../../api'
import { compressToTarget } from '../../utils/imageProcessor'
import styles from './AccountInput.module.css'

// ── 계층 트리 빌더 (회계부서만) ─────────────────────────────
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

// ── 2단 계층 드롭다운 ────────────────────────────────────────
function CascadingDeptSelect({ tree, flat, value, onChange }) {
  const [path, setPath] = useState([])

  useEffect(() => {
    setPath(getDeptPath(flat, value ? Number(value) : null))
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
    const node = flat.find(d => d.id === Number(id))
    onChange(node?.is_budget_dept ? String(id) : '')
  }

  if (tree.length === 0) {
    return (
      <div style={{ fontSize: '0.85rem', color: '#94a3b8', padding: '8px 0' }}>
        등록된 회계 부서가 없습니다.
      </div>
    )
  }

  const dropdowns = []
  for (let i = 0; i <= path.length; i++) {
    const opts = getOptions(i)
    if (opts.length === 0) break
    const selected = path[i] ?? ''
    dropdowns.push(
      <select
        key={i}
        className={styles.input}
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

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{dropdowns}</div>
}

export default function AccountInput() {
  const [depts, setDepts]           = useState([])
  const [budgetTree, setBudgetTree] = useState([])
  const [form, setForm]             = useState({
    department_id: '',
    date: dayjs().format('YYYY-MM-DD'),
    description: '',
    amount: '',
    memo: '',
    receipt_url: '',
    author_name: '',
  })
  const [preview, setPreview]   = useState(null)
  const [status, setStatus]     = useState('idle')
  const [errMsg, setErrMsg]     = useState('')
  const [compressing, setCompressing] = useState(false)
  const [sizeKb, setSizeKb]     = useState(null)
  const [fileKey, setFileKey]   = useState(0)

  useEffect(() => {
    publicApi.departments()
      .then(data => {
        const flat = Array.isArray(data) ? data : []
        setDepts(flat)
        setBudgetTree(buildBudgetPathTree(flat))
      })
      .catch(() => {})
  }, [])

  const handlePhoto = async e => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      setErrMsg('사진 크기는 15MB 이하여야 합니다.')
      return
    }
    setCompressing(true)
    setErrMsg('')
    try {
      const { dataUrl, bytes } = await compressToTarget(file)
      setPreview(dataUrl)
      setSizeKb(Math.round(bytes / 1024))
      setForm(f => ({ ...f, receipt_url: dataUrl }))
    } catch {
      setErrMsg('이미지 처리에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setCompressing(false)
    }
  }

  const removePhoto = () => {
    setPreview(null)
    setSizeKb(null)
    setFileKey(k => k + 1)
    setForm(f => ({ ...f, receipt_url: '' }))
  }

  const RESET = {
    department_id: '', date: dayjs().format('YYYY-MM-DD'),
    description: '', amount: '', memo: '', receipt_url: '', author_name: '',
  }

  const handleSubmit = async () => {
    setErrMsg('')
    if (!form.date || !form.description.trim() || !form.amount) {
      setErrMsg('날짜, 지출내용, 금액을 입력해 주세요.')
      return
    }
    setStatus('loading')
    try {
      await publicApi.addExpense({
        ...form,
        amount: Number(form.amount),
        department_id: form.department_id || null,
      })
      setStatus('success')
      setTimeout(() => {
        setForm(RESET)
        setPreview(null)
        setSizeKb(null)
        setFileKey(k => k + 1)
        setStatus('idle')
      }, 3000)
    } catch (err) {
      setStatus('error')
      setErrMsg(err?.message ?? '저장에 실패했습니다. 다시 시도해 주세요.')
    }
  }

  if (status === 'success') {
    return (
      <div className={styles.page}>
        <div className={styles.successBox}>
          <div className={styles.successIcon}>✅</div>
          <p className={styles.successMsg}>저장되었습니다!</p>
          <p className={styles.successSub}>잠시 후 입력 화면으로 돌아갑니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.logo}>⛪</span>
        <h1 className={styles.title}>지출 입력</h1>
        <p className={styles.subtitle}>교회 지출 내역을 입력해 주세요</p>
      </header>

      <div className={styles.form}>
        {/* 부서 — 회계부서만 2단 계층 드롭다운 */}
        <div className={styles.field}>
          <label className={styles.label}>부서</label>
          <CascadingDeptSelect
            tree={budgetTree}
            flat={depts}
            value={form.department_id}
            onChange={val => setForm(f => ({ ...f, department_id: val }))}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>날짜 <span className={styles.req}>*</span></label>
          <input type="date" className={styles.input} value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>지출내용 <span className={styles.req}>*</span></label>
          <input className={styles.input} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="예) 주일 식재료 구입" />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>금액 (원) <span className={styles.req}>*</span></label>
          <input
            type="tel"
            inputMode="numeric"
            className={`${styles.input} ${styles.amtInput}`}
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/\D/g, '') }))}
            placeholder="0"
          />
          {form.amount && (
            <span className={styles.amtPreview}>{Number(form.amount).toLocaleString('ko-KR')} 원</span>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>작성자</label>
          <input className={styles.input} value={form.author_name}
            onChange={e => setForm(f => ({ ...f, author_name: e.target.value }))}
            placeholder="작성자 이름" />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>비고 (선택)</label>
          <input className={styles.input} value={form.memo}
            onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
            placeholder="메모" />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>영수증 첨부</label>
          {compressing ? (
            <div className={styles.scanningBox}>
              <div className={styles.scanSpinner} />
              <span className={styles.scanningText}>사진 처리 중...</span>
            </div>
          ) : preview ? (
            <div className={styles.previewWrap}>
              <img src={preview} alt="영수증 미리보기" className={styles.previewImg} />
              {sizeKb && (
                <p className={styles.sizeInfo}>압축 완료 · {sizeKb}KB</p>
              )}
              <div className={styles.previewActions}>
                <button type="button" className={styles.removeBtn} onClick={removePhoto}>
                  × 사진 제거
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.photoBtnRow}>
              <input key={`cap-${fileKey}`} type="file" accept="image/*" capture="environment"
                id="photoCapture" className={styles.fileInput} onChange={handlePhoto} />
              <label htmlFor="photoCapture" className={styles.photoBtn}>
                📷 바로 촬영
              </label>
              <input key={`gal-${fileKey}`} type="file" accept="image/*"
                id="photoGallery" className={styles.fileInput} onChange={handlePhoto} />
              <label htmlFor="photoGallery" className={styles.photoBtn}>
                🖼️ 앨범에서 선택
              </label>
            </div>
          )}
        </div>

        {errMsg && <p className={styles.errMsg}>⚠️ {errMsg}</p>}

        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={status === 'loading' || compressing}
        >
          {status === 'loading' ? '저장 중…' : '저장하기'}
        </button>
      </div>
    </div>
  )
}
