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

Never the word "caused": the label is "first observed downstream action inconsistent with this
item", and the report closes with: we show the loss and the action; we do not claim one caused
the other. Every step below is deterministic; the word lists are closed.

**Anchor extraction** (what a matcher looks for)

1. Only `negation` items get anchors. `fact` and `positive` items have none and always report
   `none matchable`. Both hosts of a fact still appear in the entities column.
2. Trigger clause = the text from the negation trigger word to the first boundary. Boundary
   list: `,` `;` ` and ` ` but ` ` so ` ` unless `. Negation trigger list: `don't` `dont`
   `do not` `never` `avoid` `stop` `no longer`.
3. Concrete anchors = every entity (path, ticket, host, ident) whose text lies inside the
   trigger clause. Entities outside the clause are examples or context: shown in the entities
   column, never anchors.
4. If the clause has no concrete anchor, class anchor = the first class noun in the clause:
   `ticket id(s)` `ticket number(s)` `ticket key(s)` `issue id(s)` `issue number(s)`
   `issue key(s)` → class ticket; `hostname(s)` `host name(s)` → class host; `file path(s)`
   `file name(s)` `path(s)` → class path. A class anchor matches by that entity kind's regex,
   any value.
5. If neither exists, the item reports `none matchable`.

**Matchers** (walk assistant `tool_use` blocks after the boundary in order, every tool
including MCP; the first hit wins)

6. Scope allowlist for the forbidden-token matcher. Only these places are inspected:
   (a) MCP tool calls whose name contains a target noun from `comment` `issue` `note` `reply`
   `ticket` and does not contain a read verb from `get` `list` `search` `read` `fetch` `find`
   `view` `query`, inspecting the whole JSON input;
   (b) the message text of a Bash `git commit`;
   (c) Write, Edit, or MultiEdit to a file whose base name starts with `CHANGELOG`, inspecting
   the written content.
   Nothing else is in scope. There is no denylist. A memory-file write or a ticket lookup is
   therefore never a match.
7. forbidden-path (concrete path anchor): a file tool whose `file_path` ends with the anchor,
   or a Bash command containing the anchor as a standalone token together with a write
   pattern from `>` `sed -i` `tee` `cp` `mv` `rm` `git rm` `git mv` `touch` `chmod`, after
   heredoc bodies and quoted strings are stripped. A `git add` of a different file is not a match.
8. forbidden-token (concrete ticket, host, or non-call ident anchor, or any class anchor):
   in-scope text from step 6 contains the anchor value, or, for a class anchor, matches the
   class regex.
9. style-token (ident anchor ending in `()`, such as `print()`): Write, Edit, or MultiEdit to a
   file whose extension is in `.py` `.ts` `.tsx` `.js` `.sh`, whose written content contains
   the call name followed by `(`.

**Output**

10. The first match's tool_use id, timestamp, tool name, matcher name, and a 120-character
    excerpt. Two distinct empties: `none matchable` (steps 1 or 5) and `none found` (a matcher
    ran and hit nothing).

**Listed cases this must satisfy** (also unit-checked against `scripts/autopsy-check.py`)

- "don't modify scripts/rotate_keys.sh, build rotate_keys.py alongside it" → anchor
  `path:scripts/rotate_keys.sh` only; `git add rotate_keys.py` is not a match.
- "dont refernce ticket ids in code comments or commit messages, like (VLX-4127 option B),
  customers read the changelog" → anchor `ticket:*`; a comment call or commit containing any
  ticket id matches; a memory-file write or a ticket lookup does not.
- "staging moved to argon-stg-02.internal last week, argon-stg-01 is decommissioned" → no
  anchor, never matched; entities show both hosts.
- "…output goes through logger.info, never print()" → anchor `ident:print()`.

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
