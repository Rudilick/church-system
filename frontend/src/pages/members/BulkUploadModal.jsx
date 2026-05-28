import { useState, useRef } from 'react'
import { members as memberApi } from '../../api'
import toast from 'react-hot-toast'
import styles from './Members.module.css'

export default function BulkUploadModal({ onClose, onDone }) {
  const [phase, setPhase] = useState('idle') // 'idle' | 'loading' | 'done'
  const [selectedFile, setSelectedFile] = useState(null)
  const [result, setResult] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef()

  const handleDownload = async () => {
    try {
      const res = await memberApi.bulkTemplate()
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = '교인등록양식.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('양식 다운로드에 실패했습니다.')
    }
  }

  const handleFile = file => {
    if (!file) return
    const ok = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    if (!ok) { toast.error('.xlsx 또는 .xls 파일만 가능합니다.'); return }
    setSelectedFile(file)
  }

  const handleDrop = e => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setPhase('loading')
    try {
      const res = await memberApi.bulkUpload(selectedFile)
      setResult(res.data)
      setPhase('done')
    } catch (err) {
      toast.error(err.response?.data?.error ?? '업로드 중 오류가 발생했습니다.')
      setPhase('idle')
    }
  }

  const handleClose = () => {
    if (phase === 'done' && result?.successCount > 0) onDone?.()
    onClose()
  }

  return (
    <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) handleClose() }}>
      <div className={styles.bulkModal}>
        <div className={styles.bulkModalHeader}>
          <span>엑셀 일괄 등록</span>
          <button type="button" className={styles.bulkClose} onClick={handleClose}>×</button>
        </div>

        {phase !== 'done' ? (
          <div className={styles.bulkBody}>
            {/* Step 1 */}
            <div className={styles.bulkStep}>
              <div className={styles.bulkStepLabel}>1단계 — 양식 다운로드</div>
              <p className={styles.bulkDesc}>
                아래 버튼으로 양식을 받아 내용을 입력한 뒤 업로드하세요.<br />
                드롭다운 항목은 선택하거나 목록 값을 직접 입력하세요.
              </p>
              <button type="button" className={styles.btnDownload} onClick={handleDownload}>
                ↓ 양식 다운받기
              </button>
            </div>

            <div className={styles.bulkDivider} />

            {/* Step 2 */}
            <div className={styles.bulkStep}>
              <div className={styles.bulkStepLabel}>2단계 — 파일 업로드</div>
              <div
                className={`${styles.bulkDropzone} ${dragOver ? styles.bulkDropzoneOver : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <span className={styles.bulkDropIcon}>📂</span>
                <span>파일을 여기에 드래그하거나 클릭하여 선택</span>
                <span className={styles.bulkDropHint}>.xlsx, .xls 파일</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
              {selectedFile && (
                <div className={styles.bulkFileName}>
                  <span>📄 {selectedFile.name}</span>
                  <button type="button" onClick={() => setSelectedFile(null)}>×</button>
                </div>
              )}
            </div>

            <div className={styles.bulkActions}>
              <button type="button" className={styles.btnSecondary} onClick={handleClose}>취소</button>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={!selectedFile || phase === 'loading'}
                onClick={handleUpload}
              >
                {phase === 'loading' ? '등록 중…' : '업로드 및 등록'}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.bulkBody}>
            <div className={styles.bulkResult}>
              {result.successCount > 0 && (
                <div className={styles.bulkResultOk}>
                  ✅ {result.successCount}명 등록 완료
                </div>
              )}
              {result.errors.length > 0 && (
                <>
                  <div className={styles.bulkResultErr}>
                    ⚠️ {result.errors.length}행 오류
                  </div>
                  <div className={styles.bulkErrTable}>
                    <table>
                      <thead>
                        <tr><th>행</th><th>이름</th><th>오류 내용</th></tr>
                      </thead>
                      <tbody>
                        {result.errors.map((e, i) => (
                          <tr key={i}>
                            <td>{e.row}</td>
                            <td>{e.name || '—'}</td>
                            <td>{e.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className={styles.bulkActions}>
              <button type="button" className={styles.btnPrimary} onClick={handleClose}>닫기</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
