import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        timeout: 600000,
        proxyTimeout: 600000,
        ws: false,
        configure: (proxy) => {
          // Fix: Vite's http-proxy strips the Content-Type boundary on multipart/form-data
          // requests. This hook restores the original Content-Type so Multer can parse uploads.
          proxy.on('proxyReq', (proxyReq, req) => {
            const contentType = req.headers['content-type'];
            if (contentType && contentType.includes('multipart/form-data')) {
              proxyReq.setHeader('content-type', contentType);
            }
          });
        }
      }
    }
  }
})
