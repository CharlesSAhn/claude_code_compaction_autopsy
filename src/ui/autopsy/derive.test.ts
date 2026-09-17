/**
 * The mark renderer builds «…» from `matches` offsets and agrees with the domain's `markedSpan`
 * on the committed expected data (healthy and ticket), plus the counts and the after window.
 */
import { describe, expect, it } from 'vitest'
import type { Report, Session, TokenMatch } from '../../domain'
import healthyParity from '../../specs/parity/healthy-run2.report.json'
import ticketParity from '../../specs/parity/constructed-ticket.report.json'
import { afterWindow, markSegments, markedString, notCheckableReason, questionCounts } from './derive.ts'

const healthy = (healthyParity as unknown as Record<string, Report>)['healthy-run2']
const ticket = (ticketParity as unknown as Record<string, Report>)['constructed-ticket']

describe('markedString from offsets', () => {
  for (const [name, report] of [
    ['healthy', healthy],
    ['ticket', ticket],
  ] as const) {
    for (const r of report.items) {
      it(`${name} ${r.item.id} equals the expected markedSpan`, () => {
        expect(markedString(r.survival.passage.text, r.survival.matches)).toBe(r.survival.markedSpan)
      })
    }
  }

  it('renders a fuzzy match as «~…» with its distance, and merges whitespace-adjacent exact tokens', () => {
    const text = 'never touch rotate_keys.sh or rotate keys again'
    const matches: TokenMatch[] = [
      { start: 0, end: 5, token: 'never', fuzzy: false, distance: 0 },
      { start: 6, end: 11, token: 'touch', fuzzy: false, distance: 0 },
      { start: 30, end: 36, token: 'rotate', fuzzy: true, distance: 1 },
    ]
    expect(markedString(text, matches)).toBe('«never touch» rotate_keys.sh or «~rotate»')
    const segs = markSegments(text, matches)
    expect(segs[0]).toEqual({ kind: 'exact', text: 'never touch', distance: 0 })
    expect(segs.find((s) => s.kind === 'fuzzy')).toEqual({ kind: 'fuzzy', text: 'rotate', distance: 1 })
    expect(segs.map((s) => s.text).join('')).toBe(text)
  })

  it('is empty with no matches and covers the whole text as plain', () => {
    expect(markedString('abc', [])).toBe('')
    expect(markSegments('abc', [])).toEqual([{ kind: 'plain', text: 'abc' }])
  })
})

describe('counts and empty states', () => {
  it('counts the healthy case: 4 items, 4 PRESERVED, 0 matched, 3 none found, 1 not checkable', () => {
    expect(questionCounts(healthy)).toEqual({
      items: 4,
      prompts: 4,
      preserved: 4,
      degraded: 0,
      lost: 0,
      matched: 0,
      noneFound: 3,
      notCheckable: 1,
    })
  })

  it('counts the ticket case: 1 DEGRADED, 1 matched', () => {
    const c = questionCounts(ticket)
    expect(c.degraded).toBe(1)
    expect(c.matched).toBe(1)
    expect(c.lost).toBe(0)
  })

  it('gives the reason by class', () => {
    const fact = healthy.items.find((r) => r.item.class === 'fact')
    if (!fact) throw new Error('no fact item')
    expect(notCheckableReason(fact.item)).toBe('a fact has no anchor')
    expect(notCheckableReason({ ...fact.item, class: 'positive' })).toBe('a positive rule has no anchor')
    expect(notCheckableReason({ ...fact.item, class: 'negation' })).toBe('no concrete or class anchor in the trigger clause')
  })

  it('after window: counts tool calls with actions from the boundary, closed by the next boundary or the end', () => {
    const base = { uuid: '', line: 0, excerpt: '' }
    const session: Session = {
      id: 's',
      label: 's',
      provenance: { kind: 'constructed', note: 'test' },
      claudeCodeVersion: '0',
      model: 'm',
      compactions: [
        { boundaryUuid: 'b1', ts: '2026-01-01T00:10:00Z', trigger: 'auto', preTokens: 1, summary: { uuid: 's1', lines: [] } },
        { boundaryUuid: 'b2', ts: '2026-01-01T00:20:00Z', trigger: 'manual', preTokens: 1, summary: { uuid: 's2', lines: [] } },
      ],
      messages: [
        { ...base, uuid: 'a', ts: '2026-01-01T00:05:00Z', kind: 'tool_use', tool: 'Edit', action: { tool: 'Edit', toolUseId: 't0' } },
        { ...base, uuid: 'b', ts: '2026-01-01T00:10:00Z', kind: 'tool_use', tool: 'Edit', action: { tool: 'Edit', toolUseId: 't1' } },
        { ...base, uuid: 'c', ts: '2026-01-01T00:15:00Z', kind: 'tool_use', tool: 'Read' },
        { ...base, uuid: 'd', ts: '2026-01-01T00:20:00Z', kind: 'tool_use', tool: 'Bash', action: { tool: 'Bash', toolUseId: 't2' } },
      ],
    }
    expect(afterWindow(session, 0)).toEqual({ scanned: 1, closedBy: 'until the next compaction at 2026-01-01T00:20:00Z' })
    expect(afterWindow(session, 1)).toEqual({ scanned: 1, closedBy: 'until the end of the session' })
  })
})
