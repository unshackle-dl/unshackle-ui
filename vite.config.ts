import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true, // Enable external access
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://localhost:8888',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3000,
    host: true, // Enable external access for preview
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
