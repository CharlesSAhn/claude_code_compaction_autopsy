# Compaction Autopsy

Shows what Claude Code lost during context compaction and what happened afterward.
Deterministic analysis of Claude Code JSONL transcripts, no LLM calls. Static React app with bundled demo data.

`npm install` then `npm run check` (lint, typecheck, test) or `npm run dev`.

## Finding, 2026-09-16

Three scratch sessions tried to make Claude Code drop casually stated constraints in compaction
(rules in prompts, rules in a file, up to 1M tokens of tool output on top). Every constraint
survived verbatim in the summary and every follow-up honored it. See
`docs/experiments/findings.md`. The bundled healthy case is real; the loss case is constructed
and labeled as such.
