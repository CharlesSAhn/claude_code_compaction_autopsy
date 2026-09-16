# T2-stub-and-strategy — analyze stub, red expected tests, testing strategy

Started 2026-09-16T22:40Z. Follows T1-fixtures (closed, 801e5c7). The contract is frozen (v1).

## Objective

The three fixtures and the fixture-backed `SessionSource` exist (T1-fixtures). This task adds
the `analyze(session)` stub that throws "not implemented" so the domain typechecks with the
entry point the UI will call, makes the expected tests under `src/domain/pending/` call it
directly and fail on the stub, and writes the testing strategy: the three cases, the negative
cases, and what a false positive looks like for each.

## Files owned

- `src/domain/analyze.ts` (stub only), `src/domain/index.ts` (the export line)
- `src/domain/pending/**`
- `docs/specs/testing-strategy.md`
- `docs/tasks/T2-stub-and-strategy.md`, `docs/CONTRACT-ISSUES.md` (the v2-candidate entry)

## Files not to touch

- `src/domain/contract.ts`, `docs/contracts/**` (frozen), `src/fixtures/**`, `src/adapters/**`,
  `src/ui/**`, `package.json`, `vite.config.ts`, `vitest.pending.config.ts`.

## Acceptance criteria

1. `src/domain` exports `analyze`; it throws `Error("not implemented")` and nothing else.
2. Every test in `src/domain/pending/` imports `analyze` statically from `../index` and fails
   with "not implemented" and no other reason (`npm run test:pending`).
3. `npm run check` is green; `src/domain/pending/` stays excluded from `npm test`.
4. `docs/specs/testing-strategy.md` names the three cases, the negative cases, and one false
   positive per case, each tied to a test file or a fixture id.

## Tests

`npm run check`; `npm run test:pending` (red on the stub only).

## Out of scope

The analyzer itself (stages 2–5), the UI, any contract change. The fixture brief's source
session id: ruled 2026-09-16, no refreeze; `run` is the v1 source reference, and
`sourceSessionId` is logged in `docs/CONTRACT-ISSUES.md` as a v2 candidate for the real-data
adapter.
