import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_TARGET || 'https://api.openai.com'

  return {
    plugins: [react()],
    server: {
      proxy: {
        // 前端调 /api/v1/... ，dev 反代到 ${VITE_API_TARGET}/v1/...
        '/api': {
          target,
          changeOrigin: true,
          secure: false,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },
  }
})
