---
name: task-close
description: Close one or more tasks. Verifies check/build, test integrity, pending-folder ownership, contract freeze, acceptance criteria, and file ownership, then makes one commit per task and updates STATUS.md. Stops at a HUMAN-GATE; the human pushes from Terminal.
argument-hint: <task> [<task>...]
---

Close the tasks named in `$ARGUMENTS`. Run every step in order. A FAIL anywhere stops the
close with the evidence printed. Never skip a step, never bypass a hook.

Pinned paths: `docs/contracts/FROZEN`, `src/domain/contract.ts`. Everything else is found by
folder: specs in `docs/specs/*.md`, contract docs in `docs/contracts/*.md` (FROZEN excluded),
task files in `docs/tasks/<task>.md`.

## 0. Preconditions
- For each task id, `docs/tasks/<task>.md` must exist. If any is missing, print the
  missing ids and refuse the whole close.
- `git status --porcelain` must show changes. Nothing to close otherwise.
- Read `STATUS.md`: the SHA of the last row with status `closed` is `$BASE`. If there is no
  closed row, `$BASE` is the first commit. All diffs below are `git diff $BASE`.

## 1. Gates on the code
- `npm run check`. Paste the summary lines verbatim: the lint result, the tsc result, and the
  vitest `Test Files` and `Tests` lines.
- If `git diff --stat $BASE -- src/ui` is non-empty, run `npm run build` and paste the vite
  summary lines.
- Test integrity, over `git diff $BASE`:
  - FAIL if any added line contains `.only(` or `.skip(`. Literal match, so `it.skipIf(` passes.
  - FAIL if any file under `src/specs/`, any `*.test.ts` or `*.test.tsx`, or any file under
    `src/fixtures/` has more deletions than insertions in `git diff --numstat $BASE`, unless
    `git diff -M --name-status $BASE` shows it as a rename (`R`). A rename moves lines, it does
    not lose them.
- Pending folder, over `git diff -M --name-status $BASE -- src/domain/pending/`:
  - If any path there changed, the change is allowed only for the task whose `## Files owned`
    lists `src/domain/pending/`. Any other task in this close touching it: FAIL.
  - If the owner of `src/domain/pending/` (the analyzer task) is in this close and the folder
    still exists: FAIL with "src/domain/pending/ must be emptied and removed before closing".
  - A `git mv` out of the folder shows as `R` in name-status: a rename, not a loss.

## 2. Contract unchanged
- `git diff --stat $BASE -- docs/contracts src/domain/contract.ts`. Must be empty. Non-empty: FAIL.
- If `docs/contracts/FROZEN` exists: run `shasum -a 256 -c docs/contracts/FROZEN` from the
  repo root and paste the output. Any line not `OK`: FAIL.

## 3. Acceptance criteria
For each task, read its `## Acceptance criteria` section. For every criterion print one line:
`PASS <criterion> — <evidence>` or `FAIL <criterion> — <what is missing>`. Evidence is a
command output, a test name, or a `file:line`. Any FAIL stops the close.

## 4. Ownership
- Paste `git status --short` and `git diff --stat $BASE`.
- Union the `## Files owned` of every task in this close. List every changed file outside the
  union under `Outside owned files:` and stop. The human decides whether to widen ownership
  or revert. `STATUS.md` is always owned.

## 5. Commit
One commit per task, in the order given: `git add` only that task's owned files, then
`git commit -m "<task>: <what>"` where `<what>` is one line taken from the task's goal.
A file owned by several tasks in this close goes with the last of them. Show
`git log --oneline -n <count>`.

## 6. STATUS.md
For each task compute minutes with
`node scripts/usage-time.mjs --since <started> --until <finished>` (round to whole minutes)
and write its row: task, status `closed`, SHA, started, finished (UTC), minutes, running total
(sum of minutes over all closed rows). Include STATUS.md in the last task's commit.

## 7. Gate
Print exactly:
`[HUMAN-GATE] Review the diff. Reply "push" to push.`
and stop. Egress is a hard deny in this repo, so Claude never pushes. On "push", print the
command for the human to run in Terminal:
`git push origin main`
