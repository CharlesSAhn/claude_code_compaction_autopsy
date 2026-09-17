/**
 * Stage 2 primitives on the contract's stated examples: normalization, tokens, fuzzy matching,
 * whole-token entity presence, the marked span, and the structural section.
 */
import { describe, expect, it } from 'vitest'
import type { Item } from './contract'
import { entityPresent, lev, markedSpan, norm, rawTokens, scorePassage, toks } from './normalize'
import { scoreItem, structuralSections } from './survival'

describe('normalization and tokens', () => {
  it("dont equals don't; markers and quotes go; underscores stay", () => {
    expect(norm("Don’t `rotate_keys.py` **now** > #x")).toBe('dont rotate_keys.py now x')
  })
  it('leading and trailing punctuation is never part of a token', () => {
    expect(toks('like (VLX-4127 option B), and print().')).toEqual(['vlx-4127', 'option', 'print()'])
    expect(rawTokens('(VLX-4127')[0]).toEqual({ text: 'vlx-4127', start: 1, end: 9 })
  })
  it('stopwords and short tokens are dropped', () => {
    expect(toks('the cat and a dog are on it')).toEqual(['cat', 'dog'])
  })
})

describe('fuzzy matching', () => {
  it('refernce matches reference and options matches option at one edit', () => {
    expect(lev('refernce', 'reference')).toBe(1)
    expect(lev('options', 'option')).toBe(1)
  })
  it('ticket does not match picked', () => {
    const { matches } = scorePassage(['ticket'], new Set(), rawTokens('we picked a line'))
    expect(matches).toEqual([])
  })
  it('entity tokens match exactly only; non-entity tokens of six or more fuzzily', () => {
    const passage = rawTokens('refernce rotate_keys.sh')
    expect(scorePassage(['reference', 'rotate_keys.py'], new Set(['rotate_keys.py']), passage).matches).toEqual([
      { start: 0, end: 8, token: 'refernce', fuzzy: true, distance: 1 },
    ])
  })
})

describe('entity presence as a whole token', () => {
  it('a path matches at the end of a longer path, never as a prefix or a different extension', () => {
    expect(entityPresent('path', 'rotate_keys.sh', norm('edit scripts/rotate_keys.sh now'))).toBe(true)
    expect(entityPresent('path', 'rotate_keys.sh', norm('rotate_keys.py is fine'))).toBe(false)
    expect(entityPresent('path', 'rotate_keys.sh', norm('old_rotate_keys.sh'))).toBe(false)
  })
  it('a ticket inside parentheses and punctuation is present; inside a longer token it is not', () => {
    expect(entityPresent('ticket', 'VLX-4127', norm('(ticket VLX-4127):'))).toBe(true)
    expect(entityPresent('ticket', 'VLX-4127', norm('VLX-41270'))).toBe(false)
    expect(entityPresent('ticket', 'VLX-4127', norm('x/VLX-4127'))).toBe(false)
  })
  it('never print(). contains print()', () => {
    expect(entityPresent('ident', 'print()', norm('never print().'))).toBe(true)
  })
})

describe('marked span', () => {
  it('merges adjacent same-kind marks, «~…» for fuzzy', () => {
    const text = 'the ticket VLX-4127 refernce'
    const matches = [
      { start: 4, end: 10, token: 'ticket', fuzzy: false, distance: 0 },
      { start: 11, end: 19, token: 'vlx-4127', fuzzy: false, distance: 0 },
      { start: 20, end: 28, token: 'refernce', fuzzy: true, distance: 1 },
    ]
    expect(markedSpan(text, matches)).toBe('«ticket VLX-4127» «~refernce»')
    expect(markedSpan(text, [])).toBe('')
  })
})

describe('structural section', () => {
  const item: Item = {
    id: '0:1:0',
    compactionIndex: 0,
    text: "don't modify scripts/rotate_keys.sh, platform team owns it",
    class: 'negation',
    entities: [{ kind: 'path', value: 'scripts/rotate_keys.sh' }],
    anchors: [{ kind: 'path', value: 'scripts/rotate_keys.sh' }],
    origin: { messageUuid: 'u', ts: '2026-09-16T18:00:00.000Z', line: 1 },
  }
  const lines = ['# Summary', 'some work on rotate_keys.py', '## Standing constraints', '- platform team owns scripts/rotate_keys.sh, do not modify it', '## Next', 'nothing']

  it('a heading with a structural word opens a section that runs to the next heading', () => {
    expect(structuralSections(lines)).toEqual([{ heading: '## Standing constraints', members: [3] }])
  })
  it('the best passage in a section records structuralSection; a section is scored first', () => {
    const ev = scoreItem(item, lines)
    expect(ev.passage.lineIndex).toBe(3)
    expect(ev.structuralSection).toBe('## Standing constraints')
    expect(ev.verbatim).toBe(false)
    expect(ev.status).toBe('PRESERVED')
    expect(ev.score).toBeCloseTo(6 / 7, 4) // reference: 0.857142…
  })
  it('an item whose anchor is nowhere in the summary is LOST even when another entity survives', () => {
    const ev = scoreItem(item, ['# Summary', 'some work on rotate_keys.py'])
    expect(ev.status).toBe('LOST')
    expect(ev.structuralSection).toBeUndefined()
  })
})
