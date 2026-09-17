/**
 * The shell: header, autopsy panel (ledger or story behind a toggle, trace, evidence drawer over
 * it), timeline, footer. Renders from a Session and its analysis; the four query keys are read on
 * load and written on every change. Clicking a boundary row in the timeline selects that
 * compaction. A ledger row and a story ribbon select the same item and write `item=` alike.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SessionSource } from '../../adapters/session-source.ts'
import { analyze, type AnalyzedSession, type Report, type Session } from '../../domain'
import { AutopsyPanel, EvidenceDrawer, type PanelView } from '../autopsy/index.ts'
import { StoryView } from '../story/index.ts'
import { messageRowId } from '../timeline/layout.ts'
import { Timeline } from '../timeline/Timeline.tsx'
import { Footer } from './Footer.tsx'
import { Header } from './Header.tsx'
import { currentSearch, initialUrlState, writeUrlState, type UrlState } from './url-state.ts'

export interface AppProps {
  source: SessionSource
  /**
   * Analysis per session id, run by the caller at load (src/source.ts). A session missing from
   * the map is analyzed here once, so a source without precomputed reports still renders.
   */
  analyzed?: ReadonlyMap<string, AnalyzedSession>
  /** Query string to read instead of the browser URL; tests pass it since there is no window. */
  initialSearch?: string
}

function useReports(analyzed: AppProps['analyzed']) {
  const cache = useRef(new Map<string, Report[]>())
  return useCallback(
    (session: Session): Report[] => {
      const pre = analyzed?.get(session.id)
      if (pre) return pre.reports
      let r = cache.current.get(session.id)
      if (!r) {
        r = analyze(session).reports
        cache.current.set(session.id, r)
      }
      return r
    },
    [analyzed],
  )
}

export function App({ source, analyzed, initialSearch }: AppProps) {
  const refs = useMemo(() => source.list(), [source])
  const reportsOf = useReports(analyzed)
  const itemIdsOf = useCallback((s: Session) => reportsOf(s).flatMap((r) => r.items.map((i) => i.item.id)), [reportsOf])
  const [state, setState] = useState<UrlState>(() => initialUrlState(source, initialSearch ?? currentSearch(), itemIdsOf))
  const [touched, setTouched] = useState(false)
  /** What the panel shows under the drawer: the last of ledger or story the URL carried. */
  const [behind, setBehind] = useState<PanelView>(() => (state.view === 'story' ? 'story' : 'ledger'))
  const [highlightUuid, setHighlightUuid] = useState<string | undefined>(undefined)
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null)

  useEffect(() => {
    writeUrlState(state)
  }, [state])

  useEffect(() => {
    if (highlightUuid === undefined || typeof document === 'undefined') return
    document.getElementById(messageRowId(highlightUuid))?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [highlightUuid])

  const session = state.session !== undefined ? source.get(state.session) : undefined

  const update = useCallback((patch: Partial<UrlState>) => {
    setTouched(true)
    if (patch.view === 'ledger' || patch.view === 'story') setBehind(patch.view)
    setState((s) => ({ ...s, ...patch }))
  }, [])

  const closeEvidence = useCallback(() => update({ view: behind }), [update, behind])

  if (session === undefined) {
    return (
      <main className="app app--empty">
        <p className="empty">No session to show.</p>
        <Footer />
      </main>
    )
  }

  const reports = reportsOf(session)
  const compactionIndex = state.compaction < session.compactions.length ? state.compaction : 0
  const report = reports[compactionIndex]
  const compaction = session.compactions[compactionIndex]
  const selectedRow = report?.items.find((r) => r.item.id === state.item)
  const showStartHere = !touched && state.item === undefined && session.id === source.defaultId()
  const drawerOpen = state.view === 'evidence' && selectedRow !== undefined
  const panelView: PanelView = state.view === 'story' ? 'story' : state.view === 'ledger' ? 'ledger' : behind

  const jumpToMessage = (uuid: string) => {
    setHighlightUuid(uuid)
  }

  const onTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const boundary = target.closest<HTMLElement>('.timeline__boundary')
    const idx = boundary?.dataset.compactionIndex
    if (idx === undefined) return
    update({ compaction: Number(idx), item: undefined, view: 'ledger' })
    document.getElementById('autopsy')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  return (
    <main className="app">
      <div className="app__left">
        <Header
          refs={refs}
          session={session}
          compactionIndex={compactionIndex}
          onSelectSession={(id) => {
            setTouched(true)
            setHighlightUuid(undefined)
            setBehind('ledger')
            setState({ session: id, compaction: 0, item: undefined, view: 'ledger' })
          }}
        />
        {report ? (
          <div className={`panel-host${drawerOpen ? ' panel-host--dimmed' : ''}`} aria-hidden={drawerOpen}>
            <AutopsyPanel
              session={session}
              report={report}
              selectedItemId={state.item}
              hoveredItemId={hoveredItemId}
              showStartHere={showStartHere}
              view={panelView}
              onChangeView={(v) => update({ view: v })}
              story={
                <StoryView
                  report={report}
                  compaction={compaction}
                  selectedItemId={state.item}
                  onSelect={(id) => update({ item: id, view: 'story' })}
                  onActionClick={(_id, hit) => {
                    const m = session.messages.find((x) => x.action?.toolUseId === hit.toolUseId)
                    if (m) jumpToMessage(m.uuid)
                  }}
                  onHover={setHoveredItemId}
                  onPlayStep={(act) => {
                    if (act === 'evidence') update({ item: state.item ?? report.items[0]?.item.id, view: 'evidence' })
                  }}
                />
              }
              onSelectItem={(id) => update({ item: id, view: panelView })}
              onOpenEvidence={(id) => update({ item: id, view: 'evidence' })}
              onJumpToMessage={jumpToMessage}
              onHoverItem={setHoveredItemId}
            />
          </div>
        ) : (
          <section className="autopsy" aria-label="Autopsy panel" id="autopsy">
            <h2 className="autopsy__title">Autopsy</h2>
            <p className="empty">no compaction in this session</p>
          </section>
        )}
        {drawerOpen && selectedRow ? (
          <EvidenceDrawer
            session={session}
            compactionIndex={compactionIndex}
            row={selectedRow}
            onClose={closeEvidence}
            onJumpToMessage={jumpToMessage}
          />
        ) : null}
      </div>
      <div className="timeline-host" onClick={onTimelineClick}>
        <Timeline session={session} highlightUuid={highlightUuid} />
      </div>
      <Footer />
    </main>
  )
}
