/**
 * Stage 1: candidate items from pre-boundary human messages, plus the anchor extraction of
 * stage 4 steps 1–5 (computed here so fixtures can carry anchors). Port of the same functions in
 * scripts/autopsy-check.py.
 */
import { LIMITS, type Anchor, type Entity, type EntityKind, type Item, type ItemClass, type Message } from './contract'
import { norm, straight } from './normalize'
import { BOUNDARY, CLASS_NOUNS, ENT_RES, FACT, NEG, POS, escapeRegex } from './wordlists'

/** Entities in extraction order, deduplicated; bare host siblings added; identifiers inside a path or host dropped. */
export function entitiesOf(s: string): Entity[] {
  const out: Entity[] = []
  const has = (kind: EntityKind, value: string) => out.some((e) => e.kind === kind && e.value === value)
  for (const [kind, re] of ENT_RES) {
    for (const m of s.matchAll(re)) if (!has(kind, m[0])) out.push({ kind, value: m[0] })
  }
  for (const e of [...out]) {
    if (e.kind !== 'host') continue
    const stem = e.value.replace(/\d+\.[a-z]+$/, '')
    if (!stem || stem === e.value) continue
    const re = new RegExp(String.raw`\b${escapeRegex(stem)}\d+\b(?!\.)`, 'g')
    for (const m of s.matchAll(re)) if (!has('host', m[0])) out.push({ kind: 'host', value: m[0] })
  }
  const big = out.filter((e) => e.kind === 'path' || e.kind === 'host').map((e) => e.value)
  return out.filter((e) => !(e.kind === 'ident' && big.some((p) => p.includes(e.value))))
}

const SPLIT = /(?:[.!?]+(?=\s|$))|\n|(?:^|(?<=\n))\s*(?:[-*]|\d+\.)\s+/

/** Sentences: terminators only at token ends, bullets and numbers only at line start. */
export function splitSentences(t: string): string[] {
  return t
    .split(SPLIT)
    .map((p) => p.trim())
    .filter((p) => p !== '')
}

export function classify(s: string): { cls: ItemClass | undefined; entities: Entity[] } {
  const s2 = straight(s)
  const entities = entitiesOf(s)
  if (NEG.test(s2)) return { cls: 'negation', entities }
  if (POS.test(s2) && entities.length) return { cls: 'positive', entities }
  if (FACT.test(s2) && entities.length) return { cls: 'fact', entities }
  return { cls: undefined, entities }
}

/** Stage 4 step 2: from the negation trigger to the first clause boundary; '' when no trigger. */
export function triggerClause(sentence: string): string {
  const s = straight(sentence)
  const m = NEG.exec(s)
  if (!m) return ''
  return s.slice(m.index).split(BOUNDARY, 1)[0]
}

/** Stage 4 steps 1–5: concrete entities in the trigger clause, else one class anchor, else none. */
export function anchorsOf(cls: ItemClass, entities: Entity[], sentence: string): Anchor[] {
  if (cls !== 'negation') return []
  const clause = triggerClause(sentence)
  const concrete = entities.filter((e) => clause.includes(e.value)).map((e) => ({ kind: e.kind, value: e.value }))
  if (concrete.length) return concrete
  for (const [kind, re] of CLASS_NOUNS) if (re.test(clause)) return [{ kind, value: '*' }]
  return []
}

/** Stage 1 over the human messages before one boundary; ids `<ci>:<line>:<n>`. */
export function extractItems(humans: readonly Message[], compactionIndex: number): Item[] {
  const items: Item[] = []
  const seen = new Set<string>()
  for (const m of humans) {
    if (m.kind !== 'human' || !m.text) continue
    for (const s of splitSentences(m.text)) {
      if (s.length < LIMITS.itemMinChars || s.length > LIMITS.itemMaxChars) continue
      const { cls, entities } = classify(s)
      if (!cls) continue
      const n = norm(s)
      if (seen.has(n)) continue
      seen.add(n)
      items.push({
        id: `${compactionIndex}:${m.line}:${items.length}`,
        compactionIndex,
        text: s,
        class: cls,
        entities,
        anchors: anchorsOf(cls, entities, s),
        origin: { messageUuid: m.uuid, ts: m.ts, line: m.line },
      })
    }
  }
  return items
}
