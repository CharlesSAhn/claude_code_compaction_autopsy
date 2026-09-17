# T6-story-view — the animated story view (D3)

## Objective

The story view from the plan (amendment 8), built to `docs/specs/ui.md`: items flow from the
"before" region through the compaction boundary; PRESERVED items cross, DEGRADED items cross
weakened, LOST items stop at the boundary. Built against the frozen `Report` type. Until
T4-autopsy wires the real report, the view is driven by a hand-made stub report that is test
data only: no non-test file imports it, and once T4 lands nothing at runtime imports it.

## Dependencies

- `docs/specs/ui.md` exists (the human has picked the layout).
- Contract frozen at v1 (`Report`, `ItemReport`, `Status`).
- Runs in parallel with T2-engine and T3-ui-shell; does not wait for either.

## Lane rules

This lane runs in parallel with T2-engine and T3-ui-shell. Nobody changes what a contract term
means. If this lane thinks the contract is wrong, it writes the issue in
`docs/CONTRACT-ISSUES.md` and keeps going: no edit to the frozen files, no refreeze inside the
lane. Ownership is disjoint by folder; a change this lane wants outside its list is not made,
it is written under "Requests" at the end of this file for the owning lane.

## D3 modules

Individual packages only, never the `d3` umbrella. This lane installs them:

| package | for |
|---|---|
| `d3-selection` | binding items to SVG nodes |
| `d3-transition` | the flow animation (pulls `d3-interpolate`, `d3-timer`, `d3-ease` as its own deps) |
| `d3-ease` | named easings, imported directly |
| `d3-scale` | time and position scales for the before/boundary/after axis |
| `d3-shape` | the path an item follows |
| `@types/d3-selection`, `@types/d3-transition`, `@types/d3-ease`, `@types/d3-scale`, `@types/d3-shape` | types, dev |

Any further module is added to this table with its reason before it is installed.

## Method

Load the `dataviz` skill before writing any chart code. `src/ui/story/layout.ts` is a pure,
tested module: `Report` in, positions out, no DOM, no React, no D3 selection. React renders the
SVG from that output; D3 transitions run on the rendered nodes. D3 is imported nowhere outside
`src/ui/story/`.

## Files owned

- `src/ui/story/**` including `layout.ts`, `src/ui/story/test/stub-report.ts` (test data) and tests
- `package.json` (the dependency lines for the packages above only), `package-lock.json`
- `docs/tasks/T6-story-view.md`

## Files not to touch

`src/domain/**`, `src/adapters/**`, `src/fixtures/**`, `src/ui/app/**`, `src/ui/timeline/**`,
`src/ui/autopsy/**`, `src/App.tsx`, `src/main.tsx`, `docs/contracts/**`, `docs/specs/**`.

## Acceptance criteria

1. `StoryView` renders an SVG for a `Report` per `docs/specs/ui.md`: PRESERVED crosses solid,
   DEGRADED crosses dashed-thin with its score, LOST stops at the band; status by label and
   line style, never color alone; matched items get a dashed link (never a solid arrow) to a
   diamond at the hit time labeled with `INCONSISTENT_LABEL` from the constant; a restatement
   is a hollow circle; hovering the band shows the token facts; no caption says "caused".
2. Animation on mount, report change, and session switch; `prefers-reduced-motion` and the
   motion toggle render the end state; "Play story" steps through the four acts.
3. Interactions in the spec's priority order: hover highlights ribbon, ledger row, and
   timeline events via callbacks; click selects via `onSelect`; the link click via
   `onActionClick`; `onPlayStep` for the acts. `grep -rn "from 'd3-" src --include=*.ts --include=*.tsx`
   hits only files under `src/ui/story/`.
4. `grep -rln "stub-report" src` lists only files under `src/ui/story/test/` and `*.test.tsx`.
5. `grep -rn "from 'd3'" src` is empty; every D3 import names a module from the table.
6. Imports from the domain only via `src/domain` (types); no `analyze` call; no fetch.
7. A `renderToString` smoke test on the stub report contains every item text and the status
   marks; a unit test covers the position math (which region each item ends in by status).
8. `npm run check` green; `npm run build` green.

## Tests

`npm run check`; `react-dom/server` smoke test; position math unit test. D3 transitions are
not exercised in tests (no DOM); the end-state layout is.

## Out of scope

The real report (T4 wires `analyze`); the evidence view; the timeline; any layout decision.

## Requests

(none yet)
