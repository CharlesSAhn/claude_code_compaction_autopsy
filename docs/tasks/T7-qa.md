# T7-qa — QA pass, docs, deploy script

## Objective

An independent review of all of `src/` (`/independent-review qa`), findings shown verbatim,
the meaningful ones fixed, the rest recorded in `docs/BACKLOG.md`. During the pass, the three
shipping documents are drafted: `README.md`, `docs/deployment.md`, and `scripts/deploy-s3.sh`.
The script is a manual dev tool, never part of `npm run build`, and is not run in this task.

## Dependencies

T4-autopsy closed. Sits between T4 and T5-ship.

## Files owned

- `README.md`, `docs/deployment.md`, `scripts/deploy-s3.sh`, `docs/BACKLOG.md`
- `docs/reviews/<date>-qa.md` (the review log with a disposition per finding)
- Any `src/**` file named by a fix in the review log, listed under "Fixes" in this file at
  close, one line per file with the finding number; nothing under `src/domain/contract.ts`
- `docs/tasks/T7-qa.md`

## Files not to touch

`docs/contracts/**`, `src/domain/contract.ts`, `src/fixtures/*.json`, `docs/specs/**`
(a spec gap goes to the backlog), `.claude/**`.

## Acceptance criteria

1. `docs/reviews/<date>-qa.md` holds the findings verbatim, each with fixed / backlog /
   rejected and one line of reason; "meaningful" means a wrong status, wrong provenance, wrong
   first action, causal wording, weakened test, or a broken screen.
2. Every fix names its finding; `git diff` of this task touches no file outside "Fixes" plus
   the four documents.
3. `docs/BACKLOG.md` lists every non-fixed finding and the nice-to-haves from the plan.
4. `README.md`: what the tool shows, the three demo sessions with their provenance, the honesty
   section (constructed cases labeled, version dependence, no causation claim), how to run
   locally, the URL line left as a placeholder for T5-ship.
5. `docs/deployment.md`: S3 static website steps, the bucket variable, the egress rule the
   human lifts for the sync, how to verify with `curl`.
6. `scripts/deploy-s3.sh`: `set -euo pipefail`; refuses without `AUTOPSY_BUCKET`; runs
   `npm run build` then `aws s3 sync dist/ s3://$AUTOPSY_BUCKET --delete`; never referenced by
   `package.json` scripts.
7. `npm run check` and `npm run build` green after the fixes.

## Tests

`npm run check`; `bash -n scripts/deploy-s3.sh`; a run of the script without the bucket
variable exits non-zero with a message and runs nothing.

## Out of scope

Running the deploy; the evaluator pass (T8); new features from the backlog.

## Fixes

Review log: `docs/reviews/2026-09-17-qa.md`. One line per file, with the finding number.

- `src/domain/normalize.ts` — finding 1, a path followed by `/` is a directory prefix, not the path.
- `src/domain/wordlists.ts` — finding 8, heading words as whole words (singular or plural); finding 16b, changelog filename case-insensitive.
- `src/domain/actions.ts` — finding 16a, a quoted redirect target is a write.
- `src/domain/qa-2026-09-17.test.ts` — regression tests for 1, 8, 16a, 16b.
- `src/ui/autopsy/After.tsx` — finding 13, the order row only when something was restated.
- `src/ui/autopsy/AutopsyPanel.tsx` — S1, the ledger cell reads `INCONSISTENT ACTION · tool · time`.
- `src/ui/autopsy/AutopsyPanel.test.tsx` — tests for 13 and S1.
- `src/ui/story/StoryView.tsx` — S2, the story's empty line says "none found".
