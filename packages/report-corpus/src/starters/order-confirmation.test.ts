import { diagnose } from '@formancy/report-core'
import { resolveReport } from '@formancy/report-runtime'
import type { ReportDefinition } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { starterImages } from './index.js'
import { ORDER_CONFIRMATION, orderConfirmationData, orderConfirmationLines } from './order-confirmation.js'

/**
 * The order confirmation (0064): one list of order lines, printed as three
 * tables its lines' kind picks (0062), the goods grouped by delivery, each
 * delivery's header kept with its first three rows (0059), under the
 * firm's letterhead on page 1 and a running header from page 2 (0060).
 * What is held here is the report and its data; what prints is held on
 * the PDF by the renderer's `order-confirmation.test.ts`.
 */

type Component = ReportDefinition['regions']['body'][number]
type Table = Extract<Component, { kind: 'table' }>

const tables = (): Table[] => ORDER_CONFIRMATION.report.regions.body.filter((component): component is Table => component.kind === 'table')

describe('the order confirmation', () => {
  // Three tables over one list, each picking its lines by their kind: a
  // table with no condition would print every line, and two picking the
  // same kind would print a line twice, each time totalled as that
  // table's own.
  test('prints its lines as three tables, goods, services and returns, each picking its kind', () => {
    expect(tables().map((table) => [table.id, table.rowsWhen?.cel])).toEqual([
      ['goods', 'row.kind == "goods"'],
      ['services', 'row.kind == "service"'],
      ['returns', 'row.kind == "return"'],
    ])
  })

  // Each table's last column, at its right end, is headed as no other
  // column of the report is. The builders label two columns of one header
  // by their ids, "Betrag (goods/amount)", and at a table's right end that
  // longer label stands over the table's own in the design view, where the
  // browser gate's axe could not tell the colour behind it: it failed so
  // on the goods' and the services' amounts, both headed "Betrag".
  test('heads each table’s last column as no other column of the report', () => {
    const headers = tables().flatMap((table) => table.columns.map(({ header }) => header))
    const last = tables().map((table) => table.columns.at(-1)?.header ?? '')
    expect(last.filter((header) => headers.filter((each) => each === header).length > 1)).toEqual([])
  })

  // Every line is one of the three kinds, and each kind has lines: a line
  // of a fourth kind would print in no table and still count in the
  // order's total, a total no table shows; and a kind with none would
  // print its table's empty text where the starter means to show lines.
  test('has lines of each kind and of no other', () => {
    const kinds = orderConfirmationLines().map(({ kind }) => kind)
    expect([...new Set(kinds)].sort()).toEqual(['goods', 'return', 'service'])
  })

  // Order and grouping are only proved by rows that arrive out of the
  // order the tables print them in, and a delivery's subtotal only by
  // deliveries that differ in how many lines they hold: lines already in
  // the report's order would pass a report that never sorted, and
  // deliveries alike would pass a subtotal of another delivery's lines.
  test('arrives out of the order its tables print, its deliveries of unlike sizes', () => {
    const goods = orderConfirmationLines().filter(({ kind }) => kind === 'goods')
    const printed = [...goods].sort((a, b) => (a.delivery === b.delivery ? (a.article < b.article ? -1 : 1) : a.delivery < b.delivery ? -1 : 1))
    expect(goods.map(({ article }) => article)).not.toEqual(printed.map(({ article }) => article))
    const sizes = new Map<string, number>()
    for (const { delivery } of goods) sizes.set(delivery, (sizes.get(delivery) ?? 0) + 1)
    expect(sizes.size).toBe(3)
    expect(new Set(sizes.values()).size).toBe(3)
  })

  // The goods are grouped by delivery, and each delivery's header asks to
  // stand with its first three lines: a header kept with one, the rule
  // before 0059, could start a delivery at the foot of a page with a line
  // under it, which is what the starter is to show is no longer printed.
  test('groups its goods by delivery, each header kept with its first three lines', () => {
    const goods = tables()[0]
    expect([goods?.group?.by.field, goods?.group?.keepWithRows]).toEqual(['delivery', 3])
  })

  // Page 1 prints its own header, the letterhead, where page 2 on prints
  // the running header with the order's number (0060); a page footer
  // counts every page. A running header on page 1 would print above the
  // letterhead, and a letterhead in the page header would print on every
  // page.
  test('prints its letterhead on page 1 alone, a running header from page 2, and its pages counted', () => {
    const { regions } = ORDER_CONFIRMATION.report
    expect(regions.firstPageHeader?.map(({ id }) => id)).toEqual(['logo', 'logo-gap', 'sender'])
    const runs = (components: readonly Component[]) => components.flatMap((component) => (component.kind === 'text' ? component.content : []))
    expect(runs(regions.pageHeader)).toEqual(expect.arrayContaining([{ kind: 'field', field: { dataset: 'header', field: 'number' } }]))
    expect(runs(regions.pageFooter).map(({ kind }) => kind)).toEqual(expect.arrayContaining(['pageNumber', 'pageCount']))
  })

  // A starter an author opens greets them with no problem in the editor,
  // and its own data resolves in a final render with no warning: a total
  // of every line under one table's lines would be report-core's
  // total-of-every-row, which reads as that table's (0062).
  test('opens with no diagnostic and resolves its own data with no warning', () => {
    expect(diagnose(ORDER_CONFIRMATION.report)).toEqual([])
    const outcome = resolveReport(ORDER_CONFIRMATION.report, orderConfirmationData(), {
      mode: 'final',
      parameters: {},
      images: starterImages,
      creationDate: '2026-11-16T08:00:00Z',
    })
    expect(outcome.ok ? outcome.warnings : outcome.errors.map((error) => `${error.code} ${error.path}`)).toEqual([])
  })
})
