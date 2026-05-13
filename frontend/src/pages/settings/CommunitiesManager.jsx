import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { communities as communityApi, members as memberApi } from '../../api'
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
        <span className={styles.treeLabel}>
          {node.name}
          {node.type && <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: 4 }}>({node.type})</span>}
        </span>
        <button
          className={styles.addChildBtn}
          title="하위 공동체 추가"
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

const EMPTY_FORM = { name: '', type: '', description: '', parent_id: '', leader_id: '', pastor_id: '' }

export default function CommunitiesManager() {
  const [tree, setTree]         = useState([])
  const [flat, setFlat]         = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [isNew, setIsNew]       = useState(false)
  const [loading, setLoading]   = useState(false)
  const [pastors, setPastors]   = useState([])
  const [allMembers, setAllMembers] = useState([])

  const load = useCallback(async () => {
    const [treeRes, flatRes] = await Promise.all([communityApi.tree(), communityApi.list()])
    setTree(treeRes.data)
    setFlat(flatRes.data)
  }, [])

  useEffect(() => {
    load()
    memberApi.list({ positions: '부목사', limit: 100 }).then(r => setPastors(r.data?.data || []))
    memberApi.list({ limit: 500 }).then(r => setAllMembers(r.data?.data || []))
  }, [load])

  const selectNode = node => {
    setSelected(node)
    setIsNew(false)
    setForm({
      name:        node.name,
      type:        node.type || '',
      description: node.description || '',
      parent_id:   node.parent_id ?? '',
      leader_id:   node.leader_id ?? '',
      pastor_id:   node.pastor_id ?? '',
    })
  }

  const startNew = (parentNode = null) => {
    setSelected(null)
    setIsNew(true)
    setForm({ ...EMPTY_FORM, parent_id: parentNode?.id ?? '' })
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('공동체명을 입력하세요.'); return }
    setLoading(true)
    try {
      const data = {
        ...form,
        parent_id: form.parent_id || null,
        leader_id: form.leader_id || null,
        pastor_id: form.pastor_id || null,
      }
      if (isNew) {
        await communityApi.create(data)
        toast.success('추가했습니다.')
        setIsNew(false)
      } else {
        await communityApi.update(selected.id, data)
        toast.success('저장했습니다.')
      }
      await load()
    } catch { toast.error('저장에 실패했습니다.') }
    finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!selected) return
    const hasChildren = selected.children?.length > 0
    const msg = hasChildren
      ? `'${selected.name}'과(와) 하위 공동체 전체를 삭제하시겠습니까?`
      : `'${selected.name}'을(를) 삭제하시겠습니까?`
    if (!confirm(msg)) return
    setLoading(true)
    try {
      await communityApi.remove(selected.id)
      toast.success('삭제했습니다.')
      setSelected(null)
      setForm(EMPTY_FORM)
      setIsNew(false)
      await load()
    } catch { toast.error('삭제에 실패했습니다.') }
    finally { setLoading(false) }
  }

  const panelOpen = selected || isNew

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>교구 구성 관리</h2>
      </div>

      <div className={styles.layout}>
        {/* 트리 패널 */}
        <div className={styles.treePanel}>
          <div className={styles.treePanelHeader}>
            <span>교구 구조</span>
            <button className={styles.addRootBtn} onClick={() => startNew(null)}>+ 최상위 추가</button>
          </div>
          <div className={styles.treeScroll}>
            {tree.length === 0 ? (
              <p className={styles.emptyTree}>교구/구역이 없습니다.<br/>최상위 추가 버튼을 눌러 시작하세요.</p>
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
              <h3 className={styles.editTitle}>{isNew ? '새 공동체 추가' : '공동체 편집'}</h3>

              <div className={styles.field}>
                <label>공동체명 *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="예) 1교구, 1지역, 은혜셀" />
              </div>

              <div className={styles.field}>
                <label>분류 (레벨 명칭)</label>
                <input value={form.type} onChange={e => set('type', e.target.value)}
                  placeholder="예) 교구, 지역, 구역, 셀" />
              </div>

              <div className={styles.field}>
                <label>상위 공동체</label>
                <select value={form.parent_id} onChange={e => set('parent_id', e.target.value)}>
                  <option value="">없음 (최상위)</option>
                  {flat
                    .filter(d => d.id !== selected?.id)
                    .map(d => <option key={d.id} value={d.id}>{d.name}{d.type ? ` (${d.type})` : ''}</option>)
                  }
                </select>
              </div>

              <div className={styles.field}>
                <label>담당 부목사</label>
                <select value={form.pastor_id} onChange={e => set('pastor_id', e.target.value)}>
                  <option value="">없음</option>
                  {pastors.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label>구역장 / 셀장</label>
                <select value={form.leader_id} onChange={e => set('leader_id', e.target.value)}>
                  <option value="">없음</option>
                  {allMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}{m.position ? ` (${m.position})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label>설명</label>
                <input value={form.description} onChange={e => set('description', e.target.value)}
                  placeholder="선택 사항" />
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
                    + '{selected.name}' 하위 공동체 추가
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className={styles.editPlaceholder}>왼쪽 트리에서 공동체를 선택하거나<br/>+ 버튼으로 추가하세요.</p>
          )}
        </div>
      </div>
    </div>
  )
}
