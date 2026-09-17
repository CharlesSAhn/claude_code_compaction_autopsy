/**
 * Session → AnalyzedSession. Stages 2–5 over each compaction; stage 1 first when the session
 * carries no items. The types and semantics it satisfies are frozen in contract.ts and
 * docs/contracts/contract.md; this function bends to them, not the other way round.
 *
 * Regions are by timestamp (contract, "Regions"): before compaction i is every message with ts
 * below compactions[i].ts and above the previous boundary; after is every message with ts
 * above it, up to the next boundary.
 */
import { CLOSING_LINE, type AnalyzedSession, type Item, type ItemReport, type Message, type Report, type Session } from './contract'
import { firstInconsistent, type PostTool } from './actions'
import { extractItems } from './items'
import { restatementOf } from './restatement'
import { scoreItem } from './survival'

function before(session: Session, i: number): Message[] {
  const hi = session.compactions[i].ts
  const lo = i > 0 ? session.compactions[i - 1].ts : undefined
  return session.messages.filter((m) => m.ts < hi && (lo === undefined || m.ts > lo))
}

function after(session: Session, i: number): Message[] {
  const lo = session.compactions[i].ts
  const hi = i + 1 < session.compactions.length ? session.compactions[i + 1].ts : undefined
  return session.messages.filter((m) => m.ts > lo && (hi === undefined || m.ts < hi))
}

function itemsFor(session: Session, i: number): Item[] {
  if (session.items) return session.items.filter((it) => it.compactionIndex === i)
  return extractItems(before(session, i), i)
}

export function analyze(session: Session): AnalyzedSession {
  const reports: Report[] = session.compactions.map((c, i) => {
    const post = after(session, i)
    const postTools: PostTool[] = post
      .filter((m) => m.kind === 'tool_use' && m.action)
      .map((m) => ({ ts: m.ts, action: m.action as NonNullable<Message['action']> }))
    const postHumans = post.filter((m) => m.kind === 'human')
    const items: ItemReport[] = itemsFor(session, i).map((item) => {
      const survival = scoreItem(item, c.summary.lines)
      const restatement = restatementOf(item, postHumans)
      const downstream = firstInconsistent(item, postTools, restatement?.ts)
      const row: ItemReport = { item, survival, downstream }
      if (restatement) row.restatement = restatement
      return row
    })
    return { sessionId: session.id, compactionIndex: i, items, closing: CLOSING_LINE }
  })
  return { session, reports }
}
