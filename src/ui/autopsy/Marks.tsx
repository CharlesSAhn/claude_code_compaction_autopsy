/**
 * A passage with its matched spans marked from `survival.matches` offsets. Exact spans read
 * `«…»`, fuzzy spans `«~…»` with the edit distance on hover. Never rendered from `markedSpan`.
 */
import type { TokenMatch } from '../../domain'
import { markSegments } from './derive.ts'

export interface MarksProps {
  text: string
  matches: readonly TokenMatch[]
}

export function Marks({ text, matches }: MarksProps) {
  return (
    <span className="marks">
      {markSegments(text, matches).map((s, i) =>
        s.kind === 'plain' ? (
          <span key={i}>{s.text}</span>
        ) : (
          <mark
            key={i}
            className={`marks__span marks__span--${s.kind}`}
            title={s.kind === 'fuzzy' ? `fuzzy match, distance ${s.distance}` : 'exact match'}
          >
            <span aria-hidden="true">{s.kind === 'fuzzy' ? '«~' : '«'}</span>
            {s.text}
            <span aria-hidden="true">»</span>
          </mark>
        ),
      )}
    </span>
  )
}
