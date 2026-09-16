# Contract v1 — semantics

Types live in `src/domain/contract.ts`. This document fixes what the types mean. Both files are
frozen together by `docs/contracts/FROZEN` once the fixtures have pushed back on the types.
Procedure (how the values are computed) is `docs/specs/algorithm-v1.md`; this document is what
a consumer may rely on.

## Session

- `provenance.kind` is one of `observed-sanitized` (from a real session file, redacted),
  `experiment-derived` (from a scratch run; `run` names it), `constructed` (built by hand;
  `note` is one line, shown in the UI, for example "based on a real event I can't show").
- The default demo session is chosen by provenance: an `observed-sanitized` or
  `experiment-derived` session with the most items. A `constructed` session is never the default.
- `messages` is a sanitized list of human prompts, assistant messages, tool calls, and tool
  results with uuid, timestamp, JSONL line, tool name, and an excerpt of at most 200 characters.
  It exists for the "what happened afterward" timeline. It is never the raw transcript.
- `compactions` is the list of boundaries in file order, each with its full summary as lines.
  Items and downstream evidence are scoped to the boundary they sit between, by index.

## Item

- One item per pre-boundary human sentence that matches a class. Identity is the sentence and
  the message it came from (`origin`). A later occurrence of the same sentence is not a new
  item; it is a restatement link.
- `class`: `negation`, `positive`, or `fact`, by the closed trigger lists in `WORDS`.
- `entities`: every path, ticket, host, or ident in the sentence, extracted before splitting.
- `anchors`: what the downstream matcher looks for. Only `negation` items have anchors:
  concrete entities inside the trigger clause, else one class anchor (`value: "*"`) from the
  class-noun list. `fact` and `positive` items have none.
- `origin` is the provenance of the item: the user message, nothing else in v1.

## Survival

- `status` is one of `PRESERVED`, `DEGRADED`, `LOST`, with the meanings in `STATUS_MEANING`.
  Partial loss (`DEGRADED`) is the common case in real data: the summary keeps an entity or a
  partial passage but not the constraint.
- `score` is token overlap of the item against the best summary passage, 0 to 1. `verbatim` is
  true when the normalized item is a substring of the normalized summary; the score is then 1.
- Paraphrase: when the summary does not quote the item, the score is still overlap, computed
  against the best passage, with a constraints-like section (`structuralSection`, headings in
  `WORDS.structuralHeadings`) scored first when the summary has one. Non-entity tokens of
  `fuzzyMinTokenLength` or more match at Levenshtein distance up to `fuzzyMaxDistance`; entity
  tokens match exactly. Heavy paraphrase therefore lands in `DEGRADED`. The tool never claims
  "meaning preserved"; it reports the score and the matches.
- Evidence: `passage` (summary line index and text), `matches` as character offsets into the
  passage with fuzzy flag and distance (the source of truth), `markedSpan` as the «…» rendering
  derived from `matches`, entities found in the passage and anywhere in the summary, and the
  `thresholds` used.

## Downstream

- A downstream action is any assistant `tool_use` after the boundary, MCP calls included. Not
  only file edits.
- `result`: `matched` (a matcher hit, `hit` present), `none_found` (a matcher ran over the
  in-scope actions and hit nothing), `none_matchable` (the item has no anchor, so no matcher
  applies). The two empties are results, not absences; the UI shows them as such.
- `scope`: the artifact kinds the forbidden-token matcher inspected, from the scope-noun map in
  `WORDS.scopeNouns`; a sentence with no scope noun gets every kind. `file_edit` and `bash_write`
  are the kinds the path and style matchers produce.
- `hit.afterRestatement` is true when the hit comes after a restatement; such a hit cannot be
  attributed to the compaction at all.

## Restatement

- The user re-typing the rule after the boundary: a human sentence scoring at least
  `thresholds.restated` against the item, or containing all its entities plus a negation word.
- It proves the rule was back in context from that point. It does not prove the summary lacked
  it, and it does not prove the loss prompted the retyping.

## The three claims, fixed wording

- **LOST** is a status with the meaning in `STATUS_MEANING.LOST`. It is a statement about the
  summary text only.
- **INCONSISTENT**: `INCONSISTENT_LABEL` = "first observed downstream action inconsistent with
  this item". Status-neutral: it applies to `PRESERVED` and `DEGRADED` items as much as to
  `LOST` ones, whenever `result` is `matched`. The string is defined only in the contract;
  everything else refers to `INCONSISTENT_LABEL`.
- **CAUSED**: the tool never asserts it. There is no type, field, flag, or switch for causation.
  Every downstream result is printed with `CLOSING_LINE` = "We show the loss and the action. We
  do not claim one caused the other."

## Result shape

`Report` mirrors the table from the real-data check. Required on every `ItemReport`: `item`
(text, class, entities, anchors, origin), `survival` (status, score, passage, matches),
`downstream.result` and `downstream.scope`. Optional, because they never fired on this machine's
data: `downstream.hit`, `restatement`, `compaction.postTokens`, `survival.structuralSection`.
A report row with every optional field absent is complete.

## Thresholds and word lists

`THRESHOLDS`: preserved 0.75, degraded 0.35, restated 0.6, fuzzy distance 2, fuzzy minimum token
length 6. `WORDS` holds every closed list: negation, positive, and fact triggers; clause
boundaries; class nouns; scope nouns to artifact kinds; structural headings; MCP read verbs and
name parts; Bash write patterns; code-file types with comment markers; style-token file types;
stopwords. Changing any of them is a contract change and a refreeze.
