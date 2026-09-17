/**
 * Stage 1 on the contract's stated rules: triggers, entity shapes, sentence bounds.
 */
import { describe, expect, it } from 'vitest'
import { classify, entitiesOf, extractItems, splitSentences, triggerClause } from './items'

describe('stage 1', () => {
  it('stop is not a negation trigger', () => {
    expect(classify('the job will stop at 3am on argon-stg-01.internal').cls).toBeUndefined()
  })
  it('a curly apostrophe is normalized before trigger matching', () => {
    expect(classify('don’t touch scripts/rotate_keys.sh').cls).toBe('negation')
  })
  it('precedence: negation over positive over fact', () => {
    expect(classify("always use rotate_keys.py, don't use rotate_keys.sh").cls).toBe('negation')
    expect(classify('always use rotate_keys.py, it is now the entry point').cls).toBe('positive')
    expect(classify('rotate_keys.py is now the entry point').cls).toBe('fact')
  })
  it('positive and fact need an entity', () => {
    expect(classify('always double check').cls).toBeUndefined()
    expect(classify('the office moved to a new floor').cls).toBeUndefined()
  })
  it('e.g is not an identifier; hosts bring their bare siblings; identifiers inside paths are dropped', () => {
    expect(entitiesOf('use it e.g. for rotation')).toEqual([])
    expect(entitiesOf('staging is argon-stg-02.internal, argon-stg-01 is gone')).toEqual([
      { kind: 'host', value: 'argon-stg-02.internal' },
      { kind: 'host', value: 'argon-stg-01' },
    ])
    expect(entitiesOf('edit scripts/rotate_keys.py only')).toEqual([{ kind: 'path', value: 'scripts/rotate_keys.py' }])
  })
  it('trigger clause runs from the trigger to the first boundary', () => {
    expect(triggerClause("please don't modify scripts/rotate_keys.sh, platform team owns it")).toBe("don't modify scripts/rotate_keys.sh")
    expect(triggerClause('never mention VLX-4127 unless asked')).toBe('never mention VLX-4127 ')
    expect(triggerClause('keep going')).toBe('')
  })
  it('sentences split on terminators at token ends and on bullets at line start', () => {
    expect(splitSentences("don't do A. also v1.2 is fine!\n- never do B\n2. avoid C")).toEqual(["don't do A", 'also v1.2 is fine', 'never do B', 'avoid C'])
  })
  it('extractItems keeps 12 to 300 character sentences, dedupes by normalized text, numbers ids by line', () => {
    const humans = [
      { uuid: 'a', ts: '2026-09-16T18:00:00.000Z', line: 3, kind: 'human' as const, excerpt: '', text: "never do X. Don't touch scripts/a.sh. don't touch scripts/a.sh." },
      { uuid: 'b', ts: '2026-09-16T18:01:00.000Z', line: 7, kind: 'human' as const, excerpt: '', text: 'x'.repeat(301) + ' never' },
    ]
    const items = extractItems(humans, 2)
    expect(items.map((it) => [it.id, it.text])).toEqual([["2:3:0", "Don't touch scripts/a.sh"]])
    expect(items[0].origin).toEqual({ messageUuid: 'a', ts: '2026-09-16T18:00:00.000Z', line: 3 })
    expect(items[0].compactionIndex).toBe(2)
  })
})
