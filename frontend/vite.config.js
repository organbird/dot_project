// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // 패키지명 일치 확인

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(), // Tailwind v4 플러그인
    ],
    server: {
        host: '0.0.0.0',
        port: 5173,
        strictPort: true,
        hmr: {
            // 환경변수 VITE_HMR_HOST 또는 기본값 사용
            host: process.env.VITE_HMR_HOST || '192.168.0.9',
        },
        watch: {
            usePolling: true,
        }
    }
})