import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { communities as communityApi, members as memberApi } from '../../api'
import styles from './OrgManager.module.css'

function TreeNode({ node, selectedId, onSelect, onAddChild, dragId, dropInfo, onDragStart, onDragOver, onDragEnd, onDrop }) {
  const [open, setOpen] = useState(false)
  const hasChildren = node.children?.length > 0
  const isDragging  = dragId === node.id
  const isTarget    = dropInfo?.targetId === node.id

  return (
    <div className={styles.treeNodeWrap}>
      {isTarget && dropInfo.mode === 'before' && <div className={styles.dropLine} />}
      <div
        className={[
          styles.treeNode,
          selectedId === node.id ? styles.treeNodeActive : '',
          isDragging              ? styles.treeNodeDragging : '',
          isTarget && dropInfo.mode === 'into' ? styles.treeNodeDropInto : '',
        ].join(' ')}
        draggable
        onDragStart={e => onDragStart(e, node)}
        onDragOver={e  => onDragOver(e, node)}
        onDragEnd={onDragEnd}
        onDrop={e      => onDrop(e, node)}
        onClick={() => onSelect(node)}
      >
        <span className={styles.dragHandle} onClick={e => e.stopPropagation()}>⠿</span>
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
      {isTarget && dropInfo.mode === 'after' && <div className={styles.dropLine} />}
      {open && hasChildren && (
        <div className={styles.treeChildren}>
          {node.children.map(child => (
            <TreeNode
              key={child.id} node={child} selectedId={selectedId}
              onSelect={onSelect} onAddChild={onAddChild}
              dragId={dragId} dropInfo={dropInfo}
              onDragStart={onDragStart} onDragOver={onDragOver}
              onDragEnd={onDragEnd} onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const EMPTY_FORM = { name: '', type: '', description: '', parent_id: '', leader_id: '', pastor_id: '' }
const EMPTY_LEVEL = { name: '', max_count: '' }

function getDepth(node, flatList) {
  let depth = 0, current = node
  while (current.parent_id) {
    const parent = flatList.find(d => d.id === current.parent_id)
    if (!parent) break
    depth++; current = parent
  }
  return depth
}

export default function CommunitiesManager() {
  const [tree, setTree]         = useState([])
  const [flat, setFlat]         = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [isNew, setIsNew]       = useState(false)
  const [loading, setLoading]   = useState(false)
  const [pastors, setPastors]   = useState([])
  const [allMembers, setAllMembers] = useState([])
  const [levels, setLevels]     = useState([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  // DnD state
  const [dragId,   setDragId]   = useState(null)
  const [dropInfo, setDropInfo] = useState(null)

  const load = useCallback(async () => {
    const [treeRes, flatRes] = await Promise.all([communityApi.tree(), communityApi.list()])
    setTree(treeRes.data)
    setFlat(flatRes.data)
  }, [])

  useEffect(() => {
    load()
    memberApi.list({ positions: '부목사', limit: 100 }).then(r => setPastors(r.data?.data || []))
    memberApi.list({ limit: 500 }).then(r => setAllMembers(r.data?.data || []))
    communityApi.getSettings().then(r => setLevels(r.data || [])).catch(() => {})
  }, [load])

  const selectNode = node => {
    setSelected(node); setIsNew(false)
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
    setSelected(null); setIsNew(true)
    setForm({ ...EMPTY_FORM, parent_id: parentNode?.id ?? '' })
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const cleaned = levels.map((l, i) => ({ depth: i, name: l.name.trim(), max_count: l.max_count ? Number(l.max_count) : null }))
      await communityApi.saveSettings(cleaned)
      toast.success('계층 설정을 저장했습니다.')
    } catch { toast.error('설정 저장에 실패했습니다.') }
    finally { setSavingSettings(false) }
  }

  const suggestedType = (() => {
    if (!isNew && !selected) return ''
    if (isNew && form.parent_id) {
      const parent = flat.find(d => String(d.id) === String(form.parent_id))
      if (parent) return levels[getDepth(parent, flat) + 1]?.name || ''
      return levels[1]?.name || ''
    }
    if (isNew && !form.parent_id) return levels[0]?.name || ''
    if (selected) return levels[getDepth(selected, flat)]?.name || ''
    return ''
  })()

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('공동체명을 입력하세요.'); return }
    setLoading(true)
    try {
      const data = { ...form, parent_id: form.parent_id || null, leader_id: form.leader_id || null, pastor_id: form.pastor_id || null }
      if (isNew) {
        await communityApi.create(data); toast.success('추가했습니다.'); setIsNew(false)
      } else {
        await communityApi.update(selected.id, data); toast.success('저장했습니다.')
      }
      await load()
    } catch { toast.error('저장에 실패했습니다.') }
    finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!selected) return
    const msg = selected.children?.length > 0
      ? `'${selected.name}'과(와) 하위 공동체 전체를 삭제하시겠습니까?`
      : `'${selected.name}'을(를) 삭제하시겠습니까?`
    if (!confirm(msg)) return
    setLoading(true)
    try {
      await communityApi.remove(selected.id); toast.success('삭제했습니다.')
      setSelected(null); setForm(EMPTY_FORM); setIsNew(false)
      await load()
    } catch { toast.error('삭제에 실패했습니다.') }
    finally { setLoading(false) }
  }

  // ── DnD 핸들러 ──────────────────────────────────────────────
  const onDragStart = (e, node) => {
    setDragId(node.id)
    e.dataTransfer.effectAllowed = 'move'
    e.stopPropagation()
  }

  const onDragOver = (e, node) => {
    e.preventDefault()
    e.stopPropagation()
    if (node.id === dragId) return
    const r = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientY - r.top) / r.height
    const mode = pct < 0.35 ? 'before' : pct > 0.65 ? 'after' : 'into'
    setDropInfo(d => (d?.targetId === node.id && d?.mode === mode) ? d : { targetId: node.id, mode })
  }

  const onDragEnd = () => { setDragId(null); setDropInfo(null) }

  const onDrop = async (e, targetNode) => {
    e.preventDefault()
    e.stopPropagation()
    if (!dragId || dragId === targetNode.id) { onDragEnd(); return }

    const mode     = dropInfo?.mode || 'after'
    const dragNode = flat.find(n => n.id === dragId)
    if (!dragNode) { onDragEnd(); return }

    let newParentId, orderedIds

    if (mode === 'into') {
      newParentId = targetNode.id
      const children = flat
        .filter(n => n.parent_id === targetNode.id && n.id !== dragId)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      orderedIds = [dragId, ...children.map(n => n.id)]
    } else {
      newParentId = targetNode.parent_id ?? null
      const siblings = flat
        .filter(n => (n.parent_id ?? null) === (targetNode.parent_id ?? null) && n.id !== dragId)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      const idx = siblings.findIndex(n => n.id === targetNode.id)
      siblings.splice(mode === 'before' ? idx : idx + 1, 0, { id: dragId })
      orderedIds = siblings.map(n => n.id)
    }

    try {
      await Promise.all(orderedIds.map((id, i) => {
        const n = id === dragId ? dragNode : flat.find(f => f.id === id)
        if (!n) return Promise.resolve()
        return communityApi.update(id, {
          name: n.name, type: n.type ?? '', description: n.description ?? '',
          leader_id: n.leader_id ?? null, pastor_id: n.pastor_id ?? null,
          parent_id: id === dragId ? newParentId : (n.parent_id ?? null),
          sort_order: (i + 1) * 10,
        })
      }))
      await load()
      toast.success('순서를 변경했습니다.')
    } catch { toast.error('이동에 실패했습니다.') }
    onDragEnd()
  }

  const panelOpen = selected || isNew

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>교구 구성 관리</h2>
        <button className={styles.settingsToggleBtn} onClick={() => setSettingsOpen(o => !o)}>
          {settingsOpen ? '▴ 계층 설정 접기' : '▾ 계층 구조 설정'}
        </button>
      </div>

      {settingsOpen && (
        <div className={styles.levelsPanel}>
          <div className={styles.levelsPanelTitle}>계층 구조 설정</div>
          <p className={styles.levelsPanelDesc}>
            각 깊이의 이름과 최대 생성 수를 설정합니다. 공동체 추가 시 해당 깊이의 이름이 자동 제안됩니다.
          </p>
          <div className={styles.levelsRows}>
            {levels.map((level, i) => (
              <div key={i} className={styles.levelRow}>
                <span className={styles.levelDepth}>{i + 1}단계</span>
                <input className={styles.levelNameInput} placeholder="계층 이름 (예: 교구, 구역, 셀)"
                  value={level.name}
                  onChange={e => setLevels(prev => prev.map((l, j) => j === i ? { ...l, name: e.target.value } : l))} />
                <input className={styles.levelCountInput} type="number" placeholder="최대 수 (비우면 무제한)"
                  value={level.max_count ?? ''} min={1}
                  onChange={e => setLevels(prev => prev.map((l, j) => j === i ? { ...l, max_count: e.target.value } : l))} />
                <button className={styles.levelRemoveBtn} onClick={() => setLevels(prev => prev.filter((_, j) => j !== i))} title="삭제">✕</button>
              </div>
            ))}
          </div>
          <div className={styles.levelsActions}>
            <button className={styles.levelAddBtn} onClick={() => setLevels(prev => [...prev, EMPTY_LEVEL])}>+ 계층 추가</button>
            <button className={styles.levelSaveBtn} onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? '저장 중…' : '설정 저장'}
            </button>
          </div>
        </div>
      )}

      <div className={styles.layout}>
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
                <TreeNode
                  key={root.id} node={root} selectedId={selected?.id}
                  onSelect={selectNode} onAddChild={node => startNew(node)}
                  dragId={dragId} dropInfo={dropInfo}
                  onDragStart={onDragStart} onDragOver={onDragOver}
                  onDragEnd={onDragEnd} onDrop={onDrop}
                />
              ))
            )}
          </div>
        </div>

        <div className={`${styles.editPanel} ${panelOpen ? styles.editPanelOpen : ''}`}>
          {panelOpen ? (
            <>
              <h3 className={styles.editTitle}>{isNew ? '새 공동체 추가' : '공동체 편집'}</h3>

              <div className={styles.field}>
                <label>공동체명 *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="예) 1교구, 1지역, 은혜셀" />
              </div>

              <div className={styles.field}>
                <label>분류 (레벨 명칭){suggestedType && <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: 6 }}>제안: {suggestedType}</span>}</label>
                <input value={form.type} onChange={e => set('type', e.target.value)}
                  placeholder={suggestedType || '예) 교구, 지역, 구역, 셀'}
                  onFocus={() => { if (!form.type && suggestedType) set('type', suggestedType) }} />
              </div>

              <div className={styles.field}>
                <label>상위 공동체</label>
                <select value={form.parent_id} onChange={e => set('parent_id', e.target.value)}>
                  <option value="">없음 (최상위)</option>
                  {flat.filter(d => d.id !== selected?.id).map(d => (
                    <option key={d.id} value={d.id}>{d.name}{d.type ? ` (${d.type})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label>담당 부목사</label>
                <select value={form.pastor_id} onChange={e => set('pastor_id', e.target.value)}>
                  <option value="">없음</option>
                  {pastors.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className={styles.field}>
                <label>구역장 / 셀장</label>
                <select value={form.leader_id} onChange={e => set('leader_id', e.target.value)}>
                  <option value="">없음</option>
                  {allMembers.map(m => <option key={m.id} value={m.id}>{m.name}{m.position ? ` (${m.position})` : ''}</option>)}
                </select>
              </div>

              <div className={styles.field}>
                <label>설명</label>
                <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="선택 사항" />
              </div>

              <div className={styles.editActions}>
                <button className={styles.saveBtn} onClick={handleSave} disabled={loading}>{isNew ? '추가' : '저장'}</button>
                {!isNew && <button className={styles.deleteBtn} onClick={handleDelete} disabled={loading}>삭제</button>}
                <button className={styles.cancelBtn} onClick={() => { setSelected(null); setIsNew(false) }}>취소</button>
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
