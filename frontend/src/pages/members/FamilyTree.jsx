import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { members as memberApi } from '../../api'
import { genderColor } from '../../utils'
import styles from './Members.module.css'

const VB_W = 560
const VB_H = 500
const CX = VB_W / 2  // 280
const ROW_Y = [65, 165, 265, 365, 455]

const LINE_PROPS = { stroke: '#cbd5e1', strokeWidth: 1.8, strokeLinecap: 'round' }

const isSpouse = r => ['spouse', '배우자'].includes(r.relation_type)
const isParent = r => ['parent', '부모', '부', '모', '아버지', '어머니'].includes(r.relation_type)
const isChild  = r => ['child',  '자녀', '아들', '딸'].includes(r.relation_type)

async function buildTree(memberId) {
  const { data: self } = await memberApi.get(memberId)
  const fam = self.family || []

  const spouse  = fam.find(isSpouse) ?? null
  const parents = fam.filter(isParent).slice(0, 2)
  const children = fam.filter(isChild)

  const gpByParent = {}
  await Promise.all(parents.map(async p => {
    try {
      const { data } = await memberApi.get(p.id)
      gpByParent[p.id] = (data.family || []).filter(isParent).slice(0, 2)
    } catch { gpByParent[p.id] = [] }
  }))

  const gcByChild = {}
  await Promise.all(children.slice(0, 4).map(async c => {
    try {
      const { data } = await memberApi.get(c.id)
      gcByChild[c.id] = (data.family || []).filter(isChild).slice(0, 3)
    } catch { gcByChild[c.id] = [] }
  }))

  return { self, spouse, parents, children, gpByParent, gcByChild }
}

function TreeNode({ node, isAnchor, size, label, pctX, pctY, onClick }) {
  const [hov, setHov] = useState(false)
  const color = genderColor(node.gender)
  return (
    <div
      className={styles.ftNode}
      style={{ left: `${pctX}%`, top: `${pctY}%` }}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div
        className={`${styles.ftCircle} ${isAnchor ? styles.ftAnchor : ''}`}
        style={{ width: size, height: size, borderColor: isAnchor ? '#3b82f6' : color }}
      >
        {node.photo_url
          ? <img src={node.photo_url} alt={node.name} />
          : <span style={{ fontSize: size * 0.38, color: isAnchor ? '#fff' : color }}>
              {(node.name || '?')[0]}
            </span>
        }
      </div>
      <div className={styles.ftLabel}>{node.name}</div>
      <div className={styles.ftRelLabel}>{label}</div>
      {hov && (
        <div className={styles.ftPhotoPopup}>
          {node.photo_url
            ? <img src={node.photo_url} alt={node.name} />
            : <div className={styles.ftPopupPlaceholder} style={{ background: isAnchor ? '#3b82f6' : color }}>
                {(node.name || '?')[0]}
              </div>
          }
          <span>{node.name}</span>
          {label !== '본인' && <span className={styles.ftPopupRel}>{label}</span>}
        </div>
      )}
    </div>
  )
}

export default function FamilyTree({ memberId }) {
  const navigate = useNavigate()
  const [tree, setTree] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setTree(null)
    buildTree(memberId)
      .then(setTree)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [memberId])

  if (loading) {
    return (
      <div className={styles.ftPanel}>
        <div className={styles.ftLoading}>가계도 불러오는 중...</div>
      </div>
    )
  }
  if (!tree) return <div className={styles.ftPanel} />

  const { self, spouse, parents, children, gpByParent, gcByChild } = tree

  // ── 위치 계산 ─────────────────────────────────────────────
  const selfX   = spouse ? CX - 65 : CX
  const spouseX = CX + 65
  const midX    = spouse ? (selfX + spouseX) / 2 : selfX

  const father = parents.find(p => p.gender === 'M') ?? (parents[0]?.gender !== 'F' ? parents[0] : null) ?? null
  const mother = parents.find(p => p.gender === 'F') ?? (parents[1] ?? null)
  let fatherX = selfX, motherX = selfX
  if (father && mother) { fatherX = 150; motherX = 410 }
  else if (father)      { fatherX = selfX }
  else if (mother)      { motherX = selfX }

  const fgps = father ? (gpByParent[father.id] || []) : []
  const mgps = mother ? (gpByParent[mother.id] || []) : []

  const spreadGp = (gps, parentX) => {
    if (gps.length === 0) return []
    if (gps.length === 1) return [parentX]
    return [parentX - 58, parentX + 58]
  }
  const fgpXs = spreadGp(fgps, fatherX)
  const mgpXs = spreadGp(mgps, motherX)

  const childCount = children.length
  const cSpacing  = childCount > 1 ? Math.min(95, (VB_W - 60) / childCount) : 0
  const cStartX   = midX - ((childCount - 1) * cSpacing) / 2
  const cXs       = children.map((_, i) => cStartX + i * cSpacing)

  const gcMap = {}
  children.forEach((c, ci) => {
    const gcs = gcByChild[c.id] || []
    const gcSpacing = gcs.length > 1 ? Math.min(75, 80 / (gcs.length - 1)) : 0
    const gcStart = cXs[ci] - ((gcs.length - 1) * gcSpacing) / 2
    gcMap[c.id] = gcs.map((gc, gi) => ({ ...gc, x: gcStart + gi * gcSpacing }))
  })

  // ── SVG 연결선 ────────────────────────────────────────────
  const lines = []
  const L = (x1, y1, x2, y2, key) => lines.push({ x1, y1, x2, y2, key })

  // 배우자 수평선
  if (spouse) L(selfX, ROW_Y[2], spouseX, ROW_Y[2], 'sp')

  // 본인 → 부모 (Y자 분기)
  if (parents.length > 0) {
    const jY = (ROW_Y[1] + ROW_Y[2]) / 2  // 215
    L(selfX, ROW_Y[2], selfX, jY, 'su')
    if (father && mother) {
      L(fatherX, ROW_Y[1], fatherX, jY, 'fd')
      L(motherX, ROW_Y[1], motherX, jY, 'md')
      L(fatherX, jY, motherX, jY, 'pbar')
    } else {
      const soloX = father ? fatherX : motherX
      L(soloX, ROW_Y[1], soloX, jY, 'fd')
    }
  }

  // 부(父) → 조부모
  if (fgpXs.length > 0 && father) {
    const jY = (ROW_Y[0] + ROW_Y[1]) / 2  // 115
    L(fatherX, ROW_Y[1], fatherX, jY, 'fgu')
    if (fgpXs.length === 2) L(fgpXs[0], jY, fgpXs[1], jY, 'fgbar')
    fgpXs.forEach((gx, i) => L(gx, ROW_Y[0], gx, jY, `fg${i}`))
  }

  // 모(母) → 조부모
  if (mgpXs.length > 0 && mother) {
    const jY = (ROW_Y[0] + ROW_Y[1]) / 2  // 115
    L(motherX, ROW_Y[1], motherX, jY, 'mgu')
    if (mgpXs.length === 2) L(mgpXs[0], jY, mgpXs[1], jY, 'mgbar')
    mgpXs.forEach((gx, i) => L(gx, ROW_Y[0], gx, jY, `mg${i}`))
  }

  // 본인 → 자녀 (부부 중앙에서 분기)
  if (children.length > 0) {
    const jY = (ROW_Y[2] + ROW_Y[3]) / 2  // 315
    L(midX, ROW_Y[2], midX, jY, 'cd')
    if (cXs.length > 1) L(cXs[0], jY, cXs[cXs.length - 1], jY, 'cbar')
    cXs.forEach((cx, i) => L(cx, jY, cx, ROW_Y[3], `c${i}`))
  }

  // 자녀 → 손자녀
  children.forEach((c, ci) => {
    const gcs = gcMap[c.id] || []
    if (gcs.length > 0) {
      const jY = (ROW_Y[3] + ROW_Y[4]) / 2  // 410
      L(cXs[ci], ROW_Y[3], cXs[ci], jY, `gcu${c.id}`)
      if (gcs.length > 1) L(gcs[0].x, jY, gcs[gcs.length - 1].x, jY, `gcbar${c.id}`)
      gcs.forEach((gc, gi) => L(gc.x, jY, gc.x, ROW_Y[4], `gc${c.id}${gi}`))
    }
  })

  // ── 노드 목록 ─────────────────────────────────────────────
  const allNodes = []
  const N = (member, x, y, label, size, isAnchor = false) => allNodes.push({
    ...member, _x: x, _y: y, label, size, isAnchor,
    pctX: (x / VB_W) * 100,
    pctY: (y / VB_H) * 100,
  })

  fgps.forEach((gp, i) => {
    if (fgpXs[i] !== undefined) {
      const label = gp.gender === 'M' ? '조부' : gp.gender === 'F' ? '조모' : '조부모'
      N(gp, fgpXs[i], ROW_Y[0], label, 42)
    }
  })
  mgps.forEach((gp, i) => {
    if (mgpXs[i] !== undefined) {
      const label = gp.gender === 'M' ? '외조부' : gp.gender === 'F' ? '외조모' : '외조부모'
      N(gp, mgpXs[i], ROW_Y[0], label, 42)
    }
  })
  if (father) N(father, fatherX, ROW_Y[1], '부', 50)
  if (mother) N(mother, motherX, ROW_Y[1], '모', 50)
  N(self, selfX, ROW_Y[2], '본인', 62, true)
  if (spouse) {
    const spouseLabel = spouse.gender === 'M' ? '남편' : spouse.gender === 'F' ? '아내' : '배우자'
    N(spouse, spouseX, ROW_Y[2], spouseLabel, 54)
  }
  children.forEach((c, i) => {
    const label = c.gender === 'M' ? '아들' : c.gender === 'F' ? '딸' : '자녀'
    N(c, cXs[i], ROW_Y[3], label, 48)
  })
  children.forEach(c => (gcMap[c.id] || []).forEach(gc => {
    const label = gc.gender === 'M' ? '손자' : gc.gender === 'F' ? '손녀' : '손자녀'
    N(gc, gc.x, ROW_Y[4], label, 40)
  }))

  return (
    <div className={styles.ftPanel}>
      <div className={styles.ftStage}>
        <svg
          className={styles.ftSvg}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
        >
          {lines.map(l => (
            <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} {...LINE_PROPS} />
          ))}
        </svg>

        {allNodes.map(node => (
          <TreeNode
            key={`${node.id}-${node._x}-${node._y}`}
            node={node}
            isAnchor={node.isAnchor}
            size={node.size}
            label={node.label}
            pctX={node.pctX}
            pctY={node.pctY}
            onClick={() => navigate(`/members/${node.id}`)}
          />
        ))}

      </div>
    </div>
  )
}
