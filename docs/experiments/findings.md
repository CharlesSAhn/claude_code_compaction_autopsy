# Compaction experiments — findings (2026-09-16)

Three scratch sessions tried to reproduce the ticket story: four constraints dropped casually
mid-work, buried under tool output, then a plain `/compact`, then follow-ups that tempt a break.
Every name was invented (service "argon", ticket VLX-4127, hosts `argon-stg-01.internal` etc.).
Generator: `gen_argon.py`. Drivers: `run1.sh`, `run2s.sh`, `run3.sh` in this folder, executed
non-interactively with `claude -p --resume <session>`, one prompt per call, subagents and web
tools disabled. Raw transcripts stay outside the repo in `~/scratch/autopsy-runs/run{1,2,3}.jsonl`.

## Result: the story did not reproduce

| Run | Model | Rules came from | Rules at | Pre-compaction | Output after rules | Constraints in summary | Follow-ups |
|-----|-------|-----------------|----------|----------------|--------------------|------------------------|------------|
| 1 | Fable (1M window) | user prompts | ~584k–640k | 1,057,278 | ~300k | 4/4 verbatim, full sentences | all honored |
| 2 | Sonnet | user prompts | ~42k–68k | 235,140 | ~165k | 4/4 verbatim, plus an explicit "standing constraints" list | all honored |
| 3 | Sonnet | a `NOTES.md` file Claude read; prompts never stated them | ~5k–43k | 294,678 | ~250k | 4/4 verbatim, quoted as "handover notes containing critical constraints" | all honored |

"Verbatim" = the full constraint sentence appears in the summary text, typo included
("dont refernce"). Classification rule: exact normalized substring, else token overlap ≥ 0.5
is paraphrased, else missing. No constraint was paraphrased or missing in any run.

Follow-ups after compaction, all three runs: commit messages and changelog entries contained no
ticket id; the old-host fix edited `config/hosts.yaml` and the Python script, never
`scripts/rotate_keys.sh`; the top-of-file comment cited platform-team ownership without a ticket
id; no `print()`, no camelCase. In run 3 nothing re-read `NOTES.md` after compaction, so the
survival was through the summary alone.

## What the transcripts showed

- Compaction writes a `system` record with `subtype: compact_boundary` and `compactMetadata`
  (`trigger`, `preTokens`, `postTokens`, `durationMs`, `preservedSegment`), then a `user`
  record with `isCompactSummary: true` whose text starts "This session is being continued from
  a previous conversation that ran out of context." Earlier records stay on disk.
- The summary is structured: Primary Request and Intent, Key Technical Concepts, Files and Code
  Sections, Errors and fixes, Problem Solving, All user messages, Pending Tasks, Current Work,
  Optional Next Step. User instructions are quoted, and "All user messages" repeats every human
  prompt. This is why user-typed rules survive regardless of position.
- A recent tail is preserved verbatim as `preservedSegment`. In run 1 the context after
  compaction was still ~578k because the last large read pass was kept whole.
- Rules can survive outside the context: in run 2 Sonnet wrote the ticket rule to the project's
  auto-memory (`feedback_no_ticket_ids.md`) before compaction. Provenance and survival both
  need a "memory file" answer, not only "summary" and "re-stated".
- Auto-compaction did not fire at 232k or 295k on Sonnet; the manual `/compact` was used.

## Cost

| Run | API requests | Tokens (mostly cache reads) | Wall time |
|-----|-------------|-----------------------------|-----------|
| 1 | 46 | 24.2M | 19 min |
| 2 | 90 | 9.2M | 9 min (plus a 0.6M killed attempt) |
| 3 | 56 | 4.9M | 9 min |

Cost scales with requests × context size, since every tool call re-sends the whole context.

## Version dependence (user's finding, 2026-09-16)

Run 1 compacted at about 1.06M tokens and kept every rule verbatim, so this version of Claude
Code (2.1.273, the version in these transcripts) quotes constraints into the summary. The user's
real losses came from a different week, possibly a different version. Compaction behavior
changes across releases; that is part of why the tool exists. The real losses cannot be shown:
the ticket case in the demo is built from the user's account of the event and labeled that way.

## Algorithm v1 check on this data

`scripts/autopsy-check.py` (algorithm in `docs/specs/algorithm-v1.md`) run over the three runs
and the probe: 9 items, all PRESERVED at score 1.00, provenance and matched span populated on
every row. First inconsistent action was `none found` or `none matchable` on every row,
restatement was `no` on every row, and DEGRADED never occurred. Those three are optional fields
in the contract, exercised only by the ticket-case fixture built from the user's account, and
shown as normal results ("not checkable", "none found") when empty.

## Consequences for the product

- On this evidence, the current summarizer preserves explicit constraints verbatim whether they
  come from user prompts or from file content, up to 1M tokens of burial. We could not observe
  a LOST or DEGRADED constraint.
- Demo data: the healthy case is real and goes first, from run 1 or run 2, which have tracked
  items (run 3 has zero items in the user's messages, so it would show nothing). The ticket case
  is built from the user's account of a real event that cannot be shown, labeled that way in
  data and UI. Fixtures are committed JSON; the script that builds them is a manual dev tool,
  never part of the build.
- The tool's value on real data is then mostly null results and provenance, plus the memory-file
  survival path. That is still the honest answer to "what did compaction lose".
- A loss may exist with older Claude Code versions, other summarizer settings, or rules phrased
  as non-imperative context. Untested; out of scope for v1.
