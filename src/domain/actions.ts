/**
 * Stage 4: the first observed downstream action inconsistent with an item, over ToolAction
 * shapes. Port of the stage-4 block of scripts/autopsy-check.py. Status-neutral; the label and
 * the closing line live in the contract and are never restated here.
 */
import {
  LIMITS,
  type Anchor,
  type ArtifactKind,
  type DownstreamEvidence,
  type Item,
  type Matcher,
  type ToolAction,
} from './contract'
import { entityPresent, norm } from './normalize'
import {
  ARTIFACT_PRECEDENCE,
  CHANGELOG_FILE,
  CLASS_RES,
  COMMENT_MARKERS,
  FILE_TOOLS,
  GIT_COMMIT,
  MCP_COMMENT,
  MCP_ISSUE,
  MCP_READ_VERBS,
  PR_BODY,
  SCOPE_NOUNS,
  STYLE_EXT,
  TOKEN_SCOPE_KINDS,
  escapeRegex,
} from './wordlists'

export interface PostTool {
  ts: string
  action: ToolAction
}

const HEREDOC = /<<-?\s*'?"?(\w+)'?"?\n([\s\S]*?)\n\1\b/g

export function stripLiterals(cmd: string): string {
  return cmd.replace(HEREDOC, '').replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '')
}

export function commitMessageText(cmd: string): string {
  if (!GIT_COMMIT.test(cmd)) return ''
  let text = Array.from(cmd.matchAll(HEREDOC), (m) => m[2]).join('\n')
  text += '\n' + Array.from(cmd.matchAll(/(?:-m|--message)[= ]+"((?:[^"\\]|\\.)*)"/g), (m) => m[1]).join('\n')
  text += '\n' + Array.from(cmd.matchAll(/(?:-m|--message)[= ]+'([^']*)'/g), (m) => m[1]).join('\n')
  return text.trim()
}

export function prBodyText(cmd: string): string {
  const m = PR_BODY.exec(cmd)
  return m ? cmd.slice(m.index + m[0].length) : ''
}

/** MCP calls are out of scope when any name part (split on `__`, `_`, `-`) is a read verb. */
export function mcpInScope(name: string): boolean {
  const parts = name
    .split(/__|_|-/)
    .filter((p) => p)
    .map((p) => p.toLowerCase())
  return name.startsWith('mcp__') && !parts.some((p) => MCP_READ_VERBS.has(p))
}

function extOf(fp: string): string {
  const base = fp.slice(fp.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot).toLowerCase() : ''
}

function baseName(fp: string): string {
  return fp.slice(fp.lastIndexOf('/') + 1)
}

/** Added lines of a code file that start with its comment marker; '' for non-code files. */
export function commentLines(fp: string, added: string): string {
  const markers = COMMENT_MARKERS[extOf(fp)]
  if (!markers) return ''
  return added
    .split('\n')
    .filter((l) => markers.some((mk) => l.trimStart().startsWith(mk)))
    .join('\n')
}

/** Stage 4 step 6: union of the kinds named by scope nouns; none named, the six token kinds. */
export function scopeOf(sentence: string): ArtifactKind[] {
  const out: ArtifactKind[] = []
  for (const [re, kinds] of SCOPE_NOUNS) {
    if (re.test(sentence)) for (const k of kinds) if (!out.includes(k)) out.push(k)
  }
  return out.length ? out : [...TOKEN_SCOPE_KINDS]
}

/** The in-scope text of one call under each kind, in precedence order. */
export function tokenTexts(action: ToolAction, scope: readonly ArtifactKind[]): [ArtifactKind, string][] {
  const name = action.tool
  const fp = action.filePath ?? ''
  const cmd = action.command ?? ''
  const added = action.addedText ?? ''
  const mcp = action.mcpInput ?? ''
  const out: [ArtifactKind, string][] = []
  for (const kind of ARTIFACT_PRECEDENCE) {
    if (!scope.includes(kind)) continue
    let t = ''
    if (kind === 'mcp_comment' && mcpInScope(name) && MCP_COMMENT.test(name)) t = mcp
    else if (kind === 'mcp_issue' && mcpInScope(name) && MCP_ISSUE.test(name)) t = mcp
    else if (kind === 'commit' && name === 'Bash') t = commitMessageText(cmd)
    else if (kind === 'pr_body' && name === 'Bash') t = prBodyText(cmd)
    else if (kind === 'changelog' && FILE_TOOLS.has(name) && CHANGELOG_FILE.test(baseName(fp))) t = added
    else if (kind === 'code_comment' && FILE_TOOLS.has(name)) t = commentLines(fp, added)
    if (t && t.trim()) out.push([kind, t])
  }
  return out
}

export function pathMatches(fp: string, anchor: string): boolean {
  return fp === anchor || fp.endsWith('/' + anchor)
}

/**
 * A write pattern applied to the anchor as a standalone token, literals stripped. The token may
 * be a longer path that ends with `/` + anchor (`/repo/scripts/x.sh`, `./scripts/x.sh`), the same
 * rule as the file-tool path match; a longer suffix (`old_scripts/x.sh`, `x.sh.bak`) is not it.
 */
export function bashWriteHit(cmd: string, anchor: string): boolean {
  // QA 2026-09-17 finding 16: `> "file"` is a write to file; unquote redirect targets before literals go.
  const c = stripLiterals(cmd.replace(/(>>?\s*)(["'])([^"'\n]+)\2/g, '$1$3'))
  const A = String.raw`(?<![\w.\-])` + escapeRegex(anchor) + String.raw`(?![\w.\-])`
  const anchorRe = new RegExp(A)
  const redirectRe = new RegExp(String.raw`(?:^|[^<>])>>?\s*(?:\S*/)?` + A)
  for (const seg of c.split(/\|\||&&|[|;\n]/)) {
    if (!anchorRe.test(seg)) continue
    if (redirectRe.test(seg)) return true
    const s = seg.trim()
    if (/^sed\b/.test(s) && /(?:^|\s)-i\b/.test(s)) return true
    if (/^(?:tee|cp|mv|rm|touch|chmod)\b/.test(s) || /^git\s+(?:rm|mv)\b/.test(s)) return true
  }
  return false
}

export function excerptAround(text: string, pos: number): string {
  const start = Math.max(0, pos - 40)
  return text.slice(start, start + LIMITS.hitExcerpt).replace(/\n/g, ' ')
}

export interface MatcherSpec {
  matcher: Matcher
  /** Anchor value; `*<kind>` for a class anchor; the call name (no parens) for a style token. */
  needle: string
  kind: Anchor['kind']
  scope: ArtifactKind[]
}

export function matchersOf(item: Item): MatcherSpec[] {
  const out: MatcherSpec[] = []
  for (const a of item.anchors) {
    if (a.kind === 'path' && a.value !== '*') out.push({ matcher: 'forbidden_path', needle: a.value, kind: a.kind, scope: ['file_edit', 'bash_write'] })
    else if (a.kind === 'ident' && a.value.endsWith('()')) out.push({ matcher: 'style_token', needle: a.value.slice(0, -2), kind: a.kind, scope: ['file_edit'] })
    else out.push({ matcher: 'forbidden_token', needle: a.value === '*' ? '*' + a.kind : a.value, kind: a.kind, scope: scopeOf(item.text) })
  }
  return out
}

/**
 * Where a whole-token anchor sits in the raw text, for the excerpt: the same boundaries as
 * `entityPresent`, case-insensitive; a plain case-insensitive find as the fallback.
 */
export function tokenPosition(text: string, needle: string): number {
  const re = new RegExp(String.raw`(?<![\w\-])(?<!\w\.)(?<!/)` + escapeRegex(needle) + String.raw`(?![\w\-])(?!\.\w)`, 'i')
  const m = re.exec(text)
  if (m) return m.index
  return Math.max(text.toLowerCase().indexOf(needle.toLowerCase()), 0)
}

/** Walk the post-boundary tool calls in order; the first call any matcher hits wins. */
export function firstInconsistent(item: Item, postTools: readonly PostTool[], restatedTs: string | undefined): DownstreamEvidence {
  const ms = matchersOf(item)
  const scope: ArtifactKind[] = []
  for (const m of ms) for (const k of m.scope) if (!scope.includes(k)) scope.push(k)
  if (!ms.length) return { result: 'none_matchable', scope: [] }
  for (const { ts, action } of postTools) {
    const name = action.tool
    for (const { matcher, needle, kind, scope: sc } of ms) {
      let hit: [ArtifactKind, string] | undefined
      if (matcher === 'forbidden_path') {
        const fp = action.filePath ?? ''
        if (FILE_TOOLS.has(name) && fp && pathMatches(fp, needle)) hit = ['file_edit', fp.slice(0, LIMITS.hitExcerpt)]
        else if (name === 'Bash' && bashWriteHit(action.command ?? '', needle)) {
          const cmd = action.command ?? ''
          hit = ['bash_write', excerptAround(cmd, Math.max(cmd.indexOf(needle), 0))]
        }
      } else if (matcher === 'style_token') {
        const fp = action.filePath ?? ''
        const added = action.addedText ?? ''
        if (FILE_TOOLS.has(name) && STYLE_EXT.some((ext) => fp.toLowerCase().endsWith(ext))) {
          const m = new RegExp(String.raw`\b` + escapeRegex(needle) + String.raw`\(`).exec(added)
          if (m) hit = ['file_edit', excerptAround(added, m.index)]
        }
      } else {
        for (const [artifactKind, text] of tokenTexts(action, sc)) {
          if (needle.startsWith('*')) {
            const m = CLASS_RES[needle.slice(1) as keyof typeof CLASS_RES].exec(text)
            if (m) hit = [artifactKind, excerptAround(text, m.index)]
          } else if (entityPresent(kind, needle, norm(text))) {
            // Contract v2: whole token, the same rule as survival, never a substring.
            hit = [artifactKind, excerptAround(text, tokenPosition(text, needle))]
          }
          if (hit) break
        }
      }
      if (hit) {
        return {
          result: 'matched',
          scope,
          hit: {
            toolUseId: action.toolUseId,
            ts,
            tool: name,
            matcher,
            artifact: hit[0],
            excerpt: hit[1],
            afterRestatement: Boolean(restatedTs && ts > restatedTs),
          },
        }
      }
    }
  }
  return { result: 'none_found', scope }
}
