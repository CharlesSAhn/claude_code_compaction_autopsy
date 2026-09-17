/**
 * The shell: header, autopsy and story slots, timeline, footer. Renders from a Session alone;
 * the four query keys are read on load and written on every change.
 */
import { useEffect, useMemo, useState } from 'react'
import type { SessionSource } from '../../adapters/session-source.ts'
import { Timeline } from '../timeline/Timeline.tsx'
import { Footer } from './Footer.tsx'
import { Header } from './Header.tsx'
import { AutopsySlot, StorySlot } from './slots.tsx'
import { parseUrlState, readUrlState, writeUrlState, type UrlState } from './url-state.ts'

export interface AppProps {
  source: SessionSource
  /** Query string to read instead of the browser URL; tests pass it since there is no window. */
  initialSearch?: string
}

export function App({ source, initialSearch }: AppProps) {
  const refs = useMemo(() => source.list(), [source])
  const [state, setState] = useState<UrlState>(() => {
    const defaults = { sessionIds: refs.map((r) => r.id), defaultSession: source.defaultId() }
    return initialSearch === undefined ? readUrlState(defaults) : parseUrlState(initialSearch, defaults)
  })

  useEffect(() => {
    writeUrlState(state)
  }, [state])

  const session = state.session !== undefined ? source.get(state.session) : undefined

  if (session === undefined) {
    return (
      <main className="app app--empty">
        <p className="empty">No session to show.</p>
        <Footer />
      </main>
    )
  }

  const compactionIndex = state.compaction < session.compactions.length ? state.compaction : 0

  return (
    <main className="app">
      <div className="app__left">
        <Header
          refs={refs}
          session={session}
          compactionIndex={compactionIndex}
          onSelectSession={(id) => setState({ session: id, compaction: 0, item: undefined, view: 'ledger' })}
        />
        <AutopsySlot />
      </div>
      <div className="app__right">
        <StorySlot />
      </div>
      <Timeline session={session} />
      <Footer />
    </main>
  )
}
