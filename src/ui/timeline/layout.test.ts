import { describe, expect, it } from 'vitest'
import type { Compaction, Message, Session } from '../../domain'
import { boundaryPosition, formatTime, timelineRows } from './layout.ts'

function msg(uuid: string, ts: string): Message {
  return { uuid, ts, line: 1, kind: 'human', excerpt: uuid }
}

function compaction(ts: string): Compaction {
  return { boundaryUuid: 'b', ts, trigger: 'auto', preTokens: 10, summary: { uuid: 'summary', lines: ['x'] } }
}

const messages = [msg('a', '2026-01-01T00:00:01Z'), msg('b', '2026-01-01T00:00:02Z'), msg('c', '2026-01-01T00:00:03Z')]

describe('timeline layout', () => {
  it('places the boundary after the last message at or before its timestamp', () => {
    expect(boundaryPosition(messages, compaction('2026-01-01T00:00:00Z'))).toBe(0)
    expect(boundaryPosition(messages, compaction('2026-01-01T00:00:02Z'))).toBe(2)
    expect(boundaryPosition(messages, compaction('2026-01-01T00:00:02.500Z'))).toBe(2)
    expect(boundaryPosition(messages, compaction('2026-01-01T00:00:09Z'))).toBe(3)
  })

  it('builds rows in order with the boundary row inserted, never a summary message', () => {
    const session: Session = {
      id: 's',
      label: 's',
      provenance: { kind: 'constructed', note: 'n' },
      claudeCodeVersion: '0',
      model: 'm',
      messages: [...messages, msg('summary', '2026-01-01T00:00:04Z')],
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
