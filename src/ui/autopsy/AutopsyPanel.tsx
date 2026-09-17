/**
 * The autopsy panel: the five questions in order with their counts, then the ledger (one row per
 * item) or the story view behind a toggle, then the four-step trace of the selected item
 * (source, compaction, after, evidence). A ledger row and a story ribbon select the same item.
 * Reads a Report and its Session; the two contract strings render from the constants.
 */
import type { ReactNode } from 'react'
import type { ItemReport, Report, Session } from '../../domain'
import { formatTime } from '../timeline/layout.ts'
import { AfterBlock } from './After.tsx'
import { afterWindow, clip, plural, questionCounts } from './derive.ts'
import { Marks } from './Marks.tsx'
import { HEALTHY_LINE, NONE, NO_ANCHOR, NO_SECTION, ORIGIN_LINE, QUESTIONS, START_HERE } from './strings.ts'

export type PanelView = 'ledger' | 'story'

export interface AutopsyPanelProps {
  session: Session
  report: Report
  selectedItemId?: string
  hoveredItemId?: string | null
  /** The one-line "Start here" hint above the questions, until the first selection. */
  showStartHere?: boolean
  /** The "Start here" hint clicked: select the compaction and bring its timeline bar into view. */
  onStartHere?: () => void
  /** Which of the two the middle section shows; the caller keeps it in the URL's `view=`. */
  view?: PanelView
  onChangeView?: (view: PanelView) => void
  /** The story view node, rendered when `view` is 'story'. */
  story?: ReactNode
  onSelectItem: (itemId: string) => void
  onOpenEvidence: (itemId: string) => void
  onJumpToMessage: (uuid: string) => void
  onHoverItem?: (itemId: string | null) => void
}

function statusWord(row: ItemReport): string {
  return row.survival.verbatim ? `${row.survival.status} verbatim` : row.survival.status
}

function afterCell(row: ItemReport, scanned: number): string {
  const d = row.downstream
  if (d.result === 'matched' && d.hit) return `INCONSISTENT ACTION · ${d.hit.tool} · ${formatTime(d.hit.ts)}`
  if (d.result === 'none_found') return `NONE FOUND · ${plural(scanned, 'tool call')} after`
  return 'NOT CHECKABLE'
}

export function AutopsyPanel({
  session,
  report,
  selectedItemId,
  hoveredItemId,
  showStartHere = false,
  onStartHere,
  view = 'ledger',
  onChangeView,
  story,
  onSelectItem,
  onOpenEvidence,
  onJumpToMessage,
  onHoverItem,
}: AutopsyPanelProps) {
  const counts = questionCounts(report)
  const window = afterWindow(session, report.compactionIndex)
  const selected = report.items.find((r) => r.item.id === selectedItemId)
  const compaction = session.compactions[report.compactionIndex]

  return (
    <section className="autopsy" aria-label="Autopsy panel" id="autopsy">
      <h2 className="autopsy__title">
        Autopsy
        {compaction ? <span className="autopsy__sub">{`compaction ${report.compactionIndex + 1} of ${session.compactions.length} · ${compaction.trigger} · ${formatTime(compaction.ts)} UTC`}</span> : null}
      </h2>

      {showStartHere ? (
        <button type="button" className="start-here" onClick={onStartHere}>
          {START_HERE}
        </button>
      ) : null}

      <ol className="questions">
        <li>
          <h3>{QUESTIONS[0]}</h3>
          <p>{`${plural(counts.items, 'item')} from ${plural(counts.prompts, 'prompt')} before the boundary`}</p>
        </li>
        <li>
          <h3>{QUESTIONS[1]}</h3>
          <p>{`${counts.preserved} PRESERVED`}</p>
        </li>
        <li>
          <h3>{QUESTIONS[2]}</h3>
          <p>{`${counts.degraded} DEGRADED, ${counts.lost} LOST`}</p>
        </li>
        <li>
          <h3>{QUESTIONS[3]}</h3>
          <p>{ORIGIN_LINE}</p>
        </li>
        <li>
          <h3>{QUESTIONS[4]}</h3>
          <p>{`${counts.matched} matched, ${counts.noneFound} none found, ${counts.notCheckable} not checkable`}</p>
          {counts.matched === 0 ? <p className="healthy">{HEALTHY_LINE}</p> : null}
        </li>
      </ol>

      <div className="view-toggle" role="group" aria-label="Ledger or story">
        <button type="button" className="view-toggle__button" aria-pressed={view === 'ledger'} onClick={() => onChangeView?.('ledger')}>
          Ledger
        </button>
        <button type="button" className="view-toggle__button" aria-pressed={view === 'story'} onClick={() => onChangeView?.('story')}>
          Story
        </button>
      </div>

      {view === 'story' && story !== undefined ? (
        <div className="story-host">{story}</div>
      ) : (
      <table className="ledger">
        <caption className="visually-hidden">Ledger: one row per tracked item</caption>
        <thead>
          <tr>
            <th scope="col">item</th>
            <th scope="col">status</th>
            <th scope="col">score</th>
            <th scope="col">origin</th>
            <th scope="col">after</th>
          </tr>
        </thead>
        <tbody>
          {report.items.map((row) => {
            const isSelected = row.item.id === selectedItemId
            const isHovered = row.item.id === hoveredItemId
            return (
              <tr
                key={row.item.id}
                data-item-id={row.item.id}
                data-status={row.survival.status}
                className={`ledger__row${isSelected ? ' is-selected' : ''}${isHovered ? ' is-hovered' : ''}`}
                aria-selected={isSelected}
                onMouseEnter={() => onHoverItem?.(row.item.id)}
                onMouseLeave={() => onHoverItem?.(null)}
              >
                <td>
                  <button type="button" className="ledger__select" onClick={() => onSelectItem(row.item.id)}>
                    <span className="ledger__text">{row.item.text}</span>
                    <span className="tag">{row.item.class}</span>
                  </button>
                </td>
                <td className={`status status--${row.survival.status.toLowerCase()}`}>{statusWord(row)}</td>
                <td className="mono">{row.survival.score.toFixed(2)}</td>
                <td className="mono">{`line ${row.item.origin.line}`}</td>
                <td className="ledger__after">{afterCell(row, window.scanned)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      )}

      {selected ? (
        <Trace session={session} report={report} row={selected} onOpenEvidence={onOpenEvidence} onJumpToMessage={onJumpToMessage} />
      ) : (
        <p className="trace__hint">Select an item in the ledger to trace it: source, compaction, after, evidence.</p>
      )}
    </section>
  )
}

function Trace({
  session,
  report,
  row,
  onOpenEvidence,
  onJumpToMessage,
}: {
  session: Session
  report: Report
  row: ItemReport
  onOpenEvidence: (itemId: string) => void
  onJumpToMessage: (uuid: string) => void
}) {
  const { item, survival } = row
  const entities = item.entities.length ? item.entities.map((e) => `${e.kind} ${e.value}`).join(', ') : NONE
  const anchors = item.anchors.length ? item.anchors.map((a) => `${a.kind} ${a.value}`).join(', ') : NO_ANCHOR
  return (
    <section className="trace" aria-label={`Trace of item ${item.id}`} data-item-id={item.id}>
      <h3 className="trace__title">Trace</h3>
      <ol className="trace__steps">
        <li className="step step--source">
          <h4>Source</h4>
          <p className="step__text">{item.text}</p>
          <dl className="kv">
            <dt>class</dt>
            <dd>{item.class}</dd>
            <dt>entities</dt>
            <dd>{entities}</dd>
            <dt>anchors</dt>
            <dd>{anchors}</dd>
            <dt>origin</dt>
            <dd>
              <button type="button" className="link mono" onClick={() => onJumpToMessage(item.origin.messageUuid)}>
                {`${item.origin.messageUuid} · ${formatTime(item.origin.ts)} UTC · line ${item.origin.line}`}
              </button>
            </dd>
          </dl>
        </li>
        <li className="step step--compaction">
          <h4>Compaction</h4>
          <p>
            <span className={`status status--${survival.status.toLowerCase()}`}>{survival.status}</span>
            <span className="mono">{` ${survival.score.toFixed(2)}`}</span>
            {survival.verbatim ? <span>{' · verbatim'}</span> : null}
          </p>
          <p className="step__passage">
            <span className="mono">{`summary line ${survival.passage.lineIndex + 1}: `}</span>
            <Marks text={clip(survival.passage.text)} matches={survival.matches.filter((m) => m.end <= 160)} />
          </p>
          <dl className="kv">
            <dt>section</dt>
            <dd>{survival.structuralSection ?? NO_SECTION}</dd>
            <dt>entities in passage</dt>
            <dd>{survival.entitiesInPassage.length ? survival.entitiesInPassage.join(', ') : NONE}</dd>
            <dt>entities anywhere</dt>
            <dd>{survival.entitiesAnywhere.length ? survival.entitiesAnywhere.join(', ') : NONE}</dd>
          </dl>
          <button type="button" className="button" onClick={() => onOpenEvidence(item.id)}>
            evidence ▸
          </button>
        </li>
        <li className="step step--after">
          <h4>After</h4>
          <AfterBlock session={session} compactionIndex={report.compactionIndex} row={row} onJumpToMessage={onJumpToMessage} />
        </li>
        <li className="step step--evidence">
          <h4>Evidence</h4>
          <p>{`The passage on summary line ${survival.passage.lineIndex + 1} with ${plural(survival.matches.length, 'mark')} from the stored offsets, the entities, the thresholds, and the after block.`}</p>
          <button type="button" className="button" onClick={() => onOpenEvidence(item.id)}>
            open evidence
          </button>
        </li>
      </ol>
    </section>
  )
}
