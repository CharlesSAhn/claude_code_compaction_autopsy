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

/** Enough to render a picker. itemCount is the pre-labeled count, 0 when the source carries no items. */
export interface SessionRef {
  id: string
  label: string
  provenance: Provenance
  claudeCodeVersion: string
  itemCount: number
}

export interface SessionSource {
  /** Where the sessions come from. Shown in the UI next to the provenance. */
  readonly kind: 'fixtures' | 'jsonl'
  list(): SessionRef[]
  get(id: string): Session | undefined
  /** The default demo: an observed-sanitized or experiment-derived session with the most items. Never constructed. */
  defaultId(): string | undefined
}

/** Shared rule for the default demo, so every source picks the same way. */
export function pickDefault(refs: readonly SessionRef[]): string | undefined {
  const eligible = refs.filter((r) => r.provenance.kind !== 'constructed')
  if (eligible.length === 0) return undefined
  return eligible.reduce((best, r) => (r.itemCount > best.itemCount ? r : best)).id
}

/** Build a source over in-memory sessions (the fixtures case). */
export function fromSessions(kind: SessionSource['kind'], sessions: readonly Session[]): SessionSource {
  const refs: SessionRef[] = sessions.map((s) => ({
    id: s.id,
    label: s.label,
    provenance: s.provenance,
    claudeCodeVersion: s.claudeCodeVersion,
    itemCount: s.items?.length ?? 0,
  }))
  return {
    kind,
    list: () => refs,
    get: (id) => sessions.find((s) => s.id === id),
    defaultId: () => pickDefault(refs),
  }
}
