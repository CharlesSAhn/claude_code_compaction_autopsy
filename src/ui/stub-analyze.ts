/**
 * TEMPORARY. Stands in for `analyze` until T2-engine lands; the integrator deletes it after the
 * merge. The only file in src/ui allowed to import from src/fixtures: the shell gets its session
 * source from here, with the fixtures' expected matched-action verdicts, so `pickDefault` lands on
 * the ticket case exactly as it will once the real verdicts come from `analyze`.
 *
 * Expected verdicts mirror src/domain/pending/default-demo.expected.test.ts (read, never imported).
 */
import type { Session } from '../domain'
import { fixtures } from '../fixtures/index.ts'
import { fromSessions, type SessionSource } from '../adapters/session-source.ts'

const EXPECTED_MATCHED: Record<string, boolean> = {
  'healthy-run2': false,
  'constructed-ticket': true,
  'constructed-file-edit': true,
}

export const stubSource: SessionSource = fromSessions(
  'fixtures',
  fixtures,
  (s: Session) => EXPECTED_MATCHED[s.id] ?? false,
)
