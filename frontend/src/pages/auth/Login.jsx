import { useEffect, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { auth as authApi } from '../../api'
import styles from './Login.module.css'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [sdkReady, setSdkReady] = useState(false)
  const [loading, setLoading] = useState(false)

  // 이미 로그인된 경우 바로 대시보드로
  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  const handleCredential = useCallback(async ({ credential }) => {
    setLoading(true)
    try {
      const res = await authApi.googleLogin(credential)
      login(res.data.token)
      navigate('/', { replace: true })
    } catch (err) {
      const data = err.response?.data
      if (data?.error === 'NOT_REGISTERED' || data?.error === 'INACTIVE') {
        navigate('/unauthorized', { state: { googleInfo: data.googleInfo, reason: data.error } })
      } else {
        toast.error('로그인에 실패했습니다. 다시 시도해주세요.')
      }
    } finally {
      setLoading(false)
    }
  }, [login, navigate])

  // GIS SDK 로드 및 초기화
  useEffect(() => {
    if (!CLIENT_ID) return

    const initGIS = () => {
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      })
      setSdkReady(true)
    }

    if (window.google?.accounts?.id) {
      initGIS()
    } else {
      const script = document.querySelector('script[src*="accounts.google.com/gsi/client"]')
      if (script) {
        script.addEventListener('load', initGIS)
        return () => script.removeEventListener('load', initGIS)
      }
      // 폴링 fallback
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(timer)
          initGIS()
        }
      }, 200)
      return () => clearInterval(timer)
    }
  }, [handleCredential])

  function handleClick() {
    if (!window.google?.accounts?.id) {
      toast.error('Google SDK 로딩 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }
    window.google.accounts.id.prompt((notification) => {
      // One Tap이 표시되지 않는 경우 (팝업 차단 등) → OAuth 팝업 fallback
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: 'openid email profile',
          callback: () => {},
        })
        // id token flow — prompt 재시도
        window.google.accounts.id.prompt()
      }
    })
  }

  if (!CLIENT_ID) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo}>⛪</div>
          <h1 className={styles.title}>교회 관리 시스템</h1>
          <div className={styles.errorBox}>
            <p>⚠️ <strong>VITE_GOOGLE_CLIENT_ID</strong> 환경변수가 설정되지 않았습니다.</p>
            <p>프론트엔드 <code>.env</code> 파일에 아래를 추가하세요:</p>
            <code>VITE_GOOGLE_CLIENT_ID=your_client_id</code>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>⛪</div>
        <h1 className={styles.title}>교회 관리 시스템</h1>
        <p className={styles.sub}>Google 계정으로 로그인하세요</p>

        {loading ? (
          <div className={styles.loading}>로그인 중...</div>
        ) : (
          <button
            className={styles.googleBtn}
            onClick={handleClick}
            disabled={!sdkReady}
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt="Google"
              className={styles.googleIcon}
            />
            {sdkReady ? 'Google로 로그인' : 'Google SDK 로딩 중...'}
          </button>
        )}

        <p className={styles.notice}>시스템에 등록된 계정만 접근 가능합니다.</p>
      </div>
    </div>
  )
}
