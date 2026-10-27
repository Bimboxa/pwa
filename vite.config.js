import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import svgr from "vite-plugin-svgr";

// In secondary git worktrees, `npm run link-env` creates symlinks pointing into
// the main worktree (gitignored .env, configs, src/Data). Vite's dev server
// refuses to serve files outside the project root unless declared here.
function getMainWorktreeRoot() {
  try {
    const out = execSync("git worktree list --porcelain", {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
    const line = out.split("\n").find((l) => l.startsWith("worktree "));
    return line ? line.replace("worktree ", "") : null;
  } catch {
    return null;
  }
}
const mainWorktreeRoot = getMainWorktreeRoot();

// https://vite.dev/config/
export default defineConfig({
  assetsInclude: ["**/*.yaml"],

  server: {
    fs: {
      allow: mainWorktreeRoot ? [".", mainWorktreeRoot] : ["."],
    },
  },

  plugins: [
    react(),
    svgr(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024, // 5 => 10 for opencv.js 10=>20 for transformers
        // The default globPatterns don't include .mjs nor .wasm. The pdf.js
        // worker is emitted as assets/pdf.worker-<hash>.mjs: without it in the
        // precache, getDocument() rejects offline ("Erreur de chargement du
        // PDF"). Likewise pdf.js's JPEG 2000 / color decoders
        // (public/pdfjs/wasm) would be missing offline and PDFs with JPX images
        // would render blank. Precache both explicitly.
        globPatterns: [
          "**/*.{js,mjs,css,html,ico,png,svg,woff,woff2}",
          "pdfjs/wasm/*.wasm",
        ],
        // version.json must always be fetched fresh from the network so the
        // client can detect when a new app version is deployed.
        // Optional scan code is cached on first use, never eagerly downloaded
        // for devices where the experimental engine is disabled.
        globIgnores: [
          "**/version.json",
          "**/spark.module-*.js",
          "**/LocalScansPanel-*.js",
          "**/localScan.worker-*.js",
          "**/decodeLocalSplats.worker-*.js",
        ],
        runtimeCaching: [
          {
            urlPattern:
              /\/assets\/(?:spark\.module|LocalScansPanel|localScan\.worker|decodeLocalSplats\.worker)-[^/]+\.js$/,
            handler: "CacheFirst",
            options: {
              cacheName: "local-scan-engine-v1",
              expiration: { maxEntries: 12 },
            },
          },
        ],
      },
      includeAssets: [
        "favicon.svg",
        "favicon.ico",
        "robots.txt",
        "apple-touch-icon.png",
      ],
      manifest: {
        name: "Repérage",
        short_name: "Repérage",
        description: "Plans de repérage",
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

  build: {
    sourcemap: false,
  },
  optimizeDeps: {
    include: ["pdf-lib"],
    force: true,
  },
});
