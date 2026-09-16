# HANDOFF — 2026-09-16, end of P2

The next session starts from this file and nothing else. Repo rules are in `CLAUDE.md`
(auto-loaded). Time log is `STATUS.md`. Skills in `.claude/skills/` load at session start:
`/task-close`, `/independent-review`, `/session-handoff`, `/freeze-contract` (human-run).
Next step is P3a: propose the data model. Do not propose it from memory; read section
"Decisions" below, which is the approved plan verbatim.

## Done

| Commit | What |
|--------|------|
| 9d99739 scaffold | Vite + React + TS + Vitest, oxlint, scripts, `src/{domain,adapters,fixtures,ui,specs,tasks}`, architecture tests R1–R4, pre-commit hook |
| 22199d4 guards | egress deny rules + hooks, contract freeze switch `docs/contracts/FROZEN`, CLAUDE.md, STATUS.md, `scripts/usage-time.mjs` |
| 8899ae4 skills | the four skills |
| 8bf8cbe allow push | `git push` allowed only on the human's "push", only `origin main` |
| 7e4c144 handoff | first handoff |
| 4861899 experiment runbook | `docs/experiments/run1.md`, `gen_argon.py` |
| 510ddbe findings | three scratch runs, nothing lost; `docs/experiments/findings.md` |
| 6e2c5d8 algorithm v1 | `docs/specs/algorithm-v1.md`, `scripts/autopsy-check.py` |
| 9ecb6bd, 86006b9, f995eeb | stage-4 anchor rules with closed word lists, scope-noun map; script matches the spec; listed cases unit-checked; run tables zero false positives |
| 840499b, 38802bd | plan amendments applied to docs; loss case is constructed from the generated data |

Pushed through 8bf8cbe. Nine commits ahead of origin, unpushed, waiting on the human's "push".
No product code for the idea exists yet: no `src/domain/contract.ts`, no `docs/contracts/`,
no `docs/tasks/`, no fixtures, no UI beyond the scaffold placeholder.

## Next

P3a: propose the data model (Session, Compaction, Item, Evidence, Action, Report) in the five
shapes decided below, as `src/domain/contract.ts` plus `docs/contracts/*.md`. Propose first, wait
for OK. The contract is frozen only after the fixtures have pushed back on the types. The task
list is settled in its own step later; the list in the plan is provisional.

## Decisions — the approved plan, verbatim copy of ~/.claude/plans/nifty-chasing-nautilus.md

## Compaction Autopsy — plan (end of P2, 2026-09-16)

Everything decided in this session, in the human's words where they were given, plus the scope
and layout proposed at the end. Approval of this file closes the P2 stretch. The next step, P3a,
proposes the data model that gets frozen; it starts from `docs/HANDOFF.md`, which must carry this
plan's words.

### 1. Context

The human's framing, verbatim:

> I want to build a small developer tool called "Compaction Autopsy." It helps developers see
> what Claude Code lost during context compaction and what happened afterward.
>
> This actually happened to me last week:
>
> 1. I told Claude Code: "don't reference any specific ticket info on comments like (PROJ-321 option A)."
> 2. The session auto-compacted. The summary kept PROJ-321 as a work item but dropped the rule.
> 3. Half an hour later Claude Code saved a Linear comment: "for the same reasoning we closed PROJ-321 on."
> 4. It was a rule I'd already typed in two other sessions that week. I keep having to repeat it.
>
> Same problem with files:
>
> 1. I say "don't modify scripts/install.sh, build install.py alongside it."
> 2. Compaction drops it.
> 3. Later it edits install.sh.
>
> I want the tool to answer:
>
> - What existed before compaction?
> - What survived?
> - What was lost?
> - Where did it come from?
> - What happened afterward?
> - What was the first later action that goes against the lost information?
>
> Two rules:
>
> - Careful about causality. If we can't prove the compaction caused the later action, we don't say it did.
> - Deterministic analysis. I don't want to add an LLM just to make it sound AI-powered.

Later framing, verbatim: "Goal 4–5 hours of working time. Time isn't the worry. Nothing runs
forever: every subagent has a cap, commits at each milestone, checks the clock before anything
new." "One excellent interaction: 'show me what Claude Code forgot, where it came from, what
happened after.'" "Hard rule: evaluators open a URL and use bundled demo sessions. Nobody clones
or runs anything." "Bundle a healthy compaction, an information-loss case, and maybe a third if we
find a real pattern."

### 2. Decisions already made (verbatim where given)

Product, before the interview: input is Claude Code JSONL transcripts; demo data is real
sessions, sanitized; S3 static website only; v1 bundled demo data, no upload; Vite + React +
TypeScript. Pinned contract paths: `docs/contracts/FROZEN` and `src/domain/contract.ts`; specs
in `docs/specs/*.md`; contract docs in `docs/contracts/*.md` excluding FROZEN.

Interview 1 (idea):
1. Unit of information: **Pattern-detected constraints**.
2. Survival: **Token overlap threshold**.
3. Causality, typed: "never claim attribution. If we can't prove the compaction caused the later
   action, we don't say it did. when we write the conract "caused" will be a claim the tool never
   makes, and the label on a later action will be something like "first observed downstream
   action inconsistent with this item" witha closing line that says we show the loss and the
   action and don't clain one caused the other."
4. Actions inspected: **All tool_use inputs**.
5. Inconsistency: **Both, with a confidence tier** (co-occurrence fallback later deferred).

Challenge outcomes: no cross-session repetition; no entity co-occurrence fallback in v1;
provenance = user message only; DEGRADED stays; survival partial: "Structural check first when
the summary ha sa constraints section, but overlap against the best passage is the score.";
backward entry point rejected; summary side-by-side centerpiece accepted; first fixture synthetic
and a real compaction produced this week, accepted.

Interview 2 (data model), option labels verbatim:
1. Session: **Derived data plus a sanitized message list**.
2. Compaction: **List of boundaries, full summary each**.
3. Item: **One item per pre-boundary sentence, restatement as a link**.
4. Evidence: **Both** (offsets as source of truth, marked string as convenience).
5. Action: **Result enum plus a hit record** (matched | none_found | none_matchable; hit has
   tool_use id, timestamp, tool, matcher, artifact kind, excerpt, before/after-restatement flag).

### 3. What the experiments showed (docs/experiments/findings.md)

Three scratch runs, generator `docs/experiments/gen_argon.py`, all names invented. Run 1 Fable,
1,057k tokens before a manual `/compact`, rules in prompts. Run 2 Sonnet, 235k, rules in prompts.
Run 3 Sonnet, 295k, rules only in a NOTES.md file. In all three every constraint survived
verbatim and every follow-up honored it. Run 2 also wrote a rule to auto-memory. Cost ~39M
tokens. The human's finding: this version of Claude Code (2.1.273) quotes constraints into the
summary; behavior changes across releases, which is part of why the tool exists. The demo
focuses on the data generated here; the loss case is constructed from the argon data and
labeled as constructed (amendment 3, as revised after approval).

Transcript facts: `system/compact_boundary` with `compactMetadata` (trigger, preTokens,
postTokens, durationMs, preservedSegment); a `user` record with `isCompactSummary: true`; a
structured summary with sections including "All user messages"; a preserved verbatim tail;
subagent transcripts under `<session>/subagents/agent-*.jsonl`.

### 4. Algorithm v1 (docs/specs/algorithm-v1.md, reference scripts/autopsy-check.py)

Five stages, closed word lists, unit-checked against the listed sentences. Anchors only for
negation items; trigger clause to the first boundary; concrete entities in the clause else a
class anchor; scope of the forbidden-token matcher is the union of what the sentence's scope
nouns map to (comments → MCP comment/issue/note calls and added comment lines in code files;
commit messages → git commit text; changelog → CHANGELOG edits; PR descriptions → gh pr body;
tickets/issues → MCP issue calls; no noun → all). Reliable on this machine's data: status,
score, matched span, provenance. Optional, never fired here: first inconsistent action,
restatement, DEGRADED; exercised only by the ticket case built from the human's account.

### 5. Scope

#### Must have (v1, the URL)
- Normalized model as the contract: Session, Compaction, Item, Evidence, Action, exactly the
  five shapes above. `src/domain/contract.ts` plus `docs/contracts/*.md` for semantics, word
  lists, thresholds, and the two fixed labels ("first observed downstream action inconsistent
  with this item"; the closing no-causation line). Frozen only after the fixtures are written
  and have pushed back on the types; the fixtures are the first real consumer (amendment 1).
- Adapter, pure code: Claude Code JSONL text → normalized Session, including redaction. A manual
  dev script runs it to produce fixtures; it is never part of `npm run build`, and nothing at
  build time reads files outside the repo (amendment 5). The same code is the door for real data later.
- Domain analysis, pure: stages 1–5 over a Session → Report. Parity test runs against the
  committed fixtures, not raw run files outside the repo (amendment 6); the expected tables come
  from `autopsy-check.py` run once on the source sessions.
- Fixtures are committed JSON in the normalized model, static imports: the healthy case from
  run 1 or run 2 (run 3 has zero items; a healthy demo with nothing tracked shows nothing,
  amendment 2), and the loss case constructed from the same generated argon data (VLX-4127
  ticket rule, rotate_keys.sh rule), labeled as constructed (amendment 3, revised: focus on the
  data we generated). There is no table from another machine and no partial Session.
- UI: the center answers the five questions in order: what was there, what survived, what was
  lost or weakened, where it came from, what happened after. The side-by-side summary is the
  evidence view opened from an item, not the centerpiece (amendment 4). "Not checkable" and
  "none found" are the normal case and are shown as such, never hidden. One view is an animated
  story view of items flowing through the compaction, with the lost ones stopping (amendment 8).
  Layout is not locked now; it is decided when the human is shown three options.
- Tests: architecture rules (exist), domain unit tests from the listed sentences, expected-answer
  tests in `src/domain/pending/` that stay red until the analyzer lands, contract freeze test,
  adapter round-trip on the healthy fixture's source.
- Deploy: `npm run build` reads only the repo, S3 static website, the human lifts the egress
  rule for the sync.

#### Nice to have
- Boundary selector when a session has more than one compaction (model supports it from day one).
- Three layout options presented before the layout is chosen (required by amendment 4, listed
  here as a step, not a feature).
- Redaction map view ("host-1 was a staging host").
- Copy-as-markdown of one item's evidence.
- Version-dependence note in the header (Claude Code version of the session).

#### Don't build
- Upload or drag-drop; anything that reads files at runtime.
- Any LLM call.
- Cross-session repetition; memory-file scanning beyond noting the survival path.
- Backward entry point (rejected).
- CloudFront, custom domain, auth, settings, accounts.
- Subagent transcripts, microcompact boundaries, positive-class matchers, co-occurrence fallback.
- A general transcript viewer.

### 6. Folder layout and data path

```
src/
  domain/            pure, one entry point src/domain/index.ts (R1, R2, R4)
    contract.ts      the frozen types: Session, Compaction, Item, Evidence, Action, Report
    wordlists.ts     closed lists: triggers, boundaries, class nouns, scope map, markers, stopwords
    normalize.ts     text normalization, tokens, Levenshtein
    items.ts         stage 1
    survival.ts      stages 2–3
    actions.ts       stage 4
    restatement.ts   stage 5
    analyze.ts       Session → Report; exported through index.ts
    pending/         only the expected-answer tests that stay red until the analyzer lands;
                     analyzer code goes in src/domain directly; nothing else lives here (amendment 7)
  adapters/
    claude-code-jsonl/
      parse.ts       JSONL text → typed records
      to-session.ts  records → Session (messages, compactions, versions)
      redact.ts      stable placeholders for tickets, hosts, paths
  fixtures/
    index.ts         exported list of bundled Sessions with label, origin (real | constructed)
    healthy.json          from run 1 or run 2, real, sanitized
    constructed-loss.json constructed from the generated argon data; labeled "constructed"
  ui/                React; imports from "../domain" only
  specs/             architecture.test.ts (exists), parity.test.ts
  tasks/             unused in v1 unless the human assigns it
scripts/
  build-fixtures.mjs manual dev tool only, never run by npm run build: raw JSONL outside the repo
                     → adapter → redact → committed src/fixtures/*.json
  autopsy-check.py   the portable reference oracle, run on the other machine
  usage-time.mjs
```

Data path: raw session on disk (never in the repo) → `scripts/build-fixtures.mjs`, run by hand
→ `adapters/claude-code-jsonl` (parse, to-session, redact) → committed Session JSON in
`src/fixtures` → `domain.analyze(session)` → Report → UI. `npm run build` and every clone see
only the committed JSON. Real data later enters at the adapter, the same door.

### 7. Tasks (provisional; the task list gets settled in its own step later, amendment 9)

1. `contract`: contract.ts, docs/contracts semantics; freeze via /freeze-contract only after
   the fixtures have pushed back on the types.
2. `adapter`: parse, to-session, redact, build-fixtures (manual), healthy fixture from run 1 or 2.
3. `analyzer`: stages 1–5 in domain, parity against committed fixtures, listed-sentence tests,
   turns the pending expected-answer tests green and removes pending/.
4. `ui`: the one screen.
5. `fixtures`: the ticket case from the human's account, labels, feedback on the types before freeze.
6. `deploy`: build, S3 sync, URL in README.

### 8. Amendments at approval (verbatim, 2026-09-16)

> 1. The contract gets frozen after the fixtures are written and have pushed back on the types, not after the model proposal. The fixtures are the first real consumer.
> 2. Healthy fixture comes from run 1 or run 2, not run 3. Run 3 has zero items; a healthy demo with nothing tracked shows nothing.
> 3. There is no table from another machine. The ticket case is built from my account, labeled as based on a real event I can't show you. Drop the partial-Session idea.
>    Revised after approval, verbatim: "remove "built from the user's account of a real event that cannot be shown a" focus on the data we generated.."
> 4. The side-by-side summary is the evidence view you open from an item, not the centerpiece. The center answers the five questions in order: what was there, what survived, what was lost or weakened, where it came from, what happened after. Don't lock the layout now; that gets decided when you show me three options. And "panels only when present" is wrong: "not checkable" and "none found" are the normal case and must be shown as such, not hidden.
> 5. Fixtures are committed JSON. The build-fixtures script is a manual dev tool, never part of npm run build. Nothing at build time reads files outside the repo, or the deploy and every clone break.
> 6. Parity test runs against the committed fixtures, not raw run files outside the repo, for the same reason.
> 7. src/domain/pending/ is only for the expected-answer tests that stay red until the analyzer lands. Analyzer code goes in src/domain directly. Nothing else lives in pending.
> 8. One of the UI views will be an animated story view of items flowing through the compaction, with the lost ones stopping. Keep it in scope; details come at layout time.
> 9. The task list gets settled in its own step later. Don't treat this one as final.

Status: approved with these amendments. End of the P2 stretch.

### 9. Verification
`npm run check` green from a fresh clone with no files outside the repo; parity test equal on
the committed fixtures; the URL opens on a phone and shows the healthy case with tracked items,
every one PRESERVED, "none found" and "not checkable" displayed as normal results, provenance
opening the evidence view; the ticket case shows a LOST item, an action with the fixed label,
its "constructed" label, and the closing line; STATUS.md within the 4–5 hour budget.

## Working rules, verbatim (2026-09-16)

> - Propose before doing anything non-trivial. Wait for my OK.
> - When unsure, ask. Don't assume.
> - Show me real output, not "done".
> - Stop at every `[HUMAN-GATE]`.
> - Disagree briefly if you disagree, then do what I decide.
> - Keep replies short.

Environment facts: auto mode ignores `ask` from rules and hooks, so egress is a hard deny except
`git push`. Pushing needs the human's Terminal SSH agent socket in `SSH_AUTH_SOCK`; ask for
`echo $SSH_AUTH_SOCK` if auth fails. Raw experiment transcripts live outside the repo in
`~/scratch/autopsy-runs/run{1,2,3}.jsonl`; only committed fixtures may be read by tests or builds.

## Open questions

- Which of run 1 or run 2 becomes the healthy fixture (both have tracked items).
- Exact construction of the loss fixture from the argon data, and how "constructed" is labeled in data and UI.
- The three layout options for the center view and the animated story view.
- The task list (settled in its own step).
- Multiple compactions per session in the UI (model supports a list from day one).

## Uncommitted

clean (before this handoff commit)

## Time

1h 24m of 4–5h target across all sessions (`node scripts/usage-time.mjs`, 97 turns).
Closed rows in STATUS.md: scaffold 4 min, guards 13 min. Skills, allow-push, the experiments,
algorithm v1, and the plan are not closed as tasks; they account for the remaining 1h 07m.
