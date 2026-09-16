---
name: session-handoff
description: Write docs/HANDOFF.md for the next session, commit pending docs as "docs: <what>", and print the opening line for a fresh session. Never closes tasks, never commits code.
---

This skill never calls `/task-close` and never commits code. Docs only.

## 1. Collect
- `git status --short`, `git log --oneline -5`, `STATUS.md`.
- `node scripts/usage-time.mjs` for total working time. The target is 4–5 hours.
- The decisions and constraints the human stated this session, quoted verbatim, not paraphrased.
- Task files for rows not `closed` in STATUS.md (`docs/tasks/<task>.md`), if any.

## 2. Write `docs/HANDOFF.md`
Overwrite it. Sections in this order:
- `## Done` — closed tasks with SHAs, from STATUS.md.
- `## Next` — the next task id and its first concrete step.
- `## Decisions` — each constraint as a quote, with the date it was stated.
- `## Open questions` — anything the human has not decided.
- `## Uncommitted` — output of `git status --short`, or `clean`.
- `## Time` — `<used> of 4–5h target`, then per-task minutes from STATUS.md.

## 3. Commit docs
- Run `npm run lint` and `npm run typecheck`. If either fails, do not commit; paste the failure.
- Stage only `docs/**`, `STATUS.md`, `CLAUDE.md`. Commit as `docs: <what>`. Do not push.
- Leave uncommitted code alone and list it under `Uncommitted`.

## 4. Print for the human
- The opening line for the next session, on one line, with `@` file refs, for example:
  `Continue <task>. Read @docs/HANDOFF.md, @CLAUDE.md, @STATUS.md, @docs/tasks/<task>.md first.`
  Reference only files that exist.
- Then: `Reminder: /rename this session, then start a new one.`
