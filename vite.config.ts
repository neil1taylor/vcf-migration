/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import pkg from './package.json'

// Plugin to serve IBM Plex fonts from node_modules
// Carbon styles reference fonts with ~@ibm/plex paths which Vite doesn't handle by default
function ibmPlexFontsPlugin(): Plugin {
  return {
    name: 'ibm-plex-fonts',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/~@ibm/plex')) {
          const fontPath = req.url.replace('/~@ibm/plex', '/node_modules/@ibm/plex')
          const absolutePath = path.join(process.cwd(), fontPath)

          if (fs.existsSync(absolutePath)) {
            const ext = path.extname(absolutePath).toLowerCase()
            const mimeTypes: Record<string, string> = {
              '.woff2': 'font/woff2',
              '.woff': 'font/woff',
              '.ttf': 'font/ttf',
              '.eot': 'application/vnd.ms-fontobject',
            }

            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream')
            res.setHeader('Cache-Control', 'public, max-age=31536000')
            fs.createReadStream(absolutePath).pipe(res)
            return
          }
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), ibmPlexFontsPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Resolve SCSS ~ prefix for node_modules (used by @carbon/styles for fonts)
      '~@ibm/plex': path.resolve(__dirname, 'node_modules/@ibm/plex'),
    },
  },
  server: {
    fs: {
      // Allow serving files from node_modules for IBM Plex fonts
      allow: ['..'],
    },
  },
  worker: {
    format: 'es',
  },
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          carbon: ['@carbon/react', '@carbon/icons-react'],
          charts: ['chart.js', 'react-chartjs-2'],
          tables: ['@tanstack/react-table', '@tanstack/react-virtual'],
          excel: ['xlsx'],
          pdf: ['jspdf', 'html2canvas'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_NAME__: JSON.stringify(pkg.name),
    __APP_DESCRIPTION__: JSON.stringify(pkg.description),
    __APP_AUTHOR__: JSON.stringify(pkg.author),
    __APP_LICENSE__: JSON.stringify(pkg.license),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
