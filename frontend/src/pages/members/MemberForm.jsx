import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { members as api } from '../../api'
import toast from 'react-hot-toast'
import styles from './Members.module.css'

const EMPTY = {
  name: '', name_en: '', gender: '', birth_date: '', birth_lunar: false,
  phone: '', email: '', address: '', address_detail: '',
  workplace: '', school: '', membership_type: 'active',
  registered_at: '', baptism_date: '', note: '',
}

export default function MemberForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    if (!isEdit) return
    api.get(id).then(r => {
      const d = r.data
      setForm({
        name: d.name ?? '',
        name_en: d.name_en ?? '',
        gender: d.gender ?? '',
        birth_date: d.birth_date ? d.birth_date.slice(0, 10) : '',
        birth_lunar: d.birth_lunar ?? false,
        phone: d.phone ?? '',
        email: d.email ?? '',
        address: d.address ?? '',
        address_detail: d.address_detail ?? '',
        workplace: d.workplace ?? '',
        school: d.school ?? '',
        membership_type: d.membership_type ?? 'active',
        registered_at: d.registered_at ? d.registered_at.slice(0, 10) : '',
        baptism_date: d.baptism_date ? d.baptism_date.slice(0, 10) : '',
        note: d.note ?? '',
      })
    })
  }, [id, isEdit])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('이름을 입력하세요.'); return }
    try {
      if (isEdit) {
        await api.update(id, form)
        toast.success('수정했습니다.')
        navigate(`/members/${id}`)
      } else {
        const res = await api.create(form)
        toast.success('등록했습니다.')
        navigate(`/members/${res.data.id}`)
      }
    } catch {
      toast.error('저장에 실패했습니다.')
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h1 className={styles.formTitle}>{isEdit ? '교인 수정' : '교인 등록'}</h1>
      </div>

      <div className={styles.formGrid}>
        <Field label="이름 *" required>
          <input value={form.name} onChange={e => set('name', e.target.value)} />
        </Field>
        <Field label="영문 이름">
          <input value={form.name_en} onChange={e => set('name_en', e.target.value)} />
        </Field>
        <Field label="성별">
          <select value={form.gender} onChange={e => set('gender', e.target.value)}>
            <option value="">선택</option>
            <option value="M">남</option>
            <option value="F">여</option>
          </select>
        </Field>
        <Field label="생년월일">
          <input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
        </Field>
        <Field label="연락처">
          <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="010-0000-0000" />
        </Field>
        <Field label="이메일">
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </Field>
        <Field label="등록일">
          <input type="date" value={form.registered_at} onChange={e => set('registered_at', e.target.value)} />
        </Field>
        <Field label="세례일">
          <input type="date" value={form.baptism_date} onChange={e => set('baptism_date', e.target.value)} />
        </Field>
        <Field label="상태">
          <select value={form.membership_type} onChange={e => set('membership_type', e.target.value)}>
            <option value="active">현재 교인</option>
            <option value="inactive">비활성</option>
            <option value="transfer_out">이적</option>
            <option value="deceased">소천</option>
          </select>
        </Field>
        <Field label="직장">
          <input value={form.workplace} onChange={e => set('workplace', e.target.value)} />
        </Field>
        <Field label="학교">
          <input value={form.school} onChange={e => set('school', e.target.value)} />
        </Field>
        <div /> {/* spacer */}
        <Field label="주소" className={styles.span2}>
          <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="도로명 주소" />
        </Field>
        <Field label="상세 주소" className={styles.span2}>
          <input value={form.address_detail} onChange={e => set('address_detail', e.target.value)} />
        </Field>
        <Field label="메모" className={styles.span2}>
          <textarea rows={3} value={form.note} onChange={e => set('note', e.target.value)} />
        </Field>
      </div>

      <div className={styles.formActions}>
        <Link to={isEdit ? `/members/${id}` : '/members'} className={styles.btnSecondary}>취소</Link>
        <button type="submit" className={styles.btnPrimary}>{isEdit ? '저장' : '등록'}</button>
      </div>
    </form>
  )
}

function Field({ label, children, className }) {
  return (
    <div className={`${styles.formGroup} ${className ?? ''}`}>
      <label>{label}</label>
      {children}
    </div>
  )
}
