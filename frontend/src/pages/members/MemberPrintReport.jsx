import { useEffect, useState } from 'react'
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
import styles from './MemberPrintReport.module.css'

function calcKoreanAge(birthDate) {
  if (!birthDate) return null
  return dayjs().year() - dayjs(birthDate).year() + 1
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

  useEffect(() => {
    if (!memberId) { setData(null); return }
    let cancelled = false
    setLoading(true)
    Promise.all([
      membersApi.get(memberId),
      deptApi.byMember(memberId).catch(() => ({ data: [] })),
      pastoralApi.list({ member_id: memberId }).catch(() => ({ data: [] })),
      prayerApi.list({ member_id: memberId }).catch(() => ({ data: [] })),
      attendanceApi.memberHistory(memberId, 20).catch(() => ({ data: [] })),
    ])
      .then(([mRes, dRes, vRes, prRes, hRes]) => {
        if (cancelled) return
        setData({
          member: mRes.data,
          depts: dRes.data || [],
          visits: vRes.data || [],
          prayers: prRes.data || [],
          history: hRes.data || [],
        })
      })
      .catch(() => { if (!cancelled) toast.error('리포트 데이터를 불러오지 못했습니다.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [memberId])

  useEffect(() => {
    if (!data || loading) return
    window.print()
  }, [data, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleAfterPrint = () => onDone?.()
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [onDone])

  if (!data) return null

  const { member, depts, visits, prayers, history } = data
  const westAge = calcWesternAge(member.birth_date)
  const korAge  = calcKoreanAge(member.birth_date)
  const recentWeeks = 12
  const attendRate = history.length
    ? `최근 기록 ${history.length}건 (최근 ${recentWeeks}주 기준 참고용)`
    : '출결 기록 없음'

  return (
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

        {/* 출결추이 */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>✅ 출결추이</h3>
          <p className={styles.sectionSummary}>{attendRate}</p>
          {history.length === 0 ? (
            <p className={styles.empty}>출결 기록이 없습니다.</p>
          ) : (
            <div className={styles.chipGrid}>
              {history.map((h, i) => (
                <span key={i} className={styles.chip}>
                  {dayjs(h.date).format('MM.DD')} · {h.service_name}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* 공동체내역 */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>🏘️ 공동체내역</h3>
          {(member.communities?.length || 0) === 0 && depts.length === 0 ? (
            <p className={styles.empty}>소속 정보가 없습니다.</p>
          ) : (
            <div className={styles.chipGrid}>
              {(member.communities || []).map(c => (
                <span key={`c${c.id}`} className={styles.chip}>
                  {c.name}{c.type || ''}{c.role === 'leader' ? ' (리더)' : ''}
                </span>
              ))}
              {depts.map(d => (
                <span key={`d${d.department_id}`} className={styles.chip}>
                  {d.department_name}{d.job_title ? ` · ${d.job_title}` : ''}{d.role === 'leader' ? ' (리더)' : ''}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* 심방내역 */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>🙏 심방내역 <span className={styles.sectionCount}>{visits.length}건</span></h3>
          {visits.length === 0 ? (
            <p className={styles.empty}>심방 기록이 없습니다.</p>
          ) : (
            <div className={styles.rowList}>
              {visits.map(v => (
                <div key={v.id} className={styles.row}>
                  <span className={styles.rowDate}>{dayjs(v.visit_date).format('YYYY.MM.DD')}</span>
                  <span className={styles.rowTag}>{v.visit_type}</span>
                  <span className={styles.rowContent}>{v.content}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 기도제목내역 */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>🕊️ 기도제목내역 <span className={styles.sectionCount}>{prayers.length}건</span></h3>
          {prayers.length === 0 ? (
            <p className={styles.empty}>기도제목 기록이 없습니다.</p>
          ) : (
            <div className={styles.rowList}>
              {prayers.map(p => (
                <div key={p.id} className={styles.row}>
                  <span className={styles.rowDate}>{dayjs(p.created_at).format('YYYY.MM.DD')}</span>
                  <span className={styles.rowContent}>{p.is_sensitive ? '(민감정보)' : p.content}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
