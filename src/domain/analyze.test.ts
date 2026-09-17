/**
 * analyze over a synthetic session: two boundaries give two reports with items assigned by
 * timestamp region; the summary quoting a rule is not a restatement; the closing line is on
 * every report.
 */
import { describe, expect, it } from 'vitest'
import { CLOSING_LINE, type Message, type Session } from './contract'
import { analyze } from './analyze'

const T = (m: number) => `2026-09-16T18:${String(m).padStart(2, '0')}:00.000Z`

function human(uuid: string, min: number, line: number, text: string): Message {
  return { uuid, ts: T(min), line, kind: 'human', excerpt: text.slice(0, 40), text }
}

function edit(uuid: string, min: number, line: number, filePath: string): Message {
  return {
    uuid,
    ts: T(min),
    line,
    kind: 'tool_use',
    tool: 'Edit',
    excerpt: filePath,
    action: { tool: 'Edit', toolUseId: `toolu-${uuid}`, filePath, addedText: 'x = 2' },
  }
}

const RULE_A = "don't modify scripts/rotate_keys.sh, platform team owns it"
const RULE_B = 'never mention VLX-4127'

const session: Session = {
  id: 'two-boundaries',
  label: 'two boundaries',
  provenance: { kind: 'constructed', note: 'synthetic, unit test' },
  claudeCodeVersion: '0.0.0',
  model: 'test',
  messages: [
    human('h1', 1, 1, RULE_A),
    edit('e1', 5, 5, '/repo/scripts/rotate_keys.sh'),
    human('h2', 12, 12, RULE_B),
    human('h3', 13, 13, "wait. don't modify scripts/rotate_keys.sh, platform team owns it"),
    edit('e2', 25, 25, '/repo/scripts/rotate_keys.sh'),
  ],
  compactions: [
    { boundaryUuid: 'b1', ts: T(10), trigger: 'auto', preTokens: 100, summary: { uuid: 's1', lines: ['# Summary', `The user said: "${RULE_A}".`] } },
    { boundaryUuid: 'b2', ts: T(20), trigger: 'manual', preTokens: 100, summary: { uuid: 's2', lines: ['# Summary', 'Work on the tracker item continues.'] } },
  ],
}

describe('analyze, two boundaries', () => {
  const { reports } = analyze(session)

  it('one report per compaction, closing line on each', () => {
    expect(reports.map((r) => [r.sessionId, r.compactionIndex, r.closing])).toEqual([
      ['two-boundaries', 0, CLOSING_LINE],
      ['two-boundaries', 1, CLOSING_LINE],
    ])
  })

  it('items are assigned to the boundary whose region holds their message', () => {
    expect(reports[0].items.map((r) => [r.item.id, r.item.text])).toEqual([['0:1:0', RULE_A]])
    expect(reports[1].items.map((r) => [r.item.id, r.item.text])).toEqual([
      ['1:12:0', RULE_B],
      ['1:13:1', RULE_A], // "wait." is under itemMinChars and is not an item
    ])
  })

  it('the first boundary: rule preserved, edit in its region not seen after the boundary, restatement from the human not the summary', () => {
    const row = reports[0].items[0]
    expect(row.survival.status).toBe('PRESERVED')
    expect(row.survival.verbatim).toBe(true)
    // The edit at 18:05 is before the boundary; the one at 18:25 is past the next boundary.
    expect(row.downstream).toEqual({ result: 'none_found', scope: ['file_edit', 'bash_write'] })
    expect(row.restatement).toMatchObject({ messageUuid: 'h3', ts: T(13), by: 'score' })
  })

  it('the second boundary: the ticket rule is lost, the file rule sees the edit after it', () => {
    const [ticket, file] = reports[1].items
    expect(ticket.survival.status).toBe('LOST')
    expect(ticket.downstream).toEqual({
      result: 'none_found',
      scope: ['mcp_comment', 'code_comment', 'commit', 'changelog', 'pr_body', 'mcp_issue'],
    })
    expect(file.downstream.result).toBe('matched')
    expect(file.downstream.hit).toMatchObject({ toolUseId: 'toolu-e2', ts: T(25), afterRestatement: false })
    expect(file.restatement).toBeUndefined()
  })

  it('pre-labeled items are trusted and routed by compactionIndex', () => {
    const labeled: Session = { ...session, items: analyze(session).reports.flatMap((r) => r.items.map((i) => i.item)) }
    const again = analyze(labeled)
    expect(again.reports.map((r) => r.items.map((i) => i.item.id))).toEqual([['0:1:0'], ['1:12:0', '1:13:1']])
    expect(again.reports).toEqual(reports)
  })
})

describe('analyze, messages at exactly a boundary timestamp', () => {
  // h0 before the first boundary; hb and e at exactly the first boundary's ts.
  const edge: Session = {
    ...session,
    id: 'edge',
    messages: [human('h0', 1, 1, RULE_A), human('hb', 10, 10, RULE_B), edit('e', 10, 11, '/repo/scripts/rotate_keys.sh')],
  }
  const { reports } = analyze(edge)

  it('a message at the boundary ts is after that boundary and before the next', () => {
    expect(reports[0].items.map((r) => r.item.id)).toEqual(['0:1:0'])
    expect(reports[1].items.map((r) => [r.item.id, r.item.text])).toEqual([['1:10:0', RULE_B]])
  })

  it('a tool call at the boundary ts is walked as a downstream action of that boundary', () => {
    expect(reports[0].items[0].downstream.result).toBe('matched')
    expect(reports[0].items[0].downstream.hit).toMatchObject({ toolUseId: 'toolu-e', ts: T(10) })
  })

  it('no message is in no region', () => {
    const seen = reports.flatMap((r) => r.items.map((i) => i.item.origin.messageUuid))
    expect(seen.sort()).toEqual(['h0', 'hb'])
  })
})
