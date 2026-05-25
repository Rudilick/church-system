import { useCallback, useEffect, useRef, useState } from 'react'
import { members as membersApi } from '../api'
import { useAutocompleteKeyNav } from '../hooks/useAutocompleteKeyNav'
import { genderColor } from '../utils'
import styles from './MemberSearchInput.module.css'

export default function MemberSearchInput({
  memberId,
  memberName,
  memberPhoto,
  memberPosition,
  onSelect,
  onClear,
  placeholder = '이름으로 검색',
  filterFn,
  extraParams,
  disabled,
}) {
  const [q, setQ]           = useState('')
  const [sugg, setSugg]     = useState([])
  const [open, setOpen]     = useState(false)
  const verRef              = useRef(0)
  const containerRef        = useRef(null)
  const extraParamsRef      = useRef(extraParams)
  useEffect(() => { extraParamsRef.current = extraParams }, [extraParams])

  const doSearch = useCallback(async (val) => {
    if (!val.trim()) { setSugg([]); setOpen(false); return }
    const ver = ++verRef.current
    try {
      const res = await membersApi.list({ q: val, limit: 8, ...extraParamsRef.current })
      if (ver !== verRef.current) return
      let items = res.data?.data ?? res.data ?? []
      if (filterFn) items = filterFn(items)
      setSugg(items)
      setOpen(items.length > 0)
    } catch { /* silent */ }
  }, [filterFn])

  const handleChange = (e) => {
    const val = e.target.value
    setQ(val)
    doSearch(val)
  }

  const handleSelect = (m) => {
    setQ('')
    setSugg([])
    setOpen(false)
    onSelect(m)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    setQ('')
    setSugg([])
    setOpen(false)
    onClear()
  }

  const handleClose = () => { setSugg([]); setOpen(false) }

  const { activeIndex, handleKeyDown, resetIndex } = useAutocompleteKeyNav(sugg, handleSelect, handleClose)
  useEffect(() => { resetIndex() }, [sugg, resetIndex])

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) handleClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (memberId) {
    return (
      <div className={styles.chip}>
        {memberPhoto
          ? <img src={memberPhoto} alt={memberName} className={styles.chipAvatar} />
          : <div className={styles.chipAvatar} style={{ background: '#94a3b8' }}>
              {(memberName || '?')[0]}
            </div>
        }
        <div className={styles.chipInfo}>
          <span className={styles.chipName}>{memberName}</span>
          {memberPosition && <span className={styles.chipPos}>{memberPosition}</span>}
        </div>
        {!disabled && (
          <button className={styles.chipClear} type="button" onClick={handleClear}>✕</button>
        )}
      </div>
    )
  }

  return (
    <div className={styles.wrap} ref={containerRef}>
      <input
        className={styles.input}
        value={q}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {open && sugg.length > 0 && (
        <ul className={styles.dropdown}>
          {sugg.map((m, i) => (
            <li
              key={m.id}
              className={i === activeIndex ? styles.active : ''}
              onMouseDown={() => handleSelect(m)}
            >
              {m.photo_url
                ? <img src={m.photo_url} alt={m.name} className={styles.avatar} />
                : <div className={styles.avatar} style={{ background: genderColor(m.gender) }}>
                    {m.name[0]}
                  </div>
              }
              <div className={styles.info}>
                <span className={styles.name}>{m.name}</span>
                {m.position && <span className={styles.pos}>{m.position}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
