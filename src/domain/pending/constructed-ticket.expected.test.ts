/**
 * Expected answers for the constructed ticket fixture: the summary keeps VLX-4127 as a work
 * item and drops the rule; a comment call after names the ticket. Red until analyze exists.
 * Survival values computed with the reference implementation on this fixture's summary.
 */
import { describe, expect, it } from 'vitest'
import type { AnalyzedSession, Session } from '../contract'
import { fixtures } from '../../fixtures/index.ts'

type Analyze = (s: Session) => AnalyzedSession

async function loadAnalyze(): Promise<Analyze> {
  const mod = (await import('../index')) as { analyze?: Analyze }
  expect(mod.analyze, 'src/domain does not export analyze yet').toBeDefined()
  return mod.analyze as Analyze
}

const session = fixtures.find((s) => s.id === 'constructed-ticket') as Session

describe('constructed-ticket, expected report', () => {
  it('the ticket rule is DEGRADED: entity kept as a work item, rule gone', async () => {
    const { reports } = (await loadAnalyze())(session)
    const byId = Object.fromEntries(reports[0].items.map((r) => [r.item.id, r]))
    const s = byId['0:91:1'].survival
    expect(s.status).toBe('DEGRADED')
    expect(s.verbatim).toBe(false)
    expect(s.score).toBeCloseTo(0.18, 2)
    expect(s.entitiesAnywhere).toContain('VLX-4127')
    expect(s.markedSpan).toContain('VLX-4127')
    for (const id of ['0:51:0', '0:127:2', '0:157:3']) expect(byId[id].survival.status).toBe('PRESERVED')
  })

  it('first observed downstream action inconsistent with the ticket rule: the comment call', async () => {
    const { reports } = (await loadAnalyze())(session)
    const byId = Object.fromEntries(reports[0].items.map((r) => [r.item.id, r]))
    const d = byId['0:91:1'].downstream
    expect(d.result).toBe('matched')
    expect(d.hit).toMatchObject({
      toolUseId: 'toolu-c-ticket-0001',
      tool: 'mcp__tracker__save_comment',
      matcher: 'forbidden_token',
      artifact: 'mcp_comment',
      afterRestatement: false,
    })
    expect(d.hit?.ts).toBe(session.messages.find((m) => m.uuid === 'c-ticket-0001')?.ts)
    expect(d.hit?.excerpt).toContain('VLX-4127')
    expect(byId['0:91:1'].restatement).toBeUndefined()
    expect(byId['0:51:0'].downstream.result).toBe('none_found')
    expect(byId['0:127:2'].downstream.result).toBe('none_found')
    expect(byId['0:157:3'].downstream.result).toBe('none_matchable')
  })
})
