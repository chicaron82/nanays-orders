import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// Build stamp: short commit SHA + build date, injected at build time.
// Prefers Vercel's git env var (set during deploys), falls back to local git.
function buildSha() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
  try { return execSync('git rev-parse --short HEAD').toString().trim() }
  catch { return 'dev' }
}
const __BUILD_SHA__ = JSON.stringify(buildSha())
const __BUILD_DATE__ = JSON.stringify(new Date().toISOString().slice(0, 10).replace(/-/g, '.'))

export default defineConfig({
  define: {
    __BUILD_SHA__,
    __BUILD_DATE__,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff2,json}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase'
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion')) return 'vendor-motion'
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/scheduler')) return 'vendor-react'
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
})
