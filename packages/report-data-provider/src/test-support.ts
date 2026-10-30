/**
 * What the provider's tests read from: a data server that answers the
 * routes of Formancy Data 0.1.0's runtime plane that the provider asks, from
 * records held in memory, behind the real `@formancy/data-client` 0.1.0.
 * The client checks every reply's shape and calls one that is not the
 * server's `unexpected`, so a fixture that drifted from Data's contract
 * fails the tests rather than passing them. Only test files import this.
 *
 * It is a fixture and not Data: no database, no policy and no snapshot. What
 * a person may read is whatever `readable` and the records say, and a list
 * is sorted by plain string order. A claim about Data's own behaviour is
 * Data's to prove, against its databases (formancy.ai-data 0003).
 *
 * `orderForms` is a quotation's order and its lines as Data generates forms
 * for two tables: an order header with a lookup of its customer, a nullable
 * yes-or-no, a decimal and an instant; and lines that name their order by a
 * lookup, which is what makes them the order's children in the menu.
 */
import { createDataClient } from '@formancy/data-client'
import type { DataClient, FormMenu, FormRecord, PublishedForm } from '@formancy/data-client'
import { validateReport } from '@formancy/report-spec'
import type { FieldRef, ReportDefinition } from '@formancy/report-spec'

type Field = PublishedForm['form']['model']['fields'][number]

/** One form the fixture serves: what `GET /v1/forms/:id` answers, its records, and the labels each lookup source gives a token. */
export interface FixtureForm {
  readonly published: PublishedForm
  readonly records: readonly FormRecord[]
  readonly labels?: Readonly<Record<string, Readonly<Record<string, string>>>>
}

/** A request as the fixture received it: what the provider asked, and with which token. */
export interface Received {
  readonly method: string
  readonly path: string
  readonly body: unknown
  readonly authorization: string | null
}

export interface DataFixture {
  readonly client: DataClient
  readonly requests: Received[]
  /** Answers the next request whose path ends with `suffix` with this status and body, in place of the fixture's own answer. */
  answerNext(suffix: string, status: number, body: unknown): void
}

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const notFound = (): Response => json(404, { code: 'not-found', message: 'No such form or record.' })

type ListBody = {
  readonly parent?: { readonly field: string; readonly record: string }
  readonly sort?: readonly { readonly field: string; readonly direction: 'asc' | 'desc' }[]
  readonly offset?: number
  readonly limit?: number
}

/** The page `list` answers: Data's defaults for what is left out, at most 50 rows, and whether more follow. */
function page(form: FixtureForm, body: ListBody): Response {
  const parent = body.parent
  const rows = form.records.filter((row) => parent === undefined || row.answers[parent.field] === parent.record)
  const sorted = [...rows].sort((a, b) => {
    for (const term of body.sort ?? []) {
      const order = String(a.answers[term.field]).localeCompare(String(b.answers[term.field]))
      if (order !== 0) return term.direction === 'asc' ? order : -order
    }
    return 0
  })
  const offset = body.offset ?? 0
  const limit = Math.min(body.limit ?? 50, 50)
  return json(200, { rows: sorted.slice(offset, offset + limit), hasMore: offset + limit < sorted.length })
}

/** A data client of a server holding `forms` and answering `menu`, and every request it was asked. */
export function dataFixture(forms: Readonly<Record<string, FixtureForm>>, menu: FormMenu, token = 'person-token'): DataFixture {
  const requests: Received[] = []
  const refusals: { suffix: string; status: number; body: unknown }[] = []
  const serve = (method: string, path: string, body: unknown): Response => {
    const refusal = refusals.findIndex((entry) => path.endsWith(entry.suffix))
    if (refusal !== -1) {
      const [entry] = refusals.splice(refusal, 1)
      return json(entry?.status ?? 500, entry?.body)
    }
    if (method === 'GET' && path === '/v1/forms') return json(200, menu)
    const [, , , id = '', kind, name, action] = path.split('/').map(decodeURIComponent)
    const form = Object.hasOwn(forms, id) ? forms[id] : undefined
    if (form === undefined) return notFound()
    if (method === 'GET' && kind === undefined) return json(200, form.published)
    const request = body as Record<string, unknown>
    if (kind === 'records' && name === 'read') {
      const found = form.records.find((row) => row.record === request['record'])
      return found === undefined ? notFound() : json(200, found)
    }
    if (kind === 'records' && name === 'list') return page(form, request)
    if (kind === 'lookups' && action === 'resolve') {
      const labels = form.labels?.[name ?? ''] ?? {}
      const tokens = request['tokens'] as string[]
      return json(200, { rows: tokens.filter((one) => Object.hasOwn(labels, one)).map((one) => ({ token: one, label: labels[one] })) })
    }
    return notFound()
  }
  const fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    init?.signal?.throwIfAborted()
    const path = new URL(String(input), 'http://data.invalid').pathname
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    const authorization = new Headers(init?.headers).get('authorization')
    requests.push({ method: init?.method ?? 'GET', path, body, authorization })
    return Promise.resolve(serve(init?.method ?? 'GET', path, body))
  }
  return {
    client: createDataClient({ token: () => token, fetch: fetch }),
    requests,
    answerNext: (suffix, status, body) => {
      refusals.push({ suffix, status, body })
    },
  }
}

const text = (key: string, more: Partial<Field> = {}): Field => ({ key, type: 'text', label: key, ...more })
const lookup = (key: string, source: string): Field => ({ key, type: 'select', label: key, optionsSource: source })
const yesOrNo = (key: string): Field => ({
  key,
  type: 'radio',
  label: key,
  options: [
    { value: 'true', label: 'Yes' },
    { value: 'false', label: 'No' },
  ],
})

function published(id: string, fields: readonly Field[], readable: readonly string[]): PublishedForm {
  return {
    form: { specVersion: '3', id, title: id, model: { fields: [...fields] } },
    operations: ['read'],
    readable: [...readable],
    list: { searchable: [], sortable: [...readable] },
    deleting: null,
  }
}

/** The order's lines: `count` of them for order `o-1`, and two for another order the person may also read. */
export function orderForms(count = 3): Record<string, FixtureForm> {
  const lines: FormRecord[] = Array.from({ length: count }, (_, index) => ({
    record: `l-${String(index + 1)}`,
    version: '1',
    answers: {
      order: 'o-1',
      article: `A-${String(1000 + index)}`,
      quantity: index + 1,
      amount: `${String(100 + index)}.50`,
      shippedAt: '2026-10-15T08:30:00Z',
      // A column the report does not print: the provider never hands it over.
      warehouse: 'Basel',
    },
  }))
  const other: FormRecord[] = ['l-x', 'l-y'].map((record) => ({
    record,
    version: '1',
    answers: { order: 'o-2', article: 'B-1', quantity: 1, amount: '1.00', shippedAt: null, warehouse: 'Bern' },
  }))
  return {
    order: {
      published: published(
        'order',
        [
          text('number'),
          lookup('customer', 'customers'),
          { key: 'orderedOn', type: 'date', label: 'orderedOn' },
          text('total', { pattern: '^-?[0-9]{1,12}(\\.[0-9]{1,2})?$' }),
          yesOrNo('paid'),
          text('internal'),
        ],
        ['number', 'customer', 'orderedOn', 'total', 'paid'],
      ),
      records: [
        { record: 'o-1', version: '7', answers: { number: 'Q-2026-0042', customer: 'c-9', orderedOn: '2026-10-15', total: '3143.00', paid: 'false' } },
        { record: 'o-2', version: '1', answers: { number: 'Q-2026-0043', customer: 'c-9', orderedOn: '2026-10-16', total: '1.00', paid: null } },
      ],
      labels: { customers: { 'c-9': 'Bäckerei Müller AG' } },
    },
    'order-line': {
      published: published(
        'order-line',
        [
          lookup('order', 'orders'),
          text('article'),
          { key: 'quantity', type: 'number', label: 'quantity' },
          text('amount'),
          { key: 'shippedAt', type: 'datetime', label: 'shippedAt' },
          text('warehouse'),
        ],
        ['order', 'article', 'quantity', 'amount', 'shippedAt', 'warehouse'],
      ),
      records: [...lines, ...other],
      labels: { orders: { 'o-1': 'Q-2026-0042' } },
    },
  }
}

/** The menu Data answers for the order forms: the lines are the order's children, named by their `order` lookup. */
export const ORDER_MENU: FormMenu = {
  forms: [
    { id: 'order', title: 'Orders', operations: ['read'], children: [{ form: 'order-line', field: 'order' }] },
    { id: 'order-line', title: 'Order lines', operations: ['read'], children: [] },
  ],
}

const header = (field: string): FieldRef => ({ dataset: 'header', field })
const detail = (field: string): FieldRef => ({ dataset: 'detail', field })

/** A quotation that prints the order and its lines: what the order forms hold, as a report declares it. */
export function orderReport(): ReportDefinition {
  const report: ReportDefinition = {
    reportSpecVersion: '0',
    id: 'quotation',
    title: 'Quotation',
    locale: 'de-CH',
    page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 42.52, bottom: 56.69, left: 42.52 } },
    styles: [],
    datasets: {
      header: {
        id: 'order',
        fields: [
          { id: 'number', type: 'string', label: 'Number', nullable: false },
          { id: 'customer', type: 'string', label: 'Customer', nullable: false },
          { id: 'orderedOn', type: 'date', label: 'Ordered on', nullable: false },
          { id: 'total', type: 'decimal', label: 'Total', nullable: false, scale: 2 },
          { id: 'paid', type: 'boolean', label: 'Paid', nullable: true },
        ],
      },
      detail: {
        id: 'order-lines',
        fields: [
          { id: 'article', type: 'string', label: 'Article', nullable: false },
          { id: 'quantity', type: 'integer', label: 'Quantity', nullable: false },
          { id: 'amount', type: 'decimal', label: 'Amount', nullable: false, scale: 2 },
          { id: 'shippedAt', type: 'instant', label: 'Shipped', nullable: true },
        ],
      },
    },
    parameters: [],
    assets: [],
    aggregates: [{ id: 'total', fn: 'sum', of: { kind: 'field', field: detail('amount') }, rounding: { scale: 2, mode: 'half-even' } }],
    regions: {
      reportHeader: [
        {
          id: 'title',
          kind: 'text',
          content: [
            { kind: 'field', field: header('number') },
            { kind: 'text', text: ' for ' },
            { kind: 'field', field: header('customer') },
          ],
        },
      ],
      pageHeader: [],
      body: [
        {
          id: 'lines',
          kind: 'table',
          dataset: 'detail',
          columns: [
            { id: 'article', header: 'Article', width: 'fill', align: 'left', value: { kind: 'field', field: detail('article') } },
            { id: 'quantity', header: 'Quantity', width: 60, align: 'right', value: { kind: 'field', field: detail('quantity') } },
            { id: 'amount', header: 'Amount', width: 80, align: 'right', value: { kind: 'field', field: detail('amount') } },
          ],
          sort: [],
          totals: [{ cells: [{ column: 'amount', value: { kind: 'aggregate', aggregate: 'total', over: 'report' } }] }],
          emptyText: 'No lines.',
          repeatHeader: true,
        },
      ],
      pageFooter: [],
      summary: [],
    },
  }
  const checked = validateReport(report)
  if (!checked.valid) throw new Error(`the order report is not valid: ${JSON.stringify(checked.errors)}`)
  return report
}
