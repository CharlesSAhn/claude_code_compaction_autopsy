#!/usr/bin/env node
/**
 * Claude Code usage time for this project, derived from session transcripts.
 *
 * A turn starts at a human prompt and ends at the last assistant or tool
 * activity before the next human prompt. Usage time is the sum of turn
 * durations. Idle time while nobody is typing is not counted.
 *
 *   node scripts/usage-time.mjs                       total for all sessions
 *   node scripts/usage-time.mjs --since ISO --until ISO   window (until exclusive)
 *   node scripts/usage-time.mjs --list                each human prompt with its timestamp
 */
import { readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const list = args.includes('--list')
const since = opt('--since') ? Date.parse(opt('--since')) : -Infinity
const until = opt('--until') ? Date.parse(opt('--until')) : Infinity
const project = opt('--project') ?? resolve(process.cwd())
const dir = join(homedir(), '.claude', 'projects', project.replace(/[^a-zA-Z0-9]/g, '-'))

// Tool-use ids of AskUserQuestion calls: the answer arrives as a tool_result,
// but it is the human speaking, so it starts a new turn (waiting time is not usage).
const askIds = new Set()
function noteAsks(e) {
  if (e.type !== 'assistant' || !Array.isArray(e.message?.content)) return
  for (const b of e.message.content) if (b.type === 'tool_use' && b.name === 'AskUserQuestion') askIds.add(b.id)
}
function isHumanPrompt(e) {
  if (e.type !== 'user' || e.isMeta || e.isSidechain) return false
  const c = e.message?.content
  if (typeof c === 'string') return c.trim().length > 0 && !/^<(command-name|local-command-stdout)>/.test(c.trim())
  if (!Array.isArray(c)) return false
  const results = c.filter((b) => b.type === 'tool_result')
  if (results.length > 0) return results.some((b) => askIds.has(b.tool_use_id))
  const text = c.filter((b) => b.type === 'text').map((b) => b.text).join('')
  return text.trim().length > 0 && !/^<(command-name|local-command-stdout)>/.test(text.trim())
}

const entries = []
for (const f of readdirSync(dir).filter((n) => n.endsWith('.jsonl'))) {
  for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) {
    if (!line.trim()) continue
    let e
    try { e = JSON.parse(line) } catch { continue }
    if (!e.timestamp || (e.type !== 'user' && e.type !== 'assistant') || e.isSidechain || e.isMeta) continue
    noteAsks(e)
    entries.push({ t: Date.parse(e.timestamp), human: isHumanPrompt(e), e })
  }
}
entries.sort((a, b) => a.t - b.t)

const turns = []
for (let i = 0; i < entries.length; i++) {
  if (!entries[i].human) continue
  let end = entries[i].t
  for (let j = i + 1; j < entries.length && !entries[j].human; j++) end = entries[j].t
  turns.push({ start: entries[i].t, end, e: entries[i].e })
}

const fmt = (ms) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`
}
const text = (e) => {
  const c = e.message.content
  const raw = typeof c === 'string' ? c : c.some((b) => b.type === 'tool_result') ? '[answer to AskUserQuestion]' : c.filter((b) => b.type === 'text').map((b) => b.text).join(' ')
  return raw.replace(/\s+/g, ' ').slice(0, 70)
}

const inWindow = turns.filter((t) => t.start >= since && t.start < until)
if (list) {
  for (const t of inWindow) console.log(`${new Date(t.start).toISOString()}  ${fmt(t.end - t.start).padStart(12)}  ${text(t.e)}`)
}
const total = inWindow.reduce((a, t) => a + (t.end - t.start), 0)
console.log(`turns: ${inWindow.length}  usage: ${fmt(total)}`)
