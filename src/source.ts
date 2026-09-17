/**
 * The analyzed fixture source. `analyze` runs on every fixture once, at load; its matched-action
 * verdicts feed the source so the default demo follows the contract's rule (the ticket case).
 * Nothing under src/ui imports src/fixtures (architecture rule R5): sessions reach the shell
 * through this source as a prop. T4-autopsy reads the reports from `analyzedSessions`.
 */
import { analyze, type AnalyzedSession } from './domain'
import { fixtures } from './fixtures/index.ts'
import { fromSessions, type SessionSource } from './adapters/session-source.ts'

/** One analysis per fixture, computed at load. */
export const analyzedSessions: ReadonlyMap<string, AnalyzedSession> = new Map(
  fixtures.map((s) => [s.id, analyze(s)]),
)

export const analyzedSource: SessionSource = fromSessions('fixtures', fixtures, (s) =>
  (analyzedSessions.get(s.id)?.reports ?? []).some((r) =>
    r.items.some((i) => i.downstream.result === 'matched'),
  ),
)
