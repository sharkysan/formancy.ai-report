import { describe, expect, test } from 'vitest'
import type { ReportDefinition } from './definition.js'
import { reportHash } from './hash.js'
import { editable, edited, eInvoiceReport, getAt, refusals, richReport, setAt } from './test-support.js'
import { validateReport } from './validate.js'
import { BASELINE_SHIFTS } from './values.js'
import type { BaselineShift, PageCountInline, PageNumberInline, TextInline } from './values.js'

/**
 * A run of a paragraph set below or above the line (0061): literal text, a
 * field, a parameter, an expression and an aggregate take `baseline`, in a
 * text component's runs alone, wherever the text stands; a page counter
 * takes none, and everywhere else a run is read -- what a code encodes, a
 * table's cells -- one is refused as `misplaced-baseline`.
 */

/** A FieldRef to a header field. */
const header = (field: string) => ({ dataset: 'header', field })

/** A run of each kind that takes a baseline, each valid in the report's scope in any region. */
const RUNS = {
  text: { kind: 'text', text: '2' },
  field: { kind: 'field', field: header('customer') },
  parameter: { kind: 'parameter', parameter: 'region' },
  expression: { kind: 'expression', expression: { cel: 'header.customer' } },
  aggregate: { kind: 'aggregate', aggregate: 'lines', over: 'report' },
} as const

/** The fixture's paragraphs, one where each kind of place holds one: the body, a page region, a section, a columns block and a keep-together block. */
const PARAGRAPHS = {
  body: '/regions/body/0',
  'page footer': '/regions/pageFooter/0',
  section: '/regions/summary/0/components/1',
  'columns block': '/regions/reportHeader/0/columns/1/components/0',
  'keep-together block': '/regions/body/3/components/1',
} as const

/** The fixture with `run` appended to the paragraph at `paragraph`, and the pointer it stands at. */
function withRun(paragraph: string, run: object): { readonly report: Record<string, unknown>; readonly at: string } {
  const report = editable(richReport())
  const content = getAt(report, `${paragraph}/content`) as unknown[]
  const at = `${paragraph}/content/${content.length}`
  setAt(report, at, run)
  return { report, at }
}

describe('a run set below or above the line', () => {
  // A formula's digit and a unit's power are the template's own text, and
  // an exponent or a footnote's number may be read from the data: each kind
  // of run that prints a value takes the property, and the validator hands
  // it on whole, wherever the paragraph stands. Dropped here, every
  // later stage would print the run on the line, which no one would see
  // until a formula read wrong.
  test('is read back whole, of each kind and either way, in every place a paragraph stands', () => {
    expect(BASELINE_SHIFTS).toEqual(['subscript', 'superscript'])
    for (const [place, paragraph] of Object.entries(PARAGRAPHS)) {
      for (const [kind, run] of Object.entries(RUNS)) {
        for (const baseline of BASELINE_SHIFTS) {
          const { report, at } = withRun(paragraph, { ...run, baseline })
          const outcome = validateReport(report)
          expect(outcome.valid ? [] : outcome.errors.map((error) => `${error.code} ${error.path}`), `${kind} ${baseline} in the ${place}`).toEqual([])
          expect(outcome.valid && getAt(outcome.report, at), `${kind} ${baseline} in the ${place}`).toEqual({ ...run, baseline })
        }
      }
    }
  })

  // The hash names a published version: two reports that print a digit
  // once on the line and once below it are two reports, and must never
  // share one. A report that sets none hashes as it did, which
  // `hash.test.ts` pins on a fixed report outside this package.
  test('is part of what the hash names', () => {
    const on = reportHash(richReport())
    const hashes = BASELINE_SHIFTS.map((baseline) =>
      reportHash(validated(edited((r) => setAt(r, '/regions/body/0/content/0', { kind: 'text', text: 'Ordered on ', baseline })))),
    )
    expect(new Set([on, ...hashes]).size).toBe(3)
  })

  // A baseline the format does not have -- a typo, or a later version's
  // "raised" -- would leave the renderer to guess how far to move the run.
  test('is subscript or superscript, and nothing else', () => {
    for (const baseline of ['raised', 'Subscript', 'sub', true, 0, null]) {
      const { report, at } = withRun(PARAGRAPHS.body, { ...RUNS.text, baseline })
      expect(refusals(report), String(baseline)).toEqual([`not-one-of ${at}/baseline`])
    }
  })

  // A page's number raised is no formula, and the field is the engine's to
  // fill: a counter takes no baseline, as it takes no other property.
  test('is refused on a page number and a page count as a property they do not have', () => {
    for (const index of [1, 3]) {
      const at = `/regions/pageFooter/0/content/${index}`
      expect(refusals(edited((r) => setAt(r, `${at}/baseline`, 'superscript'))), at).toEqual([`unknown-property ${at}/baseline`])
    }
    // @ts-expect-error -- a page number has no baseline in the published types either.
    const counter: PageNumberInline = { kind: 'pageNumber', baseline: 'superscript' }
    // @ts-expect-error -- nor has a page count.
    const count: PageCountInline = { kind: 'pageCount', baseline: 'subscript' }
    const shifted: TextInline = { kind: 'text', text: '2', baseline: 'subscript' satisfies BaselineShift }
    expect([counter.kind, count.kind, shifted.baseline]).toEqual(['pageNumber', 'pageCount', 'subscript'])
  })
})

describe('a run set below or above the line, where a paragraph is not', () => {
  // What a code encodes is its text alone: a run's place above or below
  // the line is no part of a QR code's payload, an EPC QR code's, a
  // QR-bill's or an e-invoice's XML. Taken and ignored, it would be a
  // property that does nothing, and an author would believe it printed.
  test("is refused in a QR code's content, an EPC QR code's, a QR-bill's and an e-invoice's texts", () => {
    const encoded: readonly [string, ReportDefinition, string][] = [
      ['a QR code', richReport(), '/regions/summary/2/content/1'],
      ['an EPC QR code', richReport(), '/regions/summary/3/beneficiary/0'],
      ['an EPC QR code', richReport(), '/regions/summary/3/information/1'],
      ['a QR-bill', richReport(), '/paymentPart/message/0'],
      ['a QR-bill', richReport(), '/paymentPart/debtor/name/0'],
      ['an e-invoice', eInvoiceReport(), '/eInvoice/seller/name/0'],
      ['an e-invoice', eInvoiceReport(), '/eInvoice/number/1'],
    ]
    for (const [what, base, at] of encoded) {
      const report = editable(base)
      setAt(report, `${at}/baseline`, 'subscript')
      const outcome = validateReport(report)
      const errors = outcome.valid ? [] : outcome.errors
      expect(
        errors.map((error) => `${error.code} ${error.path}`),
        at,
      ).toEqual([`misplaced-baseline ${at}/baseline`])
      expect(errors[0]?.message, at).toContain(`what ${what} encodes`)
    }
  })

  // A table's cell prints one string at one size: a column's value is one
  // run, so its baseline would move the whole cell, which is no formula,
  // and a group header's runs are joined into one string before the
  // renderer sees them. Taken, it would print on the line.
  test("is refused in a column's value, a group's header and footer cells, and the table's totals", () => {
    const cells = [
      '/regions/body/2/columns/0/value',
      '/regions/body/2/columns/3/value',
      '/regions/body/2/group/header/0',
      '/regions/body/2/group/header/1',
      '/regions/body/2/group/footer/0/cells/0/value',
      '/regions/body/2/group/footer/0/cells/1/value',
      '/regions/body/2/totals/0/cells/0/value',
      '/regions/body/2/totals/0/cells/1/value',
      '/regions/body/2/totals/1/cells/1/value',
    ]
    for (const at of cells) {
      const outcome = validateReport(edited((r) => setAt(r, `${at}/baseline`, 'superscript')))
      const errors = outcome.valid ? [] : outcome.errors
      expect(
        errors.map((error) => `${error.code} ${error.path}`),
        at,
      ).toEqual([`misplaced-baseline ${at}/baseline`])
      expect(errors[0]?.message, at).toContain("a table's")
    }
  })

  // Where the property has no place, its value is not the question: one
  // refusal says so, not a second about a value that could never print.
  test('is refused there whatever its value, once', () => {
    const at = '/regions/body/2/columns/0/value/baseline'
    expect(refusals(edited((r) => setAt(r, at, 'raised')))).toEqual([`misplaced-baseline ${at}`])
  })
})

/** The report a valid document reads as, failing the test where it is refused. */
function validated(document: unknown): ReportDefinition {
  const outcome = validateReport(document)
  if (!outcome.valid) throw new Error(outcome.errors.map((error) => `${error.code} ${error.path}`).join('; '))
  return outcome.report
}
