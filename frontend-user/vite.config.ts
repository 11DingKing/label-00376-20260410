/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  // @ts-ignore - vitest config
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/utils/**', 'src/composables/**', 'src/components/**'],
      exclude: ['**/*.d.ts', '**/*.worker.ts', '**/*.worker.js', '**/*.spec.ts', '**/*.test.ts', '**/*.spec.js', '**/*.test.js'],
    },
  },
})
