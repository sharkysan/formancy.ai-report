import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { ROOT, recordedConsole, recordedText, staleRecorded, TABLE_LEFT_OUT } from './record.mjs'

/**
 * What a gate run leaves for the judges' tests (0027): its outputs without
 * the machine's path, and a recorded corpus that is the one the gate
 * judges.
 */
const here = dirname(fileURLToPath(import.meta.url))
const recordedDir = join(here, 'recorded')

describe('a recorded text', () => {
  // KoSIT names every file it read by its absolute path, and Mustang its
  // JAR's: a run recorded on a workstation committed that workstation's
  // directories, its user's and its worktree's names among them.
  test('names the repository by a placeholder, however a tool spells its path', () => {
    const root = 'C:\\Work\\repo'
    const text = 'URL=jar:file:/C:/Work/repo/.e-invoice-cache/mustang.jar\r\nfrom file:///C:/Work/repo/x.xml and C:\\Work\\repo\\y.xml\r\n'
    expect(recordedText(text, root)).toBe(`URL=jar:file:/${ROOT}/.e-invoice-cache/mustang.jar\nfrom file:///${ROOT}/x.xml and ${ROOT}\\y.xml\n`)
    expect(recordedText('/home/runner/work/r/r/test-results/a.xml', '/home/runner/work/r/r')).toBe(`${ROOT}/test-results/a.xml`)
    // KoSIT's console table cuts a long path short.
    expect(recordedText('|/C:/Work/rep...|   Y   |', root)).toBe(`|/${ROOT}...|   Y   |`)
    expect(recordedText('|/home/runner/wo...|', '/home/runner/work/r/r')).toBe(`|${ROOT}...|`)
  })

  // KoSIT's results table wraps a path across lines and cuts it at the
  // column's edge, so no replacement finds it whole: the record leaves the
  // table out, and keeps what the judges read -- the version, the
  // configuration and the counts -- which stand outside it.
  test("leaves KoSIT's results table out of its console, and nothing else", () => {
    const rule = '-'.repeat(40)
    const console_ = ['KoSIT Validator version 1.6.3', 'Results:', rule, '|File |Schema|', '|/C:/Work/formancy.ai-repo|   Y  |', 'rt/.claude/x.xml', rule, 'Acceptable:  3  Rejected:  6', ''].join('\r\n')
    expect(recordedConsole(console_, 'C:\\Work\\formancy.ai-report')).toBe(['KoSIT Validator version 1.6.3', 'Results:', TABLE_LEFT_OUT, 'Acceptable:  3  Rejected:  6', ''].join('\n'))
    expect(recordedConsole('KoSIT Validator version 1.6.3\nAcceptable:  0\n', 'C:\\r')).toBe('KoSIT Validator version 1.6.3\nAcceptable:  0\n')
    expect(() => recordedConsole(`Results:\n${rule}\n|row|\n`, 'C:\\r')).toThrow('KoSIT’s console has a results table that does not close')
  })

  // The run committed here is recorded so: no file of it names a machine.
  test('is how every recorded output is written', () => {
    const files = ['corpus', 'mustang', 'kosit'].flatMap((part) => readdirSync(join(recordedDir, part)).map((name) => join(recordedDir, part, name)))
    expect(files.length).toBeGreaterThan(10)
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      expect(text, file).not.toMatch(/[A-Z]:[\\/]|\/home\/|\/Users\/|\r/)
    }
  })
})

describe('the recorded corpus', () => {
  const entries = [
    { file: 'a.xml', xml: '<a/>' },
    { file: 'b.xml', xml: '<b/>' },
  ]
  // The judges' tests read the recorded corpus and the outputs on it. One
  // the runtime no longer writes -- its XML changed, a control added or
  // gone -- leaves them testing files the gate does not judge, and the run
  // says so, naming how to record again.
  test('is the corpus this run judged, file for file and byte for byte', () => {
    expect(staleRecorded(entries, new Map([['a.xml', '<a/>'], ['b.xml', '<b/>']]))).toEqual([])
    expect(staleRecorded(entries, new Map([['a.xml', '<a />'], ['c.xml', '<c/>']]))).toEqual([
      'scripts/e-invoice/recorded/corpus/a.xml is not the XML this run judged: run node scripts/e-invoice.mjs --record, and commit what it writes',
      'scripts/e-invoice/recorded/corpus/ holds no b.xml, which this run judged: run node scripts/e-invoice.mjs --record, and commit what it writes',
      'scripts/e-invoice/recorded/corpus/c.xml is no file this run judged: run node scripts/e-invoice.mjs --record, and commit what it writes',
    ])
  })
})
