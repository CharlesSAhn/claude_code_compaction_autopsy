#!/usr/bin/env node
/**
 * Manual dev tool. Never part of `npm run build`.
 *
 * Builds one committed fixture (a Session with pre-labeled items) from a raw Claude Code
 * transcript that lives outside the repo, through the adapter (the one door), redacted.
 *
 *   node scripts/build-fixtures.mjs \
 *     --transcript <path.jsonl> --items <items.json from autopsy-check.py --items-json> \
 *     --id healthy-run2 --label "Healthy compaction (run 2)" \
 *     --provenance experiment-derived --run run2 \
 *     [--note "…"] [--home /Users/you] [--out src/fixtures/healthy-run2.json]
 *
 * Output is stable: same inputs, byte-identical file.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { parseJsonl, redactSession, toSession, validateSession } from '../src/adapters/claude-code-jsonl/index.ts'

const args = process.argv.slice(2)
const opt = (name, dflt) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : dflt
}
const need = (name) => {
  const v = opt(name)
  if (v === undefined) {
    console.error(`missing ${name}`)
    process.exit(2)
  }
  return v
}

const transcriptPath = need('--transcript')
const itemsPath = need('--items')
const id = need('--id')
const label = need('--label')
const kind = need('--provenance')
const provenance =
  kind === 'experiment-derived' ? { kind, run: need('--run') }
  : kind === 'constructed' ? { kind, note: need('--note') }
  : kind === 'observed-sanitized' ? { kind }
  : (console.error('provenance must be observed-sanitized | experiment-derived | constructed'), process.exit(2))
const out = opt('--out', `src/fixtures/${id}.json`)
const homes = [opt('--home', homedir())]

const records = parseJsonl(readFileSync(transcriptPath, 'utf8'))
const rawSessionId = records.find((r) => r.sessionId)?.sessionId
const itemsFile = JSON.parse(readFileSync(itemsPath, 'utf8'))
const entry = Array.isArray(itemsFile) ? itemsFile.find((e) => e.sessionId === rawSessionId) ?? itemsFile[0] : itemsFile
if (!entry || !Array.isArray(entry.items)) {
  console.error('items file has no items for this session')
  process.exit(2)
}

let session = toSession(records, { id, label, provenance })
session = { ...session, items: entry.items }
session = redactSession(session, { homes, rawSessionId })
validateSession(session)

writeFileSync(out, JSON.stringify(session, null, 1) + '\n')
console.error(`wrote ${out}: ${session.messages.length} messages, ${session.compactions.length} compaction(s), ${session.items.length} items`)
