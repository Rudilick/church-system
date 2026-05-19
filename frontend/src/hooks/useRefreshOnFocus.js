import { useEffect } from 'react'

export function useRefreshOnFocus(fn) {
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fn()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fn])
}
