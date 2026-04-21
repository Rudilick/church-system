import { useEffect, useRef, useState } from 'react'
import { attendance as api } from '../../api'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import styles from './Attendance.module.css'

export default function AttendanceQR() {
  const videoRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [lastScanned, setLastScanned] = useState(null)
  const [serviceId, setServiceId] = useState('')
  const [services, setServices] = useState([])
  const [date] = useState(dayjs().format('YYYY-MM-DD'))
  const scanningRef = useRef(false)

  useEffect(() => {
    api.services().then(r => {
      setServices(r.data)
      if (r.data.length) setServiceId(String(r.data[0].id))
    })
    return () => stopCamera()
  }, [])

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      setStream(s)
      if (videoRef.current) videoRef.current.srcObject = s
      startScanning(s)
    } catch {
      toast.error('카메라 접근 권한이 필요합니다.')
    }
  }

  const stopCamera = () => {
    stream?.getTracks().forEach(t => t.stop())
    setStream(null)
    scanningRef.current = false
  }

  const startScanning = (s) => {
    // BarcodeDetector API 사용 (Chrome 지원)
    if (!('BarcodeDetector' in window)) {
      toast.error('이 브라우저는 QR 스캔을 지원하지 않습니다. Chrome을 사용해주세요.')
      return
    }
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
    scanningRef.current = true

    const scan = async () => {
      if (!scanningRef.current || !videoRef.current) return
      try {
        const codes = await detector.detect(videoRef.current)
        if (codes.length > 0) {
          const token = codes[0].rawValue
          await handleQR(token)
        }
      } catch {}
      if (scanningRef.current) requestAnimationFrame(scan)
    }
    requestAnimationFrame(scan)
  }

  const handleQR = async (token) => {
    scanningRef.current = false
    try {
      const res = await api.qr({ token, service_id: serviceId, date })
      setLastScanned(res.data.member)
      toast.success(`${res.data.member.name} 출석 확인!`)
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'QR 오류')
    }
    setTimeout(() => { scanningRef.current = true; setLastScanned(null) }, 2000)
  }

  return (
    <div className={styles.qrWrap}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 20 }}>QR 출석 체크</h1>

      <div className={styles.qrBox}>
        <select value={serviceId} onChange={e => setServiceId(e.target.value)} className={styles.select} style={{ width: '100%' }}>
          {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {!stream ? (
          <button className={styles.btn} onClick={startCamera} style={{ width: '100%', padding: '12px' }}>
            📷 카메라 시작
          </button>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline className={styles.qrVideo} />
            {lastScanned && (
              <div className={styles.scanResult}>
                ✅ {lastScanned.name} 출석 완료!
              </div>
            )}
            <button className={styles.btnOutline} onClick={stopCamera}>카메라 중지</button>
          </>
        )}
      </div>
    </div>
  )
}
