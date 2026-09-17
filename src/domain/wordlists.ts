/**
 * Compiled forms of the contract's closed word lists and patterns. Nothing here is a new word:
 * every regex is built from WORDS, PATTERNS, THRESHOLDS, LIMITS in contract.ts, so the frozen
 * lists stay the single source. Mirrors the constants block of scripts/autopsy-check.py.
 */
import { PATTERNS, WORDS, type ArtifactKind, type EntityKind } from './contract'

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')
}

const alt = (words: readonly string[]) => words.map(escapeRegex).join('|')

export const NEG = new RegExp(String.raw`\b(${alt(WORDS.negation)})\b`, 'i')
export const POS = new RegExp(String.raw`\b(${alt(WORDS.positive)})\b`, 'i')
export const FACT = new RegExp(String.raw`\b(${alt(WORDS.fact)})\b`, 'i')

/** Entity regexes in extraction order; the contract's path pattern split at its `|`. */
export const ENT_RES: ReadonlyArray<readonly [EntityKind, RegExp]> = [
  ['path', new RegExp(PATTERNS.path.split('|\\b(?:')[0], 'g')],
  ['path', new RegExp('\\b(?:' + PATTERNS.path.split('|\\b(?:')[1], 'g')],
  ['ticket', new RegExp(PATTERNS.ticket, 'g')],
  ['host', new RegExp(PATTERNS.host, 'g')],
  ['ident', new RegExp(PATTERNS.ident, 'g')],
]

/** The class-anchor regex per kind: the contract pattern for that kind. */
export const CLASS_RES: Record<EntityKind, RegExp> = {
  path: new RegExp(PATTERNS.path),
  ticket: new RegExp(PATTERNS.ticket),
  host: new RegExp(PATTERNS.host),
  ident: new RegExp(PATTERNS.ident),
}

export const STOP = new Set<string>(WORDS.stopwords)
export const HEADING = new RegExp(PATTERNS.heading)
export const HEAD_WORDS = new RegExp(WORDS.structuralHeadings.join('|'), 'i')
export const FILE_TOOLS = new Set<string>(WORDS.fileTools)
export const MCP_READ_VERBS = new Set<string>(WORDS.mcpReadVerbs)
export const MCP_COMMENT = new RegExp(WORDS.mcpCommentNames.join('|'), 'i')
export const MCP_ISSUE = new RegExp(WORDS.mcpIssueNames.join('|'), 'i')

/** Stage 4 step 6: whole words, singular or plural, in the contract's order. */
export const SCOPE_NOUNS: ReadonlyArray<readonly [RegExp, readonly ArtifactKind[]]> = Object.entries(
  WORDS.scopeNouns,
).map(([noun, kinds]) => [new RegExp(String.raw`\b${escapeRegex(noun)}s?\b`, 'i'), kinds] as const)

export const TOKEN_SCOPE_KINDS: readonly ArtifactKind[] = WORDS.tokenScopeKinds
export const ARTIFACT_PRECEDENCE: readonly ArtifactKind[] = WORDS.artifactPrecedence
export const COMMENT_MARKERS: Readonly<Record<string, readonly string[]>> = WORDS.codeFiles
export const STYLE_EXT: readonly string[] = WORDS.styleTokenFiles

/** Stage 4 step 2: the clause boundary list, `,` `;` as characters, the words as whole words. */
export const BOUNDARY = new RegExp(
  WORDS.clauseBoundary.map((b) => (/^\w+$/.test(b) ? String.raw`\b${b}\b` : escapeRegex(b))).join('|'),
  'i',
)

/** Stage 4 step 4: class nouns, from the contract's list, whole words. */
export const CLASS_NOUNS: ReadonlyArray<readonly [EntityKind, RegExp]> = (
  Object.entries(WORDS.classNouns) as [EntityKind, readonly string[]][]
).map(([kind, nouns]) => [kind, new RegExp(String.raw`\b(?:${alt(nouns)})\b`, 'i')] as const)

export const CHANGELOG_FILE = new RegExp(PATTERNS.changelogFile)
export const GIT_COMMIT = new RegExp(PATTERNS.gitCommit)
export const PR_BODY = new RegExp(PATTERNS.prBody)

export const QUOTES = '`\'"‘’“”'
export const MARKERS = WORDS.markdownMarkers.join('')
export const QUOTE_CLASS = new RegExp('[' + escapeRegex(QUOTES) + ']', 'g')
export const QUOTE_MARKER_CLASS = new RegExp('[' + escapeRegex(QUOTES + MARKERS) + ']', 'g')
