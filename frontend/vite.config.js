import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 4000000,
      },
      manifest: {
        name: 'AMSA Sender',
        short_name: 'AMSA',
        theme_color: '#2e5a50',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
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