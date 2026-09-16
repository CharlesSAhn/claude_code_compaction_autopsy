# Compaction Autopsy — product

## Problem

Claude Code compacts long sessions into a summary. Things the user said can drop out of that
summary, and later actions can go against them. The user cannot see what was there, what the
summary kept, or which later action ran without the rule. Two cases from the author: a rule
"don't reference ticket info in comments" that did not survive, followed by a Linear comment
that did exactly that; a rule "don't modify scripts/install.sh" followed by an edit to it.

## Who it's for

Developers who run long Claude Code sessions and suspect compaction ate an instruction. They
want evidence, not a feeling: the item, the summary passage, the action, with anchors they can
check in their own transcript.

## Core interaction

One screen answers five questions in order: what was there before the compaction, what survived,
what was lost or weakened, where each item came from, what happened after. Each item opens an
evidence view: the item text beside the matched summary passage with the matched phrases marked,
its provenance, and its downstream result. One view is an animated story of items flowing
through the compaction, with the lost ones stopping. Layout is chosen from three options later.

## MVP

- Static site, one URL, bundled demo sessions. Nobody clones or runs anything.
- Deterministic analysis. No LLM call anywhere.
- Demo sessions are normalized fixtures committed as JSON, Sessions with pre-labeled items.
  Survival scoring, evidence, downstream matching, and restatement run in the browser on load.
- Three statuses: PRESERVED, DEGRADED, LOST. Partial loss is the common case.
- "Not checkable" and "none found" are normal results, shown as such, never hidden.
- Every downstream result carries the fixed no-causation line.

## Demo scenarios

1. Healthy compaction, `experiment-derived`: a scratch run where four constraints were dropped
   mid-work, buried under hundreds of thousands of tokens, and all survived verbatim. Every item
   PRESERVED, every downstream result "none found" or "not checkable". This is the default demo.
2. Information loss, `constructed`: built from the same generated service and rules, with a
   summary that keeps the ticket as a work item and drops the rule, and a later comment call
   that names the ticket. Labeled "constructed" in the data and on screen.
3. A third scenario only if an experiment produces a real pattern.

## Non-goals

Upload or any runtime file reading; cross-session memory; a general transcript viewer;
subagent transcripts; claiming causation; CloudFront, auth, accounts, settings.

## Success criteria

- `npm run check` green from a fresh clone that has no files outside the repo.
- The URL opens on a phone and shows the healthy session with its tracked items, each with a
  status, a score, a marked summary passage, and provenance that opens the evidence view.
- The constructed session shows a LOST or DEGRADED item, a downstream action carrying the
  contract's inconsistency label, the "constructed" label, and the closing line.
- Every status in the demo can be checked by hand against the fixture with the anchors shown.

## Honesty

- Demo items are pre-labeled in the fixtures. Extraction (stage 1, finding candidate items in
  messages) is the one stage the URL does not exercise; it is documented in
  `docs/specs/algorithm-v1.md` and checked by tests. Survival scoring, evidence, downstream
  matching, and restatement run live in the browser on every load, and the expected results live
  in test files the analyzer cannot see.
- What the real-data checks observed (`docs/experiments/findings.md`): three scratch runs on
  Claude Code 2.1.273, rules in prompts and rules in a file, up to 1.06M tokens of tool output
  before a compaction. Every constraint survived verbatim; every follow-up honored it; one run
  also wrote a rule to auto-memory. Status, score, matched passage, and provenance populated on
  every item. No LOST, no DEGRADED, no inconsistent action, no restatement was observed.
- What comes from the author's account rather than from data: the two motivating cases above.
  They are not in any transcript we have.
- The loss demo is constructed, and labeled so, because the experiments did not produce a real
  one. If a later experiment does, it replaces the constructed one and the label changes.
- Compaction behavior differs across Claude Code versions. The version that quoted every rule
  is 2.1.273; the author's losses happened on another version. That difference is part of why
  the tool exists, and the session's version is shown with every report.
