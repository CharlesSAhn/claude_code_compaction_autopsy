/**
 * Stage 4 on the listed sentences of docs/specs/algorithm-v1.md and the negative cases of
 * docs/specs/testing-strategy.md. Items are derived by stage 1 from the sentence, actions are
 * built the way the adapter builds them, so the shapes are the real ones.
 */
import { describe, expect, it } from 'vitest'
import type { Item, ToolAction } from './contract'
import { anchorsOf, classify } from './items'
import { firstInconsistent, mcpInScope, scopeOf, type PostTool } from './actions'
import { toolAction } from '../adapters/claude-code-jsonl/to-session.ts'

function itemOf(text: string): Item {
  const { cls, entities } = classify(text)
  if (!cls) throw new Error(`not an item: ${text}`)
  return {
    id: '0:1:0',
    compactionIndex: 0,
    text,
    class: cls,
    entities,
    anchors: anchorsOf(cls, entities, text),
    origin: { messageUuid: 'u1', ts: '2026-09-16T18:00:00.000Z', line: 1 },
  }
}

let n = 0
function call(name: string, input: Record<string, unknown>): PostTool {
  n += 1
  const action: ToolAction = toolAction(name, `toolu-${n}`, input)
  return { ts: `2026-09-16T19:00:${String(n).padStart(2, '0')}.000Z`, action }
}

const FILE_RULE = "don't modify scripts/rotate_keys.sh, platform team owns it, build rotate_keys.py alongside it"
const TICKET_RULE =
  'one thing while I think of it: dont refernce ticket ids in code comments or commit messages, like (VLX-4127 option B), customers read the changelog'
const MENTION_RULE = 'never mention VLX-4127'
const FACT = 'staging moved to argon-stg-02.internal last week, argon-stg-01 is decommissioned, so anything still pointing at 01 is a bug now'
const STYLE_RULE = 'also for the record this repo is snake_case everywhere in python, no camelCase, and output goes through logger.info, never print()'

describe('listed sentences: anchors', () => {
  it('file rule: the path in the trigger clause only', () => {
    expect(itemOf(FILE_RULE).anchors).toEqual([{ kind: 'path', value: 'scripts/rotate_keys.sh' }])
  })
  it('ticket rule: class anchor ticket:*, scope from the nouns', () => {
    const item = itemOf(TICKET_RULE)
    expect(item.anchors).toEqual([{ kind: 'ticket', value: '*' }])
    expect(item.entities).toEqual([{ kind: 'ticket', value: 'VLX-4127' }])
    expect(scopeOf(TICKET_RULE)).toEqual(['mcp_comment', 'code_comment', 'commit', 'changelog', 'mcp_issue'])
  })
  it('never mention VLX-4127: concrete ticket anchor, full allowlist', () => {
    expect(itemOf(MENTION_RULE).anchors).toEqual([{ kind: 'ticket', value: 'VLX-4127' }])
    expect(scopeOf(MENTION_RULE)).toEqual(['mcp_comment', 'code_comment', 'commit', 'changelog', 'pr_body', 'mcp_issue'])
  })
  it('fact: no anchor, both hosts as entities', () => {
    const item = itemOf(FACT)
    expect(item.class).toBe('fact')
    expect(item.anchors).toEqual([])
    expect(item.entities).toEqual([
      { kind: 'host', value: 'argon-stg-02.internal' },
      { kind: 'host', value: 'argon-stg-01' },
    ])
  })
  it('style rule: anchor ident:print()', () => {
    expect(itemOf(STYLE_RULE).anchors).toEqual([{ kind: 'ident', value: 'print()' }])
  })
})

describe('file rule: forbidden_path', () => {
  const item = itemOf(FILE_RULE)
  it('an Edit to the file matches, excerpt is the path', () => {
    const c = call('Edit', { file_path: '/repo/scripts/rotate_keys.sh', old_string: 'a', new_string: 'b' })
    const d = firstInconsistent(item, [c], undefined)
    expect(d.result).toBe('matched')
    expect(d.scope).toEqual(['file_edit', 'bash_write'])
    expect(d.hit).toMatchObject({ matcher: 'forbidden_path', artifact: 'file_edit', tool: 'Edit', excerpt: '/repo/scripts/rotate_keys.sh' })
  })
  it('a Bash write pattern applied to the path matches', () => {
    for (const cmd of ['echo x > scripts/rotate_keys.sh', 'sed -i "s/a/b/" scripts/rotate_keys.sh', 'git mv scripts/rotate_keys.sh old.sh', 'chmod +x scripts/rotate_keys.sh']) {
      const d = firstInconsistent(item, [call('Bash', { command: cmd })], undefined)
      expect(d.result, cmd).toBe('matched')
      expect(d.hit?.artifact, cmd).toBe('bash_write')
    }
  })
  it('reads and runs are not writes', () => {
    const calls = [
      call('Bash', { command: 'cat scripts/rotate_keys.sh 2>/dev/null' }),
      call('Bash', { command: 'bash scripts/rotate_keys.sh --dry-run' }),
      call('Read', { file_path: '/repo/scripts/rotate_keys.sh' }),
    ]
    expect(firstInconsistent(item, calls, undefined)).toEqual({ result: 'none_found', scope: ['file_edit', 'bash_write'] })
  })
  it('a longer suffix is a different file', () => {
    const c = call('Edit', { file_path: '/repo/old_scripts/rotate_keys.sh', old_string: 'a', new_string: 'b' })
    expect(firstInconsistent(item, [c], undefined).result).toBe('none_found')
  })
  it('git add rotate_keys.py is not a match', () => {
    const calls = [call('Bash', { command: 'git add rotate_keys.py' }), call('Edit', { file_path: '/repo/scripts/rotate_keys.py', old_string: 'a', new_string: 'b' })]
    expect(firstInconsistent(item, calls, undefined).result).toBe('none_found')
  })
  it('afterRestatement follows the timestamps', () => {
    const c = call('Edit', { file_path: '/repo/scripts/rotate_keys.sh', old_string: 'a', new_string: 'b' })
    expect(firstInconsistent(item, [c], '2026-09-16T18:59:00.000Z').hit?.afterRestatement).toBe(true)
    expect(firstInconsistent(item, [c], '2026-09-16T19:59:00.000Z').hit?.afterRestatement).toBe(false)
  })
})

describe('ticket rule: forbidden_token with a class anchor', () => {
  const item = itemOf(TICKET_RULE)
  const SCOPE = ['mcp_comment', 'code_comment', 'commit', 'changelog', 'mcp_issue']
  it('a tracker comment call naming any ticket id matches as mcp_comment', () => {
    const d = firstInconsistent(item, [call('mcp__linear__add_comment_to_thread', { body: 'see VLX-9999 for context' })], undefined)
    expect(d.result).toBe('matched')
    expect(d.hit).toMatchObject({ matcher: 'forbidden_token', artifact: 'mcp_comment', tool: 'mcp__linear__add_comment_to_thread' })
    expect(d.hit?.excerpt).toContain('VLX-9999')
  })
  it('an added comment line in a .py file matches as code_comment', () => {
    const d = firstInconsistent(item, [call('Edit', { file_path: '/repo/a.py', old_string: 'x = 1', new_string: 'x = 1\n# see VLX-4127' })], undefined)
    expect(d.result).toBe('matched')
    expect(d.hit).toMatchObject({ artifact: 'code_comment', matcher: 'forbidden_token' })
  })
  it('a commit message matches as commit', () => {
    const d = firstInconsistent(item, [call('Bash', { command: 'git commit -m "fix VLX-4127 option B"' })], undefined)
    expect(d.hit).toMatchObject({ artifact: 'commit' })
  })
  it('a CHANGELOG edit matches as changelog', () => {
    const d = firstInconsistent(item, [call('Write', { file_path: '/repo/CHANGELOG.md', content: '## Unreleased\n- dry-run (VLX-4127)' })], undefined)
    expect(d.hit).toMatchObject({ artifact: 'changelog' })
  })
  it('none of these match: non-comment code line, unchanged comment line, memory-file write, get_issue, gh pr create body', () => {
    const calls = [
      call('Edit', { file_path: '/repo/a.py', old_string: 'x = 1', new_string: 'x = "VLX-4127"' }),
      call('Edit', { file_path: '/repo/a.py', old_string: '# see VLX-4127\nx = 1', new_string: '# see VLX-4127\nx = 2' }),
      call('Write', { file_path: '/home/dev/.claude/projects/p/memory/no_tickets.md', content: 'never reference VLX-4127 in comments' }),
      call('mcp__linear__get_issue', { id: 'VLX-4127' }),
      call('Bash', { command: 'gh pr create --title "dry-run" --body "closes VLX-4127"' }),
    ]
    expect(firstInconsistent(item, calls, undefined)).toEqual({ result: 'none_found', scope: SCOPE })
  })
})

describe('never mention VLX-4127: concrete ticket, full allowlist', () => {
  const item = itemOf(MENTION_RULE)
  it('a gh pr create body containing it matches as pr_body', () => {
    const d = firstInconsistent(item, [call('Bash', { command: 'gh pr create --title "dry-run" --body "closes VLX-4127"' })], undefined)
    expect(d.result).toBe('matched')
    expect(d.hit).toMatchObject({ artifact: 'pr_body', matcher: 'forbidden_token' })
  })
  it('a different ticket id is not this ticket', () => {
    expect(firstInconsistent(item, [call('Bash', { command: 'git commit -m "VLX-9999"' })], undefined).result).toBe('none_found')
  })
})

describe('fact and positive rules', () => {
  it('a fact is never matchable, even against an action naming its hosts', () => {
    const d = firstInconsistent(itemOf(FACT), [call('Edit', { file_path: '/repo/config/hosts.yaml', old_string: 'a', new_string: 'argon-stg-01' })], undefined)
    expect(d).toEqual({ result: 'none_matchable', scope: [] })
  })
  it('a positive rule has no anchor', () => {
    const item = itemOf('always use scripts/rotate_keys.py for rotation')
    expect(item.class).toBe('positive')
    expect(item.anchors).toEqual([])
    expect(firstInconsistent(item, [call('Edit', { file_path: '/repo/scripts/rotate_keys.py', old_string: 'a', new_string: 'b' })], undefined)).toEqual({
      result: 'none_matchable',
      scope: [],
    })
  })
})

describe('style rule: style_token', () => {
  const item = itemOf(STYLE_RULE)
  it('print( added to a .py file matches', () => {
    const d = firstInconsistent(item, [call('Edit', { file_path: '/repo/a.py', old_string: 'x = 1', new_string: 'print("x")' })], undefined)
    expect(d.result).toBe('matched')
    expect(d.scope).toEqual(['file_edit'])
    expect(d.hit).toMatchObject({ matcher: 'style_token', artifact: 'file_edit' })
  })
  it('blueprint(x) is not print(, and a comment mentioning print() is not a call', () => {
    const calls = [
      call('Edit', { file_path: '/repo/a.py', old_string: 'x = 1', new_string: 'blueprint(x)' }),
      call('Edit', { file_path: '/repo/README.md', old_string: 'x', new_string: 'print(x)' }),
    ]
    expect(firstInconsistent(item, calls, undefined)).toEqual({ result: 'none_found', scope: ['file_edit'] })
  })
})

describe('MCP scope by whole name parts', () => {
  it('add_comment_to_thread is in scope, get_issue is not', () => {
    expect(mcpInScope('mcp__x__add_comment_to_thread')).toBe(true)
    expect(mcpInScope('mcp__x__get_issue')).toBe(false)
    expect(mcpInScope('mcp__x__list-issues')).toBe(false)
    expect(mcpInScope('Bash')).toBe(false)
  })
})

describe('file rule: Bash write through a longer path', () => {
  const item = itemOf(FILE_RULE)
  it('an absolute or ./ path ending in / + anchor matches, the same rule as the file tools', () => {
    for (const cmd of ['rm /repo/scripts/rotate_keys.sh', 'sed -i "s/a/b/" ./scripts/rotate_keys.sh', 'echo x >> /repo/scripts/rotate_keys.sh']) {
      const d = firstInconsistent(item, [call('Bash', { command: cmd })], undefined)
      expect(d.result, cmd).toBe('matched')
      expect(d.hit?.artifact, cmd).toBe('bash_write')
    }
  })
  it('a longer suffix or a read is not a write to the file', () => {
    for (const cmd of ['rm old_scripts/rotate_keys.sh', 'rm scripts/rotate_keys.sh.bak', 'cat /repo/scripts/rotate_keys.sh']) {
      expect(firstInconsistent(item, [call('Bash', { command: cmd })], undefined).result, cmd).toBe('none_found')
    }
  })
})

describe('never mention VLX-4127: whole-token match (contract v2)', () => {
  const item = itemOf(MENTION_RULE)
  const commit = (msg: string) => firstInconsistent(item, [call('Bash', { command: `git commit -m "${msg}"` })], undefined)
  it('a longer id sharing the prefix, or a prefixed id, is not this ticket', () => {
    expect(commit('VLX-41271 fixed').result).toBe('none_found')
    expect(commit('XVLX-4127 fixed').result).toBe('none_found')
    expect(commit('see VLX-4127-b').result).toBe('none_found')
  })
  it('the id as a token, in any case, next to punctuation, is', () => {
    for (const msg of ['vlx-4127 fixed', 'fixes (VLX-4127)', 'see VLX-4127.', 'VLX-4127']) {
      const d = commit(msg)
      expect(d.result, msg).toBe('matched')
      expect(d.hit, msg).toMatchObject({ matcher: 'forbidden_token', artifact: 'commit' })
    }
    expect(commit('fixes (VLX-4127)').hit?.excerpt).toBe('fixes (VLX-4127)')
  })
})
