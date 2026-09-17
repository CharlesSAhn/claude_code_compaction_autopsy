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

2026-09-17, attempt 1 of 3, `AWS_PROFILE=project`, account 197961295604, user `project`.
Bucket setup: `create-bucket`, bucket-level public access block off, website config with
`index.html` as index and error document, public `s3:GetObject` policy; policy status
`IsPublic: true`. Fresh-export build: `git archive HEAD | tar -x -C <tmp>`, then
`npm ci --ignore-scripts && npm run build` (plain `npm ci` fails in the export because the
`prepare` script runs `git config core.hooksPath` and the export is not a git repo; the build
is unaffected). `grep -rn "fetch(" dist/assets` has one hit, Vite's modulepreload polyfill, not
app code; no fixture is fetched at runtime.

```
AUTOPSY_BUCKET=charles-ahn-compaction-autopsy AWS_REGION=us-east-1 bash scripts/deploy-s3.sh
deploy-s3: building
> compaction-autopsy@0.0.0 build
> tsc -b && vite build
vite v8.3.0 building client environment for production...
transforming...
✓ 364 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.46 kB │ gzip:   0.30 kB
dist/assets/index-CSY-w3q9.css   10.06 kB │ gzip:   2.74 kB
dist/assets/index-CziMbJaQ.js   588.01 kB │ gzip: 172.60 kB
✓ built in 148ms
deploy-s3: syncing dist/ to s3://charles-ahn-compaction-autopsy
upload: dist/index.html to s3://charles-ahn-compaction-autopsy/index.html
upload: dist/favicon.svg to s3://charles-ahn-compaction-autopsy/favicon.svg
upload: dist/assets/index-CSY-w3q9.css to s3://charles-ahn-compaction-autopsy/assets/index-CSY-w3q9.css
upload: dist/assets/index-CziMbJaQ.js to s3://charles-ahn-compaction-autopsy/assets/index-CziMbJaQ.js
deploy-s3: done
website URL: http://charles-ahn-compaction-autopsy.s3-website-us-east-1.amazonaws.com
(some regions use a dot: http://charles-ahn-compaction-autopsy.s3-website.us-east-1.amazonaws.com)
```

Verification: `/` 200 text/html, deep link 200, bundle 200 text/javascript, unknown path 404
with the app. `BASE_URL=<url> npm run e2e` 1 passed. `npm run screenshots -- <url>` four PNGs.
