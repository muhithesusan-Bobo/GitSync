import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@hazinahub/types',
        replacement: path.resolve(__dirname, './src/types/index.ts'),
      },
      {
        find: '@hazinahub/utils',
        replacement: path.resolve(__dirname, './src/utils/index.ts'),
      },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
})
