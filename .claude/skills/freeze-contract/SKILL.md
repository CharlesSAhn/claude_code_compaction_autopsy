---
name: freeze-contract
description: Human-run only. Hashes the contract docs and src/domain/contract.ts into docs/contracts/FROZEN, adds the hash-check test, creates docs/CONTRACT-ISSUES.md, commits "contract: freeze v<n>", and prints the refreeze procedure.
disable-model-invocation: true
---

Pinned paths: `docs/contracts/FROZEN` and `src/domain/contract.ts`. Contract docs are
`docs/contracts/*.md`, FROZEN excluded. Never hard-code other names.

## 0. Refuse if
- `docs/contracts/FROZEN` already exists. Print `already frozen; delete FROZEN first to refreeze`.
- `grep -rniE 'TODO|TBD|FIXME' docs/contracts/*.md` finds anything. Print the lines.
- `docs/contracts/*.md` matches nothing, or `src/domain/contract.ts` is missing.
- `git status --porcelain -- docs/contracts src/domain/contract.ts` is non-empty
  (uncommitted contract edits). Commit them first.

## 1. Version
`n` = 1 + the count of `git log --oneline --grep '^contract: freeze v'`.

## 2. Hashes
From the repo root:
`shasum -a 256 docs/contracts/*.md src/domain/contract.ts > docs/contracts/FROZEN`
Paths are repo-relative so `shasum -a 256 -c docs/contracts/FROZEN` works from the root.
Print the file. From this moment the guard hook blocks writes under `docs/contracts/`,
including FROZEN itself.

## 3. Test `src/domain/contract.frozen.test.ts`
Create it if absent; never edit an existing one. It:
- reads `docs/contracts/FROZEN`, recomputes sha256 of each listed path with `node:crypto`,
  and has one `expect` per file with the path in the assertion message;
- uses `it.skipIf(!existsSync(FROZEN))` so the suite passes when FROZEN is absent.
  Spelled `skipIf`, not `.skip(`, so task-close's literal check does not trip;
- may import `node:fs`, `node:path`, `node:crypto`: test files are exempt from domain purity.

## 4. `docs/CONTRACT-ISSUES.md`
Create only if absent, header only:
```
# Contract issues

Log of every change to the frozen contract. One entry per refreeze: date, version, what changed, why.
```

## 5. Verify and commit
- `npm run check`, paste the summary lines. `shasum -a 256 -c docs/contracts/FROZEN`, paste it.
- `git add docs/contracts/FROZEN src/domain/contract.frozen.test.ts docs/CONTRACT-ISSUES.md`
- `git commit -m "contract: freeze v<n>"`. Do not push.

## 6. Print the refreeze steps
1. You delete `docs/contracts/FROZEN` in Terminal. The guard then allows contract writes.
2. Claude edits the contract and adds an entry to `docs/CONTRACT-ISSUES.md`.
3. You run `/freeze-contract` again. The commit reads `contract: freeze v<n+1>`.
