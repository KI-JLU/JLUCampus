import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA, type ManifestOptions } from 'vite-plugin-pwa'
import manifest from './public/manifest.json'

/** Lucide's dynamic icons become ~1700 tiny chunks; they get their own folder so the
 * service worker can skip precaching them and cache them on first use instead. */
const ICON_CHUNK_DIR = 'assets/icons'

export default defineConfig({
  // The root .env provides VITE_API_URL for every app in the workspace.
  envDir: '../..',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icons/apple-touch-icon.png'],
      // public/manifest.json is the single source; the plugin emits it as manifest.webmanifest.
      manifest: manifest as Partial<ManifestOptions>,
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        // The design system's PDF viewer (pdf.js, ~2 MB) is never used here; keep it out of the precache.
        globIgnores: [`${ICON_CHUNK_DIR}/*.js`, 'assets/pdf*.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith(`/${ICON_CHUNK_DIR}/`),
            handler: 'CacheFirst',
            options: { cacheName: 'lucide-icons', expiration: { maxEntries: 300 } }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: { port: 5173, strictPort: true },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        chunkFileNames: (chunk) =>
          chunk.facadeModuleId?.includes('/lucide-react/dist/esm/icons/')
            ? `${ICON_CHUNK_DIR}/[name]-[hash].js`
            : 'assets/[name]-[hash].js'
      }
    }
  }
})
