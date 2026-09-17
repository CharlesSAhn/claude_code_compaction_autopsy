# HANDOFF — 2026-09-17, end of project-session4 (T4-autopsy and T7-qa closed, Playwright in, QA pass done)

The next session starts from this file and nothing else. Repo rules are in `CLAUDE.md`
(auto-loaded). Time log is `STATUS.md`. Skills: `/task-close`, `/independent-review`,
`/session-handoff`, `/freeze-contract` (human-run). Deferred work is in `docs/tasks/BACKLOG.md`.

**The contract is frozen at v2** (`2ff97d1`). Nothing in it moved this session. v3 candidates
are in `docs/CONTRACT-ISSUES.md`; the ticket class pattern is first in line. The guard hook
blocks any command line that names `docs/contracts/` or the types file next to a write pattern
(`>`, `2>&1`, `sed`, `python3`, `node`, `awk`, …), even when the write goes elsewhere: put
scripts in the scratchpad and run them by path, and run `shasum -a 256 -c docs/contracts/FROZEN`
as a lone command. The egress guard also trips on the literal words `curl` and `aws` inside a
grep pattern; keep them out of command lines.

**Nothing gets deployed until the pre-deploy checklist below passes on the human's machine.**

## Done

| Task | SHA | What |
|---|---|---|
| scaffold | 9d99739 | Vite + React + TS scaffold |
| guards | 22199d4 | hooks, egress deny, contract guard, usage-time script |
| T1-fixtures | 801e5c7 | three fixtures, reference script, expected tests, freeze v1 |
| T2-stub-and-strategy | e42b11d | `analyze` stub, pending tests, testing strategy |
| T2-engine | 8f53285 (lane merge) | `analyze` stages 1–5, expected tests green, parity with the reference |
| T3-ui-shell | 26fcfb2 (lane merge) | shell, picker, provenance band, facts, timeline, footer, url-state, tokens |
| T6-story-view | 3fd6f64 (lane merge) | `layoutStory`, `StoryView` SVG, interactions 1–5 |
| T4-autopsy | c42998e | autopsy panel (five questions, ledger, four-step trace, evidence drawer with marks from offsets and the full summary), story behind a Ledger/Story toggle in the panel, timeline boundary click selects the compaction, links scroll and flash timeline rows, `item=` bounded by analyzed ids, one-line "Start here" hint, provenance in the picker, new footer line; close row `10babcb` |
| T7-qa | 7961861 | Playwright smoke spec and four-screenshot script (`2951cf4`); QA review log with dispositions, fixes for findings 1, 8, 13, 16a, 16b and the two wording changes, v3 entries, backlog (`f006ffe`); README, `docs/deployment.md`, `scripts/deploy-s3.sh` drafted in a worktree and merged (`7961861`); close row `a1d4ebc` |

Test state at handoff: 20 files, 164 tests, `npm run check` and `npm run build` green,
`npm run e2e` 1 passed against the local preview, four screenshots produced. `grep -rniE
"caused|because of the compaction" src/ui` is empty. Pushed to origin through `31d0a00`; the six
commits from `c42998e` to `a1d4ebc` are local until the human pushes at this session's gate.

## Pre-deploy run-through checklist

Assembled 2026-09-17 from the T7, T5, and T8 task files plus the local run-through. State as of
this handoff.

Local run-through
- [x] `npm run check` green: 20 files, 164 tests.
- [x] `npm run build` green: 588 kB bundle.
- [x] `npx vite preview --strictPort --port 4173` serves `dist/`.
- [x] `npm run e2e` against the preview: the file-edit LOST trace is visible, 1 passed.
- [x] `npm run screenshots -- http://localhost:4173`: four PNGs in the gitignored `screenshots/`.
- [ ] Browser round, desktop: landing, compaction click, lost trace, evidence drawer, story,
      Escape and backdrop close.
- [ ] Browser round, one narrow window at 360 px: one column, no horizontal scroll, drawer as a
      bottom sheet.
- [ ] Fix from the browser round: the band label "compaction · auto" prints over the "AFTER"
      region label in the story (`src/ui/story/layout.ts`). Ruled a bug for the browser round,
      not backlog.

T7-qa (closed)
- [x] `/independent-review qa`, findings verbatim in `docs/reviews/2026-09-17-qa.md`.
- [x] Fixes named under "Fixes" in `docs/tasks/T7-qa.md`; the rest in `docs/tasks/BACKLOG.md`.
- [x] `README.md` with the honesty lines; `docs/deployment.md`; `scripts/deploy-s3.sh` (refuses
      without `AUTOPSY_BUCKET`, exit 2, nothing built).

T5-ship
- [ ] `AUTOPSY_BUCKET` and region known.
- [ ] Fresh-export build: `git archive HEAD | tar -x -C <tmp>`, then `npm ci && npm run build` there.
- [ ] `grep -rn "fetch(" dist/assets` empty.
- [ ] The human lifts the `aws` deny for the one sync command, or runs it in Terminal.
- [ ] `scripts/deploy-s3.sh` runs once; output pasted under "Deploy log" in `docs/tasks/T5-ship.md`.
- [ ] URL in `README.md` ("Deployed at") and `docs/deployment.md` ("URL as deployed").
- [ ] The human opens the URL on a phone: ticket case by default.
- [ ] `BASE_URL=<url> npm run e2e` and `npm run screenshots -- <url>` against the live URL.
- [ ] `/task-close T5-ship`, then `push` at the gate.

T8-polish, after ship
- [ ] Evaluator walk of the live URL in `docs/reviews/<date>-evaluator.md`.
- [ ] At most two fixes, redeploy, deploy log pasted.
- [ ] `curl` returns 200 and the default session label is in the fetched bundle, with the rule lifted.

## Next

**The browser round first**, then **T5-ship** (`docs/tasks/T5-ship.md`).

Browser round: `npm run build && npx vite preview --strictPort --port 4173`, open
http://localhost:4173/ on the desktop and once at 360 px wide (device toolbar). Walk landing,
compaction click, the file-edit LOST trace, the evidence drawer (Escape and backdrop), the Story
toggle. Fix the band label collision in `src/ui/story/layout.ts` (the band label and the region
labels share the top row of the drawing; move the band label below the region labels or the
region labels to the edges). Which task carries that fix is an open question below.

T5-ship first concrete step: the fresh-export build. `git archive HEAD | tar -x -C <tmp>` (never
`git clone`, it is a deny rule), `npm ci && npm run build` there, `grep -rn "fetch(" dist/assets`
empty. Then the human sets `AUTOPSY_BUCKET` and lifts the `aws` deny for the one sync command.
T5 touches no `src/` file; a build failure reopens the owning task.

## Decisions, verbatim, 2026-09-17

T4 scan count: "Scan count: the report should carry it, so that's a contract gap. Log a v3 entry
in CONTRACT-ISSUES.md: the none-found state gets a scanned count and a window-end reason from the
analyzer. For v1, keep the UI count but word it as what it is: "N tool calls after the
compaction, none matched", not "in-scope actions scanned"."

Criterion 7: "Don't split the string to dodge the grep. That's gaming the check." "Criterion 7:
no string splitting. Change the story test to import the label constant from the domain and
assert against it. The literal lives in the contract only."

Phone width: "Phone width: fine, we'll check it in the browser pass." "P10c is the browser check;
add one narrow-window pass to it." (P10c is not in this repo; the narrow-window pass is in the
checklist above.)

Story toggle: "Add the story view component that's already in `src/ui/story/` as a toggle on the
same panel. Clicking a ribbon there selects the same item as clicking a ledger row, and both
update the URL the same way, so a shared link opens the same view."

Landing, hint, footer: "Opening the app with no URL parameters lands on the default the UI spec
defines: the highest-provenance session with a downstream action, compaction in view. Provenance
label next to every session name. One-line hint: "Start here: click the compaction." One-line
footer on every view: "Demo data is illustrative. Items are pre-labeled; the README says what the
analysis does and doesn't do.""

T4 close ownership: "confirm" (`src/index.css` closes with T4; the files committed between the
lane merges and the T4 close by the review fixes count as integrator work).

Deploy gate: "Nothing gets deployed until the checklist passes on my machine."

Playwright: "Playwright, required, kept minimal. One smoke test that opens the file-edit fixture
and checks its LOST trace is visible. One script that takes a base URL and saves four screenshots
to a gitignored folder: landing, compaction clicked, the lost item's trace open, story view. Run
both against the preview URL. Show me the four images. The same script runs against the live URL
later. A reviewer who can't click needs to see the screen."

Playwright ownership: "T7-qa owns the playwright files. commit them now as a T7 milestone so the
fix loop starts from a clean tree. The band label over the AFTER label is a bug for the browser
round, not backlog. fix it in layout.ts when we get there."

QA rulings: "Fix now: path prefix counting as present; the "order: before restatement" row
omitted when nothing was restated; quoted redirect target; structural-heading match on word
boundaries; changelog filename match case-insensitive, the contract names the artifact kind, not
its casing. Wording: ledger cell reads "INCONSISTENT ACTION · tool · time" beside "NONE FOUND"
and "NOT CHECKABLE"; the story's empty line says "none found". No phrases beyond the contract's
state words." "Don't invent "ACTION FOUND". A reader can hear that as good news."

"Log to CONTRACT-ISSUES.md as v3: permitted-location entities becoming anchors; cp with the
anchor as source counted as a write; the ticket class pattern matching SHA-256 and ISO-8601;
negation sentences that aren't rules extracted as rules; relaxing sentences counted as
restatements; the two frozen-file comment mismatches. Mark the ticket pattern first for v3; it
fires on ordinary commit messages."

"README honesty section, two lines: token overlap can't tell an inverted rule from a preserved
one; items are tracked per compaction only." "Backlog the rest. Keep both the parity test and the
expected-report tests."

## Open questions

- Which task carries the `src/ui/story/layout.ts` band-label fix: T5 forbids `src/` changes and
  T8's budget is two post-ship fixes. Options: spend one of T8's two before the ship, or a
  reopened T7 fix line.
- `AUTOPSY_BUCKET` and region for T5-ship; the human lifts the `aws` deny for the sync and
  `curl` for T8.
- Spec drift to record or accept in `docs/specs/ui.md`: the story now lives behind a
  Ledger/Story toggle in the panel, not in a right-hand context pane; the "Start here" hint is a
  one-line banner above the questions, not a chip on the first ledger row; the footer line
  changed to point at the README. All three were ruled this session; the spec text still says
  the old thing.
- The T7 task file names `docs/BACKLOG.md`; the file is `docs/tasks/BACKLOG.md`.
- Worktrees under `.claude/worktrees/` (three from session 3, one from the README drafter,
  branch `worktree-agent-a33b3138c510ab5d0`, already merged as `7961861`) are still registered.
  Cleanup is the human's call.
- v3 candidates in `docs/CONTRACT-ISSUES.md`, in order: the ticket class pattern; a scanned count
  and window-end reason on the none-found state; permitted-location anchors; `cp` as a write;
  non-rule negations; relaxing restatements; the two types-file comment mismatches;
  `sourceSessionId` on `Provenance`; a weaker label for a hit on a PRESERVED item.
- `scripts/autopsy-check.py` keeps the old behavior on the four edges fixed in T7 (path directory
  prefix, quoted redirect target, heading whole words, changelog casing). Align it at the next
  refreeze; parity is unchanged because the fixtures do not exercise them.

## Uncommitted

clean (this handoff is the last docs commit of the session). `.claude/worktrees/` is untracked
scaffolding, not project files.

## Time

3h 53m of the 4–5h target (`node scripts/usage-time.mjs`, 163 turns). Closed rows: scaffold 4,
guards 13, T1-fixtures 16, T2-stub-and-strategy 3, T2-engine 13, T3-ui-shell 13, T6-story-view
13, T4-autopsy 17, T7-qa 24; running total 116 minutes. The rest of the usage sits in unclosed
stretches (skills, experiments, algorithm, plan, contract, reviews, merges, handoffs).
