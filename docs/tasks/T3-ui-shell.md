# T3-ui-shell — app shell and timeline

## Objective

The screen around the autopsy, built to `docs/specs/ui.md`: session picker over the fixture
source, the provenance label and the constructed note, Claude Code version and model, the
compaction facts (trigger, tokens before and after), and a timeline of the session's messages
with the boundary marked. Everything renders from a `Session` alone. This lane never calls
`analyze` and mounts no stub of it: where the autopsy panel and the story view will go, the
shell exposes named slots that T4-autopsy fills.

## Dependencies

- `docs/specs/ui.md` exists (the human has picked the layout).
- Contract frozen at v1; fixtures and `fixtureSource` from T1-fixtures.
- Runs in parallel with T2-engine and T6-story-view.

## Lane rules

This lane runs in parallel with T2-engine and T6-story-view. Nobody changes what a contract
term means. If this lane thinks the contract is wrong, it writes the issue in
`docs/CONTRACT-ISSUES.md` and keeps going: no edit to the frozen files, no refreeze inside the
lane. Ownership is disjoint by folder; a change this lane wants outside its list is not made,
it is written under "Requests" at the end of this file for the owning lane.

## Files owned

- `src/ui/app/**` (shell, picker, header, slots), `src/ui/timeline/**`
- `src/App.tsx`, `src/main.tsx`, `src/index.css` (design tokens, light and dark), `index.html`
- `src/ui/app/url-state.ts` (the four query keys: session, compaction, item, view) and the
  one-line footer
- `src/ui/app/*.test.tsx`, `src/ui/timeline/*.test.ts`
- `docs/tasks/T3-ui-shell.md`

## Files not to touch

`src/domain/**`, `src/adapters/**`, `src/fixtures/**`, `src/ui/story/**`, `src/ui/autopsy/**`,
`docs/contracts/**`, `docs/specs/**`, `package.json` dependencies.

## Acceptance criteria

1. `npm run build` green; the page opens on the default session and the picker switches
   between the three, each showing its label, provenance kind, note when constructed, Claude
   Code version, model, trigger, preTokens, postTokens.
2. The timeline shows every message of the session in order with kind and excerpt, and the
   boundary at its timestamp position; the summary record is shown as a compaction, never as a
   typed message.
3. The shell reaches the domain only through `src/domain` (types) and the session source; no
   import of `analyze`; `grep -rn "analyze" src/ui/app src/ui/timeline src/App.tsx` is empty.
4. Slots: `App` renders `<AutopsySlot>` and `<StorySlot>` placeholders with a visible "not
   analyzed in this build" note, replaced by T4-autopsy.
5. Phone width: no horizontal scroll at 360 px, 16 px gutters; light and dark tokens defined on
   `:root`.
6. A `renderToString` smoke test per fixture renders the shell without throwing and contains
   the session label, provenance kind, the note for constructed sessions, and the footer line.
7. `url-state.ts` round-trips the four keys (unit test) and falls back to defaults on unknown
   values; the shell reads `session=` on load and writes it on picker change.
8. `npm run check` green.

## Tests

`npm run check`; smoke tests with `react-dom/server` (no jsdom); timeline layout helpers unit
tested (position of the boundary among messages by timestamp).

## Out of scope

The autopsy panel, evidence view, five questions (T4); the story animation (T6); any analysis;
the three-layout choice (done before this lane starts).

## Requests

(none yet)
