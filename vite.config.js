/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const bgwebProxy = {
  '/bgweb-api': {
    target: 'http://127.0.0.1:8080',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/bgweb-api/, ''),
  },
  /** Engine BFF — run `npm run engine-bff` (batches + cache, then talks to GNU). */
  '/engine-bff': {
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/engine-bff/, ''),
  },
}

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 300_000,
    poolOptions: { threads: { singleThread: true } },
    include: ['src/debug/**/*.test.js'],
  },
  server: {
    proxy: {
      // Browser → `docker run --rm -p 8080:8080 foochu/bgweb-api:latest`
      ...bgwebProxy,
    },
  },
  preview: { proxy: { ...bgwebProxy } },
})
