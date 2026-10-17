import { E_INVOICE_NAMES, validateReport } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { Diagnostic } from '../diagnostics/codes.js'
import { diagnose } from '../diagnostics/diagnose.js'
import { thawed } from '../snapshot.js'
import type { Mutable } from '../snapshot.js'
import { eInvoiceSample, sampleReport, setAt } from '../test-support.js'
import { compileReport } from './compile-report.js'

const INTRO_VALUE = '/regions/body/0/content/2/expression/cel'
const NAME_COLUMN = '/regions/body/2/columns/0/value'
const QUANTITY_COLUMN = '/regions/body/2/columns/1/value'
const AMOUNT_VALUE = '/regions/body/2/columns/3/value/expression/cel'
const AMOUNT_WHEN = '/regions/body/2/columns/3/styleWhen/0/when/cel'
const TOTAL_VALUE = '/regions/body/2/totals/1/cells/1/value/expression/cel'
const GROSS = '/aggregates/2/of/expression/cel'
const NUMBER_RUN = '/eInvoice/number/1/expression/cel'
const ISSUED = '/eInvoice/issued/cel'
const DUE = '/eInvoice/due/cel'
const DELIVERED = '/eInvoice/delivered/cel'
const PAID = '/eInvoice/paid/cel'
const LINE_ID = '/eInvoice/lines/id'
const LINE_UNIT = '/eInvoice/lines/unit/expression/cel'
const LINE_VAT = '/eInvoice/lines/vat/expression/cel'

type Edit = (report: Mutable<ReportDefinition>) => void

/** `report`, edited, and checked still valid: diagnostics are about valid reports. */
function edited(report: ReportDefinition, ...edits: Edit[]): ReportDefinition {
  const copy = thawed(report)
  for (const edit of edits) edit(copy)
  const outcome = validateReport(copy)
  if (!outcome.valid) throw new Error(`the edit made the report invalid: ${outcome.errors.map(({ code, path }) => `${code} ${path}`).join(', ')}`)
  return outcome.report
}

const set =
  (pointer: string, value: unknown): Edit =>
  (report) =>
    setAt(report, pointer, value)

/** The e-invoice sample with `cel` at `pointer`. */
const invoiceWith = (pointer: string, value: unknown): ReportDefinition => edited(eInvoiceSample(), set(pointer, value))

/** Each diagnostic as its code and its path. */
const said = (diagnostics: readonly Diagnostic[]): string[] => diagnostics.map(({ code, path }) => `${code} ${path}`)

const DECIMAL = { type: 'decimal', nullable: false }
const MAYBE_DECIMAL = { type: 'decimal', nullable: true }

describe('the names an e-invoice binds', () => {
  // The page prints the totals the runtime computes once, for the page and
  // the XML; read as anything but the decimals they are bound as, a total
  // would be checked as one type and handed over as another. A category no
  // line is in has no basis and no amount, so each is null there, and an
  // expression must say what it prints then.
  test('are each total and each declared category, typed as the decimals they are', () => {
    const { members } = compileReport(eInvoiceSample())
    expect([...members.invoice]).toEqual([
      ['lineTotal', DECIMAL],
      ['taxBasisTotal', DECIMAL],
      ['taxTotal', DECIMAL],
      ['grandTotal', DECIMAL],
      ['paid', MAYBE_DECIMAL],
      ['duePayable', DECIMAL],
    ])
    expect([...members.vatBasis]).toEqual([
      ['standard', MAYBE_DECIMAL],
      ['reduced', MAYBE_DECIMAL],
    ])
    expect([...members.vatAmount]).toEqual([...members.vatBasis])
  })

  // The paid amount is what the e-invoice's expression gives: never null
  // when that is a decimal, and no member at all of an invoice that
  // declares none, where reading one would print nothing and say so to
  // nobody.
  test('hold the paid amount as its expression gives it, and none where none is declared', () => {
    expect(compileReport(invoiceWith(PAID, 'dec("10.00")')).members.invoice.get('paid')).toEqual(DECIMAL)
    const unpaid = edited(
      eInvoiceSample(),
      (report) => delete report.eInvoice?.paid,
      (report) => {
        const totals = report.regions.summary[4]
        if (totals?.kind !== 'text') throw new Error('the sample has moved its totals')
        totals.content = totals.content.slice(0, 10)
      },
    )
    expect([...compileReport(unpaid).members.invoice.keys()]).toEqual(['lineTotal', 'taxBasisTotal', 'taxTotal', 'grandTotal', 'duePayable'])
    expect(said(diagnose(edited(unpaid, set(INTRO_VALUE, 'string(invoice.paid) + string(params.copies)'))))).toEqual([`expression-unknown-name ${INTRO_VALUE}`])
  })

  // A paid amount that does not compile has no type anyone could check a
  // read of it against: it is read as a value that may be anything, so its
  // one fault is reported once, where it is.
  test('read a paid amount that does not compile as anything, so its fault is said once', () => {
    expect(said(diagnose(invoiceWith(PAID, 'params.nope')))).toEqual(['expression-unknown-name /eInvoice/paid/cel'])
    expect(compileReport(invoiceWith(PAID, 'params.nope')).members.invoice.get('paid')).toEqual({ type: 'dyn', nullable: true })
  })

  // A report that is no e-invoice has no totals of one to bind.
  test('hold nothing in a report that is no e-invoice', () => {
    const { members } = compileReport(sampleReport())
    expect([members.invoice.size, members.vatBasis.size, members.vatAmount.size]).toEqual([0, 0, 0])
  })

  // The sample prints every total, a breakdown behind a condition that
  // reads one, and asks its EPC QR code for the amount due: each place
  // that reads totals reads the e-invoice's too, and nothing is said of it.
  test('are read wherever totals is: a run, a condition, a payment code, a total row, a style rule', () => {
    expect(diagnose(eInvoiceSample())).toEqual([])
    expect(diagnose(invoiceWith(TOTAL_VALUE, 'totals.gross + invoice.grandTotal'))).toEqual([])
    expect(diagnose(invoiceWith(AMOUNT_WHEN, 'row.amount > invoice.grandTotal'))).toEqual([])
  })
})

describe('where the names are not read', () => {
  // Each name is a map of members, as every other: read whole, what it
  // reads cannot be checked, and is never bound.
  test('refuses a read of one whole, as of any name', () => {
    expect(said(diagnose(invoiceWith(INTRO_VALUE, 'string(size(vatAmount)) + string(params.copies)')))).toEqual([`expression-dynamic-read ${INTRO_VALUE}`])
  })

  // 0007's names are the same in every report. These are bound only where
  // there is an e-invoice to compute them, and anywhere else a read of one
  // would be bound by nothing at render: refused, saying why.
  test.each(E_INVOICE_NAMES)('%s is unknown in a report that is no e-invoice', (name) => {
    const [diagnostic, ...more] = diagnose(edited(sampleReport(), set(INTRO_VALUE, `string(${name}.standard) + string(params.copies)`)))
    expect(more).toEqual([])
    expect(diagnostic).toMatchObject({ code: 'expression-unknown-name', path: INTRO_VALUE, position: { start: 7, end: 7 + name.length } })
    expect(diagnostic?.message).toContain('only in a report that is an e-invoice')
  })

  // The totals are computed from the lines, after the aggregates, and
  // written into the XML beside the e-invoice's own terms. A line's term,
  // an aggregate or a term of the e-invoice that read them would need them
  // before they could be computed: a circle no render could close.
  test.each([
    ["an aggregate's expression", GROSS, 'row.amount * invoice.taxTotal'],
    ["the e-invoice's number", NUMBER_RUN, 'string(invoice.taxTotal)'],
    ["the e-invoice's issue date", ISSUED, 'vatAmount.reduced == null ? header.orderedOn : params.from'],
    ["the e-invoice's paid amount", PAID, 'invoice.taxTotal'],
    ["a line's VAT category", LINE_VAT, 'vatBasis.reduced == null ? "standard" : "reduced"'],
    ["the column that prints a line's net amount", AMOUNT_VALUE, 'round(dec(row.quantity) * row.unit_price, 2) + invoice.taxTotal'],
  ])('refuses them in %s, which they are computed from', (_place, pointer, cel) => {
    const [diagnostic, ...more] = diagnose(invoiceWith(pointer, cel))
    expect(more).toEqual([])
    expect(diagnostic).toMatchObject({ code: 'expression-unknown-name', path: pointer })
    expect(diagnostic?.message).toMatch(/computes/)
  })
})

describe("the e-invoice's expressions", () => {
  // Each term the XML holds has its type: a date is read as its ISO
  // string, as a date field is, and an amount is a decimal. A term of
  // another type is refused here, where it is written, rather than by the
  // first final render. A text the data may or may not fill is checked as
  // a value that may be anything, which the render checks again.
  test.each([
    ['an issue date that is an integer', ISSUED, 'params.copies', ['expression-type']],
    ['an issue date read from a date field', ISSUED, 'header.orderedOn', []],
    // A date is the text a date field is read as, so any text passes here: whether it is a date is the render's to say.
    ['an issue date that is any text', ISSUED, 'header.customer', []],
    ['a due date that is an instant', DUE, 'timestamp("2026-01-05T00:00:00Z")', ['expression-type']],
    ['a due date that is an integer', DUE, 'totals.lines', ['expression-type']],
    ['a delivery date that is a boolean', DELIVERED, 'params.draft', ['expression-type']],
    ['a paid amount that is an integer', PAID, 'params.copies', ['expression-type']],
    ['a paid amount that is a text', PAID, 'header.customer', ['expression-type']],
    ['a paid amount that is a decimal', PAID, 'dec("10.00")', []],
    ['a unit that is an integer', LINE_UNIT, 'row.quantity', ['expression-type']],
    ['a VAT category that is an integer', LINE_VAT, 'row.quantity', ['expression-type']],
    ['a VAT category chosen by a condition', LINE_VAT, 'row.shipped == true ? "reduced" : "standard"', []],
    ['a VAT category read from a field that may be null', LINE_VAT, 'row.shippedAt', []],
  ])('types %s', (_name, pointer, cel, codes) => {
    expect(diagnose(invoiceWith(pointer, cel)).map(({ code }) => code)).toEqual(codes)
  })

  // An identifier is a text or an integer, as the field it may be read
  // from is; read through an expression, it is held to the same.
  test.each([
    ['an integer', 'row.quantity', []],
    ['a decimal', 'row.unit_price', ['expression-type']],
  ])('types a line identifier read through an expression that gives %s', (_name, cel, codes) => {
    expect(diagnose(invoiceWith(LINE_ID, { kind: 'expression', expression: { cel } })).map(({ code }) => code)).toEqual(codes)
  })

  // An integer paid amount is the commonest slip: the hint says how to
  // make the decimal the XML writes.
  test('hints at dec() for a paid amount that is an integer', () => {
    const [diagnostic] = diagnose(invoiceWith(PAID, 'params.copies'))
    expect(diagnostic?.message).toContain('the paid amount (BT-113)')
    expect(diagnostic?.hint).toContain('dec()')
  })
})

describe('a column that prints a line', () => {
  // The XML is written from what each column prints, so a column is held
  // to its term's type wherever it computes one: a net amount that is a
  // text would print, and the XML would have no amount to write. The
  // refusal names the term and the column, and never what the expression
  // computes with.
  test.each([
    ['a net amount that is a text', AMOUNT_VALUE, 'row.sku', ['expression-type']],
    ['a net amount that is an integer', AMOUNT_VALUE, 'row.quantity', []],
    ['a name that is a text', NAME_COLUMN, { kind: 'expression', expression: { cel: 'row.sku + " " + row.site' } }, []],
    ['a name that is an integer', NAME_COLUMN, { kind: 'expression', expression: { cel: 'row.quantity' } }, ['expression-type']],
    ['a quantity that is a decimal', QUANTITY_COLUMN, { kind: 'expression', expression: { cel: 'row.unit_price' } }, []],
    ['a quantity that is a text', QUANTITY_COLUMN, { kind: 'expression', expression: { cel: 'row.sku' } }, ['expression-type']],
  ])('types %s', (_name, pointer, value, codes) => {
    expect(diagnose(invoiceWith(pointer, value)).map(({ code }) => code)).toEqual(codes)
  })

  test('names its term and its column when it gives another type', () => {
    const [diagnostic] = diagnose(invoiceWith(AMOUNT_VALUE, 'row.sku'))
    expect(diagnostic).toMatchObject({ code: 'expression-type', path: AMOUNT_VALUE, componentId: 'lines', columnId: 'amount' })
    expect(diagnostic?.message).toContain('the line net amount (BT-131)')
  })

  // Only the four columns the e-invoice names print a line's terms. Any
  // other column of the table is the page's own, and may print a total of
  // the invoice beside each line.
  test('is only a column the e-invoice names', () => {
    const report = edited(eInvoiceSample(), (report) => {
      const table = report.regions.body[2]
      if (table?.kind !== 'table') throw new Error('the sample has moved its table')
      table.columns.push({ id: 'share', header: 'Share', width: 40, align: 'right', value: { kind: 'expression', expression: { cel: 'divide(row.amount * dec("100"), invoice.taxBasisTotal, 1)' } } })
    })
    expect(diagnose(report)).toEqual([])
  })
})
