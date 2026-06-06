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
        replacement: path.resolve(__dirname, '../packages/types/src/index.ts'),
      },
      {
        find: '@hazinahub/utils',
        replacement: path.resolve(__dirname, '../packages/utils/src/index.ts'),
      },
      {
        find: /^@hazinahub\/(.*)$/,
        replacement: path.resolve(__dirname, '../packages/$1/src/index.ts'),
      },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
})
