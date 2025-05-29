import {defineConfig} from "vite";
import react from "@vitejs/plugin-react-swc";
import {VitePWA} from "vite-plugin-pwa";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
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
    },
  },
  server: {
    host: true,
  },
  build: {
    sourcemap: true,
  },
});
