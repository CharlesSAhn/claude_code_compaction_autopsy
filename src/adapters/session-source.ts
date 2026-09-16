/**
 * The one door for session data.
 *
 * Fixtures and real data both arrive as a Session through a SessionSource; the UI calls
 * domain.analyze on it at load. Fixtures: a source over the committed JSON in src/fixtures,
 * whose Sessions carry pre-labeled items. Real data, later: a source that runs the Claude Code
 * JSONL adapter on the text it is given, with no items, so analyze extracts them.
 *
 * Reaches the domain only through src/domain (architecture rule R2).
 */
import type { Provenance, Session } from '../domain'

/**
 * Enough to render a picker. itemCount is the pre-labeled count, 0 when the source carries no
 * items. hasMatchedAction is true when analyze reports at least one item whose downstream result
 * is 'matched'; the source learns it from the caller, since the adapter never analyzes.
 */
export interface SessionRef {
  id: string
  label: string
  provenance: Provenance
  claudeCodeVersion: string
  itemCount: number
  hasMatchedAction: boolean
}

export interface SessionSource {
  /** Where the sessions come from. Shown in the UI next to the provenance. */
  readonly kind: 'fixtures' | 'jsonl'
  list(): SessionRef[]
  get(id: string): Session | undefined
  /** The default demo, by the rule in docs/contracts/contract.md ("Provenance of a session"). */
  defaultId(): string | undefined
}

/** Provenance rank, highest first (contract: "Provenance of a session"). */
const PROVENANCE_RANK: Record<Provenance['kind'], number> = {
  'observed-sanitized': 0,
  'experiment-derived': 1,
  constructed: 2,
}

/**
 * Shared rule for the default demo, so every source picks the same way: the highest-ranked
 * session with a matched downstream action, ties by most items then list order; when none has
 * one, the highest-ranked session with the most items.
 */
export function pickDefault(refs: readonly SessionRef[]): string | undefined {
  if (refs.length === 0) return undefined
  const withAction = refs.filter((r) => r.hasMatchedAction)
  const pool = withAction.length > 0 ? withAction : refs
  return pool.reduce((best, r) => {
    const rb = PROVENANCE_RANK[best.provenance.kind]
    const rr = PROVENANCE_RANK[r.provenance.kind]
    if (rr < rb) return r
    if (rr === rb && r.itemCount > best.itemCount) return r
    return best
  }).id
}

/**
 * Build a source over in-memory sessions (the fixtures case). hasMatchedAction is the caller's
 * verdict per session, normally from analyze; absent, no session is taken to have one.
 */
export function fromSessions(
  kind: SessionSource['kind'],
  sessions: readonly Session[],
  hasMatchedAction: (s: Session) => boolean = () => false,
): SessionSource {
  const refs: SessionRef[] = sessions.map((s) => ({
    id: s.id,
    label: s.label,
    provenance: s.provenance,
    claudeCodeVersion: s.claudeCodeVersion,
    itemCount: s.items?.length ?? 0,
    hasMatchedAction: hasMatchedAction(s),
  }))
  return {
    kind,
    list: () => refs,
    get: (id) => sessions.find((s) => s.id === id),
    defaultId: () => pickDefault(refs),
  }
}
