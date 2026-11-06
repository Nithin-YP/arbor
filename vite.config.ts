import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The app talks to Ollama through this dev-server proxy (/ollama -> :11434),
// so the browser never makes a cross-origin request and OLLAMA_ORIGINS needs no changes.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/ollama': {
        target: 'http://127.0.0.1:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ollama/, ''),
      },
    },
  },
})
