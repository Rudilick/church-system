import { useEffect, useRef, useState } from 'react'
import { sms as smsApi, communities as communityApi, departments as deptApi, members as memberApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import SmsSendModal from '../../components/SmsSendModal'
import { displayPosition } from '../../utils'
import styles from './SMS.module.css'
import PageHeader from '../../components/PageHeader'

const BYTE_SMS_LIMIT = 90
function byteLength(str) { return new TextEncoder().encode(str).length }
function msgType(msg)    { return byteLength(msg) > BYTE_SMS_LIMIT ? 'LMS' : 'SMS' }

function targetLabel(t) {
  return { all: '전체', community: '공동체', department: '부서', individual: '개별' }[t] ?? t
}

export default function SMS() {
  const { user } = useAuth()

  const [logs, setLogs]             = useState([])
  const [targetType, setTargetType] = useState('all')
  const [targetId, setTargetId]     = useState('')
  const [message, setMessage]       = useState('')
  const [communities, setCommunities] = useState([])
  const [departments, setDepartments] = useState([])

  // 개별 선택 상태
  const [recipientsMap, setRecipientsMap] = useState(new Map())  // id → {id,name,phone}
  const [searchQ, setSearchQ]             = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchTimerRef = useRef(null)

  // 모달 상태
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    loadLogs()
    communityApi.list().then(r => setCommunities(r.data)).catch(() => {})
    deptApi.list().then(r => setDepartments(r.data)).catch(() => {})
  }, [])

  const loadLogs = () => {
    smsApi.logs().then(r => setLogs(r.data)).catch(() => {})
  }

  // 개별 교인 검색 (디바운스)
  useEffect(() => {
    if (targetType !== 'individual') return
    clearTimeout(searchTimerRef.current)
    if (!searchQ.trim()) { setSearchResults([]); return }
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const r = await memberApi.list({ q: searchQ, type: 'active', limit: 20, name_only: 1 })
        setSearchResults(r.data.data ?? [])
      } catch { setSearchResults([]) }
      finally { setSearchLoading(false) }
    }, 300)
  }, [searchQ, targetType])

  const addRecipient = (m) => {
    if (!m.phone) { toast.error(`${m.name}: 전화번호 없음`); return }
    setRecipientsMap(prev => new Map(prev).set(m.id, { id: m.id, name: m.name, phone: m.phone }))
    setSearchQ('')
    setSearchResults([])
  }

  const removeRecipient = (id) => {
    setRecipientsMap(prev => { const n = new Map(prev); n.delete(id); return n })
  }

  const handleTargetTypeChange = (t) => {
    setTargetType(t)
    setTargetId('')
    setRecipientsMap(new Map())
    setSearchQ('')
    setSearchResults([])
  }

  const handleOpenModal = () => {
    if (targetType === 'individual' && recipientsMap.size === 0) {
      toast.error('수신 교인을 선택하세요.')
      return
    }
    if (!message.trim()) {
      toast.error('메시지를 입력하세요.')
      return
    }
    setModalOpen(true)
  }

  const recipients = targetType === 'individual'
    ? Array.from(recipientsMap.values())
    : undefined

  const type = msgType(message)
  const byteLen = byteLength(message)

  return (
    <div className={styles.pageWrap}>
      <PageHeader title="단체 문자 발송" />
      <div className={styles.content}>
        {/* ── 발송 폼 ── */}
        <div className={styles.formCard}>
          <div className={styles.formGrid}>
            {/* 대상 선택 행 */}
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>발송 대상</label>
                <select value={targetType} onChange={e => handleTargetTypeChange(e.target.value)}>
                  <option value="all">전체 교인</option>
                  <option value="community">공동체별</option>
                  <option value="department">부서별</option>
                  <option value="individual">개별 선택</option>
                </select>
              </div>

              {targetType === 'community' && (
                <div className={styles.formGroup}>
                  <label>공동체 선택</label>
                  <select value={targetId} onChange={e => setTargetId(e.target.value)}>
                    <option value="">선택</option>
                    {communities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === 'department' && (
                <div className={styles.formGroup}>
                  <label>부서 선택</label>
                  <select value={targetId} onChange={e => setTargetId(e.target.value)}>
                    <option value="">선택</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 개별 교인 선택 */}
            {targetType === 'individual' && (
              <div className={styles.recipientSection}>
                <label style={{ fontSize: '0.82rem', fontWeight: 500, color: '#475569' }}>
                  수신 교인 선택 ({recipientsMap.size}명)
                </label>
                <div className={styles.recipientSearch}>
                  <input
                    placeholder="이름으로 검색..."
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    autoComplete="off"
                  />
                  {searchResults.length > 0 && (
                    <ul className={styles.suggestList}>
                      {searchResults.map(m => (
                        <li
                          key={m.id}
                          className={styles.suggestItem}
                          onMouseDown={() => addRecipient(m)}
                        >
                          <span>{m.name}</span>
                          <span className={styles.suggestMeta}>
                            {displayPosition(m) || ''} {m.phone || '번호없음'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {searchLoading && (
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '4px 0' }}>
                      검색 중...
                    </div>
                  )}
                </div>
                <div className={styles.pillList}>
                  {recipientsMap.size === 0
                    ? <span className={styles.pillEmpty}>이름을 검색해 수신자를 추가하세요</span>
                    : Array.from(recipientsMap.values()).map(r => (
                        <span key={r.id} className={styles.pill}>
                          {r.name}
                          <button className={styles.pillRemove} onClick={() => removeRecipient(r.id)}>×</button>
                        </span>
                      ))
                  }
                </div>
              </div>
            )}

            {/* 메시지 입력 */}
            <div className={styles.formGroup}>
              <label>메시지 내용</label>
              <textarea
                rows={5}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="발송할 문자 내용을 입력하세요."
                style={{ resize: 'vertical' }}
              />
              <div className={styles.charCount}>
                <span>{message.length}자 / {byteLen}bytes</span>
                <span className={type === 'LMS' ? styles.msgTypeLms : styles.msgTypeSms}>
                  {type}
                </span>
              </div>
            </div>

            <div className={styles.infoBox}>
              📱 문자나라(munjanara.co.kr) 연동 · 환경변수 미설정 시 로그만 저장됩니다.
            </div>

            <button
              type="button"
              className={styles.btnSend}
              onClick={handleOpenModal}
            >
              발송
            </button>
          </div>
        </div>

        {/* ── 발송 이력 ── */}
        <h2 className={styles.sectionTitle}>발송 이력</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {['발송일시', '발송자', '대상', '수신자수', '종류', '내용'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td>{dayjs(l.sent_at).format('MM/DD HH:mm')}</td>
                  <td>{l.sender_name ?? '-'}</td>
                  <td>{targetLabel(l.target_type)}</td>
                  <td>{l.recipient_count}명</td>
                  <td>{l.msg_type ?? 'SMS'}</td>
                  <td className={styles.msgCell}>{l.message}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.empty}>발송 이력 없음</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 발송 확인 모달 ── */}
      <SmsSendModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        targetType={targetType}
        targetId={targetId || undefined}
        recipients={recipients}
        message={message}
        onSent={() => {
          setModalOpen(false)
          setMessage('')
          setRecipientsMap(new Map())
          loadLogs()
        }}
      />
    </div>
  )
}
