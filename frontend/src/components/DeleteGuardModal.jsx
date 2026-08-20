import { useState } from 'react'
import { settings as settingsApi } from '../api'
import toast from 'react-hot-toast'

/**
 * DeleteGuardModal — 앱 전체 삭제버튼 공통 확인 모달.
 * 관리 비밀번호(설정 > 상세정보 열람 암호키, 기본값 0000)를 입력해야 삭제가 진행된다.
 * useDeleteGuard 훅과 함께 사용.
 *
 * Props:
 *   open        boolean
 *   onClose     fn
 *   onConfirmed fn   비밀번호 확인 성공 시 호출(실제 삭제 수행)
 *   message     string  확인 문구 (기본: "정말 삭제하시겠습니까?")
 */
export default function DeleteGuardModal({ open, onClose, onConfirmed, message = '정말 삭제하시겠습니까?' }) {
  const [pin, setPin]         = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleClose = () => { setPin(''); onClose() }

  const handleConfirm = async () => {
    if (!pin.trim()) { toast.error('관리 비밀번호를 입력하세요.'); return }
    setLoading(true)
    try {
      await settingsApi.verifyDeletePin(pin)
      setPin('')
      await onConfirmed()
    } catch (err) {
      if (err?.response?.status === 403) toast.error('비밀번호가 올바르지 않습니다.')
      else toast.error('확인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) handleClose() }}>
      <div style={modalStyle}>
        <div style={headStyle}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>🔒 삭제 확인</span>
          <button onClick={handleClose} style={closeBtnStyle}>×</button>
        </div>

        <div style={bodyStyle}>
          <p style={{ fontSize: '0.88rem', color: '#475569', margin: 0 }}>{message}</p>
          <div>
            <label style={labelStyle}>관리 비밀번호</label>
            <input
              type="password"
              autoFocus
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
              placeholder="비밀번호 입력"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={footStyle}>
          <button onClick={handleClose} style={cancelBtnStyle}>취소</button>
          <button onClick={handleConfirm} disabled={loading} style={dangerBtnStyle}>
            {loading ? '확인 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlayStyle = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.45)',
  zIndex: 10000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const modalStyle = {
  background: '#fff',
  borderRadius: 16,
  width: 360,
  maxWidth: 'calc(100vw - 32px)',
  boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
}
const headStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '14px 20px',
  borderBottom: '1px solid #e2e8f0',
}
const closeBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: '1.4rem', color: '#94a3b8', lineHeight: 1, padding: '2px 6px',
}
const bodyStyle = {
  padding: '20px',
  display: 'flex', flexDirection: 'column', gap: 14,
}
const labelStyle = {
  display: 'block', fontSize: '0.82rem', color: '#475569',
  fontWeight: 500, marginBottom: 4,
}
const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #e2e8f0', borderRadius: 8,
  padding: '8px 12px', fontSize: '0.9rem',
  outline: 'none', fontFamily: 'inherit',
}
const footStyle = {
  display: 'flex', justifyContent: 'flex-end', gap: 8,
  padding: '14px 20px',
  borderTop: '1px solid #e2e8f0',
}
const cancelBtnStyle = {
  background: '#fff', color: '#475569',
  border: '1px solid #e2e8f0', borderRadius: 8,
  padding: '8px 16px', fontSize: '0.875rem', cursor: 'pointer',
}
const dangerBtnStyle = {
  background: '#ef4444', color: '#fff',
  border: 'none', borderRadius: 8,
  padding: '8px 20px', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600,
}
