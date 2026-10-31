/**
 * A report's data, read from Formancy Data 0.1.0's runtime plane through
 * `@formancy/data-client`, as the person whose token the client carries:
 * the header's one record, the detail rows a page at a time, and each
 * lookup's label. Everything that can be checked without a record -- the
 * binding, the fields the person may read, the parent -- is checked first,
 * and a refusal anywhere hands over nothing.
 *
 * The values are Data's, as Data gave them, with one translation: a
 * nullable yes-or-no's "true" and "false" become booleans. Whether each
 * fits its field is the runtime's to say, once (0010).
 *
 * The data names its source: the published form each dataset was read
 * from, by the id the binding addressed it by, which the render's manifest
 * carries (0041). Data 0.1.0 publishes a form only under its own id, so a
 * form answered under another is refused before any record is read. Not
 * the header record's token: a token spells the record's key
 * (formancy.ai-data 0012), and a key can be the customer's own data. Data
 * read from no form names no source.
 */
import { LIST_PAGE_SIZE } from '@formancy/data-client'
import type { DataClient, FormRecord, Refusal } from '@formancy/data-client'
import { MAX_DETAIL_ROWS } from '@formancy/report-runtime'
import type { FormancyDataSource, ReportData } from '@formancy/report-runtime'
import { isFormId, validateReport } from '@formancy/report-spec'
import type { DatasetRole, ReportDefinition } from '@formancy/report-spec'
import { bindingErrors, planFields, ROLES } from './binding.js'
import type { DataBinding, DetailBinding, FieldPlan, HeaderBinding, ProviderError } from './binding.js'

export interface ReadOptions {
  /**
   * The most detail rows to read: a whole number from 1 to the runtime's
   * `MAX_DETAIL_ROWS`, which is the default. With more rows than that, the
   * data says it is incomplete, and a final render refuses it.
   */
  readonly cap?: number
  /** Stops the reads still to come; the call then rejects with the abort. */
  readonly signal?: AbortSignal
}

export type ProviderRead = { readonly ok: true; readonly data: ReportData } | { readonly ok: false; readonly errors: readonly ProviderError[] }

type Answers = Record<string, unknown>
type Parent = { readonly field: string; readonly record: string }

const refused = (errors: readonly ProviderError[]): ProviderRead => ({ ok: false, errors })

/** Data's refusal, as the provider passes it on: Data's sentence, status and code. */
function fromRefusal(path: string, refusal: Refusal): ProviderError {
  return { path, code: 'refused', message: refusal.message, refusal: { status: refusal.status, code: refusal.code } }
}

/** The declared fields of one record, nothing else it holds, with yes-or-no strings read as booleans. */
function pick(record: FormRecord, plan: FieldPlan): Answers {
  const answers: Answers = {}
  for (const field of plan.fields) {
    if (!Object.hasOwn(record.answers, field)) continue
    const value = record.answers[field]
    answers[field] = plan.yesOrNo.has(field) && (value === 'true' || value === 'false') ? value === 'true' : value
  }
  return answers
}

/** The parent the detail rows are narrowed to: given, or the header record by the one field the person's menu names. */
async function parentOf(
  client: DataClient,
  header: HeaderBinding | undefined,
  detail: DetailBinding,
  signal?: AbortSignal,
): Promise<Parent | undefined | ProviderError> {
  if (detail.parent !== 'header') return detail.parent
  const unknown = (message: string): ProviderError => ({ path: '/detail/parent', code: 'unknown-parent', message })
  if (header === undefined) return unknown("parent 'header' reads the header record's children, and the binding names no header record")
  const menu = await client.forms(signal)
  if (!menu.ok) return fromRefusal('/detail/parent', menu)
  const children = menu.value.forms.find((form) => form.id === header.form)?.children ?? []
  const fields = children.filter((child) => child.form === detail.form).map((child) => child.field)
  const [field] = fields
  if (fields.length === 1 && field !== undefined) return { field, record: header.record }
  return unknown(
    fields.length === 0
      ? "this person's menu does not list the detail form as a child of the header form"
      : "this person's menu lists the detail form under the header form by more than one field; name the field in parent",
  )
}

/** Every detail row up to `cap`, a page at a time from offset 0, and whether Data said none follow. */
async function readRows(
  client: DataClient,
  detail: DetailBinding,
  parent: Parent | undefined,
  cap: number,
  signal?: AbortSignal,
): Promise<{ rows: FormRecord[]; complete: boolean } | ProviderError> {
  const rows: FormRecord[] = []
  // The offset moves by the page asked for, Data's own arithmetic: a row it
  // cannot address is still in its place (formancy.ai-data 0044).
  for (let offset = 0; offset < cap;) {
    const limit = Math.min(LIST_PAGE_SIZE, cap - offset)
    const page = await client.list(
      detail.form,
      { ...(detail.sort === undefined ? {} : { sort: [...detail.sort] }), ...(parent === undefined ? {} : { parent }), offset, limit },
      signal,
    )
    if (!page.ok) return fromRefusal('/detail', page)
    rows.push(...page.value.rows.slice(0, limit))
    if (!page.value.hasMore) return { rows, complete: true }
    offset += limit
  }
  return { rows, complete: false }
}

/**
 * Each lookup value in `records` replaced by its label, asked of Data at
 * most a page's worth of tokens a request (formancy.ai-data 0044), each
 * token once. A token whose label Data did not give is an error naming the
 * field and where it first is, never the token.
 */
async function labelled(
  client: DataClient,
  role: DatasetRole,
  form: string,
  plan: FieldPlan,
  records: Answers[],
  signal?: AbortSignal,
): Promise<ProviderError[]> {
  const errors: ProviderError[] = []
  for (const [field, source] of plan.lookups) {
    const tokens = [...new Set(records.map((record) => record[field]).filter((value): value is string => typeof value === 'string'))]
    const labels = new Map<string, string>()
    for (let at = 0; at < tokens.length; at += LIST_PAGE_SIZE) {
      const resolved = await client.resolve(form, source, { operation: 'read', tokens: tokens.slice(at, at + LIST_PAGE_SIZE) }, signal)
      if (!resolved.ok) return [fromRefusal(`/${role}`, resolved)]
      for (const row of resolved.value) labels.set(row.token, row.label)
    }
    let unresolved = 0
    let first = -1
    records.forEach((record, index) => {
      const value = record[field]
      if (typeof value !== 'string') return
      const label = labels.get(value)
      if (label !== undefined) record[field] = label
      else if (unresolved++ === 0) first = index
    })
    if (unresolved > 0) {
      const path = role === 'header' ? `/header/${field}` : `/detail/${String(first)}/${field}`
      const message =
        unresolved === 1
          ? `one value of ${field} names a record whose label this person may not see`
          : `${String(unresolved)} values of ${field} name records whose label this person may not see`
      errors.push({ path, code: 'unresolved-label', message })
    }
  }
  return errors
}

/**
 * The data `report` renders from, read from Formancy Data through `client`
 * where `binding` says, or every reason it was not. Its consistency is
 * `best-effort`: Data 0.1.0 has no snapshot, so the header, each page and
 * each label are read at different moments. Its source names the forms it
 * read (0041). Rejects only with the abort `options.signal` raised.
 */
export async function readReportData(client: DataClient, report: ReportDefinition, binding: DataBinding, options: ReadOptions = {}): Promise<ProviderRead> {
  const { signal } = options
  signal?.throwIfAborted()
  const checked = validateReport(report)
  if (!checked.valid) return refused([{ path: '', code: 'invalid-report', message: 'report-spec refuses this report; validateReport says why' }])
  const cap = options.cap ?? MAX_DETAIL_ROWS
  if (!Number.isInteger(cap) || cap < 1 || cap > MAX_DETAIL_ROWS) {
    return refused([{ path: '', code: 'invalid-cap', message: `a cap is a whole number of rows from 1 to ${String(MAX_DETAIL_ROWS)}` }])
  }
  const { datasets } = checked.report
  const unbound = bindingErrors(datasets, binding)
  if (unbound.length > 0) return refused(unbound)

  // Every form, and the parent, before any record: what can be refused
  // without reading the customer's data is refused without reading it.
  const plans = new Map<DatasetRole, FieldPlan>()
  const forms: { [R in DatasetRole]?: string } = {}
  const errors: ProviderError[] = []
  for (const role of ROLES) {
    const contract = datasets[role]
    const bound = binding[role]
    if (contract === undefined || bound === undefined) continue
    signal?.throwIfAborted()
    const published = await client.form(bound.form)
    if (!published.ok) return refused([fromRefusal(`/${role}`, published)])
    // The source names this form, and the fields are planned from it: an
    // answer under another id is not the form the records are read from.
    if (published.value.form.id !== bound.form || !isFormId(bound.form)) {
      return refused([
        {
          path: `/${role}`,
          code: 'unexpected-form',
          message: `Data answered the ${role} form with a published form under another id, or one that is no formancy form id; Data 0.1.0 publishes a form only under its own`,
        },
      ])
    }
    const { plan, errors: found } = planFields(role, contract, published.value)
    errors.push(...found)
    if (role === 'detail' && published.value.list === null) {
      errors.push({ path: '/detail', code: 'not-listable', message: 'the detail form offers this person no list of its records' })
    }
    plans.set(role, plan)
    forms[role] = bound.form
  }
  let parent: Parent | undefined
  if (binding.detail !== undefined) {
    const found = await parentOf(client, binding.header, binding.detail, signal)
    if (found !== undefined && 'code' in found) errors.push(found)
    else parent = found
  }
  if (errors.length > 0) return refused(errors)

  const headerPlan = plans.get('header')
  let header: Answers | undefined
  if (binding.header !== undefined && headerPlan !== undefined) {
    signal?.throwIfAborted()
    const record = await client.read(binding.header.form, binding.header.record)
    if (!record.ok) return refused([fromRefusal('/header', record)])
    header = pick(record.value, headerPlan)
    errors.push(...(await labelled(client, 'header', binding.header.form, headerPlan, [header], signal)))
  }
  const detailPlan = plans.get('detail')
  let detail: { rows: Answers[]; complete: boolean } | undefined
  if (binding.detail !== undefined && detailPlan !== undefined) {
    const read = await readRows(client, binding.detail, parent, cap, signal)
    if ('code' in read) return refused([read])
    detail = { rows: read.rows.map((row) => pick(row, detailPlan)), complete: read.complete }
    errors.push(...(await labelled(client, 'detail', binding.detail.form, detailPlan, detail.rows, signal)))
  }
  if (errors.length > 0) return refused(errors)

  // Data read from no form has no source to name.
  const source: FormancyDataSource | undefined = Object.keys(forms).length === 0 ? undefined : { provider: 'formancy-data', forms }
  return {
    ok: true,
    data: {
      ...(header === undefined ? {} : { header }),
      ...(detail === undefined ? {} : { detail: detail.rows }),
      completeness: detail === undefined ? { complete: true, captured: 0 } : { complete: detail.complete, captured: detail.rows.length, cap },
      consistency: 'best-effort',
      ...(source === undefined ? {} : { source }),
    },
  }
}
