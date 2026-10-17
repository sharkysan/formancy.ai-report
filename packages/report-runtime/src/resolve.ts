/**
 * A report resolved against its data: the renderer-neutral document it
 * prints, and the manifest that says what it was printed from (plan 14).
 *
 * The composition of the runtime's stages, each decided in its own module:
 *
 * 1. the report, validated again and its expressions compiled; one the
 *    editor's diagnostics give an error for is refused (`report-check.ts`);
 * 2. the options, the parameters and the data, each checked, and every
 *    error of the three listed together (`parameters.ts`, `data.ts`);
 * 3. the aggregates, exactly, over every row (`totals.ts`);
 * 4. the regions, lowered component by component (`lower.ts`), tables row
 *    by row (`lower-table.ts`), images through the host's lookup
 *    (`images.ts`), an EPC QR code's every text held to the EPC's rules
 *    (`lower-epc-qr-code.ts`);
 * 5. the payment part, its every text held to SIX's rules
 *    (`lower-payment-part.ts`).
 *
 * It refuses rather than prints a wrong report: any error at any stage, and
 * the result is the errors, never a partial document. A preview may run on
 * data the provider calls incomplete or that lacks a field; it says so in
 * the manifest and in its warnings, and its every page carries
 * `PREVIEW_LABEL`, so that a preview printed or passed on is never taken for
 * the report. A final render refuses such data.
 */
import { decimalToString } from '@formancy/expressions'
import type { Decimal } from '@formancy/expressions'
import { reportHash } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { checkData } from './data.js'
import type { Completeness, Consistency, DataMode, ReportData } from './data.js'
import type { Paragraph, ResolvedDocument } from './document.js'
import { createFormatter } from './format.js'
import { lowerPaymentPart } from './lower-payment-part.js'
import { lowerRegions } from './lower.js'
import { checkParameters } from './parameters.js'
import type { CheckedParameters } from './parameters.js'
import type { ImageResolver } from './render-context.js'
import { checkReport } from './report-check.js'
import { fromData, Problems } from './resolve-errors.js'
import type { RuntimeError } from './resolve-errors.js'
import { documentStyles } from './styles.js'
import { computeTotals } from './totals.js'
import { canonicalInstant } from './values.js'

export interface ResolveOptions {
  /** A final render prints the report; a preview shows a sample and says what it lacks. */
  readonly mode: DataMode
  /** The values a person supplied, by parameter id; defaults apply to those left out. */
  readonly parameters?: Readonly<Record<string, unknown>>
  /** The host's lookup of approved assets' bytes; a report that draws an image is refused without one. */
  readonly images?: ImageResolver
  /** An ISO 8601 instant with its zone, fixed by the caller, so that the same inputs print the same PDF. */
  readonly creationDate: string
  /** The IANA zone instants are shown in, named by the host: UTC when absent, never the machine's. */
  readonly timeZone?: string
}

/** What a document was resolved from, to keep beside the PDF (plan 14). Nothing in it is the data's. */
export interface RenderManifest {
  /** report-spec's hash of the report as validated. */
  readonly reportHash: string
  readonly reportSpecVersion: ReportDefinition['reportSpecVersion']
  readonly locale: string
  readonly timeZone: string
  readonly mode: DataMode
  readonly consistency: Consistency
  readonly completeness: Completeness
  /** Each parameter's value as the format writes one -- an exact number or a date as a string, a boolean -- or null. */
  readonly parameters: Readonly<Record<string, string | boolean | null>>
}

export type Resolution =
  | { readonly ok: true; readonly document: ResolvedDocument; readonly manifest: RenderManifest; /** What a preview lacks; empty in a final render, which refuses it. */ readonly warnings: readonly RuntimeError[] }
  | { readonly ok: false; readonly errors: readonly RuntimeError[] }

/** What every page of a preview that lacks data says, at the top of its page header. */
export const PREVIEW_LABEL = 'Preview of incomplete data: not a final report'

const LABEL: Paragraph = { kind: 'paragraph', runs: [{ text: PREVIEW_LABEL }], style: { size: 8, bold: true, color: '#b00020' } }

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
  const checked = checkReport(report)
  if (!checked.ok) return { ok: false, errors: checked.errors }
  const valid = checked.report
  const timeZone = options.timeZone ?? 'UTC'
  const errors: RuntimeError[] = []
  const creationDate = canonicalInstant(String(options.creationDate))
  if (creationDate === undefined) errors.push({ stage: 'resolve', code: 'invalid-creation-date', path: '', message: 'the creation date is an ISO 8601 instant with its zone' })
  const formatter = createFormatter({ locale: valid.locale, timeZone })
  if (!formatter.ok) errors.push({ stage: 'format', code: formatter.code, path: formatter.code === 'unsupported-locale' ? '/locale' : '', message: formatter.message })
  const parameters = checkParameters(valid, options.parameters ?? {})
  if (!parameters.ok) errors.push(...parameters.errors.map((error) => fromData('parameters', error)))
  const checkedData = checkData(valid, data, { mode: options.mode })
  if (!checkedData.ok) errors.push(...checkedData.errors.map((error) => fromData('data', error)))
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
  const render = { ...inputs, totals }
  const regions = lowerRegions(render)
  const paymentPart = lowerPaymentPart(render)
  if (problems.failed) return { ok: false, errors: problems.errors() }

  const { completeness, consistency } = checkedData.data
  const warnings = problems.warnings()
  const labelled = preview && (!completeness.complete || warnings.length > 0)
  const document: ResolvedDocument = {
    info: { title: valid.title, creationDate },
    page: valid.page,
    pageHeader: labelled ? [LABEL, ...regions.pageHeader] : regions.pageHeader,
    pageFooter: regions.pageFooter,
    body: regions.body,
    ...(paymentPart === undefined ? {} : { paymentPart }),
  }
  const manifest: RenderManifest = {
    reportHash: reportHash(valid),
    reportSpecVersion: valid.reportSpecVersion,
    locale: valid.locale,
    timeZone,
    mode: checkedData.data.mode,
    consistency,
    completeness,
    parameters: writtenParameters(parameters.values),
  }
  return { ok: true, document, manifest, warnings }
}
