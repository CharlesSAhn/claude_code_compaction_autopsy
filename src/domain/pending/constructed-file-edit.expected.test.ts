/**
 * Expected answers for the constructed file-edit fixture: the summary drops every mention of
 * scripts/rotate_keys.sh; an Edit hits the file two minutes after the boundary; ten minutes
 * later the human re-types the rule. Red until analyze exists.
 *
 * Status of the don't-modify item follows the T1 ruling (Type feedback 2): the storyboard says
 * LOST; the contract as written says DEGRADED because rotate_keys.py stays in the summary
 * (reference score 0.20). EXPECTED_FILE_RULE_STATUS is the single line that changes.
 */
import { describe, expect, it } from 'vitest'
import type { AnalyzedSession, Session, Status } from '../contract'
import { fixtures } from '../../fixtures/index.ts'

const EXPECTED_FILE_RULE_STATUS: Status = 'LOST'

type Analyze = (s: Session) => AnalyzedSession

async function loadAnalyze(): Promise<Analyze> {
  const mod = (await import('../index')) as { analyze?: Analyze }
  expect(mod.analyze, 'src/domain does not export analyze yet').toBeDefined()
  return mod.analyze as Analyze
}

const session = fixtures.find((s) => s.id === 'constructed-file-edit') as Session

describe('constructed-file-edit, expected report', () => {
  it("the don't-modify rule is gone from the summary", async () => {
    const { reports } = (await loadAnalyze())(session)
    const byId = Object.fromEntries(reports[0].items.map((r) => [r.item.id, r]))
    const s = byId['0:51:0'].survival
    expect(s.status).toBe(EXPECTED_FILE_RULE_STATUS)
    expect(s.verbatim).toBe(false)
    expect(s.score).toBeLessThan(0.35)
    expect(s.entitiesAnywhere).not.toContain('scripts/rotate_keys.sh')
    for (const id of ['0:91:1', '0:127:2', '0:157:3']) expect(byId[id].survival.status).toBe('PRESERVED')
  })

  it('first observed downstream action inconsistent with the rule: the Edit, before the restatement', async () => {
    const { reports } = (await loadAnalyze())(session)
    const byId = Object.fromEntries(reports[0].items.map((r) => [r.item.id, r]))
    const d = byId['0:51:0'].downstream
    expect(d.result).toBe('matched')
    expect(d.hit).toMatchObject({
      toolUseId: 'toolu-c-file-0002',
      tool: 'Edit',
      matcher: 'forbidden_path',
      artifact: 'file_edit',
      afterRestatement: false,
    })
    expect(d.hit?.ts).toBe(session.messages.find((m) => m.uuid === 'c-file-0002')?.ts)
  })

  it('the human re-typed the rule ten minutes later', async () => {
    const { reports } = (await loadAnalyze())(session)
    const byId = Object.fromEntries(reports[0].items.map((r) => [r.item.id, r]))
    const r = byId['0:51:0'].restatement
    expect(r?.messageUuid).toBe('c-file-0003')
    expect(r?.score ?? 0).toBeGreaterThanOrEqual(0.6)
    expect(r?.ts).toBe(session.messages.find((m) => m.uuid === 'c-file-0003')?.ts)
    expect(byId['0:91:1'].downstream.result).toBe('none_found')
    expect(byId['0:127:2'].downstream.result).toBe('none_found')
    expect(byId['0:157:3'].downstream.result).toBe('none_matchable')
    for (const id of ['0:91:1', '0:127:2', '0:157:3']) expect(byId[id].restatement).toBeUndefined()
  })
})
