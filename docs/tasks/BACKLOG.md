# Backlog

Items the lanes reported and did not build, and integration leftovers. Written by the
integrator from the lane reports on 2026-09-16 (T2-engine, T3-ui-shell, T6-story-view merged).

## For T4-autopsy

- Mount `StoryView` with the real report and pass `session.compactions[report.compactionIndex]`
  as its `compaction` prop (T6 added it: `Report` carries no `Compaction`, so the band label and
  token facts come from the prop; without it the band says "compaction" and the facts read
  "token facts: not available").
- Reconcile T6's guessed CSS token names (`--accent-action`, `--text-muted`, `--band`,
  `--surface`) with the definitions in `src/index.css` (T3); each has a `currentColor` or
  `transparent` fallback today.
- Timeline scroll-and-flash for the trace, drawer, and story: `Timeline` accepts
  `highlightUuid` and rows carry `id="msg-<uuid>"`; the behavior is not wired.
- Timeline height is a fixed `max-height: 60vh`; tune once the autopsy panel is mounted.
- Header shows the boundary `ts` as raw ISO, the timeline as HH:MM:SS UTC; pick one.
- Session switch resets `compaction=0`, clears `item`, sets `view=ledger` (T3 assumed this; not
  in the spec).
- `App` takes `source` and `initialSearch` props; adjust the prop shape when the panels mount.

## For T7-qa

- Browser check of `StoryView` once mounted: label collisions at narrow widths (label above the
  ribbon, short text below, 44 px rows). The story lane had no browser.
- D3 transitions are untested (no DOM), as the T6 task allows; the end-state layout is tested.

## Engine

- Region edges: a message with `ts` exactly equal to a boundary `ts` is in neither region
  (before is strictly less, after strictly greater). The contract says "not before the previous
  boundary"; T2 made regions disjoint. No fixture hits the edge. Decide and test.
- Reference-script quirk: `scripts/autopsy-check.py` builds `CLASS_RES` over `ENT_RES`, so a
  `path` class anchor uses only the `(src|scripts|docs|config|logs)/…` alternative, not the full
  `PATTERNS.path`. The engine uses the contract pattern. No fixture has a path class anchor, so
  parity cannot expose it. A unit case with a path class anchor would settle it.

## T6 story view: added beyond the spec signature (optional props, no spec change)

- `onHover?: (itemId | null) => void` for interaction 1's ledger and timeline highlights.
- `motion?: boolean` for the motion toggle.
- `layoutStory(report, size, compaction?)` third optional argument.
