/**
 * Hand-made stub Report for the story view. Test data only: no non-test file imports this.
 * Shapes follow the constructed-ticket expected values, with a LOST item and a restatement added by
 * hand so every drawing rule has a row to exercise.
 */
import { CLOSING_LINE, THRESHOLDS, type Compaction, type ItemReport, type Report, type Status } from '../../../domain'

function survival(status: Status, score: number, passage: string, lineIndex: number) {
  return {
    status,
    score,
    verbatim: score === 1,
    passage: { lineIndex, text: passage },
    matches: [],
    markedSpan: passage,
    entitiesInPassage: [],
    entitiesAnywhere: [],
    thresholds: THRESHOLDS,
  }
}

export const STUB_COMPACTION: Compaction = {
  boundaryUuid: 'b-0',
  ts: '2026-09-16T18:40:00.000Z',
  trigger: 'auto',
  preTokens: 161_000,
  postTokens: 12_400,
  summary: { uuid: 's-0', lines: [] },
}

const items: ItemReport[] = [
  {
    item: {
      id: '0:51:0',
      compactionIndex: 0,
      text: "don't modify scripts/rotate_keys.sh, platform team owns it, build rotate_keys.py alongside it",
      class: 'negation',
      entities: [{ kind: 'path', value: 'scripts/rotate_keys.sh' }],
      anchors: [{ kind: 'path', value: 'scripts/rotate_keys.sh' }],
      origin: { messageUuid: 'm-51', ts: '2026-09-16T17:02:00.000Z', line: 51 },
    },
    survival: survival('PRESERVED', 1, 'this file is explicitly off-limits per earlier user instruction', 159),
    downstream: { result: 'none_found', scope: ['file_edit', 'bash_write'] },
  },
  {
    item: {
      id: '0:91:1',
      compactionIndex: 0,
      text: "don't mention the ticket id VLX-4127 in any comment, only option B",
      class: 'negation',
      entities: [{ kind: 'ticket', value: 'VLX-4127' }],
      anchors: [{ kind: 'ticket', value: 'VLX-4127' }],
      origin: { messageUuid: 'm-91', ts: '2026-09-16T17:20:00.000Z', line: 91 },
    },
    survival: survival('DEGRADED', 0.1765, 'Second request (ticket VLX-4127): Implement a dry-run mode', 5),
    downstream: {
      result: 'matched',
      scope: ['mcp_comment', 'code_comment', 'commit', 'changelog', 'mcp_issue'],
      hit: {
        toolUseId: 'toolu-c-ticket-0001',
        ts: '2026-09-16T19:08:48.874Z',
        tool: 'mcp__tracker__save_comment',
        matcher: 'forbidden_token',
        artifact: 'mcp_comment',
        excerpt: ' out for the same reasoning we used for VLX-4127 option B."}',
        afterRestatement: false,
      },
    },
  },
  {
    item: {
      id: '0:127:2',
      compactionIndex: 0,
      text: 'this repo is snake_case everywhere in python, no camelCase, and output goes through logger.info, never print()',
      class: 'positive',
      entities: [{ kind: 'ident', value: 'logger.info' }],
      anchors: [],
      origin: { messageUuid: 'm-127', ts: '2026-09-16T17:41:00.000Z', line: 127 },
    },
    survival: survival('PRESERVED', 1, 'User feedback that triggered this', 145),
    downstream: { result: 'none_found', scope: ['file_edit'] },
    restatement: { messageUuid: 'm-201', ts: '2026-09-16T18:55:00.000Z', score: 0.71, by: 'score' },
  },
  {
    item: {
      id: '0:157:3',
      compactionIndex: 0,
      text: 'never deploy from a laptop, only through the release job on ci.internal',
      class: 'negation',
      entities: [{ kind: 'host', value: 'ci.internal' }],
      anchors: [{ kind: 'host', value: 'ci.internal' }],
      origin: { messageUuid: 'm-157', ts: '2026-09-16T18:02:00.000Z', line: 157 },
    },
    survival: survival('LOST', 0.1, 'The user wants me to locate remaining references', 9),
    downstream: { result: 'none_matchable', scope: [] },
  },
]

// Deliberately out of line order, so the layout's sort is exercised.
export const STUB_REPORT: Report = {
  sessionId: 'stub-session',
  compactionIndex: 0,
  items: [items[2], items[0], items[3], items[1]],
  closing: CLOSING_LINE,
}
