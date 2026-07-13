import { useEffect, useRef, useState } from 'react'
import { sms as smsApi, kakaoTemplates as kakaoTemplatesApi, communities as communityApi, departments as deptApi, members as memberApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import SmsSendModal from '../../components/SmsSendModal'
import { displayPosition } from '../../utils'
import styles from './SMS.module.css'
import PageShell from '../../components/PageShell'

const BYTE_SMS_LIMIT = 90
function byteLength(str) { return new TextEncoder().encode(str).length }
function msgType(msg)    { return byteLength(msg) > BYTE_SMS_LIMIT ? 'LMS' : 'SMS' }

function targetLabel(t) {
  return { all: '전체', community: '공동체', department: '부서', individual: '개별' }[t] ?? t
}

// 템플릿 원문의 #{변수} 자리를 입력값으로 치환한 미리보기 텍스트 생성
function renderTemplatePreview(template, vars) {
  if (!template) return ''
  return (template.variables ?? []).reduce(
    (text, v) => text.split(v).join(v === '#{이름}' ? '(수신자 이름 자동 입력)' : (vars[v]?.trim() || v)),
    template.content
  )
}

export default function SMS() {
  const { user } = useAuth()

  const [logs, setLogs]             = useState([])
  const [targetType, setTargetType] = useState('all')
  const [targetId, setTargetId]     = useState('')
  const [message, setMessage]       = useState('')
  const [communities, setCommunities] = useState([])
  const [departments, setDepartments] = useState([])

  // 발송 채널 (문자 / 카카오 알림톡)
  const [channel, setChannel]                 = useState('SMS')
  const [templates, setTemplates]             = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateVars, setTemplateVars]       = useState({})
  const [disableFallback, setDisableFallback] = useState(false)

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
    kakaoTemplatesApi.list().then(r => setTemplates(r.data)).catch(() => {})
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

  const selectedTemplate = templates.find(t => String(t.id) === String(selectedTemplateId))

  const handleTemplateChange = (id) => {
    setSelectedTemplateId(id)
    setTemplateVars({})
  }

  const handleOpenModal = () => {
    if (targetType === 'individual' && recipientsMap.size === 0) {
      toast.error('수신 교인을 선택하세요.')
      return
    }
    if (channel === 'ALIMTALK') {
      if (!selectedTemplate) { toast.error('알림톡 템플릿을 선택하세요.'); return }
      const required = (selectedTemplate.variables ?? []).filter(v => v !== '#{이름}')
      const missing = required.filter(v => !templateVars[v]?.trim())
      if (missing.length > 0) { toast.error(`다음 항목을 입력하세요: ${missing.join(', ')}`); return }
    } else if (!message.trim()) {
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
  const alimtalkPreview = renderTemplatePreview(selectedTemplate, templateVars)

  return (
    <PageShell title="단체 문자 발송">
      <div className={styles.content}>
        {/* ── 발송 폼 ── */}
        <div className={styles.formCard}>
          <div className={styles.formGrid}>
            {/* 발송 채널 + 대상 선택 행 */}
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>발송 채널</label>
                <select value={channel} onChange={e => setChannel(e.target.value)}>
                  <option value="SMS">문자 (SMS/LMS)</option>
                  <option value="ALIMTALK">카카오 알림톡</option>
                </select>
              </div>

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

            {/* 메시지 입력 (문자) */}
            {channel === 'SMS' && (
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
            )}

            {/* 템플릿 선택 (카카오 알림톡) — 자유 텍스트가 아니라 승인된 템플릿만 발송 가능 */}
            {channel === 'ALIMTALK' && (
              <div className={styles.formGroup}>
                <label>알림톡 템플릿</label>
                <select value={selectedTemplateId} onChange={e => handleTemplateChange(e.target.value)}>
                  <option value="">템플릿 선택</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>

                {templates.length === 0 && (
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 6 }}>
                    등록된 템플릿이 없습니다. 솔라피 콘솔에서 승인받은 템플릿을 관리자에게 등록 요청하세요.
                  </div>
                )}

                {selectedTemplate && (
                  <>
                    <div style={{ marginTop: 10, padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: '0.85rem', color: '#334155', whiteSpace: 'pre-wrap' }}>
                      {alimtalkPreview}
                    </div>
                    {(selectedTemplate.variables ?? []).filter(v => v !== '#{이름}').map(v => (
                      <div key={v} style={{ marginTop: 8 }}>
                        <label style={{ fontSize: '0.8rem', color: '#475569', display: 'block', marginBottom: 4 }}>{v}</label>
                        <input
                          value={templateVars[v] ?? ''}
                          onChange={e => setTemplateVars(prev => ({ ...prev, [v]: e.target.value }))}
                          placeholder={`${v} 값 입력`}
                          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: '0.85rem' }}
                        />
                      </div>
                    ))}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: '0.82rem', color: '#475569' }}>
                      <input type="checkbox" checked={!disableFallback} onChange={e => setDisableFallback(!e.target.checked)} />
                      카카오톡 발송 실패 시 문자(SMS)로 자동 대체발송
                    </label>
                  </>
                )}
              </div>
            )}

            <div className={styles.infoBox}>
              {channel === 'ALIMTALK'
                ? '💬 솔라피(solapi.com) 연동 · 카카오 알림톡은 승인된 템플릿만 발송 가능합니다.'
                : '📱 솔라피(solapi.com) 연동 · 환경변수 미설정 시 로그만 저장됩니다.'}
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
                  <td>{l.channel === 'ALIMTALK' ? '카카오 알림톡' : (l.msg_type ?? 'SMS')}</td>
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
        channel={channel}
        templateId={selectedTemplateId || undefined}
        previewText={alimtalkPreview}
        variables={templateVars}
        disableFallback={disableFallback}
        onSent={() => {
          setModalOpen(false)
          setMessage('')
          setRecipientsMap(new Map())
          setSelectedTemplateId('')
          setTemplateVars({})
          loadLogs()
        }}
      />
    </PageShell>
  )
}
