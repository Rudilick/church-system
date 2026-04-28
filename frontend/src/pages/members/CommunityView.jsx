import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { communities as api } from '../../api'
import { genderColor } from '../../utils'
import styles from './Members.module.css'

export default function CommunityView({ communityId, currentMemberId }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setData(null)
    api.get(communityId)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [communityId])

  if (loading) return <div className={styles.cvLoading}>불러오는 중...</div>
  if (!data) return <div className={styles.cvLoading}>데이터를 불러올 수 없습니다.</div>

  return (
    <div className={styles.cvWrap}>
      {data.description && (
        <p className={styles.cvDesc}>{data.description}</p>
      )}
      <div className={styles.cvGrid}>
        {data.members.map(m => {
          const isMe = m.id === currentMemberId
          const color = genderColor(m.gender)
          return (
            <div key={m.id} className={styles.cvNode} onClick={() => navigate(`/members/${m.id}`)}>
              <div
                className={`${styles.cvCircle} ${isMe ? styles.cvAnchor : ''}`}
                style={isMe ? {} : { borderColor: color }}
              >
                {m.photo_url
                  ? <img src={m.photo_url} alt={m.name} />
                  : <span style={{ color: isMe ? '#fff' : color }}>{(m.name || '?')[0]}</span>
                }
              </div>
              <div className={styles.cvName}>{m.name}</div>
              {m.role && m.role !== 'member' && (
                <div className={styles.cvRole}>{m.role}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
