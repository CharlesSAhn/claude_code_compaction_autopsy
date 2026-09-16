# Domain model

Types are in `src/domain/contract.ts`; meanings in `docs/contracts/contract.md`. This page shows
how they fit together.

## Three regions per compaction

A `Session` is a sanitized `messages` list and a `compactions` list. Each compaction `i` splits
the message list into three regions:

```
messages ─────────────────────────────────────────────────────────────────►
   [ before i ]  compactions[i].boundary  [ after i = before i+1 ]  boundary i+1 ...
       │                 │                        │
       ▼                 ▼                        ▼
     Items          Survival               Downstream, Restatement
   (stage 1)       (stages 2–3)                (stages 4–5)
```

- **Before**: human prompts between the previous boundary (or the start) and boundary `i`.
  Stage 1 turns matching sentences into `Item`s with `compactionIndex = i`. Provenance is the
  message (`origin`).
- **Compacted**: `compactions[i].summary`, the full text as lines. Stage 2 scores every item of
  index `i` against it and produces `SurvivalEvidence` with a `Status`.
- **After**: everything between boundary `i` and boundary `i + 1` (or the end). Stage 4 walks
  the assistant `tool_use` records there and produces `DownstreamEvidence`; stage 5 scans the
  human prompts there for a `Restatement`.

Before and after are decided by timestamp: ISO strings compare lexicographically, and the
boundary record has its own `ts`. An item never crosses a boundary. A session with two
compactions yields two `Report`s (the reference script handles the first boundary only).

## Types, one line each

| Type | Holds | Produced by |
|---|---|---|
| `Session` | id, label, provenance, version, model, messages, compactions, items? (pre-labeled) | adapter, or fixture |
| `Message` | uuid, ts, line, kind, tool, excerpt (≤ 200 chars, redacted) | adapter |
| `Compaction` | boundary uuid, ts, trigger, preTokens, postTokens?, summary lines | adapter |
| `Item` | text, class, entities, anchors, origin, compactionIndex | stage 1 |
| `SurvivalEvidence` | status, score, verbatim, passage, matches (offsets), markedSpan, entities found, thresholds | stages 2–3 |
| `DownstreamEvidence` | result enum, hit?, scope | stage 4 |
| `Restatement` | messageUuid, ts, score | stage 5 |
| `ItemReport` | item + survival + downstream + restatement? | analyze |
| `Report` | sessionId, compactionIndex, items, closing line | analyze |
| `AnalyzedSession` | session + reports | analyze |

## Data path

```
raw JSONL (outside the repo)
  └─ scripts/build-fixtures.mjs   manual dev tool, never part of npm run build
       └─ adapters/claude-code-jsonl  parse → toSession → redact        ─┐
                                                                          ├─ Session
fixtures/*.json  committed Session with pre-labeled items ──────────────────┘
  └─ adapters/session-source        the one door: list, get → Session
       └─ domain.analyze(session)   runs in the browser at load: stages 2–5 on the pre-labeled
            │                       items (stage 1 only when a session carries no items)
            └─ ui                   renders AnalyzedSession; imports only from src/domain

specs / pending tests            expected reports per fixture, where the analyzer cannot see them
```

Extraction (stage 1, items and their anchors) is the one stage the fixtures skip, by carrying
pre-labeled items; `analyze` trusts pre-labeled items and never recomputes them. Survival
scoring, evidence, downstream matching, and restatement run in the browser on load; that is what
the demo demonstrates. Real data enters through the same door with no items, and analyze
extracts them.

## Provenance, two kinds

- Of a session: `Session.provenance`, one of observed-sanitized, experiment-derived,
  constructed (with a one-line note shown in the UI). Chooses the default demo.
- Of an item: `Item.origin`, the user message it came from. The only item provenance in v1.

## What never appears

A causation field. `CLOSING_LINE` is printed with every downstream result instead.
