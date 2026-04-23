import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { members as memberApi, communities as communityApi } from '../../api'
import styles from './Members.module.css'

const STAGE = 300
const CX = STAGE / 2
const CY = STAGE / 2
const NODE_MARGIN = 38

const RELATION_LABELS = { spouse: '배우자', parent: '부모', child: '자녀', sibling: '형제·자매' }

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

function getPositions(count) {
  if (count === 0) return []
  const maxR = STAGE / 2 - NODE_MARGIN
  const radius = clamp(count * 28, 85, maxR)
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2
    return {
      x: clamp(CX + Math.cos(angle) * radius, NODE_MARGIN, STAGE - NODE_MARGIN),
      y: clamp(CY + Math.sin(angle) * radius, NODE_MARGIN, STAGE - NODE_MARGIN),
    }
  })
}

function Node({ member, size = 54, isAnchor }) {
  const [hov, setHov] = useState(false)
  const borderColor = isAnchor
    ? '#3b82f6'
    : member.gender === 'M' ? '#60a5fa' : member.gender === 'F' ? '#f472b6' : '#94a3b8'

  return (
    <div
      className={styles.graphNodeInner}
      title={member.name}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div
        className={`${styles.graphCircle} ${isAnchor ? styles.graphCircleAnchor : ''}`}
        style={{ width: size, height: size, borderColor }}
      >
        {member.photo_url
          ? <img src={member.photo_url} alt={member.name} />
          : <span style={{ fontSize: size * 0.38 }}>{(member.name || '?')[0]}</span>
        }
      </div>
      <div className={styles.graphLabel}>{member.name}</div>
      {member.sub && <div className={styles.graphSub}>{member.sub}</div>}

      {hov && (
        <div className={styles.graphPhotoPopup}>
          {member.photo_url
            ? <img src={member.photo_url} alt={member.name} />
            : <div className={styles.graphPopupPlaceholder} style={{ background: borderColor }}>
                {(member.name || '?')[0]}
              </div>
          }
          <span>{member.name}</span>
          {member.sub && <span className={styles.graphPopupSub}>{member.sub}</span>}
        </div>
      )}
    </div>
  )
}

export default function RelationGraph({ memberId, hideDetailLink = false }) {
  const [memberData, setMemberData] = useState(null)
  const [view, setView] = useState('member')
  const [communityData, setCommunityData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!memberId) { setMemberData(null); return }
    setView('member')
    setCommunityData(null)
    setLoading(true)
    memberApi.get(memberId).then(r => setMemberData(r.data)).finally(() => setLoading(false))
  }, [memberId])

  const openCommunity = async c => {
    try {
      const r = await communityApi.get(c.id)
      setCommunityData({ ...r.data, displayName: c.name })
      setView('community')
    } catch { }
  }

  if (!memberId) {
    return (
      <div className={styles.graphPanel}>
        <div className={styles.graphEmpty}>
          <span style={{ fontSize: '2rem' }}>👥</span>
          <span>교인을 클릭하면<br />관계도가 표시됩니다</span>
        </div>
      </div>
    )
  }

  if (loading) return <div className={styles.graphPanel}><div className={styles.graphEmpty}>불러오는 중…</div></div>
  if (!memberData) return <div className={styles.graphPanel} />

  // ── Community view ────────────────────────────────────────
  if (view === 'community' && communityData) {
    const members = communityData.members || []
    const leader  = members.find(m => m.role === 'leader')
    const others  = members.filter(m => !leader || m.id !== leader.id)
    const center  = leader ?? { id: -1, name: communityData.displayName, gender: '', photo_url: '' }
    const pos     = getPositions(others.length)

    return (
      <div className={styles.graphPanel}>
        <div className={styles.graphNav}>
          <button className={styles.graphBack} onClick={() => setView('member')}>← {memberData.name}</button>
          <span className={styles.graphNavCrumb}>{communityData.displayName}</span>
        </div>

        <div className={styles.graphStage}>
          <svg className={styles.graphSvg} width={STAGE} height={STAGE}>
            {others.map((m, i) => (
              <line key={m.id} x1={CX} y1={CY} x2={pos[i].x} y2={pos[i].y}
                stroke="#e2e8f0" strokeWidth={1.5} />
            ))}
          </svg>

          <div style={{ position: 'absolute', left: CX, top: CY, transform: 'translate(-50%,-50%)', zIndex: 2 }}>
            <Node member={{ ...center, sub: leader ? '셀장' : '' }} size={72}
              isAnchor={center.id === Number(memberId)} />
          </div>

          {others.map((m, i) => (
            <div key={m.id} style={{ position: 'absolute', left: pos[i].x, top: pos[i].y, transform: 'translate(-50%,-50%)', zIndex: 1 }}>
              <Node member={{ ...m, sub: '' }} size={52} isAnchor={m.id === Number(memberId)} />
            </div>
          ))}
        </div>

        <div className={styles.graphCount}>구성원 {members.length}명</div>
      </div>
    )
  }

  // ── Member view ───────────────────────────────────────────
  const family      = (memberData.family || []).map(f => ({
    ...f,
    sub: RELATION_LABELS[f.relation_type] ?? f.relation_type,
  }))
  const communities = memberData.communities || []
  const pos         = getPositions(family.length)

  return (
    <div className={styles.graphPanel}>
      <div className={styles.graphNav}>
        <span className={styles.graphNavTitle}>{memberData.name}</span>
        {!hideDetailLink && (
          <Link to={`/members/${memberId}`} className={styles.graphDetailLink}>상세보기 →</Link>
        )}
      </div>

      <div className={styles.graphStage}>
        <svg className={styles.graphSvg} width={STAGE} height={STAGE}>
          {family.map((m, i) => (
            <line key={m.id} x1={CX} y1={CY} x2={pos[i].x} y2={pos[i].y}
              stroke="#e2e8f0" strokeWidth={1.5} />
          ))}
        </svg>

        <div style={{ position: 'absolute', left: CX, top: CY, transform: 'translate(-50%,-50%)', zIndex: 2 }}>
          <Node member={memberData} size={74} isAnchor />
        </div>

        {family.map((m, i) => (
          <div key={m.id} style={{ position: 'absolute', left: pos[i].x, top: pos[i].y, transform: 'translate(-50%,-50%)', zIndex: 1 }}>
            <Node member={m} size={54} />
          </div>
        ))}
      </div>

      {communities.length > 0 && (
        <div className={styles.graphComm}>
          <div className={styles.graphCommTitle}>소속 공동체 · 클릭하면 구성원 관계도 표시</div>
          <div className={styles.graphCommTags}>
            {communities.map(c => (
              <button key={c.id} className={styles.graphCommTag} onClick={() => openCommunity(c)}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {family.length === 0 && communities.length === 0 && (
        <p className={styles.graphEmptyNote}>등록된 가족/공동체가 없습니다.</p>
      )}
    </div>
  )
}
