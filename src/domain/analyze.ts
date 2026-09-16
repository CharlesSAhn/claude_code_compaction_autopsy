/**
 * Session → AnalyzedSession. Stages 2–5 over each compaction (stage 1 first when the session
 * carries no items). Stub: the expected reports live in src/domain/pending and stay red until
 * this is implemented. The types and semantics it must satisfy are frozen; this function bends
 * to them, not the other way round.
 */
import type { AnalyzedSession, Session } from './contract'

export function analyze(_session: Session): AnalyzedSession {
  throw new Error('not implemented')
}
