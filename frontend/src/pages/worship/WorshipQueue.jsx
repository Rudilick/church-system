import { useCallback, useEffect, useRef, useState } from 'react'
import { worshipQueues as api } from '../../api'
import { compressForSheetMusic } from '../../utils/imageProcessor'
import toast from 'react-hot-toast'
import styles from './WorshipQueue.module.css'

// ── 블록 색상 스펙 ────────────────────────────────────────
const BLOCK_STYLES = {
  '전주':     { bg: '#5DA8E9', fg: '#fff' },
  '절':       { bg: '#E66E28', fg: '#fff' },
  '후렴':     { bg: '#F0B91E', fg: '#333' },
  '간주':     { bg: '#50AF6E', fg: '#fff' },
  '후주':     { bg: '#6E6E78', fg: '#fff' },
  '솔로':     { bg: '#E66E28', fg: '#fff' },
  '브릿지':   { bg: '#8C64C8', fg: '#fff' },
  'rit.':    { bg: '#6E6E78', fg: '#fff' },
  '(이어짐)': { bg: '#AAAFB9', fg: '#333' },
  '__custom': { bg: '#AAAFB9', fg: '#333' },
}
const KEYWORDS = Object.keys(BLOCK_STYLES).filter(k => k !== '__custom')

function makeBlock(label) {
  const matched = KEYWORDS.find(k => label.includes(k))
  const style = BLOCK_STYLES[matched] ?? BLOCK_STYLES['__custom']
  return { id: crypto.randomUUID(), label, bg: style.bg, fg: style.fg }
}

// ── 팩토리 함수 ───────────────────────────────────────────
const EMPTY_SONG     = () => ({ item_type: 'song',     song_title: '', blocks: [], note: '', arrow_label: '' })
const EMPTY_SHEET    = () => ({ item_type: 'sheet',    sheet_image: null })
const EMPTY_PAGE_CUT = () => ({ item_type: 'page_cut' })

// ── 단일 블록 ──────────────────────────────────────────────
function Block({ block, selected, onSelect, onDelete, onDragStart, onDragEnter, onDragEnd }) {
  return (
    <div
      className={`${styles.block} ${selected ? styles.blockSelected : ''}`}
      style={{ background: block.bg, color: block.fg }}
      onClick={() => onSelect(block.id)}
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(block.id) }}
      onDragEnter={() => onDragEnter(block.id)}
      onDragEnd={onDragEnd}
      onKeyDown={e => { if (e.key === 'Delete' || e.key === 'Backspace') onDelete(block.id) }}
      tabIndex={0}
      title={`${block.label} (드래그로 이동, Del 삭제)`}
    >
      {block.label}
    </div>
  )
}

// ── 아이템 추가 버튼 ────────────────────────────────────────
function AddItemButton({ onAdd }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className={styles.addBtnWrap} ref={ref} data-no-capture="true">
      <button className={styles.addBtn} onClick={() => setOpen(o => !o)}>+</button>
      {open && (
        <div className={styles.addMenu}>
          <button onClick={() => { onAdd('song');     setOpen(false) }}>곡 추가</button>
          <button onClick={() => { onAdd('sheet');    setOpen(false) }}>악보 삽입</button>
          <button onClick={() => { onAdd('page_cut'); setOpen(false) }}>페이지 컷</button>
        </div>
      )}
    </div>
  )
}

// ── 확인 모달 ─────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalBox}>
        <p className={styles.modalMsg}>{message}</p>
        <div className={styles.modalBtns}>
          <button className={styles.modalBtnYes} onClick={onConfirm}>예</button>
          <button className={styles.modalBtnNo}  onClick={onCancel}>아니오</button>
        </div>
      </div>
    </div>
  )
}

// ── 페이지 컷 행 ───────────────────────────────────────────
function PageCutRow({ onDelete }) {
  return (
    <div className={styles.pageCutRow} data-page-cut="true">
      <div className={styles.pageCutLine} />
      <span className={styles.pageCutScissor}>✂</span>
      <button className={styles.pageCutDel} onClick={onDelete} title="페이지 컷 삭제">✕</button>
    </div>
  )
}

// ── 악보 행 ──────────────────────────────────────────────
function SheetRow({ item, onUpdate, onDelete }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('이미지 파일만 지원합니다')
      return
    }
    try {
      const { dataUrl } = await compressForSheetMusic(file)
      onUpdate({ sheet_image: dataUrl })
    } catch {
      toast.error('이미지 처리 실패')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className={styles.sheetRow}>
      <div className={styles.sheetHeader}>
        <span className={styles.sheetLabel}>악보</span>
        <button className={styles.deleteSongBtn} onClick={onDelete} title="악보 삭제">✕</button>
      </div>
      {item.sheet_image ? (
        <div className={styles.sheetImageWrap}>
          <img src={item.sheet_image} alt="악보" className={styles.sheetImage} />
          <button
            className={styles.sheetClearBtn}
            onClick={() => onUpdate({ sheet_image: null })}
          >
            이미지 제거
          </button>
        </div>
      ) : (
        <div
          className={`${styles.sheetDropzone} ${dragging ? styles.sheetDropzoneDrag : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]) }}
          />
          <span>클릭하거나 이미지를 드래그하여 악보 추가</span>
        </div>
      )}
    </div>
  )
}

// ── 곡 행 ─────────────────────────────────────────────────
function SongRow({ song, songIndex, showArrow, onUpdate, onDelete, onInsertSheetBefore }) {
  const [input, setInput]                   = useState('')
  const [selectedBlock, setSelectedBlock]   = useState(null)
  const [titleSuggestions, setTitleSuggestions] = useState([])
  const [formModal, setFormModal]           = useState(null)
  const dragId          = useRef(null)
  const inputRef        = useRef(null)
  const titleDebounce   = useRef(null)

  const addBlock = useCallback((label) => {
    const block = makeBlock(label)
    onUpdate({ blocks: [...song.blocks, block] })
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [song.blocks, onUpdate])

  const handleInputChange = (e) => {
    const val = e.target.value
    if (val.endsWith('  ')) {
      const text = val.trim()
      if (text) addBlock(text)
      return
    }
    setInput(val)
  }

  const handleKeyDown = (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && input === '' && selectedBlock) {
      onUpdate({ blocks: song.blocks.filter(b => b.id !== selectedBlock) })
      setSelectedBlock(null)
      e.preventDefault()
      return
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && input === '' && song.blocks.length > 0) {
      onUpdate({ blocks: song.blocks.slice(0, -1) })
      e.preventDefault()
    }
  }

  const handleDragStart = (id) => { dragId.current = id }
  const handleDragEnter = (overId) => {
    if (!dragId.current || dragId.current === overId) return
    const blocks = [...song.blocks]
    const from = blocks.findIndex(b => b.id === dragId.current)
    const to   = blocks.findIndex(b => b.id === overId)
    if (from < 0 || to < 0) return
    blocks.splice(to, 0, blocks.splice(from, 1)[0])
    onUpdate({ blocks })
  }
  const handleDragEnd = () => { dragId.current = null }

  const deleteBlock = (id) => {
    onUpdate({ blocks: song.blocks.filter(b => b.id !== id) })
    if (selectedBlock === id) setSelectedBlock(null)
  }

  // ── 곡명 자동완성 ─────────────────────────────────────
  const handleTitleChange = (e) => {
    const val = e.target.value
    onUpdate({ song_title: val })
    clearTimeout(titleDebounce.current)
    if (!val.trim()) { setTitleSuggestions([]); return }
    titleDebounce.current = setTimeout(async () => {
      try {
        const { data } = await api.searchSongLib(val.trim())
        setTitleSuggestions(data)
      } catch { /* silent */ }
    }, 300)
  }

  const handleSelectSuggestion = (suggestion) => {
    setTitleSuggestions([])
    onUpdate({ song_title: suggestion.song_title })
    const hasForm  = suggestion.last_blocks?.length > 0 || suggestion.last_note
    const hasSheet = !!suggestion.last_sheet
    if (hasForm) {
      setFormModal({ type: 'blocks', suggestion })
    } else if (hasSheet) {
      setFormModal({ type: 'sheet', suggestion })
    }
  }

  const handleModalResult = (confirmed) => {
    const modal = formModal
    if (!modal) return
    if (modal.type === 'blocks') {
      if (confirmed) {
        onUpdate({
          blocks: (modal.suggestion.last_blocks || []).map(b => ({ ...b, id: crypto.randomUUID() })),
          note:   modal.suggestion.last_note || '',
        })
      }
      if (modal.suggestion.last_sheet) {
        setFormModal({ type: 'sheet', suggestion: modal.suggestion })
      } else {
        setFormModal(null)
      }
    } else {
      if (confirmed && modal.suggestion.last_sheet) {
        onInsertSheetBefore(modal.suggestion.last_sheet)
      }
      setFormModal(null)
    }
  }

  return (
    <div className={styles.songRow}>
      {/* 곡 번호 + 제목 */}
      <div className={styles.songHeader}>
        <span className={styles.songNum}>{songIndex + 1}번곡</span>
        <div className={styles.titleInputWrap}>
          <input
            className={styles.songTitleInput}
            placeholder="곡 제목 입력…"
            value={song.song_title}
            onChange={handleTitleChange}
            onBlur={() => setTimeout(() => setTitleSuggestions([]), 150)}
            autoComplete="off"
          />
          {titleSuggestions.length > 0 && (
            <ul className={styles.titleSuggestList}>
              {titleSuggestions.map(s => (
                <li
                  key={s.id}
                  className={styles.titleSuggestItem}
                  onMouseDown={() => handleSelectSuggestion(s)}
                >
                  {s.song_title}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className={styles.deleteSongBtn} onClick={onDelete} title="곡 삭제">✕</button>
      </div>

      {/* 블록 행 */}
      <div className={styles.blockRow} onClick={() => setSelectedBlock(null)}>
        {song.blocks.map(block => (
          <Block
            key={block.id}
            block={block}
            selected={selectedBlock === block.id}
            onSelect={id => setSelectedBlock(id === selectedBlock ? null : id)}
            onDelete={deleteBlock}
            onDragStart={handleDragStart}
            onDragEnter={handleDragEnter}
            onDragEnd={handleDragEnd}
          />
        ))}
        <div className={styles.blockInputWrap}>
          <input
            ref={inputRef}
            className={styles.blockInput}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={song.blocks.length === 0 ? '절/후렴/간주… 입력 또는 두 번 스페이스로 커스텀 블록' : '…'}
          />
        </div>
      </div>

      {/* 메모 */}
      <textarea
        className={styles.noteArea}
        placeholder="※ 메모 (전환, 특이사항 등)"
        value={song.note}
        onChange={e => onUpdate({ note: e.target.value })}
        rows={2}
      />

      {/* 다음 곡 화살표 (다음 아이템도 song일 때만) */}
      {showArrow && (
        <div className={styles.arrowSection}>
          <div className={styles.arrowLine} />
          <span className={styles.arrowHead}>▼</span>
          <input
            className={styles.arrowLabel}
            value={song.arrow_label}
            onChange={e => onUpdate({ arrow_label: e.target.value })}
            placeholder={`${songIndex + 2}번곡으로`}
          />
        </div>
      )}

      {/* 연속 모달 */}
      {formModal?.type === 'blocks' && (
        <ConfirmModal
          message="이 곡의 최근 송폼을 불러오겠습니까?"
          onConfirm={() => handleModalResult(true)}
          onCancel={() => handleModalResult(false)}
        />
      )}
      {formModal?.type === 'sheet' && (
        <ConfirmModal
          message="이 곡의 최근 악보 이미지를 불러오겠습니까?"
          onConfirm={() => handleModalResult(true)}
          onCancel={() => handleModalResult(false)}
        />
      )}
    </div>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────
export default function WorshipQueue() {
  const [queues, setQueues]     = useState([])
  const [activeId, setActiveId] = useState(null)
  const [title, setTitle]       = useState('')
  const [date, setDate]         = useState('')
  const [items, setItems]       = useState([EMPTY_SONG()])
  const [saving, setSaving]     = useState(false)
  const contentRef = useRef(null)

  useEffect(() => { loadQueues() }, [])

  const loadQueues = async () => {
    try {
      const { data } = await api.list()
      setQueues(data)
    } catch { toast.error('목록 불러오기 실패') }
  }

  const selectQueue = async (q) => {
    setActiveId(q.id)
    setTitle(q.title)
    setDate(q.queue_date ? q.queue_date.slice(0, 10) : '')
    try {
      const { data } = await api.getSongs(q.id)
      setItems(data.length ? data.map(row => {
        const type = row.item_type || 'song'
        if (type === 'sheet')    return { item_type: 'sheet',    sheet_image: row.sheet_image || null }
        if (type === 'page_cut') return { item_type: 'page_cut' }
        return {
          item_type:   'song',
          song_title:  row.song_title || '',
          blocks:      (row.blocks || []).map(b => ({ ...b, id: b.id || crypto.randomUUID() })),
          note:        row.note || '',
          arrow_label: row.arrow_label || '',
        }
      }) : [EMPTY_SONG()])
    } catch { toast.error('곡 불러오기 실패') }
  }

  const newQueue = async () => {
    try {
      const { data } = await api.create({ title: '새 큐시트', queue_date: null })
      setQueues(prev => [data, ...prev])
      selectQueue(data)
    } catch { toast.error('생성 실패') }
  }

  const removeQueue = async (id, e) => {
    e.stopPropagation()
    if (!confirm('이 큐시트를 삭제하시겠습니까?')) return
    try {
      await api.remove(id)
      setQueues(prev => prev.filter(q => q.id !== id))
      if (activeId === id) {
        setActiveId(null); setTitle(''); setDate(''); setItems([EMPTY_SONG()])
      }
    } catch { toast.error('삭제 실패') }
  }

  const save = async () => {
    if (!activeId) { toast.error('저장할 큐시트를 선택하세요'); return }
    setSaving(true)
    try {
      await api.update(activeId, { title: title || '새 큐시트', queue_date: date || null })
      await api.saveItems(activeId, items)
      setQueues(prev => prev.map(q =>
        q.id === activeId ? { ...q, title: title || '새 큐시트', queue_date: date || null } : q
      ))
      toast.success('저장됐습니다')
    } catch { toast.error('저장 실패') }
    finally { setSaving(false) }
  }

  const triggerDownload = (canvas, filename) => {
    const link = document.createElement('a')
    link.download = filename
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const downloadImage = async () => {
    if (!contentRef.current) return
    try {
      const { default: html2canvas } = await import('html2canvas')
      const scale = 2

      // 스크롤 초기화 (정확한 위치 계산을 위해)
      const prevScrollTop = contentRef.current.scrollTop
      contentRef.current.scrollTop = 0

      // 캡처 제외 요소 숨김
      const hiddenEls = contentRef.current.querySelectorAll('[data-no-capture]')
      hiddenEls.forEach(el => { el.style.display = 'none' })

      // 페이지컷 위치 수집 (숨김 처리 후, scrollTop=0 상태에서)
      const pageCutEls = contentRef.current.querySelectorAll('[data-page-cut="true"]')
      const containerRect = contentRef.current.getBoundingClientRect()
      const cuts = Array.from(pageCutEls).map(el => {
        const elRect = el.getBoundingClientRect()
        return {
          start:  Math.round((elRect.top - containerRect.top) * scale),
          height: Math.round(el.offsetHeight * scale),
        }
      })

      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: '#fafafa',
        scale,
        useCORS: true,
      })

      // 복원
      hiddenEls.forEach(el => { el.style.display = '' })
      contentRef.current.scrollTop = prevScrollTop

      const safeTitle = title || 'untitled'

      if (cuts.length === 0) {
        triggerDownload(canvas, `큐시트_${safeTitle}.png`)
        return
      }

      // 구간 분리 (절취선 높이 제외)
      const segments = []
      let prev = 0
      for (const cut of cuts) {
        segments.push({ from: prev, to: cut.start })
        prev = cut.start + cut.height
      }
      segments.push({ from: prev, to: canvas.height })

      segments.forEach((seg, i) => {
        const h = seg.to - seg.from
        if (h <= 0) return
        const c = document.createElement('canvas')
        c.width  = canvas.width
        c.height = h
        c.getContext('2d').drawImage(canvas, 0, seg.from, canvas.width, h, 0, 0, canvas.width, h)
        setTimeout(() => triggerDownload(c, `큐시트_${safeTitle}_${i + 1}.png`), i * 120)
      })
    } catch (e) {
      console.error(e)
      toast.error('이미지 다운로드 실패')
    }
  }

  const updateItem = useCallback((idx, patch) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item))
  }, [])

  const deleteItem = useCallback((idx) => {
    setItems(prev => {
      const next = prev.filter((_, i) => i !== idx)
      return next.length ? next : [EMPTY_SONG()]
    })
  }, [])

  const addItemAt = useCallback((index, type) => {
    const newItem = type === 'sheet' ? EMPTY_SHEET() : type === 'page_cut' ? EMPTY_PAGE_CUT() : EMPTY_SONG()
    setItems(prev => [...prev.slice(0, index), newItem, ...prev.slice(index)])
  }, [])

  const insertSheetBefore = useCallback((itemIndex, sheetImage) => {
    setItems(prev => [
      ...prev.slice(0, itemIndex),
      { item_type: 'sheet', sheet_image: sheetImage },
      ...prev.slice(itemIndex),
    ])
  }, [])

  return (
    <div className={styles.page}>
      {/* ── 사이드바 ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHead}>
          <span className={styles.sidebarTitle}>저장된 큐시트</span>
          <button className={styles.newBtn} onClick={newQueue}>+ 새 큐시트</button>
        </div>
        <ul className={styles.queueList}>
          {queues.map(q => (
            <li
              key={q.id}
              className={`${styles.queueItem} ${activeId === q.id ? styles.queueItemActive : ''}`}
              onClick={() => selectQueue(q)}
            >
              <div className={styles.queueItemTitle}>{q.title}</div>
              {q.queue_date && <div className={styles.queueItemDate}>{q.queue_date.slice(0, 10)}</div>}
              <button className={styles.queueDelBtn} onClick={e => removeQueue(q.id, e)} title="삭제">✕</button>
            </li>
          ))}
          {queues.length === 0 && <li className={styles.queueEmpty}>큐시트 없음</li>}
        </ul>
      </aside>

      {/* ── 메인 에디터 ── */}
      <main className={styles.main}>
        <div className={styles.toolbar}>
          <input
            className={styles.sheetTitle}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="큐시트 제목"
            disabled={!activeId}
          />
          <input
            type="date"
            className={styles.sheetDate}
            value={date}
            onChange={e => setDate(e.target.value)}
            disabled={!activeId}
          />
          <button className={styles.saveBtn} onClick={save} disabled={saving || !activeId}>
            {saving ? '저장 중…' : '💾 저장'}
          </button>
          <button className={styles.dlBtn} onClick={downloadImage} disabled={!activeId}>
            📥 이미지 다운로드
          </button>
        </div>

        {activeId ? (
          <div className={styles.content} ref={contentRef}>
            <AddItemButton onAdd={(type) => addItemAt(0, type)} />
            {items.map((item, i) => {
              if (item.item_type === 'page_cut') {
                return (
                  <div key={i} className={styles.itemWrap}>
                    <PageCutRow onDelete={() => deleteItem(i)} />
                    <AddItemButton onAdd={(type) => addItemAt(i + 1, type)} />
                  </div>
                )
              }

              if (item.item_type === 'sheet') {
                return (
                  <div key={i} className={styles.itemWrap}>
                    <SheetRow
                      item={item}
                      onUpdate={(patch) => updateItem(i, patch)}
                      onDelete={() => deleteItem(i)}
                    />
                    <AddItemButton onAdd={(type) => addItemAt(i + 1, type)} />
                  </div>
                )
              }

              // song
              const songIndex = items.slice(0, i).filter(x => x.item_type === 'song').length
              const nextItem  = items[i + 1]
              const showArrow = nextItem?.item_type === 'song'
              return (
                <div key={i} className={styles.itemWrap}>
                  <SongRow
                    song={item}
                    songIndex={songIndex}
                    showArrow={showArrow}
                    onUpdate={(patch) => updateItem(i, patch)}
                    onDelete={() => deleteItem(i)}
                    onInsertSheetBefore={(sheetImage) => insertSheetBefore(i, sheetImage)}
                  />
                  <AddItemButton onAdd={(type) => addItemAt(i + 1, type)} />
                </div>
              )
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🎵</div>
            <p>왼쪽에서 큐시트를 선택하거나 새로 만드세요</p>
          </div>
        )}
      </main>
    </div>
  )
}
