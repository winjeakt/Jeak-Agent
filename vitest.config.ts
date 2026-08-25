import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/plugins/loader/**/*.ts',
        'src/plugins/marketplace/**/*.ts',
        'src/main/services/AIService.ts',
        'src/shared/languageDetection.ts'
      ],
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'coverage'
    }
  }
})
