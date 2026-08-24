import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  members as membersApi,
  departments as deptApi,
  pastoral as pastoralApi,
  prayer as prayerApi,
  attendance as attendanceApi,
} from '../../api'
import { genderColor, calcWesternAge, displayPosition } from '../../utils'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import KakaoMap from './KakaoMap'
import styles from './MemberPrintReport.module.css'

function calcKoreanAge(birthDate) {
  if (!birthDate) return null
  return dayjs().year() - dayjs(birthDate).year() + 1
}

// 한글·영문 혼용 relation_type을 영문으로 정규화 (MemberDetail의 NuclearFamilyView와 동일한 규칙)
function normalizeRel(type) {
  const m = {
    '배우자':'spouse','남편':'spouse','아내':'spouse',
    '부모':'parent','부':'parent','모':'parent','아버지':'parent','어머니':'parent',
    '자녀':'child','아들':'child','딸':'child',
    '형제·자매':'sibling','형제자매':'sibling','형':'sibling','누나':'sibling','오빠':'sibling','언니':'sibling','동생':'sibling',
    '조부모':'grandparent','손자녀':'grandchild',
    'father':'parent','mother':'parent',
    'paternal_grandfather':'grandparent','paternal_grandmother':'grandparent',
    'maternal_grandfather':'grandparent','maternal_grandmother':'grandparent',
  }
  return m[type] ?? type
}

const REL_LABEL = {
  great_grandparent:'증조부모', grandparent:'조부모', parent:'부모',
  father:'부', mother:'모',
  paternal_grandfather:'조부', paternal_grandmother:'조모',
  maternal_grandfather:'외조부', maternal_grandmother:'외조모',
  spouse:'배우자', sibling:'형제자매',
  child:'자녀', grandchild:'손자녀', great_grandchild:'증손자녀',
  aunt_paternal:'고모', uncle_paternal:'삼촌',
  aunt_maternal:'이모', uncle_maternal:'외삼촌',
  nephew_niece:'조카', cousin:'사촌',
}

// 인쇄용 가계도 — 화면용 NuclearFamilyView와 달리 컨테이너 실측/스케일 계산 없이
// viewBox + width:100% 로만 A4 폭에 맞춰 자동 축소되므로 추가 API 호출이나
// ResizeObserver가 필요 없다(부모/배우자의 부모, 자녀의 배우자 등 2차 관계는 생략한 단순화 버전).
function PrintFamilyTree({ member }) {
  const fam = member.family || []
  if (fam.length === 0) return <p className={styles.empty}>등록된 가족 정보가 없습니다.</p>

  const parents  = fam.filter(f => normalizeRel(f.relation_type) === 'parent')
    .sort((a, b) => (a.gender === 'M' ? -1 : 1) - (b.gender === 'M' ? -1 : 1))
  const spouse   = fam.find(f => normalizeRel(f.relation_type) === 'spouse') || null
  const siblings = fam.filter(f => normalizeRel(f.relation_type) === 'sibling')
    .sort((a, b) => (a.birth_date ?? '9999') < (b.birth_date ?? '9999') ? -1 : 1)
  const children = fam.filter(f => normalizeRel(f.relation_type) === 'child')
    .sort((a, b) => (a.birth_date ?? '9999') < (b.birth_date ?? '9999') ? -1 : 1)

  const drawnRels = new Set(['parent', 'spouse', 'child', 'sibling'])
  const extra = fam.filter(f => !drawnRels.has(normalizeRel(f.relation_type)))

  if (parents.length === 0 && !spouse && siblings.length === 0 && children.length === 0) {
    return extra.length > 0
      ? <p className={styles.empty}>주 가계도에 표시할 관계가 없습니다. 아래 기타 가족을 참고하세요.</p>
      : <p className={styles.empty}>등록된 가족 정보가 없습니다.</p>
  }

  const GAP = 120, PAD = 30
  const parY = 60, selfY = 190, chY = 320

  const selfRowCount = siblings.length + 1 + (spouse ? 1 : 0)
  const selfRowStart = -((selfRowCount - 1) * GAP) / 2
  const sibXs = siblings.map((_, i) => selfRowStart + i * GAP)
  const selfX = selfRowStart + siblings.length * GAP
  const spouseX = spouse ? selfX + GAP : selfX

  const parMidX = (sibXs.length ? Math.min(...sibXs, selfX) + Math.max(...sibXs, selfX) : selfX * 2) / 2
  const parXs = parents.length === 1 ? [parMidX]
    : parents.length === 2 ? [parMidX - 40, parMidX + 40]
    : parents.map((_, i) => parMidX - ((parents.length - 1) / 2) * GAP + i * GAP)

  const coupleCenter = spouse ? (selfX + spouseX) / 2 : selfX
  const chSpan = Math.max(0, (children.length - 1) * GAP)
  const chStart = coupleCenter - chSpan / 2
  const chXs = children.map((_, i) => chStart + i * GAP)

  const nodes = []
  const lines = []
  const N = (m, x, y, label, isSelf = false) => nodes.push({ ...m, _x: x, _y: y, label, isSelf })
  const L = (x1, y1, x2, y2, key) => lines.push({ x1, y1, x2, y2, key })

  N(member, selfX, selfY, '본인', true)
  if (spouse) N(spouse, spouseX, selfY, '배우자')
  siblings.forEach((s, i) => N(s, sibXs[i], selfY, '형제·자매'))
  parents.forEach((p, i) => N(p, parXs[i], parY, REL_LABEL[p.relation_type] ?? '부모'))
  children.forEach((c, i) => N(c, chXs[i], chY, '자녀'))

  const elbPar = (parY + selfY) / 2
  const elbCh = (selfY + chY) / 2
  const birthXs = [...sibXs, selfX]

  if (spouse) L(selfX, selfY, spouseX, selfY, 'sp')
  if (parents.length > 0) {
    L(parMidX, parY, parMidX, elbPar, 'p1')
    if (birthXs.length === 1) {
      L(selfX, elbPar, selfX, selfY, 'p2')
    } else {
      const bMin = Math.min(...birthXs), bMax = Math.max(...birthXs)
      L(bMin, elbPar, bMax, elbPar, 'pbar')
      birthXs.forEach((bx, i) => L(bx, elbPar, bx, selfY, `pd${i}`))
    }
  }
  if (children.length > 0) {
    L(coupleCenter, selfY, coupleCenter, elbCh, 'c1')
    if (children.length === 1) {
      L(coupleCenter, elbCh, chXs[0], elbCh, 'c2')
      L(chXs[0], elbCh, chXs[0], chY, 'c3')
    } else {
      const cMin = Math.min(...chXs), cMax = Math.max(...chXs)
      L(cMin, elbCh, cMax, elbCh, 'cbar')
      chXs.forEach((cx, i) => L(cx, elbCh, cx, chY, `cd${i}`))
    }
  }

  const allXs = nodes.map(n => n._x)
  const allYs = nodes.map(n => n._y)
  // 라벨은 이름+관계 두 줄이라 노드 중심에서 최대 n._y+66(본인)까지 내려간다.
  // 노드 Y좌표만 기준으로 잡으면 아래쪽 라벨 두 번째 줄이 뷰박스 밖으로 잘려 나가므로
  // 각 노드의 실제 라벨 하단 위치까지 반영해 뷰박스를 잡는다.
  const labelBottoms = nodes.map(n => n._y + (n.isSelf ? 66 : 60))
  const vbMinX = Math.min(...allXs) - PAD
  const vbMaxX = Math.max(...allXs) + PAD
  const vbMinY = Math.min(...allYs) - PAD
  const vbMaxY = Math.max(...labelBottoms) + 14
  const vbW = vbMaxX - vbMinX
  const vbH = vbMaxY - vbMinY

  return (
    <>
      <svg className={styles.ftSvg} viewBox={`${vbMinX} ${vbMinY} ${vbW} ${vbH}`} style={{ width: '100%', height: 'auto' }}>
        {lines.map(l => <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className={styles.ftLine} />)}
        {nodes.map(n => {
          const r = n.isSelf ? 34 : 28
          return (
            <g key={`${n.id}-${n._x}`}>
              {n.photo_url && (
                <clipPath id={`ftclip-${n.id}`}>
                  <circle cx={n._x} cy={n._y} r={r} />
                </clipPath>
              )}
              <circle cx={n._x} cy={n._y} r={r} className={n.isSelf ? styles.ftNodeSelf : styles.ftNode}
                style={{ fill: genderColor(n.gender) }} />
              {n.photo_url ? (
                <image
                  href={n.photo_url}
                  xlinkHref={n.photo_url}
                  x={n._x - r} y={n._y - r} width={r * 2} height={r * 2}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#ftclip-${n.id})`}
                />
              ) : (
                <text x={n._x} y={n._y + 5} textAnchor="middle" className={styles.ftInitial}>{(n.name || '?')[0]}</text>
              )}
              <text x={n._x} y={n._y + (n.isSelf ? 52 : 46)} textAnchor="middle" className={styles.ftName}>{n.name}</text>
              <text x={n._x} y={n._y + (n.isSelf ? 66 : 60)} textAnchor="middle" className={styles.ftRel}>{n.label}</text>
            </g>
          )
        })}
      </svg>
      {extra.length > 0 && (
        <div className={styles.ftExtra}>
          <span className={styles.ftExtraLabel}>기타 가족</span>
          {extra.map(f => (
            <span key={f.id} className={styles.chip}>{f.name} · {REL_LABEL[f.relation_type] ?? f.relation_type}</span>
          ))}
        </div>
      )}
    </>
  )
}

/**
 * MemberPrintReport — 교인 개인 리포트를 A4 기준으로 인쇄/PDF 저장.
 * index.css의 #print-area 전역 관례(OfferingReceipt와 동일)를 그대로 사용:
 * 화면에서는 숨겨져 있다가 인쇄 시에만 이 영역만 보이도록 전환된다.
 * 브라우저 인쇄 대화상자가 "PDF로 저장"과 실제 프린터 선택을 모두 제공하므로
 * 별도 PDF 라이브러리 없이 window.print()만으로 두 요구사항을 충족한다.
 *
 * Props:
 *   memberId  number|null  null이면 아무것도 하지 않음(트리거 대기 상태)
 *   onDone    fn           인쇄창이 닫힌 뒤 호출 (부모가 memberId를 null로 리셋)
 */
export default function MemberPrintReport({ memberId, onDone }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [mapStatus, setMapStatus] = useState('idle') // idle → loading → ok | error | noaddr
  const [captured, setCaptured] = useState(false) // 가족관계도·지도를 정적 이미지로 캡처 완료(또는 시도 종료)
  const [ftImage, setFtImage]   = useState(null)
  const [mapImage, setMapImage] = useState(null)
  const printedRef    = useRef(false)
  const capturingRef  = useRef(false)
  const ftBoxRef       = useRef(null)
  const mapInnerRef    = useRef(null)

  useEffect(() => {
    if (!memberId) { setData(null); return }
    let cancelled = false
    printedRef.current = false
    capturingRef.current = false
    setMapStatus('idle')
    setCaptured(false)
    setFtImage(null)
    setMapImage(null)
    setLoading(true)
    Promise.all([
      membersApi.get(memberId),
      deptApi.byMember(memberId).catch(() => ({ data: [] })),
      pastoralApi.list({ member_id: memberId }).catch(() => ({ data: [] })),
      prayerApi.list({ member_id: memberId }).catch(() => ({ data: [] })),
      attendanceApi.memberHistory(memberId, 20).catch(() => ({ data: [] })),
      membersApi.notes(memberId).catch(() => ({ data: [] })),
    ])
      .then(([mRes, dRes, vRes, prRes, hRes, nRes]) => {
        if (cancelled) return
        setData({
          member: mRes.data,
          depts: dRes.data || [],
          visits: vRes.data || [],
          prayers: prRes.data || [],
          history: hRes.data || [],
          notes: nRes.data || [],
        })
      })
      .catch(() => { if (!cancelled) toast.error('리포트 데이터를 불러오지 못했습니다.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [memberId])

  const address = data ? [data.member.address, data.member.address_detail].filter(Boolean).join(' ') : ''

  // 카카오맵은 캔버스 기반이라 인쇄용 페이지 재배치를 못 따라가 화면 밖으로
  // 어긋나는 문제가 있었다. 그래서 살아있는 지도를 그대로 인쇄에 넣지 않고,
  // 지도(와 가족관계도)가 다 그려지면 html2canvas로 정적 이미지를 떠서
  // <img>로 바꿔 끼운 다음에만 window.print()를 호출한다.
  useEffect(() => {
    if (!data || loading || captured) return
    const settled = !address || mapStatus === 'ok' || mapStatus === 'error' || mapStatus === 'noaddr'
    const runCapture = async () => {
      if (capturingRef.current) return
      capturingRef.current = true
      try {
        const { default: html2canvas } = await import('html2canvas')
        const [ftCanvas, mapCanvas] = await Promise.all([
          ftBoxRef.current
            ? html2canvas(ftBoxRef.current, { useCORS: true, backgroundColor: '#ffffff', scale: 2 }).catch(() => null)
            : null,
          (address && mapInnerRef.current)
            ? html2canvas(mapInnerRef.current, { useCORS: true, backgroundColor: '#ffffff', scale: 2 }).catch(() => null)
            : null,
        ])
        if (ftCanvas) setFtImage(ftCanvas.toDataURL('image/png'))
        if (mapCanvas) setMapImage(mapCanvas.toDataURL('image/png'))
      } finally {
        setCaptured(true)
      }
    }
    if (settled) {
      // mapStatus가 'ok'로 바뀐 시점엔 마커만 찍혔을 뿐 타일 이미지는 아직
      // 로딩 중일 수 있어, 살짝 대기했다가 캡처한다. 주소가 없으면(가족관계도만
      // 캡처) 기다릴 이유가 없으니 바로 진행.
      const delay = address ? 900 : 0
      const t = setTimeout(runCapture, delay)
      return () => clearTimeout(t)
    }
    // 지도가 끝내 응답하지 않는 경우를 대비해 4초 타임아웃으로 강제 진행
    const t = setTimeout(runCapture, 4000)
    return () => clearTimeout(t)
  }, [data, loading, captured, mapStatus, address])

  // 캡처가 끝나면(성공/실패 무관) 화면이 <img>로 바뀐 뒤 인쇄한다.
  useEffect(() => {
    if (!captured || printedRef.current) return
    printedRef.current = true
    window.print()
  }, [captured])

  useEffect(() => {
    const handleAfterPrint = () => onDone?.()
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [onDone])

  if (!data) return null

  const { member, depts, visits, prayers, history, notes } = data
  const westAge = calcWesternAge(member.birth_date)
  const korAge  = calcKoreanAge(member.birth_date)
  const fullAddress = address

  // 소속·출결처럼 항목당 내용이 한두 줄뿐인 정보는 예전 교적상세페이지처럼
  // 라벨:값 요약 표로 묶는다 — 따로 큰 헤딩 섹션을 만들면 내용에 비해 꼭지만 많아진다.
  const communitySummary = [
    ...(member.communities || []).map(c => `${c.name}${c.type || ''}${c.role === 'leader' ? ' (리더)' : ''}`),
    ...depts.map(d => `${d.department_name}${d.job_title ? ` · ${d.job_title}` : ''}${d.role === 'leader' ? ' (리더)' : ''}`),
  ].join(' · ') || null
  const recentDates = history.slice(0, 5).map(h => dayjs(h.date).format('MM.DD')).join(', ')
  const attendSummary = history.length
    ? `최근 ${history.length}건 (${recentDates}${history.length > 5 ? ' 외' : ''})`
    : '출결 기록 없음'

  // document.body에 직접 포탈로 렌더링한다 — MemberDetail 트리 안 어딘가에 있는
  // overflow:hidden/position 조상에 갇히면 화면 밖 프리렌더(및 html2canvas 캡처)가
  // 잘려나가거나 어긋날 수 있어, 그런 조상 영향을 받지 않는 최상위에 붙인다.
  return createPortal((
    <div id="print-area" className={styles.printArea}>
      <div className={styles.page}>
        {/* 헤더 */}
        <div className={styles.header}>
          {member.photo_url
            ? <img src={member.photo_url} alt={member.name} className={styles.photo} />
            : <div className={styles.photoPlaceholder} style={{ background: genderColor(member.gender) }}>{member.name?.[0]}</div>
          }
          <div className={styles.headerInfo}>
            <div className={styles.headerNameRow}>
              <span className={styles.name}>{member.name}</span>
              {member.position && <span className={styles.badge}>{displayPosition(member)}</span>}
            </div>
            <div className={styles.headerMetaRow}>
              {member.gender && <span>{member.gender === 'M' ? '남성' : '여성'}</span>}
              {member.birth_date && (
                <span>{dayjs(member.birth_date).format('YYYY.MM.DD')} (만{westAge}세 · 한국나이 {korAge}세)</span>
              )}
              {member.phone && <span>{member.phone}</span>}
            </div>
            {(member.address || member.address_detail) && (
              <div className={styles.headerAddr}>{[member.address, member.address_detail].filter(Boolean).join(' ')}</div>
            )}
          </div>
          <div className={styles.printedAt}>출력일 {dayjs().format('YYYY.MM.DD')}</div>
        </div>

        {/* 소속·출결 요약 — 예전 교적상세페이지처럼 라벨:값 표로 압축 */}
        <div className={`${styles.summaryTable} ${styles.sectionKeep}`}>
          {communitySummary && (
            <>
              <span className={styles.summaryLabel}>소속</span>
              <span className={styles.summaryValue}>{communitySummary}</span>
            </>
          )}
          <span className={styles.summaryLabel}>출결</span>
          <span className={styles.summaryValue}>{attendSummary}</span>
        </div>

        {/* 가족관계도 · 거주지 지도 — 카드 두 장을 나란히, 가로폭 절반씩.
            break-inside(페이지분할 방지)와 display:flex를 같은 요소에 같이 걸면
            크롬 인쇄 엔진이 레이아웃을 잘못 계산하는 경우가 있어 별도 블록
            래퍼로 나눈다 — flex 자체와 "페이지 중간에서 끊기지 않기"를 서로
            다른 요소가 담당하게 분리. */}
        <div className={styles.sectionKeep}>
          <div className={styles.twinRow}>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>👪 가족관계도</h3>
              <div className={styles.ftBox} ref={ftBoxRef}>
                {ftImage
                  ? <img src={ftImage} alt="가족관계도" className={styles.ftSnapshot} />
                  : <PrintFamilyTree member={member} />}
              </div>
            </section>

            {fullAddress && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>🗺️ 거주지 위치</h3>
                {/* 주소를 박스 밖 문단으로 두면 가족관계도 카드(제목+박스만 있음)와
                    높이가 달라진다 — 박스 안 캡션으로 넣어 두 카드 구조를 맞춘다. */}
                <div className={styles.mapBox}>
                  <div className={styles.mapInner} ref={mapInnerRef}>
                    {mapImage ? (
                      <img src={mapImage} alt="거주지 지도" className={styles.mapSnapshot} />
                    ) : captured ? (
                      // 지도 캡처가 실패한 경우 — 어긋난 라이브 지도를 다시 보여주는 대신
                      // 안전한 문구로 대체한다(주소는 아래 캡션에 이미 표시됨).
                      <div className={styles.mapFallback}>지도를 표시할 수 없습니다.</div>
                    ) : (
                      <KakaoMap address={fullAddress} onStatusChange={setMapStatus} />
                    )}
                  </div>
                  <div className={styles.mapCaption}>{fullAddress}</div>
                </div>
              </section>
            )}
          </div>
        </div>

        {/* 심방내역 — 기록이 있을 때만 (내용 없는 헤딩만 남는 걸 방지) */}
        {visits.length > 0 && (
          <section className={`${styles.section} ${styles.sectionKeep}`}>
            <h3 className={styles.sectionTitle}>🙏 심방내역 <span className={styles.sectionCount}>{visits.length}건</span></h3>
            <div className={styles.rowList}>
              {visits.map(v => (
                <div key={v.id} className={styles.row}>
                  <span className={styles.rowDate}>{dayjs(v.visit_date).format('YYYY.MM.DD')}</span>
                  <span className={styles.rowTag}>{v.visit_type}</span>
                  <span className={styles.rowContent}>{v.content}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 기도제목내역 — 기록이 있을 때만 */}
        {prayers.length > 0 && (
          <section className={`${styles.section} ${styles.sectionKeep}`}>
            <h3 className={styles.sectionTitle}>🕊️ 기도제목내역 <span className={styles.sectionCount}>{prayers.length}건</span></h3>
            <div className={styles.rowList}>
              {prayers.map(p => (
                <div key={p.id} className={styles.row}>
                  <span className={styles.rowDate}>{dayjs(p.created_at).format('YYYY.MM.DD')}</span>
                  <span className={styles.rowContent}>{p.is_sensitive ? '(민감정보)' : p.content}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 특이사항 — 길이 제한이 없으므로 맨 아래 배치, 필요 시 다음 페이지로 자연스럽게 이어짐 */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>📝 특이사항 <span className={styles.sectionCount}>{notes.length}건</span></h3>
          {notes.length === 0 ? (
            <p className={styles.empty}>등록된 특이사항이 없습니다.</p>
          ) : (
            <div className={styles.noteList}>
              {notes.map(n => (
                <div key={n.id} className={styles.noteItem}>
                  <div className={styles.noteHead}>
                    <span className={styles.rowDate}>{dayjs(n.created_at).format('YYYY.MM.DD')}</span>
                    {n.event_id && (
                      <span className={styles.rowTag}>📅 {n.event_date ? dayjs(n.event_date).format('MM.DD') : n.event_title}</span>
                    )}
                    {n.author_name && <span className={styles.noteAuthor}>{n.author_name}</span>}
                  </div>
                  <p className={styles.noteContent}>{n.is_sensitive ? '(민감정보)' : n.content}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  ), document.body)
}
