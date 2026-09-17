#!/usr/bin/env node
/**
 * Four screenshots of a running build, for a reviewer who cannot click:
 *   1 landing            the default session as it opens
 *   2 compaction-clicked the timeline's compaction bar clicked
 *   3 lost-trace         the file-edit fixture, its LOST rule selected, the trace open
 *   4 story              the same item in the story view
 * Usage: node scripts/screenshots.mjs <base url> [out dir]   (default out dir: screenshots/, gitignored)
 * Uses the machine's Google Chrome through Playwright's "chrome" channel.
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const base = (process.argv[2] ?? 'http://localhost:4173').replace(/\/$/, '')
const out = process.argv[3] ?? 'screenshots'
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
const shot = async (name) => {
  const path = join(out, `${name}.png`)
  await page.screenshot({ path, fullPage: true })
  console.log(`${path}  ${page.url()}`)
}

await page.goto(`${base}/`)
await page.locator('.autopsy').waitFor()
await shot('1-landing')

await page.locator('.timeline__boundary').first().click()
await page.waitForTimeout(300)
await shot('2-compaction-clicked')

await page.goto(`${base}/?session=constructed-file-edit`)
await page.locator('.autopsy').waitFor()
await page.locator('.timeline__boundary').first().click()
await page.locator('.ledger__row[data-status="LOST"] .ledger__select').first().click()
await page.locator('.trace').waitFor()
await shot('3-lost-trace')

await page.getByRole('button', { name: 'Story', exact: true }).click()
await page.locator('.story-host svg').waitFor()
await page.waitForTimeout(300)
await shot('4-story')

await browser.close()
