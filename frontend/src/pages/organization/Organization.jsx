import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { members as memberApi, communities as communityApi, departments as deptApi } from '../../api'
import { genderColor } from '../../utils'
import styles from './Organization.module.css'

function useTouchDevice() {
  const [isTouch, setIsTouch] = useState(() => window.matchMedia('(hover: none)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(hover: none)')
    const h = e => setIsTouch(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return isTouch
}

// ─── Avatar ──────────────────────────────────────────────────────────
function Avatar({ photo, name, size = 48, borderColor }) {
  return (
    <div className={styles.avatar} style={{ width: size, height: size, borderColor: borderColor || '#dde3ef' }}>
      {photo
        ? <img src={photo} alt={name} />
        : <span style={{ fontSize: size * 0.38, fontWeight: 600, color: '#64748b' }}>{(name || '?')[0]}</span>
      }
    </div>
  )
}

// ─── NodeTile ─────────────────────────────────────────────────────────
function NodeTile({ name, sub, photo, gender, size = 50, onClick, active }) {
  return (
    <div className={`${styles.nodeTile} ${active ? styles.nodeTileActive : ''}`} onClick={onClick}>
      <Avatar photo={photo} name={name} size={size} borderColor={genderColor(gender)} />
      <div className={styles.nodeLabel}>{name}</div>
      {sub && <div className={styles.nodeSub}>{sub}</div>}
    </div>
  )
}

// ─── MemberPopup ──────────────────────────────────────────────────────
function MemberPopup({ members }) {
  return (
    <div className={styles.memberPopup}>
      {!members?.length
        ? <span className={styles.popupEmpty}>구성원 없음</span>
        : members.map(m => (
            <div key={m.id} className={styles.faceTile}>
              <Avatar photo={m.photo_url} name={m.name} size={38} borderColor={genderColor(m.gender)} />
              <div className={styles.faceName}>{m.name}</div>
            </div>
          ))
      }
    </div>
  )
}

// ─── UpperNode ────────────────────────────────────────────────────────
function UpperNode({ node, isTouch }) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const hasChildren = node.children?.length > 0
  const leader = node.leader_name || node.pastor_name
  const leaderPhoto = node.leader_photo || node.pastor_photo
  const handlers = isTouch
    ? { onClick: e => { e.stopPropagation(); setExpanded(v => !v) } }
    : { onMouseEnter: () => setExpanded(true), onMouseLeave: () => setExpanded(false) }
  return (
    <div className={styles.upperNodeOuter} {...handlers}>
      <div className={`${styles.childrenBox} ${styles.childrenUp} ${expanded ? styles.childrenOpen : ''}`}>
        <div className={styles.childRow}>
          {hasChildren
            ? node.children.map(c => <UpperNode key={c.id} node={c} isTouch={isTouch} />)
            : <MemberPopup members={node.members} />
          }
        </div>
      </div>
      <svg style={{ display: 'block', margin: '0 auto', overflow: 'visible', width: 2, height: 18 }} aria-hidden="true">
        <path
          d="M 1 18 L 1 0"
          stroke="#93c5fd" strokeWidth="1.5" fill="none"
          strokeDasharray="20"
          style={{ strokeDashoffset: expanded ? 0 : 20, transition: 'stroke-dashoffset 0.3s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <NodeTile
        name={node.name} sub={node.type || leader} photo={leaderPhoto}
        active={expanded} onClick={() => navigate(`/communities/${node.id}`)}
      />
    </div>
  )
}

// ─── PastorNode ───────────────────────────────────────────────────────
function PastorNode({ pastor, communities, isTouch }) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const assigned = communities.filter(c => c.pastor_id === pastor.id)
  const handlers = isTouch
    ? { onClick: e => { e.stopPropagation(); setExpanded(v => !v) } }
    : { onMouseEnter: () => setExpanded(true), onMouseLeave: () => setExpanded(false) }
  return (
    <div className={styles.upperNodeOuter} {...handlers}>
      <div className={`${styles.childrenBox} ${styles.childrenUp} ${expanded ? styles.childrenOpen : ''}`}>
        <div className={styles.childRow}>
          {assigned.length > 0
            ? assigned.map(c => <UpperNode key={c.id} node={c} isTouch={isTouch} />)

            : <div className={styles.emptyBranch}>담당 교구 없음</div>
          }
        </div>
      </div>
      <svg style={{ display: 'block', margin: '0 auto', overflow: 'visible', width: 2, height: 18 }} aria-hidden="true">
        <path
          d="M 1 18 L 1 0"
          stroke="#93c5fd" strokeWidth="1.5" fill="none"
          strokeDasharray="20"
          style={{ strokeDashoffset: expanded ? 0 : 20, transition: 'stroke-dashoffset 0.3s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <NodeTile
        name={pastor.name} sub={pastor.position || '부목사'}
        photo={pastor.photo_url} gender={pastor.gender} size={54}
        active={expanded} onClick={() => navigate(`/members/${pastor.id}`)}
      />
    </div>
  )
}

// ─── Ring layout calculation ──────────────────────────────────────────
function computeRingLayout(n) {
  if (n === 0) return { size: 300, elderD: 52, elderR: 97, useOverlap: false, angleStep: 2 * Math.PI }

  const PASTOR_HEAD_D = 100  // visual diameter of center pastor area (avatar + text)
  const BASE_SIZE = 300
  const MAX_SIZE = 4 * PASTOR_HEAD_D  // 400px — beyond this, use overlap
  const BASE_ELDER_D = 52
  const MAX_ELDER_D = 68
  const RING_INSET = 5
  const PASTOR_R = PASTOR_HEAD_D / 2  // 50

  // midpoint between ring inner edge and pastor area edge
  const midR = sz => (sz / 2 - RING_INSET + PASTOR_R) / 2

  const fitsAt = (sz, d) => 2 * Math.PI * midR(sz) >= n * d

  let size = BASE_SIZE
  let elderD = BASE_ELDER_D

  if (!fitsAt(size, elderD)) {
    // Required size: π*(size/2 - RING_INSET + PASTOR_R) >= n*elderD
    // => size >= 2*(n*elderD/π + RING_INSET - PASTOR_R)
    const reqSize = 2 * (n * elderD / Math.PI + RING_INSET - PASTOR_R)
    size = Math.min(MAX_SIZE, reqSize + 20)
    const t = Math.min(1, (size - BASE_SIZE) / Math.max(1, MAX_SIZE - BASE_SIZE))
    elderD = Math.round(BASE_ELDER_D + t * (MAX_ELDER_D - BASE_ELDER_D))
  }

  const r = midR(size)
  const useOverlap = !fitsAt(size, elderD)

  // Overlap: compress into 90% of circle; normal: full circle
  const totalAngle = useOverlap ? 2 * Math.PI * 0.9 : 2 * Math.PI
  const angleStep = totalAngle / n

  return { size, elderD, elderR: r, useOverlap, angleStep }
}

// ─── DangwoeCenter ────────────────────────────────────────────────────
function DangwoeCenter({ head, elders }) {
  const navigate = useNavigate()

  const sorted = [...elders].sort((a, b) => {
    if (!a.birth_date && !b.birth_date) return 0
    if (!a.birth_date) return 1
    if (!b.birth_date) return -1
    return a.birth_date < b.birth_date ? -1 : 1
  })

  const { size, elderD, elderR, useOverlap, angleStep } = computeRingLayout(sorted.length)
  const n = sorted.length

  return (
    <div className={styles.dangwoeSection}>
      <div className={styles.dangwoeRing} style={{ width: size, height: size }}>
        {sorted.map((m, i) => {
          const angle = i * angleStep - Math.PI / 2
          const x = size / 2 + Math.cos(angle) * elderR
          const y = size / 2 + Math.sin(angle) * elderR
          // Overlap: earlier tiles (older) are in front
          const zIdx = useOverlap ? n - i : 2
          return (
            <div
              key={m.id}
              className={styles.ringMember}
              style={{ left: x, top: y, zIndex: zIdx }}
              onClick={() => navigate(`/members/${m.id}`)}
            >
              <Avatar photo={m.photo_url} name={m.name} size={elderD} borderColor={genderColor(m.gender)} />
              <div className={styles.ringName}>{m.name}</div>
            </div>
          )
        })}

        <div className={styles.dangwoeHead} onClick={() => head && navigate(`/members/${head.id}`)}>
          {head ? (
            <>
              <Avatar photo={head.photo_url} name={head.name} size={68} borderColor={genderColor(head.gender)} />
              <div className={styles.headName}>{head.name}</div>
              <div className={styles.headPos}>{head.position || '담임목사'}</div>
            </>
          ) : (
            <span className={styles.headPlaceholder}>담임목사</span>
          )}
        </div>
      </div>
      <div className={styles.dangwoeLabel}>당회</div>
    </div>
  )
}

// ─── SatelliteTile ────────────────────────────────────────────────────
function SatelliteTile({ dept, tileD, isActive, isPinned, isHovered, onActivate, onHoverIn, onHoverOut, onPin, isTouch }) {
  const leader = (dept.members || []).find(m => m.job_title?.includes('장') || m.job_title === '부장')
               ?? dept.members?.[0]

  const pcHandlers = {
    onMouseEnter: () => onHoverIn(dept.id),
    onMouseLeave: () => onHoverOut(),
    onClick: (e) => { e.stopPropagation(); onPin(dept.id) },
  }
  const touchHandlers = {
    onClick: (e) => {
      e.stopPropagation()
      if (isActive && !isPinned) onPin(dept.id)
      else onActivate(dept.id)
    },
  }

  const tileClass = [
    styles.satelliteTile,
    isPinned ? styles.satellitePinned : (isActive ? styles.satelliteActive : (isHovered ? styles.satelliteHovered : '')),
  ].join(' ')

  return (
    <div className={tileClass} {...(isTouch ? touchHandlers : pcHandlers)}>
      <Avatar
        photo={leader?.photo_url}
        name={dept.name}
        size={tileD}
        borderColor={isActive || isPinned ? '#10b981' : isHovered ? '#6ee7b7' : '#86efac'}
      />
      <div className={styles.satLabel}>{dept.name}</div>
    </div>
  )
}

// ─── UndergroundNode ──────────────────────────────────────────────────
function UndergroundNode({ node, depth, isActive, isPinned, onActivate, onDeactivate, onPin, onHover1F, onHoverLeave1F, isTouch }) {
  const navigate = useNavigate()
  const leader = (node.members || []).find(m => m.job_title?.includes('장') || m.job_title === '부장')
               ?? node.members?.[0]
  const hasChildren = node.children?.length > 0

  const pcHandlers = {
    onMouseEnter: () => {
      onActivate(depth, node.id)
      if (depth === 0 && onHover1F) onHover1F(node.id)
    },
    onMouseLeave: () => {
      onDeactivate(depth)
      if (depth === 0 && onHoverLeave1F) onHoverLeave1F()
    },
    onClick: () => onPin(depth, node.id),
  }
  const touchHandlers = {
    onClick: (e) => {
      e.stopPropagation()
      if (depth === 0 && onHover1F) onHover1F(node.id)
      if (isActive && !isPinned) onPin(depth, node.id)
      else onActivate(depth, node.id)
    },
  }

  return (
    <div
      className={`${styles.ugNodeWrap} ${isActive ? styles.ugNodeActive : ''} ${isPinned ? styles.ugNodePinned : ''}`}
      {...(isTouch ? touchHandlers : pcHandlers)}
    >
      <div className={styles.ugLeaderTile} onClick={() => navigate(`/departments/${node.id}`)}>
        <Avatar photo={leader?.photo_url} name={node.name} size={52} borderColor={genderColor(leader?.gender)} />
        <div className={styles.ugNodeLabel}>{node.name}</div>
        {leader?.job_title && <div className={styles.ugNodeSub}>{leader.job_title}</div>}
      </div>

      {hasChildren && (isActive || isPinned) && (
        <div className={styles.ugChildArrow}>▼</div>
      )}
    </div>
  )
}

// ─── MemberFloor (지하2층) ────────────────────────────────────────────
function MemberFloor({ node, isTouch, onMouseEnter, onMouseLeave }) {
  const navigate = useNavigate()
  if (!node) return null
  const leader = (node.members || []).find(m => m.job_title?.includes('장') || m.job_title === '부장')
               ?? node.members?.[0]
  const others = (node.members || []).filter(m => m.id !== leader?.id)
  const isVisible = true

  return (
    <div className={styles.memberFloorWrap}>
      <div className={styles.ugConnector} />
      <div
        className={`${styles.memberFloor} ${isVisible ? styles.memberFloorVisible : ''}`}
        {...(!isTouch ? { onMouseEnter, onMouseLeave } : {})}
      >
        {others.length === 0
          ? <span className={styles.memberFloorEmpty}>구성원 없음</span>
          : others.map(m => (
              <div key={m.id} className={styles.faceTile} onClick={() => navigate(`/members/${m.id}`)}>
                <Avatar photo={m.photo_url} name={m.name} size={38} borderColor={genderColor(m.gender)} />
                <div className={styles.faceName}>{m.name}</div>
              </div>
            ))
        }
      </div>
    </div>
  )
}

// ─── UndergroundSection ───────────────────────────────────────────────
function UndergroundSection({ rootDept, isTouch }) {
  const [activePath, setActivePath] = useState([])
  const [pinnedPath, setPinnedPath] = useState([])
  const [hovered1FId, setHovered1FId] = useState(null)
  const leaveTimers = useRef({})
  const floorLeaveTimer = useRef(null)

  const effectivePath = activePath.map((aid, i) => pinnedPath[i] ?? aid)

  const handleActivate = (depth, id) => {
    clearTimeout(leaveTimers.current[depth])
    setActivePath(prev => {
      const next = prev.slice(0, depth + 1)
      next[depth] = id
      return next
    })
  }

  const handleDeactivate = (depth) => {
    if (pinnedPath[depth]) return
    leaveTimers.current[depth] = setTimeout(() => {
      setActivePath(prev => prev.slice(0, depth))
    }, 200)
  }

  const handlePin = (depth, id) => {
    setPinnedPath(prev => {
      const next = prev.slice(0, depth + 1)
      next[depth] = id
      return next
    })
    setActivePath(prev => {
      const next = prev.slice(0, depth + 1)
      next[depth] = id
      return next
    })
  }

  const handleHover1F = (id) => {
    clearTimeout(floorLeaveTimer.current)
    setHovered1FId(id)
  }

  const handleHoverLeave1F = () => {
    floorLeaveTimer.current = setTimeout(() => setHovered1FId(null), 150)
  }

  function findNode(nodes, id) {
    for (const n of nodes) {
      if (n.id === id) return n
      if (n.children?.length) { const f = findNode(n.children, id); if (f) return f }
    }
    return null
  }

  const firstLevel = rootDept.children || []

  // Build visible levels
  const levels = [firstLevel]
  for (let d = 0; d < effectivePath.length; d++) {
    const id = effectivePath[d]
    if (!id) break
    const node = findNode(levels[d], id)
    if (node?.children?.length > 0) {
      levels.push(node.children)
    } else {
      break
    }
  }

  // Determine which node to show in 지하2층
  const floor2Id = hovered1FId ?? effectivePath[0] ?? null
  const floor2Node = floor2Id ? firstLevel.find(n => n.id === floor2Id) : null
  const floor2IsLeaf = floor2Node && (!floor2Node.children || floor2Node.children.length === 0)

  // If root itself is a leaf
  if (firstLevel.length === 0) {
    return (
      <div className={styles.undergroundSection}>
        <div className={styles.undergroundLevel}><MemberPopup members={rootDept.members} /></div>
      </div>
    )
  }

  return (
    <div className={styles.undergroundSection}>
      {levels.map((levelNodes, depth) => (
        <div key={depth}>
          <div className={styles.ugConnector} />
          <div className={styles.undergroundLevel}>
            {levelNodes.map(node => {
              const effId = effectivePath[depth]
              return (
                <UndergroundNode
                  key={node.id}
                  node={node}
                  depth={depth}
                  isActive={effId === node.id}
                  isPinned={pinnedPath[depth] === node.id}
                  onActivate={handleActivate}
                  onDeactivate={handleDeactivate}
                  onPin={handlePin}
                  onHover1F={depth === 0 ? handleHover1F : undefined}
                  onHoverLeave1F={depth === 0 ? handleHoverLeave1F : undefined}
                  isTouch={isTouch}
                />
              )
            })}
          </div>
        </div>
      ))}

      {floor2IsLeaf && floor2Node && (
        <MemberFloor
          key={floor2Node.id}
          node={floor2Node}
          isTouch={isTouch}
          onMouseEnter={() => clearTimeout(floorLeaveTimer.current)}
          onMouseLeave={handleHoverLeave1F}
        />
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────
export default function Organization() {
  const [head, setHead] = useState(null)
  const [elders, setElders] = useState([])
  const [deacons, setDeacons] = useState([])
  const [pastors, setPastors] = useState([])
  const [commTree, setCommTree] = useState([])
  const [deptTree, setDeptTree] = useState([])
  const [loading, setLoading] = useState(true)
  const isTouch = useTouchDevice()

  const [rotationOffset, setRotationOffset] = useState(0)
  const [activeSatId, setActiveSatId] = useState(null)
  const [pinnedSatId, setPinnedSatId] = useState(null)
  const [hoveredSatId, setHoveredSatId] = useState(null)
  const prevRotRef = useRef(0)
  const satLeaveTimer = useRef(null)

  useEffect(() => {
    const m = (positions, limit = 200) =>
      memberApi.list({ positions, limit })
        .then(r => { const d = r.data; return Array.isArray(d) ? d : (d?.data || []) })
        .catch(() => [])

    Promise.all([
      m('담임목사', 5),
      m('장로'),
      m('권사,안수집사,집사', 50),
      m('부목사'),
      communityApi.tree().catch(() => ({ data: [] })),
      deptApi.tree().catch(() => ({ data: [] })),
    ]).then(([heads, els, dcs, psts, commsRes, deptsRes]) => {
      setHead(heads[0] || null)
      setElders(els)
      setDeacons(dcs.slice(0, 10))
      setPastors(psts)
      setCommTree(Array.isArray(commsRes.data) ? commsRes.data : [])
      setDeptTree(Array.isArray(deptsRes.data) ? deptsRes.data : [])
      setLoading(false)
    })
  }, [])

  const rootDepts = deptTree.filter(d => d.name !== '당회')
  const unassignedComms = commTree.filter(c => !c.pastor_id)
  const hasPastorComms = pastors.some(p => commTree.some(c => c.pastor_id === p.id))

  const effectiveSatId = pinnedSatId ?? activeSatId
  const activeSat = rootDepts.find(d => d.id === effectiveSatId) || null

  const rotateTo = (id) => {
    const i = rootDepts.findIndex(d => d.id === id)
    if (i < 0) return
    const n = rootDepts.length
    const target = 180 - (i / n) * 360
    let delta = target - prevRotRef.current
    while (delta > 180) delta -= 360
    while (delta < -180) delta += 360
    prevRotRef.current = prevRotRef.current + delta
    setRotationOffset(prevRotRef.current)
  }

  // Touch only: first tap = activate + rotate
  const handleSatActivate = (id) => {
    clearTimeout(satLeaveTimer.current)
    setActiveSatId(id)
    rotateTo(id)
  }

  // PC only: hover = visual highlight, no rotation
  const handleSatHoverIn = (id) => setHoveredSatId(id)
  const handleSatHoverOut = () => setHoveredSatId(null)

  const handleSatPin = (id) => {
    clearTimeout(satLeaveTimer.current)
    if (pinnedSatId === id) {
      setPinnedSatId(null)
      setActiveSatId(null)
    } else {
      setPinnedSatId(id)
      setActiveSatId(id)
      rotateTo(id)
    }
  }

  const { size: ringSize } = computeRingLayout(elders.length)
  const SAT_D = 56
  const ORBIT_GAP = 32

  // orbitR = distance from dangwoe center to satellite tile center
  const orbitR = ringSize / 2 + ORBIT_GAP + SAT_D / 2

  if (loading) return <div className={styles.loading}>조직 정보를 불러오는 중…</div>

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>조직 현황</h1>
      <div className={styles.treeWrap}>

        {/* ── 상부: 교구 소속 (변경 없음) ── */}
        <section className={styles.upperSection}>
          <div className={styles.branchLabel}>교구 소속</div>
          <div className={styles.nodeRow}>
            {pastors.length > 0
              ? pastors.map(p => <PastorNode key={p.id} pastor={p} communities={commTree} isTouch={isTouch} />)
              : commTree.map(c => <UpperNode key={c.id} node={c} isTouch={isTouch} />)
            }
            {hasPastorComms && unassignedComms.length > 0 &&
              unassignedComms.map(c => <UpperNode key={c.id} node={c} isTouch={isTouch} />)
            }
            {pastors.length === 0 && commTree.length === 0 && (
              <p className={styles.emptyHint}>
                교구 정보 없음 — 설정 → <strong>교구 구성</strong>에서 추가하세요.
              </p>
            )}
          </div>
        </section>

        {/* ── 당회 + 위성 궤도 ── */}
        <div className={styles.centerLine}>
          <div className={styles.vertLine} />

          {/* Orbit placeholder: layout size = dangwoe ring, satellites overflow outward */}
          <div
            className={styles.orbitPlaceholder}
            style={{ width: ringSize, height: ringSize }}
            onMouseLeave={() => setHoveredSatId(null)}
          >
            {/* Green glow ring (electron-orbit halo) */}
            <div
              className={styles.glowRing}
              style={{ width: ringSize + ORBIT_GAP * 2 + SAT_D * 2 + 40, height: ringSize + ORBIT_GAP * 2 + SAT_D * 2 + 40 }}
            />

            {/* DangwoeCenter centered */}
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
              <DangwoeCenter head={head} elders={elders} />
            </div>

            {/* Dashed orbit ring (SVG, overflow visible from center) */}
            <svg
              style={{ position: 'absolute', left: '50%', top: '50%', overflow: 'visible', pointerEvents: 'none', width: 0, height: 0 }}
            >
              <circle
                cx={0} cy={0}
                r={ringSize / 2 + ORBIT_GAP / 2}
                fill="none"
                stroke="#86efac"
                strokeWidth="1.5"
                strokeDasharray="5 4"
              />
            </svg>

            {/* Orbit rotator: pivot at center, rotates all satellites */}
            <div
              style={{
                position: 'absolute',
                left: '50%', top: '50%',
                width: 0, height: 0,
                transform: `rotate(${rotationOffset}deg)`,
                transition: 'transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {rootDepts.map((dept, i) => {
                const baseAngle = (i / rootDepts.length) * 360  // 0° = top (12 o'clock)
                const counterRot = -(baseAngle + rotationOffset)
                return (
                  <div
                    key={dept.id}
                    style={{
                      position: 'absolute',
                      width: 0, height: 0,
                      transform: `rotate(${baseAngle}deg) translateY(-${orbitR}px)`,
                    }}
                  >
                    {/* Center tile on arm endpoint, then counter-rotate to stay upright */}
                    <div
                      style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) rotate(${counterRot}deg)`,
                        transition: 'transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      <SatelliteTile
                        dept={dept}
                        tileD={SAT_D}
                        isActive={effectiveSatId === dept.id}
                        isPinned={pinnedSatId === dept.id}
                        isHovered={hoveredSatId === dept.id}
                        onActivate={handleSatActivate}
                        onHoverIn={handleSatHoverIn}
                        onHoverOut={handleSatHoverOut}
                        onPin={handleSatPin}
                        isTouch={isTouch}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className={`${styles.vertLine} ${effectiveSatId ? styles.vertLineVisible : styles.vertLineHidden}`} />
        </div>

        {/* ── 지하층: 선택된 위성의 하위 조직 ── */}
        {activeSat && (
          <section
            className={styles.lowerSection}
            onMouseEnter={() => clearTimeout(satLeaveTimer.current)}
          >
            <UndergroundSection
              key={activeSat.id}
              rootDept={activeSat}
              isTouch={isTouch}
            />
            <div className={styles.branchLabel}>{activeSat.name} 조직</div>
          </section>
        )}

      </div>
    </div>
  )
}
