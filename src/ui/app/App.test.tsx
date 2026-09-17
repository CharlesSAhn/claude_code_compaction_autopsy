/**
 * Smoke: the shell renders every fixture to a string without throwing (react-dom/server, no
 * jsdom) and shows the label, the provenance kind in capitals, the note when constructed, the
 * slots' note, the boundary bar, and the footer line.
 */
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from './App.tsx'
import { FOOTER_LINE } from './Footer.tsx'
import { NOT_ANALYZED } from './slots.tsx'
import { analyzedSource } from '../../source.ts'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
}

describe('shell smoke', () => {
  for (const ref of analyzedSource.list()) {
    it(`renders ${ref.id}`, () => {
      const session = analyzedSource.get(ref.id)
      if (session === undefined) throw new Error(`missing session ${ref.id}`)
      const html = renderToString(<App source={analyzedSource} initialSearch={`?session=${ref.id}`} />)
      expect(html).toContain(escapeHtml(ref.label))
      expect(html).toContain(ref.provenance.kind.toUpperCase())
      if (ref.provenance.kind === 'constructed') expect(html).toContain(escapeHtml(ref.provenance.note))
      if (ref.provenance.kind === 'experiment-derived') expect(html).toContain(escapeHtml(ref.provenance.run))
      expect(html).toContain(escapeHtml(session.claudeCodeVersion))
      expect(html).toContain(escapeHtml(session.model))
      expect(html).toContain(`compaction · ${session.compactions[0].trigger}`)
      expect(html).toContain(escapeHtml(FOOTER_LINE))
      expect(html).toContain(NOT_ANALYZED)
      expect(html).not.toContain(session.compactions[0].summary.uuid)
      for (const m of session.messages) expect(html).toContain(`id="msg-${m.uuid}"`)
      expect(html).toContain(`<option value="${ref.id}" selected="">`)
    })
  }

  it('opens on the default session (the ticket case) with no query string', () => {
    const html = renderToString(<App source={analyzedSource} initialSearch="" />)
    expect(analyzedSource.defaultId()).toBe('constructed-ticket')
    expect(html).toContain('<option value="constructed-ticket" selected="">')
  })
})
