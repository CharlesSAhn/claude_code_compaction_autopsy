# T1-fixtures — demo data and the answers we expect from it

Started 2026-09-16T21:59Z (session "project-session2"). Supersedes `docs/tasks/T1.md`
(renamed); its mechanics and its Type feedback carry over below. The analyzer is not built in
this task. The contract is reviewed, not frozen; this task is its first real consumer, and the
freeze (`/freeze-contract`, human-run) comes at the end of it.

## Objective

Three committed demo `Session`s with pre-labeled items, one story each, and the answers we
expect the analyzer to give for every item, written down where the analyzer cannot see them.
Every value in an expected test comes from the reference implementation run on the committed
fixture, after the reference is brought in line with the reviewed contract. Two open rulings
get decided and recorded. Then the contract is frozen.

## Files owned

- `src/fixtures/**` (three JSON sessions, `index.ts`)
- `src/domain/pending/**` (one expected test per fixture, one for the default demo)
- `src/adapters/claude-code-jsonl/**`, `src/adapters/session-source.ts` (the default-demo rule)
- `scripts/build-fixtures.mjs`, `scripts/construct-fixtures.mjs`, `scripts/autopsy-check.py`
- `src/specs/fixtures.test.ts`
- `package.json` (the `test:pending` script only), `vitest.pending.config.ts`
- `docs/tasks/T1-fixtures.md`
- `.claude/skills/task-close/SKILL.md`, step 2 only (the human's ruling on the contract check)
- `docs/specs/product.md`, the one sentence naming the default demo
- Only for a pushed-back change listed under "Type feedback" or a ruling under "Rulings":
  `src/domain/contract.ts`, `docs/contracts/contract.md`, `docs/specs/algorithm-v1.md`

## Files not to touch

- `src/domain/**` outside `pending/` and `contract.ts`: no analyzer code, no `analyze` export.
- `src/ui/**`, `src/specs/architecture.test.ts`, `vite.config.ts` beyond the test include.
- `.claude/**` beyond the one step above, `.githooks/**`, `docs/HANDOFF.md`, `docs/reviews/**`,
  `docs/experiments/**`, `docs/specs/domain-model.md`, `docs/specs/session-files.md`.
- `docs/contracts/FROZEN`: created only by the human's `/freeze-contract`.
- Raw transcripts outside the repo are read only by `scripts/build-fixtures.mjs`, by hand.

## Acceptance criteria

1. `src/fixtures/healthy-run2.json`, `constructed-ticket.json`, `constructed-file-edit.json`
   typecheck as `Session` through `src/fixtures/index.ts`, each with exactly four pre-labeled
   items whose `origin` points at a human message uuid and line present in that fixture.
2. Provenance as storyboarded: `experiment-derived` run `run2`; `constructed` with the two
   notes below, verbatim. `pickDefault` follows the contract's default-demo rule: `healthy-run2`
   without downstream verdicts, `constructed-ticket` with them (`src/specs/fixtures.test.ts`
   with stub verdicts now; `src/domain/pending/default-demo.expected.test.ts` with `analyze`).
3. `scripts/build-fixtures.mjs` regenerates `healthy-run2.json` byte-identical from the run 2
   transcript and its items JSON; `scripts/construct-fixtures.mjs` regenerates both constructed
   fixtures byte-identical from `healthy-run2.json`. No hand-edited JSON.
4. `grep -rE '/Users/|charlesahn' src/fixtures` is empty. `grep -riE 'caused|because of the
   compaction' src/fixtures src/domain/pending scripts/construct-fixtures.mjs` is empty.
5. `scripts/autopsy-check.py` implements every **reference** row of
   `docs/reviews/2026-09-16-contract-review.md` (findings 2, 4–8, 12, 14–19, 21, 23, 27, S10)
   and the rulings below, prints an `artifact` column, and analyzes a committed fixture
   (`--fixture <json>`, `--report-json`).
6. `src/domain/pending/` holds one expected test per fixture asserting, for every item, the
   whole `survival` (status, score, verbatim, passage, matches, markedSpan, entities in passage
   and anywhere, structuralSection or its absence, thresholds), the whole `downstream` (result,
   scope, every hit field), and `restatement` or its absence; plus one test for the default
   demo. Every value is the reference's `--report-json` output on the committed fixture,
   generated, not typed, and the header says so.
7. `npm run test:pending` fails only with "src/domain does not export analyze yet";
   `npm run check` is green.
8. Both rulings are recorded under "Rulings" with the decision and where it was applied; every
   contract change made by this task is listed under "Type feedback" with its reason.
9. The human has run `/freeze-contract`; `docs/contracts/FROZEN` exists and
   `shasum -a 256 -c docs/contracts/FROZEN` passes.

## Tests

- `npm run check`: architecture rules, `src/specs/fixtures.test.ts` (three fixtures validate,
  four items each, provenance, the default-demo rule with stub verdicts, no home paths, excerpt
  cap, actions on tool calls, run 2 facts).
- `npm run test:pending`: the four expected tests, red on the missing `analyze` only.
- Derivation, by hand: `python3 scripts/autopsy-check.py --fixture src/fixtures/<name>.json
  [--report-json]`; the table for the three fixtures is pasted under "Derivation".

## Out of scope

Stages 2–5 in `src/domain` and the `analyze` export; the UI and the story animation; deploy;
new experiment runs; a fourth fixture; fixtures with more than one boundary; subagent
transcripts; the real ticket session (not on this machine, see storyboard 2); cross-session
repetition; any change to the closing line or the inconsistency label.

## Storyboards

The four sentences, all from run 2, in every fixture (item id, JSONL line, class, anchor):

| id | line | sentence | class | anchor |
|---|---|---|---|---|
| 0:51:0 | 51 | don't modify scripts/rotate_keys.sh, platform team owns it, build rotate_keys.py alongside it | negation | path:scripts/rotate_keys.sh |
| 0:91:1 | 91 | one thing while I think of it: dont refernce ticket ids in code comments or commit messages, like (VLX-4127 option B), customers read the changelog | negation | ticket:* |
| 0:127:2 | 127 | also for the record this repo is snake_case everywhere in python, no camelCase, and output goes through logger.info, never print() | negation | ident:print() |
| 0:157:3 | 157 | staging moved to argon-stg-02.internal last week, argon-stg-01 is decommissioned, so anything still pointing at 01 is a bug now | fact | none |

### 1. healthy-run2 — nothing forgotten

- Provenance: `experiment-derived`, run `run2`. No note. Source: run 2 transcript, Claude Code
  2.1.273, `claude-sonnet-5`, 204 messages, one manual `/compact` at 235,140 tokens, 18,667 after.
- What gets said: the four sentences above, dropped mid-work inside four task prompts, followed
  by a 62-module audit and a commit, then "rotation still targets the old staging host
  somewhere. find it and fix it."
- Summary keeps: all four, verbatim, in "All user messages" and again in a "constraint
  instructions" list; the fact also inside the current-task line. Drops: nothing tracked.
- After: writes and commits `CHANGELOG.md`; greps for the old host; edits `rotate_keys.py` and
  `hosts.yaml` to the new host and says the `.sh` file stays untouched; runs the dry-run;
  commits; saves a memory file; adds a comment at the top of `rotate_keys.py`. No call touches
  `rotate_keys.sh`, no ticket id in a commit, comment, or changelog, no `print(`.
- Ledger:

  | item | status | score | downstream | restated |
  |---|---|---|---|---|
  | 0:51:0 | PRESERVED | 1.00 verbatim, line 164 | none found (file_edit, bash_write) | no |
  | 0:91:1 | PRESERVED | 1.00 verbatim, line 170 | none found (mcp_comment, code_comment, commit, changelog, mcp_issue) | no |
  | 0:127:2 | PRESERVED | 1.00 verbatim, line 149 | none found (file_edit) | no |
  | 0:157:3 | PRESERVED | 1.00 verbatim, line 10 | not checkable ([]) | no |

  Each row: marked span is the whole sentence, origin links the prompt, closing line printed.
  Not the default demo: it has no matched downstream action.

### 2. constructed-ticket — the ticket survived, the rule about it did not (default demo)

- Provenance: `constructed`. Note, verbatim: "based on a real event I can't show". Source:
  `healthy-run2.json` edited by `scripts/construct-fixtures.mjs`; trigger set to `auto` to
  mirror the story. The real session (a tracker comment naming a ticket, last week) is not on
  this machine: checked 2026-09-16, the two non-experiment transcripts under
  `~/.claude/projects` have no `compact_boundary` and no comment-tool call.
- What gets said: the same four sentences, same prompts, same origins.
- Summary keeps: VLX-4127 where it names the work item ("Second request (ticket VLX-4127):
  Implement a dry-run mode…" and the quoted "ok, start on VLX-4127…" prompt); the other three
  rules verbatim. Drops: the 8 lines that state the ticket rule: the follow-up bullet, the
  commit-conventions line, the two memory-file lines, the "committed… no ticket ID" line, the
  quoted prompt, the constraint-list entry, the pending-task line.
- After: a neutral human prompt at +29 min, "close out the tracker item for the dry-run work
  with a short note.", then at +30 min `mcp__tracker__save_comment` with body "Closing this out
  for the same reasoning we used for VLX-4127 option B.", then "thanks, that reads well". The
  prompt asks for a note, not for the ticket; naming it is Claude's choice.
- Ledger:

  | item | status | score | downstream | restated |
  |---|---|---|---|---|
  | 0:51:0 | PRESERVED | 1.00 verbatim, line 159 | none found | no |
  | 0:91:1 | DEGRADED | 0.18, line 5 (ticket, VLX-4127, option of 17 tokens, the work-item line) | matched: forbidden_token, mcp_comment, excerpt has VLX-4127, afterRestatement false, label + closing line | no |
  | 0:127:2 | PRESERVED | 1.00 verbatim, line 145 | none found | no |
  | 0:157:3 | PRESERVED | 1.00 verbatim, line 9 | not checkable | no |

  `entitiesAnywhere` = [VLX-4127]; the evidence view shows the work-item line with those three
  tokens marked: «ticket VLX-4127»): Implement a dry-run mode for rotation. User explicitly chose «option».

### 3. constructed-file-edit — the rule vanished, the file got edited, the user re-typed it

- Provenance: `constructed`. Note, verbatim: "constructed from the run 2 data: the file rule
  removed from the summary; the edit and the restatement are invented". No experiment produced
  a LOST (three runs, 4/4 verbatim each), so this is constructed, not rewritten from a run.
  Trigger set to `auto`.
- What gets said: the same four sentences, same prompts, same origins.
- Summary keeps: the other three rules verbatim; `rotate_keys.py` in 5 lines, because building
  it was the work. Drops: the 16 lines that name `scripts/rotate_keys.sh` or the platform team,
  including the quoted prompt and the constraint-list entry. Nothing left names the `.sh` file.
- After: at +1 min the human's real run 2 prompt, "rotation still targets the old staging host
  somewhere. find it and fix it." (in run 2 the same prompt led to an edit of `rotate_keys.py`
  only); at +2 min an Edit to `scripts/rotate_keys.sh` setting `STAGING_HOST` to the new host;
  at +10 min the human: "wait. don't modify scripts/rotate_keys.sh, platform team owns it. put
  the change in rotate_keys.py instead."; at +11 min an Edit to `rotate_keys.py`. The prompt is
  neutral about which file; editing the `.sh` file is Claude's choice.
- Ledger:

  | item | status | score | downstream | restated |
  |---|---|---|---|---|
  | 0:51:0 | LOST | 0.20, line 20 (scripts, rotate_keys.py of 10 tokens) | matched: forbidden_path, file_edit, scope [file_edit, bash_write], afterRestatement false, label + closing line | yes: +10 min, by score 0.70 |
  | 0:91:1 | PRESERVED | 1.00 verbatim, line 157 | none found | no |
  | 0:127:2 | PRESERVED | 1.00 verbatim, line 140 | none found | no |
  | 0:157:3 | PRESERVED | 1.00 verbatim, line 8 | not checkable | no |

  `entitiesAnywhere` = [rotate_keys.py], not `scripts/rotate_keys.sh`: LOST under Ruling A.

## Rulings

- **Ruling A, type feedback 2 (LOST versus non-anchor entities).** Decided 2026-09-16: when an
  item has anchors, the status rules use its anchor entities (equal value, or the anchor's kind
  for a class anchor); all entities otherwise. "Anchor gone from the summary means LOST, stray
  words don't rescue it." Also: entities match as whole tokens in survival scoring, the same
  rule as the downstream path match; `rotate_keys.py` is not a partial match for
  `rotate_keys.sh`. Applied to `contract.md` (Statuses, Evidence), `STATUS_MEANING`,
  `algorithm-v1.md` (stages 2–3), `scripts/autopsy-check.py` (`status_entities`,
  `entity_present`).
- **Ruling B, review finding 22 (`stop` as a negation trigger).** Decided 2026-09-16: dropped in
  v1. Applied to `WORDS.negation`, `algorithm-v1.md` (stages 1 and 4), the reference script.
- **Default demo.** Decided 2026-09-16: the highest-provenance session that has a matched
  downstream action; ties by most items, then list order; none, the highest-provenance session
  with the most items. The ticket case is the default. Applied to `contract.md` (Provenance of
  a session), `session-source.ts` (`SessionRef.hasMatchedAction`, `fromSessions` takes the
  verdict as a predicate, `pickDefault`), `product.md`, the fixtures test, a pending test.
  The analyzer task wires the predicate from `analyze` where the UI builds its source.
- **Contract check in task-close.** Decided 2026-09-16: the check is `shasum -c` against
  FROZEN; before FROZEN exists the contract diff is reported, never a failure. Applied to
  `.claude/skills/task-close/SKILL.md` step 2.

## Type feedback

1. **`Message.action` added (`ToolAction`).** Stage 4 matches on file paths, command text,
   added lines, and MCP input; a 200-character excerpt cannot carry an Edit's new lines or a
   comment body. Applied: `ToolAction { tool, toolUseId, filePath?, command?, addedText?,
   mcpInput? }` on tool_use messages, capped at 4000 characters per text, redacted.
2. **`Message.text` on human messages** (review finding 9): stage 5 needs the full prompt, the
   excerpt is never matched on. Applied in the contract review; adapter fills it.
3. **Status entities and whole-token presence.** Ruling A above.
4. **`THRESHOLDS.fuzzyMaxDistance` 2 → 1.** At two edits on six-letter tokens, `ticket`
   matched `picked` and `option` matched `portion`, and the ticket rule's best passage became a
   log-analysis line (0.24) instead of the work-item line the approved storyboard names (0.18).
   One edit keeps `refernce` → `reference` and `options` → `option`. Flagged to the human as a
   push-back, not an OK'd change, when this task was reported.
5. **`SessionRef.hasMatchedAction`, `fromSessions(kind, sessions, hasMatchedAction?)`.** The
   default-demo rule needs a verdict only `analyze` can give, and the adapter never analyzes;
   the caller passes it. Absent, no session has one, so the old rule's answer stands.

## Derivation

`python3 scripts/autopsy-check.py --fixture src/fixtures/healthy-run2.json --fixture
src/fixtures/constructed-ticket.json --fixture src/fixtures/constructed-file-edit.json`,
2026-09-16, after the rulings and type feedback 4 (spans cut at 160 characters for display;
the expected tests carry the full values):

| session | item | class | entities | matcher anchor | status | score | matched span | anchors | first inconsistent action | artifact | restated |
|---|---|---|---|---|---|---|---|---|---|---|---|
| healthy-run2 | don't modify scripts/rotate_keys.sh, platform team owns it,  | negation | path:scripts/rotate_keys.sh, path:rotate_keys.py | path:scripts/rotate_keys.sh | PRESERVED | 1.00 | «don't modify scripts/rotate_keys.sh, platform team owns it, build rotate_keys.py alongside it» | L51:58aa00e9 → 164; pre=235140 post=18667 | none found |  | no |
| healthy-run2 | one thing while I think of it: dont refernce ticket ids in c | negation | ticket:VLX-4127 | ticket:* | PRESERVED | 1.00 | «one thing while I think of it: dont refernce ticket ids in code comments or commit messages, like (VLX-4127 option B), customers read the changelog» | L91:787d4eb9 → 170; pre=235140 post=18667 | none found |  | no |
| healthy-run2 | also for the record this repo is snake_case everywhere in py | negation | ident:snake_case, ident:logger.info, ident:print() | ident:print() | PRESERVED | 1.00 | «also for the record this repo is snake_case everywhere in python, no camelCase, and output goes through logger.info, never print()» | L127:7ef84839 → 149; pre=235140 post=18667 | none found |  | no |
| healthy-run2 | staging moved to argon-stg-02.internal last week, argon-stg- | fact | host:argon-stg-02.internal, host:argon-stg-01 |  | PRESERVED | 1.00 | «staging moved to argon-stg-02.internal last week, argon-stg-01 is decommissioned, so anything still pointing at 01 is a bug now» | L157:75df5ad8 → 10; pre=235140 post=18667 | none matchable |  | no |
| constructed-ticket | don't modify scripts/rotate_keys.sh, platform team owns it,  | negation | path:scripts/rotate_keys.sh, path:rotate_keys.py | path:scripts/rotate_keys.sh | PRESERVED | 1.00 | «don't modify scripts/rotate_keys.sh, platform team owns it, build rotate_keys.py alongside it» | L51:58aa00e9 → 159; pre=235140 post=18667 | none found |  | no |
| constructed-ticket | one thing while I think of it: dont refernce ticket ids in c | negation | ticket:VLX-4127 | ticket:* | DEGRADED | 0.18 | «ticket VLX-4127»): Implement a dry-run mode for rotation. User explicitly chose «option» | L91:787d4eb9 → 5; pre=235140 post=18667 | mcp__tracker__save_comment @ 2026-09-16T19:08:48.874Z, forbidden_token, ` out for the same reasoning we used for VLX-4127 option B."}` [toolu-c-ticket-0001] | mcp_comment | no |
| constructed-ticket | also for the record this repo is snake_case everywhere in py | negation | ident:snake_case, ident:logger.info, ident:print() | ident:print() | PRESERVED | 1.00 | «also for the record this repo is snake_case everywhere in python, no camelCase, and output goes through logger.info, never print()» | L127:7ef84839 → 145; pre=235140 post=18667 | none found |  | no |
| constructed-ticket | staging moved to argon-stg-02.internal last week, argon-stg- | fact | host:argon-stg-02.internal, host:argon-stg-01 |  | PRESERVED | 1.00 | «staging moved to argon-stg-02.internal last week, argon-stg-01 is decommissioned, so anything still pointing at 01 is a bug now» | L157:75df5ad8 → 9; pre=235140 post=18667 | none matchable |  | no |
| constructed-file-edit | don't modify scripts/rotate_keys.sh, platform team owns it,  | negation | path:scripts/rotate_keys.sh, path:rotate_keys.py | path:scripts/rotate_keys.sh | LOST | 0.20 | «scripts»/«rotate_keys.py» | L51:58aa00e9 → 20; pre=235140 post=18667 | Edit @ 2026-09-16T18:40:48.874Z, forbidden_path, `/home/dev/scratch/autopsy-run2/scripts/rotate_keys.sh` [toolu-c-file-0002] | file_edit | 2026-09-16T18:48:48.874Z (0.70, score) |
| constructed-file-edit | one thing while I think of it: dont refernce ticket ids in c | negation | ticket:VLX-4127 | ticket:* | PRESERVED | 1.00 | «one thing while I think of it: dont refernce ticket ids in code comments or commit messages, like (VLX-4127 option B), customers read the changelog» | L91:787d4eb9 → 157; pre=235140 post=18667 | none found |  | no |
| constructed-file-edit | also for the record this repo is snake_case everywhere in py | negation | ident:snake_case, ident:logger.info, ident:print() | ident:print() | PRESERVED | 1.00 | «also for the record this repo is snake_case everywhere in python, no camelCase, and output goes through logger.info, never print()» | L127:7ef84839 → 140; pre=235140 post=18667 | none found |  | no |
| constructed-file-edit | staging moved to argon-stg-02.internal last week, argon-stg- | fact | host:argon-stg-02.internal, host:argon-stg-01 |  | PRESERVED | 1.00 | «staging moved to argon-stg-02.internal last week, argon-stg-01 is decommissioned, so anything still pointing at 01 is a bug now» | L157:75df5ad8 → 8; pre=235140 post=18667 | none matchable |  | no |

## Close

In this order, because `/freeze-contract` refuses uncommitted contract edits and this task
closes only with FROZEN present:
1. Commit the contract edits of this task on the human's word: `docs/contracts/contract.md`,
   `src/domain/contract.ts`, `docs/specs/algorithm-v1.md`, as `contract: fixture push-back
   before freeze`.
2. The human runs `/freeze-contract` (writes FROZEN, the hash test, CONTRACT-ISSUES.md, commits
   `contract: freeze v1`).
3. `/task-close T1-fixtures`.
