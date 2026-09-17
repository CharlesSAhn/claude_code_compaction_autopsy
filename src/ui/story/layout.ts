/**
 * Story view layout: pure math. `Report` in, positions out. No DOM, no React, no D3 selection.
 *
 * Horizontal axis: before region | compaction band | after region. One ribbon per item, ordered
 * by `origin.line`. PRESERVED and DEGRADED ribbons cross the band; LOST ribbons stop at it.
 * Matched items get a dashed link from the ribbon's band point to a diamond placed by `hit.ts`.
 * A restatement is a hollow circle on the ribbon at its time.
 */
import { scaleTime } from 'd3-scale'
import { line as d3Line } from 'd3-shape'
import type { ActionHit, Compaction, ItemReport, Report, Restatement, Status } from '../../domain'

export interface StorySize {
  width: number
}

export type Region = 'before' | 'band' | 'after'

export type EndMark = 'dot' | 'bar'

export interface RibbonLayout {
  itemId: string
  status: Status
  score: number
  /** Short form of the item text for the label. */
  label: string
  line: number
  y: number
  x0: number
  /** Where the ribbon ends: the band for LOST, the after region otherwise. */
  x1: number
  endRegion: Region
  endMark: EndMark
  dashed: boolean
  strokeWidth: number
  statusLabel: string
  path: string
  report: ItemReport
}

export interface LinkLayout {
  itemId: string
  x0: number
  y0: number
  x1: number
  y1: number
  path: string
  diamond: { x: number; y: number; size: number }
  tool: string
  hit: ActionHit
}

export interface MarkerLayout {
  itemId: string
  x: number
  y: number
  r: number
  label: 'restated'
  restatement: Restatement
}

export interface BandLayout {
  x: number
  width: number
  y: number
  height: number
  label: string
  facts: string[]
}

export interface StoryLayout {
  width: number
  height: number
  before: { x0: number; x1: number; label: 'before' }
  band: BandLayout
  after: { x0: number; x1: number; label: 'after' }
  ribbons: RibbonLayout[]
  links: LinkLayout[]
  markers: MarkerLayout[]
}

export const ROW_HEIGHT = 44
export const TOP_PAD = 36
export const BOTTOM_PAD = 20
export const LEFT_PAD = 16
export const RIGHT_PAD = 16
export const BAND_WIDTH = 18
export const LABEL_MAX = 48

/** Fraction of the drawable width taken by the before region. */
const BEFORE_FRACTION = 0.5

export function shortText(text: string, max = LABEL_MAX): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}

export function statusLabel(r: ItemReport): string {
  return r.survival.status === 'DEGRADED'
    ? `DEGRADED ${r.survival.score.toFixed(2)}`
    : r.survival.status
}

/** Which region an x position lands in. */
export function regionOf(x: number, layout: StoryLayout): Region {
  if (x < layout.band.x) return 'before'
  if (x <= layout.band.x + layout.band.width) return 'band'
  return 'after'
}

const lineGen = d3Line<[number, number]>()

export function layoutStory(report: Report, size: StorySize, compaction?: Compaction): StoryLayout {
  const width = Math.max(320, size.width)
  const items = [...report.items].sort((a, b) => a.item.origin.line - b.item.origin.line)
  const height = TOP_PAD + items.length * ROW_HEIGHT + BOTTOM_PAD

  const drawable = width - LEFT_PAD - RIGHT_PAD - BAND_WIDTH
  const beforeX0 = LEFT_PAD
  const beforeX1 = LEFT_PAD + drawable * BEFORE_FRACTION
  const bandX = beforeX1
  const afterX0 = bandX + BAND_WIDTH
  const afterX1 = width - RIGHT_PAD

  const band: BandLayout = {
    x: bandX,
    width: BAND_WIDTH,
    y: TOP_PAD - 12,
    height: height - TOP_PAD + 12 - BOTTOM_PAD + 8,
    label: compaction ? `compaction · ${compaction.trigger}` : 'compaction',
    facts: compaction
      ? [
          `before: ${compaction.preTokens} tokens`,
          compaction.postTokens === undefined ? 'after: not recorded' : `after: ${compaction.postTokens} tokens`,
          `boundary: ${compaction.ts}`,
        ]
      : ['token facts: not available'],
  }

  // Time scale for the after region, driven by the events that land there.
  const eventTimes: number[] = []
  for (const r of items) {
    if (r.downstream.hit) eventTimes.push(Date.parse(r.downstream.hit.ts))
    if (r.restatement) eventTimes.push(Date.parse(r.restatement.ts))
  }
  const t0 = compaction ? Date.parse(compaction.ts) : eventTimes.length ? Math.min(...eventTimes) : 0
  const t1 = eventTimes.length ? Math.max(...eventTimes) : t0
  const afterInner0 = afterX0 + 24
  const afterInner1 = afterX1 - 28
  const timeX = scaleTime().domain([new Date(t0), new Date(t1)]).range([afterInner0, afterInner1])
  const placeTime = (ts: string): number =>
    t1 > t0 ? timeX(new Date(Date.parse(ts))) : (afterInner0 + afterInner1) / 2

  const ribbons: RibbonLayout[] = []
  const links: LinkLayout[] = []
  const markers: MarkerLayout[] = []

  items.forEach((r, i) => {
    const y = TOP_PAD + i * ROW_HEIGHT + ROW_HEIGHT / 2
    const status = r.survival.status
    const lost = status === 'LOST'
    const x0 = beforeX0 + 8
    const x1 = lost ? bandX : afterX1
    const path = lineGen([
      [x0, y],
      [x1, y],
    ]) ?? ''
    ribbons.push({
      itemId: r.item.id,
      status,
      score: r.survival.score,
      label: shortText(r.item.text),
      line: r.item.origin.line,
      y,
      x0,
      x1,
      endRegion: lost ? 'band' : 'after',
      endMark: lost ? 'bar' : 'dot',
      dashed: status === 'DEGRADED',
      strokeWidth: status === 'DEGRADED' ? 1 : 2,
      statusLabel: statusLabel(r),
      path,
      report: r,
    })

    if (r.downstream.result === 'matched' && r.downstream.hit) {
      const hit = r.downstream.hit
      const dx = placeTime(hit.ts)
      const dy = y + 14
      const lx0 = afterX0
      const linkPath = lineGen([
        [lx0, y],
        [dx, dy],
      ]) ?? ''
      links.push({
        itemId: r.item.id,
        x0: lx0,
        y0: y,
        x1: dx,
        y1: dy,
        path: linkPath,
        diamond: { x: dx, y: dy, size: 7 },
        tool: hit.tool,
        hit,
      })
    }

    if (r.restatement) {
      markers.push({
        itemId: r.item.id,
        x: placeTime(r.restatement.ts),
        y,
        r: 5,
        label: 'restated',
        restatement: r.restatement,
      })
    }
  })

  return {
    width,
    height,
    before: { x0: beforeX0, x1: beforeX1, label: 'before' },
    band,
    after: { x0: afterX0, x1: afterX1, label: 'after' },
    ribbons,
    links,
    markers,
  }
}
