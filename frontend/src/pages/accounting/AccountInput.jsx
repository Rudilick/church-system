import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { publicApi } from '../../api'
import styles from './AccountInput.module.css'

// 문서 스캔 방식 이미지 전처리 (jscanify 없이 Canvas API로 구현)
// 목표: 사이즈 축소 + 그레이스케일 + 대비 향상 → 100~400KB 수준으로 압축
function processReceiptImage(file, maxWidth = 1400, quality = 0.7) {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxWidth) {
          height = Math.round(height * maxWidth / width)
          width = maxWidth
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // 그레이스케일 + 약한 대비 증가 (가독성 유지, 완전 흑백 X)
        const imageData = ctx.getImageData(0, 0, width, height)
        const data = imageData.data
        const contrast = 1.2
        const brightness = 5
        for (let i = 0; i < data.length; i += 4) {
          let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
          gray = (gray - 128) * contrast + 128 + brightness
          gray = Math.max(0, Math.min(255, gray))
          data[i] = data[i + 1] = data[i + 2] = gray
        }
        ctx.putImageData(imageData, 0, 0)

        canvas.toBlob(blob => {
          const reader2 = new FileReader()
          reader2.onload = ev => resolve(ev.target.result)
          reader2.readAsDataURL(blob)
        }, 'image/jpeg', quality)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

export default function AccountInput() {
  const [depts, setDepts]     = useState([])
  const [form, setForm]       = useState({
    department_id: '',
    date: dayjs().format('YYYY-MM-DD'),
    description: '',
    amount: '',
    memo: '',
    receipt_url: '',
  })
  const [preview, setPreview] = useState(null)
  const [status, setStatus]   = useState('idle') // 'idle' | 'loading' | 'success' | 'error'
  const [errMsg, setErrMsg]   = useState('')

  useEffect(() => {
    publicApi.departments()
      .then(data => setDepts(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const handlePhoto = async e => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      setErrMsg('사진 크기는 15MB 이하여야 합니다.')
      return
    }
    const url = await processReceiptImage(file)
    setPreview(url)
    setForm(f => ({ ...f, receipt_url: url }))
  }

  const removePhoto = () => {
    setPreview(null)
    setForm(f => ({ ...f, receipt_url: '' }))
  }

  const resetForm = () => {
    setForm({ department_id: '', date: dayjs().format('YYYY-MM-DD'), description: '', amount: '', memo: '', receipt_url: '' })
    setPreview(null)
    setStatus('idle')
    setErrMsg('')
  }

  const handleSubmit = async () => {
    setErrMsg('')
    if (!form.date || !form.description.trim() || !form.amount) {
      setErrMsg('날짜, 지출내용, 금액을 입력해 주세요.')
      return
    }
    setStatus('loading')
    try {
      await publicApi.addExpense({
        ...form,
        amount: Number(form.amount),
        department_id: form.department_id || null,
      })
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrMsg(err?.message ?? '저장에 실패했습니다. 다시 시도해 주세요.')
    }
  }

  // 선택한 부서명으로 회계 현황 URL 생성
  const getAccountingUrl = () => {
    const dept = depts.find(d => String(d.id) === String(form.department_id))
    if (!dept) return '/accounting'
    return `/accounting?dept=${encodeURIComponent(dept.name)}`
  }

  if (status === 'success') {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <span className={styles.logo}>⛪</span>
          <h1 className={styles.title}>지출 입력</h1>
        </header>
        <div className={styles.successBox}>
          <div className={styles.successIcon}>✅</div>
          <p className={styles.successMsg}>저장되었습니다!</p>
          <div className={styles.successActions}>
            <a href={getAccountingUrl()} className={styles.viewBtn}>
              📊 지출현황 보기
            </a>
            <button className={styles.againBtn} onClick={resetForm}>
              계속 입력하기
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.logo}>⛪</span>
        <h1 className={styles.title}>지출 입력</h1>
        <p className={styles.subtitle}>교회 지출 내역을 입력해 주세요</p>
      </header>

      <div className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>부서</label>
          <select className={styles.input} value={form.department_id}
            onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
            <option value="">부서 선택 (선택)</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>날짜 <span className={styles.req}>*</span></label>
          <input type="date" className={styles.input} value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>지출내용 <span className={styles.req}>*</span></label>
          <input className={styles.input} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="예) 주일 식재료 구입" />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>금액 (원) <span className={styles.req}>*</span></label>
          <input
            type="tel"
            inputMode="numeric"
            className={`${styles.input} ${styles.amtInput}`}
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/\D/g, '') }))}
            placeholder="0"
          />
          {form.amount && (
            <span className={styles.amtPreview}>{Number(form.amount).toLocaleString('ko-KR')} 원</span>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>비고 (선택)</label>
          <input className={styles.input} value={form.memo}
            onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
            placeholder="메모" />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>영수증 사진 (선택)</label>
          {preview ? (
            <div className={styles.previewWrap}>
              <img src={preview} alt="영수증 미리보기" className={styles.previewImg} />
              <button type="button" className={styles.removeBtn} onClick={removePhoto}>
                × 사진 제거
              </button>
            </div>
          ) : (
            <>
              <input type="file" accept="image/*" capture="environment"
                id="photoInput" className={styles.fileInput} onChange={handlePhoto} />
              <label htmlFor="photoInput" className={styles.photoBtn}>
                📷 사진 첨부하기
              </label>
            </>
          )}
        </div>

        {errMsg && <p className={styles.errMsg}>⚠️ {errMsg}</p>}

        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? '저장 중…' : '저장하기'}
        </button>

        {/* 부서별 회계 현황 바로가기 */}
        <a href={getAccountingUrl()} className={styles.accountingLink}>
          📊 부서별 지출회계 현황
        </a>
      </div>
    </div>
  )
}
