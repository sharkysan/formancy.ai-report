import type { EInvoice, ReportDefinition, TableComponent } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { ReportData } from './data.js'
import type { Paragraph, Table } from './document.js'
import { prepareExpressions, RENDER_STEP_BUDGET } from './evaluate.js'
import type { ReportExpressions } from './evaluate.js'
import { resolveReport } from './resolve.js'
import type { Resolution, ResolveOptions } from './resolve.js'
import type { RuntimeError } from './resolve-errors.js'
import { invoiceData, invoiceReport, invoiceRow } from './test-support.js'

/**
 * An e-invoice's lines (BG-25), read from the rows of the table that
 * prints them: once each, for the page and the XML alike, in the table's
 * order, and held to EN 16931's rules (CEN/TC 434's CII artefacts 1.3.17,
 * by number) once the data has resolved them.
 */

const FINAL: ResolveOptions = { mode: 'final', creationDate: '2026-10-17T08:00:00Z' }
const PREVIEW: ResolveOptions = { ...FINAL, mode: 'preview' }

function resolved(report: ReportDefinition, data: ReportData, options: ResolveOptions = FINAL): Extract<Resolution, { ok: true }> {
  const outcome = resolveReport(report, data, options)
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome
}

function refused(report: ReportDefinition, data: ReportData, options: ResolveOptions = FINAL): readonly RuntimeError[] {
  const outcome = resolveReport(report, data, options)
  if (outcome.ok) throw new Error('resolved, and was expected to be refused')
  return outcome.errors
}

/** The XML a final render of `data` writes. */
const xmlOf = (data: ReportData, report: ReportDefinition = invoiceReport()): string => resolved(report, data).document.eInvoice?.xml ?? ''

/** Every value of the element `name` in `xml`, in order. */
const values = (xml: string, name: string): string[] => [...xml.matchAll(new RegExp(`<${name}(?: [^>]*)?>([^<]*)</${name}>`, 'g'))].map((match) => match[1] as string)

/** The detail rows the lines' table prints, each its cells. */
function printedLines(resolution: Extract<Resolution, { ok: true }>): readonly (readonly string[])[] {
  const table = resolution.document.body.find((block): block is Table => block.kind === 'table') as Table
  return table.rows.filter(({ kind }) => kind === 'detail').map(({ cells }) => cells)
}

/** The text a summary component of the invoice prints. */
function printed(resolution: Extract<Resolution, { ok: true }>, text: string): string | undefined {
  return resolution.document.body
    .filter((block): block is Paragraph => block.kind === 'paragraph')
    .map(({ runs }) => runs.map((run) => ('text' in run ? run.text : '')).join(''))
    .find((line) => line.startsWith(text))
}

/** The invoice report with its e-invoice changed by `patch`. */
function withInvoice(patch: (invoice: EInvoice) => EInvoice, report: ReportDefinition = invoiceReport()): ReportDefinition {
  return { ...report, eInvoice: patch(report.eInvoice as EInvoice) }
}

/** The invoice report with the lines' table changed by `patch`. */
function withTable(patch: (table: TableComponent) => TableComponent): ReportDefinition {
  const report = invoiceReport()
  return { ...report, regions: { ...report.regions, body: report.regions.body.map((component) => (component.kind === 'table' ? patch(component) : component)) } }
}

/** The invoice report with the column `id`'s value changed by `patch`. */
function withColumn(id: string, patch: (value: TableComponent['columns'][number]['value']) => TableComponent['columns'][number]['value']): ReportDefinition {
  return withTable((table) => ({ ...table, columns: table.columns.map((column) => (column.id === id ? { ...column, value: patch(column.value) } : column)) }))
}

/** The invoice report whose price column prints the price as it is, at every place it has. */
const plainPrices = (): ReportDefinition => withColumn('price', () => ({ kind: 'field', field: { dataset: 'detail', field: 'price' } }))

describe("an e-invoice's lines", () => {
  // The XML holds the lines in the order the table prints them (0007):
  // sorted by position here, whatever order the provider gave the rows in.
  // A file whose lines ran in another order than the page's would make
  // the buyer's system match a line to the wrong one.
  test("are the table's rows, in the order it prints them", () => {
    const data = invoiceData([invoiceRow({ position: '2', item: 'Muttern M6' }), invoiceRow({ position: '1', item: 'Schrauben M6' })])
    const xml = xmlOf(data)
    expect(values(xml, 'ram:LineID')).toEqual(['1', '2'])
    expect(values(xml, 'ram:Name').slice(0, 2)).toEqual(['Schrauben M6', 'Muttern M6'])
    expect(printedLines(resolved(invoiceReport(), data)).map((cells) => cells[1])).toEqual(['Schrauben M6', 'Muttern M6'])
  })

  // The page prints a line from the table's columns, and the XML is written
  // from what those columns resolved to: the name, the quantity and the
  // net price as their values are, the net amount at two places.
  test('are what the named columns print, the net amount at two places', () => {
    const data = invoiceData([invoiceRow({ quantity: '2.5', price: '12.4800', amount: '31.200' })])
    const xml = xmlOf(data)
    expect(xml).toContain('<ram:BilledQuantity unitCode="H87">2.5</ram:BilledQuantity>')
    expect(values(xml, 'ram:ChargeAmount')).toEqual(['12.4800'])
    expect(values(xml, 'ram:LineTotalAmount')[0]).toBe('31.20')
    expect(printedLines(resolved(invoiceReport(), data))).toEqual([['1', 'Schrauben M6', '2.5', '12,48\u00a0€', '31,20\u00a0€']])
  })

  // One evaluation, shown by the render's budget: a net amount column that
  // spends half the budget over every row resolves, which it could not if
  // the table read each row again after the totals had. Two reads could
  // part, and the page would print a line the XML does not hold.
  test('are read once a row, the table printing the very value the XML holds', () => {
    const heavy = `size([${Array.from({ length: 64 }, (_, index) => index).join(',')}].filter(x, [${Array.from({ length: 24 }, (_, index) => index).join(',')}].exists(y, y == x))) > 0 ? row.amount : row.amount`
    const report = withTable((table) => ({ ...table, columns: table.columns.map((column) => (column.id === 'amount' ? { ...column, value: { kind: 'expression', expression: { cel: heavy } } } : column)) }))
    const expressions = (prepareExpressions(report) as { readonly expressions: ReportExpressions }).expressions
    const at = '/regions/body/0/columns/4/value/expression/cel'
    const first = expressions.evaluate(at, { row: { amount: '1.00' } }, 0)
    expect(first.ok).toBe(true)
    // Each evaluation is charged its steps and one more.
    const each = expressions.spent
    const rows = Math.floor(RENDER_STEP_BUDGET / each / 2) + 10
    expect(rows * each).toBeLessThan(RENDER_STEP_BUDGET)
    expect(2 * rows * each).toBeGreaterThan(RENDER_STEP_BUDGET)
    const data = invoiceData(Array.from({ length: rows }, (_, index) => invoiceRow({ position: String(index + 1), quantity: '4', amount: '1.00' })))
    const resolution = resolved(report, data)
    expect(values(resolution.document.eInvoice?.xml ?? '', 'ram:LineTotalAmount')).toHaveLength(rows + 1)
    expect(printedLines(resolution).every((cells) => cells[4] === '1.00')).toBe(true)
  })

  // A total over the lines is over what the page prints of them: the net
  // amount column, not the field behind it. A column that rounds what it
  // computes is what the totals add up. The price is printed at its three
  // places, as the XML holds it.
  test('are totalled as their net amount column prints them', () => {
    const report = withTable((table) => ({
      ...table,
      columns: table.columns.map((column) => {
        if (column.id === 'amount') return { ...column, value: { kind: 'expression', expression: { cel: 'round(row.price * row.quantity, 2)' } } }
        return column.id === 'price' ? { ...column, value: { kind: 'field', field: { dataset: 'detail', field: 'price' }, format: { kind: 'currency', currency: { kind: 'code', code: 'EUR' }, scale: 3 } } } : column
      }),
    }))
    const resolution = resolved(report, invoiceData([invoiceRow({ quantity: '3', price: '0.333', amount: null }), invoiceRow({ position: '2', quantity: '1', price: '0.10', amount: null })]))
    expect(values(resolution.document.eInvoice?.xml ?? '', 'ram:LineTotalAmount')).toEqual(['1.00', '0.10', '1.10'])
    expect(printed(resolution, 'Netto')).toBe('Netto 1,10\u00a0€')
  })
})

describe("a final render of an e-invoice's lines", () => {
  // Every line holds each term (BR-21 to BR-26) and a category (BR-CO-04):
  // a null is refused, naming the row, the column or the code, the term
  // and the rule, never printed as an empty element the buyer's system
  // reads as the term left out.
  test.each([
    ['position', 'BR-21', '/eInvoice/lines/id', 'the line identifier (BT-126)'],
    ['item', 'BR-25', '/regions/body/0/columns/1/value', 'the item name (BT-153)'],
    ['quantity', 'BR-22', '/regions/body/0/columns/2/value', 'the invoiced quantity (BT-129)'],
    ['unit', 'BR-23', '/eInvoice/lines/unit', 'the unit of measure (BT-130)'],
    ['price', 'BR-26', '/regions/body/0/columns/3/value', 'the item net price (BT-146)'],
    ['amount', 'BR-24', '/regions/body/0/columns/4/value', 'the line net amount (BT-131)'],
    ['vat', 'BR-CO-04', '/eInvoice/lines/vat', "the line's VAT category (BT-151)"],
  ])('refuses a line whose %s has no value (%s)', (field, rule, path, what) => {
    const errors = refused(invoiceReport(), invoiceData([invoiceRow(), invoiceRow({ position: '2', [field]: null })]))
    expect(errors).toEqual([expect.objectContaining({ stage: 'resolve', code: 'invalid-e-invoice', path, row: 1 })])
    expect(errors[0]?.message.endsWith(`detail row 1: ${what} has no value, and every line of an e-invoice has one (${rule})`), errors[0]?.message).toBe(true)
  })

  // What the data holds is held to the rule a literal is: a unit outside
  // the closed list (BR-CL-23), a negative net price (BR-27: a discount is
  // a negative quantity at a positive price), a net amount that is not a
  // whole number of cents (BR-DEC-23, never rounded), a category the
  // invoice does not declare (BR-CO-04), a name XML cannot hold. Each names
  // where, the term and the rule, and never the value.
  test.each([
    [{ unit: 'Stk' }, '/eInvoice/lines/unit', /the unit of measure \(BT-130\) is not a unit of measure of those this release takes, .* \(BR-CL-23\)$/],
    [{ price: '-1.00' }, '/regions/body/0/columns/3/value', /the item net price \(BT-146\) is negative, .* \(BR-27\)$/],
    [{ amount: '10.505' }, '/regions/body/0/columns/4/value', /the line net amount \(BT-131\) is not a whole number of cents, .* \(BR-DEC-23\)$/],
    [{ vat: 'zero' }, '/eInvoice/lines/vat', /the line's VAT category \(BT-151\) is not the id of a VAT category this invoice declares, .* \(BR-CO-04\)$/],
    [{ item: 'Schrauben\u0007' }, '/regions/body/0/columns/1/value', /the item name \(BT-153\) holds a character at character 10 that XML 1\.0 cannot write$/],
  ])('refuses a line whose term breaks its rule: %o', (patch, path, message) => {
    const errors = refused(invoiceReport(), invoiceData([invoiceRow(patch)]))
    expect(errors).toEqual([expect.objectContaining({ stage: 'resolve', code: 'invalid-e-invoice', path, row: 0, message: expect.stringMatching(message) })])
    for (const value of Object.values(patch)) expect(errors[0]?.message).not.toContain(value.replace('\u0007', ''))
  })

  // A discount is a line of negative quantity at a positive price, and its
  // net amount below zero: BR-27 refuses only a negative price. 10.500 is
  // a whole number of cents, written 10.50.
  test('takes a discount line, and an amount of trailing zeros', () => {
    const xml = xmlOf(invoiceData([invoiceRow({ quantity: '42', amount: '10.500' }), invoiceRow({ position: '2', item: 'Rabatt', quantity: '-1', unit: 'C62', price: '2.00', amount: '-2.00' })]))
    expect(values(xml, 'ram:LineTotalAmount')).toEqual(['10.50', '-2.00', '8.50'])
    expect(values(xml, 'ram:BilledQuantity')).toEqual(['42', '-1'])
  })

  // EN 16931 makes a line's net amount its quantity times its net price,
  // less its allowances and plus its charges, over the price's base
  // quantity -- none of which this version writes -- as XRechnung 3.0.2
  // gives it (12.5, PEPPOL-EN16931-R120, which it says CII cannot test
  // yet). No rule of CEN's holds it, but Mustang 2.26.0 recomputes every
  // line: 3 × 0.33 written as 1.00 drew its warning, "Arithmetical issue",
  // when a review measured it on 17 October 2026. A file whose lines do
  // not multiply is one a receiver's validator flags, so it is refused,
  // at the amount, naming the row and the three terms, never their values.
  // The product is rounded once, half away from zero, as the totals are.
  test('refuses a line whose net amount is not its quantity times its net price, rounded to the cent', () => {
    const errors = refused(invoiceReport(), invoiceData([invoiceRow({ quantity: '3', price: '0.33', amount: '1.00' })]))
    expect(errors).toEqual([
      expect.objectContaining({
        stage: 'resolve',
        code: 'invalid-e-invoice',
        path: '/regions/body/0/columns/4/value',
        row: 0,
        message: 'component lines, column amount, detail row 0: the line net amount (BT-131) is not the invoiced quantity (BT-129) times the item net price (BT-146), rounded once to the cent: a receiver that multiplies them reads another amount',
      }),
    ])
    expect(refused(invoiceReport(), invoiceData([invoiceRow({ quantity: '3', price: '0.33', amount: '1.00' })]), PREVIEW)).toEqual([expect.objectContaining({ path: '/regions/body/0/columns/4/value', row: 0 })])
    const xml = xmlOf(invoiceData([invoiceRow({ quantity: '3', price: '0.335', amount: '1.01' }), invoiceRow({ position: '2', quantity: '-3', price: '0.335', amount: '-1.01' })]), plainPrices())
    expect(values(xml, 'ram:LineTotalAmount')).toEqual(['1.01', '-1.01', '0.00'])
    expect(refused(plainPrices(), invoiceData([invoiceRow({ quantity: '3', price: '0.335', amount: '1.00' })]))).toEqual([expect.objectContaining({ path: '/regions/body/0/columns/4/value' })])
  })

  // BT-126 is "Eindeutige Bezeichnung für die betreffende
  // Rechnungsposition", as XRechnung 3.0.2 gives EN 16931's model: one a
  // line has to itself. No validator checks it, and a buyer's system that
  // matches a line by it would take two for one. The later line, in the
  // table's order, is refused, naming its row and never the identifier.
  test('refuses a line identifier an earlier line has', () => {
    const errors = refused(invoiceReport(), invoiceData([invoiceRow(), invoiceRow({ item: 'Muttern M6' }), invoiceRow({ position: '2' })]))
    expect(errors).toEqual([
      expect.objectContaining({ stage: 'resolve', code: 'invalid-e-invoice', path: '/eInvoice/lines/id', row: 1, message: "the e-invoice, detail row 1: the line identifier (BT-126) is an earlier line's, and each line of an e-invoice has its own" }),
    ])
    expect(refused(invoiceReport(), invoiceData([invoiceRow(), invoiceRow()]), PREVIEW)).toEqual([expect.objectContaining({ path: '/eInvoice/lines/id', row: 1 })])
  })

  // A column prints a quantity or a price at the places its format shows,
  // and the XML holds the data's own digits: 3.5 printed at no places is 4
  // on the page and 3.5 in the file, two invoices. One with more places
  // than its column shows, by value -- 12.4800 shows as 12,48, which it
  // is -- is refused, in a preview too, naming the row, the column and the
  // term, never the value. An amount the XML writes at two places, and
  // every total, are held where the template is, by the editing core.
  test('refuses a quantity or a price its column prints at fewer places than it has', () => {
    const report = withColumn('qty', (value) => ({ ...value, format: { kind: 'number', scale: 0, grouping: false } }) as TableComponent['columns'][number]['value'])
    expect(refused(report, invoiceData([invoiceRow({ quantity: '3.5', price: '2.00', amount: '7.00' })]))).toEqual([
      expect.objectContaining({
        code: 'invalid-e-invoice',
        path: '/regions/body/0/columns/2/value',
        row: 0,
        message: 'component lines, column qty, detail row 0: the invoiced quantity (BT-129) has more places than its column prints, 0, so the page would print another than the XML holds: the column prints the places the data gives',
      }),
    ])
    expect(xmlOf(invoiceData([invoiceRow({ quantity: '4.00', price: '2.00', amount: '8.00' })]), report)).toContain('unitCode="H87">4.00</ram:BilledQuantity>')
    expect(refused(invoiceReport(), invoiceData([invoiceRow({ quantity: '3', price: '0.333', amount: '1.00' })]), PREVIEW)).toEqual([expect.objectContaining({ path: '/regions/body/0/columns/3/value', row: 0, message: expect.stringMatching(/the item net price \(BT-146\) has more places than its column prints, 2, /) })])
    expect(printedLines(resolved(invoiceReport(), invoiceData([invoiceRow({ price: '0.2500' })])))[0]?.[3]).toBe('0,25 €')
  })

  // BR-16: an invoice has a line. A final render of no rows would write a
  // file every validator refuses, after the render was called final.
  test('refuses a table with no rows (BR-16)', () => {
    expect(refused(invoiceReport(), invoiceData([]))).toEqual([
      expect.objectContaining({ stage: 'resolve', code: 'invalid-e-invoice', path: '/eInvoice/lines/table', message: expect.stringMatching(/\(BR-16\)$/) }),
    ])
  })

  // A line identifier may be an integer, as a position is; a code read by
  // an expression is held to the same rule as a field.
  test('reads a code from an expression, and an identifier from an integer', () => {
    const report = withInvoice((invoice) => ({ ...invoice, lines: { ...invoice.lines, unit: { kind: 'expression', expression: { cel: 'row.unit == "Stück" ? "H87" : row.unit' } } } }))
    const xml = xmlOf(invoiceData([invoiceRow({ unit: 'Stück', position: '7' })]), report)
    expect(xml).toContain('<ram:LineID>7</ram:LineID>')
    expect(xml).toContain('unitCode="H87"')
  })

  // A column the editing core could only type as anything -- a read of a
  // nullable field is -- is held to its term's types once it has resolved:
  // an item name that is a number would be written as a name nobody gave.
  test('refuses a column whose value is of another type than its term', () => {
    const report = withTable((table) => ({ ...table, columns: table.columns.map((column) => (column.id === 'item' ? { ...column, value: { kind: 'expression', expression: { cel: 'row.position' } } } : column)) }))
    expect(refused(report, invoiceData())).toEqual([
      expect.objectContaining({ code: 'invalid-e-invoice', path: '/regions/body/0/columns/1/value', row: 0, message: 'component lines, column item, detail row 0: the item name (BT-153) is read from a string, and this gives an integer' }),
    ])
  })

  // A column that fails to evaluate for a row has its own error, naming
  // the column and the row, and the lines are not read on with a gap.
  test('refuses a line whose column fails to evaluate, once', () => {
    const report = withTable((table) => ({ ...table, columns: table.columns.map((column) => (column.id === 'amount' ? { ...column, value: { kind: 'expression', expression: { cel: 'divide(row.amount, row.quantity - row.quantity, 2)' } } } : column)) }))
    expect(refused(report, invoiceData())).toEqual([expect.objectContaining({ stage: 'evaluation', code: 'expression-failed', path: '/regions/body/0/columns/4/value/expression/cel', row: 0 })])
  })

  // Errors are bounded: past the bound the reading stops, and the list
  // says it was cut short, rather than reading every row of a large table.
  test('stops reading once the errors are past their bound', () => {
    const errors = refused(invoiceReport(), invoiceData(Array.from({ length: 300 }, (_, index) => invoiceRow({ position: String(index + 1), unit: 'Stk' }))))
    expect(errors.at(-1)).toMatchObject({ code: 'too-many-errors' })
    expect(errors.filter(({ code }) => code === 'invalid-e-invoice').length).toBeLessThan(300)
  })

  // An expression that fails for a row is an evaluation error that says
  // where: the e-invoice, which stands in no component, and the row.
  test('names the e-invoice and the row when a code fails to evaluate', () => {
    const report = withInvoice((invoice) => ({ ...invoice, lines: { ...invoice.lines, vat: { kind: 'expression', expression: { cel: 'string(divide(dec(1), dec(row.position) - dec(1), 2))' } } } }))
    const errors = refused(report, invoiceData())
    expect(errors).toEqual([expect.objectContaining({ stage: 'evaluation', code: 'expression-failed', path: '/eInvoice/lines/vat/expression/cel', row: 0, message: expect.stringMatching(/^the e-invoice, detail row 0: /) })])
  })
})

describe("a preview of an e-invoice's lines", () => {
  // A preview prints what it has. A line whose net amount or category has
  // no value cannot be placed in a total, and is left out of every one, as
  // an aggregate skips a null; one that lacks only what the XML alone
  // holds is totalled. No row is no line, and every total is 0.00.
  test('totals what it has, leaving out a line it cannot place', () => {
    const data = invoiceData([
      invoiceRow({ quantity: '40', amount: '10.00' }),
      invoiceRow({ position: '2', amount: null }),
      invoiceRow({ position: '3', vat: null, quantity: '20', amount: '5.00' }),
      invoiceRow({ position: '4', item: null, unit: null, quantity: '4', amount: '1.00' }),
    ])
    const resolution = resolved(invoiceReport(), data, PREVIEW)
    expect(printed(resolution, 'Netto')).toBe('Netto 11,00\u00a0€')
    expect(printed(resolution, 'MwSt.')).toBe('MwSt. 2,09\u00a0€')
    expect(printed(resolved(invoiceReport(), invoiceData([]), PREVIEW), 'Brutto')).toBe('Brutto 0,00\u00a0€')
  })

  // A text the data gives as white space alone is a term a preview lacks,
  // as a null is: a name or a unit of blanks is totalled, since the line
  // has its amount and its category, and a category of blanks leaves its
  // line out of every total. Refused instead, a preview of data half
  // typed in would show nothing; a final render refuses each.
  test('takes a text term of blanks as one it lacks', () => {
    const data = invoiceData([invoiceRow({ quantity: '40', amount: '10.00', item: '  ', unit: ' ' }), invoiceRow({ position: '2', quantity: '4', amount: '1.00', vat: '\t' })])
    const resolution = resolved(invoiceReport(), data, PREVIEW)
    expect(printed(resolution, 'Netto')).toMatch(/^Netto 10,00\s€$/)
    expect(refused(invoiceReport(), data).map((error) => [error.path, 'row' in error ? error.row : undefined])).toEqual([
      ['/regions/body/0/columns/1/value', 0],
      ['/eInvoice/lines/unit', 0],
      ['/eInvoice/lines/vat', 1],
    ])
  })

  // What the data holds is held to the rules in a preview too, where it is
  // not missing: an amount of a third decimal or a category the invoice
  // does not declare would print totals no final render could.
  test('holds what it has to the rules', () => {
    expect(refused(invoiceReport(), invoiceData([invoiceRow({ vat: 'zero' })]), PREVIEW)).toEqual([expect.objectContaining({ code: 'invalid-e-invoice', path: '/eInvoice/lines/vat' })])
    expect(refused(invoiceReport(), invoiceData([invoiceRow({ amount: '1.001' })]), PREVIEW)).toEqual([expect.objectContaining({ code: 'invalid-e-invoice', path: '/regions/body/0/columns/4/value' })])
  })
})
