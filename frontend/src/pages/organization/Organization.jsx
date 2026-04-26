import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { departments as deptApi } from '../../api'
import styles from './Organization.module.css'

function MemberChip({ m }) {
  return (
    <Link to={`/members/${m.id}`} className={styles.memberChip}>
      {m.photo_url
        ? <img src={m.photo_url} alt={m.name} className={styles.chipPhoto} />
        : <span className={styles.chipAvatar}>{m.name[0]}</span>
      }
      <span className={styles.chipName}>{m.name}</span>
      {m.job_title && <span className={styles.chipJob}>{m.job_title}</span>}
    </Link>
  )
}

function DeptCard({ dept, depth }) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = dept.children?.length > 0
  const hasMembers  = dept.members?.length > 0

  return (
    <div className={`${styles.deptCard} ${styles[`depth${Math.min(depth, 3)}`]}`}>
      <div className={styles.deptHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.deptToggle}>{hasChildren ? (open ? '▾' : '▸') : ''}</span>
        <span className={styles.deptName}>{dept.name}</span>
        {hasMembers && <span className={styles.deptCount}>{dept.members.length}명</span>}
      </div>

      {open && (
        <>
          {hasMembers && (
            <div className={styles.memberList}>
              {dept.members.map(m => <MemberChip key={`${m.id}-${dept.id}`} m={m} />)}
            </div>
          )}
          {hasChildren && (
            <div className={styles.childrenWrap}>
              {dept.children.map(child => (
                <DeptCard key={child.id} dept={child} depth={depth + 1} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function Organization() {
  const [tree, setTree]       = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    deptApi.tree()
      .then(r => setTree(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>조직현황</h2>
        <button className={styles.manageBtn} onClick={() => navigate('/org-manager')}>
          ⚙️ 조직 관리
        </button>
      </div>

      {loading ? (
        <p className={styles.loading}>불러오는 중…</p>
      ) : tree.length === 0 ? (
        <div className={styles.empty}>
          <p>등록된 조직이 없습니다.</p>
          <button className={styles.goManageBtn} onClick={() => navigate('/org-manager')}>
            조직 관리 페이지로 이동 →
          </button>
        </div>
      ) : (
        <div className={styles.orgGrid}>
          {tree.map(root => <DeptCard key={root.id} dept={root} depth={0} />)}
        </div>
      )}
    </div>
  )
}
