/**
 * Smoke per fixture (react-dom/server): the panel shows the status words, the label when matched,
 * the closing line under every downstream result, both empty-state strings with their reasons,
 * and `HEALTHY_LINE` on the healthy case only. The drawer renders marks from the offsets.
 */
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CLOSING_LINE, INCONSISTENT_LABEL } from '../../domain'
import { analyzedSessions } from '../../source.ts'
import { AutopsyPanel } from './AutopsyPanel.tsx'
import { EvidenceDrawer } from './EvidenceDrawer.tsx'
import { HEALTHY_LINE, NONE_FOUND, NOT_CHECKABLE, START_HERE } from './strings.ts'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
}

const noop = () => {}

function panel(id: string, selectedItemId?: string, showStartHere = false) {
  const a = analyzedSessions.get(id)
  if (!a) throw new Error(`missing ${id}`)
  const report = a.reports[0]
  const html = renderToString(
    <AutopsyPanel
      session={a.session}
      report={report}
      selectedItemId={selectedItemId}
      showStartHere={showStartHere}
      onSelectItem={noop}
      onOpenEvidence={noop}
      onJumpToMessage={noop}
    />,
  )
  return { a, report, html }
}

function count(html: string, needle: string): number {
  return html.split(needle).length - 1
}

describe('AutopsyPanel per fixture', () => {
  it('healthy: four PRESERVED at 1.00, three none found, one not checkable, HEALTHY_LINE, no label', () => {
    const { html } = panel('healthy-run2')
    expect(count(html, '>PRESERVED verbatim<')).toBe(4)
    expect(count(html, '>1.00<')).toBe(4)
    expect(html).toContain('4 items from 4 prompts before the boundary')
    expect(html).toContain('4 PRESERVED')
    expect(html).toContain('0 DEGRADED, 0 LOST')
    expect(html).toContain('0 matched, 3 none found, 1 not checkable')
    expect(count(html, 'NONE FOUND · 17 tool calls after')).toBe(3)
    expect(count(html, '>NOT CHECKABLE<')).toBe(1)
    expect(html).toContain(HEALTHY_LINE)
    expect(html).not.toContain(INCONSISTENT_LABEL)
  })

  it('healthy: a none found trace carries the scan count and what closed the window; the fact says why', () => {
    const rule = panel('healthy-run2', '0:51:0').html
    expect(rule).toContain(`${NONE_FOUND}: 17 tool calls after the compaction, none matched · until the end of the session`)
    expect(rule).toContain('scope: file_edit, bash_write')
    expect(rule).toContain('not restated')
    expect(rule).toContain(escapeHtml(CLOSING_LINE))
    const fact = panel('healthy-run2', '0:157:3').html
    expect(fact).toContain(`${NOT_CHECKABLE}: a fact has no anchor`)
    expect(fact).toContain('scope: none')
    expect(fact).toContain(escapeHtml(CLOSING_LINE))
  })

  it('ticket: the ticket rule DEGRADED with its score, the comment call under the label, no HEALTHY_LINE', () => {
    const { html, report } = panel('constructed-ticket', '0:91:1')
    const row = report.items[1]
    expect(html).toContain('>DEGRADED<')
    expect(html).toContain(`>${row.survival.score.toFixed(2)}<`)
    expect(html).toContain(`INCONSISTENT ACTION · ${row.downstream.hit?.tool} · `)
    expect(html).toContain(INCONSISTENT_LABEL)
    expect(html).toContain('mcp__tracker__save_comment')
    expect(html).toContain(escapeHtml(row.downstream.hit?.excerpt ?? '?'))
    expect(html).toContain(escapeHtml(CLOSING_LINE))
    expect(html).not.toContain(HEALTHY_LINE)
    expect(html).toContain('1 matched, 2 none found, 1 not checkable')
  })

  it('file-edit: the file rule LOST, the Edit as the first action, the restatement with time and score', () => {
    const { html } = panel('constructed-file-edit', '0:51:0')
    expect(html).toContain('>LOST<')
    expect(html).toContain('INCONSISTENT ACTION · Edit · 18:40:48')
    expect(html).toContain(INCONSISTENT_LABEL)
    expect(html).toContain('forbidden_path')
    expect(html).toContain('before restatement')
    expect(html).toContain('restated at 18:48:48 UTC (0.70, by score)')
    // QA finding 13: the order row exists only when something was restated
    const ticket = panel('constructed-ticket', '0:91:1').html
    expect(ticket).toContain('not restated')
    expect(ticket).not.toContain('before restatement')
    expect(html).toContain('summary line 21: ')
    expect(html).toContain('«</span>rotate_keys.py<span aria-hidden="true">»')
    expect(html).toContain(escapeHtml(CLOSING_LINE))
  })

  it('shows the one-line Start here hint only when asked', () => {
    expect(panel('constructed-ticket', undefined, true).html).toContain(START_HERE)
    expect(panel('constructed-ticket').html).not.toContain(START_HERE)
  })

  it('renders the two fixed strings from the constants: the closing line once per traced item, the label only when matched', () => {
    for (const id of analyzedSessions.keys()) {
      const { html, report } = panel(id, report0(id))
      expect(report.closing).toBe(CLOSING_LINE)
      expect(count(html, escapeHtml(CLOSING_LINE))).toBe(1)
      const first = report.items[0]
      expect(html.includes(INCONSISTENT_LABEL)).toBe(first?.downstream.result === 'matched')
    }
  })
})

function report0(id: string): string | undefined {
  return analyzedSessions.get(id)?.reports[0].items[0]?.item.id
}

describe('EvidenceDrawer', () => {
  it('renders the passage with marks from the offsets, the entities, the thresholds, and the after block', () => {
    const a = analyzedSessions.get('constructed-ticket')
    if (!a) throw new Error('missing ticket')
    const row = a.reports[0].items[1]
    const html = renderToString(
      <EvidenceDrawer session={a.session} compactionIndex={0} row={row} onClose={noop} onJumpToMessage={noop} />,
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain(escapeHtml(row.item.text))
    expect(html).toContain(`summary line ${row.survival.passage.lineIndex + 1}`)
    expect(count(html, 'class="marks__span marks__span--exact"')).toBeGreaterThanOrEqual(row.survival.matches.length)
    expect(html).toContain(row.survival.entitiesInPassage.join(', '))
    expect(html).toContain('preserved ≥ 0.75, degraded ≥ 0.35')
    expect(html).toContain(INCONSISTENT_LABEL)
    expect(html).toContain(escapeHtml(CLOSING_LINE))
    expect(html).toContain(`Summary (${a.session.compactions[0].summary.lines.length} lines)`)
    expect(html).toContain('summary__line summary__line--passage')
  })
})
