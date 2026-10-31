import { validateReport } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { thawed } from '../snapshot.js'
import type { Mutable } from '../snapshot.js'
import { eInvoiceSample, setAt } from '../test-support.js'
import { diagnose } from './diagnose.js'

const TOTALS = '/regions/summary/4'
const REDUCED = '/regions/summary/5'
const TOTAL_LABEL = '/regions/body/2/totals/0/cells/0/value'
const GROUP_LABEL = '/regions/body/2/group/footer/0/cells/0/value'
const AMOUNT_WHEN = '/regions/body/2/columns/3/styleWhen/0/when/cel'
const INTRO_WHEN = '/regions/body/0/visibleWhen/cel'
const QR_CONTENT = '/regions/summary/2/content/2/expression/cel'
const EPC_AMOUNT = '/regions/summary/3/amount/cel'

type Edit = (report: Mutable<ReportDefinition>) => void

/** The e-invoice sample, edited, and checked still valid. */
function edited(...edits: Edit[]): ReportDefinition {
  const report = thawed(eInvoiceSample())
  for (const edit of edits) edit(report)
  const outcome = validateReport(report)
  if (!outcome.valid) throw new Error(`the edit made the sample invalid: ${outcome.errors.map(({ code, path }) => `${code} ${path}`).join(', ')}`)
  return outcome.report
}

const set =
  (pointer: string, value: unknown): Edit =>
  (report) =>
    setAt(report, pointer, value)

/** The sample's run of its totals at `index` printing a dash instead. */
const unprint = (index: number): Edit => set(`${TOTALS}/content/${index}`, { kind: 'text', text: '-' })

/** Each diagnostic as its code, its path and the member its message names. */
const said = (report: ReportDefinition): string[] =>
  diagnose(report).map(({ code, path, message }) => `${code} ${path} ${/(invoice|vatBasis|vatAmount)\.[A-Za-z]+/.exec(message)?.[0] ?? '-'}`)

describe('e-invoice-total-unprinted', () => {
  // The XML is the invoice, and a page that does not show one of its
  // totals shows another invoice than the one it carries. Each total the
  // XML holds, and each declared category's basis and amount, that no
  // text or table of the page prints is an error at what it is a total of,
  // naming its business term and how to print it.
  test.each([
    ['the total without VAT (BT-109)', 1, '/eInvoice', 'invoice.taxBasisTotal'],
    ["the standard rate's basis (BT-116)", 3, '/eInvoice/vat/0', 'vatBasis.standard'],
    ["the standard rate's amount (BT-117)", 5, '/eInvoice/vat/0', 'vatAmount.standard'],
    ['the VAT total (BT-110)', 7, '/eInvoice', 'invoice.taxTotal'],
    ['the total with VAT (BT-112)', 9, '/eInvoice', 'invoice.grandTotal'],
    ['the paid amount (BT-113)', 11, '/eInvoice', 'invoice.paid'],
    ['the amount due (BT-115)', 13, '/eInvoice', 'invoice.duePayable'],
  ])('is %s printed by nothing', (what, index, path, member) => {
    const [diagnostic, ...more] = diagnose(edited(unprint(index)))
    expect(more).toEqual([])
    expect(diagnostic).toMatchObject({ code: 'e-invoice-total-unprinted', severity: 'error', path })
    expect(diagnostic?.message).toContain(/\(BT-\d+\)/.exec(what)?.[0])
    expect(diagnostic?.message).toContain(member)
  })

  // With no allowances and no charges the sum of the lines is the total
  // without VAT, so either prints it: a template need not print one number
  // twice.
  test('takes the sum of the lines for the total without VAT', () => {
    expect(said(edited(set(`${TOTALS}/content/1`, { kind: 'expression', expression: { cel: 'invoice.lineTotal' } })))).toEqual([])
  })

  // A run that does not parse has its own error, and prints nothing it
  // can be credited with, as it is credited with no read of a declaration.
  test('credits a run that does not parse with nothing', () => {
    expect(said(edited(set(`${TOTALS}/content/7`, { kind: 'expression', expression: { cel: 'invoice.taxTotal +' } })))).toEqual([
      `expression-syntax ${TOTALS}/content/7/expression/cel -`,
      'e-invoice-total-unprinted /eInvoice invoice.taxTotal',
    ])
  })

  // An invoice that declares no paid amount has none to print, and its
  // amount due is its total with VAT, which is printed already.
  test('needs no paid amount and no amount due where none is paid', () => {
    const unpaid = edited(
      (report) => delete report.eInvoice?.paid,
      (report) => {
        const totals = report.regions.summary[4]
        if (totals?.kind !== 'text') throw new Error('the sample has moved its totals')
        // The runs up to the total with VAT: without the paid amount and the amount due.
        totals.content = totals.content.slice(0, 10)
      },
    )
    expect(said(unpaid)).toEqual([])
  })

  // The check is the template's, not the data's: a run behind a condition
  // that may not hold still prints the total where it holds. The sample's
  // reduced rate prints only where a line is in it.
  test('counts a run behind a condition as printed', () => {
    expect(said(edited(set(`${REDUCED}/visibleWhen`, { cel: 'params.draft' })))).toEqual([])
    expect(said(edited(set(`${TOTALS}/visibleWhen`, { cel: 'params.draft' })))).toEqual([])
  })

  // A table prints too: a total row, a group's footer.
  test.each([
    ['a total row', TOTAL_LABEL],
    ["a group's footer", GROUP_LABEL],
  ])('counts %s of the table as printed', (_where, pointer) => {
    expect(said(edited(unprint(5), set(pointer, { kind: 'expression', expression: { cel: 'vatAmount.standard' } })))).toEqual([])
  })

  // What does not print as text shows a person nothing: a condition, a
  // style rule, a QR code's content, a payment code's amount. A total read
  // only there is unprinted.
  test.each([
    ['a condition', INTRO_WHEN, 'params.draft == false && vatAmount.standard != null'],
    ['a style rule', AMOUNT_WHEN, 'row.amount < dec("0") && vatAmount.standard != null'],
    ["a QR code's content", QR_CONTENT, 'vatAmount.standard'],
    ["an EPC QR code's amount", EPC_AMOUNT, 'vatAmount.standard'],
  ])('does not count %s as printed', (_where, pointer, cel) => {
    expect(said(edited(unprint(5), set(pointer, cel)))).toEqual(['e-invoice-total-unprinted /eInvoice/vat/0 vatAmount.standard'])
  })
})

describe('e-invoice-format-differs', () => {
  const EUR = { kind: 'currency', currency: { kind: 'code', code: 'EUR' }, scale: 2 }
  const GRAND = `${TOTALS}/content/9`
  const LINES = '/regions/body/2/columns'

  /** Each diagnostic of the sample with `format` on the run at `pointer`, as its code, its path and its message. */
  const formatted = (pointer: string, format: unknown): string[] =>
    diagnose(edited(set(`${pointer}/format`, format))).map(({ code, path, message }) => `${code} ${path} ${message}`)

  // The page prints the totals the XML holds, from one computation, and a
  // format then shows each. At fewer than two places a total is rounded
  // again -- 871.63 prints as 872 -- and in another currency it is another
  // amount: either way the page shows another invoice than the one it
  // carries, which § 14c UStG may count as a second. Measured on 17
  // October 2026 by a review, a template that did so was valid, gave no
  // diagnostic and resolved. Each is an error at the run's format, naming
  // what it reads, never a value.
  test.each([
    [
      'at no places',
      { ...EUR, scale: 0 },
      'invoice.grandTotal is an amount the XML holds to the cent, and this run prints it at 0 places, rounding it again: print it at two places or more',
    ],
    [
      'at one place, as a number',
      { kind: 'number', scale: 1, grouping: true },
      'invoice.grandTotal is an amount the XML holds to the cent, and this run prints it at 1 places, rounding it again: print it at two places or more',
    ],
    [
      'in francs',
      { ...EUR, currency: { kind: 'code', code: 'CHF' } },
      "invoice.grandTotal is an amount in the e-invoice's currency, EUR (BT-5), and this run prints it in CHF: name EUR as its currency",
    ],
    [
      'in a currency a parameter gives',
      { ...EUR, currency: { kind: 'parameter', parameter: 'currency' } },
      "invoice.grandTotal is an amount in the e-invoice's currency, EUR (BT-5), and this run prints it in the currency a parameter gives: name EUR as its currency",
    ],
  ])('is a total printed %s', (_how, format, message) => {
    expect(formatted(GRAND, format)).toEqual([`e-invoice-format-differs ${GRAND}/format ${message}`])
  })

  // What shows the amount the XML holds is no error: two places or more,
  // in euro named as a code or as a plain number, and a text format, which
  // prints a decimal's own digits.
  test.each([
    ['in euro at two places', EUR],
    ['in euro at three places', { ...EUR, scale: 3 }],
    ['as a number at two places', { kind: 'number', scale: 2, grouping: false }],
    ['as text', { kind: 'text' }],
  ])('takes a total printed %s', (_how, format) => {
    expect(formatted(GRAND, format)).toEqual([])
  })

  // A run that reads a total among other things prints what it computes
  // from it, at its format: a sum at no places is the total rounded again
  // all the same. A category's basis and amount are totals the XML holds
  // too.
  test('holds a run that reads a total among other names, and a category’s basis', () => {
    expect(
      said(edited(set(`${TOTALS}/content/3`, { kind: 'expression', expression: { cel: 'vatBasis.standard + dec("0")' }, format: { ...EUR, scale: 0 } }))),
    ).toEqual([`e-invoice-format-differs ${TOTALS}/content/3/format vatBasis.standard`])
  })

  // A line's name, amount and price are printed by the columns the XML is
  // written from, the table printing the very value kept: a name in upper
  // case is another description of the supply, an amount at no places or a
  // price in francs another amount. A quantity's and a price's places are
  // the data's, held by the runtime row by row.
  test.each([
    [
      'its name in upper case',
      `${LINES}/0/value`,
      { kind: 'text', transform: 'upper' },
      'the item name (BT-153) is written into the XML as the data gives it, and its column prints it in upper case: print it without a transform',
    ],
    [
      'its amount at no places',
      `${LINES}/3/value`,
      { ...EUR, scale: 0 },
      'the line net amount (BT-131) is an amount the XML holds to the cent, and its column prints it at 0 places, rounding it again: print it at two places or more',
    ],
    [
      'its amount in francs',
      `${LINES}/3/value`,
      { ...EUR, currency: { kind: 'code', code: 'CHF' } },
      "the line net amount (BT-131) is an amount in the e-invoice's currency, EUR (BT-5), and its column prints it in CHF: name EUR as its currency",
    ],
    [
      'its price in a currency a field gives',
      `${LINES}/2/value`,
      { ...EUR, currency: { kind: 'field', field: { dataset: 'header', field: 'customer' } } },
      "the item net price (BT-146) is an amount in the e-invoice's currency, EUR (BT-5), and its column prints it in the currency a field gives: name EUR as its currency",
    ],
  ])('is a line printed with %s', (_how, pointer, format, message) => {
    const columnId = ['sku', 'qty', 'price', 'amount'][Number(/columns\/(\d)/.exec(pointer)?.[1])]
    expect(diagnose(edited(set(`${pointer}/format`, format)))).toEqual([
      { severity: 'error', code: 'e-invoice-format-differs', path: `${pointer}/format`, componentId: 'lines', columnId, message },
    ])
  })

  // What the runtime holds row by row is not said here, and a format that
  // shows a line as it is, is no error: a price at four places, a name in
  // its own case.
  test('leaves a quantity’s and a price’s places to the render', () => {
    expect(
      said(
        edited(
          set(`${LINES}/1/value/format`, { kind: 'number', scale: 0, grouping: false }),
          set(`${LINES}/2/value/format`, { ...EUR, scale: 4 }),
          set(`${LINES}/0/value/format`, { kind: 'text' }),
        ),
      ),
    ).toEqual([])
  })
})
