/**
 * Architecture rules, enforced as tests.
 *
 * R1  Domain purity: non-test files under src/domain import only from within src/domain.
 *     No packages, no other src folders, no rendering libraries.
 * R2  Single entry: files outside src/domain reach the domain only via `src/domain`
 *     (its index), never a deeper path.
 * R3  No runtime loading anywhere in src: no fetch, XMLHttpRequest, WebSocket,
 *     EventSource, `?url` imports, or dynamic import() with a non-literal specifier.
 *     Demo data is bundled through static imports from src/fixtures.
 * R4  The domain has exactly one public entry point, src/domain/index.ts.
 *
 * Test files (*.test.ts, *.test.tsx) are exempt from R1 and R2 so they can pull
 * fixtures and reach internals, but not from R3.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '..')
const DOMAIN = join(SRC, 'domain')
const THIS_FILE = resolve(__filename)

interface ImportSite {
  file: string
  line: number
  specifier: string
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

const IMPORT_RE =
  /(?:^|\n)\s*(?:import|export)\s+(?:[^'"\n]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g

function importsOf(file: string): ImportSite[] {
  const text = readFileSync(file, 'utf8')
  const sites: ImportSite[] = []
  for (const m of text.matchAll(IMPORT_RE)) {
    const specifier = m[1] ?? m[2]
    if (!specifier) continue
    const start = m.index + (m[0].startsWith('\n') ? 1 : 0)
    const line = text.slice(0, start).split('\n').length
    sites.push({ file, line, specifier })
  }
  return sites
}

function isRelative(spec: string): boolean {
  return spec.startsWith('./') || spec.startsWith('../')
}

function resolveTarget(file: string, spec: string): string {
  return resolve(dirname(file), spec.replace(/\?.*$/, ''))
}

function isInside(target: string, dir: string): boolean {
  const rel = relative(dir, target)
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep))
}

function isTestFile(file: string): boolean {
  return /\.test\.tsx?$/.test(file)
}

function rel(file: string): string {
  return relative(SRC, file).split(sep).join('/')
}

function describeViolation(site: ImportSite, why: string): string {
  return `src/${rel(site.file)}:${site.line}  imports "${site.specifier}"  (${why})`
}

const allFiles = walk(SRC)

describe('architecture', () => {
  it('R4: the domain has a single public entry point', () => {
    expect(existsSync(join(DOMAIN, 'index.ts'))).toBe(true)
  })

  it('R1: src/domain imports nothing outside src/domain', () => {
    const violations: string[] = []
    for (const file of allFiles) {
      if (!isInside(file, DOMAIN) || isTestFile(file)) continue
      for (const site of importsOf(file)) {
        if (!isRelative(site.specifier)) {
          violations.push(describeViolation(site, 'package import in domain'))
        } else if (!isInside(resolveTarget(file, site.specifier), DOMAIN)) {
          violations.push(describeViolation(site, 'leaves src/domain'))
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('R2: outside src/domain, the domain is reached only through src/domain', () => {
    const violations: string[] = []
    for (const file of allFiles) {
      if (isInside(file, DOMAIN) || isTestFile(file)) continue
      for (const site of importsOf(file)) {
        if (!isRelative(site.specifier)) continue
        const target = resolveTarget(file, site.specifier)
        if (!isInside(target, DOMAIN)) continue
        const ok = target === DOMAIN || target === join(DOMAIN, 'index') || target === join(DOMAIN, 'index.ts')
        if (!ok) violations.push(describeViolation(site, 'deep import into src/domain'))
      }
    }
    expect(violations).toEqual([])
  })

  it('R3: nothing in src loads data at runtime', () => {
    const banned: Array<[RegExp, string]> = [
      [/\bfetch\s*\(/, 'fetch()'],
      [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
      [/\bWebSocket\b/, 'WebSocket'],
      [/\bEventSource\b/, 'EventSource'],
      [/\bimport\s*\(\s*[^'")]/, 'dynamic import() with a non-literal specifier'],
    ]
    const violations: string[] = []
    for (const file of allFiles) {
      if (resolve(file) === THIS_FILE) continue
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((text, i) => {
        for (const [re, label] of banned) {
          if (re.test(text)) violations.push(`src/${rel(file)}:${i + 1}  ${label}`)
        }
      })
      for (const site of importsOf(file)) {
        if (/\?url$/.test(site.specifier)) {
          violations.push(describeViolation(site, '?url import becomes a runtime request'))
        }
      }
    }
    expect(violations).toEqual([])
  })
})
