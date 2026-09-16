/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

// The expected-answer tests in src/domain/pending. Red until src/domain exports analyze.
export default defineConfig({
  test: {
    include: ['src/domain/pending/**/*.test.{ts,tsx}'],
  },
})
