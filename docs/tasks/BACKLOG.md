# Backlog

Items the lanes reported and did not build, and integration leftovers. Written by the
integrator from the lane reports on 2026-09-16 (T2-engine, T3-ui-shell, T6-story-view merged).

## For T4-autopsy

- Mount `StoryView` with the real report and pass `session.compactions[report.compactionIndex]`
  as its `compaction` prop (T6 added it: `Report` carries no `Compaction`, so the band label and
  token facts come from the prop; without it the band says "compaction" and the facts read
  "token facts: not available").
- (done, review fix 5) the four token names the story reads are aliased on `:root` in
  `src/index.css`.
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

## From the independent reviews, 2026-09-16 (logged, not fixed; real, not wrong output)

### Tests that do not establish what they claim
- `src/ui/app/Header.tsx`: the "after: not recorded" branch for absent `postTokens` has no test
  and no fixture exercising it (all three carry `postTokens`).
- `src/ui/story/StoryView.test.tsx`: the motion test passes `motion={false}` but
  `renderToString` never runs the effect, so it does not establish that the motion prop or
  `prefers-reduced-motion` renders the end state; no act above 0 is ever rendered in a test.

### Story view (T6 style findings)
- `<svg role="img" aria-label>` makes the subtree presentational for assistive tech, so the
  `role="button"` and `aria-label` on every ribbon, link, and the band are unreachable to screen
  readers although they are keyboard-focusable. Own item: pick `role="group"` or a list
  structure, and test it.
- With motion on, the first client paint shows the full end state and the effect then snaps the
  clip to 0 and animates: a one-frame flash. `layout.width` and `band.x` are effect deps, so a
  width change replays the mount animation.
- `matchMedia` is read once per effect run, no `change` listener; toggling the OS setting while
  mounted is honored only on the next report change.
- Only the tool name is visible text at the diamond; `INCONSISTENT_LABEL` is exposed through
  `aria-label`, `<title>`, and the figcaption legend, a looser reading of "labeled with".
- `reportKey` is `sessionId:compactionIndex`; a different `report` object with the same key does
  not reset the play act or re-animate.
- Stub `0:51:0` carries one entity where the parity report has two; the comment overstates that
  shapes follow the expected values.

### Shell (T3 style findings)
- `html, body { overflow-x: hidden }` masks horizontal overflow instead of preventing it.
- `Timeline` counts `session.messages.length` while rows come from `timelineRows` (which drops
  summary uuids); they agree only because the adapter never puts the summary into `messages`.
- `src/ui/app/App.test.tsx` indexes `session.compactions[0]` unguarded.
- `.timeline__boundary-label` has no CSS rule.
- `docs/tasks/T3-ui-shell.md` criterion 3 still reads `grep -rn "analyze" … is empty` although
  the human superseded it for this build.

### Engine (T2 style findings)
- `matchersOf` trusts `item.anchors` and never consults `item.class`; a pre-labeled fixture could
  carry anchors on a fact or positive item and the engine would match on them.
  `src/specs/fixtures.test.ts` has no anchor-class check.
- The multi-line verbatim window in `survival.ts` is `i+8` lines, undocumented in algorithm-v1
  (same constant as the reference).
- Lexical timestamp comparison (contract, "Regions") assumes one ISO format; the adapter emits
  millisecond precision. A fixtures test asserting uniform `ts` format would make that explicit.

## From the QA review, 2026-09-17 (`docs/reviews/2026-09-17-qa.md`)

- Finding 10: `afterRestatement` uses strict `ts > restatedTs`; a hit and a restatement in the
  same millisecond read "before restatement". Message `line` is available for a tiebreak.
- Finding 11: `verbatim` is a raw substring test, so "today" inside "today.bak" still counts.
- Finding 12: the `bash_write` excerpt is cut around the first occurrence of the anchor in the
  whole command, not in the segment that hit.
- S3: items dedupe by normalized text, so "Don't edit X." and "Do not edit X." are two rows that
  hit the same action twice.
- S4: the heredoc regex and `stripLiterals` duplicate the literal grammar.
- S5: `src/ui/autopsy/derive.ts` re-implements the domain's mark merging; exporting the domain's
  `markedSpan` merge through `src/domain/index.ts` would remove the copy.
- Reference script: `scripts/autopsy-check.py` keeps the old behavior on the four fixed edges
  (path directory prefix, quoted redirect target, heading whole words, changelog casing). Align
  it with the next refreeze; the fixtures do not exercise those edges, so parity is unchanged.

