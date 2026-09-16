# Algorithm v1 — deterministic, no LLM

Five numbered stages, closed word lists, and what they reliably produce. Reference
implementation: `scripts/autopsy-check.py` (stdlib Python, prints one table). Word lists and
thresholds are also exported from `src/domain/contract.ts` as `WORDS` and `THRESHOLDS`; the two
must agree. Transcript record shapes are in `session-files.md`. Experiment method and cost are in
`docs/experiments/findings.md`. Outcomes and the real-data check live here and nowhere else.

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

6. Scope of the forbidden-token matcher is decided by the scope nouns in the sentence, through
   this closed map. A rule's scope is the union of what its nouns map to. A sentence with no
   scope noun gets the full allowlist, every kind below. Nothing outside the map is ever in
   scope; there is no denylist.

   | Scope noun in the sentence | Artifact kind inspected |
   |---|---|
   | `comment(s)` | MCP calls whose name contains `comment`, `issue`, or `note`, whole JSON input; and added lines in code-file edits that start with the file type's comment marker |
   | `commit message(s)` | the message text of a Bash `git commit` |
   | `changelog(s)` | Write, Edit, or MultiEdit to a file whose base name starts with `CHANGELOG`, written content |
   | `PR description(s)`, `pull request description(s)` | the text after `gh pr create` or `gh pr edit` in a Bash command |
   | `ticket(s)`, `issue(s)` | MCP calls whose name contains `issue` or `ticket`, whole JSON input |

   MCP calls whose name contains a read verb from `get` `list` `search` `read` `fetch` `find`
   `view` `query` are never in scope. Code-file types and comment markers, closed:
   `.py` `.sh` → `#`; `.ts` `.tsx` `.js` → `//` `/*` `*`; `.html` `.htm` → `<!--`. Added lines
   are the whole content of a Write, or the lines of an Edit's `new_string` not present in its
   `old_string`. Markdown, YAML, and memory files are not code files, so a memory-file write is
   never a match. A ticket id in a non-comment code line is not a match.
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
  customers read the changelog" → anchor `ticket:*`; scope nouns are comments, commit messages,
  changelog, ticket. A Linear comment call, an added `# see VLX-4127` line in a `.py` file, a
  commit message, or a CHANGELOG edit containing any ticket id matches. A ticket id in a
  non-comment code line, an unchanged existing comment line, a memory-file write, a ticket
  lookup (`get_issue`), or a `gh pr create` body (noun absent) does not.
- "never mention VLX-4127" → anchor `ticket:VLX-4127`; no scope noun, so the full allowlist
  applies and a `gh pr create` body containing it matches.
- "staging moved to argon-stg-02.internal last week, argon-stg-01 is decommissioned" → no
  anchor, never matched; entities show both hosts.
- "…output goes through logger.info, never print()" → anchor `ident:print()`.

## Stage 5 — Restatement

After the boundary, a human sentence with stage-2 score ≥ 0.6 against the item, or containing
all its entities plus a negation word, is a restatement, recorded with uuid and timestamp.

What it proves: the rule was back in context from that point, so later actions cannot be
attributed to the compaction. What it does not prove: that the summary lacked the rule, or that
the loss prompted the retyping.

## Validation on 2026-09-16, Claude Code 2.1.273

### Experiment runs, banked outcome

Three scratch sessions from the generated "argon" service (all names invented), four constraints
dropped casually mid-work (environment fact, don't-touch file, ticket rule with a typo, style
rule), then a plain `/compact`, then three follow-ups that tempt a break.

| Run | Model | Rules came from | Rules at | preTokens | Output after rules | Constraints in summary | Follow-ups |
|---|---|---|---|---|---|---|---|
| 1 | 1M-window model | user prompts | ~584k–640k | 1,057,278 | ~300k | 4/4 verbatim, full sentences | all honored |
| 2 | mid-size model | user prompts | ~42k–68k | 235,140 | ~165k | 4/4 verbatim, plus a "standing constraints" list; one rule also saved to auto-memory | all honored |
| 3 | mid-size model | a handover NOTES.md file the model read; prompts never stated them | ~5k–43k | 294,678 | ~250k | 4/4 verbatim, quoted as file content | all honored |

Banked outcome: the story did not reproduce. No constraint was paraphrased, degraded, or lost.
Run 1 or run 2 is the healthy fixture (run 3 has zero items in the human's messages). The loss
demo is constructed from the same argon data and labeled constructed.

### Real-data check, final table

`scripts/autopsy-check.py` over the three runs and a probe session, after the stage-4 fixes
(entity-first splitting, clause anchors, class anchors, scope-noun map). Run 3 and the probe
produced no rows. Anchors are `JSONL line:uuid8 → summary line index; pre= post=` tokens.

| session | item | class | entities | matcher anchor | status | score | matched span | anchors | first inconsistent action | restated |
|---|---|---|---|---|---|---|---|---|---|---|
| run1 | Don't skip any | negation | | | PRESERVED | 1.00 | «Don't skip any» | L4:c172718e → 115; pre=1057278 post=280195 | none matchable | no |
| run1 | staging moved to argon-stg-02.internal last week, argon-stg-01 is decommissioned, so anything still pointing at 01 is a bug now | fact | host:argon-stg-02.internal, host:argon-stg-01 | | PRESERVED | 1.00 | «staging moved to argon-stg-02.internal … is a bug now» | L187:70ad90f6 → 116; pre=1057278 post=280195 | none matchable | no |
| run1 | don't modify scripts/rotate_keys.sh, platform team owns it, build rotate_keys.py alongside it | negation | path:scripts/rotate_keys.sh, path:rotate_keys.py | path:scripts/rotate_keys.sh | PRESERVED | 1.00 | «don't modify scripts/rotate_keys.sh … alongside it» | L266:b1c3d1bb → 7; pre=1057278 post=280195 | none found | no |
| run1 | one thing while I think of it: dont refernce ticket ids in code comments or commit messages, like (VLX-4127 option B), customers read the changelog | negation | ticket:VLX-4127 | ticket:* | PRESERVED | 1.00 | «one thing while I think of it: dont refernce ticket ids … read the changelog» | L401:f3a52485 → 118; pre=1057278 post=280195 | none found | no |
| run1 | also for the record this repo is snake_case everywhere in python, no camelCase, and output goes through logger.info, never print() | negation | ident:snake_case, ident:logger.info, ident:print() | ident:print() | PRESERVED | 1.00 | «also for the record this repo is snake_case … never print()» | L441:12d66d2f → 9; pre=1057278 post=280195 | none found | no |
| run2 | don't modify scripts/rotate_keys.sh, platform team owns it, build rotate_keys.py alongside it | negation | path:scripts/rotate_keys.sh, path:rotate_keys.py | path:scripts/rotate_keys.sh | PRESERVED | 1.00 | «don't modify scripts/rotate_keys.sh … alongside it» | L51:58aa00e9 → 164; pre=235140 post=18667 | none found | no |
| run2 | one thing while I think of it: dont refernce ticket ids in code comments or commit messages, like (VLX-4127 option B), customers read the changelog | negation | ticket:VLX-4127 | ticket:* | PRESERVED | 1.00 | «one thing while I think of it: dont refernce ticket ids … read the changelog» | L91:787d4eb9 → 170; pre=235140 post=18667 | none found | no |
| run2 | also for the record this repo is snake_case everywhere in python, no camelCase, and output goes through logger.info, never print() | negation | ident:snake_case, ident:logger.info, ident:print() | ident:print() | PRESERVED | 1.00 | «also for the record this repo is snake_case … never print()» | L127:7ef84839 → 149; pre=235140 post=18667 | none found | no |
| run2 | staging moved to argon-stg-02.internal last week, argon-stg-01 is decommissioned, so anything still pointing at 01 is a bug now | fact | host:argon-stg-02.internal, host:argon-stg-01 | | PRESERVED | 1.00 | «staging moved to argon-stg-02.internal … is a bug now» | L157:75df5ad8 → 10; pre=235140 post=18667 | none matchable | no |

Every score is 1.00 because the summaries quote user prompts verbatim; the fuzzy and section
paths never ran on this data. Every "none" was verified against an independent listing of all
post-boundary tool calls: the only ticket-id write was a memory file (out of scope), nothing
edited `rotate_keys.sh`, nothing wrote `print(`. Zero false positives.

### Reliable fields, for the contract

Reliably populated on this machine's data: status, score, verbatim, matched span, entities,
anchors, provenance (message line, uuid, summary line, preTokens, postTokens).

Never fired here and therefore optional in the contract: first inconsistent action, restatement,
and the DEGRADED class. They are exercised only by the constructed loss fixture. "Not checkable"
(`none_matchable`) and "none found" are the normal results and are shown as such, never hidden.
A row with every optional field absent is complete.

### Version note

The version that quoted every rule into its summary is Claude Code 2.1.273, the version in these
transcripts. Compaction behavior changes across releases; the losses that motivated the tool
happened on another version and are not in any transcript we have. Every report shows the
session's version.
