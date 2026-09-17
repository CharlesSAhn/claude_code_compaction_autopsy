/**
 * Stages 2–3: survival score, status, and evidence for one item against the summary lines.
 * Port of score_item and structural_sections in scripts/autopsy-check.py.
 */
import { THRESHOLDS, type Entity, type Item, type Status, type SurvivalEvidence, type TokenMatch } from './contract'
import { entityPresent, markedSpan, norm, rawTokens, scorePassage, toks, verbatimOffsets } from './normalize'
import { HEADING, HEAD_WORDS } from './wordlists'

/** (heading text, member line indices) for every heading with a structural word; a section runs to the next heading. */
export function structuralSections(lines: readonly string[]): { heading: string; members: number[] }[] {
  const out: { heading: string; members: number[] }[] = []
  for (let i = 0; i < lines.length; i++) {
    if (!(HEADING.test(lines[i]) && HEAD_WORDS.test(lines[i]))) continue
    const members: number[] = []
    let j = i + 1
    while (j < lines.length && !HEADING.test(lines[j])) {
      if (lines[j].trim()) members.push(j)
      j++
    }
    out.push({ heading: lines[i].trim(), members })
  }
  return out
}

/** Ruling 2026-09-16: anchor entities when the item has anchors, every entity otherwise. */
export function statusEntities(item: Item): Entity[] {
  if (!item.anchors.length) return [...item.entities]
  return item.entities.filter((e) => item.anchors.some((a) => a.kind === e.kind && (a.value === '*' || a.value === e.value)))
}

export function scoreItem(item: Item, lines: readonly string[]): SurvivalEvidence {
  const ni = norm(item.text)
  const nlines = lines.map(norm)
  const nsummary = norm(lines.join('\n'))
  const sections = structuralSections(lines)
  const inSection = new Map<number, string>()
  for (const s of sections) for (const i of s.members) inSection.set(i, s.heading)

  let score: number
  let verbatim: boolean
  let idx: number
  let passage: string
  let matches: TokenMatch[]

  if (ni && nsummary.includes(ni)) {
    const single = nlines.findIndex((l) => l.includes(ni))
    if (single >= 0) {
      idx = single
      passage = lines[single]
    } else {
      idx = 0
      passage = ''
      outer: for (let i = 0; i < lines.length; i++) {
        for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
          const joined = lines.slice(i, j + 1).join(' ')
          if (norm(joined).includes(ni)) {
            idx = i
            passage = joined
            break outer
          }
        }
      }
    }
    const [a, b] = verbatimOffsets(ni, passage)
    matches = [{ start: a, end: b, token: passage.slice(a, b), fuzzy: false, distance: 0 }]
    score = 1
    verbatim = true
  } else {
    const itemToks = toks(item.text)
    const entSet = new Set(item.entities.flatMap((e) => toks(e.value)))
    const order = [...sections.flatMap((s) => s.members), ...lines.map((l, i) => (l.trim() ? i : -1)).filter((i) => i >= 0)]
    let best: { s: number; i: number | undefined; m: TokenMatch[] } = { s: -1, i: undefined, m: [] }
    for (const i of order) {
      const r = scorePassage(itemToks, entSet, rawTokens(lines[i]))
      if (r.score > best.s) best = { s: r.score, i, m: r.matches }
    }
    score = Math.max(best.s, 0)
    verbatim = false
    idx = best.i ?? 0
    passage = best.i === undefined ? '' : lines[best.i]
    matches = best.m
  }

  const npass = norm(passage)
  const ev: SurvivalEvidence = {
    status: 'LOST',
    score,
    verbatim,
    passage: { lineIndex: idx, text: passage },
    matches,
    markedSpan: markedSpan(passage, matches),
    entitiesInPassage: item.entities.filter((e) => entityPresent(e.kind, e.value, npass)).map((e) => e.value),
    entitiesAnywhere: item.entities.filter((e) => entityPresent(e.kind, e.value, nsummary)).map((e) => e.value),
    thresholds: { ...THRESHOLDS },
  }
  const heading = inSection.get(idx)
  if (heading !== undefined) ev.structuralSection = heading
  const st = statusEntities(item)
  const allInPassage = st.every((e) => entityPresent(e.kind, e.value, npass))
  const anyAnywhere = st.some((e) => entityPresent(e.kind, e.value, nsummary))
  let status: Status
  if (score >= THRESHOLDS.preserved && allInPassage) status = 'PRESERVED'
  else if (score >= THRESHOLDS.degraded || anyAnywhere) status = 'DEGRADED'
  else status = 'LOST'
  ev.status = status
  return ev
}
