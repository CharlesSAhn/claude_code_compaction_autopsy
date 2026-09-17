# Compaction Autopsy

Shows what Claude Code knew before a context compaction, what the summary kept, what was lost
or weakened, where each item came from, and what happened after. The analysis is deterministic:
token overlap and whole-token matching over a Claude Code JSONL transcript, no LLM calls. It is
a static React app (Vite + TypeScript) with three demo sessions bundled into the build. Nothing
is fetched at runtime and nothing is uploaded.

## Screenshots

![Story view of the ticket case: four ribbons cross the compaction band, one DEGRADED ribbon links to a later mcp__tracker__save_comment call](docs/images/story-ticket-case.png)

The story view of the ticket case. Each ribbon is one item from before the compaction. The
DEGRADED one, "dont reference ticket ids in code comments or commit messages", links to the
first later action that is inconsistent with it.

![Evidence drawer for the DEGRADED item: the summary passage with the ticket id marked, the thresholds, the after block, and the full summary with line 6 highlighted](docs/images/evidence-drawer-degraded.png)

The evidence drawer for that item: the summary passage with its marks, the thresholds, the
downstream action with the closing line, and the full summary with the matched line
highlighted.

## What the analysis does and doesn't do

Five stages, in plain words:

1. **Items.** Sentences a user typed before the compaction that read as a rule or a fact. In the
   demo these are pre-labeled in the fixtures, anchors included. Extraction is the one stage the
   URL does not exercise; it is specified in `docs/specs/algorithm-v1.md` and covered by tests.
2. **Survival.** Each item is scored by token overlap against the best line of the compaction
   summary. The status is PRESERVED, DEGRADED, or LOST. It is a statement about the summary text
   only.
3. **Evidence.** The matched summary passage with the matched phrases marked, the entities found
   in it and anywhere in the summary, and the item's origin: message uuid, time, JSONL line.
4. **Downstream.** The first later tool call that goes against an item's anchor: a path edited, a
   forbidden token written, a style call made. The result is one of three: matched (the trace
   shows the contract's `INCONSISTENT_LABEL`; the ledger's after column reads INCONSISTENT
   ACTION with the tool and time), "none found" (the tool calls after the compaction were walked,
   nothing hit; the ledger reads NONE FOUND), or "not checkable" (the item has no anchor to
   check; the ledger reads NOT CHECKABLE).
5. **Restatement.** Whether the user typed the rule again after the compaction, and whether the
   matched action came before or after that.

Stages 2 to 5 run in the browser on every load. The expected results live in test files the
analyzer cannot see.

What it does not do:

- It does not read meaning. Token overlap cannot tell an inverted rule from a preserved one: a
  summary that says the opposite of the rule with the same words scores as PRESERVED.
- It tracks items per compaction only. A rule stated before the first compaction is not tracked
  across a second one.
- It does not assert a causal link. The tool shows the loss and the action, in order, and every
  downstream result carries the contract's `CLOSING_LINE`.
- It does not see survival outside the summary (auto-memory, a preserved segment), subagent
  transcripts, or anything across sessions.
- It does not accept uploads. The only sessions are the bundled fixtures.

## The three demo sessions

| id | label | provenance | what it shows |
|---|---|---|---|
| `healthy-run2` | Healthy compaction (run 2) | experiment-derived, run `run2` | A real scratch run. Four constraints, all PRESERVED verbatim; every downstream result "none found" or "not checkable". |
| `constructed-ticket` | Constructed: the ticket survived, the rule about it did not | constructed, note: "based on a real event I can't show" | The summary keeps the ticket as a work item and drops the rule about it; a later comment call names the ticket, so that item is matched. |
| `constructed-file-edit` | Constructed: the rule vanished, the file got edited, the user re-typed it | constructed, note: "constructed from the run 2 data: the file rule removed from the summary; the edit and the restatement are invented" | One LOST rule about a file, an Edit to that file after the compaction, then the user restating the rule. |

The default demo is the ticket case, by the contract's rule: the highest-provenance session
that has a downstream action. The healthy run ranks higher but has none.

## Honesty

- Constructed cases are constructed. Each session shows a provenance band: the kind in
  capitals, then the run name for an experiment-derived session or the note, verbatim, for a
  constructed one. The two loss cases exist because three real scratch runs produced no loss
  (see the finding below). If a later experiment produces a real one, it replaces the
  constructed case and the label changes.
- Compaction behavior depends on the Claude Code version and the model. The facts line under
  the session picker shows both, with the trigger, the token counts, and the boundary time.
- No causation claim. A status describes the summary text. The downstream label describes one
  later action. `CLOSING_LINE` is printed under every downstream result, and the healthy line
  under question 5 appears only when no item is matched.
- The footer on every view says the same thing: demo data is illustrative, items are
  pre-labeled, and this README says what the analysis does and doesn't do.

## Future work

Ranked by an evaluator walk of the live URL (`docs/reviews/2026-09-17-evaluator.md`). None of
these are started.

1. Run it on your own transcript. Paste a JSONL or pick a local file; nothing uploaded, the
   analysis stays in the browser. The adapter and the extraction stage already exist and would
   finally be exercised on a session that is not pre-labeled. Needs a reading of the
   no-runtime-loading rule (R3) for a file picker.
2. Say in words what a DEGRADED or LOST passage kept and dropped, from the entities and matches
   the survival stage already records. Today the reader infers it from the marks and the score.
3. Irregular timestamps in the two constructed fixtures. Every message after the boundary sits
   exactly one minute apart, which reads synthetic even with the constructed label.

## Run locally

```sh
npm ci
npm run check          # lint, typecheck, unit tests
npm run build          # tsc -b && vite build, into dist/
npx vite preview --strictPort --port 4173
```

The preview serves `dist/` at `http://localhost:4173`. Stop it with Ctrl-C.

Browser checks, in a second terminal while the preview runs:

```sh
npm run e2e                                   # Playwright smoke test
npm run screenshots -- http://localhost:4173  # four PNGs into screenshots/
```

`npm run e2e` uses the machine's Google Chrome through Playwright's `chrome` channel, so no
browser download is needed. `BASE_URL` picks the target; the default is the preview above.
`npm run screenshots -- <base url>` writes `1-landing.png`, `2-compaction-clicked.png`,
`3-lost-trace.png`, and `4-story.png` into `screenshots/`, which is gitignored.

## Where it runs

On your machine. The intended use is a local run against your own Claude Code session logs,
which never leave the computer they were written on (see "Run locally" above). A public copy
of the demo build was put on an S3 static website for an evaluator pass, temporarily; it is
not the product, and `docs/deployment.md` describes that step only for the record.

## Layout of the repo

- `src/domain`: the analysis, pure TypeScript with no imports from outside the folder; `index.ts` is its only public entry; `contract.ts` holds the frozen types and the two fixed strings.
- `src/adapters`: the Claude Code JSONL adapter, session validation, and `SessionSource`, the one door demo and real sessions pass through.
- `src/fixtures`: the three demo sessions as committed JSON, statically imported and validated at load.
- `src/ui`: the React app: shell, autopsy panel, evidence drawer, story view, timeline. Never imports from `src/fixtures`.
- `src/specs`: tests that enforce the architecture rules and check the fixtures against the contract.
- `docs/contracts`: the contract, its meaning, and `FROZEN` with the hashes that lock it.
- `docs/specs`: product, UI, algorithm, domain model, session file format, testing strategy.
- `docs/tasks`: one file per task with acceptance criteria; `BACKLOG.md` holds what was deferred.
- `docs/experiments`: the scratch runs and their findings.
- `scripts`: fixture builders, the usage-time logger, the screenshot script, and `deploy-s3.sh`, a manual tool that is never part of `npm run build`.
- `e2e`: the Playwright smoke test.

## Finding, 2026-09-16

Three scratch sessions tried to make Claude Code drop casually stated constraints in compaction
(rules in prompts, rules in a file, up to 1.06M tokens of tool output on top). Every constraint
survived verbatim in the summary and every follow-up honored it: this version of Claude Code
quotes constraints into the summary. The losses that motivated the tool came from a different
week, possibly a different version. Compaction behavior changes across releases; that is part
of why the tool exists. See `docs/experiments/findings.md` and `docs/specs/algorithm-v1.md`.
The bundled healthy case is a real, sanitized run. The loss case is constructed from the same
generated data and labeled as constructed.
