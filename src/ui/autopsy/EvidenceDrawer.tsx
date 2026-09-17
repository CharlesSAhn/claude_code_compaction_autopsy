/**
 * The evidence drawer for one item: item text, the passage raw with marks from the offsets, the
 * entities, the thresholds, the after block with `CLOSING_LINE`, then the whole summary with the
 * passage line marked in place. Slides over the context pane (desktop) or up as a sheet (phone);
 * closed by the handle, Escape, or tapping outside. The caller owns the URL (`view=evidence`).
 */
import { useEffect, useRef } from 'react'
import type { ItemReport, Session } from '../../domain'
import { AfterBlock } from './After.tsx'
import { Marks } from './Marks.tsx'
import { NONE, NO_SECTION } from './strings.ts'

export interface EvidenceDrawerProps {
  session: Session
  compactionIndex: number
  row: ItemReport
  onClose: () => void
  onJumpToMessage?: (uuid: string) => void
}

export function EvidenceDrawer({ session, compactionIndex, row, onClose, onJumpToMessage }: EvidenceDrawerProps) {
  const { item, survival } = row
  const compaction = session.compactions[compactionIndex]
  const passageRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    passageRef.current?.scrollIntoView({ block: 'center' })
  }, [item.id])

  const t = survival.thresholds
  return (
    <div className="drawer-host">
      <div className="drawer__backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Evidence for item ${item.id}`} data-item-id={item.id}>
        <button type="button" className="drawer__handle" onClick={onClose} aria-label="Close evidence">
          <span aria-hidden="true">▾</span> close
        </button>
        <h3 className="drawer__title">Evidence</h3>

        <p className="drawer__item">{item.text}</p>

        <h4>Passage</h4>
        <p className="mono drawer__where">
          {`summary line ${survival.passage.lineIndex + 1} · ${survival.structuralSection ?? NO_SECTION}`}
        </p>
        <p className="drawer__passage">
          <Marks text={survival.passage.text} matches={survival.matches} />
        </p>

        <dl className="kv">
          <dt>status</dt>
          <dd>
            <span className={`status status--${survival.status.toLowerCase()}`}>{survival.status}</span>
            {` ${survival.score.toFixed(2)}${survival.verbatim ? ' · verbatim' : ''}`}
          </dd>
          <dt>entities in passage</dt>
          <dd>{survival.entitiesInPassage.length ? survival.entitiesInPassage.join(', ') : NONE}</dd>
          <dt>entities anywhere</dt>
          <dd>{survival.entitiesAnywhere.length ? survival.entitiesAnywhere.join(', ') : NONE}</dd>
          <dt>origin</dt>
          <dd>
            {onJumpToMessage ? (
              <button type="button" className="link mono" onClick={() => onJumpToMessage(item.origin.messageUuid)}>
                {`${item.origin.messageUuid} · ${item.origin.ts} · line ${item.origin.line}`}
              </button>
            ) : (
              <span className="mono">{`${item.origin.messageUuid} · ${item.origin.ts} · line ${item.origin.line}`}</span>
            )}
          </dd>
          <dt>thresholds</dt>
          <dd className="mono">{`preserved ≥ ${t.preserved}, degraded ≥ ${t.degraded}, restated ≥ ${t.restated}, fuzzy ≤ ${t.fuzzyMaxDistance} edit on tokens ≥ ${t.fuzzyMinTokenLength} chars`}</dd>
        </dl>

        <h4>After</h4>
        <AfterBlock session={session} compactionIndex={compactionIndex} row={row} onJumpToMessage={onJumpToMessage} />

        {compaction ? (
          <>
            <h4>{`Summary (${compaction.summary.lines.length} lines)`}</h4>
            <ol className="summary" start={1}>
              {compaction.summary.lines.map((line, i) =>
                i === survival.passage.lineIndex ? (
                  <li key={i} ref={passageRef} className="summary__line summary__line--passage">
                    <Marks text={line} matches={survival.matches} />
                  </li>
                ) : (
                  <li key={i} className="summary__line">
                    {line}
                  </li>
                ),
              )}
            </ol>
          </>
        ) : null}
      </aside>
    </div>
  )
}
