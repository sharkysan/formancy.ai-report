/**
 * A report resolved against its data: the renderer-neutral document it
 * prints, and the manifest that says what it was printed from (plan 14).
 *
 * The composition of the runtime's stages, each decided in its own module:
 *
 * 1. the report, validated again and its expressions compiled; one the
 *    editor's diagnostics give an error for is refused (`report-check.ts`);
 *    then written in the locale the render names, its own or one its
 *    translations declare, which every later stage reads (`languages.ts`,
 *    0063);
 * 2. the options, the parameters and the data, each checked, and every
 *    error of the three listed together (`parameters.ts`, `data.ts`);
 * 3. the aggregates, exactly, over every row (`totals.ts`);
 * 4. the e-invoice's lines, read once, and its totals and its terms, where
 *    the report is one (`lower-e-invoice.ts`);
 * 5. the regions, lowered component by component (`lower.ts`), tables row
 *    by row (`lower-table.ts`), images through the host's lookup
 *    (`images.ts`), an EPC QR code's every text held to the EPC's rules
 *    (`lower-epc-qr-code.ts`);
 * 6. the payment part, its every text held to SIX's rules
 *    (`lower-payment-part.ts`);
 * 7. the e-invoice's XML, in a final render (`cii.ts`).
 *
 * It refuses rather than prints a wrong report: any error at any stage, and
 * the result is the errors, never a partial document. A preview may run on
 * data the provider calls incomplete or that lacks a field; it says so in
 * the manifest and in its warnings, and its every page carries
 * `PREVIEW_LABEL`, so that a preview printed or passed on is never taken for
 * the report. A final render refuses such data. A preview of an e-invoice
 * writes no XML, and is labelled whatever its data:
 * `E_INVOICE_PREVIEW_LABEL` where nothing else is lacking. A final render
 * of an XRechnung is labelled too, `XRECHNUNG_COPY_LABEL`: its XML is the
 * invoice, and its PDF a copy (0038). And a final render of an e-invoice
 * of either kind that a host asks for as the copy (`eInvoice: 'copy'`,
 * 0077) is labelled as one in the render's language and carries no XML
 * (`e-invoice-copy.ts`): what a Word file is written of.
 */
import { decimalToString } from '@formancy/expressions'
import type { Decimal } from '@formancy/expressions'
import { reportHash } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { checkData } from './data.js'
import type { Completeness, Consistency, DataMode, ReportData } from './data.js'
import type { Block, Paragraph, ResolvedDocument } from './document.js'
import { E_INVOICE_COPY_LANGUAGES, eInvoiceCopyParagraph } from './e-invoice-copy.js'
import { createFormatter } from './format.js'
import { localePath } from './languages.js'
import { eInvoiceFile, resolveEInvoice } from './lower-e-invoice.js'
import { resolveFonts } from './lower-fonts.js'
import { lowerPaymentPart } from './lower-payment-part.js'
import { lowerRegions } from './lower.js'
import { frozen, label } from './page-label.js'
import { checkParameters } from './parameters.js'
import type { CheckedParameters } from './parameters.js'
import type { AssetResolver } from './render-context.js'
import { checkReport } from './report-check.js'
import { fromData, Problems } from './resolve-errors.js'
import type { RuntimeError } from './resolve-errors.js'
import type { DataSource } from './source.js'
import { documentStyles } from './styles.js'
import { computeTotals } from './totals.js'
import { canonicalInstant } from './values.js'

export interface ResolveOptions {
  /** A final render prints the report; a preview shows a sample and says what it lacks. */
  readonly mode: DataMode
  /** The values a person supplied, by parameter id; defaults apply to those left out. */
  readonly parameters?: Readonly<Record<string, unknown>>
  /** The host's lookup of approved assets' bytes; a report that draws an image or maps a font is refused without one (0043). */
  readonly images?: AssetResolver
  /** An ISO 8601 instant with its zone, fixed by the caller, so that the same inputs print the same PDF. */
  readonly creationDate: string
  /** The IANA zone instants are shown in, named by the host: UTC when absent, never the machine's. */
  readonly timeZone?: string
  /**
   * The locale the render prints in: the report's own when absent, or one
   * its translations declare, exactly; any other is refused as
   * `undeclared-locale` (0063). It decides every word the report prints,
   * every value's format, the order of rows and groups, the slip's
   * headings and the labels form data must have been read in.
   */
  readonly locale?: string
  /**
   * `'copy'` resolves a final render of an e-invoice as its copy (0077):
   * every header opens with the copy's label, in the render's language,
   * and the document carries no XML. The invoice's terms are held and its
   * XML written as for the invoice, so a copy is of an invoice that
   * exists. Absent, the render is the invoice. It says nothing of a
   * report that carries no e-invoice; of a preview, in a language no
   * label is written in, or as any other value it is refused,
   * `no-e-invoice-copy`.
   */
  readonly eInvoice?: 'copy'
}

/** What a document was resolved from, to keep beside the PDF (plan 14). Nothing in it is the data's. */
export interface RenderManifest {
  /** report-spec's hash of the report as validated, its translations and all. */
  readonly reportHash: string
  readonly reportSpecVersion: ReportDefinition['reportSpecVersion']
  /** The locale the render printed in: the report's own, or the translation's it named (0063). */
  readonly locale: string
  readonly timeZone: string
  readonly mode: DataMode
  readonly consistency: Consistency
  readonly completeness: Completeness
  /** Each parameter's value as the format writes one -- an exact number or a date as a string, a boolean -- or null. */
  readonly parameters: Readonly<Record<string, string | boolean | null>>
  /**
   * Where the data came from, as its provider named it and the check held
   * it: each submission of a formancy form with its form's id and its
   * version's schemaHash, or Formancy Data's forms (0041). Held to the
   * syntax of identifiers and to no key but its shape's; what fits that
   * syntax passes, whatever it means. Absent where the data named no
   * source.
   */
  readonly source?: DataSource
  /** `'copy'` where the document is the copy of the report's e-invoice a host asked for, and not the invoice (0077); absent otherwise. */
  readonly eInvoice?: 'copy'
}

export type Resolution =
  | {
      readonly ok: true
      readonly document: ResolvedDocument
      readonly manifest: RenderManifest
      /** What a preview lacks; empty in a final render, which refuses it. */ readonly warnings: readonly RuntimeError[]
    }
  | { readonly ok: false; readonly errors: readonly RuntimeError[] }

/** What every page of a preview that lacks data says, at the top of its page header, and of page 1's own where it has one. */
export const PREVIEW_LABEL = 'Preview of incomplete data: not a final report'

/** What every page of a preview of an e-invoice says when it lacks nothing else: it writes no XML, and is not the invoice. */
export const E_INVOICE_PREVIEW_LABEL = 'Preview: not an e-invoice, and not a final report'

/** What every page of a final render of an XRechnung says: the invoice is the XML the document carries, which a host sends, and the PDF drawn of the page is a copy (0038). */
export const XRECHNUNG_COPY_LABEL = 'Copy of an XRechnung: the invoice is its XML, and this PDF is not the invoice'

/**
 * The paragraph that opens every page's header of a final render of an
 * XRechnung, as the runtime writes it: `XRECHNUNG_COPY_LABEL` in the
 * labels' style. The renderer refuses an XRechnung's document whose page
 * header, or page 1's own where it has one (0060), does not open with it,
 * style and all, since the text in white or at one point would say nothing
 * to a reader (0038). Frozen, so that what
 * the renderer holds a copy to is not a host's to change; each document
 * carries a paragraph of its own.
 */
export const XRECHNUNG_COPY_PARAGRAPH: Paragraph = frozen(label(XRECHNUNG_COPY_LABEL))

/**
 * The label a copy of `report`'s e-invoice is headed with where `options`
 * ask for one (0077), `locale` the one the render prints in: its text,
 * undefined where no copy is asked for or the report carries no
 * e-invoice, or the error that refuses the copy. The option is the
 * host's, whatever its type says.
 */
function copyLabel(report: ReportDefinition, own: ReportDefinition, locale: string, options: ResolveOptions): string | RuntimeError | undefined {
  const asked: unknown = options.eInvoice
  if (asked === undefined) return undefined
  const no = (path: string, message: string): RuntimeError => ({ stage: 'resolve', code: 'no-e-invoice-copy', path, message })
  if (asked !== 'copy') return no('', "a render's eInvoice option is 'copy' or absent")
  if (report.eInvoice === undefined) return undefined
  if (options.mode === 'preview') return no('', 'a copy is of a final render of an e-invoice; a preview writes no XML, and there is no invoice it is a copy of')
  const [run] = eInvoiceCopyParagraph(report.eInvoice.kind, locale)?.runs ?? []
  if (run === undefined || !('text' in run))
    return no(
      localePath(own, locale),
      `a copy of an e-invoice is labelled in the language it prints in, and the runtime has no label in the language of ${locale}: it has one in ${E_INVOICE_COPY_LANGUAGES.join(', ')}`,
    )
  return run.text
}

/** Each parameter's value as the format writes one. */
function writtenParameters(values: CheckedParameters): Record<string, string | boolean | null> {
  return Object.fromEntries(
    Object.entries(values).map(([id, value]) => {
      if (value === null || typeof value === 'boolean' || typeof value === 'string') return [id, value]
      if (typeof value === 'bigint') return [id, String(value)]
      // A parameter is never an image (report-spec), so what is left is a decimal.
      return [id, decimalToString(value as Decimal)]
    }),
  )
}

/**
 * `report` resolved against `data`: the document to render and its
 * manifest, or every reason it is refused, up to a bound. Nothing is read
 * from `report`, `data` or the parameters but through the checks, and
 * nothing in the result is shared with them.
 */
export function resolveReport(report: ReportDefinition, data: ReportData, options: ResolveOptions): Resolution {
  const checked = checkReport(report, options.locale)
  if (!checked.ok) return { ok: false, errors: checked.errors }
  const valid = checked.printed
  const timeZone = options.timeZone ?? 'UTC'
  const errors: RuntimeError[] = []
  const creationDate = canonicalInstant(String(options.creationDate))
  if (creationDate === undefined)
    errors.push({ stage: 'resolve', code: 'invalid-creation-date', path: '', message: 'the creation date is an ISO 8601 instant with its zone' })
  const formatter = createFormatter({ locale: valid.locale, timeZone })
  if (!formatter.ok)
    errors.push({
      stage: 'format',
      code: formatter.code,
      path: formatter.code === 'unsupported-locale' ? localePath(checked.report, valid.locale) : '',
      message: formatter.message,
    })
  const parameters = checkParameters(valid, options.parameters ?? {})
  if (!parameters.ok) errors.push(...parameters.errors.map((error) => fromData('parameters', error)))
  const checkedData = checkData(valid, data, { mode: options.mode, reportLocale: checked.report.locale })
  if (!checkedData.ok) errors.push(...checkedData.errors.map((error) => fromData('data', error)))
  const copy = copyLabel(valid, checked.report, valid.locale, options)
  if (typeof copy === 'object') errors.push(copy)
  if (errors.length > 0 || creationDate === undefined || !formatter.ok || !parameters.ok || !checkedData.ok) return { ok: false, errors }

  const problems = new Problems()
  for (const warning of checkedData.warnings) problems.warn(fromData('data', warning))
  const preview = checkedData.data.mode === 'preview'
  const inputs = {
    report: valid,
    expressions: checked.expressions,
    formatter: formatter.formatter,
    params: parameters.values,
    data: checkedData.data,
    problems,
    preview,
    images: options.images,
    styles: documentStyles(valid.styles),
  }
  const totals = computeTotals(inputs)
  if (totals === undefined) return { ok: false, errors: problems.errors() }
  const invoice = valid.eInvoice === undefined ? undefined : resolveEInvoice({ ...inputs, totals }, valid.eInvoice)
  if (valid.eInvoice !== undefined && invoice === undefined) return { ok: false, errors: problems.errors() }
  const render = { ...inputs, totals, ...(invoice === undefined ? {} : { invoice: invoice.reads }) }
  const regions = lowerRegions(render)
  const paymentPart = lowerPaymentPart(render)
  const fonts = resolveFonts(render, valid.fonts)
  const eInvoice = invoice === undefined || valid.eInvoice === undefined ? undefined : eInvoiceFile(render, invoice, valid.eInvoice)
  if (problems.failed) return { ok: false, errors: problems.errors() }

  const { completeness, consistency, source } = checkedData.data
  const warnings = problems.warnings()
  const lacking = !completeness.complete || warnings.some(({ code }) => code !== 'e-invoice-preview')
  const labelled = !preview
    ? typeof copy === 'string'
      ? copy
      : eInvoice?.kind === 'xrechnung'
        ? XRECHNUNG_COPY_LABEL
        : undefined
    : lacking
      ? PREVIEW_LABEL
      : invoice === undefined
        ? undefined
        : E_INVOICE_PREVIEW_LABEL
  // Every header a page prints opens with the label, page 1's own among them, each with a paragraph of its own (0060).
  const headed = (blocks: readonly Block[]): readonly Block[] => (labelled === undefined ? blocks : [label(labelled), ...blocks])
  const document: ResolvedDocument = {
    info: { title: valid.title, creationDate },
    page: valid.page,
    ...(regions.firstPageHeader === undefined ? {} : { firstPageHeader: headed(regions.firstPageHeader) }),
    pageHeader: headed(regions.pageHeader),
    pageFooter: regions.pageFooter,
    body: regions.body,
    ...(paymentPart === undefined ? {} : { paymentPart }),
    // A copy carries no XML: no engine embeds or sends anything from it (0077).
    ...(eInvoice === undefined || typeof copy === 'string' ? {} : { eInvoice }),
    ...(fonts === undefined ? {} : { fonts }),
  }
  const manifest: RenderManifest = {
    reportHash: reportHash(checked.report),
    reportSpecVersion: valid.reportSpecVersion,
    locale: valid.locale,
    timeZone,
    mode: checkedData.data.mode,
    consistency,
    completeness,
    parameters: writtenParameters(parameters.values),
    ...(source === undefined ? {} : { source }),
    ...(typeof copy === 'string' ? { eInvoice: 'copy' as const } : {}),
  }
  return { ok: true, document, manifest, warnings }
}
