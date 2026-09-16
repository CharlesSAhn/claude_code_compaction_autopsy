/**
 * The frozen contract has not moved: every path listed in docs/contracts/FROZEN still hashes to
 * the value recorded there. Skipped while FROZEN does not exist. Refreeze procedure: the
 * /freeze-contract skill.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const FROZEN = resolve(ROOT, 'docs/contracts/FROZEN')

function entries(): Array<{ hash: string; path: string }> {
  return readFileSync(FROZEN, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      const [hash, path] = l.trim().split(/\s+\*?/)
      return { hash, path }
    })
}

describe('frozen contract', () => {
  it.skipIf(!existsSync(FROZEN))('every file listed in docs/contracts/FROZEN still matches its recorded sha256', () => {
    const list = entries()
    expect(list.length).toBeGreaterThan(0)
    for (const { hash, path } of list) {
      const actual = createHash('sha256').update(readFileSync(resolve(ROOT, path))).digest('hex')
      expect(actual, `${path} differs from docs/contracts/FROZEN; refreeze via /freeze-contract`).toBe(hash)
    }
  })
})
