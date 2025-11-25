import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/VoltGraph-AI/',   // مهم: نفس اسم مستودع GitHub
  plugins: [react()],
})
