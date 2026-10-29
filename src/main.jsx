import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './styles/index.css'

// 새 버전이 배포되면 서비스 워커를 바로 교체하고 새로고침해서 예전 화면이 남지 않게 한다.
// 홈 화면 앱은 백그라운드에서 돌아올 때 다시 로드되지 않으므로 그때마다 업데이트를 확인한다.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update()
    })
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
