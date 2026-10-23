import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt': la versión nueva no se aplica sola (no queremos recargas en medio de un mensaje);
      // PwaProvider avisa y el usuario decide cuándo actualizar.
      registerType: 'prompt',
      injectRegister: false, // el registro lo hace src/pwa/PwaProvider.jsx
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'AMSA Sender',
        short_name: 'Sender',
        description: 'Campañas de WhatsApp y email, y la bandeja de conversaciones de AMSA.',
        lang: 'es-AR',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F8FAFC',
        theme_color: '#075E54',
        categories: ['business', 'productivity'],
        // `?v=2`: el deploy anterior subía los íconos con caché de un año sin revalidar. Un teléfono que ya había
        // visitado Sender seguía usando el ícono viejo al instalar; con otra URL lo pide de nuevo. Subir el número
        // cada vez que cambie el logo.
        icons: [
          { src: 'icon-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-192-maskable.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-512-maskable.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'Conversaciones',
            url: '/wapi/inbox',
            icons: [{ src: 'icon-96.png?v=2', sizes: '96x96', type: 'image/png' }],
          },
          {
            name: 'Campañas',
            url: '/wapi/campanias',
            icons: [{ src: 'icon-96.png?v=2', sizes: '96x96', type: 'image/png' }],
          },
          {
            name: 'Buscar deudor',
            url: '/deudores',
            icons: [{ src: 'icon-96.png?v=2', sizes: '96x96', type: 'image/png' }],
          },
        ],
      },
    }),
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