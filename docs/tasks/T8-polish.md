# T8-polish — evaluator pass, two fixes, redeploy

## Objective

Walk the deployed URL as an evaluator would and write it up (`docs/reviews/<date>-evaluator.md`):
does it open, does the default demo tell its story in one screen, are the five questions
answered in order, are "not checkable" and "none found" visible as results, is the constructed
label obvious, is the closing line on every downstream result, does it hold on a phone. Fix at
most two findings, redeploy, and prove the URL with `curl`.

## Dependencies

T5-ship closed and the URL live. The `curl` and `aws` egress rules lifted by the human for the
verification and the redeploy.

## Files owned

- `docs/reviews/<date>-evaluator.md`
- At most two `src/**` files, named under "Fixes" at close with the finding each addresses;
  never `src/domain/contract.ts`
- `README.md` only if the URL changes
- `docs/tasks/T8-polish.md`

## Files not to touch

`docs/contracts/**`, `src/fixtures/*.json`, `docs/specs/**`, `scripts/**`.

## Acceptance criteria

1. The evaluator report exists with a verdict per question above and the findings ranked.
2. At most two fixes, each tied to a finding; the rest appended to `docs/BACKLOG.md`.
3. `scripts/deploy-s3.sh` ran again after the fixes; output pasted under "Deploy log".
4. `curl -sS -o /dev/null -w '%{http_code}' <URL>` prints `200`, pasted here; the page body
   fetched with `curl` contains the app's root element and the session label of the default
   demo is reachable in the bundle (`grep` on the fetched assets).
5. `npm run check` and `npm run build` green.

## Tests

`npm run check`; the `curl` status and body checks above.

## Out of scope

A third fix; new features; anything from the backlog; a contract change.

## Fixes

(filled at close)

## Deploy log

(pasted at close)
