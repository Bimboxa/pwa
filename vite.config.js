import {defineConfig} from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/demo-app-multitab/",
  resolve: {
    alias: {
      App: "/src/App",
      Features: "/src/Features",
      Styles: "/src/Styles",
    },
  },
});
