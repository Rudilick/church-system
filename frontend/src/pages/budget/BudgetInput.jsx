import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { budget as api } from '../../api'
import toast from 'react-hot-toast'
import PageShell from '../../components/PageShell'
import { INCOME_ACCOUNTS, EXPENSE_ACCOUNTS } from '../../data/budgetAccounts'
import styles from './Budget.module.css'

// 예산서입력 — 관/항/목 표준 과목 체계에 따라 당기예산 금액을 입력하는 화면 (초안).
// 목(leaf) 단위로 budget_categories에 "코드 이름" 형태의 name으로 저장하고,
// 이미 등록된 항목이 있으면 금액만 수정한다. 저장된 항목은 기존 "예산/장부"
// 거래입력 화면에서 바로 부기(지출·수입 기록)에 사용할 수 있다.

function leafName(code, name) { return `${code} ${name}` }

function LeafRow({ code, name, type, amount, note, onChange }) {
  return (
    <tr>
      <td style={{ ...cellStyle, textAlign: 'left', color: '#94a3b8', fontVariantNumeric: 'tabular-nums', width: 70 }}>{code}</td>
      <td style={{ ...cellStyle, textAlign: 'left' }}>{name}</td>
      <td style={{ ...cellStyle, width: 160 }}>
        <input
          type="number"
          value={amount}
          onChange={e => onChange('amount', e.target.value)}
          placeholder="0"
          style={{ ...inputStyle, width: '100%', textAlign: 'right' }}
        />
      </td>
      <td style={{ ...cellStyle, width: 220 }}>
        <input
          value={note}
          onChange={e => onChange('note', e.target.value)}
          placeholder="산출기초 (선택)"
          style={{ ...inputStyle, width: '100%' }}
        />
      </td>
    </tr>
  )
}

function AccountSection({ title, accounts, type, values, setValue }) {
  const sectionTotal = accounts.reduce((sum, gwan) => {
    const directItems = gwan.items ?? []
    const groupItems = (gwan.groups ?? []).flatMap(g => g.items)
    return sum + [...directItems, ...groupItems].reduce((s, it) => s + (Number(values[`${type}-${it.code}`]?.amount) || 0), 0)
  }, 0)

  return (
    <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
      <div style={{ padding: '14px 20px', fontWeight: 700, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
        <span>{title}</span>
        <span style={{ color: type === 'I' ? '#22c55e' : '#ef4444' }}>{sectionTotal.toLocaleString()}원</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={theadStyle}>코드</th>
            <th style={{ ...theadStyle, textAlign: 'left' }}>과목</th>
            <th style={theadStyle}>당기예산</th>
            <th style={theadStyle}>산출기초</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(gwan => (
            <GwanRows key={gwan.code} gwan={gwan} type={type} values={values} setValue={setValue} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GwanRows({ gwan, type, values, setValue }) {
  const rows = []
  const hangList = gwan.groups ?? [{ code: gwan.code, name: gwan.name, items: gwan.items ?? [] }]

  hangList.forEach(hang => {
    if (gwan.groups) {
      rows.push(
        <tr key={`hang-${hang.code}`} style={{ background: '#fafbfc' }}>
          <td style={{ ...cellStyle, textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{hang.code}</td>
          <td style={{ ...cellStyle, textAlign: 'left', color: '#64748b', fontWeight: 600 }} colSpan={3}>{gwan.name} · {hang.name}</td>
        </tr>
      )
    } else {
      rows.push(
        <tr key={`gwan-${gwan.code}`} style={{ background: '#fafbfc' }}>
          <td style={{ ...cellStyle, textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{gwan.code}</td>
          <td style={{ ...cellStyle, textAlign: 'left', color: '#64748b', fontWeight: 600 }} colSpan={3}>{gwan.name}</td>
        </tr>
      )
    }
    hang.items.forEach(item => {
      const key = `${type}-${item.code}`
      const v = values[key] ?? { amount: '', note: '' }
      rows.push(
        <LeafRow
          key={key}
          code={item.code}
          name={item.name}
          type={type}
          amount={v.amount}
          note={v.note}
          onChange={(field, val) => setValue(key, { ...v, [field]: val })}
        />
      )
    })
  })

  return rows
}

export default function BudgetInput() {
  const [fiscalYears, setFiscalYears] = useState([])
  const [fyId, setFyId] = useState('')
  const [existingCategories, setExistingCategories] = useState([])
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.fiscalYears().then(r => {
      setFiscalYears(r.data)
      if (r.data.length) setFyId(String(r.data[0].id))
    })
  }, [])

  useEffect(() => {
    if (!fyId) return
    api.categories({ fiscal_year_id: fyId }).then(r => {
      setExistingCategories(r.data)
      // 기존에 등록된 항목이 있으면 금액을 프리필
      const next = {}
      const allLeaves = [
        ...INCOME_ACCOUNTS.flatMap(g => (g.items ?? [])).map(it => ({ ...it, type: 'I' })),
        ...EXPENSE_ACCOUNTS.flatMap(g => [...(g.items ?? []), ...(g.groups ?? []).flatMap(h => h.items)]).map(it => ({ ...it, type: 'E' })),
      ]
      allLeaves.forEach(leaf => {
        const match = r.data.find(c => c.type === leaf.type && c.name === leafName(leaf.code, leaf.name))
        if (match) next[`${leaf.type}-${leaf.code}`] = { amount: String(match.budget_amount ?? ''), note: '' }
      })
      setValues(next)
    })
  }, [fyId])

  const setValue = (key, val) => setValues(prev => ({ ...prev, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const allLeaves = [
        ...INCOME_ACCOUNTS.flatMap(g => (g.items ?? [])).map(it => ({ ...it, type: 'I' })),
        ...EXPENSE_ACCOUNTS.flatMap(g => [...(g.items ?? []), ...(g.groups ?? []).flatMap(h => h.items)]).map(it => ({ ...it, type: 'E' })),
      ]
      let count = 0
      for (const leaf of allLeaves) {
        const key = `${leaf.type}-${leaf.code}`
        const v = values[key]
        if (!v || v.amount === '' || v.amount === undefined) continue
        const amount = Number(v.amount) || 0
        const name = leafName(leaf.code, leaf.name)
        const existing = existingCategories.find(c => c.type === leaf.type && c.name === name)
        if (existing) {
          if (Number(existing.budget_amount) !== amount) {
            await api.updateCategory(existing.id, { budget_amount: amount })
          }
        } else if (amount > 0) {
          await api.createCategory({ name, type: leaf.type, fiscal_year_id: fyId, budget_amount: amount })
        }
        count++
      }
      toast.success(`${count}개 항목을 저장했습니다.`)
      api.categories({ fiscal_year_id: fyId }).then(r => setExistingCategories(r.data))
    } catch {
      toast.error('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell title="예산서입력" actions={
      <Link to="/budget" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 16px', textDecoration: 'none', color: '#475569', fontSize: '0.875rem' }}>← 예산/장부로</Link>
    }>
      <div className={styles.content}>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <select value={fyId} onChange={e => setFyId(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px' }}>
            {fiscalYears.map(f => <option key={f.id} value={f.id}>{f.year}년도</option>)}
          </select>
          <button onClick={handleSave} disabled={saving} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 600 }}>
            {saving ? '저장 중…' : '예산서 저장'}
          </button>
        </div>

        <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: 0 }}>
          표준 관/항/목 예산과목 체계입니다 (제110회 총회 재정정책 세미나 자료 기준, 초안). 금액을 입력할 목(과목)만 저장되며,
          저장 후에는 “예산/장부” 화면의 거래입력에서 이 항목으로 바로 지출·수입을 기록(부기)할 수 있습니다.
        </p>

        <AccountSection title="1. 수입부" accounts={INCOME_ACCOUNTS} type="I" values={values} setValue={setValue} />
        <AccountSection title="2. 지출부" accounts={EXPENSE_ACCOUNTS} type="E" values={values} setValue={setValue} />

      </div>
    </PageShell>
  )
}

const inputStyle = { border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px', fontSize: '0.85rem', outline: 'none' }
const cellStyle = { padding: '8px 12px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }
const theadStyle = { padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.78rem' }
