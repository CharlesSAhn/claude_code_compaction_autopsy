# HANDOFF — 2026-09-16, end of project-session2 (T1-fixtures, freeze v1, T2-stub, task graph, UI spec)

The next session starts from this file and nothing else. Repo rules are in `CLAUDE.md`
(auto-loaded). Time log is `STATUS.md`. Skills: `/task-close`, `/independent-review`,
`/session-handoff`, `/freeze-contract` (human-run).

**The contract is frozen at v1** (`8522efa`). `docs/contracts/FROZEN` holds the hashes of
`docs/contracts/contract.md` and `src/domain/contract.ts`; `src/domain/contract.frozen.test.ts`
checks them in `npm run check`; the guard hook blocks writes under `docs/contracts/` and to the
types file, and also blocks any command line that names those paths next to a write pattern,
so keep frozen paths out of commands that redirect or `git add`. A change is a refreeze: the
human deletes FROZEN, Claude edits and logs in `docs/CONTRACT-ISSUES.md`, the human runs
`/freeze-contract` for v2.

## Done

| Task | SHA | What |
|---|---|---|
| scaffold | 9d99739 | Vite + React + TS scaffold |
| guards | 22199d4 | hooks, egress deny, contract guard, usage-time script |
| (unclosed commits) | 8899ae4 … fad2ab5 | skills, experiments, algorithm v1, plan, contract v1, review |
| T1-fixtures | 801e5c7 (+ c810486 STATUS) | three fixtures, reference script aligned to the reviewed contract, expected tests from `--report-json`, rulings A and B, default-demo rule, task-close step 2 wording; contract push-back in 4dbfbb4, freeze v1 in 8522efa |
| T2-stub-and-strategy | e42b11d (+ 608003b STATUS) | `analyze` stub throwing "not implemented", pending tests import it statically, `docs/specs/testing-strategy.md`, `sourceSessionId` logged as v2 candidate |

Pushed to origin through 608003b. This handoff commit and the task graph are local until the
human pushes.

## Next

Three lanes in parallel, each in its own session, opened by its task file; then T4, T7, T5, T8
in order (`docs/tasks/*.md`, graph in this file under Decisions). `docs/specs/ui.md` is the
spec all three UI lanes build to.

- **T2-engine**: first step is `src/domain/normalize.ts` and `survival.ts` against
  `docs/specs/algorithm-v1.md` stage 2, run `npm run test:pending` after each stage until the
  sixteen tests pass, then `git mv` them out of `pending/`, then the parity test against
  `scripts/autopsy-check.py --fixture … --report-json` output committed under
  `src/specs/parity/`.
- **T3-ui-shell**: first step is `src/ui/app/url-state.ts` and the `App` frame with `Header`,
  the provenance band, the footer, `AutopsySlot`, `StorySlot`, `Timeline`; renders from
  `Session` alone, never imports `analyze`.
- **T6-story-view**: first step is loading the `dataviz` skill, then `src/ui/story/layout.ts`
  (pure, tested) against `src/ui/story/test/stub-report.ts`, then the React SVG, then
  installing the D3 modules named in `docs/tasks/T6-story-view.md`.

Layout is chosen (option C with the evidence drawer); `docs/specs/ui.md` is written; the
lanes may start.

## Decisions, verbatim, 2026-09-16

The brief for the fixture task: "Don't build the analyzer yet. This task is the demo data and
the answers we expect from it. The contract is reviewed, not frozen. This task is its first real
consumer. The freeze comes at the end of it."

Storyboard approval: "Both after-boundary changes: yes. The human prompt stays neutral in each
so the violation is Claude's choice, not mine."

Ruling A: "Anchor gone from the summary means LOST, stray words don't rescue it. Also: entities
match as whole tokens in survival scoring, same as downstream. rotate_keys.py is not a partial
match for rotate_keys.sh; that stem match is where the 0.20 came from."

Ruling B: "yes, drop "stop" in v1."

Task-close contract check: "The contract check is shasum -c against FROZEN. Before FROZEN
exists, task-close reports the contract diff and doesn't fail on it; the contract is allowed to
move before the freeze. T1 freezes before it closes, so the check passes. Fix the skill to say
that."

Default demo: "Default demo is the ticket case, not healthy. The rule is the highest-provenance
session that has a downstream action, and healthy has none."

Fuzzy distance 2 → 1 was Claude's push-back (ticket matched picked, option matched portion,
the flagship demo scored a log line above the work-item line); the human froze the contract
with it in.

Source session id: "no refreeze. run: "run2" is the source references for v1; the derivation
table in the task file says which scratch run that is and that's enough to find it. log
sourceSessionId in CONTRACT-ISSUES.md as a v2 candidate for the real-data adapter."

Task graph: "ok on the graph and the names. I'll use T2-engine, T3-ui-shell, T6-story-view,
T4-autopsy, T7-qa, T5-ship, T8-polish from here on. T2 rendering from the session alone: yes
and no stub. T6 against a hand-made stub report:yes test data only, nothing at runtime imports
it once T4 wires the real one. Layout choice stays before the lane, not in T4. T3 and T6 both
build against it, so it has to exist first." Graph: T2, T3, T6 in parallel → T4 → T7 → T5 →
T8. No adapter task: "that got built with the fixtures."

Lane rules: "they run in parallel. Nobody changes what the contract terms mean. If a lane
thinks the contract is wrong, it writes it in `docs/CONTRACT-ISSUES.md` and keeps going."

UI, from the options brief: "one screen, no routing"; "it's an investigation tool, not a
dashboard"; "it shows only the fields the contract defines, and the optional ones have explicit
states: "not checkable" and "none found" are the normal case and have to look right, not
empty"; "the center answers the five questions in order: what was there, what survived, what
was lost or weakened, where it came from, what happened after. The summary with the matched
span marked is the evidence view you open from an item, not the centerpiece."

UI, from the spec brief: "analyze runs on every fixture at load, then the default is chosen:
the highest-provenance session with a downstream action, compaction in view, with the "Start
here" hint. URL query string holds session, compaction, item, view." "One-line footer on every
view: demo data is illustrative, items are pre-labeled." "Per item, a four-step trace: source,
compaction with the closest passage and its score, after, evidence." "The two empty states are
shown, never blank: "not checkable" with its reason, "none found" with how many in-scope
actions were scanned and what closed the window." "Healthy closing line: "No downstream action
inconsistent with tracked information was observed."" "D3 does the math in a pure tested layout
module. React renders the SVG. D3 only under `src/ui/story/`." "The link to the first
inconsistent action is dashed, never a solid arrow, labeled with the contract's fixed phrase.
No caption says "caused". Status by label and line style, not color alone. Respect reduced
motion. Load the `dataviz` skill before any chart code."

T6 packages: "its task file names the D3 modules it needs, individuals packages, not the
unbrella. the lane installs theme."

T7 ownership: "T7 owns `README.md`, `docs/deployment.md`, `scripts/deploy-s3.sh`."

## Open questions

- `AUTOPSY_BUCKET` and region for T5-ship; the human lifts the `aws` deny for the sync and
  `curl` for T8.
- Whether the D3 module table in T6 grows (any addition is written into the table first).
- Two literal `.skip(` hits in the skill markdown trip task-close's scan while the guards
  commit is the base; the human waved it through for T1 and T2 closes. Now that base moves
  with each close, it no longer fires.

## Uncommitted

Before this handoff commit:

```
 M STATUS.md
?? docs/specs/ui.md
?? docs/tasks/T2-engine.md  T3-ui-shell.md  T4-autopsy.md  T5-ship.md  T6-story-view.md  T7-qa.md  T8-polish.md
```

All docs; committed by this handoff as `docs: task graph, UI spec, handoff`. No code pending.

## Time

2h 26m of the 4–5h target (`node scripts/usage-time.mjs`, 137 turns). Closed rows: scaffold 4,
guards 13, T1-fixtures 16, T2-stub-and-strategy 3; running total 36 minutes. The rest of the
usage sits in unclosed stretches (skills, experiments, algorithm, plan, contract, review, this
session's graph and spec).
