import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { auth as authApi } from '../../api'
import styles from './Login.module.css'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  const handleCredential = useCallback(async ({ credential }) => {
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
    }
  }, [login, navigate])

  // 전역 콜백 등록 (GIS 선언적 방식에서 필요)
  useEffect(() => {
    window.__churchGoogleCallback = handleCredential
    return () => { delete window.__churchGoogleCallback }
  }, [handleCredential])

  // GIS SDK 로드 후 버튼 렌더링
  useEffect(() => {
    if (!CLIENT_ID) return

    const renderBtn = () => {
      const container = document.getElementById('google-signin-btn')
      if (!container) return
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredential,
        auto_select: false,
      })
      window.google.accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 280,
      })
    }

    if (window.google?.accounts?.id) {
      renderBtn()
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval)
          renderBtn()
        }
      }, 100)
      return () => clearInterval(interval)
    }
  }, [handleCredential])

  if (!CLIENT_ID) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo}>⛪</div>
          <h1 className={styles.title}>교회 관리 시스템</h1>
          <div className={styles.errorBox}>
            <p>⚠️ <strong>VITE_GOOGLE_CLIENT_ID</strong> 환경변수가 설정되지 않았습니다.</p>
            <p>Vercel 환경변수에 아래를 추가하고 재배포하세요:</p>
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
        <div id="google-signin-btn" className={styles.googleBtnWrap} />
        <p className={styles.notice}>시스템에 등록된 계정만 접근 가능합니다.</p>
      </div>
    </div>
  )
}
