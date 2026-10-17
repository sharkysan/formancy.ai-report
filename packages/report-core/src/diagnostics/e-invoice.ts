/**
 * What an e-invoice asks of the page that prints it: every total its XML
 * holds printed, and printed as the XML holds it.
 *
 * The runtime computes each total once, for the page and the XML (0027),
 * so where both show one they show the same value. What nothing there can
 * make agree is a total the page never shows, or one it shows otherwise:
 * the picture would be another invoice than the one it carries, which
 * § 14c UStG may count as a second.
 *
 * - **`e-invoice-total-unprinted`.** Each total the XML always holds -- the
 *   total without VAT (BT-109, or the sum of the lines, BT-106, which
 *   equals it with no allowances or charges), the VAT total (BT-110), the
 *   total with VAT (BT-112), and the basis and the amount of each declared
 *   category (BT-116, BT-117) -- is an error when no run of a text or of a
 *   table reads it; so are the paid amount (BT-113) and the amount due
 *   (BT-115), where a paid amount is declared.
 * - **`e-invoice-format-differs`.** A run that reads a total prints it at
 *   two places at least, in the e-invoice's currency named as a code, or
 *   as a plain number; so does the column of a line's net amount (BT-131),
 *   and the net price's (BT-146) prints in that currency. A line's name
 *   (BT-153) is printed in the case the data gives it. A quantity's and a
 *   price's places are the data's, and the runtime holds them row by row.
 *
 * It is the template's, not the data's: a run behind a condition counts as
 * printing what it reads, and which categories the lines use is known
 * only at render, so every declared one is held. It sees that a total is
 * read by what prints, not what is printed beside it, nor whether it
 * prints the total at all rather than something computed from it. What
 * shows a person no text -- a condition, a style rule, a QR code, a
 * payment code's amount -- prints nothing.
 */
import { parse, referencedPaths } from '@formancy/expressions'
import { E_INVOICE_LINE_COLUMNS, E_INVOICE_NAMES, INVOICE_TOTALS, VAT_BREAKDOWN, walkComponents } from '@formancy/report-spec'
import type { ComponentKind, EInvoice, Format, ReportDefinition, TableComponent } from '@formancy/report-spec'
import { pathParts } from '../expressions/compile-site.js'
import { quote } from '../outcome.js'
import { diagnostic } from './codes.js'
import type { Diagnostic } from './codes.js'
import type { ExpressionSite } from './parts.js'

/** The components whose runs print as text. */
const PRINTS: ReadonlySet<ComponentKind> = new Set(['text', 'table'])

/** A total the XML holds: what it is, where the e-invoice declares it, and the reads that print it. */
interface Printable {
  readonly what: string
  readonly path: string
  readonly reads: readonly string[]
}

/** A run of a text or a table, and every `name.member` it reads, once each. */
interface PrintingRun {
  readonly site: ExpressionSite
  readonly reads: readonly string[]
}

/** Every run of a text or a table that parses, with what it reads. */
function printingRuns(report: ReportDefinition, sites: readonly ExpressionSite[]): readonly PrintingRun[] {
  const kinds = new Map(walkComponents(report).map(({ component }) => [component.id, component.kind]))
  return sites.flatMap((site): PrintingRun[] => {
    const kind = site.componentId === undefined ? undefined : kinds.get(site.componentId)
    if (site.kind !== 'computed' || kind === undefined || !PRINTS.has(kind)) return []
    const parsed = parse(site.cel)
    // One that does not parse has its own diagnostic, and reads nothing it can be credited with.
    if (!parsed.ok) return []
    const reads = referencedPaths(parsed.ast).map(pathParts).flatMap(({ name, member }) => (member === undefined ? [] : [`${name}.${member}`]))
    return [{ site, reads: [...new Set(reads)] }]
  })
}

/** Every e-invoice total no run of the page prints, one diagnostic each, at what it is a total of. */
function unprintedTotals(invoice: EInvoice, runs: readonly PrintingRun[]): Diagnostic[] {
  const totals: Printable[] = [
    { what: INVOICE_TOTALS.taxBasisTotal, path: '/eInvoice', reads: ['invoice.taxBasisTotal', 'invoice.lineTotal'] },
    { what: INVOICE_TOTALS.taxTotal, path: '/eInvoice', reads: ['invoice.taxTotal'] },
    { what: INVOICE_TOTALS.grandTotal, path: '/eInvoice', reads: ['invoice.grandTotal'] },
    ...(invoice.paid === undefined
      ? []
      : [
          { what: INVOICE_TOTALS.paid, path: '/eInvoice', reads: ['invoice.paid'] },
          { what: INVOICE_TOTALS.duePayable, path: '/eInvoice', reads: ['invoice.duePayable'] },
        ]),
    ...invoice.vat.flatMap(({ id }, index) =>
      (['vatBasis', 'vatAmount'] as const).map((name) => ({ what: `${VAT_BREAKDOWN[name]} of the category ${quote(id)}`, path: `/eInvoice/vat/${index}`, reads: [`${name}.${id}`] })),
    ),
  ]
  const printed = new Set(runs.flatMap(({ reads }) => reads))
  return totals
    .filter(({ reads }) => !reads.some((read) => printed.has(read)))
    .map(({ what, path, reads }) =>
      diagnostic('e-invoice-total-unprinted', `${what} is in the e-invoice's XML, and no text or table of the page prints it: print it as ${reads.join(' or ')}, so the page shows the invoice it carries`, { path }),
    )
}

/** What a format that shows an amount at fewer places than the XML's two says, `by` naming what prints it; undefined where it shows them all. */
function placesBreak(format: Format | undefined, by: string): string | undefined {
  if ((format?.kind !== 'number' && format?.kind !== 'currency') || format.scale >= 2) return undefined
  return `is an amount the XML holds to the cent, and ${by} prints it at ${format.scale} places, rounding it again: print it at two places or more`
}

/** What a currency format that names another currency than the e-invoice's says, `by` naming what prints it; undefined where it names that one, or none. */
function currencyBreak(format: Format | undefined, currency: string, by: string): string | undefined {
  if (format?.kind !== 'currency') return undefined
  const source = format.currency
  if (source.kind === 'code' && source.code === currency) return undefined
  const shown = source.kind === 'code' ? source.code : `the currency a ${source.kind} gives`
  return `is an amount in the e-invoice's currency, ${currency} (BT-5), and ${by} prints it in ${shown}: name ${currency} as its currency`
}

/** The format a column's value is printed with, if any. */
const formatOf = (value: TableComponent['columns'][number]['value']): Format | undefined => ('format' in value ? value.format : undefined)

/** Every run that prints a total otherwise than the XML holds it, and every column of a line that does: one diagnostic each, at the format. */
function formatsThatDiffer(report: ReportDefinition, invoice: EInvoice, runs: readonly PrintingRun[]): Diagnostic[] {
  const found: Diagnostic[] = []
  for (const { site, reads } of runs) {
    const total = reads.find((read) => (E_INVOICE_NAMES as readonly string[]).includes(read.split('.')[0] as string))
    if (total === undefined) continue
    const broken = placesBreak(site.format, 'this run') ?? currencyBreak(site.format, invoice.currency, 'this run')
    if (broken !== undefined) found.push(diagnostic('e-invoice-format-differs', `${total} ${broken}`, { path: site.path.replace(/\/expression\/cel$/, '/format'), componentId: site.componentId, columnId: site.columnId }))
  }
  // report-spec's validator holds the lines to this table, and each named column to it.
  const located = walkComponents(report).find(({ component }) => component.kind === 'table' && component.id === invoice.lines.table)
  if (located === undefined) return found
  const table = located.component as TableComponent
  const columnBreaks = {
    name: (format: Format | undefined) => (format?.kind === 'text' && format.transform !== undefined ? `is written into the XML as the data gives it, and its column prints it in ${format.transform} case: print it without a transform` : undefined),
    netAmount: (format: Format | undefined) => placesBreak(format, 'its column') ?? currencyBreak(format, invoice.currency, 'its column'),
    netPrice: (format: Format | undefined) => currencyBreak(format, invoice.currency, 'its column'),
  } as const
  for (const [key, broken] of Object.entries(columnBreaks) as [keyof typeof columnBreaks, (format: Format | undefined) => string | undefined][]) {
    const index = table.columns.findIndex(({ id }) => id === invoice.lines[key])
    const column = table.columns[index]
    const said = column === undefined ? undefined : broken(formatOf(column.value))
    if (column !== undefined && said !== undefined) {
      found.push(diagnostic('e-invoice-format-differs', `${E_INVOICE_LINE_COLUMNS[key].what} ${said}`, { path: `${located.path}/columns/${index}/value/format`, componentId: table.id, columnId: column.id }))
    }
  }
  return found
}

/** What the page of an e-invoice report fails to print as the XML holds it: the totals it does not print, then the formats that print otherwise. */
export function eInvoiceDiagnostics(report: ReportDefinition, sites: readonly ExpressionSite[]): Diagnostic[] {
  const invoice = report.eInvoice
  if (invoice === undefined) return []
  const runs = printingRuns(report, sites)
  return [...unprintedTotals(invoice, runs), ...formatsThatDiffer(report, invoice, runs)]
}
