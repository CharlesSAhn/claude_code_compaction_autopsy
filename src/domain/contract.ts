/**
 * Compaction Autopsy — contract v1.
 *
 * The normalized model every adapter produces and every analysis and UI consumes.
 * Semantics, thresholds, and the closed word lists are documented in docs/contracts/contract.md.
 * The three claims (LOST, INCONSISTENT, CAUSED) have their fixed wording here and nowhere else;
 * everything else refers to these constants by name.
 *
 * This file is frozen by docs/contracts/FROZEN once the fixtures have pushed back on the types.
 */

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/** Where a session came from. The UI shows it; the default demo is chosen by it. */
export type Provenance =
  | { kind: 'observed-sanitized' }
  | { kind: 'experiment-derived'; run: string }
  | { kind: 'constructed'; note: string }

export type MessageKind = 'human' | 'assistant' | 'tool_use' | 'tool_result'

/**
 * What stage 4 inspects on a tool call. Present on tool_use messages only. Bounded by the
 * redactor, never the raw input: file path, command text, added text (Write content, Edit
 * new_string lines absent from old_string), or the MCP input as JSON.
 */
export interface ToolAction {
  tool: string
  toolUseId: string
  filePath?: string
  command?: string
  addedText?: string
  mcpInput?: string
}

/** A sanitized transcript record, enough for a timeline and for stages 4–5. Never the raw record. */
export interface Message {
  uuid: string
  ts: string
  line: number
  kind: MessageKind
  tool?: string
  /** Timeline only, at most LIMITS.excerpt characters. Never matched on. */
  excerpt: string
  /** Full redacted text of a human prompt; stage 5 matches on it. Present on human messages only. */
  text?: string
  action?: ToolAction
}

export type CompactionTrigger = 'auto' | 'manual'

export interface Compaction {
  boundaryUuid: string
  ts: string
  trigger: CompactionTrigger
  preTokens: number
  postTokens?: number
  summary: { uuid: string; lines: string[] }
}

export interface Session {
  id: string
  label: string
  provenance: Provenance
  claudeCodeVersion: string
  model: string
  messages: Message[]
  compactions: Compaction[]
  /**
   * Pre-labeled items (stage 1 output). Fixtures carry them, so extraction is the one stage the
   * demo skips. When absent, analyze runs extraction itself. Survival, evidence, downstream, and
   * restatement always run on the caller's side.
   */
  items?: Item[]
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export type ItemClass = 'negation' | 'positive' | 'fact'
export type EntityKind = 'path' | 'ticket' | 'host' | 'ident'

export interface Entity {
  kind: EntityKind
  value: string
}

/** value '*' is a class anchor: any value of that entity kind. */
export interface Anchor {
  kind: EntityKind
  value: string
}

export interface Origin {
  messageUuid: string
  ts: string
  line: number
}

export interface Item {
  id: string
  /** Index into Session.compactions of the boundary this item precedes. */
  compactionIndex: number
  text: string
  class: ItemClass
  entities: Entity[]
  anchors: Anchor[]
  origin: Origin
}

// ---------------------------------------------------------------------------
// Survival (stages 2–3)
// ---------------------------------------------------------------------------

export type Status = 'PRESERVED' | 'DEGRADED' | 'LOST'

export interface TokenMatch {
  /** Character offsets into the passage text; the source of truth for marks. */
  start: number
  end: number
  token: string
  fuzzy: boolean
  distance: number
}

export interface SurvivalEvidence {
  status: Status
  /** Overlap of item tokens against the best passage, 0 to 1. 1 when verbatim. */
  score: number
  verbatim: boolean
  /** Heading of the constraints-like section scored first, when the summary has one. */
  structuralSection?: string
  passage: { lineIndex: number; text: string }
  matches: TokenMatch[]
  /** Convenience rendering of `matches`: «…» for exact, «~…» for fuzzy. */
  markedSpan: string
  entitiesInPassage: string[]
  entitiesAnywhere: string[]
  thresholds: Thresholds
}

// ---------------------------------------------------------------------------
// Downstream (stages 4–5)
// ---------------------------------------------------------------------------

export type ArtifactKind =
  | 'mcp_comment'
  | 'mcp_issue'
  | 'commit'
  | 'changelog'
  | 'pr_body'
  | 'code_comment'
  | 'file_edit'
  | 'bash_write'

export type Matcher = 'forbidden_path' | 'forbidden_token' | 'style_token'

export type DownstreamResult = 'matched' | 'none_found' | 'none_matchable'

export interface ActionHit {
  toolUseId: string
  ts: string
  tool: string
  matcher: Matcher
  artifact: ArtifactKind
  excerpt: string
  afterRestatement: boolean
}

export interface DownstreamEvidence {
  result: DownstreamResult
  /** Present exactly when result is 'matched'. */
  hit?: ActionHit
  /** Artifact kinds the matcher inspected, from the scope-noun map. */
  scope: ArtifactKind[]
}

/** The user re-typing the rule after the boundary. */
export interface Restatement {
  messageUuid: string
  ts: string
  /** Stage-2 overlap of the restating sentence against the item; always computed. */
  score: number
  /** Which stage-5 rule fired: the score threshold, or all entities plus a negation word. */
  by: 'score' | 'entities'
}

// ---------------------------------------------------------------------------
// Result: mirrors the table from the real-data check
// ---------------------------------------------------------------------------

export interface ItemReport {
  item: Item
  survival: SurvivalEvidence
  downstream: DownstreamEvidence
  restatement?: Restatement
}

export interface Report {
  sessionId: string
  compactionIndex: number
  items: ItemReport[]
  closing: typeof CLOSING_LINE
}

/**
 * What analyze returns: the session and one report per compaction. Never fixture content;
 * fixtures are Sessions, and the expected reports live in test files the analyzer cannot see.
 */
export interface AnalyzedSession {
  session: Session
  reports: Report[]
}

// ---------------------------------------------------------------------------
// Fixed wording: the three claims
// ---------------------------------------------------------------------------

/** Status-neutral. Applied to any item whose downstream result is 'matched'. */
export const INCONSISTENT_LABEL = 'first observed downstream action inconsistent with this item' as const

/** Printed with every downstream result. CAUSED has no type, field, or flag: the tool never asserts it. */
export const CLOSING_LINE = 'We show the loss and the action. We do not claim one caused the other.' as const

/**
 * "Status entity": an anchor entity when the item has anchors (equal value, or the anchor's kind
 * for a class anchor), every entity otherwise. Present means as a whole token, or for a path a
 * token ending in '/' + the value; never a substring.
 */
export const STATUS_MEANING = {
  PRESERVED: 'score at or above the preserved threshold and every status entity present in the best passage',
  DEGRADED: 'not preserved, and either score at or above the degraded threshold or a status entity present somewhere in the summary',
  LOST: 'no passage at or above the degraded threshold and no status entity of the item anywhere in the summary',
} as const

// ---------------------------------------------------------------------------
// Thresholds and closed word lists (docs/contracts/contract.md)
// ---------------------------------------------------------------------------

export interface Thresholds {
  preserved: number
  degraded: number
  restated: number
  fuzzyMaxDistance: number
  fuzzyMinTokenLength: number
}

export const THRESHOLDS: Thresholds = {
  preserved: 0.75,
  degraded: 0.35,
  restated: 0.6,
  /** One edit. At two, `ticket` matched `picked` and `option` matched `portion` (T1-fixtures, 2026-09-16). */
  fuzzyMaxDistance: 1,
  fuzzyMinTokenLength: 6,
}

/** Sizes the fixtures' expected answers depend on. Part of the contract. */
export const LIMITS = {
  itemMinChars: 12,
  itemMaxChars: 300,
  tokenMinChars: 3,
  excerpt: 200,
  actionText: 4000,
  hitExcerpt: 120,
} as const

/** Entity and structure patterns, as regex sources. Part of the contract. */
export const PATTERNS = {
  path: String.raw`[\w./-]*[\w-]+\.(?:sh|py|ts|tsx|js|md|yaml|yml|json|txt)\b|\b(?:src|scripts|docs|config|logs)/[\w./-]+`,
  ticket: String.raw`\b[A-Z]{2,6}-\d{2,6}\b`,
  host: String.raw`\b[a-z0-9-]+\.(?:internal|local|com|io|net)\b`,
  /** Both parts at least two characters, so `e.g` is not an identifier. */
  ident: String.raw`\b[a-z_]{2,}\.[a-z_]{2,}\b|\b[a-z_]+\(\)|\b[a-z]+_[a-z]+\b`,
  token: String.raw`[a-z0-9_.\-]+(?:\(\))?`,
  heading: String.raw`^\s*(?:#{1,6}\s+|\d+\.\s+)`,
  changelogFile: String.raw`^CHANGELOG`,
  gitCommit: String.raw`\bgit\s+commit\b`,
  prBody: String.raw`\bgh\s+pr\s+(?:create|edit)\b`,
} as const

export const WORDS = {
  /** `stop` was dropped 2026-09-16: "the job will stop at 3am on host" is not a rule. */
  negation: ["don't", 'dont', 'do not', 'never', 'avoid', 'no longer'],
  positive: ['always', 'only', 'must', 'keep', 'use'],
  fact: ['moved to', 'decommissioned', 'is now', 'is gone', 'renamed', 'deprecated'],
  clauseBoundary: [',', ';', 'and', 'but', 'so', 'unless'],
  classNouns: {
    ticket: ['ticket id', 'ticket ids', 'ticket number', 'ticket numbers', 'ticket key', 'ticket keys',
      'issue id', 'issue ids', 'issue number', 'issue numbers', 'issue key', 'issue keys'],
    host: ['hostname', 'hostnames', 'host name', 'host names'],
    path: ['file path', 'file paths', 'file name', 'file names', 'path', 'paths'],
  },
  /** Matched as whole words, singular or plural (`\b<noun>s?\b`, case-insensitive). */
  scopeNouns: {
    comment: ['mcp_comment', 'code_comment'],
    'commit message': ['commit'],
    changelog: ['changelog'],
    'pr description': ['pr_body'],
    'pull request description': ['pr_body'],
    ticket: ['mcp_issue'],
    issue: ['mcp_issue'],
  } satisfies Record<string, ArtifactKind[]>,
  /** Kinds the forbidden-token matcher may inspect; "every kind" in the docs means these six. */
  tokenScopeKinds: ['mcp_comment', 'code_comment', 'commit', 'changelog', 'pr_body', 'mcp_issue'] satisfies ArtifactKind[],
  /** Precedence when one call is in scope under several kinds. */
  artifactPrecedence: ['mcp_comment', 'mcp_issue', 'commit', 'pr_body', 'changelog', 'code_comment'] satisfies ArtifactKind[],
  fileTools: ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'],
  structuralHeadings: ['constraint', 'rule', 'instruction', 'feedback', 'standing'],
  mcpReadVerbs: ['get', 'list', 'search', 'read', 'fetch', 'find', 'view', 'query'],
  mcpCommentNames: ['comment', 'issue', 'note'],
  mcpIssueNames: ['issue', 'ticket'],
  writePatterns: ['>', 'sed -i', 'tee', 'cp', 'mv', 'rm', 'git rm', 'git mv', 'touch', 'chmod'],
  codeFiles: {
    '.py': ['#'],
    '.sh': ['#'],
    '.ts': ['//', '/*', '*'],
    '.tsx': ['//', '/*', '*'],
    '.js': ['//', '/*', '*'],
    '.html': ['<!--'],
    '.htm': ['<!--'],
  },
  styleTokenFiles: ['.py', '.ts', '.tsx', '.js', '.sh'],
  /** Removed by normalization. Underscore is kept so identifiers survive. */
  markdownMarkers: ['*', '#', '>', '`'],
  stopwords: ['the', 'and', 'for', 'that', 'this', 'with', 'like', 'from', 'into', 'are', 'was', 'were',
    'has', 'have', 'its', 'you', 'your', 'our', 'they', 'them', 'then', 'than', 'also', 'just', 'any',
    'all', 'not', 'but', 'can', 'will'],
} as const
