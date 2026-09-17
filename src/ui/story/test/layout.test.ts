import { describe, expect, it } from 'vitest'
import { layoutStory, regionOf, shortText } from '../layout'
import { STUB_COMPACTION, STUB_REPORT } from './stub-report'

const SIZE = { width: 800 }

describe('layoutStory', () => {
  const layout = layoutStory(STUB_REPORT, SIZE, STUB_COMPACTION)
  const byId = Object.fromEntries(layout.ribbons.map((r) => [r.itemId, r]))

  it('orders ribbons by origin.line and sizes height by item count', () => {
    expect(layout.ribbons.map((r) => r.line)).toEqual([51, 91, 127, 157])
    expect(layout.height).toBeGreaterThan(layout.ribbons.length * 40)
    expect(layout.width).toBe(800)
  })

  it('places the band between the before and after regions', () => {
    expect(layout.before.x1).toBe(layout.band.x)
    expect(layout.after.x0).toBe(layout.band.x + layout.band.width)
    expect(layout.band.label).toBe('compaction · auto')
    expect(layout.band.facts).toEqual(['before: 161000 tokens', 'after: 12400 tokens', 'boundary: 2026-09-16T18:40:00.000Z'])
  })

  it('every ribbon starts in the before region', () => {
    for (const r of layout.ribbons) expect(regionOf(r.x0, layout)).toBe('before')
  })

  it('PRESERVED crosses solid, full weight, dot end', () => {
    const r = byId['0:51:0']
    expect(r.status).toBe('PRESERVED')
    expect(regionOf(r.x1, layout)).toBe('after')
    expect(r.endRegion).toBe('after')
    expect(r.dashed).toBe(false)
    expect(r.strokeWidth).toBe(2)
    expect(r.endMark).toBe('dot')
    expect(r.statusLabel).toBe('PRESERVED')
  })

  it('DEGRADED crosses dashed-thin with its score in the label', () => {
    const r = byId['0:91:1']
    expect(regionOf(r.x1, layout)).toBe('after')
    expect(r.dashed).toBe(true)
    expect(r.strokeWidth).toBe(1)
    expect(r.statusLabel).toBe('DEGRADED 0.18')
  })

  it('LOST stops at the band with a bar end', () => {
    const r = byId['0:157:3']
    expect(regionOf(r.x1, layout)).toBe('band')
    expect(r.endRegion).toBe('band')
    expect(r.x1).toBe(layout.band.x)
    expect(r.endMark).toBe('bar')
    expect(r.dashed).toBe(false)
    expect(r.statusLabel).toBe('LOST')
  })

  it('matched items get one link from the band point to a diamond in the after region', () => {
    expect(layout.links).toHaveLength(1)
    const link = layout.links[0]
    expect(link.itemId).toBe('0:91:1')
    expect(link.x0).toBe(layout.after.x0)
    expect(link.y0).toBe(byId['0:91:1'].y)
    expect(regionOf(link.diamond.x, layout)).toBe('after')
    expect(link.tool).toBe('mcp__tracker__save_comment')
  })

  it('a restatement is a hollow circle on its ribbon in the after region, earlier than the later hit', () => {
    expect(layout.markers).toHaveLength(1)
    const m = layout.markers[0]
    expect(m.itemId).toBe('0:127:2')
    expect(m.y).toBe(byId['0:127:2'].y)
    expect(m.label).toBe('restated')
    expect(regionOf(m.x, layout)).toBe('after')
    expect(m.x).toBeLessThan(layout.links[0].diamond.x)
  })

  it('without a compaction the band still lays out and says the facts are not available', () => {
    const l = layoutStory(STUB_REPORT, SIZE)
    expect(l.band.label).toBe('compaction')
    expect(l.band.facts).toEqual(['token facts: not available'])
    expect(l.ribbons).toHaveLength(4)
  })

  it('clamps to a minimum width', () => {
    expect(layoutStory(STUB_REPORT, { width: 100 }).width).toBe(320)
  })
})

describe('shortText', () => {
  it('collapses whitespace and truncates with an ellipsis', () => {
    expect(shortText('a  b')).toBe('a b')
    expect(shortText('x'.repeat(60))).toHaveLength(48)
    expect(shortText('x'.repeat(60)).endsWith('…')).toBe(true)
  })
})
