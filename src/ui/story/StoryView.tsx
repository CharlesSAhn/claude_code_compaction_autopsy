/**
 * Story view: React SVG rendered from `layoutStory`. Status is carried by the label and the line
 * style (solid / dashed-thin / bar end), never by color alone. The two contract strings render from
 * the constants imported from the domain. D3 transitions run on the rendered nodes only.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { easeCubicOut } from 'd3-ease'
import { select } from 'd3-selection'
// Side-effect import: adds `.transition()` to d3-selection selections.
import 'd3-transition'
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
  /** The motion toggle. `false` renders end states with no transitions, as does prefers-reduced-motion. */
  motion?: boolean
}

export type PlayAct = 'source' | 'compaction' | 'after' | 'evidence'

/** The four acts, in order. Act 0 is "not playing": the whole end state. */
const ACTS: PlayAct[] = ['source', 'compaction', 'after', 'evidence']

const FLOW_MS = 1000
const DRAW_MS = 400

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

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
  showStatus,
  onHover,
  onSelect,
}: {
  r: RibbonLayout
  lit: boolean
  dim: boolean
  showStatus: boolean
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
        <tspan fontWeight={600} opacity={showStatus ? 1 : 0}>
          {r.statusLabel}
        </tspan>
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
      <text x={link.labelX} y={y + 4} fontSize={11} fill="currentColor" textAnchor={link.labelAnchor}>
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
  onPlayStep,
  onHover,
  compaction,
  width = 800,
  motion = true,
}: StoryViewProps) {
  const layout = layoutStory(report, { width }, compaction)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [bandHover, setBandHover] = useState(false)
  /** 0 = not playing; 1..4 = the act currently shown. Keyed by report so a new report resets to the end state. */
  const [play, setPlay] = useState<{ key: string; act: number }>({ key: '', act: 0 })
  const clipId = useId()
  const clipRef = useRef<SVGRectElement>(null)
  const afterRef = useRef<SVGGElement>(null)

  const hover = (id: string | null) => {
    setHoveredId(id)
    onHover?.(id)
  }
  const selectItem = (id: string) => onSelect?.(id)
  const activeId = hoveredId ?? selectedItemId ?? null
  const isLit = (id: string) => activeId === id
  const isDim = (id: string) => activeId !== null && activeId !== id

  const { band } = layout
  const reportKey = `${report.sessionId}:${report.compactionIndex}`
  const act = play.key === reportKey ? play.act : 0
  const playing = act > 0
  // What each act shows. Server render and reduced motion draw these end states directly.
  const clipTarget = act === 1 ? band.x : layout.width
  const showStatus = !playing || act >= 2
  const showAfter = !playing || act >= 3
  // Interactions 3 and 5: transitions run on the rendered nodes, never in the layout.
  useEffect(() => {
    const clip = clipRef.current
    const after = afterRef.current
    if (!clip || !after) return
    const animate = motion && !reducedMotion()
    const clipSel = select(clip)
    const afterSel = select(after)
    clipSel.interrupt()
    afterSel.interrupt()
    if (!animate) {
      clipSel.attr('width', clipTarget)
      afterSel.attr('opacity', showAfter ? 1 : 0)
      return
    }
    if (act === 0) {
      // Mount, report change, session switch: ribbons travel, links draw last.
      clipSel.attr('width', 0).transition().duration(FLOW_MS).ease(easeCubicOut).attr('width', layout.width)
      afterSel.attr('opacity', 0).transition().delay(FLOW_MS - 100).duration(DRAW_MS).attr('opacity', 1)
    } else if (act === 1) {
      clipSel.transition().duration(DRAW_MS).ease(easeCubicOut).attr('width', band.x)
      afterSel.transition().duration(DRAW_MS).attr('opacity', 0)
    } else if (act === 2) {
      clipSel.transition().duration(FLOW_MS).ease(easeCubicOut).attr('width', layout.width)
    } else if (act === 3) {
      afterSel.transition().duration(DRAW_MS).attr('opacity', 1)
    }
    return () => {
      clipSel.interrupt()
      afterSel.interrupt()
    }
  }, [reportKey, act, motion, clipTarget, showAfter, layout.width, band.x])

  const playStep = () => {
    const next = act >= ACTS.length ? 0 : act + 1
    setPlay({ key: reportKey, act: next })
    if (next > 0) onPlayStep?.(ACTS[next - 1])
  }
  const playLabel = act === 0 ? 'Play story' : act >= ACTS.length ? 'Show all' : `Next: ${ACTS[act]}`

  return (
    <figure className="story-view" data-act={act} style={{ margin: 0 }}>
      <svg
        width="100%"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label={`Story view: ${layout.ribbons.length} items across the compaction boundary`}
        style={{ display: 'block', fontFamily: 'system-ui, sans-serif' }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect ref={clipRef} x={0} y={0} width={clipTarget} height={layout.height} />
          </clipPath>
        </defs>

        {/* region captions */}
        <text x={layout.before.x0} y={14} fontSize={11} fill={MUTED} letterSpacing={1}>
          BEFORE
        </text>
        <text x={layout.after.x1} y={14} fontSize={11} fill={MUTED} letterSpacing={1} textAnchor="end">
          AFTER
        </text>

        {/* the dropped band */}
        <g
          className="story-band"
          opacity={playing && act < 2 ? 0.4 : 1}
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

        {/* ribbons, clipped so they travel left to right */}
        <g className="story-ribbons" clipPath={`url(#${clipId})`}>
          {layout.ribbons.map((r) => (
            <Ribbon
              key={r.itemId}
              r={r}
              lit={isLit(r.itemId)}
              dim={isDim(r.itemId)}
              showStatus={showStatus}
              onHover={hover}
              onSelect={selectItem}
            />
          ))}
        </g>

        {/* after the band: restatement markers and dashed links, drawn last */}
        <g ref={afterRef} className="story-after" opacity={showAfter ? 1 : 0}>
          {layout.markers.map((m) => (
            <g key={`m-${m.itemId}`} className="story-marker" data-item-id={m.itemId}>
              {m.stem !== undefined && (
                <path className="story-marker__stem" d={m.stem} stroke={MUTED} strokeWidth={1} strokeDasharray="1 3" fill="none" />
              )}
              <circle cx={m.x} cy={m.y} r={m.r} fill="var(--surface, transparent)" stroke="currentColor" strokeWidth={1.5} />
              <text x={m.x} y={m.y - m.r - 3} fontSize={10} fill={MUTED} textAnchor="middle">
                {m.label}
              </text>
              <title>{`restated at ${m.restatement.ts} (${m.restatement.score.toFixed(2)}, by ${m.restatement.by})`}</title>
            </g>
          ))}
          {layout.links.map((l) => (
            <Link key={`l-${l.itemId}`} link={l} lit={isLit(l.itemId)} onClick={() => onActionClick?.(l.itemId, l.hit)} />
          ))}
        </g>
      </svg>
      <figcaption style={{ fontSize: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="story-play" onClick={playStep}>
          {playLabel}
        </button>
        {playing && (
          <span className="story-act">
            act {act} of {ACTS.length}: {ACTS[act - 1]}
          </span>
        )}
        {bandHover ? (
          <span className="story-band-facts">{band.facts.join(' · ')}</span>
        ) : layout.links.length > 0 ? (
          <span>◆ {INCONSISTENT_LABEL}</span>
        ) : (
          <span>none found</span>
        )}
      </figcaption>
    </figure>
  )
}
