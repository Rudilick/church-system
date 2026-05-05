import { useState, useCallback } from 'react'

/**
 * 자동완성 드롭다운 키보드 네비게이션 훅
 * @param {Array}    items     - 드롭다운 항목 배열
 * @param {Function} onSelect  - 항목 선택 콜백 (item) => void
 * @param {Function} onClose   - 드롭다운 닫기 콜백
 * @returns {{ activeIndex, handleKeyDown, setActiveIndex }}
 */
export function useAutocompleteKeyNav(items, onSelect, onClose) {
  const [activeIndex, setActiveIndex] = useState(0)

  const handleKeyDown = useCallback((e) => {
    if (!items?.length) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (items[activeIndex]) onSelect(items[activeIndex])
    } else if (e.key === 'Escape') {
      onClose?.()
    }
  }, [items, activeIndex, onSelect, onClose])

  // 목록이 바뀌면 첫 번째 항목으로 초기화
  const resetIndex = useCallback(() => setActiveIndex(0), [])

  return { activeIndex, setActiveIndex, handleKeyDown, resetIndex }
}
