/**
 * The downstream result of one item: the matched action under `INCONSISTENT_LABEL`, or one of the
 * two empty states with its reason, then the restatement, then `CLOSING_LINE`. Shared by the
 * trace's third step and the evidence drawer. Both fixed strings render from the constants.
 */
import { CLOSING_LINE, INCONSISTENT_LABEL, type ItemReport, type Session } from '../../domain'
import { formatTime } from '../timeline/layout.ts'
import { afterWindow, messageOfToolUse, notCheckableReason, plural } from './derive.ts'
import { NONE, NONE_FOUND, NOT_CHECKABLE, NOT_RESTATED } from './strings.ts'

export interface AfterBlockProps {
  session: Session
  compactionIndex: number
  row: ItemReport
  /** Scroll the timeline to a message and flash it. */
  onJumpToMessage?: (uuid: string) => void
}

function JumpButton({ uuid, onJump, children }: { uuid?: string; onJump?: (uuid: string) => void; children: string }) {
  if (uuid === undefined || onJump === undefined) return <span>{children}</span>
  return (
    <button type="button" className="link" onClick={() => onJump(uuid)}>
      {children}
    </button>
  )
}

export function AfterBlock({ session, compactionIndex, row, onJumpToMessage }: AfterBlockProps) {
  const { downstream, restatement } = row
  const window = afterWindow(session, compactionIndex)
  const scopeText = downstream.scope.length ? downstream.scope.join(', ') : NONE
  return (
    <div className="after" data-result={downstream.result}>
      {downstream.result === 'matched' && downstream.hit ? (
        <>
          <p className="after__label">{INCONSISTENT_LABEL}</p>
          <dl className="kv">
            <dt>tool</dt>
            <dd>
              <JumpButton uuid={messageOfToolUse(session, downstream.hit.toolUseId)?.uuid} onJump={onJumpToMessage}>
                {downstream.hit.tool}
              </JumpButton>
            </dd>
            <dt>time</dt>
            <dd>{`${formatTime(downstream.hit.ts)} UTC`}</dd>
            <dt>matcher</dt>
            <dd>{downstream.hit.matcher}</dd>
            <dt>artifact</dt>
            <dd>{downstream.hit.artifact}</dd>
            <dt>excerpt</dt>
            <dd className="mono">{downstream.hit.excerpt}</dd>
            {restatement ? (
              <>
                <dt>order</dt>
                <dd>{downstream.hit.afterRestatement ? 'after restatement' : 'before restatement'}</dd>
              </>
            ) : null}
          </dl>
        </>
      ) : downstream.result === 'none_found' ? (
        <>
          <p className="after__empty">{`${NONE_FOUND}: ${plural(window.scanned, 'tool call')} after the compaction, none matched · ${window.closedBy}`}</p>
          <p className="after__scope">{`scope: ${scopeText}`}</p>
        </>
      ) : (
        <>
          <p className="after__empty">{`${NOT_CHECKABLE}: ${notCheckableReason(row.item)}`}</p>
          <p className="after__scope">{`scope: ${scopeText}`}</p>
        </>
      )}
      <p className="after__restatement">
        {restatement ? (
          <JumpButton uuid={restatement.messageUuid} onJump={onJumpToMessage}>
            {`restated at ${formatTime(restatement.ts)} UTC (${restatement.score.toFixed(2)}, by ${restatement.by})`}
          </JumpButton>
        ) : (
          NOT_RESTATED
        )}
      </p>
      <p className="closing">{CLOSING_LINE}</p>
    </div>
  )
}
