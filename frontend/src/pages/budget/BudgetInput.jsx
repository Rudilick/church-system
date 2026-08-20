import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { budget as api, departments as deptsApi } from '../../api'
import toast from 'react-hot-toast'
import PageShell from '../../components/PageShell'
import DeleteGuardModal from '../../components/DeleteGuardModal'
import { useDeleteGuard } from '../../hooks/useDeleteGuard'
import { INCOME_ACCOUNTS, EXPENSE_ACCOUNTS } from '../../data/budgetAccounts'
import { buildBudgetPathTree, getDeptPath } from '../../utils/budgetDeptTree'
import styles from './Budget.module.css'

// 예산서입력 — 부서(조직)를 먼저 선택한 뒤, 그 부서의 예산 사업을 표준 관/항/목
// 체계(dropdown으로만 선택 가능)에 맞춰 사업명 단위로 부기하는 화면.
// "총괄" 탭은 전체 부서 합산 결과를 읽기 전용으로 보여준다.

// 표준 계정을 목(leaf) 단위 평면 배열로 변환
function flattenAccounts(accounts) {
  const out = []
  accounts.forEach(gwan => {
    const hangList = gwan.groups ?? [{ code: gwan.code, name: gwan.name, items: gwan.items ?? [] }]
    hangList.forEach(hang => {
      hang.items.forEach(item => out.push({ code: item.code, name: item.name }))
    })
  })
  return out
}

// ── 관 → 항 → 목 단계식 선택 (표준 계정 체계 밖의 값은 입력 불가) ──
function CascadingAccountSelect({ accounts, value, onChange }) {
  const [gwanCode, setGwanCode] = useState('')
  const [hangCode, setHangCode] = useState('')

  useEffect(() => {
    if (!value) return
    for (const gwan of accounts) {
      const hangList = gwan.groups ?? [{ code: gwan.code, items: gwan.items ?? [] }]
      for (const hang of hangList) {
        if (hang.items.some(it => it.code === value)) {
          setGwanCode(gwan.code)
          setHangCode(gwan.groups ? hang.code : '')
          return
        }
      }
    }
  }, [value, accounts])

  const selectedGwan = accounts.find(g => g.code === gwanCode)
  const hangList = selectedGwan
    ? (selectedGwan.groups ?? [{ code: selectedGwan.code, name: selectedGwan.name, items: selectedGwan.items ?? [] }])
    : []
  const resolvedHang = selectedGwan
    ? (selectedGwan.groups ? hangList.find(h => h.code === hangCode) : hangList[0])
    : null
  const leafItems = resolvedHang?.items ?? []

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <select
        value={gwanCode}
        onChange={e => { setGwanCode(e.target.value); setHangCode(''); onChange('') }}
        style={inputStyle}
      >
        <option value="">관 선택</option>
        {accounts.map(g => <option key={g.code} value={g.code}>{g.code} {g.name}</option>)}
      </select>
      {selectedGwan?.groups && (
        <select
          value={hangCode}
          onChange={e => { setHangCode(e.target.value); onChange('') }}
          style={inputStyle}
        >
          <option value="">항 선택</option>
          {selectedGwan.groups.map(h => <option key={h.code} value={h.code}>{h.code} {h.name}</option>)}
        </select>
      )}
      {resolvedHang && (
        <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
          <option value="">목 선택</option>
          {leafItems.map(it => <option key={it.code} value={it.code}>{it.code} {it.name}</option>)}
        </select>
      )}
    </div>
  )
}

// ── 부서(조직) 선택 — 예산부서(is_budget_dept)만 계층으로 노출 ──
function CascadingDeptSelect({ tree, flat, value, onChange }) {
  const [path, setPath] = useState([])

  useEffect(() => { setPath(getDeptPath(flat, value)) }, [value, flat])

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
    onChange(node?.is_budget_dept ? Number(id) : null)
  }

  if (tree.length === 0) {
    return (
      <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
        등록된 예산부서가 없습니다. 조직관리에서 부서를 "예산부서"로 지정해주세요.
      </div>
    )
  }

  const dropdowns = []
  for (let i = 0; i <= path.length; i++) {
    const opts = getOptions(i)
    if (opts.length === 0) break
    const selected = path[i] ?? ''
    dropdowns.push(
      <select key={i} value={selected} onChange={e => handleChange(i, e.target.value)} style={inputStyle}>
        <option value="">{i === 0 ? '부서 선택' : '세부 선택'}</option>
        {opts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
    )
    if (!selected) break
  }
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{dropdowns}</div>
}

// ── 부서별 입력 — 목(account_code) 그룹 안에 사업명 단위로 여러 줄 ──
function DepartmentItemsSection({ title, type, accounts, items, onAdd, onSaveField, onDelete }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', amount: '', calc_basis: '' })
  const [saving, setSaving] = useState(false)

  const typeItems = items.filter(it => it.type === type)
  const total = typeItems.reduce((s, it) => s + Number(it.budget_amount || 0), 0)

  const byCode = {}
  typeItems.forEach(it => {
    const key = it.account_code || '__none__'
    if (!byCode[key]) byCode[key] = []
    byCode[key].push(it)
  })
  const leaves = flattenAccounts(accounts)

  const submitAdd = async () => {
    setSaving(true)
    const ok = await onAdd(type, form)
    setSaving(false)
    if (ok) { setForm({ code: '', name: '', amount: '', calc_basis: '' }); setAdding(false) }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.08)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700 }}>{title}</span>
        <span style={{ color: type === 'I' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{total.toLocaleString()}원</span>
      </div>

      {Object.keys(byCode).length === 0 && (
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>등록된 사업이 없습니다.</p>
      )}

      {leaves.filter(l => byCode[l.code]).map(leaf => {
        const rows = byCode[leaf.code]
        const subtotal = rows.reduce((s, it) => s + Number(it.budget_amount || 0), 0)
        return (
          <div key={leaf.code} style={{ border: '1px solid #f1f5f9', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ background: '#f8fafc', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>
              <span>{leaf.code} {leaf.name}</span>
              <span>{subtotal.toLocaleString()}원</span>
            </div>
            {rows.map(it => (
              <div key={it.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', borderTop: '1px solid #f8fafc', flexWrap: 'wrap' }}>
                <input
                  defaultValue={it.name}
                  onBlur={e => e.target.value.trim() && e.target.value !== it.name && onSaveField(it.id, 'name', e.target.value.trim())}
                  placeholder="사업명"
                  style={{ ...inputStyle, flex: 1, minWidth: 140 }}
                />
                <input
                  type="number"
                  defaultValue={it.budget_amount}
                  onBlur={e => Number(e.target.value) !== Number(it.budget_amount) && onSaveField(it.id, 'budget_amount', e.target.value)}
                  style={{ ...inputStyle, width: 130, textAlign: 'right' }}
                />
                <input
                  defaultValue={it.calc_basis ?? ''}
                  onBlur={e => e.target.value !== (it.calc_basis ?? '') && onSaveField(it.id, 'calc_basis', e.target.value)}
                  placeholder="산출기초 (선택)"
                  style={{ ...inputStyle, width: 180 }}
                />
                <button onClick={() => onDelete(it.id)} style={deleteBtnStyle}>삭제</button>
              </div>
            ))}
          </div>
        )
      })}

      {!adding ? (
        <button onClick={() => setAdding(true)} style={addBtnStyle}>+ 사업 추가</button>
      ) : (
        <div style={{ border: '1px dashed #cbd5e1', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CascadingAccountSelect accounts={accounts} value={form.code} onChange={code => setForm(f => ({ ...f, code }))} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="사업명 (예: 여름 전도집회)" style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
            <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="금액" style={{ ...inputStyle, width: 130 }} />
          </div>
          <input value={form.calc_basis} onChange={e => setForm(f => ({ ...f, calc_basis: e.target.value }))} placeholder="산출기초 (선택)" style={inputStyle} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setAdding(false); setForm({ code: '', name: '', amount: '', calc_basis: '' }) }} style={cancelBtnStyle}>취소</button>
            <button onClick={submitAdd} disabled={saving} style={addConfirmBtnStyle}>{saving ? '추가 중…' : '추가'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 총괄 — 전체 부서 합산, 읽기 전용 ──────────────────────────
function SummaryGwanRows({ gwan, type, summaryMap }) {
  const rows = []
  const hangList = gwan.groups ?? [{ code: gwan.code, name: gwan.name, items: gwan.items ?? [] }]

  hangList.forEach(hang => {
    rows.push(
      <tr key={`h-${hang.code}`} style={{ background: '#fafbfc' }}>
        <td style={{ ...cellStyle, textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{hang.code}</td>
        <td style={{ ...cellStyle, textAlign: 'left', color: '#64748b', fontWeight: 600 }} colSpan={2}>
          {gwan.groups ? `${gwan.name} · ${hang.name}` : gwan.name}
        </td>
      </tr>
    )
    hang.items.forEach(item => {
      const amt = summaryMap[`${type}-${item.code}`] || 0
      rows.push(
        <tr key={item.code}>
          <td style={{ ...cellStyle, textAlign: 'left', color: '#94a3b8' }}>{item.code}</td>
          <td style={{ ...cellStyle, textAlign: 'left' }}>{item.name}</td>
          <td style={{ ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{amt.toLocaleString()}원</td>
        </tr>
      )
    })
  })
  return rows
}

function SummarySection({ title, accounts, type, summaryMap }) {
  const leaves = flattenAccounts(accounts)
  const sectionTotal = leaves.reduce((s, l) => s + (summaryMap[`${type}-${l.code}`] || 0), 0)

  return (
    // flexShrink:0 — 부모(.content, flex-column + overflow-y:auto)가 이 카드를
    // 압축해 내용을 잘라내지 않고, 카드 전체 높이만큼 페이지가 정상 스크롤되게 함
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,.08)', flexShrink: 0 }}>
      <div style={{ padding: '14px 20px', fontWeight: 700, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
        <span>{title}</span>
        <span style={{ color: type === 'I' ? '#22c55e' : '#ef4444' }}>{sectionTotal.toLocaleString()}원</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={theadStyle}>코드</th>
            <th style={{ ...theadStyle, textAlign: 'left' }}>과목</th>
            <th style={theadStyle}>합계</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(gwan => (
            <SummaryGwanRows key={gwan.code} gwan={gwan} type={type} summaryMap={summaryMap} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function BudgetInput() {
  const [fiscalYears, setFiscalYears] = useState([])
  const [fyId, setFyId] = useState('')
  const [tab, setTab] = useState('dept')

  const [depts, setDepts] = useState([])
  const [deptId, setDeptId] = useState(null)
  const [items, setItems] = useState([])

  const [summary, setSummary] = useState([])

  useEffect(() => {
    api.fiscalYears().then(r => {
      setFiscalYears(r.data)
      if (r.data.length) setFyId(String(r.data[0].id))
    })
    deptsApi.list().then(r => setDepts(r.data)).catch(() => {})
  }, [])

  const deptTree = buildBudgetPathTree(depts)

  const loadItems = () => {
    if (!fyId || !deptId) { setItems([]); return }
    api.categories({ fiscal_year_id: fyId, department_id: deptId }).then(r => setItems(r.data)).catch(() => {})
  }
  useEffect(loadItems, [fyId, deptId])

  useEffect(() => {
    if (tab !== 'summary' || !fyId) return
    api.categoriesSummary({ fiscal_year_id: fyId }).then(r => setSummary(r.data)).catch(() => {})
  }, [tab, fyId])

  const summaryMap = {}
  summary.forEach(s => { summaryMap[`${s.type}-${s.account_code}`] = Number(s.total) })

  const handleAdd = async (type, { code, name, amount, calc_basis }) => {
    if (!code) { toast.error('목을 선택하세요.'); return false }
    if (!name.trim()) { toast.error('사업명을 입력하세요.'); return false }
    try {
      await api.createCategory({
        name: name.trim(), type, fiscal_year_id: fyId, department_id: deptId,
        budget_amount: Number(amount) || 0, account_code: code, calc_basis: calc_basis?.trim() || null,
      })
      loadItems()
      toast.success('사업을 추가했습니다.')
      return true
    } catch {
      toast.error('추가 중 오류가 발생했습니다.')
      return false
    }
  }

  const handleSaveField = async (id, field, value) => {
    try {
      const payload = field === 'budget_amount' ? { budget_amount: Number(value) || 0 } : { [field]: value }
      await api.updateCategory(id, payload)
      setItems(prev => prev.map(it => it.id === id ? { ...it, ...payload } : it))
    } catch {
      toast.error('저장 중 오류가 발생했습니다.')
      loadItems()
    }
  }

  const deleteGuard = useDeleteGuard()
  const handleDelete = (id) => {
    deleteGuard.request(async () => {
      try {
        await api.deleteCategory(id)
        setItems(prev => prev.filter(it => it.id !== id))
      } catch {
        toast.error('삭제 중 오류가 발생했습니다.')
      }
    })
  }

  return (
    <PageShell title="예산서입력" actions={
      <Link to="/budget" style={backLinkStyle}>← 예산/장부로</Link>
    }>
      <div className={styles.content}>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={fyId} onChange={e => setFyId(e.target.value)} style={inputStyle}>
            {fiscalYears.map(f => <option key={f.id} value={f.id}>{f.year}년도</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setTab('dept')} style={tab === 'dept' ? tabBtnActiveStyle : tabBtnStyle}>부서별 입력</button>
            <button onClick={() => setTab('summary')} style={tab === 'summary' ? tabBtnActiveStyle : tabBtnStyle}>총괄</button>
          </div>
        </div>

        {tab === 'dept' ? (
          <>
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.08)', flexShrink: 0 }}>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 8 }}>조직(부서) 선택</div>
              <CascadingDeptSelect tree={deptTree} flat={depts} value={deptId} onChange={setDeptId} />
            </div>

            {!deptId ? (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>부서를 선택하면 그 부서의 예산 사업을 입력할 수 있습니다.</p>
            ) : (
              <>
                <DepartmentItemsSection title="1. 수입 사업" type="I" accounts={INCOME_ACCOUNTS} items={items} onAdd={handleAdd} onSaveField={handleSaveField} onDelete={handleDelete} />
                <DepartmentItemsSection title="2. 지출 사업" type="E" accounts={EXPENSE_ACCOUNTS} items={items} onAdd={handleAdd} onSaveField={handleSaveField} onDelete={handleDelete} />
              </>
            )}
          </>
        ) : (
          <>
            <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: 0 }}>
              전체 부서의 예산을 표준 관/항/목 체계로 합산한 결과입니다 (읽기 전용).
            </p>
            <SummarySection title="1. 수입부" accounts={INCOME_ACCOUNTS} type="I" summaryMap={summaryMap} />
            <SummarySection title="2. 지출부" accounts={EXPENSE_ACCOUNTS} type="E" summaryMap={summaryMap} />
          </>
        )}

      </div>
      <DeleteGuardModal {...deleteGuard.modalProps} message="이 사업 항목을 삭제하시겠습니까?" />
    </PageShell>
  )
}

const inputStyle = { border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: '0.85rem', outline: 'none' }
const cellStyle = { padding: '8px 12px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }
const theadStyle = { padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.78rem' }
const backLinkStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 16px', textDecoration: 'none', color: '#475569', fontSize: '0.875rem' }
const tabBtnStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 16px', fontSize: '0.85rem', cursor: 'pointer', color: '#475569' }
const tabBtnActiveStyle = { ...tabBtnStyle, background: '#3b82f6', borderColor: '#3b82f6', color: '#fff', fontWeight: 600 }
const addBtnStyle = { alignSelf: 'flex-start', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 16px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }
const addConfirmBtnStyle = { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }
const cancelBtnStyle = { background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 14px', fontSize: '0.85rem', cursor: 'pointer' }
const deleteBtnStyle = { background: 'none', border: 'none', color: '#ef4444', fontSize: '0.78rem', cursor: 'pointer', padding: '4px 6px' }
