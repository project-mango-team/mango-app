import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // VITE_PORT y VITE_API_TARGET permiten levantar otra copia (por ejemplo, otro worktree) sin chocar
    port: Number(process.env.VITE_PORT) || 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
