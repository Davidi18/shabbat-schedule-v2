import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// The whole zmanim engine runs client-side (@hebcal/core), so once the app shell
// is cached the PWA computes times for ANY week and ANY location fully offline.
// Exclude our scripts from Cloudflare Rocket Loader, which otherwise rewrites the
// ES-module <script> tag (type="…-module") and breaks the app. data-cfasync="false"
// tells Rocket Loader to leave them alone — no Cloudflare dashboard change needed.
const cfAsyncFalse = {
  name: 'cf-async-false',
  transformIndexHtml(html) {
    return html.replace(/<script(?![^>]*\bdata-cfasync=)/g, '<script data-cfasync="false"');
  },
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    cfAsyncFalse,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'kotel.jpg', 'logo.jpg'],
      manifest: {
        name: 'זמני השבת — אורות ישראל',
        short_name: 'זמני השבת',
        description: 'זמני כניסת ויציאת שבת, פרשה, מולד ותפילות — לכל מיקום, גם בלי אינטרנט.',
        lang: 'he',
        dir: 'rtl',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1a1a2e',
        theme_color: '#1a1a2e',
        categories: ['lifestyle', 'utilities'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,ico,woff2}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Cache Google Fonts so typography survives offline.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
