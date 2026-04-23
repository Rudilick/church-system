import { useEffect, useRef, useState } from 'react'
import styles from './Members.module.css'

export default function KakaoMap({ address }) {
  const containerRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | ok | noaddr | error

  useEffect(() => {
    if (!address) { setStatus('noaddr'); return }
    if (!window.kakao) { setStatus('error'); return }

    setStatus('loading')

    window.kakao.maps.load(() => {
      if (!containerRef.current) return

      const geocoder = new window.kakao.maps.services.Geocoder()

      geocoder.addressSearch(address, (result, searchStatus) => {
        if (searchStatus !== window.kakao.maps.services.Status.OK) {
          setStatus('error')
          return
        }

        const coords = new window.kakao.maps.LatLng(result[0].y, result[0].x)

        const map = new window.kakao.maps.Map(containerRef.current, {
          center: coords,
          level: 4,
        })

        const marker = new window.kakao.maps.Marker({
          map,
          position: coords,
        })

        // 말풍선 정보창
        const infowindow = new window.kakao.maps.InfoWindow({
          content: `<div style="padding:6px 10px;font-size:13px;font-weight:600;white-space:nowrap">${result[0].address_name}</div>`,
        })
        infowindow.open(map, marker)

        setStatus('ok')
      })
    })
  }, [address])

  return (
    <div className={styles.kakaoMapWrap}>
      {/* 지도 컨테이너 — 항상 DOM에 존재해야 SDK가 정상 작동 */}
      <div
        ref={containerRef}
        className={styles.kakaoMapContainer}
        style={{ display: status === 'ok' ? 'block' : 'none' }}
      />

      {/* 상태별 오버레이 */}
      {status === 'loading' && (
        <div className={styles.kakaoMapOverlay}>지도 불러오는 중...</div>
      )}
      {status === 'noaddr' && (
        <div className={styles.kakaoMapOverlay}>주소 정보가 없습니다.</div>
      )}
      {status === 'error' && (
        <div className={styles.kakaoMapOverlay}>
          <span>지도를 표시할 수 없습니다.</span>
          {address && (
            <a
              href={`https://map.kakao.com/?q=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noreferrer"
              className={styles.mapLink}
              style={{ marginTop: 8 }}
            >
              카카오맵에서 보기 →
            </a>
          )}
        </div>
      )}
    </div>
  )
}
