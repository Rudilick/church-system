import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { auth as authApi } from '../../api'
import styles from './Login.module.css'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const btnRef = useRef(null)
  const [loading, setLoading] = useState(false)

  // 이미 로그인된 경우 바로 대시보드로
  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      console.error('VITE_GOOGLE_CLIENT_ID 환경변수가 설정되지 않았습니다.')
      return
    }

    const init = () => {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        auto_select: false,
      })
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: 'outline',
        size: 'large',
        width: 280,
        locale: 'ko',
      })
    }

    if (window.google?.accounts?.id) {
      init()
    } else {
      // GIS SDK 로드 대기
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(timer)
          init()
        }
      }, 100)
      return () => clearInterval(timer)
    }
  }, [])

  async function handleCredential({ credential }) {
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
          <div ref={btnRef} className={styles.googleBtn} />
        )}
        <p className={styles.notice}>
          시스템에 등록된 계정만 접근 가능합니다.
        </p>
      </div>
    </div>
  )
}
