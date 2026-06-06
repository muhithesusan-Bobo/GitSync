import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@hazinahub/types': path.resolve(__dirname, '../packages/types/src'),
      '@hazinahub/utils': path.resolve(__dirname, '../packages/utils/src'),
    },
  },
})
