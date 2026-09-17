# Contract v2

Types: `src/domain/contract.ts`. This page: their meaning. Procedure for computing the values:
`docs/specs/algorithm-v1.md` (stages 1–5), referenced, not repeated. Reviewed 2026-09-16
(`docs/reviews/2026-09-16-contract-review.md`), frozen as v1 at the T1-fixtures close, refrozen
as v2 on 2026-09-16 with two changes logged in `docs/CONTRACT-ISSUES.md`: a downstream
forbidden-token match is whole-token, the same rule as survival; regions are half-open windows
both ways. Freezing writes `docs/contracts/FROZEN` with the hashes of this file and the types
file.

Inside the freeze, because the fixtures' expected answers depend on them: every list in `WORDS`,
every number in `THRESHOLDS` and `LIMITS`, every regex source in `PATTERNS`, the two fixed
strings, and the definitions on this page. Changing any of them is a contract change: a refreeze
with a new version, an entry in `docs/CONTRACT-ISSUES.md`, and the expected tests re-derived
from the reference implementation.

## Information item

One item per pre-boundary human sentence that matches a class. Identity is the sentence and the
message it came from (`origin`); `id` is `<compactionIndex>:<origin.line>:<n>`. Class precedence
when a sentence matches several: negation, then positive, then fact. Apostrophes are normalized
(curly to straight) before trigger matching, so `don’t` is a negation. A sentence is
`LIMITS.itemMinChars` to `LIMITS.itemMaxChars` characters. Entities come from `PATTERNS`;
an identifier needs at least two characters on each side of its dot, so `e.g` is not one.

Fixtures carry `items` including `anchors`. When a session carries items, `analyze` trusts them
and never recomputes text, class, entities, or anchors; stages 2–5 run. When it carries none,
stage 1 runs first. Extraction and anchor extraction are therefore the stages the demo skips.

## Statuses

`PRESERVED`, `DEGRADED`, `LOST`, meanings in `STATUS_MEANING`:
- PRESERVED: score ≥ `thresholds.preserved` (0.75) and every status entity of the item is in
  the best passage.
- DEGRADED: not preserved, and score ≥ `thresholds.degraded` (0.35) or any status entity of the
  item appears anywhere in the summary. Partial loss; the common case in real data.
- LOST: no passage reaches the degraded threshold and no status entity appears anywhere in the
  summary.

The status entities of an item are its anchor entities when it has anchors: the entities an
anchor names, by equal value, or by kind for a class anchor (`*`). An item with no anchors uses
every entity. The rule is about what it forbids; a non-anchor entity surviving elsewhere in the
summary (the file that was built, next to the file that was off-limits) does not rescue it
(ruling 2026-09-16, T1-fixtures). An entity is present in a passage or in the summary only as a
whole token: its normalized value equals a token, or, for a path, a token ends with `/` + the
value; the same rule as the downstream path match. `rotate_keys.py` is never a partial match for
`rotate_keys.sh`. A status is a statement about the summary text only.

## Survival scoring

- Normalization, both sides: lowercase; remove backticks, straight and curly quotes,
  apostrophes, and the characters in `WORDS.markdownMarkers` (`*`, `#`, `>`, backtick); keep
  underscores; collapse whitespace. `dont` equals `don't`; `rotate_keys.py` stays itself.
- Tokens: `PATTERNS.token` (`[a-z0-9_.-]+` with an optional trailing `()`), length ≥
  `LIMITS.tokenMinChars`, stopwords removed. Leading or trailing punctuation such as `(` is
  never part of a token, so `(VLX-4127` tokenizes as `vlx-4127`.
- `verbatim` true when the normalized item is a substring of the normalized summary; score 1.
  `matches` is then one entry covering the whole item in the passage, `fuzzy` false.
- Otherwise `score` is matched item tokens over item tokens against the best passage. A
  passage is one summary line, or, for a verbatim match that spans consecutive lines, those
  lines joined with a space; `passage.lineIndex` is the first line. A constraints-like section
  is scored first: a heading is a line matching `PATTERNS.heading` whose text contains a word
  from `WORDS.structuralHeadings`; the section runs to the next heading; `structuralSection` is
  the heading text whenever the best passage lies in such a section, verbatim or not.
- Typos and light paraphrase: non-entity tokens of at least `fuzzyMinTokenLength` (6) match at
  Levenshtein distance ≤ `fuzzyMaxDistance` (1): one edit, so `refernce` matches `reference`
  and `options` matches `option`, while `ticket` does not match `picked` (the first fixture
  scored a log-analysis line above the work-item line at distance 2). Entity tokens match
  exactly. Heavy paraphrase lands in DEGRADED. The tool never says "meaning preserved"; it reports score and matches.

## Evidence

- `passage.text` is the raw summary text, not normalized. `matches` are character offsets into
  it, with the raw token text, fuzzy flag, and distance; they are the source of truth.
  `markedSpan` is derived from them: the smallest span covering all matches, `«…»` for exact,
  `«~…»` for fuzzy. `entitiesInPassage` and `entitiesAnywhere` hold the item's entity values as
  written in the item, every entity, found as whole tokens (the rule under Statuses). Every
  value is checkable by hand in the fixture: the raw strings appear there.
- Provenance of the item: `origin` = user message uuid, timestamp, JSONL line. Nothing else in
  v1. Survival outside the summary (auto-memory, preserved segment) is not represented; see
  `docs/specs/session-files.md`.
- Restatement: a human sentence after the boundary, from `Message.text`, scoring ≥
  `thresholds.restated` (0.6) against the item (`by: "score"`), or containing all its entities
  plus a negation word (`by: "entities"`, score still recorded). Proves the rule was back in
  context from then on. Proves nothing about the summary or about why the user retyped it.

## Provenance of a session

`observed-sanitized` (real session file, redacted), `experiment-derived` (scratch run, `run`
names it), `constructed` (derived from another session by a re-runnable script, `note` is one
line shown in the UI). Provenance ranks in that order, observed-sanitized highest. The default
demo is the highest-ranked session that has a downstream action, that is, at least one item
whose `downstream.result` is `matched` after `analyze`; ties go to the most pre-labeled items,
then to list order. When no session has one, the highest-ranked session with the most items
(a session with no items counts as zero). A constructed session is the default only by this
rule, never by preference.

## Regions

"Before" and "after" a boundary are by timestamp: ISO strings compare lexicographically (one
format, millisecond precision, as the adapter emits it), and the boundary record has its own
timestamp. Regions are half-open windows (v2): before compaction `i` = messages with `ts` not
less than the previous boundary's and less than `compactions[i].ts`; after = messages with `ts`
not less than `compactions[i].ts` and less than the next boundary's. A message at exactly a
boundary's `ts` is after that boundary, the after window of `i` is the before window of `i + 1`,
and no message is in no region. The reference implementation handles the first boundary only;
the contract covers a list.

## Downstream action

- Any assistant `tool_use` after the boundary, MCP calls included. Not only file edits.
- What stage 4 sees is `Message.action` (`ToolAction`): tool, tool_use id, and, as present,
  `filePath`, `command`, `addedText`, `mcpInput`. Every matcher that inspects a file edit
  inspects `addedText` only: a Write's content, or an Edit's new lines not present in its old
  string. An unchanged line is never a match, for any matcher. Texts are capped at
  `LIMITS.actionText` and redacted. The `excerpt` is never matched on.
- A file tool is one of `WORDS.fileTools`. A path matches when `filePath` equals the anchor or
  ends with `/` + anchor, never on a longer suffix. A Bash write pattern counts only when it
  applies to the anchor: the anchor appears as a standalone token and a pattern from
  `WORDS.writePatterns` is followed by it (`> path`, `>> path`, `sed -i … path`, `tee path`,
  `cp|mv|rm|touch|chmod … path`, `git rm|mv path`); `cat path 2>/dev/null` or running the
  script is not a write.
- A forbidden-token match is whole-token (v2), the same rule as entity presence under
  Statuses: the in-scope text and the anchor are normalized, and the anchor must be a token of
  the text, not preceded or followed by a word character, `-`, or a dotted continuation.
  `VLX-41271` and `XVLX-4127` are not `VLX-4127`; `vlx-4127` and `(VLX-4127)` are. A class
  anchor matches its `PATTERNS` regex as before.
- Checks, in order (algorithm stage 4): only negation items get anchors; anchors are concrete
  entities in the trigger clause, else one class anchor; the forbidden-token scope is the union
  of what the sentence's scope nouns map to (`WORDS.scopeNouns`, whole words, singular or
  plural), or all of `WORDS.tokenScopeKinds` when there is no noun; then walk the tool calls in
  order and take the first call any matcher hits.
- `scope` records the kinds inspected: the forbidden-token kinds above; `file_edit` and
  `bash_write` for a path anchor; `file_edit` for a style anchor; `[]` when `none_matchable`.
- MCP read verbs are matched as whole name parts: the tool name split on `__`, `_`, and `-`;
  a call is out of scope when any part equals a word in `WORDS.mcpReadVerbs`.
  `add_comment_to_thread` is in scope; `get_issue` is not.
- Style token: the call name must start at a word boundary, so `blueprint(` is not `print(`.
- `hit.artifact` is the first kind in `WORDS.artifactPrecedence` under which the call was in
  scope. `hit.excerpt` is at most `LIMITS.hitExcerpt` characters around the match.
- `result`: `matched` (with `hit`), `none_found` (a matcher ran over the in-scope calls,
  possibly zero of them, and hit nothing), `none_matchable` (no anchor). Both empties are
  results, shown as such. The UI string for `none_matchable` is "not checkable".
- `hit.afterRestatement` true means the rule had been re-typed before the action. The tool
  draws no conclusion from it either way.

## Inconsistency

`INCONSISTENT_LABEL` = "first observed downstream action inconsistent with this item".
Status-neutral: it applies to PRESERVED and DEGRADED items as much as to LOST ones, whenever
`result` is `matched`. Quoted only here and in the types file; everything else refers to it.

## The three claims

- LOST: a status, defined above, about the summary text.
- INCONSISTENT: the label above, about one later action.
- CAUSED: never asserted. No type, field, flag, or switch. `CLOSING_LINE` = "We show the loss
  and the action. We do not claim one caused the other." is printed with every downstream
  result. No sentence in the docs, fixtures, tests, or UI may say or imply that a status or a
  restatement makes attribution possible or impossible; the tool reports sequence only.

## Result shape

`Report` mirrors the real-data check table. Required on every `ItemReport`: `item` (id, text,
class, entities, anchors, origin, compactionIndex), `survival` (status, score, verbatim,
passage, matches, markedSpan, entities found, thresholds), `downstream.result`,
`downstream.scope`. Optional, never observed on this machine's data: `downstream.hit`,
`restatement`, `survival.structuralSection`, `compaction.postTokens`. A row with every optional
field absent is complete.

`AnalyzedSession` = `session` + `reports`, one report per compaction, is what `analyze` returns.
Fixtures are `Session`s, committed with pre-labeled `items`; `SessionSource` returns a `Session`
and the UI calls `analyze` on it at load. Expected reports live in test files the analyzer
cannot see. Demo data and real data pass the same door (`src/adapters/session-source.ts`).
