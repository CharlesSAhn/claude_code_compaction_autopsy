import { describe, expect, it } from 'vitest'
import type { Session } from '../../domain'
import type { SessionSource } from '../../adapters/session-source.ts'
import { initialUrlState, parseUrlState, serializeUrlState, type UrlState } from './url-state.ts'

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

describe('initialUrlState over a source', () => {
  const sessions: Record<string, Session> = {
    one: { compactions: [{}], items: [{ id: 'i1' }] } as unknown as Session,
    two: { compactions: [{}, {}] } as unknown as Session,
  }
  const source: SessionSource = {
    kind: 'fixtures',
    list: () => Object.keys(sessions).map((id) => ({ id, label: id, provenance: { kind: 'constructed', note: 'n' }, claudeCodeVersion: '0', itemCount: 0, hasMatchedAction: false })),
    get: (id) => sessions[id],
    defaultId: () => 'one',
  }

  it('drops a compaction= or item= the resolved session cannot derive', () => {
    expect(initialUrlState(source, '?session=one&compaction=7&item=zzz&view=chart')).toEqual({ session: 'one', compaction: 0, item: undefined, view: 'ledger' })
    expect(serializeUrlState(initialUrlState(source, '?compaction=7&item=zzz'))).toBe('?session=one')
  })

  it('keeps what the session has', () => {
    expect(initialUrlState(source, '?session=one&item=i1&view=story')).toMatchObject({ session: 'one', item: 'i1', view: 'story' })
    expect(initialUrlState(source, '?session=two&compaction=1')).toMatchObject({ session: 'two', compaction: 1 })
  })

  it('a session without items keeps no item=', () => {
    expect(initialUrlState(source, '?session=two&item=i1').item).toBeUndefined()
  })
})
