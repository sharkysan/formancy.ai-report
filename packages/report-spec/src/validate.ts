/**
 * Structural validation: whether a document is a report definition this
 * package reads, and every way in which it is not.
 *
 * This is the first of the four levels of plan 15 -- structure, with the
 * references a definition makes into its own declarations and the sizes its
 * own page allows. Whether a declared dataset exists in a deployment,
 * whether an expression compiles against the names `EXPRESSION_NAMES` binds,
 * and whether the rendered output fits are later levels, owned elsewhere.
 */
import { identifier, matches, optional, readObject, shape, strictKeys, text } from './check.js'
import { REGION_NAMES } from './definition.js'
import type { Regions, ReportDefinition } from './definition.js'
import type { ReportError } from './errors.js'
import { MAX_LABEL_LENGTH, MAX_REGION_COMPONENTS } from './limits.js'
import { at } from './pointer.js'
import { LOCALE } from './syntax.js'
import { readAggregates } from './validate-aggregates.js'
import { newContext } from './validate-context.js'
import type { Ctx } from './validate-context.js'
import { readComponents } from './validate-components.js'
import { readAssets, readDatasets, readPage, readParameters, readProvenance, readStyles } from './validate-declarations.js'
import { readEInvoice } from './validate-e-invoice.js'
import { checkMissingFaces, readFontMap } from './validate-font-map.js'
import { readPaymentPart } from './validate-payment-part.js'
import { checkSpecVersion, REPORT_SPEC_VERSION } from './version.js'

export type ReportValidation = { readonly valid: true; readonly report: ReportDefinition } | { readonly valid: false; readonly errors: readonly ReportError[] }

function readRegions(c: Ctx, value: unknown, path: string): Regions | undefined {
  const o = shape(c.f, value, path, REGION_NAMES)
  const [reportHeader, pageHeader, body, pageFooter, summary] = REGION_NAMES.map((region) => {
    const where = at(path, region)
    return readComponents(c, o?.[region], where, { region, regionPath: where, depth: 0, layout: undefined, budget: { left: MAX_REGION_COMPONENTS } })
  })
  if (reportHeader === undefined || pageHeader === undefined || body === undefined || pageFooter === undefined || summary === undefined) return undefined
  return { reportHeader, pageHeader, body, pageFooter, summary }
}

/** The report in `o`, a copy of the document's top level whose version has been checked. */
function readReport(c: Ctx, o: Record<string, unknown>): ReportDefinition | undefined {
  strictKeys(c.f, o, '', ['reportSpecVersion', 'id', 'title', 'locale', 'page', 'styles', 'datasets', 'parameters', 'assets', 'aggregates', 'regions'], ['fonts', 'paymentPart', 'eInvoice', 'provenance'])
  const id = identifier(c.f, o.id, '/id')
  const title = text(c.f, o.title, '/title', MAX_LABEL_LENGTH)
  const locale = matches(c.f, o.locale, '/locale', LOCALE, 'invalid-locale', 'a BCP 47 language tag such as en, de-CH or zh-Hans-CN')
  // The page first, then the declarations: the regions and the payment
  // part are measured against the one and checked against the others, and
  // the e-invoice is held against all of them.
  const page = readPage(c, o.page, '/page')
  const styles = readStyles(c, o.styles, '/styles')
  const datasets = readDatasets(c, o.datasets, '/datasets')
  const parameters = readParameters(c, o.parameters, '/parameters')
  const assets = readAssets(c, o.assets, '/assets')
  const aggregates = readAggregates(c, o.aggregates, '/aggregates')
  // The font map after the assets it references and the styles it is read against, before the regions, which print in it.
  const fonts = readFontMap(c, o.fonts, '/fonts')
  checkMissingFaces(c, styles, fonts, '/styles')
  const regions = readRegions(c, o.regions, '/regions')
  const paymentPart = readPaymentPart(c, o.paymentPart, '/paymentPart', page)
  const eInvoice = readEInvoice(c, o.eInvoice, '/eInvoice', { title, regions, paymentPart })
  const provenance = readProvenance(c.f, o.provenance, '/provenance')
  if (
    id === undefined ||
    title === undefined ||
    locale === undefined ||
    page === undefined ||
    styles === undefined ||
    datasets === undefined ||
    parameters === undefined ||
    assets === undefined ||
    aggregates === undefined ||
    regions === undefined ||
    (o.fonts !== undefined && fonts === undefined) ||
    (o.paymentPart !== undefined && paymentPart === undefined) ||
    (o.eInvoice !== undefined && eInvoice === undefined)
  ) {
    return undefined
  }
  const reportSpecVersion = REPORT_SPEC_VERSION
  return {
    reportSpecVersion,
    id,
    title,
    locale,
    page,
    styles,
    datasets,
    parameters,
    assets,
    aggregates,
    ...optional('fonts', fonts),
    regions,
    ...optional('paymentPart', paymentPart),
    ...optional('eInvoice', eInvoice),
    ...optional('provenance', provenance),
  }
}

/**
 * Whether `document` is a valid report definition, and if not, every reason
 * why -- up to MAX_ERRORS of them, each with a JSON Pointer, a code, a
 * message for a person and the component it is inside.
 *
 * The version is checked first, with `checkSpecVersion`: a formancy form or
 * a later version's report is refused as what it is, with one error, rather
 * than with every way its shape differs.
 *
 * Never throws, whatever it is handed. Every object and array is read once,
 * through its property descriptors, into a copy; a getter is refused and
 * never run, and the report returned is built from what was checked and
 * shares no object with `document`. The work is bounded by the limits in
 * `limits.ts`: an array past its bound is refused before it is read. No
 * message and no path grows with what the document holds.
 */
export function validateReport(document: unknown): ReportValidation {
  const c = newContext()
  const top = readObject(c.f, document, '')
  const version = checkSpecVersion(top)
  if (!version.ok) {
    return { valid: false, errors: [{ path: version.code === 'unsupported-version' ? '/reportSpecVersion' : '', code: version.code, message: version.message }] }
  }
  // checkSpecVersion reads a version only from an object, so `top` is one.
  const report = readReport(c, top as Record<string, unknown>)
  const errors = c.f.errors()
  return report !== undefined && errors.length === 0 ? { valid: true, report } : { valid: false, errors }
}
