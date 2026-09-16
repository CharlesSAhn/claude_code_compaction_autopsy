/**
 * Expected answers for the healthy fixture. Red until src/domain exports analyze.
 * Values come from the reference implementation's table (docs/specs/algorithm-v1.md).
 */
import { describe, expect, it } from 'vitest'
import { CLOSING_LINE, type AnalyzedSession, type Session } from '../contract'
import { fixtures } from '../../fixtures/index.ts'

type Analyze = (s: Session) => AnalyzedSession

async function loadAnalyze(): Promise<Analyze> {
  const mod = (await import('../index')) as { analyze?: Analyze }
  expect(mod.analyze, 'src/domain does not export analyze yet').toBeDefined()
  return mod.analyze as Analyze
}

const session = fixtures.find((s) => s.id === 'healthy-run2') as Session

describe('healthy-run2, expected report', () => {
  it('one report, four items, all PRESERVED at 1.00, verbatim', async () => {
    const { reports } = (await loadAnalyze())(session)
    expect(reports).toHaveLength(1)
    const byId = Object.fromEntries(reports[0].items.map((r) => [r.item.id, r]))
    for (const id of ['0:51:0', '0:91:1', '0:127:2', '0:157:3']) {
      expect(byId[id].survival.status).toBe('PRESERVED')
      expect(byId[id].survival.score).toBe(1)
      expect(byId[id].survival.verbatim).toBe(true)
      expect(byId[id].survival.markedSpan.startsWith('«')).toBe(true)
      expect(byId[id].restatement).toBeUndefined()
    }
  })

  it('downstream: none found for the three rules, none matchable for the fact', async () => {
    const { reports } = (await loadAnalyze())(session)
    const byId = Object.fromEntries(reports[0].items.map((r) => [r.item.id, r]))
    expect(byId['0:51:0'].downstream).toMatchObject({ result: 'none_found' })
    expect(byId['0:91:1'].downstream).toMatchObject({ result: 'none_found' })
    expect(byId['0:91:1'].downstream.scope.sort()).toEqual(['changelog', 'code_comment', 'commit', 'mcp_comment', 'mcp_issue'])
    expect(byId['0:127:2'].downstream).toMatchObject({ result: 'none_found' })
    expect(byId['0:157:3'].downstream).toMatchObject({ result: 'none_matchable', scope: [] })
    for (const r of reports[0].items) expect(r.downstream.hit).toBeUndefined()
    expect(reports[0].closing).toBe(CLOSING_LINE)
  })

  it('anchors as pre-labeled: path, ticket class, print(), none', async () => {
    const { reports } = (await loadAnalyze())(session)
    const byId = Object.fromEntries(reports[0].items.map((r) => [r.item.id, r]))
    expect(byId['0:51:0'].item.anchors).toEqual([{ kind: 'path', value: 'scripts/rotate_keys.sh' }])
    expect(byId['0:91:1'].item.anchors).toEqual([{ kind: 'ticket', value: '*' }])
    expect(byId['0:127:2'].item.anchors).toEqual([{ kind: 'ident', value: 'print()' }])
    expect(byId['0:157:3'].item.anchors).toEqual([])
  })
})
