import { execSync } from 'node:child_process'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Commit der gebauten Fassung. Auf Vercel steht der SHA in der Umgebung,
 * lokal kommt er aus git; ohne beides (z. B. Tarball ohne .git) 'dev'.
 */
function gitCommit(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA
  if (fromVercel) return fromVercel.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

/**
 * Wird beim Bauen fest eingesetzt, damit unter „Mehr“ steht, welche Fassung
 * gerade läuft — vorher war dort eine handgepflegte Nummer, die nie jemand
 * hochgezählt hat. Nützlich vor allem bei der installierten PWA: Bleibt das
 * Datum alt, hängt noch die alte Fassung im Cache.
 */
const BUILD = { commit: gitCommit(), date: new Date().toISOString() }

export default defineConfig({
  define: {
    __APP_BUILD__: JSON.stringify(BUILD),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // Push- und Notification-Click-Handler zusätzlich zum Precache-SW
        importScripts: ['push-sw.js'],
      },
      manifest: {
        name: 'bounceBack',
        short_name: 'bounceBack',
        description: 'Trend statt Streak — persönlicher Habit-Recovery-Tracker',
        lang: 'de',
        display: 'standalone',
        start_url: '/',
        background_color: '#fafaf9',
        theme_color: '#fafaf9',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
