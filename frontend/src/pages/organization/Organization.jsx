import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { members as memberApi, communities as communityApi, departments as deptApi } from '../../api'
import styles from './Organization.module.css'

const CANVAS_W = 3600
const CANVAS_H = 3000
const CX = CANVAS_W / 2
const CY = CANVAS_H / 2
const ELDER_R_BASE = 190

const T = { x: CX,        y: CY - 580 }
const R = { x: CX + 760,  y: CY }
const B = { x: CX,        y: CY + 640 }
const L = { x: CX - 760,  y: CY }

function polarPositions(n, r) {
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2
    return { x: CX + Math.cos(angle) * r, y: CY + Math.sin(angle) * r }
  })
}

export default function Organization() {
  const navigate = useNavigate()
  const viewRef = useRef()
  const drag = useRef(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [head, setHead]         = useState(null)
  const [elders, setElders]     = useState([])
  const [ministers, setMinisters] = useState([])
  const [deacons, setDeacons]   = useState([])
  const [cells, setCells]       = useState([])
  const [depts, setDepts]       = useState([])

  useEffect(() => {
    const el = viewRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setOffset({ x: width / 2 - CX, y: height / 2 - CY })
  }, [])

  useEffect(() => {
    const m = (positions, limit = 200) =>
      memberApi.list({ positions, limit }).then(r => r.data.data || [])
    m('담임목사', 5).then(d => setHead(d[0] || null))
    m('장로').then(setElders)
    m('부목사,전도사').then(setMinisters)
    m('권사,안수집사,집사').then(setDeacons)
    communityApi.list({ type: 'cell' }).then(r => setCells(Array.isArray(r.data) ? r.data : []))
    deptApi.list().then(r => setDepts(Array.isArray(r.data) ? r.data : []))
  }, [])

  const elderRadius = Math.max(ELDER_R_BASE, elders.length * 24)
  const elderPos = polarPositions(elders.length, elderRadius)

  const onMouseDown = e => {
    drag.current = { sx: e.clientX - offset.x, sy: e.clientY - offset.y }
  }
  const onMouseMove = e => {
    if (!drag.current) return
    setOffset({ x: e.clientX - drag.current.sx, y: e.clientY - drag.current.sy })
  }
  const onMouseUp = () => { drag.current = null }

  const goCenter = () => {
    const el = viewRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setOffset({ x: width / 2 - CX, y: height / 2 - CY })
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topBar}>
        <h1 className={styles.title}>조직 현황</h1>
        <span className={styles.hint}>드래그로 탐색 · 타일 클릭으로 이동</span>
        <button className={styles.centerBtn} onClick={goCenter}>⌂ 중앙으로</button>
      </div>

      <div
        ref={viewRef}
        className={styles.viewport}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div
          className={styles.canvas}
          style={{ width: CANVAS_W, height: CANVAS_H, transform: `translate(${offset.x}px, ${offset.y}px)` }}
        >
          {/* SVG connection lines */}
          <svg className={styles.svg} width={CANVAS_W} height={CANVAS_H}>
            {[T, R, B, L].map((pt, i) => (
              <line key={i} x1={CX} y1={CY} x2={pt.x} y2={pt.y}
                stroke="#cbd5e1" strokeWidth={2} strokeDasharray="10 6" />
            ))}
            {elderPos.map((pt, i) => (
              <line key={`el${i}`} x1={CX} y1={CY} x2={pt.x} y2={pt.y}
                stroke="#dde7f5" strokeWidth={1.5} strokeDasharray="6 4" />
            ))}
          </svg>

          {/* 담임목사 */}
          <div className={styles.canvasTile} style={{ left: CX, top: CY }}>
            {head
              ? <MemberTile member={head} size={90} isHead onClick={() => navigate(`/members/${head.id}`)} />
              : <div className={styles.headPlaceholder}>담임목사</div>
            }
          </div>

          {/* 장로단 */}
          {elders.map((m, i) => (
            <div key={m.id} className={styles.canvasTile} style={{ left: elderPos[i].x, top: elderPos[i].y }}>
              <MemberTile member={m} size={64} onClick={() => navigate(`/members/${m.id}`)} />
            </div>
          ))}

          {/* Top: 교역자단 */}
          <Cluster title="교역자단" pt={T} maxW={360}>
            {ministers.length > 0
              ? ministers.map(m => (
                  <MemberTile key={m.id} member={m} size={62} onClick={() => navigate(`/members/${m.id}`)} />
                ))
              : <NoData>교역자 없음</NoData>
            }
          </Cluster>

          {/* Right: 셀모임 */}
          <Cluster title="셀모임" pt={R} maxW={320}>
            {cells.length > 0
              ? cells.map(c => (
                  <div key={c.id} className={styles.groupTile} onClick={() => navigate(`/communities/${c.id}`)}>
                    {c.name}
                  </div>
                ))
              : <NoData>셀 없음</NoData>
            }
          </Cluster>

          {/* Bottom: 재직부서 */}
          <Cluster title="재직부서" pt={B} maxW={400}>
            {depts.length > 0
              ? depts.map(d => (
                  <div key={d.id} className={styles.groupTile} onClick={() => navigate(`/departments/${d.id}`)}>
                    {d.name}
                  </div>
                ))
              : <NoData>부서 없음</NoData>
            }
          </Cluster>

          {/* Left: 권사·집사단 */}
          <Cluster title="권사·집사단" pt={L} maxW={360}>
            {deacons.length > 0
              ? deacons.map(m => (
                  <MemberTile key={m.id} member={m} size={54} onClick={() => navigate(`/members/${m.id}`)} />
                ))
              : <NoData>없음</NoData>
            }
          </Cluster>
        </div>
      </div>
    </div>
  )
}

function Cluster({ title, pt, maxW, children }) {
  return (
    <div className={styles.cluster} style={{ left: pt.x, top: pt.y, maxWidth: maxW }}>
      <div className={styles.clusterLabel}>{title}</div>
      <div className={styles.clusterTiles}>{children}</div>
    </div>
  )
}

function MemberTile({ member, size, onClick, isHead }) {
  const color = member.gender === 'M' ? '#3b82f6' : member.gender === 'F' ? '#f472b6' : '#94a3b8'
  return (
    <div className={`${styles.orgTile} ${isHead ? styles.headTile : ''}`} onClick={onClick}>
      <div className={styles.orgAvatar} style={{ width: size, height: size, borderColor: color }}>
        {member.photo_url
          ? <img src={member.photo_url} alt={member.name} />
          : <span style={{ fontSize: size * 0.38 }}>{(member.name || '?')[0]}</span>
        }
      </div>
      <div className={styles.orgName}>{member.name}</div>
      {member.position && <div className={styles.orgPos}>{member.position}</div>}
    </div>
  )
}

function NoData({ children }) {
  return <span className={styles.noData}>{children}</span>
}
