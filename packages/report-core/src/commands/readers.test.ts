import { componentAt, DATASET_ROLES } from '@formancy/report-spec'
import type { FieldContract, FieldType, ReportDefinition, TableComponent } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { tryEdit } from '../draft.js'
import { compileReport } from '../expressions/compile-report.js'
import { openReportSession } from '../session.js'
import { accepted, eInvoiceSample, frozen, idsIn, refused, sampleReport } from '../test-support.js'
import { fieldReaders, removeFieldWithReaders } from './readers.js'

/**
 * Removing a field with everything that reads it (0048): what a review
 * offers where a form version removed a field the report prints and the
 * author would rather print it no more. Every reader goes with it -- the
 * component that prints, draws or shows it, the column, the footer cell,
 * the sort key, the group, the aggregate, and every reader of that
 * aggregate in turn -- found by the walk the diagnostics take and, in an
 * expression, by the parser the compiler asks, never by a second reading.
 * The payment part and the e-invoice are changed by their own commands
 * alone (0039), so a field either of them reads is refused, not removed.
 */

/** The sample, frozen, without its QR-bill: what reads a field there is no part of the report's own level. */
function unbilled(): ReportDefinition {
  const { paymentPart: _bill, ...report } = sampleReport()
  return frozen(report)
}

const table = (report: ReportDefinition): TableComponent => componentAt(report, 'lines')?.component as TableComponent

/** What the removal gives back: the report and the pointers it removed, failing the test where it was refused. */
function removed(
  report: ReportDefinition,
  role: 'header' | 'detail',
  field: string,
): { readonly report: ReportDefinition; readonly removed: readonly string[] } {
  const outcome = removeFieldWithReaders(report, role, field)
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.message}`)
  return outcome
}

describe('removeFieldWithReaders', () => {
  // A text left printing a field the report no longer declares would
  // refuse every render; one that took the components around it, or
  // other fields, would lose what still prints.
  test('removes the field and the component that prints it', () => {
    const { report, removed: gone } = removed(unbilled(), 'header', 'orderedOn')
    expect(gone).toEqual(['/regions/body/0', '/datasets/header/fields/1'])
    expect(idsIn(report)).toEqual(idsIn(unbilled()).filter((id) => id !== 'intro'))
    expect(report.datasets.header?.fields.map(({ id }) => id)).toEqual(['customer', 'currency', 'signature'])
  })

  // A price printed in a currency the report no longer declares would
  // refuse every render: a field named only in a run's format is read by
  // that run, and the column holding it goes.
  test("removes the column whose value's format reads it", () => {
    const { report, removed: gone } = removed(unbilled(), 'header', 'currency')
    expect(gone).toEqual(['/regions/body/2/columns/2', '/datasets/header/fields/2'])
    expect(table(report).columns.map(({ id }) => id)).toEqual(['sku', 'qty', 'amount', 'shipped-at'])
  })

  // An image drawn from a field no longer declared would refuse every
  // render; taking the section around it would lose what else it holds.
  test('removes the image drawn from it, wherever it stands', () => {
    const { report, removed: gone } = removed(unbilled(), 'header', 'signature')
    expect(gone).toEqual(['/regions/summary/0/components/2', '/datasets/header/fields/3'])
    expect(componentAt(report, 'closing')?.component.kind).toBe('section')
    expect(componentAt(report, 'signature-image')).toBeUndefined()
  })

  // A style rule says how something prints, never what: a column, or a
  // whole table, taken because one of its rules reads the field would lose
  // every value it prints, where the rule alone loses nothing printed. So
  // the rule goes, and what it styled stays, with its other rules.
  test('removes a style rule that reads it, and keeps what the rule styled', () => {
    const { report, removed: gone } = removed(unbilled(), 'detail', 'shipped')
    expect(gone).toEqual(['/regions/body/2/columns/4/styleWhen/0', '/datasets/detail/fields/7'])
    expect(table(report).columns.map(({ id }) => id)).toEqual(['sku', 'qty', 'price', 'amount', 'shipped-at'])
    expect(table(report).columns[4]).not.toHaveProperty('styleWhen')
    const rules = [
      { when: { cel: 'header.orderedOn != null' }, style: 'small' },
      { when: { cel: 'totals.lines > 1' }, style: 'strong' },
    ]
    const styled = frozen<ReportDefinition>({
      ...unbilled(),
      regions: {
        ...unbilled().regions,
        body: unbilled().regions.body.map((component) => (component.id === 'lines' ? { ...table(unbilled()), styleWhen: rules } : component)),
      },
    })
    const kept = removed(styled, 'header', 'orderedOn')
    expect(kept.removed).toEqual(['/regions/body/0', '/regions/body/2/styleWhen/0', '/datasets/header/fields/1'])
    expect(table(kept.report).styleWhen).toEqual([rules[1]])
    // Two rules of a column, one reading the field and one an aggregate of it, found in that order: both go, named in theirs, and the column stays unstyled.
    const twice = [
      { when: { cel: 'totals.average > dec("1.0")' }, style: 'small' },
      { when: { cel: 'row.quantity > 1' }, style: 'strong' },
    ]
    const sku = frozen<ReportDefinition>({
      ...unbilled(),
      regions: {
        ...unbilled().regions,
        body: unbilled().regions.body.map((component) =>
          component.id === 'lines'
            ? { ...table(unbilled()), columns: table(unbilled()).columns.map((column) => (column.id === 'sku' ? { ...column, styleWhen: twice } : column)) }
            : component,
        ),
      },
    })
    const both = removed(sku, 'detail', 'quantity')
    expect(both.removed.slice(0, 2)).toEqual(['/regions/body/2/columns/0/styleWhen/0', '/regions/body/2/columns/0/styleWhen/1'])
    expect(table(both.report).columns[0]).not.toHaveProperty('styleWhen')
  })

  // The quantity is printed by a column, computed into another, and
  // averaged by an aggregate, which a text prints: each goes, the
  // aggregate's reader with it, and a footer cell under a column that went
  // goes with its column.
  test('removes every column and aggregate that reads it, and every reader of that aggregate', () => {
    const { report, removed: gone } = removed(unbilled(), 'detail', 'quantity')
    expect(gone).toEqual([
      '/regions/body/2/columns/1',
      '/regions/body/2/columns/3',
      '/regions/summary/0/components/1',
      '/aggregates/3',
      '/datasets/detail/fields/2',
    ])
    expect(table(report).columns.map(({ id }) => id)).toEqual(['sku', 'price', 'shipped-at'])
    expect(table(report).totals?.map((row) => row.cells.map(({ column }) => column))).toEqual([['sku'], ['sku']])
    expect(report.aggregates.map(({ id }) => id)).toEqual(['subtotal', 'lines', 'gross', 'latest'])
    expect(componentAt(report, 'statistics')).toBeUndefined()
  })

  // An aggregate read by an expression elsewhere -- an EPC QR code's
  // amount, a total's cell -- takes that reader with it; and an aggregate
  // that reads a removed aggregate goes too, however long the chain.
  test('follows a chain of aggregates to the end', () => {
    // The total incl. VAT under the price, which stays, so that its cell
    // goes alone -- read twice, through two aggregates that go, and gone
    // once; and an aggregate of the subtotal.
    const base = unbilled()
    const lines = table(base)
    const twice = { kind: 'expression', expression: { cel: 'totals.gross + totals.subtotal' } } as const
    const totals = (lines.totals ?? []).map((row, index) =>
      index === 1 ? { ...row, cells: row.cells.map((cell) => (cell.column === 'amount' ? { column: 'price', value: twice } : cell)) } : row,
    )
    const chained = frozen<ReportDefinition>({
      ...base,
      aggregates: [...base.aggregates, { id: 'doubled', fn: 'max', of: { kind: 'expression', expression: { cel: 'totals.subtotal * dec("2")' } } }],
      regions: { ...base.regions, body: base.regions.body.map((component) => (component.id === 'lines' ? { ...lines, totals } : component)) },
    })
    const { report, removed: gone } = removed(chained, 'detail', 'amount')
    expect(report.aggregates.map(({ id }) => id)).toEqual(['lines', 'average', 'latest'])
    expect(componentAt(report, 'payment-code')).toBeUndefined()
    // The amount column computes its value from the quantity and the
    // price: only its style rule reads the amount, and only the rule goes.
    expect(table(report).columns.map(({ id }) => id)).toEqual(['sku', 'qty', 'price', 'amount', 'shipped-at'])
    expect(table(report).group?.footer.map((row) => row.cells.map(({ column }) => column))).toEqual([['sku', 'qty']])
    expect(table(report).totals?.map((row) => row.cells.map(({ column }) => column))).toEqual([['sku', 'qty'], ['sku']])
    expect(gone).toEqual([
      '/regions/body/2/columns/3/styleWhen/0',
      '/regions/body/2/group/footer/0/cells/2',
      '/regions/body/2/totals/0/cells/2',
      '/regions/body/2/totals/1/cells/1',
      '/regions/summary/3',
      '/aggregates/0',
      '/aggregates/2',
      '/aggregates/5',
      '/datasets/detail/fields/4',
    ])
  })

  // A footer row left with no cell prints an empty line under the table,
  // and a removal that left one would not say it changed it: the row goes,
  // whether its cells read the field -- here an aggregate of it, read as
  // the group's -- or stood under columns that went.
  test('removes a footer row it leaves with no cell', () => {
    const lines = table(unbilled())
    const group = lines.group as NonNullable<TableComponent['group']>
    const average = { kind: 'expression', expression: { cel: 'string(group.average)' } } as const
    const emptied = frozen<ReportDefinition>({
      ...unbilled(),
      regions: {
        ...unbilled().regions,
        body: unbilled().regions.body.map((component) =>
          component.id === 'lines'
            ? {
                ...lines,
                group: { ...group, footer: [...group.footer, { cells: [{ column: 'price', value: average }] }] },
                totals: [...(lines.totals ?? []), { cells: [{ column: 'qty', value: { kind: 'text', text: 'n' } }] }],
              }
            : component,
        ),
      },
    })
    const { report, removed: gone } = removed(emptied, 'detail', 'quantity')
    expect(gone).toEqual([
      '/regions/body/2/columns/1',
      '/regions/body/2/columns/3',
      '/regions/body/2/group/footer/1',
      '/regions/body/2/totals/2',
      '/regions/summary/0/components/1',
      '/aggregates/3',
      '/datasets/detail/fields/2',
    ])
    expect([table(report).group?.footer.length, table(report).totals?.length]).toEqual([1, 2])
  })

  // A table that would print no column prints nothing: one every column
  // of which reads the field goes whole, rather than leave a table the
  // validator refuses, and the rest of the report stays.
  test('removes a table whole where every column of it goes', () => {
    const narrow = frozen<ReportDefinition>({
      ...unbilled(),
      regions: {
        ...unbilled().regions,
        body: unbilled().regions.body.map((component) =>
          component.id === 'lines' ? { ...table(unbilled()), columns: table(unbilled()).columns.filter(({ id }) => id === 'shipped-at') } : component,
        ),
      },
    })
    const { report, removed: gone } = removed(narrow, 'detail', 'shippedAt')
    expect(gone).toEqual(['/regions/body/2', '/datasets/detail/fields/5'])
    expect(componentAt(report, 'lines')).toBeUndefined()
    expect(componentAt(report, 'keep')?.component.kind).toBe('keepTogether')
  })

  // A table's own condition is the table's: it goes whole. A group whose
  // header reads the field goes with its footer, a cell of which that
  // reads it too goes with it, once; and two cells of one totals row that
  // read it go, each named once, in their order.
  test("removes a table its own condition reads it in, and a group with its footer's cells once", () => {
    const shown = frozen<ReportDefinition>({
      ...unbilled(),
      regions: {
        ...unbilled().regions,
        body: unbilled().regions.body.map((component) =>
          component.id === 'lines' ? { ...table(unbilled()), visibleWhen: { cel: 'header.customer != ""' } } : component,
        ),
      },
    })
    expect(removed(shown, 'header', 'orderedOn').report.regions.body.map(({ id }) => id)).toContain('lines')
    const without = removed(
      frozen<ReportDefinition>({ ...shown, regions: { ...shown.regions, body: shown.regions.body.filter(({ id }) => id !== 'intro'), summary: [] } }),
      'header',
      'customer',
    )
    expect(without.removed).toEqual(['/regions/reportHeader/0/columns/1/components/0', '/regions/body/1', '/datasets/header/fields/0'])
    const customer = { kind: 'expression', expression: { cel: 'header.customer' } } as const
    const lines = table(unbilled())
    const grouped = frozen<ReportDefinition>({
      ...unbilled(),
      regions: {
        ...unbilled().regions,
        body: unbilled().regions.body.map((component) =>
          component.id === 'lines'
            ? {
                ...lines,
                group: {
                  ...(lines.group as NonNullable<TableComponent['group']>),
                  header: [customer],
                  footer: [{ cells: [{ column: 'sku', value: customer }] }],
                },
                totals: [
                  {
                    cells: [
                      { column: 'sku', value: customer },
                      { column: 'qty', value: customer },
                      { column: 'amount', value: { kind: 'text', text: 'Total' } },
                    ],
                  },
                  { cells: [{ column: 'sku', value: customer }] },
                ],
              }
            : component,
        ),
      },
    })
    const { report, removed: gone } = removed(grouped, 'header', 'customer')
    expect(gone.filter((pointer) => pointer.startsWith('/regions/body/2'))).toEqual([
      '/regions/body/2/group',
      '/regions/body/2/totals/0/cells/0',
      '/regions/body/2/totals/0/cells/1',
      '/regions/body/2/totals/1',
    ])
    expect([table(report).group, table(report).totals?.map((row) => row.cells.map(({ column }) => column))]).toEqual([undefined, [['amount']]])
  })

  // A table grouped by a field no longer declared would refuse every
  // render, and taking the table would lose its rows: the group goes, its
  // header and its footer with it, and the table stays.
  test('removes the group by it', () => {
    const { report, removed: gone } = removed(unbilled(), 'detail', 'site')
    expect(gone).toEqual(['/regions/body/2/group', '/datasets/detail/fields/0'])
    expect(table(report).group).toBeUndefined()
    expect(table(report).columns).toHaveLength(5)
  })

  // A sort by a field no longer declared would refuse every render, and
  // the validator refuses a sort of no key: the key goes, the sort with
  // its last, the column printing it as well, and a key by another field
  // stays.
  test('removes the sort key by it', () => {
    const { report, removed: gone } = removed(unbilled(), 'detail', 'sku')
    expect(gone).toEqual(['/regions/body/2/columns/0', '/regions/body/2/sort/0', '/datasets/detail/fields/1'])
    expect(table(report).sort).toBeUndefined()
    const sorted = frozen<ReportDefinition>({
      ...unbilled(),
      regions: {
        ...unbilled().regions,
        body: unbilled().regions.body.map((component) =>
          component.id === 'lines'
            ? {
                ...component,
                sort: [
                  { field: { dataset: 'detail', field: 'site' }, direction: 'asc' },
                  { field: { dataset: 'detail', field: 'sku' }, direction: 'desc' },
                ],
              }
            : component,
        ),
      },
    })
    expect(table(removed(sorted, 'detail', 'sku').report).sort).toEqual([{ field: { dataset: 'detail', field: 'site' }, direction: 'asc' }])
  })

  // An expression reads what the parser says it reads, the compiler's
  // own way of asking: by a member, by a key in brackets, or the whole
  // dataset, which may read any field. One that does not parse reads
  // nothing anyone can credit it with, as the diagnostics hold
  // (unused.ts), and stays, its own diagnostic saying why.
  test('finds a reader as the parser finds it, and none in an expression that does not parse', () => {
    const condition = (cel: string): ReportDefinition =>
      frozen<ReportDefinition>({
        ...unbilled(),
        regions: { ...unbilled().regions, body: [{ id: 'conditional', kind: 'spacer', height: 4, visibleWhen: { cel } }, ...unbilled().regions.body] },
      })
    for (const cel of ['header.orderedOn != null', 'header["orderedOn"] != null', 'size(header) > 0']) {
      expect(componentAt(removed(condition(cel), 'header', 'orderedOn').report, 'conditional'), cel).toBeUndefined()
    }
    expect(componentAt(removed(condition('header.customer != ""'), 'header', 'orderedOn').report, 'conditional')).toBeDefined()
    expect(componentAt(removed(condition('header.orderedOn !='), 'header', 'orderedOn').report, 'conditional')).toBeDefined()
  })

  // A component inside one that goes goes with it, once: removing a
  // section a condition of which reads the field takes what it holds,
  // and a reader inside it is not removed a second time.
  test('removes a container once, with what it holds', () => {
    const closing = frozen<ReportDefinition>({
      ...unbilled(),
      regions: {
        ...unbilled().regions,
        summary: unbilled().regions.summary.map((component) =>
          component.id === 'closing' ? { ...component, visibleWhen: { cel: 'header.signature != null || totals.lines > 0' } } : component,
        ),
      },
    })
    const { report, removed: gone } = removed(closing, 'header', 'signature')
    expect(gone).toEqual(['/regions/summary/0', '/datasets/header/fields/3'])
    expect(['closing', 'threshold', 'statistics', 'signature-image'].map((id) => componentAt(report, id))).toEqual([undefined, undefined, undefined, undefined])
  })

  // The QR-bill and the e-invoice are edited by their own commands alone
  // (0039, PART_COMMANDS): a removal that took what reads a field there
  // would change whom a payment reaches, or the XML, under another name.
  test('refuses a field the payment part or the e-invoice reads, directly or through an aggregate', () => {
    const bill = refused(removeFieldWithReaders(frozen(sampleReport()), 'header', 'customer'))
    expect([bill.code, bill.path]).toEqual(['read-by-part', '/paymentPart/debtor/name/0'])
    const amount = refused(removeFieldWithReaders(frozen(sampleReport()), 'detail', 'amount'))
    expect([amount.code, amount.path]).toEqual(['read-by-part', '/paymentPart/amount/cel'])
    const invoice = refused(removeFieldWithReaders(frozen(eInvoiceSample()), 'detail', 'sku'))
    expect([invoice.code, invoice.path]).toEqual(['read-by-part', '/eInvoice/lines/id'])
    expect(bill.message).toContain('payment part')
    expect(invoice.message).toContain('e-invoice')
  })

  // A column the e-invoice prints its lines by is the validator's to
  // keep: the session refuses the removal whole, and nothing changes.
  test('is refused whole by the session where it removes a column the e-invoice names', () => {
    const opening = openReportSession(eInvoiceSample())
    if (!opening.ok) throw new Error('the e-invoice sample did not open')
    const before = opening.session.document()
    const refusal = refused(opening.session.apply({ command: 'removeFieldWithReaders', args: ['detail', 'unit_price'] }))
    expect(refusal.code).toBe('invalid-document')
    expect([opening.session.document(), opening.session.revision()]).toEqual([before, 0])
  })

  // As a descriptor, it is one edit: one undo step puts every reader back.
  test('is one undo step', () => {
    const opening = openReportSession(unbilled())
    if (!opening.ok) throw new Error('the sample did not open')
    const { session } = opening
    const before = session.document()
    expect(accepted(session.apply({ command: 'removeFieldWithReaders', args: ['detail', 'quantity'] })).aggregates).toHaveLength(4)
    expect(session.revision()).toBe(1)
    session.undo()
    expect(session.document()).toBe(before)
  })

  // A field the dataset does not declare is refused where the list is,
  // as removeField refuses it.
  test('refuses a field the dataset does not declare', () => {
    expect([
      refused(removeFieldWithReaders(unbilled(), 'detail', 'customer')).code,
      refused(removeFieldWithReaders(unbilled(), 'detail', 'customer')).path,
    ]).toEqual(['not-found', '/datasets/detail/fields'])
    const { datasets: _datasets, ...rest } = unbilled()
    expect(refused(removeFieldWithReaders({ ...rest, datasets: {} }, 'header', 'customer')).code).toBe('not-found')
  })

  // A removal that took anything with a field nothing reads would lose
  // what nobody asked it to.
  test('of a field nothing reads, removes the field alone', () => {
    const spare = frozen<ReportDefinition>({
      ...unbilled(),
      datasets: {
        ...unbilled().datasets,
        detail: {
          ...(unbilled().datasets.detail as NonNullable<ReportDefinition['datasets']['detail']>),
          fields: [...(unbilled().datasets.detail?.fields ?? []), { id: 'spare', type: 'string', label: 'Spare', nullable: true }],
        },
      },
    })
    expect(removed(spare, 'detail', 'spare').removed).toEqual(['/datasets/detail/fields/8'])
  })
})

/** Each body a field of the samples could be put back with: every other type a field is read as, a decimal at two places, and its own type at the other nullability. */
function retypings(field: FieldContract): Omit<FieldContract, 'id'>[] {
  const { id: _id, scale, ...body } = field
  const types: FieldType[] = ['string', 'integer', 'decimal', 'boolean', 'date', 'datetime', 'instant']
  const retyped = types.filter((type) => type !== field.type).map((type) => ({ ...body, type, ...(type === 'decimal' ? { scale: 2 } : {}) }))
  return [...retyped, { ...body, ...(scale === undefined ? {} : { scale }), nullable: !field.nullable }]
}

/** What a compilation says, each diagnostic by its code, its place and its words. */
const said = (report: ReportDefinition, only?: ReadonlySet<string>): Set<string> =>
  new Set(compileReport(report, only).diagnostics.map(({ code, path, message }) => `${code} ${path} ${message}`))

describe('fieldReaders', () => {
  // A review judges a change of a field's type, or of whether it may be
  // null, by compiling only the expressions that change can reach (0048).
  // Were that set to miss one -- a reader through an aggregate, through a
  // chain of them, the group's key -- a review would offer a retype the
  // compiler then refuses at every render. So for every field of both
  // samples, every type it could take at either nullability, what the set
  // compiled alone adds to the report's diagnostics is what the whole
  // report compiled adds.
  test("names every expression a change of a field's type can reach", () => {
    let reached = 0
    // And the sample whose group header reads the group's key, the site, as text.
    const keyed = JSON.parse(
      JSON.stringify(sampleReport()).replace('\\" (\\" + string(group.lines)', '\\" \\" + group.key + \\" (\\" + string(group.lines)'),
    ) as ReportDefinition
    expect(JSON.stringify(keyed)).toContain('group.key')
    for (const report of [frozen(sampleReport()), frozen(eInvoiceSample()), frozen(keyed)]) {
      const readers = fieldReaders(report)
      const before = said(report)
      for (const role of DATASET_ROLES) {
        for (const field of report.datasets[role]?.fields ?? []) {
          const only = readers.expressions(role, field.id)
          const beforeOnly = said(report, only)
          for (const body of retypings(field)) {
            const outcome = tryEdit(report, (draft) => draft.apply({ command: 'putField', args: [role, field.id, body] }))
            if (!outcome.ok) continue
            const added = [...said(outcome.report)].filter((diagnostic) => !before.has(diagnostic))
            expect(
              [...said(outcome.report, only)].filter((diagnostic) => !beforeOnly.has(diagnostic)),
              `${role}.${field.id} as ${body.type}${body.nullable ? ', nullable' : ''}`,
            ).toEqual(added)
            reached += added.length
          }
        }
      }
    }
    // Not a test of nothing: retyping a field the expressions read refuses some of them.
    expect(reached).toBeGreaterThan(0)
  }, 60_000)

  // The removal a review offers is the command's, from the same walk: a
  // review that removed otherwise than the session applies would list
  // what the applied removal does not take.
  test('removes as removeFieldWithReaders does', () => {
    const report = frozen(sampleReport())
    const readers = fieldReaders(report)
    for (const role of DATASET_ROLES)
      for (const field of report.datasets[role]?.fields ?? []) expect(readers.removal(role, field.id)).toEqual(removeFieldWithReaders(report, role, field.id))
  })
})
