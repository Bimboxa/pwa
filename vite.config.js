import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  assetsInclude: ["**/*.yaml"],


  plugins: [
    react(),
    svgr(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024, // 5 => 10 for opencv.js 10=>20 for transformers
      },
      includeAssets: [
        "favicon.svg",
        "favicon.ico",
        "robots.txt",
        "apple-touch-icon.png",
      ],
      manifest: {
        name: "Bimboxa",
        short_name: "Bimboxa",
        description: "Bimboxa",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          {
            src: "logo192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "logo512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  base: "/",
  resolve: {
    alias: {
      App: "/src/App",
      Features: "/src/Features",
      Styles: "/src/Styles",
      Data: "/src/Data",
    },
  },
  server: {
    host: true,
    proxy: {
      // 1. Le préfixe qu'on va utiliser dans le code React
      '/data-api-lan': {
        // 2. La cible réelle sur le réseau local
        target: 'https://data.etandex.fr',

        // 3. Indispensable pour les serveurs virtuels (change le header Host)
        changeOrigin: true,

        // 4. TRÈS IMPORTANT sur un LAN : ignore les erreurs de certificats SSL (https)
        // Souvent les API internes ont des certificats auto-signés qui font planter fetch
        secure: false,

        // 5. On retire '/api-lan' de l'URL avant d'envoyer à Etandex
        rewrite: (path) => path.replace(/^\/data-api-lan/, '')
      },
      '/krto-api-lan': {
        // 2. La cible réelle sur le réseau local
        target: 'https://krto-api-kal.etandex.fr',

        // 3. Indispensable pour les serveurs virtuels (change le header Host)
        changeOrigin: true,

        // 4. TRÈS IMPORTANT sur un LAN : ignore les erreurs de certificats SSL (https)
        // Souvent les API internes ont des certificats auto-signés qui font planter fetch
        secure: false,

        // 5. On retire '/api-lan' de l'URL avant d'envoyer à Etandex
        rewrite: (path) => path.replace(/^\/krto-api-lan/, '')
      }
    }
  },
  build: {
    sourcemap: true,
  },
  optimizeDeps: {
    include: ["pdf-lib"],
    force: true,
  },
});
