# T4-autopsy — the autopsy interaction

## Objective

The one excellent interaction, built to `docs/specs/ui.md` in the shell's slots: the five
questions in order with their counts; the ledger; the four-step trace per item (source,
compaction with the closest passage and score, after, evidence); the evidence drawer opened
from the compaction step, marks from the stored offsets; the two empty states with their
reasons ("not checkable" why; "none found" with how many in-scope actions were scanned and
what closed the window); `CLOSING_LINE` under every downstream result; `HEALTHY_LINE` under
question 5 when nothing matched; a matched action carries `INCONSISTENT_LABEL` by name.
`analyze` runs on every fixture at load; the "Start here" hint sits on the first row of the
default session; `item=` and `view=` are written to the URL. This task wires `analyze` into the app: the
session source gets its matched-action verdicts from `analyze`, so the default demo is the
ticket case; the story view receives the real report and the stub leaves the runtime.

## Dependencies

T2-engine, T3-ui-shell, T6-story-view all closed; `docs/specs/ui.md`.

## Files owned

- `src/ui/autopsy/**` (questions, ledger, trace, evidence drawer, `strings.ts` with `HEALTHY_LINE`)
- `src/App.tsx`, `src/ui/app/**` for mounting the panels into the slots and building the source
  with the `analyze` predicate (T3 is closed by then)
- `src/fixtures/index.ts` only if the source construction moves there
- `src/ui/story/**` only to swap the stub for the real report (T6 is closed by then)
- `docs/tasks/T4-autopsy.md`

## Files not to touch

`src/domain/**`, `src/adapters/claude-code-jsonl/**`, `src/fixtures/*.json`,
`docs/contracts/**`, `docs/specs/**`, `package.json`.

## Acceptance criteria

1. On load the default session is `constructed-ticket` (the contract's default-demo rule with
   real verdicts); the picker still offers all three.
2. Ticket case: the ticket rule shows DEGRADED with its score and marked passage; its downstream
   row shows the comment call with `INCONSISTENT_LABEL`, tool, timestamp, excerpt; the
   "constructed" label and note are visible; `CLOSING_LINE` is under every downstream row.
3. Healthy case: four PRESERVED rows at 1.00, three "none found" and one "not checkable"
   rendered as results with the same weight as a match, never hidden or collapsed away.
4. File-edit case: the file rule LOST, the Edit as the first action, the restatement row with
   its time and score, the label and closing line.
5. Evidence view per item: item text, the passage with `«…»` marks rendered from `matches`
   (offsets, not the string), `entitiesInPassage` and `entitiesAnywhere`, the origin (uuid,
   timestamp, line) as a link into the timeline, thresholds used.
6. The story view shows the real report; `grep -rln "stub-report" src` lists only test files.
7. No literal of the two fixed strings outside the contract: `grep -rn "inconsistent with this
   item\|do not claim one caused" src` hits only `src/domain/contract.ts`. `grep -rniE
   "caused|because of the compaction" src/ui` is empty.
8. Phone width holds with the panels mounted; `npm run build` and `npm run check` green.
9. Empty states carry their reasons: "none found: N in-scope actions scanned, until the end of
   the session" on the healthy rules; "not checkable: a fact has no anchor" on the host fact;
   `HEALTHY_LINE` appears on the healthy case only.
10. The "Start here" hint shows on the default session's first row until a selection; the URL
    reflects session, compaction, item, and view after every interaction.

## Tests

`npm run check`; `react-dom/server` smoke test per fixture asserting the status words, the
label, the closing line, and the "not checkable" and "none found" strings are present; a unit
test for the mark renderer (offsets to `«…»`) against the healthy and ticket expected data.

## Out of scope

Copy-as-markdown, redaction map view, boundary selector for multi-compaction sessions (nice to
have, backlog); deploy; any contract change.
