# Evaluator walk of the live URL, 2026-09-17

Fresh subagent, no conversation context, ten-minute budget. Inputs: the four Playwright
screenshots taken against http://charles-ahn-compaction-autopsy.s3-website-us-east-1.amazonaws.com
at 1280 px full page, the served `index.html`, then read-only access to the repository. Report
verbatim below; the ranking drove the T8 fixes (`docs/tasks/T8-polish.md`, "Fixes").

---

# Compaction Autopsy: fresh-eyes evaluation

Scope note: judged from four 1280 px full-page stills plus the served `index.html` (a bare Vite shell: `<div id="root">`, one JS and one CSS asset, title "Compaction Autopsy"). I could not verify hover states, click targets, the story animation, "Play story" stepping, the evidence drawer's open state, phone width, dark mode, or load time. The repo was read-only; one test was run.

## A. Developer with only the URL

**1. Do I get it in 30 seconds?**
Mostly yes. The header reads "Compaction Autopsy", the panel is titled "Autopsy compaction 1 of 1 · auto · 18:38:48 UTC", and the five numbered questions carry the meaning: "What was there: 4 items from 4 prompts before the boundary", "What survived: 3 PRESERVED", "What was lost or weakened: 1 DEGRADED, 0 LOST", "Where it came from: every item links to its prompt: uuid, time, JSONL line", "What happened after: 1 matched, 2 none found, 1 not checkable". A Claude Code user recognises "compaction" and "JSONL line". What is missing on the landing: no one-sentence statement of purpose (nothing says "Claude Code transcript" on the page; the only hint is the facts line "2.1.273 · claude-sonnet-5 · auto · 235140 → 18667 · 2026-09-16T18:38:48.874Z", which is unlabeled). A developer who doesn't already know Claude Code compaction would not decode "235140 → 18667" as tokens. The hint "Start here: click the compaction." is prominent but points at the timeline bar, which is below the fold on the landing still (screenshot 1 ends at 18:31:41; the bar appears only in screenshot 2 at 18:38:48). Cannot verify whether the page auto-scrolls the bar into view.

**2. Can I see what was lost, trace it to source, and see what happened after?**
Yes, and this is the strongest part. Screenshot 3 (file-edit session, item 0:51:0): the ledger row is outlined, status "LOST" struck through, score "0.20", origin "line 51", after column "INCONSISTENT ACTION · Edit · 18:40:48". The Trace has four steps: "1. Source" with class/entities/anchors and a linked origin "58aa00e9-6b61-4997-a459-230f3d9627e6 · 18:31:39 UTC · line 51"; "2. Compaction" with "summary line 21: - Python stdlib only used in `«scripts»/«rotate_keys.py»`..." showing the marked tokens, "section no constraints section matched", entities in passage / anywhere; "3. After" with tool Edit, time, "matcher forbidden_path", "artifact file_edit", excerpt path, "order before restatement", "restated at 18:48:48 UTC (0.70, by score)"; "4. Evidence" with an "open evidence" button. The timeline below confirms it: "18:40:48 Edit /home/dev/scratch/autopsy-run2/scripts/rotate_keys.sh" then "18:48:48 human: wait. don't modify scripts/rotate_keys.sh...". The story view (screenshot 4) draws the same thing: red "LOST line 51" ribbon stopping at the band, dashed link to a diamond "Edit", hollow circle "restated". One thing I could not see: what the evidence drawer looks like when open (no still of `view=evidence`), and whether the origin link actually scrolls the timeline.

**3. Is "lost" vs "caused" clear? Any causal wording?**
Clear, and deliberately so. Every after-step ends with the italic line "We show the loss and the action. We do not claim one caused the other." The after label is "first observed downstream action inconsistent with this item" and the ledger uses "INCONSISTENT ACTION"; the story caption is "◆ first observed downstream action inconsistent with this item". No visible text says "caused", "because", "led to". The one wording that leans: the session labels in the picker read as narratives, "Constructed: the rule vanished, the file got edited, the user re-typed it" and "the ticket survived, the rule about it did not". They are sequence-only and honest, but a skimmer might read the comma chain as cause-and-effect. Also worth noting: "LOST 0.20" beside a line that clearly *mentions* the file (`scripts/rotate_keys.py`) makes the reader do the work of noticing that the summary kept the path but not the rule; the UI doesn't say so in words.

**4. Is the healthy demo credible?**
Only partly checkable from stills, since no screenshot shows the healthy session. What I can see: the landing session is banded "CONSTRUCTED based on a real event I can't show" (an honest, slightly awkward note), the file-edit session is banded "constructed from the run 2 data: the file rule removed from the summary; the edit and the restatement are invented", and the footer on every still says "Demo data is illustrative. Items are pre-labeled; the README says what the analysis does and doesn't do." That is more candour than most demos give. Credibility drags in two places: (a) the footer references "the README" but the page has no link to it and a URL-only visitor has no README; (b) the constructed sessions are thin after the boundary (ticket case: 3 messages after the bar, "19:07:48 / 19:08:48 / 19:09:48", exactly one minute apart; file-edit: 4 messages at :48 each minute), which reads as synthetic at a glance. Both are labeled constructed, so this is not deceptive, just visibly synthetic. Whether the healthy run (204 messages, 46 after the boundary per the fixture) looks like a real run I could not verify visually.

**5. Would I use this?**
As a diagnostic after a "why did Claude forget X" moment: yes, if I could point it at my own JSONL. On the live site I cannot: the README says "It does not accept uploads." So today it is a demo of a method, not a tool I can run on my session. What would stop me: no upload/paste, no link to source or README from the page, and the pre-labeled items (the extraction stage "is the one stage the URL does not exercise"), meaning the hardest part, deciding what counts as a rule, is not demonstrated.

## B. Repo read

**6. Anything fake or hardcoded beyond `src/fixtures`?**
Nothing that stands in for a computed value. Findings:
- Counts, statuses, scores, origins, times, after labels are all derived: `src/ui/autopsy/derive.ts` (`questionCounts`, `afterWindow`, `markSegments`), `src/ui/autopsy/AutopsyPanel.tsx` lines 36-43, 77-93. Marks are built from `survival.matches` offsets, not the string form.
- Fixed UI strings live in `src/ui/autopsy/strings.ts` (`HEALTHY_LINE`, `NOT_CHECKABLE`, `NONE_FOUND`, `ORIGIN_LINE`, `QUESTIONS`, `START_HERE`) and `src/ui/app/Footer.tsx` (`FOOTER_LINE`). `INCONSISTENT_LABEL` and `CLOSING_LINE` render only from `src/domain/contract.ts` (lines 232-233); grep for "caus|because|led to|resulted in|due to" in non-test `src` hits only the contract comment and `CLOSING_LINE` itself.
- One static assertion the analysis does not compute per item: question 4 "every item links to its prompt: uuid, time, JSONL line" is the constant `ORIGIN_LINE`, not a check. It is true for the fixtures (every item has `origin`), but it is a claim, not a count.
- Thresholds are literals in `src/domain/contract.ts` lines 259-261 (`preserved: 0.75, degraded: 0.35, restated: 0.6`); frozen by contract, shown in the evidence drawer. Fine, but they are the knob nobody can see from the ledger.
- Test-only stub data: `src/ui/story/test/stub-report.ts` carries hand-written reports (timestamps, `VLX-4127`), imported only by `layout.test.ts` and `StoryView.test.tsx`. Not shipped.
- `src/specs/parity/*.report.json` are expected-output snapshots for tests, not runtime data.
- Items are pre-labeled in all three fixtures (top-level `items`, 4 each, identical ids `0:51:0`…`0:157:3` across sessions, since both constructed cases derive from run 2). `src/domain/analyze.ts` `itemsFor` uses `session.items` when present and only falls back to `extractItems`, so extraction never runs on the live site, exactly as the README states.
- Wording drift: the ledger after column says `NONE FOUND · ${scanned} tool calls after` (`AutopsyPanel.tsx:42`) while `docs/specs/ui.md` says "NONE FOUND · N scanned"; `derive.ts` documents the reason. Also "1 tool calls after" is visible on the landing (plural not applied; `plural()` exists in `derive.ts` but isn't used there). And the spec's footer wording ("survival, downstream, and restatement are computed in the browser") differs from the shipped footer ("the README says what the analysis does and doesn't do").
- The synthetic after-boundary timestamps (every message at :48 past the minute in both constructed fixtures) are fixture data, labeled constructed; nothing outside `src/fixtures`.

**7. R5 architecture rule.**
Present at `src/specs/architecture.test.ts:178`: `it('R5: src/ui never imports from src/fixtures', ...)` with violation text "src/ui reaches src/fixtures; sessions arrive as a SessionSource prop". Wiring matches: `src/source.ts` imports `./fixtures/index.ts` and `src/App.tsx` passes `analyzedSource` as a prop to `src/ui/app/App.tsx`. Ran `npx vitest run src/specs/architecture.test.ts`; result lines:
```
 Test Files  1 passed (1)
      Tests  6 passed (6)
```
(R1 through R5 plus the scanner self-test.)

## C. Top five improvements, ranked

1. **Let a visitor run it on their own transcript (paste or local file, no upload).** This is the gap between a demo and a tool; the adapter (`src/adapters/claude-code-jsonl/`) and `extractItems` already exist and the README says the only blocker is policy. Code change: a `jsonl` `SessionSource` built from a `<textarea>`/File input in `src/App.tsx` or the header; R3 forbids fetch but not a file picker (worth confirming against the rule text). Fixes the biggest "would I use this" objection.

2. **One sentence of purpose plus a link to the README/source on the page.** The landing has no "what this is" line and the footer cites "the README" that a URL-only visitor cannot reach. Code change: `src/ui/app/Header.tsx` (subtitle) and `src/ui/app/Footer.tsx` (link). No analysis change.

3. **Label the facts line and make the compaction bar reachable from the "Start here" hint.** "2.1.273 · claude-sonnet-5 · auto · 235140 → 18667 · 2026-09-16T…" needs labels (version, model, trigger, tokens before → after, boundary); the hint says "click the compaction" but the bar is below the fold on load. Code change: `Header.tsx` for labels; `src/ui/app/App.tsx` for a hint that is itself a button scrolling to `.timeline__boundary` (a handler for the bar already exists at App.tsx:100).

4. **Say in words what the DEGRADED/LOST passage kept and dropped.** The trace shows "LOST 0.20" beside a summary line that contains the file path; the reader has to infer "the path survived, the prohibition did not." A generated line such as "entities kept: rotate_keys.py · rule words matched: none" from data already in `survival` (`entitiesInPassage`, `matches`) would make the loss legible without asserting meaning. Code change: `src/ui/autopsy/AutopsyPanel.tsx` step 2, derived in `derive.ts`.

5. **Fix the small credibility leaks: "1 tool calls after", spec/footer drift, and the one-minute-apart synthetic timestamps.** Use `plural()` in `AutopsyPanel.tsx:42`; reconcile `docs/specs/ui.md` "N scanned" and the footer wording with what ships; regenerate the constructed fixtures with irregular after-boundary timestamps in `scripts/construct-fixtures.mjs` (fixture data only, contract-neutral). Small, but these are the first things a careful reviewer notices and they colour trust in everything else.

Could not verify: healthy-session rendering, evidence drawer open state, hover/click/animation, phone layout (CSS has a `min-width: 900px` breakpoint and dark-mode tokens in `src/index.css`, unverified visually), load time.

---

## Disposition, 2026-09-17

The human picked items 2, 3, and 5 ("fix the 2, 3, 5 only"), with item 1 recorded in the
README under "Future work". Item 4 and the fixture-timestamp part of item 5 are in
`docs/tasks/BACKLOG.md`.
