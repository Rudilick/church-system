import { useEffect, useState } from 'react'
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

// ─── NodeTile: 트리의 개별 노드 ──────────────────────────────────────
function NodeTile({ name, sub, photo, gender, size = 50, onClick, active }) {
  return (
    <div className={`${styles.nodeTile} ${active ? styles.nodeTileActive : ''}`} onClick={onClick}>
      <Avatar photo={photo} name={name} size={size} borderColor={genderColor(gender)} />
      <div className={styles.nodeLabel}>{name}</div>
      {sub && <div className={styles.nodeSub}>{sub}</div>}
    </div>
  )
}

// ─── MemberPopup: 말단 노드 hover 시 구성원 얼굴 타일 박스 ──────────
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

// ─── UpperNode: 교구 재귀 트리 노드 (위로 확장) ──────────────────────
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
      {/* column-reverse: 이 박스가 DOM 첫째 → 시각적으로 위에 위치 */}
      <div className={`${styles.childrenBox} ${styles.childrenUp} ${expanded ? styles.childrenOpen : ''}`}>
        <div className={styles.childRow}>
          {hasChildren
            ? node.children.map(c => <UpperNode key={c.id} node={c} isTouch={isTouch} />)
            : <MemberPopup members={node.members} />
          }
        </div>
      </div>
      <div className={`${styles.connectorV} ${expanded ? styles.connectorVisible : ''}`} />
      <NodeTile
        name={node.name}
        sub={node.type || leader}
        photo={leaderPhoto}
        active={expanded}
        onClick={() => navigate(`/communities/${node.id}`)}
      />
    </div>
  )
}

// ─── PastorNode: 부목사 → 담당 교구 확장 ──────────────────────────────
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
      <div className={`${styles.connectorV} ${expanded ? styles.connectorVisible : ''}`} />
      <NodeTile
        name={pastor.name}
        sub={pastor.position || '부목사'}
        photo={pastor.photo_url}
        gender={pastor.gender}
        size={54}
        active={expanded}
        onClick={() => navigate(`/members/${pastor.id}`)}
      />
    </div>
  )
}

// ─── LowerNode: 부서 재귀 트리 노드 (아래로 확장) ────────────────────
function LowerNode({ node, isTouch }) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const hasChildren = node.children?.length > 0
  const leader = (node.members || []).find(m => m.job_title?.endsWith('장') || m.job_title === '부장')
              ?? node.members?.[0]

  const handlers = isTouch
    ? { onClick: e => { e.stopPropagation(); setExpanded(v => !v) } }
    : { onMouseEnter: () => setExpanded(true), onMouseLeave: () => setExpanded(false) }

  return (
    <div className={styles.lowerNodeOuter} {...handlers}>
      <NodeTile
        name={node.name}
        sub={leader?.job_title || null}
        photo={leader?.photo_url}
        size={48}
        active={expanded}
        onClick={() => navigate(`/departments/${node.id}`)}
      />
      <div className={`${styles.connectorV} ${expanded ? styles.connectorVisible : ''}`} />
      <div className={`${styles.childrenBox} ${styles.childrenDown} ${expanded ? styles.childrenOpen : ''}`}>
        <div className={styles.childRow}>
          {hasChildren
            ? node.children.map(c => <LowerNode key={c.id} node={c} isTouch={isTouch} />)
            : <MemberPopup members={node.members} />
          }
        </div>
      </div>
    </div>
  )
}

// ─── DangwoeCenter: 당회 중심 원형 ────────────────────────────────────
function DangwoeCenter({ head, elders, deacons }) {
  const navigate = useNavigate()
  const ringMembers = [...elders, ...deacons]
  const n = ringMembers.length
  const SIZE = 300
  const R = 112

  return (
    <div className={styles.dangwoeSection}>
      <div className={styles.dangwoeRing} style={{ width: SIZE, height: SIZE }}>
        {ringMembers.map((m, i) => {
          const angle = (i / Math.max(n, 1)) * 2 * Math.PI - Math.PI / 2
          const x = SIZE / 2 + Math.cos(angle) * R
          const y = SIZE / 2 + Math.sin(angle) * R
          return (
            <div key={m.id} className={styles.ringMember}
                 style={{ left: x, top: y }}
                 onClick={() => navigate(`/members/${m.id}`)}>
              <Avatar photo={m.photo_url} name={m.name} size={40} borderColor={genderColor(m.gender)} />
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

// ─── Main ────────────────────────────────────────────────────────────
export default function Organization() {
  const [head, setHead] = useState(null)
  const [elders, setElders] = useState([])
  const [deacons, setDeacons] = useState([])
  const [pastors, setPastors] = useState([])
  const [commTree, setCommTree] = useState([])
  const [deptTree, setDeptTree] = useState([])
  const [loading, setLoading] = useState(true)
  const isTouch = useTouchDevice()

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

  const topDepts = deptTree.filter(d => d.name !== '당회')
  const unassignedComms = commTree.filter(c => !c.pastor_id)
  const hasPastorComms = pastors.some(p => commTree.some(c => c.pastor_id === p.id))

  if (loading) return <div className={styles.loading}>조직 정보를 불러오는 중…</div>

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>조직 현황</h1>

      <div className={styles.treeWrap}>

        {/* ── 상부: 교구 소속 ── */}
        <section className={styles.upperSection}>
          <div className={styles.branchLabel}>교구 소속</div>
          <div className={styles.nodeRow}>
            {pastors.length > 0
              ? pastors.map(p => (
                  <PastorNode key={p.id} pastor={p} communities={commTree} isTouch={isTouch} />
                ))
              : commTree.map(c => <UpperNode key={c.id} node={c} isTouch={isTouch} />)
            }
            {hasPastorComms && unassignedComms.length > 0 && (
              unassignedComms.map(c => <UpperNode key={c.id} node={c} isTouch={isTouch} />)
            )}
            {pastors.length === 0 && commTree.length === 0 && (
              <p className={styles.emptyHint}>
                교구 정보 없음 — 설정 → <strong>교구 구성</strong>에서 추가하세요.
              </p>
            )}
          </div>
        </section>

        {/* ── 당회 중심 ── */}
        <div className={styles.centerLine}>
          <div className={styles.vertLine} />
          <DangwoeCenter head={head} elders={elders} deacons={deacons} />
          <div className={styles.vertLine} />
        </div>

        {/* ── 하부: 부서 활동 ── */}
        <section className={styles.lowerSection}>
          <div className={styles.nodeRow}>
            {topDepts.length > 0
              ? topDepts.map(d => <LowerNode key={d.id} node={d} isTouch={isTouch} />)
              : (
                  <p className={styles.emptyHint}>
                    부서 정보 없음 — 설정 → <strong>조직 관리</strong>에서 추가하세요.
                  </p>
                )
            }
          </div>
          <div className={styles.branchLabel}>부서 활동</div>
        </section>

      </div>
    </div>
  )
}
