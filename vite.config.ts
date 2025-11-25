import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Setting base to './' allows the app to be deployed to any path (e.g., /repo-name/)
  // without needing to specify the exact repo name hardcoded here.
  base: '/VoltGraph-AI/', 
})
