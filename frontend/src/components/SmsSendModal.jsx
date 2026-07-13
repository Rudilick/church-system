import { useEffect, useState, useRef } from 'react'
import { sms as smsApi } from '../api'
import toast from 'react-hot-toast'

const BYTE_SMS_LIMIT = 90  // 90바이트 초과 시 LMS (국내 통신 표준)

function byteLength(str) {
  return new TextEncoder().encode(str).length
}

function msgType(message) {
  return byteLength(message) > BYTE_SMS_LIMIT ? 'LMS' : 'SMS'
}

/**
 * SmsSendModal — SMS/MemberList 양쪽에서 재사용
 *
 * Props:
 *   open          boolean
 *   onClose       fn
 *   targetType    'all' | 'community' | 'department' | 'individual'
 *   targetId      number | undefined  (community/department 모드 시)
 *   recipients    Array<{id, name, phone}> | undefined  (individual 모드 시)
 *   message       string  (초기 메시지값, channel='SMS'일 때 사용)
 *   channel       'SMS' | 'ALIMTALK'  (기본 'SMS')
 *   templateId    number | undefined  (channel='ALIMTALK'일 때 필수)
 *   previewText   string  (channel='ALIMTALK'일 때 표시할 렌더링된 미리보기 텍스트, 편집 불가)
 *   variables     Record<string,string>  (channel='ALIMTALK'일 때 템플릿 변수값)
 *   disableFallback boolean  (channel='ALIMTALK'일 때 카카오 실패해도 SMS 대체발송 안 함)
 *   onSent        fn({ log, recipient_count, excluded_count, api_ok })
 */
export default function SmsSendModal({
  open,
  onClose,
  targetType = 'all',
  targetId,
  recipients,
  message: initialMessage = '',
  channel = 'SMS',
  templateId,
  previewText = '',
  variables,
  disableFallback = false,
  onSent,
}) {
  const [step, setStep]         = useState('confirm')   // 'confirm' | 'result'
  const [message, setMessage]   = useState(initialMessage)
  const [preview, setPreview]   = useState(null)        // { total, excluded, phones }
  const [loading, setLoading]   = useState(false)
  const [sending, setSending]   = useState(false)
  const [result, setResult]     = useState(null)
  const textareaRef             = useRef(null)

  // 모달 열릴 때마다 초기화
  useEffect(() => {
    if (!open) return
    setStep('confirm')
    setMessage(initialMessage)
    setResult(null)
    setPreview(null)

    // preview 조회
    const params = { target_type: targetType }
    if (targetId)   params.target_id   = targetId
    if (recipients) params.member_ids  = JSON.stringify(recipients.map(r => r.id))

    setLoading(true)
    smsApi.preview(params)
      .then(r => setPreview(r.data))
      .catch(() => setPreview({ total: '?', excluded: 0, phones: [] }))
      .finally(() => setLoading(false))
  }, [open])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async () => {
    if (channel === 'ALIMTALK') {
      if (!templateId) { toast.error('템플릿을 선택하세요.'); return }
    } else if (!message.trim()) {
      toast.error('메시지를 입력하세요.')
      return
    }
    setSending(true)
    try {
      const payload = channel === 'ALIMTALK'
        ? { target_type: targetType, channel, template_id: templateId, variables, disable_fallback: disableFallback }
        : { target_type: targetType, channel, message }
      if (targetId)   payload.target_id   = targetId
      if (recipients) payload.member_ids  = recipients.map(r => r.id)

      const r = await smsApi.send(payload)
      setResult(r.data)
      setStep('result')
      onSent?.(r.data)
      if (r.data.api_ok) {
        toast.success(`${r.data.recipient_count}명에게 발송 완료`)
      } else {
        toast(`${r.data.recipient_count}명 대상 처리 (${r.data.api_message})`, { icon: '⚠️' })
      }
    } catch {
      toast.error('발송 요청 실패')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  const type = msgType(message)
  const byteLen = byteLength(message)

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalStyle}>
        {/* 헤더 */}
        <div style={headStyle}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            {step === 'confirm' ? '문자 발송 확인' : '발송 결과'}
          </span>
          <button onClick={onClose} style={closeBtnStyle}>×</button>
        </div>

        {/* 본문 */}
        <div style={bodyStyle}>
          {step === 'confirm' && (
            <>
              {/* 수신자 요약 */}
              <div style={summaryBoxStyle}>
                {loading ? (
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>수신자 확인 중...</span>
                ) : preview ? (
                  <>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                      총 <span style={{ color: '#3b82f6' }}>{preview.total}명</span>에게 발송합니다.
                    </div>
                    {preview.excluded > 0 && (
                      <div style={{ fontSize: '0.82rem', color: '#f59e0b', marginTop: 4 }}>
                        ⚠️ 수신 거부 {preview.excluded}명은 제외됩니다.
                      </div>
                    )}
                    {preview.total === 0 && (
                      <div style={{ fontSize: '0.82rem', color: '#ef4444', marginTop: 4 }}>
                        발송 가능한 수신자가 없습니다.
                      </div>
                    )}
                  </>
                ) : null}
              </div>

              {/* 메시지 입력 (문자) / 미리보기 (카카오 알림톡 — 승인된 문구라 자유편집 불가) */}
              {channel === 'ALIMTALK' ? (
                <div>
                  <label style={labelStyle}>알림톡 내용 (승인된 템플릿, 수정 불가)</label>
                  <div style={{ ...textareaStyle, whiteSpace: 'pre-wrap', minHeight: 100, background: '#f8fafc' }}>
                    {previewText}
                  </div>
                </div>
              ) : (
                <div>
                  <label style={labelStyle}>메시지 내용</label>
                  <textarea
                    ref={textareaRef}
                    rows={6}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="발송할 문자 내용을 입력하세요."
                    style={textareaStyle}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>
                    <span>{message.length}자 / {byteLen}bytes</span>
                    <span style={{
                      fontWeight: 600,
                      color: type === 'LMS' ? '#f59e0b' : '#22c55e',
                    }}>{type}</span>
                  </div>
                </div>
              )}

              {/* 발신번호 안내 */}
              <div style={infoBoxStyle}>
                {channel === 'ALIMTALK'
                  ? '💬 솔라피(solapi.com) 연동 발송 · 승인된 템플릿만 발송 가능합니다.'
                  : '📱 솔라피(solapi.com) 연동 발송 · 환경변수 미설정 시 로그만 저장됩니다.'}
              </div>
            </>
          )}

          {step === 'result' && result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                padding: '16px',
                borderRadius: 8,
                background: result.api_ok ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${result.api_ok ? '#bbf7d0' : '#fde68a'}`,
              }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: result.api_ok ? '#166534' : '#92400e' }}>
                  {result.api_ok ? '✅ 발송 완료' : '⚠️ 발송 처리됨'}
                </div>
                <div style={{ fontSize: '0.85rem', marginTop: 8, color: '#475569' }}>
                  {result.api_message}
                </div>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>· 발송 대상: {result.recipient_count}명</span>
                {result.excluded_count > 0 && (
                  <span>· 수신 거부로 제외: {result.excluded_count}명</span>
                )}
                <span>· 메시지 종류: {result.log?.channel === 'ALIMTALK' ? '카카오 알림톡' : (result.log?.msg_type ?? '-')}</span>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div style={footStyle}>
          {step === 'confirm' && (
            <>
              <button onClick={onClose} style={cancelBtnStyle}>취소</button>
              <button
                onClick={handleSend}
                disabled={sending || loading || preview?.total === 0}
                style={{
                  ...sendBtnStyle,
                  opacity: (sending || loading || preview?.total === 0) ? 0.5 : 1,
                  cursor: (sending || loading || preview?.total === 0) ? 'not-allowed' : 'pointer',
                }}
              >
                {sending ? '발송 중...' : `발송 (${preview?.total ?? '?'}명)`}
              </button>
            </>
          )}
          {step === 'result' && (
            <button onClick={onClose} style={sendBtnStyle}>닫기</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 인라인 스타일 (기존 앱의 카드/모달 디자인 시스템에 맞춤) ──
const overlayStyle = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.45)',
  zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const modalStyle = {
  background: '#fff',
  borderRadius: 16,
  width: 480,
  maxWidth: 'calc(100vw - 32px)',
  maxHeight: 'calc(100vh - 64px)',
  boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
}
const headStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '14px 20px',
  borderBottom: '1px solid #e2e8f0',
  flexShrink: 0,
}
const closeBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: '1.4rem', color: '#94a3b8', lineHeight: 1, padding: '2px 6px',
}
const bodyStyle = {
  padding: '20px',
  overflowY: 'auto',
  display: 'flex', flexDirection: 'column', gap: 16,
  flex: 1,
}
const footStyle = {
  display: 'flex', justifyContent: 'flex-end', gap: 8,
  padding: '14px 20px',
  borderTop: '1px solid #e2e8f0',
  flexShrink: 0,
}
const summaryBoxStyle = {
  padding: 14,
  background: '#f0f7ff',
  borderRadius: 8,
  border: '1px solid #bfdbfe',
}
const labelStyle = {
  display: 'block', fontSize: '0.82rem', color: '#475569',
  fontWeight: 500, marginBottom: 4,
}
const textareaStyle = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #e2e8f0', borderRadius: 8,
  padding: '8px 12px', fontSize: '0.875rem',
  resize: 'vertical', outline: 'none', fontFamily: 'inherit',
  lineHeight: 1.6,
}
const infoBoxStyle = {
  padding: 10, background: '#f0fdf4', borderRadius: 8,
  fontSize: '0.78rem', color: '#166534',
}
const cancelBtnStyle = {
  background: '#fff', color: '#475569',
  border: '1px solid #e2e8f0', borderRadius: 8,
  padding: '8px 16px', fontSize: '0.875rem', cursor: 'pointer',
}
const sendBtnStyle = {
  background: '#3b82f6', color: '#fff',
  border: 'none', borderRadius: 8,
  padding: '8px 20px', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600,
}
