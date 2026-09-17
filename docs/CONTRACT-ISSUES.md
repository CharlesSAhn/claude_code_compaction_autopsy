# Contract issues

Log of every change to the frozen contract. One entry per refreeze: date, version, what changed, why.

## v2 candidates (not changes; the contract is at v1)

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
