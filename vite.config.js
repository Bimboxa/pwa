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
        // version.json must always be fetched fresh from the network so the
        // client can detect when a new app version is deployed.
        globIgnores: ["**/version.json"],
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
