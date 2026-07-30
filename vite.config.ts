import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Relative base so the built app also works when served from a subpath
  // (e.g. GitHub Pages) or straight off the filesystem.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Legion of Honor — Grognard Tracker',
        short_name: 'Grognards',
        description:
          'Character tracker for the Clash of Arms board game Legion of Honor. Solo play with multiple Grognards.',
        lang: 'en',
        theme_color: '#1b1815',
        background_color: '#1b1815',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        // SVG only for now; rasterised PNG icons (incl. maskable and
        // apple-touch-icon, which iOS requires) are generated in M9.
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        // The app is fully offline: precache everything it ships with.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
