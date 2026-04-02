import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/relationshipsanalyses/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "favicon.ico", "app-icon-512.png"],
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
      manifest: {
        name: "Relationship Analyzer",
        short_name: "RelAnalyzer",
        description: "Analyze your chat conversations to uncover relationship dynamics",
        theme_color: "#6C3AED",
        background_color: "#F5F5F8",
        display: "standalone",
        orientation: "portrait",
        id: "https://nuri7.github.io/relationshipsanalyses/",
        start_url: "https://nuri7.github.io/relationshipsanalyses/",
        scope: "https://nuri7.github.io/relationshipsanalyses/",
        icons: [
          { src: "favicon.png", sizes: "192x192", type: "image/png" },
          { src: "app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
