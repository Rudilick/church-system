import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { members as api } from '../../api'
import { genderColor } from '../../utils'
import dayjs from 'dayjs'
import styles from './Members.module.css'

const TYPES = [
  { value: '', label: '전체' },
  { value: 'active', label: '현재제적' },
  { value: 'inactive', label: '제적 외' },
  { value: 'transfer_out', label: '이적' },
  { value: 'deceased', label: '소천' },
]

const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent)

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#22c55e" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.56.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.56 1 1 0 01-.24 1.01l-2.21 2.22z"/>
    </svg>
  )
}

function MessageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#3b82f6" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"/>
    </svg>
  )
}

export default function MemberList() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [type, setType] = useState('active')
  const [page, setPage] = useState(1)
  const limit = 50

  const load = useCallback(async () => {
    const res = await api.list({ q, type, page, limit })
    setData(res.data.data)
    setTotal(res.data.total)
  }, [q, type, page])

  useEffect(() => { load() }, [load])

  return (
    <div>
        <div className={styles.header}>
          <h1>교적 관리</h1>
          <Link to="/members/new" className={styles.btnPrimary}>+ 교인 등록</Link>
        </div>

        <div className={styles.toolbar}>
          <input
            className={styles.searchInput}
            placeholder="이름 또는 전화번호 검색"
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1) }}
          />
          <div className={styles.typeTabs}>
            {TYPES.map(t => (
              <button
                key={t.value}
                className={`${styles.tab} ${type === t.value ? styles.activeTab : ''}`}
                onClick={() => { setType(t.value); setPage(1) }}
              >{t.label}</button>
            ))}
          </div>
        </div>

        <div className={styles.countLabel}>총 {total}명</div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>사진</th><th>이름</th><th>성별</th>
                <th>연락처</th><th>등록일</th><th>상태</th>
              </tr>
            </thead>
            <tbody>
              {data.map(m => (
                <tr
                  key={m.id}
                  onClick={() => navigate(`/members/${m.id}`)}
                  className={styles.row}
                >
                  <td>
                    {m.photo_url
                      ? <img src={m.photo_url} alt={m.name} className={styles.thumb} />
                      : <div className={styles.thumbPlaceholder}
                          style={{ background: genderColor(m.gender) }}>
                          {m.name[0]}
                        </div>
                    }
                  </td>
                  <td className={styles.name}>{m.name}</td>
                  <td>{m.gender === 'M' ? '남' : m.gender === 'F' ? '여' : '-'}</td>
                  <td>
                    {m.phone ? (
                      <div className={styles.contactCell}>
                        <span className={styles.phoneNum}>{m.phone}</span>
                        <span className={styles.contactBtns}>
                          <a
                            href={isMobile ? `tel:${m.phone}` : undefined}
                            onClick={!isMobile ? (e) => { e.preventDefault(); e.stopPropagation() } : (e) => e.stopPropagation()}
                            style={{ textDecoration: 'none', lineHeight: 1, display: 'flex', alignItems: 'center' }}
                            title="전화"
                          ><PhoneIcon /></a>
                          <a
                            href={isMobile ? `sms:${m.phone}` : undefined}
                            onClick={!isMobile ? (e) => { e.preventDefault(); e.stopPropagation(); navigate('/sms') } : (e) => e.stopPropagation()}
                            style={{ textDecoration: 'none', lineHeight: 1, display: 'flex', alignItems: 'center' }}
                            title="문자"
                          ><MessageIcon /></a>
                        </span>
                      </div>
                    ) : '-'}
                  </td>
                  <td>{m.registered_at ? dayjs(m.registered_at).format('YYYY.MM.DD') : '-'}</td>
                  <td><StatusBadge type={m.membership_type} /></td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={6} className={styles.empty}>검색 결과가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {total > limit && (
          <div className={styles.pagination}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>이전</button>
            <span>{page} / {Math.ceil(total / limit)}</span>
            <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}>다음</button>
          </div>
        )}
    </div>
  )
}

function StatusBadge({ type }) {
  const map = {
    active:       { label: '현재제적', color: '#22c55e' },
    inactive:     { label: '제적 외',  color: '#f59e0b' },
    transfer_out: { label: '이적',    color: '#94a3b8' },
    deceased:     { label: '소천',    color: '#6b7280' },
  }
  const s = map[type] ?? { label: type, color: '#94a3b8' }
  return (
    <span style={{ background: s.color, color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem' }}>
      {s.label}
    </span>
  )
}
