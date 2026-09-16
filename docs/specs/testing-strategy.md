# Testing strategy

What the tests prove, where they live, and what a wrong answer would look like. Every expected
value comes from the reference implementation (`scripts/autopsy-check.py`) run on the committed
fixture; the analyzer never sees the expected files (`src/domain/pending/`), and the fixtures
carry no statuses, matches, or results.

## Layers

| Layer | Where | Runs in | Proves |
|---|---|---|---|
| Architecture | `src/specs/architecture.test.ts` | `npm run check` | domain purity, single entry, no runtime loading |
| Contract freeze | `src/domain/contract.frozen.test.ts` | `npm run check` | the frozen files still hash to FROZEN |
| Fixtures | `src/specs/fixtures.test.ts` | `npm run check` | three Sessions validate, four items each, origins resolve, provenance and notes as storyboarded, no home paths, default-demo rule |
| Expected reports | `src/domain/pending/*.expected.test.ts` | `npm run test:pending` | `analyze(session)` equals the reference report per item; red until the analyzer lands, then moved out of `pending/` |
| Listed sentences | `src/domain/*.test.ts` (analyzer task) | `npm run check` | the closed word lists and matchers on the sentences listed in `docs/specs/algorithm-v1.md` |

## The three cases

1. **healthy-run2** (`experiment-derived`, run 2). Four items, every one PRESERVED at 1.00,
   verbatim, span the whole sentence. Downstream: none found for the three rules, not checkable
   for the fact. No restatement. This is the "nothing happened" case and must look like a
   result, not an empty screen.
2. **constructed-ticket** (`constructed`, "based on a real event I can't show"). The ticket rule
   is DEGRADED: VLX-4127 survives as a work item, the rule sentence does not, score 0.18 against
   the work-item line. The first downstream action is the tracker comment naming the ticket:
   `forbidden_token`, `mcp_comment`, `afterRestatement` false. No restatement. Default demo.
3. **constructed-file-edit** (`constructed`, "constructed from the run 2 data…"). The file rule
   is LOST: its anchor `scripts/rotate_keys.sh` appears nowhere in the summary; `rotate_keys.py`
   surviving elsewhere does not rescue it. First action: the Edit to the `.sh` file,
   `forbidden_path`, `file_edit`, before the restatement. Restatement at +10 minutes by score
   (0.70). The other three items PRESERVED in both constructed cases.

## Negative cases (what must not fire)

Each is a listed sentence or a fixture fact; the analyzer task unit-checks the sentences.

- Reads and runs are not writes: `cat scripts/rotate_keys.sh 2>/dev/null` and
  `bash scripts/rotate_keys.sh --dry-run` never match the don't-modify rule.
- A longer suffix is a different file: `old_scripts/rotate_keys.sh` does not match
  `scripts/rotate_keys.sh`.
- `git add rotate_keys.py` is not a match for a rule about `rotate_keys.sh`.
- A ticket id in a non-comment code line, an unchanged existing comment line, a memory-file
  write, a ticket lookup (`get_issue`), or a `gh pr create` body when the sentence has no
  "PR description" noun: none match the ticket rule. The healthy fixture's memory-file write of
  the no-ticket rule is the real instance.
- `blueprint(x)` is not `print(`.
- `mcp__x__add_comment_to_thread` is in scope; `mcp__x__get_issue` is not (whole name parts).
- A fact ("staging moved to…") and a positive rule have no anchor: always "not checkable".
- `stop` is not a negation trigger: "the job will stop at 3am on host" is not a rule.
- A restatement is a human sentence after the boundary; the summary quoting the rule is not one.

## What a false positive looks like, per case

- **Healthy.** Any item below PRESERVED, or any downstream `matched`. The likely shapes: the
  Edit to `rotate_keys.py` reported against the `.sh` rule (suffix or stem matching); the
  changelog Write or the memory-file write reported against the ticket rule (a ticket id that
  is not there, or an out-of-scope artifact); the comment added to `rotate_keys.py` reported as
  a `print(` violation. The healthy expected test pins every `downstream.hit` to undefined.
- **Ticket.** The ticket rule reported PRESERVED (a summary line that merely names VLX-4127
  scored as the rule) or LOST (the whole-token entity check missing `VLX-4127` inside
  `(ticket VLX-4127):`); the best passage drifting to a log-analysis line on loose fuzzy
  matching (the reason `fuzzyMaxDistance` is 1); the don't-modify rule reported matched because
  the comment call is walked against every matcher. The expected test pins the passage line,
  the three matched tokens, and the hit's tool and artifact.
- **File edit.** The file rule reported DEGRADED because `rotate_keys.py` survives (the ruling:
  status uses anchor entities); the restatement's own Edit to `rotate_keys.py` reported as the
  first action; `afterRestatement` true on the `.sh` Edit (timestamp order wrong); a
  restatement claimed from the summary text instead of the human's message. The expected test
  pins the hit's `toolUseId` and timestamp and the restatement's uuid, score, and `by`.

## The claim the tests never make

No test asserts that a compaction caused an action, and no fixture carries a field that could.
Every downstream result is printed with `CLOSING_LINE`; the tests check the line is there.
