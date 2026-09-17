import { describe, expect, it } from 'vitest'
import { parseUrlState, serializeUrlState, type UrlState } from './url-state.ts'

const defaults = {
  sessionIds: ['healthy-run2', 'constructed-ticket', 'constructed-file-edit'],
  defaultSession: 'constructed-ticket',
  compactionCount: 1,
  itemIds: ['0:51:0', '0:91:1'],
}

describe('url-state', () => {
  it('round-trips the four keys', () => {
    const state: UrlState = { session: 'healthy-run2', compaction: 0, item: '0:91:1', view: 'story' }
    const search = serializeUrlState(state)
    expect(search).toBe('?session=healthy-run2&item=0%3A91%3A1&view=story')
    expect(parseUrlState(search, defaults)).toEqual(state)
  })

  it('falls back to defaults on missing or unknown values', () => {
    const fallback: UrlState = { session: 'constructed-ticket', compaction: 0, item: undefined, view: 'ledger' }
    expect(parseUrlState('', defaults)).toEqual(fallback)
    expect(parseUrlState('?session=nope&compaction=7&item=zzz&view=chart', defaults)).toEqual(fallback)
    expect(parseUrlState('?compaction=-1', defaults).compaction).toBe(0)
    expect(parseUrlState('?compaction=1.5', defaults).compaction).toBe(0)
  })

  it('serializes only what differs from the defaults', () => {
    expect(serializeUrlState({ session: undefined, compaction: 0, item: undefined, view: 'ledger' })).toBe('')
    expect(serializeUrlState({ session: 'healthy-run2', compaction: 0, item: undefined, view: 'ledger' })).toBe(
      '?session=healthy-run2',
    )
  })
})
