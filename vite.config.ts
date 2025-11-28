import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use relative base path to ensure it works in both preview (root) and GitHub Pages (subdirectory)
  base: './', 
})