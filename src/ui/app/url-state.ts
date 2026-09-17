/**
 * The four query keys the screen carries: session, compaction, item, view. Read on load, written
 * on every change, no routing. A missing or unknown value falls back to the default.
 */
import type { SessionSource } from '../../adapters/session-source.ts'

export type View = 'ledger' | 'story' | 'evidence'

export const VIEWS: readonly View[] = ['ledger', 'story', 'evidence']
export const DEFAULT_VIEW: View = 'ledger'

export interface UrlState {
  session: string | undefined
  compaction: number
  item: string | undefined
  view: View
}

export interface UrlDefaults {
  /** Known session ids; an unknown `session=` falls back to `defaultSession`. */
  sessionIds: readonly string[]
  defaultSession: string | undefined
  /** Number of compactions of the resolved session; out-of-range `compaction=` falls back to 0. */
  compactionCount?: number
  /** Known item ids of the resolved session; unknown `item=` is dropped. */
  itemIds?: readonly string[]
}

function isView(v: string | null): v is View {
  return v !== null && (VIEWS as readonly string[]).includes(v)
}

export function parseUrlState(search: string, defaults: UrlDefaults): UrlState {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const rawSession = params.get('session')
  const session =
    rawSession !== null && defaults.sessionIds.includes(rawSession) ? rawSession : defaults.defaultSession

  const rawCompaction = params.get('compaction')
  const n = rawCompaction === null ? NaN : Number(rawCompaction)
  const max = defaults.compactionCount ?? Number.POSITIVE_INFINITY
  const compaction = Number.isInteger(n) && n >= 0 && n < max ? n : 0

  const rawItem = params.get('item')
  const item =
    rawItem !== null && rawItem !== '' && (defaults.itemIds === undefined || defaults.itemIds.includes(rawItem))
      ? rawItem
      : undefined

  const rawView = params.get('view')
  const view = isView(rawView) ? rawView : DEFAULT_VIEW

  return { session, compaction, item, view }
}

/** The query string for a state, leading `?`; empty string when nothing needs carrying. */
export function serializeUrlState(state: UrlState): string {
  const params = new URLSearchParams()
  if (state.session !== undefined) params.set('session', state.session)
  if (state.compaction !== 0) params.set('compaction', String(state.compaction))
  if (state.item !== undefined) params.set('item', state.item)
  if (state.view !== DEFAULT_VIEW) params.set('view', state.view)
  const s = params.toString()
  return s === '' ? '' : `?${s}`
}

/** The browser's query string; '' when there is no window (tests, server render). */
export function currentSearch(): string {
  return typeof window === 'undefined' ? '' : window.location.search
}

/**
 * The state for a query string over a source: the session is resolved first, then `compaction=`
 * and `item=` are bounded by that session, so nothing the URL cannot derive from it survives.
 */
export function initialUrlState(source: SessionSource, search: string): UrlState {
  const base: UrlDefaults = { sessionIds: source.list().map((r) => r.id), defaultSession: source.defaultId() }
  const first = parseUrlState(search, base)
  const session = first.session !== undefined ? source.get(first.session) : undefined
  return parseUrlState(search, {
    ...base,
    compactionCount: session?.compactions.length ?? 0,
    itemIds: session?.items?.map((i) => i.id) ?? [],
  })
}

/** Write the state to the browser URL without a navigation; no-op without a window. */
export function writeUrlState(state: UrlState): void {
  if (typeof window === 'undefined') return
  const { pathname, search, hash } = window.location
  const next = `${pathname}${serializeUrlState(state)}${hash}`
  if (next !== `${pathname}${search}${hash}`) window.history.replaceState(null, '', next)
}
