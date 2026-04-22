import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { members as api } from '../../api'
import dayjs from 'dayjs'
import styles from './Members.module.css'
import RelationGraph from './RelationGraph'

const TYPES = [
  { value: '', label: '전체' },
  { value: 'active', label: '현재 교인' },
  { value: 'inactive', label: '비활성' },
  { value: 'transfer_out', label: '이적' },
  { value: 'deceased', label: '소천' },
]

export default function MemberList() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [type, setType] = useState('active')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState(null)
  const limit = 50

  const load = useCallback(async () => {
    const res = await api.list({ q, type, page, limit })
    setData(res.data.data)
    setTotal(res.data.total)
  }, [q, type, page])

  useEffect(() => { load() }, [load])

  return (
    <div className={styles.listOuter}>
      {/* 왼쪽: 목록 */}
      <div className={styles.listArea}>
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
                  onClick={() => setSelectedId(m.id)}
                  className={`${styles.row} ${selectedId === m.id ? styles.rowSelected : ''}`}
                >
                  <td>
                    {m.photo_url
                      ? <img src={m.photo_url} alt={m.name} className={styles.thumb} />
                      : <div className={styles.thumbPlaceholder}
                          style={{ background: m.gender === 'M' ? '#3b82f6' : m.gender === 'F' ? '#ec4899' : '#64748b' }}>
                          {m.name[0]}
                        </div>
                    }
                  </td>
                  <td className={styles.name}>{m.name}</td>
                  <td>{m.gender === 'M' ? '남' : m.gender === 'F' ? '여' : '-'}</td>
                  <td>{m.phone ?? '-'}</td>
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

      {/* 오른쪽: 관계도 */}
      <RelationGraph memberId={selectedId} />
    </div>
  )
}

function StatusBadge({ type }) {
  const map = {
    active:       { label: '현재',  color: '#22c55e' },
    inactive:     { label: '비활성', color: '#f59e0b' },
    transfer_out: { label: '이적',  color: '#94a3b8' },
    deceased:     { label: '소천',  color: '#6b7280' },
  }
  const s = map[type] ?? { label: type, color: '#94a3b8' }
  return (
    <span style={{ background: s.color, color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem' }}>
      {s.label}
    </span>
  )
}
