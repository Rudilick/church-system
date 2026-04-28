import { useCallback, useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import { members as membersApi, offering as offeringApi, settings as settingsApi } from '../../api'
import { genderColor } from '../../utils'
import styles from './OfferingReceipt.module.css'

const YEARS = Array.from({ length: 5 }, (_, i) => String(dayjs().year() - i))

function birthToIdNo(birthDate) {
  if (!birthDate) return ''
  return dayjs(birthDate).format('YYMMDD') + '-*******'
}


function MemberAvatar({ member, size = 40, fontSize = '1rem' }) {
  return member.photo_url
    ? <img src={member.photo_url} alt={member.name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{
        width: size, height: size, borderRadius: '50%',
        background: genderColor(member.gender), color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize, flexShrink: 0
      }}>{member.name[0]}</div>
}

function ReceiptDoc({ item, churchInfo }) {
  const today = dayjs()
  const { member, year, summary } = item
  if (!summary) return null

  const grandTotal = summary.breakdown.reduce((s, r) => s + Number(r.total), 0)
  const serialNo   = `${year}-${String(member.id).padStart(4, '0')}`
  const idNo       = birthToIdNo(member.birth_date)
  const TABLE_MIN  = 6
  const rows = [
    ...summary.breakdown,
    ...Array(Math.max(0, TABLE_MIN - summary.breakdown.length)).fill(null),
  ]

  return (
    <div className={styles.certificate}>
      <div className={styles.certLaw}>
        ■ 소득세법 시행규칙 [별지 제45호의2서식] &lt;개정 2026. 1. 2.&gt;
      </div>
      <div className={styles.certTitleRow}>
        <div className={styles.serialBox}>
          <span>일련번호</span>
          <span className={styles.serialVal}>{serialNo}</span>
        </div>
        <div className={styles.certTitle}>기 부 금 영 수 증</div>
      </div>
      <div className={styles.certHint}>
        ※ 뒤쪽의 작성방법을 읽고 작성하여 주시기 바랍니다.
        <span>(앞쪽)</span>
      </div>

      {/* ❶ 기부자 */}
      <table className={styles.t}>
        <tbody>
          <tr><td colSpan={4} className={styles.sh}>❶ 기부자</td></tr>
          <tr>
            <td className={styles.lbl}>성명(법인명)</td>
            <td className={styles.val}>{member.name}</td>
            <td className={styles.lbl2}>주민등록번호<br />(사업자등록번호)</td>
            <td className={styles.val}>{idNo}</td>
          </tr>
          <tr>
            <td className={styles.lbl}>주소(소재지)</td>
            <td colSpan={3} className={styles.val}>{summary.member.address ?? ''}</td>
          </tr>
        </tbody>
      </table>

      {/* ❷ 기부금 단체 */}
      <table className={`${styles.t} ${styles.bt0}`}>
        <tbody>
          <tr><td colSpan={4} className={styles.sh}>❷ 기부금 단체</td></tr>
          <tr>
            <td className={styles.lbl}>단 체 명</td>
            <td className={styles.val}>{churchInfo.church_name}</td>
            <td className={styles.lbl2}>사업자등록번호(고유번호)</td>
            <td className={styles.val}>{churchInfo.unique_id}</td>
          </tr>
          <tr>
            <td className={styles.lbl}>(지점명)</td>
            <td className={styles.val}></td>
            <td className={styles.lbl2}>(지점 사업자등록번호 등)</td>
            <td className={styles.val}></td>
          </tr>
          <tr>
            <td className={styles.lbl}>소 재 지</td>
            <td className={styles.val}>{churchInfo.address}</td>
            <td className={styles.lbl2}>기부금공제대상<br />기부금단체 근거법령</td>
            <td className={styles.val}>405</td>
          </tr>
          <tr>
            <td className={styles.lbl}>(지점 소재지)</td>
            <td colSpan={3} className={styles.val}></td>
          </tr>
          <tr>
            <td colSpan={4} className={styles.note}>
              * 기부금 단체의 지점(분사무소)이 기부받은 경우, 지점명 등을 추가로 기재할 수 있습니다.
            </td>
          </tr>
        </tbody>
      </table>

      {/* ❸ 기부금 모집처 */}
      <table className={`${styles.t} ${styles.bt0}`}>
        <tbody>
          <tr><td colSpan={4} className={styles.sh}>❸ 기부금 모집처(언론기관 등)</td></tr>
          <tr>
            <td className={styles.lbl}>단 체 명</td>
            <td className={styles.val}></td>
            <td className={styles.lbl2}>사업자등록번호</td>
            <td className={styles.val}></td>
          </tr>
          <tr>
            <td className={styles.lbl}>소 재 지</td>
            <td colSpan={3} className={styles.val}></td>
          </tr>
        </tbody>
      </table>

      {/* ❹ 기부내용 */}
      <table className={`${styles.t} ${styles.bt0}`}>
        <thead>
          <tr><td colSpan={7} className={styles.sh}>❹ 기부내용</td></tr>
          <tr>
            <th className={styles.th} rowSpan={2}>코 드</th>
            <th className={styles.th} rowSpan={2}>구 분<br />(금전 또는<br />현물)</th>
            <th className={styles.th} rowSpan={2}>연월일</th>
            <th className={styles.th} colSpan={3}>내 용</th>
            <th className={styles.th} rowSpan={2}>금 액</th>
          </tr>
          <tr>
            <th className={styles.th}>품명</th>
            <th className={styles.th}>수량</th>
            <th className={styles.th}>단가</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td className={`${styles.td} ${styles.center}`}>{row ? '41' : ''}</td>
              <td className={`${styles.td} ${styles.center}`}>{row ? '금전' : ''}</td>
              <td className={`${styles.td} ${styles.center} ${styles.dateCell}`}>
                {row && i === 0 ? `${year}.01.01~${year}.12.31` : ''}
              </td>
              <td className={`${styles.td} ${styles.nameCell}`}>{row ? row.type_name : ''}</td>
              <td className={styles.td}></td>
              <td className={styles.td}></td>
              <td className={`${styles.td} ${styles.amtCell}`}>
                {row ? Number(row.total).toLocaleString('ko-KR') : ''}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={6} className={`${styles.td} ${styles.center} ${styles.totalLbl}`}>합 계</td>
            <td className={`${styles.td} ${styles.amtCell} ${styles.totalLbl}`}>
              {grandTotal.toLocaleString('ko-KR')}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 하단 서명란 */}
      <div className={styles.footer}>
        <p className={styles.footStmt}>
          「소득세법」 제34조, 「조세특례제한법」 제58조ㆍ제76조ㆍ제88조의4 및 「법인세법」 제24조에 따른
          기부금을 위와 같이 기부하였음을 증명하여 주시기 바랍니다.
        </p>
        <div className={styles.dateRow}>
          {today.year()}년&nbsp;&nbsp;{today.month() + 1}월&nbsp;&nbsp;{today.date()}일
        </div>
        <div className={styles.signRow}>
          <span>신청인</span>
          <span className={styles.signHint}>(서명 또는 인)</span>
        </div>
        <p className={styles.footStmt2}>위와 같이 기부금을 기부받았음을 증명합니다.</p>
        <div className={styles.dateRow}>
          {today.year()}년&nbsp;&nbsp;{today.month() + 1}월&nbsp;&nbsp;{today.date()}일
        </div>
        <div className={styles.signRow}>
          <span>
            기부금 수령인&emsp;{churchInfo.church_name}
            {churchInfo.pastor_name && <>&emsp;담임목사 {churchInfo.pastor_name}</>}
          </span>
          <span className={styles.signHint}>(서명 또는 인)</span>
        </div>
        <div className={styles.footNote}>210mm×297mm[백상지 80g/㎡ 또는 중질지 80g/㎡]</div>
      </div>
    </div>
  )
}

export default function OfferingReceipt({ embedded = false }) {
  const [churchInfo, setChurchInfo] = useState({ church_name: '', unique_id: '', address: '', pastor_name: '' })
  const [receiptList, setReceiptList] = useState([])
  const [query, setQuery]             = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selectedMember, setSelectedMember] = useState(null)
  const [selectedYear, setSelectedYear]     = useState(YEARS[0])
  const [printTarget, setPrintTarget] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    settingsApi.get().then(r => setChurchInfo(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const handler = () => setPrintTarget(null)
    window.addEventListener('afterprint', handler)
    return () => window.removeEventListener('afterprint', handler)
  }, [])

  useEffect(() => {
    if (printTarget !== null) window.print()
  }, [printTarget])

  const search = useCallback(async (name) => {
    if (name.length < 2) { setSuggestions([]); return }
    const r = await membersApi.list({ q: name, limit: 10 })
    setSuggestions(r.data.data ?? [])
  }, [])

  const handleQuery = useCallback(val => {
    setQuery(val)
    setSelectedMember(null)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => search(val), 200)
  }, [search])

  const pick = useCallback(m => {
    setSelectedMember(m)
    setQuery(m.name)
    setSuggestions([])
  }, [])

  const fetchSummary = useCallback((id, member_id, year) => {
    offeringApi.summary({ member_id, year })
      .then(r => setReceiptList(list => list.map(i =>
        i.id === id ? { ...i, summary: r.data, loading: false } : i
      )))
      .catch(() => {
        toast.error('조회에 실패했습니다.')
        setReceiptList(list => list.map(i =>
          i.id === id ? { ...i, loading: false } : i
        ))
      })
  }, [])

  const addToList = useCallback(() => {
    if (!selectedMember) { toast.error('교인을 선택해 주세요.'); return }
    const id = crypto.randomUUID()
    setReceiptList(list => [...list, {
      id, member: selectedMember, year: selectedYear, summary: null, loading: true
    }])
    fetchSummary(id, selectedMember.id, selectedYear)
    setQuery('')
    setSelectedMember(null)
    setSuggestions([])
  }, [selectedMember, selectedYear, fetchSummary])

  const removeFromList = useCallback(id => {
    setReceiptList(list => list.filter(i => i.id !== id))
  }, [])

  const changeYear = useCallback((id, memberId, newYear) => {
    setReceiptList(list => list.map(item =>
      item.id === id ? { ...item, year: newYear, summary: null, loading: true } : item
    ))
    fetchSummary(id, memberId, newYear)
  }, [fetchSummary])

  const printOne = useCallback(id => {
    setPrintTarget(id)
  }, [])

  const printAll = useCallback(() => {
    if (receiptList.some(i => i.loading)) {
      toast.error('데이터 조회 중입니다. 잠시 후 다시 시도해 주세요.')
      return
    }
    setPrintTarget('all')
  }, [receiptList])

  const settingsMissing = !churchInfo.church_name

  return (
    <>
      <div className={styles.page}>
        {!embedded && (
          <div className={styles.formHeader}>
            <button className={styles.backBtn} onClick={() => window.history.back()}>← 헌금 관리</button>
            <h2 className={styles.pageTitle}>기부금영수증 발급</h2>
          </div>
        )}

        {settingsMissing && (
          <div className={styles.notice}>
            ⚠️ 교회 기본 정보가 설정되지 않았습니다.&nbsp;
            <a href="/settings" className={styles.noticeLink}>교회 설정 →</a>
          </div>
        )}

        {/* 검색 카드 */}
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>교인 검색</h3>
          <p className={styles.cardHint}>이름 2자 이상 입력 → 목록에서 선택 → 연도 확인 후 추가</p>

          <div className={styles.acWrap}>
            <input
              className={styles.input}
              value={query}
              onChange={e => handleQuery(e.target.value)}
              onBlur={() => setTimeout(() => setSuggestions([]), 150)}
              placeholder="이름 2자 이상 입력"
            />
            {suggestions.length > 0 && (
              <ul className={styles.drop}>
                {suggestions.map(m => (
                  <li key={m.id} onMouseDown={() => pick(m)}>
                    <MemberAvatar member={m} size={32} fontSize="0.85rem" />
                    <div className={styles.dropInfo}>
                      <span className={styles.dropName}>{m.name}</span>
                      <span className={styles.dropBirth}>
                        {m.birth_date ? dayjs(m.birth_date).format('YYYY.MM.DD') : '생년월일 없음'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedMember && (
            <div className={styles.memberCard}>
              <MemberAvatar member={selectedMember} size={48} fontSize="1.1rem" />
              <div className={styles.mcInfo}>
                <span className={styles.mcName}>{selectedMember.name}</span>
                <span className={styles.mcBirth}>
                  {selectedMember.birth_date
                    ? dayjs(selectedMember.birth_date).format('YYYY년 MM월 DD일생')
                    : '생년월일 없음'}
                </span>
              </div>
              <select
                className={styles.yearSelect}
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
              >
                {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
              <button className={styles.addBtn} onClick={addToList}>추가 +</button>
            </div>
          )}
        </section>

        {/* 슬롯 리스트 */}
        {receiptList.length > 0 ? (
          <section className={styles.slotSection}>
            <h3 className={styles.sectionTitle}>발급 목록 ({receiptList.length}건)</h3>
            <div className={styles.slotList}>
              {receiptList.map((item, idx) => (
                <div key={item.id} className={styles.slot}>
                  <span className={styles.slotIdx}>{idx + 1}</span>
                  <MemberAvatar member={item.member} size={40} fontSize="1rem" />
                  <div className={styles.slotInfo}>
                    <span className={styles.slotName}>{item.member.name}</span>
                    <span className={styles.slotBirth}>
                      {item.member.birth_date
                        ? dayjs(item.member.birth_date).format('YYYY.MM.DD')
                        : '생년월일 없음'}
                    </span>
                  </div>
                  <select
                    className={styles.slotYearSel}
                    value={item.year}
                    onChange={e => changeYear(item.id, item.member.id, e.target.value)}
                  >
                    {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
                  </select>
                  {item.loading
                    ? <span className={styles.slotLoading}>조회중…</span>
                    : <span className={styles.slotTotal}>
                        {item.summary
                          ? item.summary.breakdown
                              .reduce((s, r) => s + Number(r.total), 0)
                              .toLocaleString('ko-KR') + '원'
                          : '오류'}
                      </span>
                  }
                  <button
                    className={styles.slotPrint}
                    onClick={() => printOne(item.id)}
                    disabled={item.loading || !item.summary}
                  >
                    출력
                  </button>
                  <button className={styles.slotRemove} onClick={() => removeFromList(item.id)}>×</button>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <div className={styles.emptyHint}>
            교인을 검색하여 목록에 추가하면 영수증을 출력할 수 있습니다.
          </div>
        )}
      </div>

      {/* 일괄출력 FAB */}
      {receiptList.length > 0 && (
        <button
          className={styles.bulkFab}
          onClick={printAll}
          disabled={receiptList.some(i => i.loading)}
        >
          🖨 일괄출력 ({receiptList.length}건)
        </button>
      )}

      {/* 인쇄 전용 영역 */}
      <div className={styles.printArea}>
        {receiptList
          .filter(i => printTarget === 'all' || printTarget === i.id)
          .map(item => (
            <div key={item.id} className={styles.certPageWrap}>
              <ReceiptDoc item={item} churchInfo={churchInfo} />
            </div>
          ))
        }
      </div>
    </>
  )
}
