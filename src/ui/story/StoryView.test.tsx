import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { INCONSISTENT_LABEL } from '../../domain'
import { StoryView } from './StoryView'
import { STUB_COMPACTION, STUB_REPORT } from './test/stub-report'

describe('StoryView renderToString smoke', () => {
  const html = renderToString(<StoryView report={STUB_REPORT} compaction={STUB_COMPACTION} selectedItemId="0:91:1" />)

  it('contains every item text', () => {
    for (const r of STUB_REPORT.items) {
      // Item text appears in the ribbon's <title>; React escapes quotes as &#x27;
      const escaped = r.item.text.replace(/'/g, '&#x27;')
      expect(html).toContain(escaped)
    }
  })

  it('contains the status labels and the line numbers', () => {
    expect(html).toContain('PRESERVED')
    expect(html).toContain('DEGRADED 0.18')
    expect(html).toContain('LOST')
    for (const r of STUB_REPORT.items) expect(html).toContain(`line ${r.item.origin.line}`)
  })

  it('renders the band label and the contract label from the constant', () => {
    expect(html).toContain('compaction · auto')
    expect(html).toContain(INCONSISTENT_LABEL)
    expect(html).toContain('mcp__tracker__save_comment')
    expect(html).toContain('restated')
  })

  it('draws the link dashed with a diamond and never a solid arrow', () => {
    expect(html).toContain('stroke-dasharray="3 3"')
    expect(html).toContain('<polygon')
    expect(html).not.toContain('marker-end')
  })

  it('one ribbon per item, DEGRADED dashed, LOST with a bar end', () => {
    expect(html.match(/class="story-ribbon /g)).toHaveLength(4)
    expect(html).toContain('story-ribbon--lost')
    expect(html).toContain('stroke-dasharray="4 4"')
    expect(html).toContain('is-lit')
  })

  it('never says caused', () => {
    expect(html.toLowerCase()).not.toContain('caused')
  })
})
