import PageHeader from './PageHeader'
import styles from './PageShell.module.css'

// 모든 탭 페이지의 최상위 구조 — pageWrap(천장 고정) + PageHeader + 본문
export default function PageShell({ title, actions, children }) {
  return (
    <div className={styles.pageWrap}>
      <PageHeader title={title} actions={actions} />
      {children}
    </div>
  )
}
