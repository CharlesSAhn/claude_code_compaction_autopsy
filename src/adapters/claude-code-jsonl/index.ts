/**
 * Claude Code JSONL adapter: text → Session. Pure; runs in Node unbuilt (type stripping) and in
 * the browser. Used by scripts/build-fixtures.mjs to produce committed fixtures, and later by a
 * real-data SessionSource.
 */
export { parseJsonl, textOf, isHumanPrompt, toolUses } from './parse.ts'
export type { RawRecord, RawBlock } from './parse.ts'
export { toSession, excerpt, toolExcerpt, EXCERPT_MAX } from './to-session.ts'
export type { ToSessionOptions } from './to-session.ts'
export { redactSession, redactString } from './redact.ts'
export type { RedactOptions } from './redact.ts'
export { validateSession, SessionValidationError } from './validate-session.ts'
