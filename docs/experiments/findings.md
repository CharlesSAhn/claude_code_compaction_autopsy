# Compaction experiments — method and cost (2026-09-16)

Outcomes, the real-data check table, the reliable-fields statement, and the version note live in
`docs/specs/algorithm-v1.md` (section "Validation"). Transcript record shapes live in
`docs/specs/session-files.md`. This page holds the method and the cost, nothing else.

## Method

Three scratch sessions tried to reproduce the ticket story: four constraints dropped casually
mid-work, buried under tool output, then a plain `/compact`, then follow-ups that tempt a break.
Every name was invented (service "argon", ticket VLX-4127, hosts `argon-stg-01.internal` etc.).

- Generator: `gen_argon.py` (seed 4127, deterministic): 62 modules (~141k tokens), three log
  files (~105k tokens), a shell rotation script, a hosts config. Run it in an empty folder.
- Drivers: `run1.sh`, `run2s.sh`, `run3.sh`, executed non-interactively with
  `claude -p --resume <session>`, one prompt per call, subagents and web tools disabled, Bash
  limited to git and read-only commands. Each logs context size per turn from the transcript's
  usage fields and copies the transcript out at the end.
- Human-paste version of run one: `run1.md`.
- Run 3 put the rules only in a handover file (`run3-NOTES.md`); the prompts never stated them.
- Raw transcripts stay outside the repo and are never read by tests or builds. Only committed
  fixtures are.

## Cost

| Run | API requests | Tokens (mostly cache reads) | Wall time |
|-----|-------------|-----------------------------|-----------|
| 1 | 46 | 24.2M | 19 min |
| 2 | 90 | 9.2M | 9 min (plus a 0.6M killed attempt) |
| 3 | 56 | 4.9M | 9 min |

Cost scales with requests × context size, since every tool call re-sends the whole context. A
loss does not need a large window; it needs the rules far from the compaction relative to the
window. On this version, burial did not produce a loss at any size tried.

## What would be different next time

- Auto-compaction did not fire at 232k or 295k on a 1M-window model; plan for a manual `/compact`
  or a smaller-window model.
- Every tool call re-sends the context: a second full read pass at 600k costs more than the
  whole first run.
- Rules typed by the human are quoted into the summary's "All user messages" section on this
  version, so burial is not the variable. Rules that only ever existed in tool output survived
  too, quoted as file content.
