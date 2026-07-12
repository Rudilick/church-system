import { useEffect, useState } from 'react'
import { positions as positionsApi } from '../api'

// 직분명 → 클래스(rank) 색상 매핑. 교역자/장로·권사/집사·안수집사/일반을 구분해
// 교적목록·교인상세·출결관리 등 여러 화면의 직분 뱃지에서 공통으로 재사용한다.
export const RANK_COLORS = {
  clergy:  { color: '#92400e', background: '#fef3c7', border: '#fde68a' },
  elder:   { color: '#b91c1c', background: '#fef2f2', border: '#fecaca' },
  deacon:  { color: '#3b82f6', background: '#eff6ff', border: '#bfdbfe' },
  general: { color: '#64748b', background: '#f1f5f9', border: '#e2e8f0' },
}

// 모듈 수준 캐시 — 앱 세션 전체에서 한 번만 로드
let _cache = null
let _loading = false
const _listeners = []

function loadRanks() {
  if (_cache || _loading) return
  _loading = true
  positionsApi.list({ active: 'false' })
    .then(r => {
      const map = {}
      ;(Array.isArray(r.data) ? r.data : []).forEach(p => { map[p.name] = p.rank || 'general' })
      _cache = map
      _listeners.forEach(fn => fn(_cache))
      _listeners.length = 0
    })
    .catch(() => { _loading = false })
}

export function usePositionRanks() {
  const [map, setMap] = useState(_cache || {})

  useEffect(() => {
    if (_cache) { setMap(_cache); return }
    _listeners.push(setMap)
    loadRanks()
    return () => {
      const i = _listeners.indexOf(setMap)
      if (i !== -1) _listeners.splice(i, 1)
    }
  }, [])

  return map
}

export function positionRankColor(positionName, rankMap) {
  const rank = rankMap?.[positionName] ?? 'general'
  return RANK_COLORS[rank] ?? RANK_COLORS.general
}
