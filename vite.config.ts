import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,            // Lets devices outside your machine connect
    allowedHosts: true,    // Accept any ngrok/dev tunnel without moaning
    port: 5173             // Optional, just makes it explicit
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions'],
          lucide: ['lucide-react'],
        },
      },
    },
  }
})
