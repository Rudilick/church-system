import { useEffect, useState } from 'react'
import { members as membersApi } from '../api'

// 모듈 수준 캐시 — 앱 세션 전체에서 한 번만 로드
let _cache = null
let _loading = false
const _listeners = []

function loadAll() {
  if (_cache || _loading) return
  _loading = true
  membersApi.list({ limit: 2000 })
    .then(r => {
      _cache = r.data.data || []
      _listeners.forEach(fn => fn(_cache))
      _listeners.length = 0
    })
    .catch(() => { _loading = false })
}

export function useMemberAll() {
  const [list, setList] = useState(_cache || [])

  useEffect(() => {
    if (_cache) { setList(_cache); return }
    _listeners.push(setList)
    loadAll()
    return () => {
      const i = _listeners.indexOf(setList)
      if (i !== -1) _listeners.splice(i, 1)
    }
  }, [])

  // q 입력에 대해 로컬 필터링 (즉각 반응)
  const search = (q) => {
    if (!q?.trim() || !_cache) return []
    return _cache.filter(m =>
      m.name?.includes(q) || m.name?.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 8)
  }

  return { list, search }
}

// 다른 컴포넌트가 마운트될 때를 대비해 미리 로드 트리거용
export function prefetchMembers() { loadAll() }
