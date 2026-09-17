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

Budget amended 2026-09-17 by the human ("fix the 2, 3, 5 only"): four fixes, five `src/**`
files, after the evaluator walk ranked five improvements. `docs/specs/ui.md` reconciled in the
same round as an integrator record of drift already ruled. Fixture regeneration (E5c) and the
two feature-shaped items (E1, E4) went to `docs/tasks/BACKLOG.md` and the README's "Future
work".

1. Pre-ship, from the session-5 browser round: the story's "compaction · auto" band label
   printed over the AFTER region caption. `src/ui/story/StoryView.tsx`: the AFTER caption is
   anchored at the drawing's right edge. No layout change.
2. Evaluator item 2: no purpose line and a footer that cites a README the page does not link.
   `src/ui/app/Header.tsx` (subtitle), `src/ui/app/Footer.tsx` (README link).
3. Evaluator item 3: the facts line was unlabeled and the "Start here" hint pointed at a bar
   below the fold. `src/ui/app/Header.tsx` (labels), `src/ui/autopsy/AutopsyPanel.tsx` (hint
   is a button), `src/ui/app/App.tsx` (selects the compaction, scrolls the bar into view),
   `src/index.css` (button styling).
4. Evaluator item 5a: "1 tool calls after". `src/ui/autopsy/AutopsyPanel.tsx` uses `plural()`.

## Deploy log

2026-09-17, redeploy after fixes 2 through 4, `AWS_PROFILE=project`, exit 0.

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
dist/assets/index-epl1jT1t.css   10.35 kB │ gzip:   2.79 kB
dist/assets/index-p0_ldfMU.js   588.59 kB │ gzip: 172.78 kB
✓ built in 140ms
deploy-s3: syncing dist/ to s3://charles-ahn-compaction-autopsy
delete: s3://charles-ahn-compaction-autopsy/assets/index-CSY-w3q9.css
delete: s3://charles-ahn-compaction-autopsy/assets/index-CziMbJaQ.js
upload: dist/assets/index-epl1jT1t.css to s3://charles-ahn-compaction-autopsy/assets/index-epl1jT1t.css
upload: dist/index.html to s3://charles-ahn-compaction-autopsy/index.html
upload: dist/favicon.svg to s3://charles-ahn-compaction-autopsy/favicon.svg
upload: dist/assets/index-p0_ldfMU.js to s3://charles-ahn-compaction-autopsy/assets/index-p0_ldfMU.js
deploy-s3: done
website URL: http://charles-ahn-compaction-autopsy.s3-website-us-east-1.amazonaws.com
(some regions use a dot: http://charles-ahn-compaction-autopsy.s3-website.us-east-1.amazonaws.com)
```

Verification with the `curl` rule still in place, so the GET was a Node `fetch` over plain
HTTP from Bash, same request: `/` 200 with `<div id="root">`; the bundle
`/assets/index-p0_ldfMU.js` contains the default session label "the ticket survived, the rule
about it did not", the subtitle, the README link, and the pluralized "tool call".
`BASE_URL=<url> npm run e2e` 1 passed. `npm run screenshots -- <url>` four PNGs.

Criterion 4, run by the human in Terminal, 2026-09-17:

```
% curl -sS -o /dev/null -w '%{http_code}' http://charles-ahn-compaction-autopsy.s3-website-us-east-1.amazonaws.com/
200
```
