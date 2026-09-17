/**
 * Pure derivations for the autopsy panel: the five counts, the after-window facts the report does
 * not carry, and marks rendered from `survival.matches` offsets (never from `markedSpan`).
 * No DOM, no React. Reads contract types through the domain's entry point only.
 */
import type { Item, ItemReport, Message, Report, Session, TokenMatch } from '../../domain'
import { NOT_CHECKABLE_REASON, WINDOW_END_OF_SESSION, windowNextCompaction } from './strings.ts'

export interface QuestionCounts {
  items: number
  prompts: number
  preserved: number
  degraded: number
  lost: number
  matched: number
  noneFound: number
  notCheckable: number
}

export function questionCounts(report: Report): QuestionCounts {
  const prompts = new Set(report.items.map((r) => r.item.origin.messageUuid))
  const by = <T extends string>(pick: (r: ItemReport) => T, v: T) => report.items.filter((r) => pick(r) === v).length
  return {
    items: report.items.length,
    prompts: prompts.size,
    preserved: by((r) => r.survival.status, 'PRESERVED'),
    degraded: by((r) => r.survival.status, 'DEGRADED'),
    lost: by((r) => r.survival.status, 'LOST'),
    matched: by((r) => r.downstream.result, 'matched'),
    noneFound: by((r) => r.downstream.result, 'none_found'),
    notCheckable: by((r) => r.downstream.result, 'none_matchable'),
  }
}

export function notCheckableReason(item: Item): string {
  return NOT_CHECKABLE_REASON[item.class]
}

/**
 * The after window of a compaction, the same half-open region the domain scans: messages with ts
 * from the boundary (inclusive) up to the next boundary (exclusive), or to the end of the session.
 * `scanned` counts the tool calls that carry an action in that window: every call the downstream
 * matcher walked, not the calls in an item's scope. The report carries no count; a scanned count
 * and a window-end reason from the analyzer are logged as a v3 candidate in
 * docs/CONTRACT-ISSUES.md. Until then the UI words it as what it counts: tool calls after the
 * compaction.
 */
export interface AfterWindow {
  scanned: number
  closedBy: string
}

export function afterWindow(session: Session, compactionIndex: number): AfterWindow {
  const lo = session.compactions[compactionIndex]?.ts
  const next = session.compactions[compactionIndex + 1]
  const inWindow = (m: Message) => lo !== undefined && m.ts >= lo && (next === undefined || m.ts < next.ts)
  const scanned = session.messages.filter((m) => inWindow(m) && m.kind === 'tool_use' && m.action !== undefined).length
  return { scanned, closedBy: next === undefined ? WINDOW_END_OF_SESSION : windowNextCompaction(next.ts) }
}

/** The message a tool call came from, by its tool-use id; undefined when the session lacks it. */
export function messageOfToolUse(session: Session, toolUseId: string): Message | undefined {
  return session.messages.find((m) => m.action?.toolUseId === toolUseId)
}

// ---------------------------------------------------------------------------
// Marks from offsets
// ---------------------------------------------------------------------------

export type MarkSegment =
  | { kind: 'plain'; text: string }
  | { kind: 'exact' | 'fuzzy'; text: string; distance: number }

interface Phrase {
  a: number
  b: number
  fuzzy: boolean
  distance: number
}

/**
 * Merge the offsets the same way the domain does for `markedSpan`: dedupe, sort, then join
 * neighbouring matches of the same kind separated by whitespace only. Offsets are the source of
 * truth; the string form is never parsed.
 */
function phrasesOf(text: string, matches: readonly TokenMatch[]): Phrase[] {
  const seen = new Set<string>()
  const hits: Phrase[] = []
  for (const m of matches) {
    const key = `${m.start}:${m.end}:${m.fuzzy}`
    if (seen.has(key)) continue
    seen.add(key)
    hits.push({ a: m.start, b: m.end, fuzzy: m.fuzzy, distance: m.distance })
  }
  hits.sort((x, y) => x.a - y.a || x.b - y.b || Number(x.fuzzy) - Number(y.fuzzy))
  const phrases: Phrase[] = []
  for (const h of hits) {
    const last = phrases[phrases.length - 1]
    if (last && text.slice(last.b, h.a).trim() === '' && last.fuzzy === h.fuzzy) {
      last.b = Math.max(last.b, h.b)
      last.distance = Math.max(last.distance, h.distance)
    } else phrases.push({ ...h })
  }
  return phrases
}

/** The whole text as segments, marked spans from the offsets, plain text between them. */
export function markSegments(text: string, matches: readonly TokenMatch[]): MarkSegment[] {
  const out: MarkSegment[] = []
  let pos = 0
  for (const p of phrasesOf(text, matches)) {
    if (p.a > pos) out.push({ kind: 'plain', text: text.slice(pos, p.a) })
    out.push({ kind: p.fuzzy ? 'fuzzy' : 'exact', text: text.slice(p.a, p.b), distance: p.distance })
    pos = p.b
  }
  if (pos < text.length) out.push({ kind: 'plain', text: text.slice(pos) })
  return out
}

/**
 * The «…» string form of the marks, from the first mark to the last: exact `«…»`, fuzzy `«~…»`.
 * Built from offsets so it can be checked against the domain's `markedSpan` in tests.
 */
export function markedString(text: string, matches: readonly TokenMatch[]): string {
  const segs = markSegments(text, matches)
  const first = segs.findIndex((s) => s.kind !== 'plain')
  if (first < 0) return ''
  let last = segs.length - 1
  while (segs[last].kind === 'plain') last -= 1
  return segs
    .slice(first, last + 1)
    .map((s) => (s.kind === 'plain' ? s.text : s.kind === 'fuzzy' ? `«~${s.text}»` : `«${s.text}»`))
    .join('')
}

/** First `n` characters of a passage, with an ellipsis when cut (spec: "its first 160 characters"). */
export function clip(text: string, n = 160): string {
  return text.length <= n ? text : `${text.slice(0, n)}…`
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
