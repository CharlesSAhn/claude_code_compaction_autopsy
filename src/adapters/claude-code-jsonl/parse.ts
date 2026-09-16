/**
 * Claude Code JSONL: text → typed records. One record per line, unparseable lines skipped.
 * Field shapes: docs/specs/session-files.md.
 */

export interface RawBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: unknown
}

export interface RawRecord {
  /** 1-based line number in the file; the anchor a human greps for. */
  line: number
  type?: string
  subtype?: string
  uuid?: string
  parentUuid?: string
  timestamp?: string
  sessionId?: string
  version?: string
  isMeta?: boolean
  isSidechain?: boolean
  isCompactSummary?: boolean
  compactMetadata?: {
    trigger?: string
    preTokens?: number
    postTokens?: number
  }
  message?: {
    role?: string
    model?: string
    content?: string | RawBlock[]
  }
}

export function parseJsonl(text: string): RawRecord[] {
  const out: RawRecord[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim()
    if (!l) continue
    try {
      const o = JSON.parse(l) as Omit<RawRecord, 'line'>
      out.push({ ...o, line: i + 1 })
    } catch {
      continue
    }
  }
  return out
}

/** The text of a record's message: a string, or the joined text blocks. */
export function textOf(r: RawRecord): string {
  const c = r.message?.content
  if (typeof c === 'string') return c
  if (!Array.isArray(c)) return ''
  return c
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('')
}

/** A human prompt: type user, not meta, not sidechain, text without tool_result, not a slash-command echo. */
export function isHumanPrompt(r: RawRecord): boolean {
  if (r.type !== 'user' || r.isMeta || r.isSidechain || r.isCompactSummary) return false
  const c = r.message?.content
  if (typeof c === 'string') return c.trim().length > 0 && !isCommandEcho(c)
  if (!Array.isArray(c)) return false
  if (c.some((b) => b.type === 'tool_result')) return false
  const t = textOf(r)
  return t.trim().length > 0 && !isCommandEcho(t)
}

function isCommandEcho(t: string): boolean {
  const s = t.trimStart()
  return s.startsWith('<command-name>') || s.startsWith('<local-command')
}

export function toolUses(r: RawRecord): RawBlock[] {
  const c = r.message?.content
  if (r.type !== 'assistant' || !Array.isArray(c)) return []
  return c.filter((b) => b.type === 'tool_use')
}
