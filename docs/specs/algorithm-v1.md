# Algorithm v1 — deterministic, no LLM

Five numbered stages. Every call is reproducible from the transcript alone, and every call keeps
the anchors a human needs to check it. Reference implementation: `scripts/autopsy-check.py`.
Validated 2026-09-16 on three scratch runs; see `docs/experiments/findings.md`.

## Stage 1 — Candidate items from human messages

Input records: `type == "user"`, not `isMeta`, not `isSidechain`, content is a string or a
text block without a `tool_result`, text does not start with `<command-name>` or
`<local-command`. Only records before the first `compact_boundary` produce items.

Entities are extracted before splitting and are never cut by the splitter:
- path: `[\w./-]*[\w-]+\.(sh|py|ts|tsx|js|md|yaml|yml|json|txt)` or `(src|scripts|docs|config|logs)/…`
- ticket: `[A-Z]{2,6}-\d{2,6}`
- host: `[a-z0-9-]+\.(internal|local|com|io|net)`, plus bare tokens sharing a found host's
  hyphenated stem and digits (`argon-stg-01` next to `argon-stg-02.internal`)
- ident: dotted or underscored identifiers and `name()` calls

Sentences split on `.`, `!`, `?` only when followed by whitespace or end of text, and on bullet
or numbered markers only at line start. A sentence of 12 to 300 characters becomes an item if it
matches one class:
- negation: `don't | dont | do not | never | avoid | stop | no longer`
- positive: `always | only | must | keep | use` and at least one entity
- fact: `moved to | decommissioned | is now | is gone | renamed | deprecated` and at least one entity

Item fields: text, class, entities with kinds, message uuid, timestamp, JSONL line. Duplicate
normalized text keeps the first occurrence.

## Stage 2 — Survival score against the summary

Normalize both sides: lowercase, strip backticks, straight and curly quotes, apostrophes
(so `dont` equals `don't`), markdown markers, collapse whitespace.

1. Verbatim: normalized item is a substring of the normalized summary → score 1.00.
2. Structural first: if the summary has a heading matching `constraint | rule | instruction |
   feedback | standing`, score against that section's lines first, then the whole summary; keep
   the overall best passage.
3. Passage score = matched item tokens ÷ item tokens. Tokens `[a-z0-9_.\-()]+` of length ≥ 3,
   stopwords removed. A token matches exactly, or by Levenshtein distance ≤ 2 for non-entity
   tokens of length ≥ 6 (`refernce` matches `reference`). Entity tokens match exactly only.

Classes:
- PRESERVED: score ≥ 0.75 and every entity present in the best passage
- DEGRADED: not preserved, and score ≥ 0.35 or any entity present anywhere in the summary
  (the shape of the original story: the ticket survived as a work item, the rule did not)
- LOST: otherwise

Paraphrase beyond token overlap lands in DEGRADED and the report says the score is overlap-based.

## Stage 3 — Evidence kept per call

Item text, message uuid, timestamp, JSONL line. Boundary uuid, `preTokens`, `postTokens`.
Matched span: the smallest contiguous span of the best passage covering all matched tokens, with
matched phrases marked `«…»` and fuzzy matches `«~…»`. Summary line index. Matched tokens with
fuzzy flag and distance. Entities found in the best passage and anywhere in the summary. The
thresholds used. Everything is greppable in the transcript.

## Stage 4 — First observed downstream action inconsistent with a lost item

Walk assistant `tool_use` blocks after the boundary in order, every tool including MCP. Never
the word "caused": the label is "first observed downstream action inconsistent with this item",
and the report closes with: we show the loss and the action; we do not claim one caused the other.

Matchers by item class and entity:
- forbidden path (negation + path): a file tool whose `file_path` is that exact path, or a Bash
  command naming the exact path as a standalone token together with a write pattern. Heredoc
  bodies and quoted strings are stripped from Bash commands before matching.
- forbidden token (negation + ticket or ident, sentence mentions comment, commit, message, or
  changelog) and environment fact (fact + host, matching an added line that reintroduces the
  retired host): **scope is an allowlist**. Only these three places are inspected:
  (a) MCP tool calls whose name contains `comment`, `issue`, `note`, or `reply`;
  (b) the message text of a Bash `git commit`;
  (c) Write, Edit, or MultiEdit to a file whose name starts with `CHANGELOG`.
  Nothing else is in scope. There is no denylist.
- style token (negation + ident such as `print()`): Write/Edit content containing the token.

Matcher entities come only from the clause that starts at the trigger word, up to the next
comma, "and", or "but", so a second path in the same sentence does not leak in.

Output: the first match's tool_use id, timestamp, tool name, matcher name, 120-char excerpt.
Two distinct empties: `none matchable` when no matcher applies to the item's class or entity;
`none found` when a matcher ran and hit nothing.

## Stage 5 — Restatement

After the boundary, a human sentence with stage-2 score ≥ 0.6 against the item, or containing
all its entities plus a negation word, is a restatement, recorded with uuid and timestamp.

What it proves: the rule was back in context from that point, so later actions cannot be
attributed to the compaction. What it does not prove: that the summary lacked the rule, or that
the loss prompted the retyping.

## Reliable fields, for the contract

On this machine's data (three scratch runs, one probe, 2026-09-16), these fields populated
reliably: status, score, closest passage (matched span), provenance (anchors, entities).

These never fired here and are optional fields: first inconsistent action, restatement, and the
DEGRADED class. They are populated by fixtures built from the user's real-session table, produced
by running `scripts/autopsy-check.py --redact` on the other machine and bringing back only the
table. A row where an optional field is empty is a valid, complete row.
