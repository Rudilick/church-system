import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { members as api } from '../../api'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import styles from './Members.module.css'
import RelationGraph from './RelationGraph'

const RELATION_LABELS = {
  spouse: '배우자', parent: '부모', child: '자녀', sibling: '형제·자매',
}

export default function MemberDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [member, setMember] = useState(null)

  useEffect(() => {
    api.get(id).then(r => setMember(r.data)).catch(() => toast.error('교인 정보를 불러오지 못했습니다.'))
  }, [id])

  if (!member) return <div>불러오는 중...</div>

  const handleDelete = async () => {
    if (!confirm(`${member.name} 교인을 삭제하시겠습니까?`)) return
    await api.remove(id)
    toast.success('삭제했습니다.')
    navigate('/members')
  }

  return (
    <div className={styles.detailOuter}>
      {/* 왼쪽: 상세 정보 */}
      <div className={styles.detailLeft}>
        <Link to="/members" className={styles.backLink}>← 교인 목록</Link>

        <div className={styles.profileCard}>
          {member.photo_url
            ? <img src={member.photo_url} alt={member.name} className={styles.profilePhoto} />
            : <div className={styles.profilePhotoPlaceholder}
                style={{ background: member.gender === 'M' ? '#3b82f6' : member.gender === 'F' ? '#ec4899' : '#64748b' }}>
                {member.name[0]}
              </div>
          }
          <div className={styles.profileInfo}>
            <div className={styles.profileName}>
              {member.name}
              {member.name_en && <small style={{ fontWeight: 400, fontSize: '0.9rem', marginLeft: 8, color: '#94a3b8' }}>{member.name_en}</small>}
            </div>

            <div className={styles.infoGrid}>
              <InfoItem label="성별"    value={member.gender === 'M' ? '남' : member.gender === 'F' ? '여' : '-'} />
              <InfoItem label="생년월일" value={member.birth_date ? dayjs(member.birth_date).format('YYYY년 MM월 DD일') + (member.birth_lunar ? ' (음력)' : '') : '-'} />
              <InfoItem label="연락처"  value={member.phone ?? '-'} />
              <InfoItem label="이메일"  value={member.email ?? '-'} />
              <InfoItem label="등록일"  value={member.registered_at ? dayjs(member.registered_at).format('YYYY.MM.DD') : '-'} />
              <InfoItem label="세례일"  value={member.baptism_date ? dayjs(member.baptism_date).format('YYYY.MM.DD') : '-'} />
              <InfoItem label="직장"    value={member.workplace ?? '-'} />
              <InfoItem label="학교"    value={member.school ?? '-'} />
              <InfoItem label="주소"    value={[member.address, member.address_detail].filter(Boolean).join(' ') || '-'} />
            </div>

            {member.note && <p style={{ marginTop: 12, fontSize: '0.875rem', color: '#475569' }}>{member.note}</p>}
          </div>

          <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-start' }}>
            <Link to={`/members/${id}/edit`} className={styles.btnSecondary}>수정</Link>
            <button className={styles.btnSecondary} style={{ color: '#ef4444', borderColor: '#fca5a5' }} onClick={handleDelete}>삭제</button>
          </div>
        </div>

        {member.family?.length > 0 && (
          <div className={styles.sectionCard}>
            <div className={styles.sectionTitle}>가족 관계</div>
            <div className={styles.memberTiles}>
              {member.family.map(f => (
                <Link key={f.id} to={`/members/${f.id}`} className={styles.memberTile}>
                  {f.photo_url
                    ? <img src={f.photo_url} alt={f.name} className={styles.tilePhoto} />
                    : <div className={styles.tilePlaceholder}>{f.name[0]}</div>
                  }
                  <span className={styles.tileName}>{f.name}</span>
                  <span className={styles.tileRelation}>{RELATION_LABELS[f.relation_type] ?? f.relation_type}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {member.communities?.length > 0 && (
          <div className={styles.sectionCard}>
            <div className={styles.sectionTitle}>소속 공동체</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {member.communities.map(c => (
                <Link key={c.id} to={`/communities/${c.id}`}
                  style={{ background: '#eff6ff', color: '#3b82f6', borderRadius: 6, padding: '4px 12px', textDecoration: 'none', fontSize: '0.85rem' }}>
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 오른쪽: 관계도 */}
      <RelationGraph memberId={Number(id)} hideDetailLink />
    </div>
  )
}

function InfoItem({ label, value }) {
  return (
    <div className={styles.infoItem}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{value}</span>
    </div>
  )
}
