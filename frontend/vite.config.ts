import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const API_TARGET = process.env.VITE_API_PROXY ?? 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rolldownOptions: {
      output: {
        // Libraries that change rarely are kept apart from the app's own code, so a release of the app does not make
        // every visitor download them again, and no single file is large.
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'vendor-query', test: /node_modules[\\/]@tanstack[\\/]/, priority: 20 },
            { name: 'vendor-i18n', test: /node_modules[\\/](i18next|react-i18next)[\\/]/, priority: 20 },
            { name: 'vendor-codemirror', test: /node_modules[\\/](@codemirror|@lezer|style-mod|w3c-keyname|crelt)[\\/]/, priority: 25 },
            { name: 'vendor-markdown', test: /node_modules[\\/](markdown-it|mdurl|entities|linkify-it|uc\.micro)[\\/]/, priority: 25 },
            { name: 'vendor-forms', test: /node_modules[\\/](react-hook-form|@hookform|zod)[\\/]/, priority: 20 },
          ],
        },
      },
    },
  },
  server: {
    // The Laravel API is same-origin from the browser's point of view.
    proxy: { '/api': { target: API_TARGET, changeOrigin: true } },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    maxWorkers: 4,
    testTimeout: 20000,
    exclude: ['node_modules', 'dist', 'src/test/contract/**'],
  },
})
