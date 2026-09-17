/**
 * Timeline layout helpers: pure, no DOM. Where the boundary sits among the messages, and the row
 * list the component renders. Reads Session types only; no analysis.
 */
import type { Compaction, Message, MessageKind, Session } from '../../domain'

export type TimelineRow =
  | { kind: 'message'; message: Message }
  | { kind: 'boundary'; compaction: Compaction; compactionIndex: number }

/**
 * Index in `messages` before which the boundary bar is placed: the count of leading messages
 * whose timestamp is at or before the compaction's. Messages are in session order.
 */
export function boundaryPosition(messages: readonly Message[], compaction: Compaction): number {
  const at = Date.parse(compaction.ts)
  let n = 0
  for (const m of messages) {
    if (Date.parse(m.ts) <= at) n += 1
    else break
  }
  return n
}

/**
 * One row per message in order, with each compaction's boundary row inserted at its timestamp
 * position. The summary record is never a message row: the boundary row is the only trace of the
 * compaction.
 */
export function timelineRows(session: Session): TimelineRow[] {
  const summaryIds = new Set(session.compactions.map((c) => c.summary.uuid))
  const visible = session.messages.filter((m) => !summaryIds.has(m.uuid))
  const rows: TimelineRow[] = visible.map((message) => ({ kind: 'message', message }))
  const inserts = session.compactions
    .map((compaction, compactionIndex) => ({
      compaction,
      compactionIndex,
      at: boundaryPosition(visible, compaction),
    }))
    .sort((a, b) => b.at - a.at || b.compactionIndex - a.compactionIndex)
  for (const { compaction, compactionIndex, at } of inserts) {
    rows.splice(at, 0, { kind: 'boundary', compaction, compactionIndex })
  }
  return rows
}

export const KIND_GLYPH: Record<MessageKind, string> = {
  human: '>',
  assistant: '<',
  tool_use: '#',
  tool_result: '=',
}

/** The DOM id of a message row, so the trace, drawer, and story can scroll to it. */
export function messageRowId(uuid: string): string {
  return `msg-${uuid}`
}

/** HH:MM:SS UTC from an ISO timestamp; the raw string when it does not parse. */
export function formatTime(ts: string): string {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toISOString().slice(11, 19)
}
