import { useState, useRef } from 'react'
import { members as memberApi } from '../../api'
import toast from 'react-hot-toast'
import styles from './Members.module.css'

export default function BulkUploadModal({ onClose, onDone }) {
  const [phase, setPhase] = useState('idle') // 'idle' | 'loading' | 'done'
  const [selectedFile, setSelectedFile] = useState(null)
  const [mode, setMode] = useState('fill_blanks') // 'fill_blanks' | 'overwrite'
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
      const res = await memberApi.bulkUpload(selectedFile, mode)
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
          <span>엑셀 일괄 등록 / 업데이트</span>
          <button type="button" className={styles.bulkClose} onClick={handleClose}>×</button>
        </div>

        {phase !== 'done' ? (
          <div className={styles.bulkBody}>
            {/* Step 1 — 양식 다운로드 */}
            <div className={styles.bulkStep}>
              <div className={styles.bulkStepLabel}>1단계 — 양식 다운로드</div>
              <p className={styles.bulkDesc}>
                아래 버튼으로 양식을 받아 내용을 입력한 뒤 업로드하세요.<br />
                <strong>기존 교적 업데이트:</strong> 교적 관리 화면의 <em>📋 교적 전체 내보내기</em>를 이용하세요.
              </p>
              <button type="button" className={styles.btnDownload} onClick={handleDownload}>
                ↓ 신규 등록 양식 다운받기
              </button>
            </div>

            <div className={styles.bulkDivider} />

            {/* Step 2 — 파일 선택 */}
            <div className={styles.bulkStep}>
              <div className={styles.bulkStepLabel}>2단계 — 파일 선택</div>
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

            {/* Step 3 — 업데이트 모드 선택 (파일 선택 후 표시) */}
            {selectedFile && (
              <>
                <div className={styles.bulkDivider} />
                <div className={styles.bulkStep}>
                  <div className={styles.bulkStepLabel}>3단계 — 업데이트 방식 선택</div>
                  <div className={styles.bulkModeGroup}>
                    <label className={`${styles.bulkModeCard} ${mode === 'fill_blanks' ? styles.bulkModeActive : ''}`}>
                      <input
                        type="radio"
                        name="uploadMode"
                        value="fill_blanks"
                        checked={mode === 'fill_blanks'}
                        onChange={() => setMode('fill_blanks')}
                        style={{ display: 'none' }}
                      />
                      <div className={styles.bulkModeTitle}>✅ 빈칸만 채우기 (권장)</div>
                      <div className={styles.bulkModeDesc}>
                        기존 교적에 비어 있는 항목만 새로 입력됩니다.<br />
                        기존에 데이터가 있는 항목은 절대 변경되지 않습니다.
                      </div>
                    </label>
                    <label className={`${styles.bulkModeCard} ${mode === 'overwrite' ? styles.bulkModeActive : ''}`}>
                      <input
                        type="radio"
                        name="uploadMode"
                        value="overwrite"
                        checked={mode === 'overwrite'}
                        onChange={() => setMode('overwrite')}
                        style={{ display: 'none' }}
                      />
                      <div className={styles.bulkModeTitle}>⚠️ 기존값도 덮어쓰기</div>
                      <div className={styles.bulkModeDesc}>
                        엑셀에 입력된 값으로 기존 데이터도 교체됩니다.<br />
                        단, 엑셀에 <strong>공란인 항목</strong>은 기존값을 유지합니다.
                      </div>
                    </label>
                  </div>
                  <p className={styles.bulkModeNote}>
                    이름 + 생년월일이 일치하는 교인을 자동으로 찾아 업데이트합니다.<br />
                    일치하는 교인이 없으면 신규 등록됩니다. 동명이인(생년월일 동일)은 스킵됩니다.
                  </p>
                </div>
              </>
            )}

            <div className={styles.bulkActions}>
              <button type="button" className={styles.btnSecondary} onClick={handleClose}>취소</button>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={!selectedFile || phase === 'loading'}
                onClick={handleUpload}
              >
                {phase === 'loading' ? '처리 중…' : '업로드 실행'}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.bulkBody}>
            <div className={styles.bulkResult}>
              {/* 신규 등록 */}
              {result.insertCount > 0 && (
                <div className={styles.bulkResultOk}>
                  ✅ 신규 등록 {result.insertCount}명
                </div>
              )}
              {/* 업데이트 */}
              {result.updateCount > 0 && (
                <div className={styles.bulkResultOk}>
                  🔄 기존 교적 업데이트 {result.updateCount}명
                </div>
              )}
              {/* 스킵 */}
              {result.skipCount > 0 && (
                <div className={styles.bulkResultErr} style={{ background: '#fefce8', color: '#92400e', borderColor: '#fde68a' }}>
                  ⏭ 동명이인 중복 스킵 {result.skipCount}행
                </div>
              )}
              {/* 처리 0건 */}
              {result.successCount === 0 && result.skipCount === 0 && result.errors.length === 0 && (
                <div className={styles.bulkResultErr} style={{ background: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0' }}>
                  처리된 데이터가 없습니다.
                </div>
              )}
              {/* 오류 */}
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
