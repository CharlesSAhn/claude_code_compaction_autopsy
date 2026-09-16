# Compaction Autopsy

Shows what Claude Code lost during context compaction and what happened afterward.
Deterministic analysis of Claude Code JSONL transcripts. No LLM calls. Static React app
(Vite + TypeScript) with bundled, sanitized demo data, deployed to S3.

## How we work

1. Propose before doing anything non-trivial. Wait for an explicit OK.
2. When unsure, ask. Don't assume.
3. Show real output (command results, file contents), never just "done".
4. Stop at every `[HUMAN-GATE]` and wait.
5. Disagree briefly if you disagree, then do what the human decides.
6. Keep replies short.
7. Setup and features land in pieces, each proposed first.
8. Tests run at task close (`npm run check`), not in the pre-commit hook.
9. Log usage time per task in `STATUS.md` (`node scripts/usage-time.mjs --list`).

## Architecture boundary

Enforced by `src/specs/architecture.test.ts`. If a change needs a rule to bend, propose the rule change first.

- R1 Domain purity: non-test files under `src/domain` import only from within `src/domain`.
  No packages, no other `src` folders, no rendering libraries.
- R2 Single entry: files outside `src/domain` reach the domain only via `src/domain`
  (its `index.ts`), never a deeper path.
- R3 No runtime loading anywhere in `src`: no `fetch`, `XMLHttpRequest`, `WebSocket`,
  `EventSource`, `?url` imports, or dynamic `import()` with a non-literal specifier.
  Demo data is bundled through static imports from `src/fixtures`.
- R4 The domain has exactly one public entry point, `src/domain/index.ts`.

Test files (`*.test.ts`, `*.test.tsx`) are exempt from R1 and R2, not from R3.

## Guards

- Never bypass a hook, by any means. That includes `--no-verify`, changing `core.hooksPath`,
  `-c` overrides, environment variables that skip hooks, editing or disabling hook scripts,
  or committing through any path that avoids them. If a hook blocks you, stop and report.
- Nothing leaves the machine: `git fetch/pull/clone/remote/ls-remote`, `aws`, `curl`,
  `wget`, `ssh`, `scp`, `sftp`, `rsync`, `gh`, `npm publish` are `deny` rules in
  `.claude/settings.json`, backed by `.claude/hooks/guard-egress.sh`. Auto mode ignores
  `ask` from rules and hooks (verified 2026-09-16), so it is a hard deny. When a step needs
  egress, say so and let the human lift the rule for that step or run it in Terminal.
- `git push` is the one exception, gated by this rule instead of a deny: push only when the
  human says `push`, only `git push origin main`, never force, never a different remote or
  branch. `git remote` stays denied so the target cannot be changed. The push needs the
  human's Terminal SSH agent socket in `SSH_AUTH_SOCK`; ask for it if auth fails.
- Contract freeze: while `docs/contracts/FROZEN` exists, no tool may write to
  `docs/contracts/` or `src/domain/contract.ts`. Reads are fine. The freeze skill creates
  FROZEN with the file hashes; until then the guard is best-effort (path matching only).
- Nothing rewrites tool input before permission rules see it. Audited 2026-09-16: no user,
  project, or managed hooks, no enabled plugins. The guard hook never returns `updatedInput`.
  Keep it that way.
