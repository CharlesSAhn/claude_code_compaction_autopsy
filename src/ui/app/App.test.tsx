/**
 * Smoke: the shell renders every fixture to a string without throwing (react-dom/server, no
 * jsdom) and shows the label, the provenance kind in capitals, the note when constructed, the
 * autopsy panel with its statuses and fixed strings, the story, the boundary bar, and the footer.
 */
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CLOSING_LINE, INCONSISTENT_LABEL } from '../../domain'
import { App } from './App.tsx'
import { FOOTER_LINE } from './Footer.tsx'
import { HEALTHY_LINE, NONE_FOUND, NOT_CHECKABLE, START_HERE } from '../autopsy/strings.ts'
import { analyzedSessions, analyzedSource } from '../../source.ts'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
}

const render = (search: string) => renderToString(<App source={analyzedSource} analyzed={analyzedSessions} initialSearch={search} />)

describe('shell smoke', () => {
  for (const ref of analyzedSource.list()) {
    it(`renders ${ref.id}`, () => {
      const session = analyzedSource.get(ref.id)
      const report = analyzedSessions.get(ref.id)?.reports[0]
      if (session === undefined || report === undefined) throw new Error(`missing session ${ref.id}`)
      const html = render(`?session=${ref.id}`)
      expect(html).toContain(escapeHtml(ref.label))
      expect(html).toContain(ref.provenance.kind.toUpperCase())
      if (ref.provenance.kind === 'constructed') expect(html).toContain(escapeHtml(ref.provenance.note))
      if (ref.provenance.kind === 'experiment-derived') expect(html).toContain(escapeHtml(ref.provenance.run))
      expect(html).toContain(escapeHtml(session.claudeCodeVersion))
      expect(html).toContain(escapeHtml(session.model))
      expect(html).toContain(`compaction · ${session.compactions[0].trigger}`)
      expect(html).toContain(escapeHtml(FOOTER_LINE))
      expect(html).not.toContain('not analyzed in this build')
      expect(html).not.toContain(session.compactions[0].summary.uuid)
      for (const m of session.messages) expect(html).toContain(`id="msg-${m.uuid}"`)
      expect(html).toContain(`<option value="${ref.id}" selected="">`)
      // The panel: every item, every status word, the closing line once per item in the ledger's trace-less state
      for (const r of report.items) {
        expect(html).toContain(escapeHtml(r.item.text))
        expect(html).toContain(r.survival.status)
      }
      const matched = report.items.some((r) => r.downstream.result === 'matched')
      expect(html.includes(HEALTHY_LINE)).toBe(!matched)
      expect(html).toContain(`${escapeHtml(ref.label)} · ${ref.provenance.kind.toUpperCase()}</option>`)
      // The story toggle is present; view=story mounts the story with the real report: one ribbon per item
      expect(html).toContain('aria-label="Ledger or story"')
      const story = render(`?session=${ref.id}&view=story`)
      expect(story.match(/class="story-ribbon /g)).toHaveLength(report.items.length)
      expect(story).not.toContain('class="ledger"')
      // The label renders from the constant where a matched item is drawn: the story's link, the trace's after step
      if (matched) expect(story).toContain(INCONSISTENT_LABEL)
    })
  }

  it('opens on the default session (the ticket case) with no query string and the Start here hint', () => {
    const html = render('')
    expect(analyzedSource.defaultId()).toBe('constructed-ticket')
    expect(html).toContain('<option value="constructed-ticket" selected="">')
    expect(html).toContain(START_HERE)
  })

  it('the same item= opens the same selection in ledger and story views', () => {
    const ledger = render('?session=constructed-file-edit&item=0%3A51%3A0')
    const story = render('?session=constructed-file-edit&item=0%3A51%3A0&view=story')
    expect(ledger).toContain('aria-label="Trace of item 0:51:0"')
    expect(story).toContain('aria-label="Trace of item 0:51:0"')
    expect(ledger).toContain('class="ledger__row is-selected"')
    expect(story).toContain('is-lit')
  })

  it('keeps item= from the URL using the analyzed ids and renders the trace with the closing line', () => {
    const html = render('?session=constructed-file-edit&item=0%3A51%3A0')
    expect(html).toContain('aria-label="Trace of item 0:51:0"')
    expect(html).toContain(escapeHtml(CLOSING_LINE))
    expect(html).toContain(INCONSISTENT_LABEL)
    expect(html).not.toContain(START_HERE)
  })

  it('opens the evidence drawer for view=evidence', () => {
    const html = render('?session=healthy-run2&item=0%3A51%3A0&view=evidence')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('panel-host--dimmed')
    expect(html).toContain(NONE_FOUND)
  })

  it('renders both empty states on the healthy case', () => {
    const html = render('?session=healthy-run2&item=0%3A157%3A3')
    expect(html).toContain(`${NOT_CHECKABLE}: a fact has no anchor`)
    expect(html).toContain('NOT CHECKABLE')
    expect(html).toContain('NONE FOUND · ')
  })
})
