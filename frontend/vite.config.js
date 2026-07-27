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
        // Take over open tabs as soon as a new build is cached, so a phone
        // that resumes the PWA doesn't paint last week's bundle.
        clientsClaim: true,
        skipWaiting: true,
        // /admin.html is a real page, not part of the SPA — never answer it
        // (or the content API) from the cached index.html shell.
        navigateFallbackDenylist: [/^\/admin\.html/, /^\/api\//],
        runtimeCaching: [
          {
            // Gabbai content + weekly halacha: always try the network first so
            // the page shows current data, but fall back to the last response
            // when offline (the prayer list stays visible either way).
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'content-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
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
