import styles from './PageHeader.module.css'

// 모든 탭 페이지 상단에 공통으로 쓰이는 제목 영역 (교적 관리 페이지의 contentHeader와 동일 스타일)
export default function PageHeader({ title, actions }) {
  return (
    <div className={styles.pageHeader}>
      <h1>{title}</h1>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
