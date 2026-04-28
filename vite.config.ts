import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Local dev: SPA on :5173 talks to FastAPI on :8000 via these proxies.
// Same-origin from the browser's perspective so the session cookie
// works without CORS gymnastics. Production uses Vercel rewrites in
// vercel.json to the equivalent paths against the Railway backend.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/auth': 'http://localhost:8000',
    },
  },
})
