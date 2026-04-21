import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { communities as api } from '../../api'
import styles from './Communities.module.css'

export default function Communities() {
  const [list, setList] = useState([])

  useEffect(() => {
    api.list().then(r => setList(r.data)).catch(() => {})
  }, [])

  // 트리 구조로 정렬
  const roots = list.filter(c => !c.parent_id)
  const children = id => list.filter(c => c.parent_id === id)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>공동체 / 구역 관리</h1>
      </div>

      <div className={styles.grid}>
        {roots.map(c => (
          <div key={c.id} className={styles.groupWrap}>
            <Link to={`/communities/${c.id}`} className={styles.card}>
              <div className={styles.cardName}>{c.name}</div>
              <div className={styles.cardType}>{c.type ?? ''}</div>
              {c.leader_name && <div className={styles.leader}>구역장: {c.leader_name}</div>}
            </Link>
            {children(c.id).length > 0 && (
              <div className={styles.children}>
                {children(c.id).map(sub => (
                  <Link key={sub.id} to={`/communities/${sub.id}`} className={styles.subCard}>
                    {sub.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
