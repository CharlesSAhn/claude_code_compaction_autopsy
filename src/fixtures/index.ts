/**
 * The bundled demo sessions, committed JSON, static imports. Validated at load so a fixture
 * that drifts from the contract fails before the UI renders it.
 *
 * Regenerate: node scripts/build-fixtures.mjs … (healthy) then node scripts/construct-fixtures.mjs.
 */
import type { Session } from '../domain'
import { validateSession } from '../adapters/claude-code-jsonl/index.ts'
import { fromSessions, type SessionSource } from '../adapters/session-source.ts'
import healthyRun2 from './healthy-run2.json'
import constructedTicket from './constructed-ticket.json'
import constructedFileEdit from './constructed-file-edit.json'

export const fixtures: Session[] = [healthyRun2, constructedTicket, constructedFileEdit].map(validateSession)

export const fixtureSource: SessionSource = fromSessions('fixtures', fixtures)
