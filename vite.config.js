import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'MeaLog',
        short_name: 'MeaLog',
        description: '식단 기록 — 칼로리와 탄단지 트래킹',
        lang: 'ko',
        display: 'standalone',
        // start_url/scope는 명시하지 않음 — GitHub Pages 하위 경로(--base=/MeaLog/) 배포 시
        // 플러그인이 base 기준으로 자동 설정한다. 아이콘도 같은 이유로 상대 경로.
        theme_color: '#191919',
        background_color: '#191919',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
