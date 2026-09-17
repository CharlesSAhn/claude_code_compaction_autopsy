# Contract issues

Log of every change to the frozen contract. One entry per refreeze: date, version, what changed, why.

## v2 — 2026-09-16

- Downstream forbidden-token matching is whole-token, the same rule as entity presence in
  survival. v1 said "contains the anchor value" (algorithm-v1 step 8) and the reference used a
  substring find, so `VLX-41271` in a commit message matched an item about `VLX-4127`. Ticket
  ids share prefixes constantly: a realistic false positive on real data. Survival went
  whole-token under ruling A; leaving downstream on "contains" made the contract inconsistent
  with itself. Found by the T2-engine independent review. Fixtures are unaffected (the ticket
  case uses a class anchor); the expected tests and the parity JSON are re-derived.
- Regions are half-open windows both ways: a message at exactly a boundary's `ts` is after that
  boundary. v1 said "not before the previous boundary" for the before window but "greater" for
  the after window, so a boundary-timestamp message of the last boundary was in no region.
  Found by the same review; the engine was fixed at `eec4b19`, the text now says so.

## v3 candidates (not changes)

- 2026-09-16, `sourceSessionId` on `Provenance` for `observed-sanitized` and
  `experiment-derived`: the raw session id (never a path) of the session a fixture was built
  from. In v1 `run` is the source reference (`run2` is the scratch run named in
  `docs/tasks/T1-fixtures.md`, Derivation). Wanted for the real-data adapter, where `run`
  has no meaning. Ruled 2026-09-16: no refreeze for it now.
- 2026-09-16, status gating for the downstream walk: v1 walks the post-boundary tool calls for
  every anchored item whatever its `survival.status`, and a hit on a PRESERVED item carries the
  same `INCONSISTENT_LABEL` as a hit on a LOST one. Ruled 2026-09-16: leave v1 as is; the
  healthy demo's "none found" on PRESERVED items is an honesty signal the storyboards depend
  on. v2 question: a downstream hit on a PRESERVED item should carry a different, weaker label
  than the inconsistency label, because that is a model ignoring a rule that is present, not
  compaction loss. Not bundled into the v2 refreeze; it would ripple into the storyboards.
