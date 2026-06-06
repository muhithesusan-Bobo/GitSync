import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@hazinahub\/(.*)$/,
        replacement: path.resolve(__dirname, '../packages/$1/src'),
      },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
})
