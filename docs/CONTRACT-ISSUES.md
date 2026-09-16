# Contract issues

Log of every change to the frozen contract. One entry per refreeze: date, version, what changed, why.

## v2 candidates (not changes; the contract is at v1)

- 2026-09-16, `sourceSessionId` on `Provenance` for `observed-sanitized` and
  `experiment-derived`: the raw session id (never a path) of the session a fixture was built
  from. In v1 `run` is the source reference (`run2` is the scratch run named in
  `docs/tasks/T1-fixtures.md`, Derivation). Wanted for the real-data adapter, where `run`
  has no meaning. Ruled 2026-09-16: no refreeze for it now.
