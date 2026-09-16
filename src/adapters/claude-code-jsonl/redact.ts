/**
 * Redaction for fixtures that leave the machine. Home directories become /home/dev, the
 * session id becomes the fixture name. Applied to every string in the Session, including
 * summary lines and excerpts. Deterministic.
 */
import type { Session } from '../../domain'

export interface RedactOptions {
  /** Absolute home directories to replace, longest first. */
  homes: string[]
  /** The raw session id, replaced everywhere by the fixture id. */
  rawSessionId?: string
}

export function redactString(s: string, opts: RedactOptions, fixtureId: string): string {
  let out = s
  for (const h of [...opts.homes].sort((a, b) => b.length - a.length)) {
    if (!h) continue
    out = out.split(h).join('/home/dev')
    out = out.split(h.replace(/[^a-zA-Z0-9]/g, '-')).join('-home-dev')
    // The bare username also shows up as a file owner in ls output and in agent socket paths.
    const user = h.split('/').filter(Boolean).pop()
    if (user && user.length >= 4) out = out.replace(new RegExp(`\\b${user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), 'dev')
  }
  if (opts.rawSessionId) out = out.split(opts.rawSessionId).join(fixtureId)
  return out
}

export function redactSession(session: Session, opts: RedactOptions): Session {
  const r = (s: string) => redactString(s, opts, session.id)
  return {
    ...session,
    messages: session.messages.map((m) => ({
      ...m,
      excerpt: r(m.excerpt),
      ...(m.text !== undefined ? { text: r(m.text) } : {}),
      ...(m.action
        ? {
            action: {
              ...m.action,
              ...(m.action.filePath !== undefined ? { filePath: r(m.action.filePath) } : {}),
              ...(m.action.command !== undefined ? { command: r(m.action.command) } : {}),
              ...(m.action.addedText !== undefined ? { addedText: r(m.action.addedText) } : {}),
              ...(m.action.mcpInput !== undefined ? { mcpInput: r(m.action.mcpInput) } : {}),
            },
          }
        : {}),
    })),
    compactions: session.compactions.map((c) => ({ ...c, summary: { ...c.summary, lines: c.summary.lines.map(r) } })),
    ...(session.items ? { items: session.items.map((it) => ({ ...it, text: r(it.text) })) } : {}),
  }
}
