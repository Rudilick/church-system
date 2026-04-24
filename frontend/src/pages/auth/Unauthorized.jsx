import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import styles from './Unauthorized.module.css'

export default function Unauthorized() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()

  const googleInfo = state?.googleInfo ?? {}
  const reason = state?.reason

  function handleSwitchAccount() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.icon}>🔒</div>
        <h1 className={styles.title}>접근 권한 없음</h1>

        {reason === 'INACTIVE' ? (
          <p className={styles.message}>
            이 계정은 현재 <strong>비활성화</strong>된 상태입니다.<br />
            관리자에게 활성화를 요청하세요.
          </p>
        ) : (
          <p className={styles.message}>
            이 Google 계정은 시스템에 <strong>등록되지 않은</strong> 계정입니다.<br />
            관리자에게 권한 등록을 요청하세요.
          </p>
        )}

        {googleInfo.email && (
          <div className={styles.userInfo}>
            {googleInfo.picture && (
              <img src={googleInfo.picture} alt="" className={styles.avatar} />
            )}
            <div className={styles.userDetails}>
              <span className={styles.userName}>{googleInfo.name}</span>
              <span className={styles.userEmail}>{googleInfo.email}</span>
              {googleInfo.sub && (
                <span className={styles.userSub}>Google ID: {googleInfo.sub}</span>
              )}
            </div>
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.switchBtn} onClick={handleSwitchAccount}>
            다른 계정으로 로그인
          </button>
        </div>
      </div>
    </div>
  )
}
