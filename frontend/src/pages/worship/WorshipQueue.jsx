import { useCallback, useEffect, useRef, useState } from 'react'
import { worshipQueues as api } from '../../api'
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
  // 포함 여부로 키워드 감지 (예: "2절" → "절" 포함 → 주황 블럭)
  const matched = KEYWORDS.find(k => label.includes(k))
  const style = BLOCK_STYLES[matched] ?? BLOCK_STYLES['__custom']
  return { id: crypto.randomUUID(), label, bg: style.bg, fg: style.fg }
}

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

// ── 곡 행 ─────────────────────────────────────────────────
function SongRow({ song, index, totalSongs, onUpdate, onDelete, onAddSong }) {
  const [input, setInput] = useState('')
  const [acList, setAcList] = useState([])
  const [selectedBlock, setSelectedBlock] = useState(null)
  const spaceCountRef = useRef(0)
  const dragId = useRef(null)
  const inputRef = useRef(null)

  const addBlock = useCallback((label) => {
    const block = makeBlock(label)
    onUpdate(index, { blocks: [...song.blocks, block] })
    setInput('')
    setAcList([])
    spaceCountRef.current = 0
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [song.blocks, index, onUpdate])

  const handleInputChange = (e) => {
    const val = e.target.value
    setInput(val)
    const trimmed = val.trim()
    setAcList(trimmed ? KEYWORDS.filter(k => k.startsWith(trimmed) || trimmed.includes(k)) : [])
  }

  const handleKeyDown = (e) => {
    if (e.key === ' ') {
      spaceCountRef.current += 1
      if (spaceCountRef.current >= 2) {
        e.preventDefault()
        const text = input.trim()
        if (text) addBlock(text)
        spaceCountRef.current = 0
        return
      }
    } else {
      spaceCountRef.current = 0
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && input === '' && selectedBlock) {
      onUpdate(index, { blocks: song.blocks.filter(b => b.id !== selectedBlock) })
      setSelectedBlock(null)
      e.preventDefault()
      return
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && input === '' && song.blocks.length > 0) {
      const last = song.blocks[song.blocks.length - 1]
      onUpdate(index, { blocks: song.blocks.slice(0, -1) })
      e.preventDefault()
      return
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
    onUpdate(index, { blocks })
  }
  const handleDragEnd = () => { dragId.current = null }

  const deleteBlock = (id) => {
    onUpdate(index, { blocks: song.blocks.filter(b => b.id !== id) })
    if (selectedBlock === id) setSelectedBlock(null)
  }

  return (
    <div className={styles.songRow}>
      {/* 곡 번호 + 제목 */}
      <div className={styles.songHeader}>
        <span className={styles.songNum}>{index + 1}번곡</span>
        <input
          className={styles.songTitleInput}
          placeholder="곡 제목 입력…"
          value={song.song_title}
          onChange={e => onUpdate(index, { song_title: e.target.value })}
        />
        <button className={styles.deleteSongBtn} onClick={() => onDelete(index)} title="곡 삭제">✕</button>
      </div>

      {/* 블록 행 */}
      <div className={styles.blockRow} onClick={() => setSelectedBlock(null)}>
        {song.blocks.map(block => (
          <Block
            key={block.id}
            block={block}
            selected={selectedBlock === block.id}
            onSelect={id => { setSelectedBlock(id === selectedBlock ? null : id) }}
            onDelete={deleteBlock}
            onDragStart={handleDragStart}
            onDragEnter={handleDragEnter}
            onDragEnd={handleDragEnd}
          />
        ))}

        {/* 입력창 */}
        <div className={styles.blockInputWrap}>
          <input
            ref={inputRef}
            className={styles.blockInput}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={song.blocks.length === 0 ? '절/후렴/간주… 입력 또는 두 번 스페이스로 커스텀 블록' : '…'}
          />
          {acList.length > 0 && (
            <ul className={styles.acList}>
              {acList.map(k => (
                <li key={k}
                  className={styles.acItem}
                  style={{ background: BLOCK_STYLES[k].bg, color: BLOCK_STYLES[k].fg }}
                  onMouseDown={e => { e.preventDefault(); addBlock(k) }}
                >{k}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 메모 */}
      <textarea
        className={styles.noteArea}
        placeholder="※ 메모 (전환, 특이사항 등)"
        value={song.note}
        onChange={e => onUpdate(index, { note: e.target.value })}
        rows={2}
      />

      {/* 다음 곡 화살표 */}
      {index < totalSongs - 1 && (
        <div className={styles.arrowSection}>
          <div className={styles.arrowLine} />
          <span className={styles.arrowHead}>▼</span>
          <input
            className={styles.arrowLabel}
            value={song.arrow_label}
            onChange={e => onUpdate(index, { arrow_label: e.target.value })}
            placeholder={`${index + 2}번곡으로`}
          />
        </div>
      )}

      {/* 마지막 곡 다음에 곡 추가 버튼 */}
      {index === totalSongs - 1 && (
        <button className={styles.addSongBtn} onClick={onAddSong}>+ 곡 추가</button>
      )}
    </div>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────
const EMPTY_SONG = () => ({ song_title: '', blocks: [], note: '', arrow_label: '' })

export default function WorshipQueue() {
  const [queues, setQueues]     = useState([])
  const [activeId, setActiveId] = useState(null)
  const [title, setTitle]       = useState('')
  const [date, setDate]         = useState('')
  const [songs, setSongs]       = useState([EMPTY_SONG()])
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
      setSongs(data.length ? data.map(s => ({
        song_title: s.song_title || '',
        blocks: (s.blocks || []).map(b => ({ ...b, id: b.id || crypto.randomUUID() })),
        note: s.note || '',
        arrow_label: s.arrow_label || '',
      })) : [EMPTY_SONG()])
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
        setActiveId(null); setTitle(''); setDate(''); setSongs([EMPTY_SONG()])
      }
    } catch { toast.error('삭제 실패') }
  }

  const save = async () => {
    if (!activeId) { toast.error('저장할 큐시트를 선택하세요'); return }
    setSaving(true)
    try {
      await api.update(activeId, { title: title || '새 큐시트', queue_date: date || null })
      await api.saveSongs(activeId, songs)
      setQueues(prev => prev.map(q => q.id === activeId ? { ...q, title: title || '새 큐시트', queue_date: date || null } : q))
      toast.success('저장됐습니다')
    } catch { toast.error('저장 실패') }
    finally { setSaving(false) }
  }

  const downloadImage = async () => {
    if (!contentRef.current) return
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: '#fafafa',
        scale: 2,
        useCORS: true,
      })
      const link = document.createElement('a')
      link.download = `큐시트_${title || 'untitled'}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (e) {
      console.error(e)
      toast.error('이미지 다운로드 실패')
    }
  }

  const updateSong = useCallback((idx, patch) => {
    setSongs(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }, [])

  const deleteSong = useCallback((idx) => {
    setSongs(prev => {
      const next = prev.filter((_, i) => i !== idx)
      return next.length ? next : [EMPTY_SONG()]
    })
  }, [])

  const addSong = useCallback(() => {
    setSongs(prev => [...prev, EMPTY_SONG()])
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
        {/* 툴바 */}
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

        {/* 큐시트 콘텐츠 */}
        {activeId ? (
          <div className={styles.content} ref={contentRef}>
            {songs.map((song, i) => (
              <SongRow
                key={i}
                song={song}
                index={i}
                totalSongs={songs.length}
                onUpdate={updateSong}
                onDelete={deleteSong}
                onAddSong={addSong}
              />
            ))}
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
