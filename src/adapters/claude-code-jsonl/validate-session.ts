/**
 * Structural validation of a Session read from JSON. Fixtures pass through this at load and in
 * a test, so a committed fixture that drifts from the contract fails loudly.
 */
import type { Session } from '../../domain'

const PROVENANCE = new Set(['observed-sanitized', 'experiment-derived', 'constructed'])
const MESSAGE_KINDS = new Set(['human', 'assistant', 'tool_use', 'tool_result'])
const ITEM_CLASSES = new Set(['negation', 'positive', 'fact'])
const ENTITY_KINDS = new Set(['path', 'ticket', 'host', 'ident'])

export class SessionValidationError extends Error {}

function fail(msg: string): never {
  throw new SessionValidationError(msg)
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

function str(o: Record<string, unknown>, k: string, where: string): string {
  if (typeof o[k] !== 'string') fail(`${where}.${k} must be a string`)
  return o[k] as string
}

function num(o: Record<string, unknown>, k: string, where: string): number {
  if (typeof o[k] !== 'number') fail(`${where}.${k} must be a number`)
  return o[k] as number
}

export function validateSession(x: unknown): Session {
  if (!isObj(x)) fail('session must be an object')
  const w = 'session'
  str(x, 'id', w); str(x, 'label', w); str(x, 'claudeCodeVersion', w); str(x, 'model', w)
  const p = x.provenance
  if (!isObj(p) || !PROVENANCE.has(String(p.kind))) fail('session.provenance.kind invalid')
  if (p.kind === 'constructed' && typeof p.note !== 'string') fail('constructed provenance needs a note')
  if (p.kind === 'experiment-derived' && typeof p.run !== 'string') fail('experiment-derived provenance needs run')

  if (!Array.isArray(x.messages)) fail('session.messages must be an array')
  const uuids = new Set<string>()
  x.messages.forEach((m, i) => {
    if (!isObj(m)) fail(`messages[${i}] must be an object`)
    const mw = `messages[${i}]`
    uuids.add(str(m, 'uuid', mw)); str(m, 'ts', mw); num(m, 'line', mw)
    if (!MESSAGE_KINDS.has(String(m.kind))) fail(`${mw}.kind invalid`)
    if (str(m, 'excerpt', mw).length > 200) fail(`${mw}.excerpt exceeds 200 characters`)
  })

  if (!Array.isArray(x.compactions) || x.compactions.length === 0) fail('session.compactions must be non-empty')
  x.compactions.forEach((c, i) => {
    if (!isObj(c)) fail(`compactions[${i}] must be an object`)
    const cw = `compactions[${i}]`
    str(c, 'boundaryUuid', cw); str(c, 'ts', cw); num(c, 'preTokens', cw)
    if (c.trigger !== 'auto' && c.trigger !== 'manual') fail(`${cw}.trigger invalid`)
    if (!isObj(c.summary) || !Array.isArray(c.summary.lines)) fail(`${cw}.summary.lines must be an array`)
  })

  if (x.items !== undefined) {
    if (!Array.isArray(x.items)) fail('session.items must be an array when present')
    x.items.forEach((it, i) => {
      if (!isObj(it)) fail(`items[${i}] must be an object`)
      const iw = `items[${i}]`
      str(it, 'id', iw); str(it, 'text', iw)
      const ci = num(it, 'compactionIndex', iw)
      if (ci < 0 || ci >= (x.compactions as unknown[]).length) fail(`${iw}.compactionIndex out of range`)
      if (!ITEM_CLASSES.has(String(it.class))) fail(`${iw}.class invalid`)
      for (const k of ['entities', 'anchors'] as const) {
        if (!Array.isArray(it[k])) fail(`${iw}.${k} must be an array`)
        ;(it[k] as unknown[]).forEach((e, j) => {
          if (!isObj(e) || !ENTITY_KINDS.has(String(e.kind)) || typeof e.value !== 'string') fail(`${iw}.${k}[${j}] invalid`)
        })
      }
      if (!isObj(it.origin)) fail(`${iw}.origin must be an object`)
      const ou = str(it.origin, 'messageUuid', `${iw}.origin`)
      str(it.origin, 'ts', `${iw}.origin`); num(it.origin, 'line', `${iw}.origin`)
      if (!uuids.has(ou)) fail(`${iw}.origin.messageUuid ${ou} is not a message in this session`)
    })
  }
  return x as unknown as Session
}
