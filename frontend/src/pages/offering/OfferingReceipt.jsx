import { useCallback, useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import { members as membersApi, offering as offeringApi } from '../../api'
import styles from './OfferingReceipt.module.css'

const YEARS = Array.from({ length: 5 }, (_, i) => String(dayjs().year() - i))
const LS_KEY = 'church_receipt_info'

function loadChurchInfo() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) ?? {} } catch { return {} }
}

export default function OfferingReceipt() {
  const [info, setInfo] = useState(() => ({
    name: '', taxId: '', address: '', pastor: '',
    ...loadChurchInfo(),
  }))
  const [query, setQuery]       = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [member, setMember]     = useState(null)
  const [year, setYear]         = useState(YEARS[0])
  const [idNo, setIdNo]         = useState('')
  const [receipt, setReceipt]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(info))
  }, [info])

  const handleQuery = useCallback(val => {
    setQuery(val)
    setMember(null)
    clearTimeout(timer.current)
    if (val.length < 2) { setSuggestions([]); return }
    timer.current = setTimeout(async () => {
      const r = await membersApi.list({ q: val, limit: 8 })
      setSuggestions(r.data.data ?? [])
    }, 200)
  }, [])

  const pick = m => { setMember(m); setQuery(m.name); setSuggestions([]) }

  const issue = async () => {
    if (!member) { toast.error('교인을 선택해 주세요.'); return }
    setLoading(true)
    try {
      const r = await offeringApi.summary({ member_id: member.id, year })
      setReceipt(r.data)
    } catch {
      toast.error('조회에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // ── 발급 폼 ──────────────────────────────────────────────
  if (!receipt) {
    return (
      <div className={styles.page}>
        <div className={styles.formHeader}>
          <button className={styles.backBtn} onClick={() => window.history.back()}>← 헌금 관리</button>
          <h2 className={styles.pageTitle}>기부금영수증 발급</h2>
        </div>

        <section className={styles.card}>
          <h3 className={styles.cardTitle}>❷ 기부금 단체 (교회) 정보</h3>
          <p className={styles.cardHint}>입력한 정보는 이 브라우저에 저장되어 다음에도 유지됩니다.</p>
          <div className={styles.grid2}>
            {[
              ['name',    '단체명 (교회명)',          '○○교회'],
              ['taxId',   '고유번호 (사업자등록번호)', '000-00-00000'],
              ['address', '소재지 (교회 주소)',        '서울특별시 …'],
              ['pastor',  '대표자 (담임목사)',         '홍길동'],
            ].map(([key, label, ph]) => (
              <label key={key} className={styles.field}>
                <span>{label}</span>
                <input className={styles.input} value={info[key]}
                  onChange={e => setInfo(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={ph} />
              </label>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <h3 className={styles.cardTitle}>❶ 기부자 선택</h3>
          <div className={styles.grid2}>
            <label className={styles.field}>
              <span>교인 검색</span>
              <div className={styles.acWrap}>
                <input className={styles.input} value={query}
                  onChange={e => handleQuery(e.target.value)}
                  onBlur={() => setTimeout(() => setSuggestions([]), 150)}
                  placeholder="이름 2자 이상 입력" />
                {suggestions.length > 0 && (
                  <ul className={styles.drop}>
                    {suggestions.map(m => (
                      <li key={m.id} onMouseDown={() => pick(m)}>
                        <span>{m.name}</span>
                        {m.phone && <span className={styles.phone}>{m.phone}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </label>
            <label className={styles.field}>
              <span>기부 연도</span>
              <select className={styles.input} value={year} onChange={e => setYear(e.target.value)}>
                {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span>주민등록번호 <em className={styles.opt}>(선택 · 영수증에만 표시, 저장 안 됨)</em></span>
              <input className={styles.input} value={idNo}
                onChange={e => setIdNo(e.target.value)}
                placeholder="000000-0000000" maxLength={14} />
            </label>
          </div>
        </section>

        <button className={styles.issueBtn} onClick={issue} disabled={loading}>
          {loading ? '조회 중…' : '영수증 발급 →'}
        </button>
      </div>
    )
  }

  // ── 영수증 미리보기 ──────────────────────────────────────
  const today      = dayjs()
  const grandTotal = receipt.breakdown.reduce((s, r) => s + Number(r.total), 0)
  const serialNo   = `${receipt.year}-${String(receipt.member.id).padStart(4, '0')}`
  const TABLE_MIN  = 6
  const rows = [
    ...receipt.breakdown,
    ...Array(Math.max(0, TABLE_MIN - receipt.breakdown.length)).fill(null),
  ]

  return (
    <div className={styles.page}>
      <div className={styles.previewBar}>
        <button className={styles.backBtn} onClick={() => setReceipt(null)}>← 다시 발급</button>
        <button className={styles.printBtn} onClick={() => window.print()}>🖨 인쇄</button>
      </div>

      {/* ── 법정 서식 ── */}
      <div className={styles.certificate}>

        {/* 최상단 */}
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
              <td className={styles.val}>{receipt.member.name}</td>
              <td className={styles.lbl2}>주민등록번호<br />(사업자등록번호)</td>
              <td className={styles.val}>{idNo}</td>
            </tr>
            <tr>
              <td className={styles.lbl}>주소(소재지)</td>
              <td colSpan={3} className={styles.val}>{receipt.member.address ?? ''}</td>
            </tr>
          </tbody>
        </table>

        {/* ❷ 기부금 단체 */}
        <table className={`${styles.t} ${styles.bt0}`}>
          <tbody>
            <tr><td colSpan={4} className={styles.sh}>❷ 기부금 단체</td></tr>
            <tr>
              <td className={styles.lbl}>단 체 명</td>
              <td className={styles.val}>{info.name}</td>
              <td className={styles.lbl2}>사업자등록번호(고유번호)</td>
              <td className={styles.val}>{info.taxId}</td>
            </tr>
            <tr>
              <td className={styles.lbl}>(지점명)</td>
              <td className={styles.val}></td>
              <td className={styles.lbl2}>(지점 사업자등록번호 등)</td>
              <td className={styles.val}></td>
            </tr>
            <tr>
              <td className={styles.lbl}>소 재 지</td>
              <td className={styles.val}>{info.address}</td>
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
                  {row && i === 0 ? `${receipt.year}.01.01~${receipt.year}.12.31` : ''}
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
              기부금 수령인&emsp;{info.name}
              {info.pastor && <>&emsp;담임목사 {info.pastor}</>}
            </span>
            <span className={styles.signHint}>(서명 또는 인)</span>
          </div>
          <div className={styles.footNote}>210mm×297mm[백상지 80g/㎡ 또는 중질지 80g/㎡]</div>
        </div>
      </div>
    </div>
  )
}
