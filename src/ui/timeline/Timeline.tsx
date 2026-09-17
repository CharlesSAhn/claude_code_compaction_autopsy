/**
 * Full width, one row per message in order: kind glyph, time, excerpt. The boundary is a
 * full-width bar at the compaction's timestamp labeled "compaction · trigger". Rows are
 * addressable by message uuid (see `messageRowId`). Long sessions scroll inside the region.
 */
import type { Session } from '../../domain'
import { KIND_GLYPH, formatTime, messageRowId, timelineRows } from './layout.ts'

export interface TimelineProps {
  session: Session
  /** Message uuid to mark as highlighted, when a caller points at a row. */
  highlightUuid?: string
}

export function Timeline({ session, highlightUuid }: TimelineProps) {
  const rows = timelineRows(session)
  return (
    <section className="timeline" aria-label="Timeline">
      <h2 className="timeline__title">
        Timeline <span className="timeline__count">{`${session.messages.length} messages`}</span>
      </h2>
      <ol className="timeline__rows">
        {rows.map((row) =>
          row.kind === 'boundary' ? (
            <li
              key={`boundary-${row.compactionIndex}`}
              className="timeline__boundary"
              data-compaction-index={row.compactionIndex}
              data-ts={row.compaction.ts}
            >
              <span className="timeline__time">{formatTime(row.compaction.ts)}</span>
              <span className="timeline__boundary-label">{`compaction · ${row.compaction.trigger}`}</span>
            </li>
          ) : (
            <li
              key={row.message.uuid}
              id={messageRowId(row.message.uuid)}
              data-uuid={row.message.uuid}
              className={`timeline__row timeline__row--${row.message.kind}${
                highlightUuid === row.message.uuid ? ' timeline__row--highlight' : ''
              }`}
            >
              <span className="timeline__glyph" aria-label={row.message.kind} title={row.message.kind}>
                {KIND_GLYPH[row.message.kind]}
              </span>
              <span className="timeline__kind">
                {row.message.kind === 'tool_use' && row.message.tool ? row.message.tool : row.message.kind}
              </span>
              <span className="timeline__time">{formatTime(row.message.ts)}</span>
              <span className="timeline__excerpt">{row.message.excerpt}</span>
            </li>
          ),
        )}
      </ol>
    </section>
  )
}
