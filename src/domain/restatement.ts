/**
 * Stage 5: the human re-typing the rule after the boundary. Proves the rule was back in context
 * from then on; proves nothing about the summary or about why the user retyped it.
 * Port of restatement_of in scripts/autopsy-check.py.
 */
import { THRESHOLDS, type Item, type Message, type Restatement } from './contract'
import { splitSentences } from './items'
import { entityPresent, norm, rawTokens, scorePassage, straight, toks } from './normalize'
import { NEG } from './wordlists'

export function restatementOf(item: Item, postHumans: readonly Message[]): Restatement | undefined {
  const itemToks = toks(item.text)
  const entSet = new Set(item.entities.flatMap((e) => toks(e.value)))
  for (const m of postHumans) {
    for (const s of splitSentences(m.text ?? '')) {
      const { score } = scorePassage(itemToks, entSet, rawTokens(s))
      const ns = norm(s)
      if (score >= THRESHOLDS.restated) return { messageUuid: m.uuid, ts: m.ts, score, by: 'score' }
      if (item.entities.length && item.entities.every((e) => entityPresent(e.kind, e.value, ns)) && NEG.test(straight(s))) {
        return { messageUuid: m.uuid, ts: m.ts, score, by: 'entities' }
      }
    }
  }
  return undefined
}
