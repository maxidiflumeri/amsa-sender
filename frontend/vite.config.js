import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true, // si 5173 está ocupado, falla (no se mueve de puerto en silencio)
    open: true,       // abre la URL correcta solo
    // opcional: warmup de los primeros módulos
    warmup: { clientFiles: ['src/main.jsx', 'src/App.jsx'] }
  },
  optimizeDeps: {
    include: [
      'react', 'react-dom', 'react-router-dom',
      '@mui/material', '@mui/icons-material',
      'dayjs', 'react-quill', 'dompurify'
    ],
  },
  preview: {
    allowedHosts: ['ed4d01f3dc24.ngrok-free.app'], // tu dominio de ngrok
  }
})