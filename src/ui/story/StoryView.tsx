/**
 * Story view: React SVG rendered from `layoutStory`. Status is carried by the label and the line
 * style (solid / dashed-thin / bar end), never by color alone. The two contract strings render from
 * the constants imported from the domain.
 */
import { useState } from 'react'
import { INCONSISTENT_LABEL, type ActionHit, type Compaction, type Report } from '../../domain'
import { layoutStory, type LinkLayout, type RibbonLayout } from './layout'

export interface StoryViewProps {
  report: Report
  selectedItemId?: string
  onSelect?: (itemId: string) => void
  onActionClick?: (itemId: string, hit: ActionHit) => void
  onPlayStep?: (act: PlayAct) => void
  /** Hover in and out of a ribbon, so the ledger row and timeline events can highlight. */
  onHover?: (itemId: string | null) => void
  /** Optional: the boundary this report is about, for the band label and token facts. */
  compaction?: Compaction
  width?: number
}

export type PlayAct = 'source' | 'compaction' | 'after' | 'evidence'

const STATUS_VAR: Record<RibbonLayout['status'], string> = {
  PRESERVED: 'var(--status-preserved, currentColor)',
  DEGRADED: 'var(--status-degraded, currentColor)',
  LOST: 'var(--status-lost, currentColor)',
}

const ACCENT = 'var(--accent-action, currentColor)'
const MUTED = 'var(--text-muted, currentColor)'

function Ribbon({
  r,
  lit,
  dim,
  onHover,
  onSelect,
}: {
  r: RibbonLayout
  lit: boolean
  dim: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}) {
  const color = STATUS_VAR[r.status]
  const labelX = r.x0
  return (
    <g
      className={`story-ribbon story-ribbon--${r.status.toLowerCase()}${lit ? ' is-lit' : ''}`}
      data-item-id={r.itemId}
      data-status={r.status}
      opacity={dim ? 0.35 : 1}
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => onHover(r.itemId)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(r.itemId)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(r.itemId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(r.itemId)
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`${r.statusLabel}: ${r.label} (line ${r.line})`}
    >
      {/* wide invisible hit target */}
      <path d={r.path} stroke="transparent" strokeWidth={16} fill="none" />
      <path
        className="story-ribbon__line"
        d={r.path}
        stroke={color}
        strokeWidth={lit ? r.strokeWidth + 1.5 : r.strokeWidth}
        strokeDasharray={r.dashed ? '4 4' : undefined}
        strokeLinecap="butt"
        fill="none"
      />
      {r.endMark === 'dot' ? (
        <circle cx={r.x1} cy={r.y} r={4} fill={color} />
      ) : (
        <line x1={r.x1} x2={r.x1} y1={r.y - 7} y2={r.y + 7} stroke={color} strokeWidth={3} />
      )}
      <text x={labelX} y={r.y - 8} fontSize={12} fill="currentColor">
        <tspan fontWeight={600}>{r.statusLabel}</tspan>
        <tspan dx={8} fill={MUTED}>
          line {r.line}
        </tspan>
      </text>
      <text x={labelX} y={r.y + 16} fontSize={11} fill={MUTED}>
        {r.label}
      </text>
      <title>{`${r.statusLabel} · line ${r.line} · ${r.report.item.text}`}</title>
    </g>
  )
}

function Link({ link, lit, onClick }: { link: LinkLayout; lit: boolean; onClick: () => void }) {
  const s = link.diamond.size
  const { x, y } = link.diamond
  return (
    <g
      className={`story-link${lit ? ' is-lit' : ''}`}
      data-item-id={link.itemId}
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      aria-label={`${INCONSISTENT_LABEL}: ${link.tool}`}
    >
      {/* dashed link, never a solid arrow, no marker-end */}
      <path d={link.path} stroke={ACCENT} strokeWidth={lit ? 2 : 1} strokeDasharray="3 3" fill="none" />
      <polygon
        points={`${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}`}
        fill={ACCENT}
        stroke="var(--surface, transparent)"
        strokeWidth={2}
      />
      <text x={x + s + 4} y={y + 4} fontSize={11} fill="currentColor">
        {link.tool}
      </text>
      <title>{`${INCONSISTENT_LABEL} · ${link.tool} · ${link.hit.ts}`}</title>
    </g>
  )
}

export function StoryView({
  report,
  selectedItemId,
  onSelect,
  onActionClick,
  onHover,
  compaction,
  width = 800,
}: StoryViewProps) {
  const layout = layoutStory(report, { width }, compaction)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [bandHover, setBandHover] = useState(false)

  const hover = (id: string | null) => {
    setHoveredId(id)
    onHover?.(id)
  }
  const select = (id: string) => onSelect?.(id)
  const activeId = hoveredId ?? selectedItemId ?? null
  const isLit = (id: string) => activeId === id
  const isDim = (id: string) => activeId !== null && activeId !== id

  const { band } = layout
  return (
    <figure className="story-view" style={{ margin: 0 }}>
      <svg
        width="100%"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label={`Story view: ${layout.ribbons.length} items across the compaction boundary`}
        style={{ display: 'block', fontFamily: 'system-ui, sans-serif' }}
      >
        {/* region captions */}
        <text x={layout.before.x0} y={14} fontSize={11} fill={MUTED} letterSpacing={1}>
          BEFORE
        </text>
        <text x={layout.after.x0} y={14} fontSize={11} fill={MUTED} letterSpacing={1}>
          AFTER
        </text>

        {/* the dropped band */}
        <g
          className="story-band"
          onMouseEnter={() => setBandHover(true)}
          onMouseLeave={() => setBandHover(false)}
          onFocus={() => setBandHover(true)}
          onBlur={() => setBandHover(false)}
          tabIndex={0}
          aria-label={`${band.label}: ${band.facts.join(', ')}`}
        >
          <rect
            x={band.x}
            y={band.y}
            width={band.width}
            height={band.height}
            fill="var(--band, currentColor)"
            opacity={bandHover ? 0.35 : 0.18}
          />
          <text
            x={band.x + band.width / 2}
            y={band.y - 4}
            fontSize={11}
            fill="currentColor"
            textAnchor="middle"
            fontWeight={600}
          >
            {band.label}
          </text>
          <title>{band.facts.join('\n')}</title>
        </g>

        {/* ribbons */}
        {layout.ribbons.map((r) => (
          <Ribbon
            key={r.itemId}
            r={r}
            lit={isLit(r.itemId)}
            dim={isDim(r.itemId)}
            onHover={hover}
            onSelect={select}
          />
        ))}

        {/* restatement markers: hollow circles */}
        {layout.markers.map((m) => (
          <g key={`m-${m.itemId}`} className="story-marker" data-item-id={m.itemId}>
            <circle cx={m.x} cy={m.y} r={m.r} fill="var(--surface, transparent)" stroke="currentColor" strokeWidth={1.5} />
            <text x={m.x} y={m.y - m.r - 3} fontSize={10} fill={MUTED} textAnchor="middle">
              {m.label}
            </text>
            <title>{`restated at ${m.restatement.ts} (${m.restatement.score.toFixed(2)}, by ${m.restatement.by})`}</title>
          </g>
        ))}

        {/* dashed links to matched actions */}
        {layout.links.map((l) => (
          <Link key={`l-${l.itemId}`} link={l} lit={isLit(l.itemId)} onClick={() => onActionClick?.(l.itemId, l.hit)} />
        ))}
      </svg>
      <figcaption style={{ fontSize: 12 }}>
        {bandHover ? (
          <span className="story-band-facts">{band.facts.join(' · ')}</span>
        ) : layout.links.length > 0 ? (
          <span>
            ◆ {INCONSISTENT_LABEL}
          </span>
        ) : (
          <span>No downstream action linked in this report.</span>
        )}
      </figcaption>
    </figure>
  )
}
