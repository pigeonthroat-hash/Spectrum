import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Change this to your GitHub repo name if using project pages
// e.g. '/Spectrum/'  or  '/' for username.github.io repo
const base = process.env.GITHUB_PAGES === 'true' ? '/Spectrum/' : './'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  base,
})
