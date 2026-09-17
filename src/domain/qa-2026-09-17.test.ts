/**
 * Regression tests for the QA review of 2026-09-17 (docs/reviews/2026-09-17-qa.md), findings 1, 3,
 * 8, and 16: a path followed by `/` is a directory prefix, not the path; a quoted redirect target is
 * a write; structural heading words match as whole words; the changelog filename is case-insensitive.
 */
import { describe, expect, it } from 'vitest'
import { bashWriteHit, tokenTexts } from './actions'
import { entityPresent, norm } from './normalize'
import { structuralSections } from './survival'

describe('QA finding 1: path presence never matches a directory prefix', () => {
  it('a/b.sh is not present in a/b.sh/c.md, but is at a token end or after a longer prefix', () => {
    expect(entityPresent('path', 'scripts/deploy.sh', norm('summary mentions scripts/deploy.sh/notes.md'))).toBe(false)
    expect(entityPresent('path', 'scripts/deploy.sh', norm('never edit scripts/deploy.sh directly'))).toBe(true)
    expect(entityPresent('path', 'scripts/deploy.sh', norm('see /repo/scripts/deploy.sh.'))).toBe(true)
    expect(entityPresent('path', 'scripts/deploy.sh', norm('scripts/deploy.sh.bak is a copy'))).toBe(false)
  })
})

describe('QA finding 16: a quoted redirect target is a write', () => {
  it('matches > "file" and >> \'file\', still ignores the anchor inside an unrelated string', () => {
    expect(bashWriteHit('echo x > "rotate_keys.sh"', 'rotate_keys.sh')).toBe(true)
    expect(bashWriteHit("echo x >> 'scripts/rotate_keys.sh'", 'scripts/rotate_keys.sh')).toBe(true)
    expect(bashWriteHit('echo "rotate_keys.sh is fine" > notes.txt', 'rotate_keys.sh')).toBe(false)
  })
})

describe('QA finding 8: structural heading words are whole words', () => {
  it('Outstanding and Understanding are not constraints-like; Constraints and Standing rules are', () => {
    const lines = ['## Outstanding work', '- a', '## Understanding the code', '- b', '## Constraints', '- c', '## Standing rules', '- d']
    expect(structuralSections(lines).map((s) => s.heading)).toEqual(['## Constraints', '## Standing rules'])
  })
})

describe('QA finding 16b: changelog filename match is case-insensitive', () => {
  it('docs/changelog.md is a changelog artifact for a file tool', () => {
    const texts = tokenTexts({ tool: 'Edit', toolUseId: 't', filePath: '/repo/docs/changelog.md', addedText: 'VLX-4127 shipped' }, ['changelog'])
    expect(texts).toEqual([['changelog', 'VLX-4127 shipped']])
    const other = tokenTexts({ tool: 'Edit', toolUseId: 't', filePath: '/repo/docs/notes.md', addedText: 'VLX-4127 shipped' }, ['changelog'])
    expect(other).toEqual([])
  })
})
