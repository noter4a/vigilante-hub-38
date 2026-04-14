import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api/wazuh': {
        target: 'https://127.0.0.1:55000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/wazuh/, '')
      },
      '/api/opensearch': {
        target: 'https://127.0.0.1:9200',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/opensearch/, '')
      }
    }
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
