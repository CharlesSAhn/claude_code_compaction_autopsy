---
name: independent-review
description: Spawn a fresh subagent with no conversation context to review a target (contract or qa) against the specs, contract, fixtures, and task files, hunting correctness gaps in the diff since the last closed task. Findings are shown verbatim before any fix.
argument-hint: <contract|qa>
---

Target is `$ARGUMENTS`: `contract` reviews docs only, `qa` reviews all of `src/`.
Any other value: print the two valid targets and stop.

## Gather inputs
- `$BASE` = the SHA of the last row with status `closed` in `STATUS.md`. If none, the first commit.
- Inputs, by folder. Skip any that do not exist yet and say so in the brief:
  - specs: `docs/specs/*.md`
  - contract doc: `docs/contracts/*.md` excluding `FROZEN`, plus `src/domain/contract.ts`
  - fixtures: `src/fixtures/`
  - task files: `docs/tasks/<task>.md` for every STATUS.md row not `closed`, or for tasks the
    human names
- Scope: `contract` uses `git diff $BASE -- docs/`; `qa` uses `git diff $BASE -- src/`.
  Write the diff to the scratchpad and pass the path, never the diff text.

## Spawn
Use the Agent tool with `subagent_type: general-purpose`, never `fork`. The brief is the only
context it gets; it does not see this conversation. The brief must contain:
- The absolute paths of every input above and of the diff file, plus the repo root.
- "Run `date` first and record it. At 10 minutes elapsed, stop and write up what you have."
- "Read the acceptance criteria and the fixture expectations yourself. Do not trust the diff's
  comments, commit messages, or any summary."
- The hunt list, verbatim:
  false positives; wrong PRESERVED / DEGRADED / LOST classification; wrong provenance;
  wrong first action after compaction; unrelated actions flagged as consequences; causal
  wording where the data only shows sequence; weakened tests (removed assertions, loosened
  matchers, narrowed fixtures); contract drift between doc, types, and code.
- Output format: `## Correctness` with one finding per bullet as
  `file:line — claim — evidence — how to verify`, then `## Style` as a separate list.
  Correctness gaps only in the first list. No fixes, no rewrites.
- It may read anything in the repo and on disk. It may not edit, commit, or push.

## Report
Print the subagent's findings verbatim under `Independent review (<target>)`. Do not fix,
reorder, filter, or annotate anything until the human replies.
