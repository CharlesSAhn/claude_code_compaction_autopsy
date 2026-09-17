/**
 * Smoke: the file-edit fixture opens, the compaction bar is clickable, and the LOST rule's trace
 * is visible with the contract's label and closing line rendered from the constants.
 */
import { expect, test } from '@playwright/test'
import { CLOSING_LINE, INCONSISTENT_LABEL } from '../src/domain/index.ts'

test('file-edit: the LOST trace is visible after clicking the compaction and the rule', async ({ page }) => {
  await page.goto('/?session=constructed-file-edit')
  await expect(page.locator('.autopsy')).toBeVisible()
  await expect(page.locator('.provenance__kind')).toHaveText('CONSTRUCTED')

  await page.locator('.timeline__boundary').first().click()
  await expect(page).toHaveURL(/session=constructed-file-edit/)

  const lostRow = page.locator('.ledger__row[data-status="LOST"]').first()
  await expect(lostRow).toBeVisible()
  await lostRow.locator('.ledger__select').click()

  const trace = page.locator('.trace')
  await expect(trace).toBeVisible()
  await expect(trace.locator('.step--compaction .status--lost')).toHaveText('LOST')
  await expect(trace.locator('.after__label')).toHaveText(INCONSISTENT_LABEL)
  await expect(trace.locator('.after')).toContainText('Edit')
  await expect(trace.locator('.closing').first()).toHaveText(CLOSING_LINE)
  await expect(trace).toContainText('restated at')
  await expect(page).toHaveURL(/item=0%3A51%3A0/)
})
