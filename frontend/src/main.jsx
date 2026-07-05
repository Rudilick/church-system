import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// 모바일 브라우저(특히 카카오톡 등 인앱 웹뷰)는 100vh/100dvh/100svh 계산이
// 주소창·제스처바 상태에 따라 실제 보이는 높이와 어긋나는 경우가 있어,
// window.innerHeight 실측값으로 --vh 커스텀 프로퍼티를 직접 갱신해 사용한다.
function setRealVh() {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`)
}
setRealVh()
window.addEventListener('resize', setRealVh)
window.addEventListener('orientationchange', setRealVh)
window.visualViewport?.addEventListener('resize', setRealVh)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
