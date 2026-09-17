# HANDOFF — 2026-09-17, end of project-session3 (three lanes merged, reviews, fixes, freeze v2, closes)

The next session starts from this file and nothing else. Repo rules are in `CLAUDE.md`
(auto-loaded). Time log is `STATUS.md`. Skills: `/task-close`, `/independent-review`,
`/session-handoff`, `/freeze-contract` (human-run). Deferred work is in `docs/tasks/BACKLOG.md`.

**The contract is frozen at v2** (`2ff97d1`). Two changes from v1, logged in
`docs/CONTRACT-ISSUES.md`: a downstream forbidden-token match is whole-token, the same rule as
survival (`VLX-41271` is not `VLX-4127`); regions are half-open windows both ways (a message at
exactly a boundary's `ts` is after that boundary). The guard hook blocks writes under
`docs/contracts/` and to the types file while FROZEN exists, and blocks any command line that
names those paths next to a write pattern (`>`, `2>&1`, `sed`, `python3`, `node`, `awk`, `rm`,
`mv`, …). Reads with `head`, `tail`, `grep`, `cat` alone pass. A refreeze: the human deletes
FROZEN and that deletion is committed alone (the freeze skill's precondition treats it as an
uncommitted contract edit otherwise), Claude edits and logs, the human runs `/freeze-contract`.

## Done

| Task | SHA | What |
|---|---|---|
| scaffold | 9d99739 | Vite + React + TS scaffold |
| guards | 22199d4 | hooks, egress deny, contract guard, usage-time script |
| T1-fixtures | 801e5c7 | three fixtures, reference script, expected tests, freeze v1 |
| T2-stub-and-strategy | e42b11d | `analyze` stub, pending tests, testing strategy |
| T2-engine | 8f53285 (lane merge) | `analyze` stages 1–5 ported from the reference; 16 expected tests moved out of `pending/` and green; parity test against committed reference JSON; extraction parity; unit tests for every listed sentence and negative case; two-boundary test |
| T3-ui-shell | 26fcfb2 (lane merge) | shell, header with picker, provenance band, facts line, slots, timeline with the boundary bar, footer, url-state, light and dark tokens, smoke tests |
| T6-story-view | 3fd6f64 (lane merge) | pure `layoutStory`, `StoryView` SVG, interactions 1–5, D3 modules installed per the table, stub report under test |

The three lanes ran as parallel subagents in worktrees under a 35-minute cap and all finished
inside it with everything committed. After the merge: `src/source.ts` runs `analyze` on every
fixture at load and builds the session source with the real matched-action verdicts
(`d466d24`); the temporary `src/ui/stub-analyze.ts` is deleted; architecture rule R5 (no file
under `src/ui`, tests included, imports from `src/fixtures`) is in `src/specs/architecture.test.ts`
and `CLAUDE.md`.

Three independent reviews (T2, T3, T6) produced twelve correctness findings. Fixed, each in its
own commit: the import scanner missed multi-line imports (`baa9387`); region edge in engine and
timeline (`eec4b19`); Bash write through a longer path (`2f035f6`); story link from a stopped
ribbon, stem to a restatement past the band, tool label kept inside the drawing (`ab047f9`);
the four CSS tokens the story reads (`54f13cc`); `compaction=` and `item=` bounded by the
resolved session (`c511220`); whole-token downstream match under contract v2 (`41d4552`). Logged
to `docs/tasks/BACKLOG.md`: the two weak tests and the style findings, the story's aria role as
its own line.

The close of the three tasks is the STATUS commit right after `41d4552`; rows carry each lane's
merge commit. Pushed to origin through 608003b before this session; everything from 95204fe on
is local until the human pushes at this session's gate.

## Next

**T4-autopsy** (`docs/tasks/T4-autopsy.md`, spec `docs/specs/ui.md`, "Autopsy panel" and
"Evidence drawer"). First concrete step: `src/ui/autopsy/strings.ts` with `HEALTHY_LINE`, then
`AutopsyPanel` mounted into `AutopsySlot` from `src/App.tsx`, reading the report for the selected
session and compaction from `analyzedSessions` in `src/source.ts`. Then mount `StoryView` into
`StorySlot` with the real report and `compaction={session.compactions[report.compactionIndex]}`
(the story's band label and token facts come from that prop). Read the "For T4-autopsy" section
of `docs/tasks/BACKLOG.md` first: token names are already aliased, the timeline exposes
`highlightUuid` and `id="msg-<uuid>"` rows, the shell's `App` takes `source` and
`initialSearch`. Then T7-qa, T5-ship, T8-polish in order.

## Decisions, verbatim, 2026-09-16 and 2026-09-17

Lane brief: "Cap: 35 minutes from when the lanes start. Must-haves: T2 tests pass, T3 renders
all three fixtures, T6 interactions 1 and 2. In every lane's brief: must-haves first, commit each
the moment it's green." "What's committed is what we keep, so never sit on green work." "If the
pre-commit hook rejects a lane's commit, the lane reports the message and leaves the work
uncommitted. No `--no-verify`. Nobody touches the hooks."

T3 stub: "Until T2 lands, the analysis result comes from one stub file, `src/ui/stub-analyze.ts`,
that returns the fixtures' expected answers. Nothing else in `src/ui` imports from
`src/fixtures`. The stub is temporary; the integrator deletes it after the merge."

Merge and swap: "wire the shell to the real `analyze` from `src/domain/index.ts`, delete
`src/ui/stub-analyze.ts`, add an architecture-test rule that `src/ui` never imports from
`src/fixtures`."

Review fixes: "Fix 1 through 8 and 10. Order: 1 first, then 7 and 10 together, then 8 including
the reference script and regenerated parity JSON, then 2, 3, 4, 5, 6. For 5, add the four
tokens to the shell's CSS rather than renaming in the story."

Contract v2: "9 is a contract change. Downstream anchor matching goes whole-token, same as
survival." On the region edge: "agreed, half-open both ways, and the v2 doc says so."

Status gating: "leave v1 as is. Log in CONTRACT-ISSUES.md as a v2 question: a downstream hit on
a PRESERVED item should carry a different, weaker label than the inconsistency label, because
that's a model ignoring a present rule, not compaction loss." Not bundled into the refreeze.

Close ruling 1: "Steps 1 through 4 run as checks, three STATUS rows with each lane's merge commit
as its SHA, STATUS.md committed alone as the close. Write that into the task-close skill: when
work was committed at milestones and the tree is clean, that's the close, not a refusal."

Close ruling 2: "widen, and make it permanent. The architecture test, the source wiring,
BACKLOG.md, CONTRACT-ISSUES.md, CLAUDE.md, and tsconfig belong to the integrator and never
count as outside ownership at a lane close." Widened again: "The integrator set also includes
docs/HANDOFF.md, docs/specs/*, docs/tasks/*, .claude/skills/*, and any contract, spec, or
reference-script change from a refreeze I directed."

Literal scan: "The .skip( and .only( scan covers test files and src/ only. Docs are prose. And it
distinguishes skipIf with a reason from a bare skip; only the bare ones fail."

Time attribution for parallel lanes: "13 per row, 39 added to the running total once."

Playbook: "I'll note both the refreeze pattern and the status-gating question in the playbook so
they carry forward."

## Open questions

- `AUTOPSY_BUCKET` and region for T5-ship; the human lifts the `aws` deny for the sync and
  `curl` for T8.
- Whether the D3 module table in T6 grows (any addition is written into the table first).
- v3 candidates in `docs/CONTRACT-ISSUES.md`: `sourceSessionId` on `Provenance`; a weaker label
  for a downstream hit on a PRESERVED item.
- The freeze skill's step 0 treats the human's deletion of FROZEN as an uncommitted contract
  edit. Either commit the deletion alone before running it (done this session) or exclude
  FROZEN from that check in the skill.
- Item ids for real-data sessions: `initialUrlState` keeps `item=` only when the session carries
  pre-labeled items; T4 should feed the analyzed ids instead.

## Uncommitted

clean (this handoff is the last docs commit of the session).

## Time

3h 08m of the 4–5h target (`node scripts/usage-time.mjs`, 151 turns). Closed rows: scaffold 4,
guards 13, T1-fixtures 16, T2-stub-and-strategy 3, T2-engine 13, T3-ui-shell 13, T6-story-view
13; running total 75 minutes. The three lane rows share one 39-minute window (parallel lanes
plus integration), split evenly by ruling. The rest of the usage sits in unclosed stretches
(skills, experiments, algorithm, plan, contract, reviews, this session's merge and fixes).
