/**
 * Records → Session (without items). Items come from stage 1: pre-labeled in fixtures, or
 * extracted by analyze for real data.
 */
import type { Compaction, Message, Provenance, Session, ToolAction } from '../../domain'
import { isHumanPrompt, textOf, toolUses, type RawRecord } from './parse.ts'

export const EXCERPT_MAX = 200
/** Upper bound on any single action text, so a fixture stays a fixture. */
export const ACTION_TEXT_MAX = 4000

/** What stage 4 inspects: file path, command, added text, or the MCP input as JSON. */
export function toolAction(name: string, toolUseId: string, input: Record<string, unknown>): ToolAction {
  const a: ToolAction = { tool: name, toolUseId }
  const fp = input.file_path ?? input.notebook_path
  if (typeof fp === 'string') a.filePath = fp
  if (typeof input.command === 'string') a.command = cap(input.command)
  const added = addedText(name, input)
  if (added) a.addedText = cap(added)
  if (name.startsWith('mcp__')) a.mcpInput = cap(JSON.stringify(input))
  return a
}

/** Write: the whole content. Edit: new_string lines not present in old_string. MultiEdit: each edit likewise. */
export function addedText(name: string, input: Record<string, unknown>): string {
  if (name === 'Write' && typeof input.content === 'string') return input.content
  if (name === 'Edit') return newLines(input)
  if (name === 'MultiEdit' && Array.isArray(input.edits)) {
    return (input.edits as Record<string, unknown>[]).map(newLines).filter(Boolean).join('\n')
  }
  return ''
}

function newLines(e: Record<string, unknown>): string {
  const oldS = typeof e.old_string === 'string' ? e.old_string : ''
  const newS = typeof e.new_string === 'string' ? e.new_string : ''
  const old = new Set(oldS.split('\n'))
  return newS.split('\n').filter((l) => !old.has(l)).join('\n')
}

function cap(s: string): string {
  return s.length <= ACTION_TEXT_MAX ? s : s.slice(0, ACTION_TEXT_MAX)
}

export interface ToSessionOptions {
  id: string
  label: string
  provenance: Provenance
}

export function toSession(records: RawRecord[], opts: ToSessionOptions): Session {
  const version = records.find((r) => r.version)?.version ?? 'unknown'
  const model = records.find((r) => r.type === 'assistant' && r.message?.model)?.message?.model ?? 'unknown'
  const messages: Message[] = []
  const compactions: Compaction[] = []

  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    if (r.type === 'system' && r.subtype === 'compact_boundary') {
      const summary = records.slice(i + 1).find((s) => s.type === 'user' && s.isCompactSummary)
      const meta = r.compactMetadata ?? {}
      compactions.push({
        boundaryUuid: r.uuid ?? '',
        ts: r.timestamp ?? '',
        trigger: meta.trigger === 'auto' ? 'auto' : 'manual',
        preTokens: meta.preTokens ?? 0,
        ...(meta.postTokens !== undefined ? { postTokens: meta.postTokens } : {}),
        summary: { uuid: summary?.uuid ?? '', lines: summary ? textOf(summary).split('\n') : [] },
      })
      continue
    }
    if (isHumanPrompt(r)) {
      const t = textOf(r)
      messages.push({ ...base(r, 'human', excerpt(t)), text: cap(t) })
      continue
    }
    if (r.type === 'assistant') {
      const uses = toolUses(r)
      if (uses.length === 0) {
        const t = textOf(r)
        if (t.trim()) messages.push(base(r, 'assistant', excerpt(t)))
        continue
      }
      for (const u of uses) {
        const name = u.name ?? ''
        const input = u.input ?? {}
        messages.push({
          ...base(r, 'tool_use', excerpt(toolExcerpt(name, input))),
          tool: name,
          action: toolAction(name, u.id ?? '', input),
        })
      }
      continue
    }
    if (r.type === 'user' && Array.isArray(r.message?.content) && r.message.content.some((b) => b.type === 'tool_result')) {
      const first = r.message.content.find((b) => b.type === 'tool_result')
      const c = first?.content
      const t = typeof c === 'string' ? c : Array.isArray(c) ? JSON.stringify(c) : ''
      messages.push(base(r, 'tool_result', excerpt(t)))
    }
  }

  return { id: opts.id, label: opts.label, provenance: opts.provenance, claudeCodeVersion: version, model, messages, compactions }
}

function base(r: RawRecord, kind: Message['kind'], text: string): Message {
  return { uuid: r.uuid ?? '', ts: r.timestamp ?? '', line: r.line, kind, excerpt: text }
}

export function excerpt(t: string): string {
  const s = t.replace(/\s+/g, ' ').trim()
  return s.length <= EXCERPT_MAX ? s : s.slice(0, EXCERPT_MAX - 1) + '…'
}

/** What a tool call did, in one line: file path or command or the input as JSON. */
export function toolExcerpt(name: string, input: Record<string, unknown>): string {
  const fp = input.file_path ?? input.notebook_path
  if (typeof fp === 'string') return `${name} ${fp}`
  if (typeof input.command === 'string') return input.command
  return JSON.stringify(input)
}
