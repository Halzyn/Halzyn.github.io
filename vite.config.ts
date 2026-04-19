import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// User site: https://<user>.github.io/ — assets load from root.
export default defineConfig({
  plugins: [react()],
  base: '/',
})
