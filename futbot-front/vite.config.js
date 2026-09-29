import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,                   // escucha en 0.0.0.0, obligatorio en Docker
    port: 5173,
  }
})
