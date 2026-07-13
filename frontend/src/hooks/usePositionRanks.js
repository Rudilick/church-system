import { useEffect, useState } from 'react'
import { positions as positionsApi } from '../api'

// 직분명 → 클래스(rank) 색상 매핑. 교역자/장로/권사/집사·안수집사/일반을 구분해
// 교적목록·교인상세·출결관리 등 여러 화면의 직분 뱃지에서 공통으로 재사용한다.
export const RANK_COLORS = {
  clergy:     { color: '#a16207', background: '#fef9c3', border: '#fde047' }, // 교역자 — 금색
  elder:      { color: '#78350f', background: '#f5ead9', border: '#e3c7a0' }, // 장로 — 갈색
  deaconess:  { color: '#b91c1c', background: '#fef2f2', border: '#fecaca' }, // 권사 — 붉은색(톤다운)
  deacon:     { color: '#3b82f6', background: '#eff6ff', border: '#bfdbfe' }, // 집사·안수집사 — 파란색
  general:    { color: '#3b82f6', background: '#eff6ff', border: '#bfdbfe' }, // 일반성도·기타 항존직 — 파란색(현행)
}

export const RANK_LABELS = { clergy: '교역자', elder: '장로', deaconess: '권사', deacon: '집사·안수집사', general: '일반' }

// 직분명 문자열만으로 장로/권사/교역자 여부를 판별한다. 관리자가 직분을 추가할 때마다
// 마커 색상을 일일이 지정하지 않아도(하드코딩 없이) 이름에 따라 자동으로 색이 정해진다.
export function derivePositionRank(name) {
  if (!name) return null
  if (name.includes('장로')) return 'elder'
  if (name.includes('권사')) return 'deaconess'
  if (/목사|전도사|강도사/.test(name)) return 'clergy'
  return null
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
  const rank = derivePositionRank(positionName) ?? rankMap?.[positionName] ?? 'general'
  return RANK_COLORS[rank] ?? RANK_COLORS.general
}
