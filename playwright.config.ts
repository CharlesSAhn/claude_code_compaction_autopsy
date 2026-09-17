/**
 * Playwright, kept minimal: one smoke spec under e2e/ against a running build. BASE_URL picks
 * the target (default: the local preview). Uses the machine's Google Chrome (channel "chrome"),
 * so no browser download is needed. Start the target first: `npm run build && npm run preview`.
 */
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:4173',
    channel: 'chrome',
    viewport: { width: 1280, height: 900 },
    screenshot: 'only-on-failure',
  },
  outputDir: 'test-results',
})
