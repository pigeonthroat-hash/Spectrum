import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'path'

// Change this to your GitHub repo name if using project pages
// e.g. '/Spectrum/'  or  '/' for username.github.io repo
const base = process.env.GITHUB_PAGES === 'true' ? '/Spectrum/' : './'

// Only enable single-file mode when we explicitly ask for it
const isSingleFile = process.env.SINGLE_FILE === 'true'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    isSingleFile && viteSingleFile(),
  ].filter(Boolean),

  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },

  server: {
    port: 5173,
  },

  base,

  // Only apply these aggressive settings when doing a single-file build
  build: isSingleFile
    ? {
        assetsInlineLimit: 100000000,
        chunkSizeWarningLimit: 100000000,
        cssCodeSplit: false,
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
          },
        },
      }
    : undefined,
})