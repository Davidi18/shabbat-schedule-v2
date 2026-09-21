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
      // The generated registration only calls register(). Ours is in
      // index.html and also reloads the page when a new build takes over.
      injectRegister: false,
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
        // The signed-in pages are not part of the offline app. Precaching them
        // would serve a stale sign-in screen against a server whose accounts
        // model has moved on, and html2canvas is 200KB that only the gabbai
        // issuing a receipt ever needs — not something to push to every phone
        // in the community.
        globIgnores: ['admin.html', 'receipts.html', 'html2canvas.min.js'],
        cleanupOutdatedCaches: true,
        // Take over open tabs as soon as a new build is cached, so a phone
        // that resumes the PWA doesn't paint last week's bundle.
        clientsClaim: true,
        skipWaiting: true,
        // A page with a name of its own — admin.html, receipts.html, whatever
        // comes next — is a real document, not a route of the app, and must
        // never be answered from the cached index.html shell. Listing them one
        // by one is how receipts.html got missed: a visitor who had ever opened
        // the site asked for the receipts and was handed the Shabbat times.
        // Workbox tests path and query together, hence the optional query.
        navigateFallbackDenylist: [/^\/[^?#]*\.html(?:[?#]|$)/, /^\/api\//],
        runtimeCaching: [
          {
            // Gabbai content + weekly halacha: always try the network first so
            // the page shows current data, but fall back to the last response
            // when offline (the prayer list stays visible either way).
            // The public reads only — a session, a user list or the receipt
            // book answered from cache would show a signed-out gabbai as
            // signed in, or hide a change that has just been made.
            urlPattern: ({ url }) => url.pathname === '/api/content' || url.pathname === '/api/dvar',
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
