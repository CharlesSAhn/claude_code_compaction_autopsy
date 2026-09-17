/**
 * Stage 2 text primitives: normalization, tokens with offsets, Levenshtein, passage scoring,
 * whole-token entity presence, the marked span. Port of the same functions in
 * scripts/autopsy-check.py; every rule is in docs/specs/algorithm-v1.md stage 2–3.
 */
import { LIMITS, THRESHOLDS, type EntityKind, type TokenMatch } from './contract'
import { QUOTE_CLASS, QUOTE_MARKER_CLASS, STOP, escapeRegex } from './wordlists'

/** Curly apostrophes to straight, before trigger matching. */
export function straight(s: string): string {
  return s.replace(/’/g, "'").replace(/‘/g, "'")
}

/** Lowercase, drop quotes and markdown markers, collapse whitespace. */
export function norm(s: string): string {
  return s.toLowerCase().replace(QUOTE_MARKER_CLASS, '').replace(/\s+/g, ' ').trim()
}

const TOKEN_RAW = /[A-Za-z0-9_.\-'‘’]+(?:\(\))?/g
const EDGE = ".-'‘’"

export interface RawToken {
  text: string
  start: number
  end: number
}

/** Tokens with offsets into the raw text; text normalized, edge punctuation never included. */
export function rawTokens(s: string): RawToken[] {
  const out: RawToken[] = []
  for (const m of s.matchAll(TOKEN_RAW)) {
    let raw = m[0]
    let a = m.index
    while (raw && EDGE.includes(raw[0])) {
      raw = raw.slice(1)
      a += 1
    }
    const tail = raw.endsWith('()') ? '()' : ''
    let core = tail ? raw.slice(0, -2) : raw
    while (core && EDGE.includes(core[core.length - 1])) core = core.slice(0, -1)
    raw = core + tail
    const b = a + raw.length
    const t = raw.toLowerCase().replace(QUOTE_CLASS, '')
    if (t.length >= LIMITS.tokenMinChars && !STOP.has(t)) out.push({ text: t, start: a, end: b })
  }
  return out
}

export function toks(s: string): string[] {
  return rawTokens(s).map((t) => t.text)
}

/** Levenshtein distance, capped one above fuzzyMaxDistance when lengths already differ by more. */
export function lev(a: string, b: string): number {
  const max = THRESHOLDS.fuzzyMaxDistance
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i]
    for (let j = 1; j <= b.length; j++) {
      cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)))
    }
    prev = cur
  }
  return prev[b.length]
}

/** Matched item tokens over item tokens against one passage; matches as offsets into it. */
export function scorePassage(itemToks: string[], entSet: Set<string>, ptoks: RawToken[]): { score: number; matches: TokenMatch[] } {
  const first = new Map<string, RawToken>()
  for (const t of ptoks) if (!first.has(t.text)) first.set(t.text, t)
  const matches: TokenMatch[] = []
  for (const t of itemToks) {
    const exact = first.get(t)
    if (exact) {
      matches.push({ start: exact.start, end: exact.end, token: t, fuzzy: false, distance: 0 })
      continue
    }
    if (t.length >= THRESHOLDS.fuzzyMinTokenLength && !entSet.has(t)) {
      let best: { d: number; p: string } | undefined
      for (const p of first.keys()) {
        if (Math.abs(p.length - t.length) > THRESHOLDS.fuzzyMaxDistance) continue
        const d = lev(t, p)
        if (!best || d < best.d || (d === best.d && p < best.p)) best = { d, p }
      }
      if (best && best.d <= THRESHOLDS.fuzzyMaxDistance) {
        const tok = first.get(best.p) as RawToken
        matches.push({ start: tok.start, end: tok.end, token: best.p, fuzzy: true, distance: best.d })
      }
    }
  }
  return { score: itemToks.length ? matches.length / itemToks.length : 0, matches }
}

/**
 * Whole-token presence of a normalized entity value in normalized text: not glued to a word
 * character, `-`, or a dotted continuation on either side; not preceded by `/` unless the
 * entity is a path (a path also matches at the end of a longer path).
 */
export function entityPresent(kind: EntityKind, value: string, text: string): boolean {
  const v = norm(value)
  const before = String.raw`(?<![\w\-])(?<!\w\.)` + (kind === 'path' ? '' : String.raw`(?<!/)`)
  // QA 2026-09-17 finding 1: a path followed by `/` is a directory prefix of a longer token, not the path.
  const after = String.raw`(?![\w\-])(?!\.\w)` + (kind === 'path' ? String.raw`(?!/)` : '')
  return new RegExp(before + escapeRegex(v) + after).test(text)
}

/** Smallest span of the raw passage covering all matches; «…» exact, «~…» fuzzy; adjacent same-kind marks merge. */
export function markedSpan(text: string, matches: TokenMatch[]): string {
  if (!matches.length) return ''
  const seen = new Set<string>()
  const hits: { a: number; b: number; f: boolean }[] = []
  for (const m of matches) {
    const key = `${m.start}:${m.end}:${m.fuzzy}`
    if (seen.has(key)) continue
    seen.add(key)
    hits.push({ a: m.start, b: m.end, f: m.fuzzy })
  }
  hits.sort((x, y) => x.a - y.a || x.b - y.b || Number(x.f) - Number(y.f))
  const phrases: { a: number; b: number; f: boolean }[] = []
  for (const h of hits) {
    const last = phrases[phrases.length - 1]
    if (last && text.slice(last.b, h.a).trim() === '' && last.f === h.f) last.b = h.b
    else phrases.push({ ...h })
  }
  let out = ''
  let pos = phrases[0].a
  for (const p of phrases) {
    out += text.slice(pos, p.a) + (p.f ? '«~' : '«') + text.slice(p.a, p.b) + '»'
    pos = p.b
  }
  return out
}

/** Offsets in the raw passage of the normalized item, allowing quotes, markers, and whitespace between characters. */
export function verbatimOffsets(ni: string, passage: string): [number, number] {
  const skip = '[' + escapeRegex('`\'"‘’“”*#>') + String.raw`\s]*`
  const pat = Array.from(ni)
    .map((c) => (c === ' ' ? String.raw`\s+` : escapeRegex(c)))
    .join(skip)
  const m = new RegExp(pat, 'i').exec(passage)
  return m ? [m.index, m.index + m[0].length] : [0, passage.length]
}
