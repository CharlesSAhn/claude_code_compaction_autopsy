/**
 * Expected report for the constructed-file-edit fixture. Red until analyze is implemented (today it throws "not implemented").
 *
 * The rule vanished, the file got edited, the user re-typed it: the file rule is LOST (its anchor
 * scripts/rotate_keys.sh appears nowhere in the summary; rotate_keys.py surviving does not rescue it,
 * ruling 2026-09-16), an Edit hits the file two minutes after the boundary, and the human re-types the
 * rule at ten minutes (by score, 0.70). Other items PRESERVED.
 *
 * Every value below is the output of the reference implementation, scripts/autopsy-check.py
 * (`--fixture src/fixtures/constructed-file-edit.json --report-json`), run on 2026-09-16 at the T1-fixtures close;
 * the contract it implements is the one frozen at the end of that task. Nothing here is typed by hand.
 */
import { describe, expect, it } from 'vitest'
import { CLOSING_LINE, type Session } from './contract'
import { analyze } from './index'
import { fixtures } from '../fixtures/index.ts'


const session = fixtures.find((s) => s.id === 'constructed-file-edit') as Session

const EXPECTED = {
  "0:51:0": {
    "survival": {
      "status": "LOST",
      "score": 0.2,
      "verbatim": false,
      "passage": {
        "lineIndex": 20,
        "text": "   - Python stdlib only used in `scripts/rotate_keys.py`: `argparse`, `json`, `logging`, `os`, `sys`, `time`, `urllib.request`."
      },
      "matches": [
        {
          "start": 33,
          "end": 40,
          "token": "scripts",
          "fuzzy": false,
          "distance": 0
        },
        {
          "start": 41,
          "end": 55,
          "token": "rotate_keys.py",
          "fuzzy": false,
          "distance": 0
        }
      ],
      "markedSpan": "«scripts»/«rotate_keys.py»",
      "entitiesInPassage": [
        "rotate_keys.py"
      ],
      "entitiesAnywhere": [
        "rotate_keys.py"
      ],
      "thresholds": {
        "preserved": 0.75,
        "degraded": 0.35,
        "restated": 0.6,
        "fuzzyMaxDistance": 1,
        "fuzzyMinTokenLength": 6
      }
    },
    "downstream": {
      "result": "matched",
      "scope": [
        "file_edit",
        "bash_write"
      ],
      "hit": {
        "toolUseId": "toolu-c-file-0002",
        "ts": "2026-09-16T18:40:48.874Z",
        "tool": "Edit",
        "matcher": "forbidden_path",
        "artifact": "file_edit",
        "excerpt": "/home/dev/scratch/autopsy-run2/scripts/rotate_keys.sh",
        "afterRestatement": false
      }
    },
    "restatement": {
      "messageUuid": "c-file-0003",
      "ts": "2026-09-16T18:48:48.874Z",
      "score": 0.7,
      "by": "score"
    }
  },
  "0:91:1": {
    "survival": {
      "status": "PRESERVED",
      "score": 1,
      "verbatim": true,
      "passage": {
        "lineIndex": 157,
        "text": "   - \"looks fine. one thing while I think of it: dont refernce ticket ids in code comments or commit messages, like (VLX-4127 option B), customers read the changelog. carry on, add a --ttl flag too and make dry-run print what it would rotate.\""
      },
      "matches": [
        {
          "start": 18,
          "end": 165,
          "token": "one thing while I think of it: dont refernce ticket ids in code comments or commit messages, like (VLX-4127 option B), customers read the changelog",
          "fuzzy": false,
          "distance": 0
        }
      ],
      "markedSpan": "«one thing while I think of it: dont refernce ticket ids in code comments or commit messages, like (VLX-4127 option B), customers read the changelog»",
      "entitiesInPassage": [
        "VLX-4127"
      ],
      "entitiesAnywhere": [
        "VLX-4127"
      ],
      "thresholds": {
        "preserved": 0.75,
        "degraded": 0.35,
        "restated": 0.6,
        "fuzzyMaxDistance": 1,
        "fuzzyMinTokenLength": 6
      }
    },
    "downstream": {
      "result": "none_found",
      "scope": [
        "mcp_comment",
        "code_comment",
        "commit",
        "changelog",
        "mcp_issue"
      ]
    }
  },
  "0:127:2": {
    "survival": {
      "status": "PRESERVED",
      "score": 1,
      "verbatim": true,
      "passage": {
        "lineIndex": 140,
        "text": "     - User feedback that triggered this: \"review what you wrote against src/argon/rotate_1.py and src/argon/sched_2.py so it fits the house style. also for the record this repo is snake_case everywhere in python, no camelCase, and output goes through logger.info, never print(). fix anything that doesn't match.\" I verified snake_case and no-`print()` were already compliant; only the logging pattern needed fixing."
      },
      "matches": [
        {
          "start": 148,
          "end": 278,
          "token": "also for the record this repo is snake_case everywhere in python, no camelCase, and output goes through logger.info, never print()",
          "fuzzy": false,
          "distance": 0
        }
      ],
      "markedSpan": "«also for the record this repo is snake_case everywhere in python, no camelCase, and output goes through logger.info, never print()»",
      "entitiesInPassage": [
        "snake_case",
        "logger.info",
        "print()"
      ],
      "entitiesAnywhere": [
        "snake_case",
        "logger.info",
        "print()"
      ],
      "thresholds": {
        "preserved": 0.75,
        "degraded": 0.35,
        "restated": 0.6,
        "fuzzyMaxDistance": 1,
        "fuzzyMinTokenLength": 6
      }
    },
    "downstream": {
      "result": "none_found",
      "scope": [
        "file_edit"
      ]
    }
  },
  "0:157:3": {
    "survival": {
      "status": "PRESERVED",
      "score": 1,
      "verbatim": true,
      "passage": {
        "lineIndex": 8,
        "text": "   - Most recent request (current, unresolved): \"rotation still targets the old staging host somewhere. find it and fix it.\" This follows the earlier established fact (from the user, in an earlier conversation turn) that \"staging moved to argon-stg-02.internal last week, argon-stg-01 is decommissioned, so anything still pointing at 01 is a bug now.\" The user wants me to locate remaining references to the old `argon-stg-01.internal` staging host and fix them."
      },
      "matches": [
        {
          "start": 222,
          "end": 349,
          "token": "staging moved to argon-stg-02.internal last week, argon-stg-01 is decommissioned, so anything still pointing at 01 is a bug now",
          "fuzzy": false,
          "distance": 0
        }
      ],
      "markedSpan": "«staging moved to argon-stg-02.internal last week, argon-stg-01 is decommissioned, so anything still pointing at 01 is a bug now»",
      "entitiesInPassage": [
        "argon-stg-02.internal",
        "argon-stg-01"
      ],
      "entitiesAnywhere": [
        "argon-stg-02.internal",
        "argon-stg-01"
      ],
      "thresholds": {
        "preserved": 0.75,
        "degraded": 0.35,
        "restated": 0.6,
        "fuzzyMaxDistance": 1,
        "fuzzyMinTokenLength": 6
      }
    },
    "downstream": {
      "result": "none_matchable",
      "scope": []
    }
  }
} as const

describe('constructed-file-edit, expected report', () => {
  it('one report for the one boundary, one row per pre-labeled item, the closing line on it', () => {
    const { reports } = analyze(session)
    expect(reports).toHaveLength(1)
    expect(reports[0].sessionId).toBe('constructed-file-edit')
    expect(reports[0].compactionIndex).toBe(0)
    expect(reports[0].closing).toBe(CLOSING_LINE)
    expect(reports[0].items.map((r) => r.item.id).sort()).toEqual(Object.keys(EXPECTED).sort())
  })

  it.each(Object.entries(EXPECTED))('%s: survival, downstream, restatement equal the reference', (id, want) => {
    const { reports } = analyze(session)
    const got = reports[0].items.find((r) => r.item.id === id)
    expect(got, id).toBeDefined()
    expect(got?.item).toEqual(session.items?.find((it) => it.id === id))
    expect(got?.survival.score).toBeCloseTo(want.survival.score, 4)
    const { score: _s, ...survivalRest } = want.survival
    expect(got?.survival).toMatchObject(survivalRest)
    expect(got?.survival.structuralSection).toBe('structuralSection' in want.survival ? want.survival.structuralSection : undefined)
    expect(got?.survival.matches).toEqual(want.survival.matches)
    expect(got?.downstream).toEqual(want.downstream)
    expect(got?.restatement).toEqual('restatement' in want ? want.restatement : undefined)
  })
})
