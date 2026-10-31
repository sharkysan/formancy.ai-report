import { describe, expect, test } from 'vitest'
import { RenderRefusal } from '../document.js'
import { groupBoundary } from '../fixtures/group-boundary.js'
import { imageInvalid } from '../fixtures/images.js'
import { longTable } from '../fixtures/long-table.js'
import { oneRow } from '../fixtures/one-row.js'
import { oversized } from '../fixtures/oversized.js'
import { tallRow } from '../fixtures/tall-row.js'
import { pdfmakeAdapter } from './pdfmake.js'
import { judge, markdownCell, median, parseArguments, REGENERATE, trialReport, type Trial } from './trial-report.js'

/**
 * The trial's judging and the document it writes. Renders here are real
 * pdfmake renders, judged by the corpus's real checks; only the document
 * writer is given a trial made up for the test, since what it is about is
 * how a result is written down, not what an engine did.
 */

describe('judging a render', () => {
  // A PDF that passes recorded as anything else, or with a page count taken
  // from anywhere but the PDF, would misreport the engine that made it.
  test('a PDF the checks find nothing wrong with passes, with its page count', async () => {
    expect(await judge(oneRow, pdfmakeAdapter.render(oneRow.document, { maxPages: oneRow.maxPages }))).toEqual({ kind: 'pass', pages: 1 })
  })

  // A PDF missing the rows its fixture expects must fail with the checks'
  // own words, or the document would say FAIL with no reason a reader can
  // check; the fixture's id is the row the document shows them in.
  test('a PDF the checks find wrong fails, with every problem and its page count', async () => {
    const outcome = await judge(longTable, pdfmakeAdapter.render(oneRow.document, { maxPages: longTable.maxPages }))
    expect(outcome).toMatchObject({ kind: 'fail', pages: 1 })
    const problems = outcome.kind === 'fail' ? outcome.problems : []
    expect(problems).toContain(`1 page; at least ${longTable.expect.minPagesExpected} expected`)
    expect(problems).toContain('ROW-0002 is missing')
    expect(problems.filter((problem) => problem.startsWith(`${longTable.id}:`))).toEqual([])
  })

  // The refusal a fixture asks for is the engine doing right, and the
  // document must say what it refused with and what it named.
  test('the refusal the fixture allows is refused as expected, with its code and subject', async () => {
    expect(await judge(imageInvalid, pdfmakeAdapter.render(imageInvalid.document, { maxPages: imageInvalid.maxPages }))).toEqual({
      kind: 'refused',
      code: 'invalid-asset',
      subject: 'logo-broken',
    })
  })

  // A refusal where a PDF was expected, or an engine that crashed, counted
  // as "refused" would hide the very failures the trial is for.
  test('a refusal the fixture does not allow, and a crash, fail', async () => {
    expect(await judge(oneRow, Promise.reject(new RenderRefusal('too-many-pages', 'needs more pages')))).toEqual({
      kind: 'fail',
      problems: ['refused with too-many-pages (needs more pages); expected a PDF'],
      pages: undefined,
    })
    expect(await judge(tallRow, Promise.reject(new TypeError('x is undefined')))).toEqual({
      kind: 'fail',
      problems: ['failed with TypeError: x is undefined; expected the refusal content-too-large'],
      pages: undefined,
    })
  })

  // Bytes that are not a PDF are the engine failing, not the judge.
  test('bytes PDF.js cannot read fail, saying so', async () => {
    const outcome = await judge(oneRow, Promise.resolve(new TextEncoder().encode('not a PDF')))
    expect(outcome).toMatchObject({ kind: 'fail', pages: undefined })
    expect(outcome.kind === 'fail' ? outcome.problems : []).toEqual([expect.stringMatching(/^PDF\.js cannot read the PDF: /)])
  })
})

describe('the median', () => {
  // A mean, or the first run, would let one slow run -- a collection,
  // another process on the machine -- become the reported time.
  test('is the middle of an odd count and the mean of the middle two of an even one, in any order', () => {
    expect(median([30, 10, 500, 20, 40])).toBe(30)
    expect(median([40, 10, 30, 20])).toBe(25)
    expect(median([7])).toBe(7)
  })

  // A timing of no runs has no time; NaN in the document would read as one.
  test('of no values is refused', () => {
    expect(() => median([])).toThrow(RangeError)
  })
})

describe('the command line', () => {
  // The date is the one thing the document states that the run cannot
  // measure, so it must be given, and given as a date.
  test('takes the date to print', () => {
    expect(parseArguments(['--date', '2026-10-14'])).toEqual({ date: '2026-10-14' })
  })

  // A document dated "14.10.2026", "2026-02-30" or nothing at all, or a
  // run that ignored an argument it did not know, would be wrong silently.
  test('refuses a missing, malformed or impossible date and anything more', () => {
    expect(() => parseArguments([])).toThrow(/^usage: /)
    expect(() => parseArguments(['--date'])).toThrow(/^usage: /)
    expect(() => parseArguments(['--out', 'x.md'])).toThrow(/^usage: /)
    expect(() => parseArguments(['--date', '2026-10-14', '--fast'])).toThrow(/^usage: /)
    for (const date of ['14.10.2026', '2026-1-14', '2026-02-30', '2026-13-01', '2026-10-14T00:00']) {
      expect(() => parseArguments(['--date', date])).toThrow(`--date ${date} is not a calendar date`)
    }
  })
})

/** A trial with one of each outcome, written for the document's tests. */
const TRIAL: Trial = {
  date: '2031-02-03',
  machine: { os: 'Plan 9 (fourth edition, mips)', cpu: 'Test CPU @ 1 GHz', logicalCpus: 6, memory: '7.5 GiB', node: 'v99.1.2' },
  engines: [
    { name: 'alpha', version: '1.2.3', packages: [{ name: 'alpha', version: '1.2.3', role: 'the engine' }] },
    { name: 'beta', version: '4.5.6', packages: [{ name: '@beta/core', version: '4.5.7', role: 'the layout' }] },
  ],
  reader: { name: 'pdfjs-dist', version: '9.8.7', role: 'reads every PDF back' },
  results: [
    {
      fixture: oneRow,
      outcomes: [
        { kind: 'pass', pages: 1 },
        { kind: 'pass', pages: 2 },
      ],
    },
    {
      fixture: tallRow,
      outcomes: [
        { kind: 'pass', pages: 11 },
        { kind: 'refused', code: 'content-too-large', subject: 'lines' },
      ],
    },
    {
      fixture: groupBoundary,
      outcomes: [
        { kind: 'pass', pages: 4 },
        { kind: 'fail', problems: ["page 2: the last table row is the group header 'Region R19'", 'a | b is split'], pages: 5 },
      ],
    },
    {
      fixture: imageInvalid,
      outcomes: [
        { kind: 'refused', code: 'invalid-asset', subject: 'logo-broken' },
        { kind: 'fail', problems: ['failed with Error: not a PNG; expected the refusal invalid-asset'], pages: undefined },
      ],
    },
    {
      fixture: oversized,
      outcomes: [
        { kind: 'refused', code: 'too-many-pages', subject: undefined },
        { kind: 'refused', code: 'too-many-pages', subject: undefined },
      ],
    },
  ],
  timings: [
    {
      fixture: longTable,
      engines: [
        { outcome: { kind: 'pass', pages: 7 }, milliseconds: [30, 10, 50, 20, 40] },
        { outcome: { kind: 'fail', problems: ['ROW-0002 is missing', 'ROW-0003 is missing'], pages: 7 }, milliseconds: [9, 8, 7] },
      ],
    },
    {
      fixture: groupBoundary,
      engines: [
        { outcome: { kind: 'pass', pages: 4 }, milliseconds: [0.25] },
        {
          outcome: { kind: 'fail', problems: ["page 2: the last table row is the group header 'Region R19'", 'a | b is split'], pages: 5 },
          milliseconds: [12],
        },
      ],
    },
  ],
}

/** A table line's cells. An escaped `\|` has no space before its bar, so it stays inside its cell. */
function cells(line: string): string[] {
  return line.slice(2, -2).split(' | ')
}

/** The cells of the table line that begins with `start`. */
function row(markdown: string, start: string): string[] {
  const line = markdown.split('\n').find((text) => text.startsWith(start))
  if (line === undefined) throw new Error(`no line starts with ${start}`)
  return cells(line)
}

describe('the trial document', () => {
  const markdown = trialReport(TRIAL)

  // A document dated by somebody's clock, or not saying how to regenerate
  // it, could not be reproduced from what it says.
  test('carries the date it was given and the commands that regenerate it', () => {
    expect(markdown).toContain(`dated ${TRIAL.date};`)
    expect(markdown).toContain(['```bash', ...REGENERATE, '```'].join('\n'))
  })

  // Times without the machine, or results without the engine versions,
  // cannot be compared with anything.
  test('names the machine and every package version it was given', () => {
    expect(markdown).toContain('- **Operating system:** Plan 9 (fourth edition, mips)')
    expect(markdown).toContain('- **CPU:** Test CPU @ 1 GHz, 6 logical CPUs')
    expect(markdown).toContain('- **Memory:** 7.5 GiB')
    expect(markdown).toContain('- **Node.js:** v99.1.2')
    expect(row(markdown, '| beta |')).toEqual(['beta', '`@beta/core`', '4.5.7', 'the layout'])
    expect(row(markdown, '| every check |')).toEqual(['every check', '`pdfjs-dist`', '9.8.7', 'reads every PDF back'])
  })

  // Each outcome must read as what it was: a pass with its pages, a
  // refusal with its code and subject, a failure with the first problem.
  test('writes each fixture as a row, an engine to a column, with what the fixture expected', () => {
    expect(row(markdown, '| Fixture |')).toEqual(['Fixture', 'Expected', 'alpha 1.2.3', 'beta 4.5.6'])
    expect(row(markdown, '| `one-row`')).toEqual([`\`one-row\`: ${oneRow.title}`, 'a PDF', 'pass, 1 page', 'pass, 2 pages'])
    expect(row(markdown, '| `tall-row`')).toEqual([
      `\`tall-row\`: ${tallRow.title}`,
      'a PDF, or refusal `content-too-large`',
      'pass, 11 pages',
      'refused as expected: `content-too-large` naming `lines`',
    ])
    expect(row(markdown, '| `group-boundary`').slice(2)).toEqual([
      'pass, 4 pages',
      "**FAIL** (5 pages): page 2: the last table row is the group header 'Region R19' (and 1 more)",
    ])
    // A failure with no PDF has no pages to give, and a fixture that only
    // allows a refusal says which, with its subject when it names one.
    expect(row(markdown, '| `image-invalid`').slice(1)).toEqual([
      'refusal `invalid-asset` naming `logo-broken`',
      'refused as expected: `invalid-asset` naming `logo-broken`',
      '**FAIL**: failed with Error: not a PNG; expected the refusal invalid-asset',
    ])
    expect(row(markdown, '| `oversized`').slice(1)).toEqual([
      'refusal `too-many-pages`',
      'refused as expected: `too-many-pages`',
      'refused as expected: `too-many-pages`',
    ])
  })

  // A failure reduced to its first problem would hide the rest of them, and
  // a timed document outside the corpus -- the hundred-page table -- has no
  // other place its problems are written.
  test('lists every problem of every failure once, timed documents outside the corpus included', () => {
    const failed = markdown.slice(markdown.indexOf('## What failed, in full'), markdown.indexOf('## Render times'))
    expect(failed).toBe(
      [
        '## What failed, in full',
        '',
        '### `group-boundary` with beta',
        '',
        "- page 2: the last table row is the group header 'Region R19'",
        '- a | b is split',
        '',
        '### `image-invalid` with beta',
        '',
        '- failed with Error: not a PNG; expected the refusal invalid-asset',
        '',
        '### `long-table` with beta',
        '',
        '- ROW-0002 is missing',
        '- ROW-0003 is missing',
        '',
        '',
      ].join('\n'),
    )
  })

  // A heading over nothing would read as though something had failed.
  test('has no failures section when nothing failed', () => {
    const clean = trialReport({ ...TRIAL, results: TRIAL.results.slice(0, 2), timings: [] })
    expect(clean).not.toContain('## What failed')
    expect(clean).toContain('## Render times')
  })

  // A `|` inside a cell ends the cell: every row of a table must keep the
  // header's number of cells, or the columns after it shift.
  test('keeps every table row to its header width', () => {
    const tables = markdown.split('\n\n').filter((block) => block.startsWith('| '))
    expect(tables.length).toBe(3)
    for (const block of tables) {
      const widths = block.split('\n').map((line) => cells(line).length)
      expect(new Set(widths).size).toBe(1)
    }
  })

  // A failure reason is an engine's text, so it can hold a backslash before a
  // bar. Escaped bar first and backslash never, "a\|b" would become "a\\|b",
  // which Markdown reads as a literal backslash followed by a cell boundary.
  test('escapes a backslash before it escapes a bar, and flattens line breaks', () => {
    expect(markdownCell('a|b')).toBe('a\\|b')
    expect(markdownCell('a\\|b')).toBe('a\\\\\\|b')
    expect(markdownCell('ends in \\')).toBe('ends in \\\\')
    expect(markdownCell('one\n  two')).toBe('one two')
  })

  // A mean, the first run or a rounded-up time would misstate what was
  // measured; the run count says how much the median rests on.
  test('gives each timing its outcome, run count, median, fastest and slowest', () => {
    expect(row(markdown, '| `long-table` | alpha')).toEqual(['`long-table`', 'alpha', 'pass, 7 pages', '5', '30 ms', '10 ms', '50 ms'])
    expect(row(markdown, '| `long-table` | beta')).toEqual([
      '`long-table`',
      'beta',
      '**FAIL** (7 pages): ROW-0002 is missing (and 1 more)',
      '3',
      '8 ms',
      '7 ms',
      '9 ms',
    ])
    // Under a millisecond, a whole number would print a refusal's time as 0 ms.
    expect(row(markdown, '| `group-boundary` | alpha').slice(4)).toEqual(['0.25 ms', '0.25 ms', '0.25 ms'])
  })

  // The reading is the part a reader quotes; each statement in it must be
  // derived from the results, the failures and the fastest engine included.
  test('reads the results without adding to them', () => {
    expect(markdown).toContain('- **alpha**, on 5 fixtures, rendered 3 that pass, refused 2 as their fixtures expect, and failed none.')
    expect(markdown).toContain(
      '- **beta**, on 5 fixtures, rendered 1 that pass, refused 2 as their fixtures expect, and failed 2: `group-boundary`, `image-invalid`.',
    )
    expect(markdown).toContain('- `tall-row` allows a PDF or a refusal. alpha: pass, 11 pages; beta: refused as expected: `content-too-large` naming `lines`.')
    expect(markdown).toContain("- `long-table`, fastest first by median: beta 8 ms, then alpha 30 ms. beta's time is for a PDF that fails its checks.")
    expect(markdown).toContain("- `group-boundary`, fastest first by median: alpha 0.25 ms, then beta 12 ms. beta's time is for a PDF that fails its checks.")
  })
})
