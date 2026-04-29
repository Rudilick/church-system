import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { members as memberApi, communities as communityApi } from '../../api'
import { genderColor } from '../../utils'
import styles from './Organization.module.css'

const CANVAS_W = 3600
const CANVAS_H = 3000
const CX = CANVAS_W / 2
const CY = CANVAS_H / 2
const ELDER_R_BASE = 190

const T = { x: CX,        y: CY - 580 }
const R = { x: CX + 760,  y: CY }
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
  const [scale, setScale]   = useState(1)
  const [head, setHead]         = useState(null)
  const [elders, setElders]     = useState([])
  const [ministers, setMinisters] = useState([])
  const [deacons, setDeacons]   = useState([])
  const [cells, setCells]       = useState([])

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

  const onWheel = useCallback(e => {
    e.preventDefault()
    setScale(s => Math.min(2, Math.max(0.3, s - e.deltaY * 0.001)))
  }, [])

  const onTouchStart = e => {
    drag.current = { sx: e.touches[0].clientX - offset.x, sy: e.touches[0].clientY - offset.y }
  }
  const onTouchMove = e => {
    if (!drag.current) return
    e.preventDefault()
    setOffset({ x: e.touches[0].clientX - drag.current.sx, y: e.touches[0].clientY - drag.current.sy })
  }
  const onTouchEnd = () => { drag.current = null }

  const goCenter = () => {
    const el = viewRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setOffset({ x: width / 2 - CX, y: height / 2 - CY })
    setScale(1)
  }

  const focusPoint = (x, y) => {
    const el = viewRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setOffset({ x: width / 2 - x, y: height / 2 - y })
  }

  useEffect(() => {
    const el = viewRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  return (
    <div className={styles.wrap}>
      {/* 왼쪽 정보 패널 */}
      <div className={styles.infoPanel}>
        <div className={styles.infoPanelHeader}>
          <h1 className={styles.title}>조직 현황</h1>
          <button className={styles.centerBtn} onClick={goCenter} title="중앙으로">⌂</button>
        </div>

        {head && (
          <InfoSection title="담임목사">
            <InfoRow
              name={head.name}
              sub={head.position}
              photoUrl={head.photo_url}
              onClick={() => focusPoint(CX, CY)}
            />
          </InfoSection>
        )}

        <InfoSection title={`교역자단 ${ministers.length}명`}>
          {ministers.length > 0
            ? ministers.map(m => (
                <InfoRow key={m.id} name={m.name} sub={m.position} photoUrl={m.photo_url}
                  onClick={() => { focusPoint(T.x, T.y); navigate(`/members/${m.id}`) }} />
              ))
            : <span className={styles.infEmpty}>없음</span>
          }
        </InfoSection>

        <InfoSection title={`장로단 ${elders.length}명`}>
          {elders.length > 0
            ? elders.map((m, i) => (
                <InfoRow key={m.id} name={m.name} sub={m.position} photoUrl={m.photo_url}
                  onClick={() => { focusPoint(elderPos[i].x, elderPos[i].y); navigate(`/members/${m.id}`) }} />
              ))
            : <span className={styles.infEmpty}>없음</span>
          }
        </InfoSection>

        <InfoSection title={`권사·집사단 ${deacons.length}명`}>
          {deacons.length > 0
            ? deacons.map(m => (
                <InfoRow key={m.id} name={m.name} sub={m.position} photoUrl={m.photo_url}
                  onClick={() => { focusPoint(L.x, L.y); navigate(`/members/${m.id}`) }} />
              ))
            : <span className={styles.infEmpty}>없음</span>
          }
        </InfoSection>

        <InfoSection title={`셀모임 ${cells.length}개`}>
          {cells.length > 0
            ? cells.map(c => (
                <InfoRow key={c.id} name={c.name} sub={c.leader_name ? `셀장: ${c.leader_name}` : ''}
                  onClick={() => { focusPoint(R.x, R.y); navigate(`/communities/${c.id}`) }} />
              ))
            : <span className={styles.infEmpty}>없음</span>
          }
        </InfoSection>
      </div>

      {/* 오른쪽 캔버스 영역 */}
      <div className={styles.canvasArea}>
        <div className={styles.topBar}>
          <span className={styles.hint}>드래그로 탐색 · 타일 클릭으로 이동</span>
          <div className={styles.zoomBtns}>
            <button className={styles.zoomBtn} onClick={() => setScale(s => Math.min(2, s + 0.15))}>+</button>
            <span className={styles.zoomLabel}>{Math.round(scale * 100)}%</span>
            <button className={styles.zoomBtn} onClick={() => setScale(s => Math.max(0.3, s - 0.15))}>−</button>
          </div>
        </div>

        <div
          ref={viewRef}
          className={styles.viewport}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div
            className={styles.canvas}
            style={{ width: CANVAS_W, height: CANVAS_H, transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
          >
            {/* SVG connection lines */}
            <svg className={styles.svg} width={CANVAS_W} height={CANVAS_H}>
              {[T, R, L].map((pt, i) => (
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
  const color = genderColor(member.gender)
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

function InfoSection({ title, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div className={styles.infoSection}>
      <div className={styles.infoSectionHeader} onClick={() => setOpen(o => !o)}>
        <span>{title}</span>
        <span>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div className={styles.infoSectionBody}>{children}</div>}
    </div>
  )
}

function InfoRow({ name, sub, photoUrl, onClick }) {
  return (
    <div className={styles.infoRow} onClick={onClick}>
      <div className={styles.infoAvatar}>
        {photoUrl
          ? <img src={photoUrl} alt={name} />
          : <span>{(name || '?')[0]}</span>
        }
      </div>
      <div className={styles.infoRowText}>
        <span className={styles.infoRowName}>{name}</span>
        {sub && <span className={styles.infoRowSub}>{sub}</span>}
      </div>
    </div>
  )
}
