/**
 * Picker over the session source, the provenance band (kind in capitals, then `run` or the
 * constructed `note` verbatim), and the facts line of the compaction in view.
 */
import type { Compaction, Provenance, Session } from '../../domain'
import type { SessionRef } from '../../adapters/session-source.ts'

export interface HeaderProps {
  refs: readonly SessionRef[]
  session: Session
  compactionIndex: number
  onSelectSession: (id: string) => void
}

function provenanceDetail(p: Provenance): string | undefined {
  switch (p.kind) {
    case 'experiment-derived':
      return p.run
    case 'constructed':
      return p.note
    default:
      return undefined
  }
}

function tokens(c: Compaction): string {
  return c.postTokens === undefined ? `${c.preTokens} → after: not recorded` : `${c.preTokens} → ${c.postTokens}`
}

export function Header({ refs, session, compactionIndex, onSelectSession }: HeaderProps) {
  const compaction = session.compactions[compactionIndex]
  const detail = provenanceDetail(session.provenance)
  const pickerId = 'session-picker'
  return (
    <header className="header">
      <div className="header__row">
        <h1 className="header__title">Compaction Autopsy</h1>
        <label className="header__picker">
          <span className="header__picker-label" id={`${pickerId}-label`}>
            Session
          </span>
          <select
            id={pickerId}
            aria-labelledby={`${pickerId}-label`}
            value={session.id}
            onChange={(e) => onSelectSession(e.target.value)}
          >
            {refs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className={`provenance provenance--${session.provenance.kind}`}>
        <span className="provenance__kind">{session.provenance.kind.toUpperCase()}</span>
        {detail !== undefined ? <span className="provenance__detail">{detail}</span> : null}
      </p>
      <p className="facts">
        <span>{session.claudeCodeVersion}</span>
        <span aria-hidden="true"> · </span>
        <span>{session.model}</span>
        {compaction ? (
          <>
            <span aria-hidden="true"> · </span>
            <span>{compaction.trigger}</span>
            <span aria-hidden="true"> · </span>
            <span>{tokens(compaction)}</span>
            <span aria-hidden="true"> · </span>
            <span>{compaction.ts}</span>
          </>
        ) : (
          <>
            <span aria-hidden="true"> · </span>
            <span>no compaction in this session</span>
          </>
        )}
      </p>
    </header>
  )
}
