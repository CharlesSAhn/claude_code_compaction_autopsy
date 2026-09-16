# Compaction Autopsy

Shows what Claude Code lost during context compaction and what happened afterward.
Deterministic analysis of Claude Code JSONL transcripts, no LLM calls. Static React app with bundled demo data.

`npm install` then `npm run check` (lint, typecheck, test) or `npm run dev`.

## Finding, 2026-09-16

Three scratch sessions tried to make Claude Code drop casually stated constraints in compaction
(rules in prompts, rules in a file, up to 1.06M tokens of tool output on top). Every constraint
survived verbatim in the summary and every follow-up honored it: this version of Claude Code
quotes constraints into the summary. The losses that motivated the tool came from a different
week, possibly a different version. Compaction behavior changes across releases; that is part
of why the tool exists. See `docs/experiments/findings.md` and `docs/specs/algorithm-v1.md`.
The bundled healthy case is real and sanitized. The ticket case is built from the author's
account of a real event that cannot be shown, and is labeled that way.
