/**
 * The committed fixtures obey the contract and the T1 acceptance criteria. Runs in the default
 * suite. Expected analysis results are elsewhere (src/domain/pending), where the analyzer cannot
 * see them.
 */
import { describe, expect, it } from 'vitest'
import { fixtureSource, fixtures } from '../fixtures/index.ts'
import { EXCERPT_MAX } from '../adapters/claude-code-jsonl/index.ts'

describe('fixtures', () => {
  it('lists three sessions and defaults to the healthy one', () => {
    expect(fixtureSource.list().map((r) => r.id)).toEqual(['healthy-run2', 'constructed-ticket', 'constructed-file-edit'])
    expect(fixtureSource.defaultId()).toBe('healthy-run2')
  })

  it('carries the storyboarded provenance and notes', () => {
    const byId = Object.fromEntries(fixtures.map((s) => [s.id, s.provenance]))
    expect(byId['healthy-run2']).toEqual({ kind: 'experiment-derived', run: 'run2' })
    expect(byId['constructed-ticket']).toEqual({ kind: 'constructed', note: "based on a real event I can't show" })
    expect(byId['constructed-file-edit']).toMatchObject({ kind: 'constructed' })
    expect((byId['constructed-file-edit'] as { note: string }).note).toMatch(/constructed from the run 2 data/)
  })

  it.each(fixtures.map((s) => [s.id, s] as const))('%s: four pre-labeled items with origins that resolve', (_id, s) => {
    expect(s.items).toHaveLength(4)
    const uuids = new Set(s.messages.map((m) => m.uuid))
    for (const it of s.items ?? []) {
      expect(uuids.has(it.origin.messageUuid)).toBe(true)
      const msg = s.messages.find((m) => m.uuid === it.origin.messageUuid)
      expect(msg?.kind).toBe('human')
      expect(msg?.line).toBe(it.origin.line)
      expect(it.compactionIndex).toBe(0)
    }
  })

  it.each(fixtures.map((s) => [s.id, s] as const))('%s: excerpts are bounded and tool calls carry actions', (_id, s) => {
    for (const m of s.messages) {
      expect(m.excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX)
      if (m.kind === 'tool_use') expect(m.action?.tool).toBe(m.tool)
      else expect(m.action).toBeUndefined()
    }
  })

  it.each(fixtures.map((s) => [s.id, s] as const))('%s: no home path or username survives redaction', (_id, s) => {
    const text = JSON.stringify(s)
    expect(text).not.toMatch(/\/Users\//)
    expect(text).not.toMatch(/-Users-/)
  })

  it('the healthy fixture keeps run 2 facts', () => {
    const s = fixtures[0]
    expect(s.claudeCodeVersion).toBe('2.1.273')
    expect(s.compactions[0]).toMatchObject({ trigger: 'manual', preTokens: 235140, postTokens: 18667 })
    expect(s.messages).toHaveLength(204)
  })
})
