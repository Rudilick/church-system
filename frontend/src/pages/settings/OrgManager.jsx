import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { departments as deptApi } from '../../api'
import styles from './OrgManager.module.css'

function TreeNode({ node, selectedId, onSelect, onAddChild }) {
  const [open, setOpen] = useState(true)
  const hasChildren = node.children?.length > 0
  return (
    <div className={styles.treeNodeWrap}>
      <div
        className={`${styles.treeNode} ${selectedId === node.id ? styles.treeNodeActive : ''}`}
        onClick={() => onSelect(node)}
      >
        <span
          className={styles.treeToggle}
          onClick={e => { e.stopPropagation(); if (hasChildren) setOpen(o => !o) }}
        >
          {hasChildren ? (open ? '▾' : '▸') : '·'}
        </span>
        <span className={styles.treeLabel}>{node.name}</span>
        <button
          className={styles.addChildBtn}
          title="하위 부서 추가"
          onClick={e => { e.stopPropagation(); onAddChild(node) }}
        >+</button>
      </div>
      {open && hasChildren && (
        <div className={styles.treeChildren}>
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} selectedId={selectedId}
              onSelect={onSelect} onAddChild={onAddChild} />
          ))}
        </div>
      )}
    </div>
  )
}

const EMPTY_FORM = { name: '', description: '', parent_id: '', sort_order: 0 }

export default function OrgManager() {
  const [tree, setTree]         = useState([])
  const [flat, setFlat]         = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [isNew, setIsNew]       = useState(false)
  const [loading, setLoading]   = useState(false)

  const load = useCallback(async () => {
    const [treeRes, flatRes] = await Promise.all([deptApi.tree(), deptApi.list()])
    setTree(treeRes.data)
    setFlat(flatRes.data)
  }, [])

  useEffect(() => { load() }, [load])

  const selectNode = node => {
    setSelected(node)
    setIsNew(false)
    setForm({
      name:        node.name,
      description: node.description || '',
      parent_id:   node.parent_id ?? '',
      sort_order:  node.sort_order ?? 0,
    })
  }

  const startNew = (parentNode = null) => {
    setSelected(null)
    setIsNew(true)
    setForm({ name: '', description: '', parent_id: parentNode?.id ?? '', sort_order: 0 })
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('부서명을 입력하세요.'); return }
    setLoading(true)
    try {
      const data = { ...form, parent_id: form.parent_id || null, sort_order: Number(form.sort_order) }
      if (isNew) {
        const res = await deptApi.create(data)
        toast.success('추가했습니다.')
        await load()
        setIsNew(false)
        // select the newly created node
        setSelected(res.data)
      } else {
        await deptApi.update(selected.id, data)
        toast.success('저장했습니다.')
        await load()
      }
    } catch { toast.error('저장에 실패했습니다.') }
    finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!selected) return
    const hasChildren = selected.children?.length > 0
    const msg = hasChildren
      ? `'${selected.name}'과(와) 하위 부서 전체를 삭제하시겠습니까?`
      : `'${selected.name}'을(를) 삭제하시겠습니까?`
    if (!confirm(msg)) return
    setLoading(true)
    try {
      await deptApi.remove(selected.id)
      toast.success('삭제했습니다.')
      setSelected(null)
      setForm(EMPTY_FORM)
      setIsNew(false)
      await load()
    } catch { toast.error('삭제에 실패했습니다.') }
    finally { setLoading(false) }
  }

  const handleSeedOrg = async () => {
    if (!confirm('현재 모든 부서 데이터를 삭제하고 이미지의 샘플 조직도를 불러옵니다. 계속하시겠습니까?')) return
    setLoading(true)
    try {
      await deptApi.seedOrg()
      toast.success('샘플 조직도가 적용되었습니다.')
      setSelected(null)
      setIsNew(false)
      await load()
    } catch { toast.error('적용에 실패했습니다.') }
    finally { setLoading(false) }
  }

  const panelOpen = selected || isNew

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>조직 관리</h2>
        <button className={styles.seedBtn} onClick={handleSeedOrg} disabled={loading}>
          📋 샘플 조직도 불러오기
        </button>
      </div>

      <div className={styles.layout}>
        {/* 트리 패널 */}
        <div className={styles.treePanel}>
          <div className={styles.treePanelHeader}>
            <span>조직 구조</span>
            <button className={styles.addRootBtn} onClick={() => startNew(null)}>+ 최상위 추가</button>
          </div>
          <div className={styles.treeScroll}>
            {tree.length === 0 ? (
              <p className={styles.emptyTree}>조직이 없습니다. 최상위 추가 또는<br/>샘플 조직도를 불러오세요.</p>
            ) : (
              tree.map(root => (
                <TreeNode key={root.id} node={root} selectedId={selected?.id}
                  onSelect={selectNode} onAddChild={node => startNew(node)} />
              ))
            )}
          </div>
        </div>

        {/* 편집 패널 */}
        <div className={`${styles.editPanel} ${panelOpen ? styles.editPanelOpen : ''}`}>
          {panelOpen ? (
            <>
              <h3 className={styles.editTitle}>{isNew ? '새 부서 추가' : '부서 편집'}</h3>

              <div className={styles.field}>
                <label>부서명 *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="예) 교육부" />
              </div>

              <div className={styles.field}>
                <label>상위 조직</label>
                <select value={form.parent_id} onChange={e => set('parent_id', e.target.value)}>
                  <option value="">없음 (최상위)</option>
                  {flat
                    .filter(d => d.id !== selected?.id)
                    .map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                  }
                </select>
              </div>

              <div className={styles.field}>
                <label>표시 순서</label>
                <input type="number" value={form.sort_order}
                  onChange={e => set('sort_order', e.target.value)} style={{ width: 80 }} />
              </div>

              <div className={styles.editActions}>
                <button className={styles.saveBtn} onClick={handleSave} disabled={loading}>
                  {isNew ? '추가' : '저장'}
                </button>
                {!isNew && (
                  <button className={styles.deleteBtn} onClick={handleDelete} disabled={loading}>삭제</button>
                )}
                <button className={styles.cancelBtn} onClick={() => { setSelected(null); setIsNew(false) }}>
                  취소
                </button>
              </div>

              {!isNew && selected && (
                <div className={styles.addChildArea}>
                  <button className={styles.addChildAreaBtn} onClick={() => startNew(selected)}>
                    + '{selected.name}' 하위 부서 추가
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className={styles.editPlaceholder}>왼쪽 트리에서 부서를 선택하거나<br/>+ 버튼으로 추가하세요.</p>
          )}
        </div>
      </div>
    </div>
  )
}
