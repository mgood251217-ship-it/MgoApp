import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // tambahkan blok ini
  clearScreen: false,
  server: {
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});