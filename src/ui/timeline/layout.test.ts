import { describe, expect, it } from 'vitest'
import type { Compaction, Message, Session } from '../../domain'
import { boundaryPosition, formatTime, timelineRows } from './layout.ts'

function msg(uuid: string, ts: string): Message {
  return { uuid, ts, line: 1, kind: 'human', excerpt: uuid }
}

function compaction(ts: string): Compaction {
  return { boundaryUuid: 'b', ts, trigger: 'auto', preTokens: 10, summary: { uuid: 'summary', lines: ['x'] } }
}

// Uniform millisecond ISO format, as the adapter emits it: the contract compares ts lexically.
const messages = [msg('a', '2026-01-01T00:00:01.000Z'), msg('b', '2026-01-01T00:00:02.000Z'), msg('c', '2026-01-01T00:00:03.000Z')]

describe('timeline layout', () => {
  it('places the boundary before the first message at or after its timestamp, as the domain does', () => {
    expect(boundaryPosition(messages, compaction('2026-01-01T00:00:00.000Z'))).toBe(0)
    expect(boundaryPosition(messages, compaction('2026-01-01T00:00:02.000Z'))).toBe(1)
    expect(boundaryPosition(messages, compaction('2026-01-01T00:00:02.500Z'))).toBe(2)
    expect(boundaryPosition(messages, compaction('2026-01-01T00:00:09.000Z'))).toBe(3)
  })

  it('builds rows in order with the boundary row inserted, never a summary message', () => {
    const session: Session = {
      id: 's',
      label: 's',
      provenance: { kind: 'constructed', note: 'n' },
      claudeCodeVersion: '0',
      model: 'm',
      messages: [...messages, msg('summary', '2026-01-01T00:00:04.000Z')],
      compactions: [compaction('2026-01-01T00:00:02.500Z')],
    }
    const rows = timelineRows(session)
    expect(rows.map((r) => (r.kind === 'message' ? r.message.uuid : `boundary:${r.compactionIndex}`))).toEqual([
      'a',
      'b',
      'boundary:0',
      'c',
    ])
  })

  it('formats the time as HH:MM:SS UTC', () => {
    expect(formatTime('2026-09-16T18:38:48.874Z')).toBe('18:38:48')
    expect(formatTime('not a time')).toBe('not a time')
  })
})
