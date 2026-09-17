# T5-ship — build and deploy

## Objective

The URL. A clean export of the repository builds with no file outside it, the build is synced
to the S3 static website with `scripts/deploy-s3.sh`, and the URL goes into `README.md`.

## Dependencies

T4-autopsy and T7-qa closed. `AUTOPSY_BUCKET` known. The `aws` egress rule lifted by the human
for the sync step only (auto mode ignores `ask`; the human lifts the deny for that one command
or runs it in Terminal).

## Files owned

- `README.md` (the URL line), `docs/deployment.md` (bucket, region, URL as deployed)
- `docs/tasks/T5-ship.md`

## Files not to touch

Everything under `src/`, `scripts/`, `docs/contracts/**`, `docs/specs/**`. A build failure is
fixed by reopening the owning task, not here.

## Acceptance criteria

1. Fresh-export build: `git archive HEAD | tar -x -C <tmp>` then `npm ci && npm run build`
   there succeeds; the export contains no path outside the repository (`git clone` is a deny
   rule, so the export is `git archive`).
2. `dist/` contains the three fixtures inlined (no `.json` fetched at runtime:
   `grep -rn "fetch(" dist/assets` is empty).
3. `scripts/deploy-s3.sh` ran once with the rule lifted; its output is pasted in this file
   under "Deploy log".
4. `README.md` and `docs/deployment.md` carry the URL.
5. The human confirms the URL opens on a phone and shows the ticket case by default.
6. `npm run check` green (unchanged code).

## Tests

`npm run check`; the fresh-export build; the deploy script's own exit status.

## Out of scope

CloudFront, custom domain, auth, any code change; `curl` verification (T8-polish).

## Deploy log

(pasted at close)
