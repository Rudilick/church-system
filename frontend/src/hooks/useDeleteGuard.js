import { useState, useCallback } from 'react'

// 삭제버튼 공통 가드 — 실제 삭제 동작을 감싸서 관리 비밀번호 확인 모달을 먼저 띄운다.
// 사용법:
//   const guard = useDeleteGuard()
//   const handleDelete = (id) => guard.request(async () => { await api.remove(id); ... })
//   <DeleteGuardModal {...guard.modalProps} />
export function useDeleteGuard() {
  const [action, setAction] = useState(null)

  const request = useCallback((fn) => setAction(() => fn), [])
  const close   = useCallback(() => setAction(null), [])
  const run     = useCallback(async () => {
    if (!action) return
    await action()
    setAction(null)
  }, [action])

  return {
    open: !!action,
    request,
    modalProps: { open: !!action, onClose: close, onConfirmed: run },
  }
}
