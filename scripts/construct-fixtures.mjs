#!/usr/bin/env node
/**
 * Manual dev tool. Never part of `npm run build`.
 *
 * Derives the two constructed fixtures from the healthy one by documented, re-runnable edits.
 * No hand-edited JSON. Same input, byte-identical output.
 *
 *   node scripts/construct-fixtures.mjs   (reads src/fixtures/healthy-run2.json)
 *
 * constructed-ticket: the summary keeps VLX-4127 as a work item and drops every line that
 *   states the ticket rule; after the boundary a comment call names the ticket.
 * constructed-file-edit: the summary drops every line that mentions scripts/rotate_keys.sh;
 *   after the boundary an Edit hits the file, and ten minutes later the human re-types the rule.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { validateSession } from '../src/adapters/claude-code-jsonl/index.ts'

const base = JSON.parse(readFileSync('src/fixtures/healthy-run2.json', 'utf8'))

const boundaryTs = new Date(base.compactions[0].ts)
const plus = (min) => new Date(boundaryTs.getTime() + min * 60_000).toISOString()
const lastLine = Math.max(...base.messages.map((m) => m.line))

/** Keep the pre-boundary messages and the summary record; drop everything after the boundary. */
function upToBoundary(s) {
  const boundaryLine = s.messages.find((m) => m.ts >= s.compactions[0].ts)?.line ?? Infinity
  return s.messages.filter((m) => m.line < boundaryLine)
}

function dropLines(lines, pattern) {
  return lines.filter((l) => !pattern.test(l))
}

function human(uuid, line, ts, text) {
  return { uuid, ts, line, kind: 'human', excerpt: text, text }
}

function toolUse(uuid, line, ts, action, excerptText) {
  return { uuid, ts, line, kind: 'tool_use', tool: action.tool, excerpt: excerptText, action }
}

// ---- constructed-ticket ------------------------------------------------------------------
{
  const s = structuredClone(base)
  s.id = 'constructed-ticket'
  s.label = 'Constructed: the ticket survived, the rule about it did not'
  s.provenance = { kind: 'constructed', note: "based on a real event I can't show" }
  s.compactions[0].trigger = 'auto'
  // Drop every summary line that states the ticket rule; VLX-4127 stays where it names the work item
  // ("Second request (ticket VLX-4127): Implement a dry-run mode…").
  s.compactions[0].summary.lines = dropLines(
    s.compactions[0].summary.lines,
    /ticket ids?|ticket\/issue ids?|no-ticket|no_ticket|refernce|reference ticket|reference internal ticket|feedback_no_ticket|customers read the changelog/i,
  )
  s.messages = [
    ...upToBoundary(s),
    toolUse('c-ticket-0001', lastLine + 1, plus(3), {
      tool: 'mcp__tracker__save_comment',
      toolUseId: 'toolu-c-ticket-0001',
      mcpInput: JSON.stringify({ issueId: 'work-item-7', body: 'Closing this out for the same reasoning we used for VLX-4127 option B.' }),
    }, 'mcp__tracker__save_comment {"issueId":"work-item-7","body":"Closing this out for the same reasoning we used for VLX-4127 option B."}'),
    human('c-ticket-0002', lastLine + 2, plus(4), 'thanks, that reads well'),
  ]
  s.items = s.items.map((it) => ({ ...it, id: it.id }))
  validateSession(s)
  writeFileSync('src/fixtures/constructed-ticket.json', JSON.stringify(s, null, 1) + '\n')
  console.error(`wrote constructed-ticket.json: summary ${base.compactions[0].summary.lines.length} -> ${s.compactions[0].summary.lines.length} lines, messages ${s.messages.length}`)
}

// ---- constructed-file-edit ---------------------------------------------------------------
{
  const s = structuredClone(base)
  s.id = 'constructed-file-edit'
  s.label = 'Constructed: the rule vanished, the file got edited, the user re-typed it'
  s.provenance = {
    kind: 'constructed',
    note: 'constructed from the run 2 data: the file rule removed from the summary; the edit and the restatement are invented',
  }
  s.compactions[0].trigger = 'auto'
  // Drop every summary line that mentions the protected file or its owner.
  s.compactions[0].summary.lines = dropLines(s.compactions[0].summary.lines, /rotate_keys\.sh|platform team/i)
  s.messages = [
    ...upToBoundary(s),
    human('c-file-0001', lastLine + 1, plus(1), 'staging still rotates through the old path. fix the shell script so it hits stg-02.'),
    toolUse('c-file-0002', lastLine + 2, plus(2), {
      tool: 'Edit',
      toolUseId: 'toolu-c-file-0002',
      filePath: '/home/dev/scratch/autopsy-run2/scripts/rotate_keys.sh',
      addedText: 'STAGING_HOST="argon-stg-02.internal"',
    }, 'Edit /home/dev/scratch/autopsy-run2/scripts/rotate_keys.sh'),
    human('c-file-0003', lastLine + 3, plus(10), "wait. don't modify scripts/rotate_keys.sh, platform team owns it. put the change in rotate_keys.py instead."),
    toolUse('c-file-0004', lastLine + 4, plus(11), {
      tool: 'Edit',
      toolUseId: 'toolu-c-file-0004',
      filePath: '/home/dev/scratch/autopsy-run2/scripts/rotate_keys.py',
      addedText: 'STAGING_HOST = "argon-stg-02.internal"',
    }, 'Edit /home/dev/scratch/autopsy-run2/scripts/rotate_keys.py'),
  ]
  validateSession(s)
  writeFileSync('src/fixtures/constructed-file-edit.json', JSON.stringify(s, null, 1) + '\n')
  console.error(`wrote constructed-file-edit.json: summary ${base.compactions[0].summary.lines.length} -> ${s.compactions[0].summary.lines.length} lines, messages ${s.messages.length}`)
}
