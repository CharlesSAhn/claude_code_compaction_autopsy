# UI spec — one screen, two panes

Chosen 2026-09-16 from three options: layout C (two panes, one row per item) with the evidence
view as a drawer over the right pane. One screen, no routing; the URL query string carries the
view state. An investigation tool, not a dashboard. Only fields the contract defines
(`src/domain/contract.ts`) are shown; every optional field has an explicit state.

## Who builds what

| Part | Task | Where |
|---|---|---|
| Shell, picker, provenance band and note, facts line, footer, URL state, timeline, slots | T3-ui-shell | `src/ui/app/**`, `src/ui/timeline/**`, `src/App.tsx` |
| Story view: pure layout module, React SVG, animation, interactions | T6-story-view | `src/ui/story/**` only place D3 is imported |
| Autopsy panel: five questions, per-item four-step trace, evidence drawer, empty states, closing lines; wiring: `analyze` at load, default session, story fed the real report | T4-autopsy | `src/ui/autopsy/**`, mounting in `src/App.tsx` |

## Whole app

- At load, `analyze` runs on every fixture once. The results feed the session source's
  matched-action verdicts, so the default is the contract's rule: the highest-provenance
  session with a downstream action (observed, then experiment-derived, then constructed). The
  ticket case lands first. Its compaction is in view with a "Start here" hint on the ledger's
  first row; the hint disappears on the first selection.
- URL query string, read on load and written on every change, no routing:
  `?session=<id>&compaction=<index>&item=<item id>&view=ledger|story|evidence`. A missing or
  unknown value falls back to the default; the URL never carries anything not derivable from
  the fixtures.
- Every session shows its provenance band: the kind in capitals, then `run` for
  experiment-derived or the `note` verbatim for constructed. Never smaller than body text.
- One-line footer on every view: "Demo data is illustrative. Items are pre-labeled; survival,
  downstream, and restatement are computed in the browser."
- Facts line under the picker: `claudeCodeVersion` · `model` · `trigger` ·
  `preTokens → postTokens` (absent postTokens: "after: not recorded") · boundary `ts`.

## Layout

```
┌ header ───────────────────────────────┬ context pane ─────────────────────────┐
│ picker · provenance band · facts      │ story view (default)                  │
├ autopsy panel ────────────────────────┤ evidence drawer slides over it        │
│ five questions · ledger · trace       │ (story stays behind, dimmed)          │
├ timeline ─────────────────────────────┴───────────────────────────────────────┤
│ messages in order, boundary marked                                            │
├ footer ───────────────────────────────────────────────────────────────────────┤
```

Desktop (≥ 900 px): header and autopsy panel left at 55%, context pane right at 45%, timeline
full width below, footer last. Phone (< 900 px): one column: header, autopsy panel, story,
timeline, footer; the evidence drawer is a bottom sheet, closed by handle, Escape, or tapping
outside. No horizontal page scroll at 360 px; 16 px gutters.

## Autopsy panel (T4)

The five questions in order, each a heading with its count, then the ledger, then the trace
of the selected item.

1. What was there: "N items from M prompts before the boundary".
2. What survived: "N PRESERVED".
3. What was lost or weakened: "N DEGRADED, N LOST" (zeros written out, never omitted).
4. Where it came from: "every item links to its prompt: uuid, time, JSONL line".
5. What happened after: "N matched, N none found, N not checkable".

Ledger: one row per `ItemReport`: item text and class tag; status word with `verbatim` when
true; score to two decimals; origin line; after column with "MATCHED · tool · time",
"NONE FOUND · N scanned", or "NOT CHECKABLE". Clicking a row selects it and writes `item=` to
the URL.

Trace of the selected item, four steps, always all four:
1. **Source**: the item text, class, entities, anchors ("no anchor" when none); origin uuid,
   time, line, as a link that scrolls the timeline to the prompt.
2. **Compaction**: status, score, `verbatim`; the closest passage as "summary line N" with its
   first 160 characters, `structuralSection` when present or "no constraints section matched";
   `entitiesInPassage` and `entitiesAnywhere` ("none" when empty). The "evidence ▸" button
   here opens the drawer.
3. **After**: the downstream result.
   - `matched`: `INCONSISTENT_LABEL` (rendered from the constant), then tool, time, matcher,
     artifact, excerpt, and "before restatement" or "after restatement".
   - `none_found`: "none found: N in-scope actions scanned" and what closed the window:
     "until the end of the session" or "until the next compaction at <ts>"; the scope kinds.
   - `none_matchable`: "not checkable" with the reason: "a fact has no anchor", "a positive
     rule has no anchor", or "no concrete or class anchor in the trigger clause"; scope empty.
   - restatement: "restated at <time> (score, by score | by entities)" or "not restated".
   - Under every downstream result, `CLOSING_LINE`, rendered from the constant.
4. **Evidence**: a one-line summary of what the drawer holds and the "open evidence" button.

Healthy closing line: when no item in the report is `matched`, question 5 ends with
`HEALTHY_LINE` = "No downstream action inconsistent with tracked information was observed."
It lives in `src/ui/autopsy/strings.ts`, the only UI-defined fixed string, and is never shown
when any item is matched.

## Evidence drawer (T4)

Opened from the compaction step or from a story ribbon. Slides over the context pane (desktop)
or up as a sheet (phone); the story stays behind, dimmed, the selected ribbon lit. Content:
1. the item text;
2. the passage: `passage.text` raw, "summary line N", section note; marks rendered from
   `survival.matches` offsets, never from `markedSpan`: exact `«…»`, fuzzy `«~…»` with
   distance on hover;
3. `entitiesInPassage`, `entitiesAnywhere`, each "none" when empty;
4. thresholds used;
5. the after block and restatement, with `CLOSING_LINE`.
Writes `view=evidence` to the URL; closing writes `view=ledger`.

## Story view (T6)

Pure math, then React. `src/ui/story/layout.ts` is a pure, tested module: `Report` in,
positions out (ribbons, band, links, markers), no DOM, no React. D3 is imported only under
`src/ui/story/` (scales, shapes, easing, transitions), individual modules, never the umbrella.
React renders the SVG from the layout output; transitions run on the rendered nodes. Load the
`dataviz` skill before writing any chart code.

Drawing:
- Horizontal axis: before region, the compaction as a vertical dropped band labeled with
  `trigger`, after region. Hovering the band shows the token facts: `preTokens`, `postTokens`,
  the boundary time.
- One ribbon per item, ordered by `origin.line`, labeled with a short form of the text and
  the line number. Status by label and line style, never color alone: PRESERVED solid, full
  weight, crosses, filled end dot, label "PRESERVED"; DEGRADED dashed-thin, crosses, label
  "DEGRADED 0.18"; LOST solid, stops at the band with a bar end, label "LOST".
- Matched items only: a dashed link, never a solid arrow, from the ribbon's band point to a
  diamond in the after region placed by `hit.ts`, labeled with `INCONSISTENT_LABEL` rendered
  from the constant and the tool name. The two empties draw nothing after the band beyond the
  ribbon itself.
- A restatement is a hollow circle on the ribbon at its time, labeled "restated".
- No caption in the story view says "caused" or implies it.
- Height follows the item count; the healthy case is four clean crossings and no link.

Animation: on mount, on report change, and on session switch the ribbons travel from the
before region to their end state over about one second, LOST stopping at the band, links
drawing last. `prefers-reduced-motion` or the motion toggle: end state only, no transitions.

Interactions, in priority order:
1. Hover a ribbon: highlight it, the ledger row, and the timeline events it links to (origin
   prompt, hit, restatement).
2. Click a ribbon: select the item and write `item=` and `view=story` to the URL.
3. Session switch: the view animates to the new report.
4. Hover the dropped band: token facts.
5. "Play story": steps through the four acts, matching the trace: source (ribbons lit in the
   before region), compaction (the band, statuses appear), after (links and markers draw),
   evidence (the selected item's drawer opens). Each step is one click; reduced motion shows
   the act's end state.

Until T4 wires the real report, the story renders from `src/ui/story/test/stub-report.ts` in
tests only; the runtime shows the shell's `StorySlot` placeholder.

## Timeline (T3)

Full width, one row per `Message` in order: kind glyph (human, assistant, tool_use with the
tool name, tool_result), time, `excerpt`. The boundary is a full-width bar at
`compactions[i].ts` labeled "compaction · trigger"; the summary record is never rendered as a
typed message. Rows are addressable by message uuid so the trace, drawer, and story can scroll
to a row and flash it. Long sessions scroll inside the region, not the page.

## States that must look right

- Healthy case: four PRESERVED rows, three "NONE FOUND · N scanned", one "NOT CHECKABLE",
  four closing lines, `HEALTHY_LINE` under question 5, four clean crossings. A finished
  result, not an empty screen.
- Constructed sessions: the band says CONSTRUCTED with the note; nothing else differs.
- Absent optional fields: `postTokens` "after: not recorded"; `structuralSection` "no
  constraints section matched"; `hit` absent shows the empty-state phrase with its reason;
  `restatement` absent shows "not restated".

## Words

The two contract strings render only from `INCONSISTENT_LABEL` and `CLOSING_LINE`; no UI file
contains either literal. `HEALTHY_LINE` is the one UI-owned fixed string. No UI text says or
implies causation; "after" and "first observed" are the only sequence words. "not checkable"
is the UI string for `none_matchable`, "none found" for `none_found`.

## Tokens and theme

Colors as tokens on `:root`, redefined for dark under `prefers-color-scheme: dark` and
`[data-theme]`; explicit `body` background. Status tokens `--status-preserved`,
`--status-degraded`, `--status-lost` (used with the label and line style, never alone);
provenance tokens `--prov-observed`, `--prov-experiment`, `--prov-constructed`; one accent
for the matched action. System font stack. Nothing fetched at runtime (architecture rule R3).

## Slots and interfaces

- T3 exports `App` with `Header`, `Timeline`, `AutopsySlot`, `StorySlot` (placeholders that
  say "not analyzed in this build"), and `src/ui/app/url-state.ts` (read and write the four
  query keys).
- T6 exports `StoryView({ report, selectedItemId, onSelect, onActionClick, onPlayStep })` and
  `layoutStory(report, size)` from `layout.ts`.
- T4 exports `AutopsyPanel`, `EvidenceDrawer`, `HEALTHY_LINE`; mounts them and `StoryView` with
  the real report; runs `analyze` on every fixture at load and builds the source with the
  verdicts.
