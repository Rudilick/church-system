import { useState } from 'react'
import SystemFeedbackModal from './SystemFeedbackModal'

/**
 * SystemFeedbackButton — 모든 화면 한 구석에 항상 떠 있는 "시스템개선" 버튼
 */
export default function SystemFeedbackButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={btnStyle}
        title="시스템 개선사항 제안"
      >
        🛠
      </button>
      <SystemFeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

const btnStyle = {
  position: 'fixed',
  right: 18,
  bottom: 18,
  width: 44,
  height: 44,
  borderRadius: '50%',
  background: '#3b82f6',
  color: '#fff',
  border: 'none',
  boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
  fontSize: '1.15rem',
  cursor: 'pointer',
  zIndex: 9998,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
