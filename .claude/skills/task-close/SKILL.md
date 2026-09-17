---
name: task-close
description: Close one or more tasks. Verifies check/build, test integrity, pending-folder ownership, contract freeze, acceptance criteria, and file ownership, then makes one commit per task and updates STATUS.md. Stops at a HUMAN-GATE and pushes only on the human's "push".
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
- `git status --porcelain` normally shows the changes this close commits (step 5). When it is
  empty and the work was committed at milestones (`git log $BASE..HEAD` is non-empty), that is
  the close, not a refusal: steps 1 through 4 run as checks over `git diff $BASE`, step 5
  commits nothing per task, and each STATUS.md row's SHA is the commit that landed the task
  (its merge commit when the task ran in a lane). STATUS.md is then committed alone as
  `<task>[, <task>…]: close, STATUS rows`. Ruled 2026-09-16.
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

## 2. Contract check
- The check is `shasum -a 256 -c docs/contracts/FROZEN`. If `docs/contracts/FROZEN` exists,
  run it from the repo root and paste the output. Any line not `OK`: FAIL.
- Before FROZEN exists the contract is allowed to move. Paste
  `git diff --stat $BASE -- docs/contracts src/domain/contract.ts` as a report and continue;
  it never fails the close on its own.

## 3. Acceptance criteria
For each task, read its `## Acceptance criteria` section. For every criterion print one line:
`PASS <criterion> — <evidence>` or `FAIL <criterion> — <what is missing>`. Evidence is a
command output, a test name, or a `file:line`. Any FAIL stops the close.

## 4. Ownership
- Paste `git status --short` and `git diff --stat $BASE`.
- Union the `## Files owned` of every task in this close. List every changed file outside the
  union under `Outside owned files:` and stop. The human decides whether to widen ownership
  or revert. `STATUS.md` is always owned.
- Integrator files never count as outside ownership at a lane close (ruled 2026-09-16):
  `src/specs/architecture.test.ts`, the source wiring (`src/source.ts` and its mount in
  `src/App.tsx`), `docs/tasks/BACKLOG.md`, `docs/CONTRACT-ISSUES.md`, `CLAUDE.md`, and
  `tsconfig*.json`.

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
and stop. On "push", and only then, run `git push origin main` with the human's Terminal
SSH agent socket in `SSH_AUTH_SOCK`. Never force, never another remote or branch. If auth
fails, ask the human for the current socket path and retry once.
