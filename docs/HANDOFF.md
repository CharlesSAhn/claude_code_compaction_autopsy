# HANDOFF — 2026-09-16

The next session starts from this file and nothing else. Repo rules are in `CLAUDE.md`
(auto-loaded). Time log is `STATUS.md`. Skills live in `.claude/skills/` and load at session
start: `/task-close`, `/independent-review`, `/session-handoff`, `/freeze-contract` (human-run).

## Done

| Task        | SHA     | What |
|-------------|---------|------|
| scaffold    | 9d99739 | Vite + React + TS + Vitest, oxlint, scripts, `src/{domain,adapters,fixtures,ui,specs,tasks}`, architecture tests R1–R4, pre-commit hook (lint + typecheck) |
| guards      | 22199d4 | Egress deny rules + `guard-egress.sh`, contract freeze `guard-contracts.sh` (switch: `docs/contracts/FROZEN`), CLAUDE.md, STATUS.md, `scripts/usage-time.mjs` |
| skills      | 8899ae4 | The four skills; STATUS.md columns migrated |
| allow push  | 8bf8cbe | `git push` removed from deny; gated by CLAUDE.md: only on the human's `push`, only `origin main`, never force |

All pushed to `origin/main`. Idea interview and challenge done; decisions below. No code for
the idea exists. No `docs/specs/`, `docs/contracts/`, `docs/tasks/`, or `src/domain/contract.ts` yet.

## Next

The human chose no next piece yet. Candidates offered and declined for now: product spec in
`docs/specs/`, contract doc + `src/domain/contract.ts`, synthetic fixture, task files in
`docs/tasks/`. First step of the next session: the human names the piece; Claude proposes it,
waits for OK, then builds.

## Decisions

### The idea, verbatim (2026-09-16)

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

### Product decisions before the interview (2026-09-16)

- Input: Claude Code JSONL transcripts from `~/.claude/projects/<project>/*.jsonl`.
- Demo data: real sessions from this Mac, sanitized before bundling.
- Deploy: S3 static website only, no CloudFront.
- v1: bundled demo data only, no user upload.
- Stack: Vite + React + TypeScript.
- Contract paths, frozen while `docs/contracts/FROZEN` exists: `docs/contracts/**` and
  `src/domain/contract.ts`. Specs are `docs/specs/*.md`; contract docs are `docs/contracts/*.md`
  excluding FROZEN. No other names are pinned.

### Interview answers (five questions, answers verbatim)

1. Q: "What existed before compaction" needs a deterministic definition of a unit of information. What is one unit?
   A: **Pattern-detected constraints**
   (option text: only sentences matching fixed patterns: negations (don't, never, avoid), file paths, ticket ids, 'always'. Narrower, misses phrasing the patterns don't cover)

2. Q: PROJ-321 survived compaction as a work item but the rule about it was dropped. How should the tool decide PRESERVED vs DEGRADED vs LOST?
   A: **Token overlap threshold**
   (option text: compare item text to the summary with normalized token overlap; two thresholds split the three classes. Tunable, explainable, can misjudge paraphrase)

3. Q: The rule may have survived somewhere else: CLAUDE.md, a re-statement after compaction, or a file Claude re-read. When is a later action attributable to the compaction loss?
   A, typed: "3. never claim attribution. If we can't prove the compaction caused the later action, we don't say it did. when we write the conract "caused" will be a claim the tool never makes, and the label on a later action will be something like "first observed downstream action inconsistent with this item" witha closing line that says we show the loss and the action and don't clain one caused the other."

4. Q: The Linear comment was an MCP tool call, the install.sh edit was an Edit tool call. Which post-compaction actions does the tool inspect for inconsistency?
   A: **All tool_use inputs**
   (option text: every tool call's input text and file paths: Edit, Write, Bash, MCP tools. Assistant prose is ignored)

5. Q: "Inconsistent with this item" must be decided by a rule, not a judgment. What makes a later action inconsistent with a lost item?
   A: **Both, with a confidence tier**
   (option text: per-pattern matchers where they exist, entity co-occurrence as a weaker fallback, and the report labels which rule fired)

### Challenge and decisions

Fact found during the challenge: this Mac holds 3 Claude Code transcripts (2 MB), none with a
compaction. The PROJ-321 and install.sh sessions are not on this machine.

The human's framing of the challenge, verbatim:

> The ticket info and the script for lost contact is general expeeince that I used and part of
> future that I will incldue is to try it out and collect more evnce in term so of what can be
> measured and learn adn if there is a signal that we can use to build something that give us
> more information. I hope some of these abmguities can be answer as we go along

Each challenge (Claude's, one line) and the human's decision (verbatim):

Scope cuts offered:
- No DEGRADED class in v1 — **not accepted** (left unselected; DEGRADED stays)
- No entity co-occurrence fallback in v1 — **accepted** ("No entity co-occurrence fallback in v1")
- No cross-session repetition — **accepted** ("No cross-session repetition")
- Provenance = user message only — **accepted** ("Provenance = user message only")

Design changes offered, answered in one message: "1. partial.  Structural check first when the summary ha sa constraints section, but overlap against the best passage is the score. 2. reject. 3. accept, 4. accept"
1. Structural survival instead of token overlap — **partial**: "Structural check first when the summary ha sa constraints section, but overlap against the best passage is the score."
2. Backward entry point, start from the action — **reject**
3. Summary side-by-side as the centerpiece, matched tokens highlighted — **accept**
4. First fixture synthetic, and produce a real compaction this week — **accept**

Net effect of accepted items on answer 5: per-pattern matchers only in v1; the co-occurrence
fallback and its confidence tier are deferred, not deleted.

### Working rules, verbatim (2026-09-16)

> - Propose before doing anything non-trivial. Wait for my OK.
> - When unsure, ask. Don't assume.
> - Show me real output, not "done".
> - Stop at every `[HUMAN-GATE]`.
> - Disagree briefly if you disagree, then do what I decide.
> - Keep replies short.

Environment facts: auto mode ignores `ask` from rules and hooks, so egress is a hard deny except
`git push`. Pushing needs the human's Terminal SSH agent socket in `SSH_AUTH_SOCK`; ask for
`echo $SSH_AUTH_SOCK` if auth fails.

## Open questions

- Which piece comes first: spec, contract, synthetic fixture, or task files.
- Multiple compactions in one session.
- Token overlap thresholds, normalization rules, and what "best passage" means, to be fixed in the contract.
- The exact pattern list for item detection and the per-pattern matcher list.
- How the compaction boundary and summary are identified in the JSONL, and whether summaries have a constraints section.
- Producing a real compaction transcript this week (accepted), and how it gets sanitized.

## Uncommitted

clean (before this handoff commit)

## Time

0h 32m of 4–5h target (all sessions, `node scripts/usage-time.mjs`).
Per task: scaffold 4 min, guards 13 min, closed rows in STATUS.md. Skills, allow-push, and the
idea interview are not closed as tasks; they account for the remaining minutes.
