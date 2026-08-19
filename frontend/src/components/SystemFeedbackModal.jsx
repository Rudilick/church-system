import { useEffect, useState } from 'react'
import { feedback as feedbackApi } from '../api'
import toast from 'react-hot-toast'

/**
 * SystemFeedbackModal — 어느 화면에서나 뜨는 "시스템개선" 버튼의 모달
 *
 * Props:
 *   open      boolean
 *   onClose   fn
 */
export default function SystemFeedbackModal({ open, onClose }) {
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [content, setContent]     = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [capturing, setCapturing] = useState(false)
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    feedbackApi.list()
      .then(r => setItems(r.data))
      .catch(() => toast.error('목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [open])

  const handleCapture = async () => {
    setCapturing(true)
    // 모달이 실제로 화면에서 사라질 시간을 준다 (아래 렌더링에서 capturing=true면 overlay를 display:none 처리)
    await new Promise(r => setTimeout(r, 150))
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(document.body, { useCORS: true, scale: 1 })
      setScreenshot(canvas.toDataURL('image/png'))
    } catch {
      toast.error('화면 캡쳐에 실패했습니다.')
    } finally {
      setCapturing(false)
    }
  }

  const handleSave = async () => {
    if (!content.trim()) { toast.error('개선할 내용을 입력하세요.'); return }
    setSaving(true)
    try {
      const r = await feedbackApi.add({ content: content.trim(), screenshot })
      setItems(prev => [r.data, ...prev])
      setContent('')
      setScreenshot(null)
      toast.success('저장되었습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      style={{ ...overlayStyle, display: capturing ? 'none' : 'flex' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={modalStyle}>
        <div style={headStyle}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>🛠 시스템 개선사항</span>
          <button onClick={onClose} style={closeBtnStyle}>×</button>
        </div>

        <div style={bodyStyle}>
          {loading ? (
            <div style={emptyStyle}>불러오는 중...</div>
          ) : items.length === 0 ? (
            <div style={emptyStyle}>등록된 개선사항이 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(item => (
                <div key={item.id} style={itemCardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>{item.user_name ?? '알 수 없음'}</span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{new Date(item.created_at).toLocaleString('ko-KR')}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#1e293b', whiteSpace: 'pre-wrap', marginTop: 4 }}>{item.content}</div>
                  {item.screenshot && (
                    <img
                      src={item.screenshot}
                      alt="캡쳐 이미지"
                      style={thumbStyle}
                      onClick={() => window.open(item.screenshot, '_blank')}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={composeStyle}>
          <textarea
            rows={3}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="개선하고 싶은 내용을 입력하세요."
            style={textareaStyle}
          />

          {screenshot && (
            <div style={previewWrapStyle}>
              <img src={screenshot} alt="캡쳐 미리보기" style={previewImgStyle} />
              <button onClick={() => setScreenshot(null)} style={removeThumbBtnStyle}>제거</button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <button
              onClick={handleCapture}
              disabled={capturing}
              style={captureBtnStyle}
            >
              {capturing ? '캡쳐 중...' : '📷 화면 캡쳐'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !content.trim()}
              style={{
                ...saveBtnStyle,
                opacity: (saving || !content.trim()) ? 0.5 : 1,
                cursor: (saving || !content.trim()) ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 인라인 스타일 (기존 모달 디자인 시스템에 맞춤) ──
const overlayStyle = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.45)',
  zIndex: 9999,
  alignItems: 'center', justifyContent: 'center',
}
const modalStyle = {
  background: '#fff',
  borderRadius: 16,
  width: 520,
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
  padding: '16px 20px',
  overflowY: 'auto',
  flex: 1,
  minHeight: 100,
}
const emptyStyle = {
  color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0',
}
const itemCardStyle = {
  padding: 12,
  background: '#f8fafc',
  borderRadius: 8,
  border: '1px solid #e2e8f0',
}
const thumbStyle = {
  marginTop: 8, maxWidth: '100%', maxHeight: 140,
  borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'zoom-in', display: 'block',
}
const composeStyle = {
  padding: '14px 20px',
  borderTop: '1px solid #e2e8f0',
  flexShrink: 0,
  display: 'flex', flexDirection: 'column', gap: 8,
}
const textareaStyle = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #e2e8f0', borderRadius: 8,
  padding: '8px 12px', fontSize: '0.875rem',
  resize: 'vertical', outline: 'none', fontFamily: 'inherit',
  lineHeight: 1.6,
}
const previewWrapStyle = {
  position: 'relative', display: 'inline-block', alignSelf: 'flex-start',
}
const previewImgStyle = {
  maxWidth: 160, maxHeight: 100, borderRadius: 6, border: '1px solid #e2e8f0', display: 'block',
}
const removeThumbBtnStyle = {
  position: 'absolute', top: 4, right: 4,
  background: 'rgba(15,23,42,0.7)', color: '#fff',
  border: 'none', borderRadius: 4,
  padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer',
}
const captureBtnStyle = {
  background: '#fff', color: '#475569',
  border: '1px solid #e2e8f0', borderRadius: 8,
  padding: '8px 14px', fontSize: '0.82rem', cursor: 'pointer',
}
const saveBtnStyle = {
  background: '#3b82f6', color: '#fff',
  border: 'none', borderRadius: 8,
  padding: '8px 20px', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600,
}
