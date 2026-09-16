/**
 * The default demo under the rule in docs/contracts/contract.md ("Provenance of a session"): the
 * highest-provenance session with a matched downstream action. With analyze's verdicts the two
 * constructed sessions have one and the healthy one has none, so the ticket case is the default.
 * Red until src/domain exports analyze.
 */
import { describe, expect, it } from 'vitest'
import type { AnalyzedSession, Session } from '../contract'
import { fixtures } from '../../fixtures/index.ts'
import { fromSessions } from '../../adapters/session-source.ts'

type Analyze = (s: Session) => AnalyzedSession

async function loadAnalyze(): Promise<Analyze> {
  const mod = (await import('../index')) as { analyze?: Analyze }
  expect(mod.analyze, 'src/domain does not export analyze yet').toBeDefined()
  return mod.analyze as Analyze
}

describe('default demo', () => {
  it('is the ticket case once analyze supplies the downstream verdicts', async () => {
    const analyze = await loadAnalyze()
    const hasMatched = (s: Session) => analyze(s).reports.some((r) => r.items.some((i) => i.downstream.result === 'matched'))
    expect(fixtures.map((s) => [s.id, hasMatched(s)])).toEqual([
      ['healthy-run2', false],
      ['constructed-ticket', true],
      ['constructed-file-edit', true],
    ])
    expect(fromSessions('fixtures', fixtures, hasMatched).defaultId()).toBe('constructed-ticket')
  })
})
