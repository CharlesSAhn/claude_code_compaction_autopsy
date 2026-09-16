# Contract v1

What we freeze. Types: `src/domain/contract.ts`. This page: their meaning. Procedure for
computing the values: `docs/specs/algorithm-v1.md` (stages 1–5), referenced, not repeated.
Frozen together by `docs/contracts/FROZEN` once the fixtures have pushed back on the types.
The closed word lists and thresholds are part of the contract, because the fixtures' expected
answers depend on them; they live in `WORDS` and `THRESHOLDS` in the types file.

## Statuses

`PRESERVED`, `DEGRADED`, `LOST`, meanings in `STATUS_MEANING`:
- PRESERVED: score ≥ `thresholds.preserved` (0.75) and every entity of the item is in the best passage.
- DEGRADED: not preserved, and score ≥ `thresholds.degraded` (0.35) or any entity of the item
  appears anywhere in the summary. Partial loss; the common case in real data.
- LOST: no passage reaches the degraded threshold and no entity appears anywhere in the summary.

A status is a statement about the summary text only.

## Survival scoring

- `verbatim` true when the normalized item is a substring of the normalized summary; score 1.
- Otherwise `score` is token overlap of the item against the best passage: matched item tokens
  over item tokens, stopwords and tokens under three characters dropped. A constraints-like
  section (heading in `WORDS.structuralHeadings`) is scored first when present and is recorded
  as `structuralSection`; the best passage overall wins.
- Typos and light paraphrase: non-entity tokens of at least `fuzzyMinTokenLength` (6) match at
  Levenshtein distance ≤ `fuzzyMaxDistance` (2). Entity tokens match exactly. Heavy paraphrase
  lands in DEGRADED. The tool never says "meaning preserved"; it reports score and matches.
- Normalization: lowercase, strip backticks, quotes, apostrophes, markdown markers, collapse
  whitespace (algorithm stage 2).

## Evidence

- Survival: `passage` (summary line index and text), `matches` as character offsets into the
  passage with token, fuzzy flag, distance (the source of truth), `markedSpan` derived from them
  (`«…»` exact, `«~…»` fuzzy), `entitiesInPassage`, `entitiesAnywhere`, `thresholds`.
- Provenance of the item: `origin` = user message uuid, timestamp, JSONL line. Nothing else in v1.
- Restatement: the user re-typing the rule after the boundary; a human sentence scoring
  ≥ `thresholds.restated` (0.6) against the item or containing all its entities plus a negation
  word. Proves the rule was back in context from then on. Proves nothing about the summary or
  about why the user retyped it.
- Every value must be checkable by hand in the fixture with the anchors shown.

## Provenance of a session

`observed-sanitized` (real session file, redacted), `experiment-derived` (scratch run, `run`
names it), `constructed` (built by hand, `note` is one line shown in the UI). The default demo
is an observed-sanitized or experiment-derived session with the most items. Constructed is never
the default.

## Downstream action

- Any assistant `tool_use` after the boundary, MCP calls included. Not only file edits.
- What stage 4 sees is `Message.action` (`ToolAction`): tool name, tool_use id, and, as
  present, `filePath`, `command`, `addedText` (a Write's content; an Edit's new lines not in
  its old string), `mcpInput` (the MCP input as JSON). Each text is capped by the adapter at
  4000 characters and redacted like every other string. The 200-character `excerpt` is for the
  timeline only and is never matched on.
- Checks, in order (algorithm stage 4): only negation items get anchors; anchors are concrete
  entities in the trigger clause, else one class anchor; scope is the union of what the
  sentence's scope nouns map to (`WORDS.scopeNouns`), or every kind when there is no noun;
  then the first hit among the matchers `forbidden_path`, `forbidden_token`, `style_token`.
- `result`: `matched` (with `hit`), `none_found` (a matcher ran, nothing hit), `none_matchable`
  (no anchor). Both empties are results, shown as such.
- `scope` records the artifact kinds inspected. `hit.artifact` names the kind that matched.
- `hit.afterRestatement` true means the hit cannot be attributed to the compaction at all.

## Inconsistency

`INCONSISTENT_LABEL` = "first observed downstream action inconsistent with this item".
Status-neutral: it applies to PRESERVED and DEGRADED items as much as to LOST ones, whenever
`result` is `matched`. Quoted only here and in the types file; everything else refers to it.

## The three claims

- LOST: a status, defined above, about the summary text.
- INCONSISTENT: the label above, about one later action.
- CAUSED: never asserted. No type, field, flag, or switch. `CLOSING_LINE` = "We show the loss
  and the action. We do not claim one caused the other." is printed with every downstream result.

## Result shape

`Report` mirrors the real-data check table. Required on every `ItemReport`: `item` (text, class,
entities, anchors, origin), `survival` (status, score, verbatim, passage, matches, markedSpan,
entities found, thresholds), `downstream.result`, `downstream.scope`. Optional, never observed on
this machine's data: `downstream.hit`, `restatement`, `survival.structuralSection`,
`compaction.postTokens`. A row with every optional field absent is complete.

`AnalyzedSession` = `session` + `reports`, one report per compaction, is what `analyze` returns.
Fixtures are `Session`s, committed with pre-labeled `items`; `SessionSource` returns a `Session`
and the UI calls `analyze` on it at load. Expected reports live in test files the analyzer
cannot see. Demo data and real data pass the same door (`src/adapters/session-source.ts`).
