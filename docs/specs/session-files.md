# Claude Code session files

What we found by reading real transcripts and the Claude Code bundle on 2026-09-16, version
2.1.273. Samples below are trimmed and sanitized: ids, paths, and outputs are placeholders;
record structure and field names are exact.

## Where they live

`~/.claude/projects/<projectKey>/<sessionId>.jsonl`. The project key is the working directory
with every non-alphanumeric character replaced by `-` (`/home/dev/acme-app` →
`-home-dev-acme-app`). One JSONL file per session; the file name is the session id, and every
record carries the same id in `sessionId`. A sibling directory `<sessionId>/` holds
`custom-title.json` and, when agents were spawned, `subagents/agent-<agentId>.jsonl`.

Files are append-only. Compaction appends records; earlier records stay on disk.

## Record kinds seen in one session

| type | subtype | count | note |
|---|---|---|---|
| assistant | | 316 | text and tool_use blocks, with usage |
| user | | 143 | human prompts and tool results share this type |
| attachment | | 305 | system reminders, not conversation |
| system | turn_duration | 28 | |
| system | local_command | 4 | slash commands the user typed |
| file-history-snapshot, file-history-delta | | 43 | checkpointing |
| mode, permission-mode, custom-title, agent-name, last-prompt, queue-operation, atis-latch | | ~250 | session state, no timestamp |

Every conversation record has `uuid`, `parentUuid`, `timestamp`, `sessionId`, `cwd`, `version`,
`gitBranch`, `isSidechain`, `isMeta`.

## Telling a human prompt from a tool result

Both are `type: "user"`. A human prompt is one where `isMeta` is falsy, `isSidechain` is falsy,
`message.content` is a string or a list with a `text` block and no `tool_result` block, and the
text does not start with `<command-name>` or `<local-command`.

```json
{"type":"user","uuid":"u-0001","parentUuid":"u-0000","timestamp":"2026-09-16T11:52:25.170Z",
 "message":{"role":"user","content":"what is my current session name?"},
 "sessionId":"s-0001","cwd":"/home/dev/acme-app","version":"2.1.273","gitBranch":"main",
 "isSidechain":false,"promptId":"p-0001","userType":"external","entrypoint":"cli"}
```

## Assistant tool call, with token accounting

```json
{"type":"assistant","uuid":"a-0002","parentUuid":"u-0001","timestamp":"2026-09-16T12:00:05.000Z",
 "requestId":"req-0002","apiBlockIndex":0,
 "message":{"role":"assistant","model":"model-x","content":[
   {"type":"tool_use","id":"toolu-0002","name":"Bash",
    "input":{"command":"cloud-cli whoami --profile example","description":"Check identity"}}],
  "usage":{"input_tokens":2,"cache_read_input_tokens":30521,"cache_creation_input_tokens":53,
           "output_tokens":119}}}
```

Context size at that request = `input_tokens + cache_read_input_tokens +
cache_creation_input_tokens`. Summing over the first block of every assistant record gives the
per-request context series; the sum of all four usage fields over all records is the session's
token cost. A tool call with several blocks repeats usage on each block; count `apiBlockIndex: 0`
only.

## Tool result

```json
{"type":"user","uuid":"u-0003","parentUuid":"a-0002","timestamp":"2026-09-16T12:00:07.664Z",
 "sourceToolAssistantUUID":"a-0002",
 "message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu-0002",
   "is_error":false,"content":"{\n  \"UserId\": \"USER-PLACEHOLDER\",\n  \"Account\": \"000000000000\"\n}"}]},
 "toolUseResult":{"stdout":"…","stderr":"","interrupted":false}}
```

## Compaction

Two records are appended. First the boundary:

```json
{"type":"system","subtype":"compact_boundary","content":"Conversation compacted","level":"info",
 "uuid":"b-0100","timestamp":"2026-09-16T18:24:49.000Z","logicalParentUuid":"a-0099",
 "compactMetadata":{"trigger":"manual","preTokens":1057278,"postTokens":280195,
   "durationMs":84637,"messagesSummarized":600,
   "preservedSegment":{"headUuid":"a-0090","anchorUuid":"a-0095","tailUuid":"a-0099"}}}
```

Then the summary, a user record flagged so the UI does not show it as typed:

```json
{"type":"user","isCompactSummary":true,"isVisibleInTranscriptOnly":true,"uuid":"u-0101",
 "message":{"role":"user","content":"This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.\n\nSummary:\n1. Primary Request and Intent:\n   …"}}
```

- `trigger` is `manual` for `/compact` and `auto` for the automatic one. Auto did not fire at
  232k or 295k on a 1M-window model; it is window-relative.
- `preTokens` and `postTokens` are the context size before and after. `postTokens` may be absent
  on the boundary record when the file is read mid-write.
- `preservedSegment` names a range of recent records kept verbatim; the context after
  compaction can still be large (280k after a 1.06M compaction) because of it.
- The summary is structured with numbered sections: Primary Request and Intent, Key Technical
  Concepts, Files and Code Sections, Errors and fixes, Problem Solving, All user messages,
  Pending Tasks, Current Work, Optional Next Step. User instructions are quoted, and
  "All user messages" repeats every human prompt. This is the reason user-typed rules survived
  verbatim in every run on this version.
- A `microcompact_boundary` subtype also exists in the bundle; not chased.

## Subagents

Separate files: `<projectKey>/<sessionId>/subagents/agent-<agentId>.jsonl`. Inside the main
file, agent traffic is `isSidechain: true`. A short "Warmup" sidechain pair appears at the top of
some sessions from older versions.

## Memory files

A session can write rules to `~/.claude/projects/<projectKey>/memory/*.md` before compaction
(seen once: a no-ticket-ids rule saved as a feedback memory). A rule can therefore survive
outside the summary. Provenance and survival need a "memory file" answer, not only "summary"
and "restated".

## What the adapter reads

`sessionId`, `version`, `model` (from any assistant record), the human prompts and tool calls
as `Message`s with an excerpt, and each `compact_boundary` with its following
`isCompactSummary` record as a `Compaction`. Everything else is skipped.
