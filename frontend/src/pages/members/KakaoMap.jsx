import { useEffect, useRef, useState } from 'react'
import styles from './Members.module.css'

function loadKakaoSdk() {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps?.load) { resolve(); return }

    const key = import.meta.env.VITE_KAKAO_JS_KEY
    if (!key) { reject(new Error('no key')); return }

    const existing = document.querySelector('script[data-kakao-maps]')
    if (existing) {
      existing.addEventListener('load', resolve)
      existing.addEventListener('error', reject)
      return
    }

    const script = document.createElement('script')
    script.setAttribute('data-kakao-maps', '1')
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&libraries=services&autoload=false`
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export default function KakaoMap({ address }) {
  const containerRef = useRef(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    if (!address) { setStatus('noaddr'); return }

    setStatus('loading')

    loadKakaoSdk()
      .then(() => new Promise((resolve, reject) => {
        try {
          window.kakao.maps.load(() => {
            if (!containerRef.current) { resolve(); return }
            try {
              const geocoder = new window.kakao.maps.services.Geocoder()
              geocoder.addressSearch(address, (result, searchStatus) => {
                if (searchStatus !== window.kakao.maps.services.Status.OK) {
                  setStatus('error')
                  resolve()
                  return
                }
                try {
                  const coords = new window.kakao.maps.LatLng(result[0].y, result[0].x)
                  const map = new window.kakao.maps.Map(containerRef.current, { center: coords, level: 4 })
                  const marker = new window.kakao.maps.Marker({ map, position: coords })
                  const infowindow = new window.kakao.maps.InfoWindow({
                    content: `<div style="padding:6px 10px;font-size:13px;font-weight:600;white-space:nowrap">${result[0].address_name}</div>`,
                  })
                  infowindow.open(map, marker)
                  setStatus('ok')
                } catch { setStatus('error') }
                resolve()
              })
            } catch { setStatus('error'); resolve() }
          })
        } catch { reject(new Error('maps.load failed')) }
      }))
      .catch(() => setStatus('error'))
  }, [address])

  return (
    <div className={styles.kakaoMapWrap}>
      <div
        ref={containerRef}
        className={styles.kakaoMapContainer}
        style={{ display: status === 'ok' ? 'block' : 'none' }}
      />

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
