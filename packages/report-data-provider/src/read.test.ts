import { resolveReport } from '@formancy/report-runtime'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { readReportData } from './read.js'
import type { DataBinding } from './binding.js'
import type { ProviderRead } from './read.js'
import { dataFixture, ORDER_MENU, orderForms, orderReport } from './test-support.js'
import type { FixtureForm } from './test-support.js'

const HEADER = { form: 'order', record: 'o-1' } as const
const ORDER: DataBinding = { header: HEADER, detail: { form: 'order-line', parent: 'header' } }
const RESOLVE = { creationDate: '2026-10-16T08:00:00Z', timeZone: 'Europe/Zurich' } as const

function read(read: ProviderRead) {
  if (!read.ok) throw new Error(`the provider refused: ${JSON.stringify(read.errors)}`)
  return read.data
}

const lists = (requests: readonly { path: string; body: unknown }[]) => requests.filter((request) => request.path.endsWith('/records/list')).map((request) => request.body)

describe('readReportData', () => {
  // The provider's one job: what a Data form holds becomes data the runtime
  // renders, without a field the report does not print -- the runtime
  // refuses one, and a column like the warehouse is customer data a report
  // never asked for -- and with a lookup's label rather than its token,
  // which would print as an opaque string.
  test('reads an order and its lines into data a final render resolves', async () => {
    const fixture = dataFixture(orderForms(), ORDER_MENU)
    const data = read(await readReportData(fixture.client, orderReport(), ORDER))
    expect(data.header).toEqual({ number: 'Q-2026-0042', customer: 'Bäckerei Müller AG', orderedOn: '2026-10-15', total: '3143.00', paid: false })
    expect(data.detail).toEqual([1, 2, 3].map((n) => ({ article: `A-${String(999 + n)}`, quantity: n, amount: `${String(99 + n)}.50`, shippedAt: '2026-10-15T08:30:00Z' })))
    expect(data.completeness).toEqual({ complete: true, captured: 3, cap: 100_000 })
    const resolution = resolveReport(orderReport(), data, { mode: 'final', ...RESOLVE })
    expect(resolution.ok ? resolution.manifest.consistency : resolution.errors).toBe('best-effort')
  })

  // Data 0.1.0 has no snapshot export: the header, each page and each
  // label are read at different moments. Called anything stronger, a
  // report could total lines that were never in one state together.
  test('labels its data best-effort, and asks with the person’s token on every request', async () => {
    const fixture = dataFixture(orderForms(), ORDER_MENU, 'their-own')
    expect(read(await readReportData(fixture.client, orderReport(), ORDER)).consistency).toBe('best-effort')
    expect(fixture.requests.length).toBeGreaterThan(0)
    expect(fixture.requests.every((request) => request.authorization === 'Bearer their-own')).toBe(true)
  })

  // A nullable yes-or-no column is a radio of the strings "true" and
  // "false" in a Data form, and the runtime's boolean is true or false.
  // Passed through, every such report would be refused; read as anything
  // else, "false" would print as yes.
  test('reads a Data yes-or-no as a boolean, and no answer as null', async () => {
    const fixture = dataFixture(orderForms(), ORDER_MENU)
    const second = read(await readReportData(fixture.client, orderReport(), { header: { form: 'order', record: 'o-2' }, detail: { form: 'order-line', parent: 'header' } }))
    expect(second.header?.['paid']).toBe(null)
  })

  // A list answers fifty rows a page. Read once, a report of 120 lines
  // would print 50 and call itself complete.
  test('reads every page, in the order Data gives them', async () => {
    const fixture = dataFixture(orderForms(120), ORDER_MENU)
    const data = read(await readReportData(fixture.client, orderReport(), ORDER))
    expect(data.detail?.map((row) => row['article'])).toEqual(Array.from({ length: 120 }, (_, index) => `A-${String(1000 + index)}`))
    expect(data.completeness).toEqual({ complete: true, captured: 120, cap: 100_000 })
    expect(lists(fixture.requests).map((body) => (body as { offset: number }).offset)).toEqual([0, 50, 100])
  })

  // A cap is how a host bounds what one render reads. Past it the data is
  // incomplete and says so: a final render refuses it, and a preview prints
  // what it has under a label, rather than a report silently cut short.
  test('stops at the cap and says the data is incomplete', async () => {
    const fixture = dataFixture(orderForms(120), ORDER_MENU)
    const data = read(await readReportData(fixture.client, orderReport(), ORDER, { cap: 60 }))
    expect(data.detail).toHaveLength(60)
    expect(data.completeness).toEqual({ complete: false, captured: 60, cap: 60 })
    expect(lists(fixture.requests).map((body) => (body as { limit: number }).limit)).toEqual([50, 10])
    const final = resolveReport(orderReport(), data, { mode: 'final', ...RESOLVE })
    expect(final.ok ? 'resolved' : final.errors.map((error) => error.code)).toEqual(['incomplete'])
    expect(resolveReport(orderReport(), data, { mode: 'preview', ...RESOLVE }).ok).toBe(true)
  })

  // Exactly as many rows as the cap is complete when Data says no more
  // follow; called incomplete, every report that fits its cap exactly
  // would be refused.
  test('calls a list that ends at the cap complete', async () => {
    const fixture = dataFixture(orderForms(100), ORDER_MENU)
    expect(read(await readReportData(fixture.client, orderReport(), ORDER, { cap: 100 })).completeness).toEqual({ complete: true, captured: 100, cap: 100 })
  })

  // A report of one record -- a certificate, a letter -- has no lines, and
  // says it captured none: given any other count, the runtime refuses the
  // data as rows lost on the way.
  test('reads a report with no detail dataset as one record and no rows', async () => {
    const fixture = dataFixture(orderForms(), ORDER_MENU)
    const { detail: _, ...datasets } = orderReport().datasets
    const letter: ReportDefinition = { ...orderReport(), datasets, aggregates: [], regions: { ...orderReport().regions, body: [] } }
    const data = read(await readReportData(fixture.client, letter, { header: HEADER }))
    expect(data).toEqual({ header: expect.any(Object), completeness: { complete: true, captured: 0 }, consistency: 'best-effort' })
    expect(resolveReport(letter, data, { mode: 'final', ...RESOLVE }).ok).toBe(true)
  })

  // The order is Data's to apply, by the fields the person may sort by;
  // a host's sort that silently did not reach Data would print the lines
  // in key order and look right.
  test('asks Data for the binding’s order', async () => {
    const fixture = dataFixture(orderForms(3), ORDER_MENU)
    const sort = [{ field: 'article', direction: 'desc' as const }]
    const data = read(await readReportData(fixture.client, orderReport(), { ...ORDER, detail: { form: 'order-line', parent: 'header', sort } }))
    expect(data.detail?.map((row) => row['article'])).toEqual(['A-1002', 'A-1001', 'A-1000'])
    expect(lists(fixture.requests)).toEqual([{ sort, parent: { field: 'order', record: 'o-1' }, offset: 0, limit: 50 }])
  })

  // `parent: 'header'` reads the header record's children; with no header
  // record there is nothing to read them under, and every line the person
  // may read is not what it asked for.
  test("refuses parent 'header' when the report reads no header", async () => {
    const fixture = dataFixture(orderForms(), ORDER_MENU)
    const { header: _, ...datasets } = orderReport().datasets
    const report = orderReport()
    const lines: ReportDefinition = { ...report, datasets, regions: { ...report.regions, reportHeader: [] } }
    const result = await readReportData(fixture.client, lines, { detail: { form: 'order-line', parent: 'header' } })
    expect(result.ok ? 'read' : result.errors.map(({ path, code }) => ({ path, code }))).toEqual([{ path: '/detail/parent', code: 'unknown-parent' }])
  })

  // A cap past the runtime's own bound would read rows only for the
  // runtime to refuse them all; one under a row is no read at all.
  test('refuses a cap that is not a count the runtime can take', async () => {
    for (const cap of [0, 1.5, 100_001]) {
      const fixture = dataFixture(orderForms(), ORDER_MENU)
      const result = await readReportData(fixture.client, orderReport(), ORDER, { cap })
      expect(result.ok ? 'read' : result.errors.map((error) => error.code)).toEqual(['invalid-cap'])
      expect(fixture.requests).toEqual([])
    }
  })

  // The lines of one order, not every line the person may read: `header`
  // finds the field that makes the lines the order's children in the
  // person's menu. Without it, a quotation would print every order's lines.
  test("reads the header record's children through the field the menu names", async () => {
    const fixture = dataFixture(orderForms(), ORDER_MENU)
    const data = read(await readReportData(fixture.client, orderReport(), ORDER))
    expect(data.detail).toHaveLength(3)
    expect(lists(fixture.requests)).toEqual([{ parent: { field: 'order', record: 'o-1' }, offset: 0, limit: 50 }])
    const explicit = dataFixture(orderForms(), ORDER_MENU)
    const parent = { field: 'order', record: 'o-2' }
    expect(read(await readReportData(explicit.client, orderReport(), { ...ORDER, detail: { form: 'order-line', parent } })).detail).toHaveLength(2)
    expect(explicit.requests.some((request) => request.path === '/v1/forms')).toBe(false)
  })

  // A detail form the menu does not list as the header form's child, or
  // lists by two fields, has no one answer to "this record's lines". A
  // guess would print the wrong lines; nothing is read instead.
  test('refuses a parent the menu does not name exactly once, before reading a record', async () => {
    const twice = { forms: [{ ...ORDER_MENU.forms[0]!, children: [{ form: 'order-line', field: 'order' }, { form: 'order-line', field: 'reorder' }] }] }
    for (const menu of [{ forms: [] }, twice]) {
      const fixture = dataFixture(orderForms(), menu)
      const result = await readReportData(fixture.client, orderReport(), ORDER)
      expect(result.ok ? 'read' : result.errors.map(({ path, code }) => ({ path, code }))).toEqual([{ path: '/detail/parent', code: 'unknown-parent' }])
      expect(fixture.requests.some((request) => request.path.includes('/records/'))).toBe(false)
    }
  })

  // Which Data form a dataset reads is the host's binding, and the report
  // says which datasets there are. One without the other is a mistake in
  // the binding, found before anything is asked of the server.
  test('refuses a binding that does not match the report’s datasets, without a request', async () => {
    const fixture = dataFixture(orderForms(), ORDER_MENU)
    const unbound = await readReportData(fixture.client, orderReport(), { header: HEADER })
    expect(unbound.ok ? 'read' : unbound.errors.map(({ path, code }) => ({ path, code }))).toEqual([{ path: '/detail', code: 'unbound-dataset' }])
    const { detail: _, ...datasets } = orderReport().datasets
    const headerOnly: ReportDefinition = { ...orderReport(), datasets, aggregates: [], regions: { ...orderReport().regions, body: [] } }
    const undeclared = await readReportData(fixture.client, headerOnly, ORDER)
    expect(undeclared.ok ? 'read' : undeclared.errors.map(({ path, code }) => ({ path, code }))).toEqual([{ path: '/detail', code: 'undeclared-dataset' }])
    expect(fixture.requests).toEqual([])
  })

  // A field the person may not read is absent from every record Data
  // sends them; read anyway, it would be a missing field on every row, and
  // a host could not tell a policy from a typo. The form says what they
  // may read, so the provider says which field before it reads a record.
  test('refuses a field the person may not read on the form, naming it, before reading a record', async () => {
    const fixture = dataFixture(orderForms(), ORDER_MENU)
    const report = orderReport()
    const header = report.datasets.header!
    const nosy: ReportDefinition = { ...report, datasets: { ...report.datasets, header: { ...header, fields: [...header.fields, { id: 'internal', type: 'string', label: 'Internal', nullable: true }] } } }
    const result = await readReportData(fixture.client, nosy, ORDER)
    expect(result.ok ? 'read' : result.errors.map(({ path, code }) => ({ path, code }))).toEqual([{ path: '/header/internal', code: 'unreadable-field' }])
    expect(fixture.requests.some((request) => request.path.includes('/records/'))).toBe(false)
  })

  // A group or a page arranges a record's fields and holds answers of the
  // record; a repeater's fields are answers inside its rows, which no
  // report field is. Read through a group, a field would otherwise be
  // called unreadable; read into a repeater, a report would ask for an
  // answer no record holds at its top.
  test('finds a field inside a group or a page, and none inside a repeater', async () => {
    const forms = orderForms()
    const order = forms['order'] as FixtureForm
    const [number, customer, ...rest] = order.published.form.model.fields
    const fields = [{ key: 'about', type: 'group', fields: [number] }, { key: 'who', type: 'page', fields: [customer] }, ...rest]
    const grouped = { ...order, published: { ...order.published, form: { ...order.published.form, model: { fields } } } } as FixtureForm
    expect(read(await readReportData(dataFixture({ ...forms, order: grouped }, ORDER_MENU).client, orderReport(), ORDER)).header?.['customer']).toBe('Bäckerei Müller AG')
    const repeated = { ...grouped, published: { ...grouped.published, form: { ...grouped.published.form, model: { fields: [{ key: 'rows', type: 'repeater', fields: [number] }, customer, ...rest] } } } } as FixtureForm
    const result = await readReportData(dataFixture({ ...forms, order: repeated }, ORDER_MENU).client, orderReport(), ORDER)
    expect(result.ok ? 'read' : result.errors.map(({ path, code }) => ({ path, code }))).toEqual([{ path: '/header/number', code: 'unreadable-field' }])
  })

  // Data 0.1.0 holds no approved asset, and the runtime prints an image
  // only from one. A token or a file name in an image field would be an
  // address, which nothing here follows.
  test('refuses an image field, which Data 0.1.0 has nothing to fill', async () => {
    const fixture = dataFixture(orderForms(), ORDER_MENU)
    const report = orderReport()
    const header = report.datasets.header!
    const pictured: ReportDefinition = { ...report, datasets: { ...report.datasets, header: { ...header, fields: [...header.fields, { id: 'number2', type: 'image', label: 'Logo', nullable: true }] } } }
    const result = await readReportData(fixture.client, pictured, ORDER)
    expect(result.ok ? 'read' : result.errors.map(({ path, code }) => ({ path, code }))).toEqual([{ path: '/header/number2', code: 'unsupported-field' }])
  })

  // Data offers a person no list of a form whose key they cannot read
  // (formancy.ai-data 0044): asked anyway, the server refuses the first
  // page. Said before, it names the form rather than a page.
  test('refuses a detail form Data offers this person no list of', async () => {
    const forms = orderForms()
    const line = forms['order-line'] as FixtureForm
    const unlisted = { ...forms, 'order-line': { ...line, published: { ...line.published, list: null } } }
    const fixture = dataFixture(unlisted, ORDER_MENU)
    const result = await readReportData(fixture.client, orderReport(), ORDER)
    expect(result.ok ? 'read' : result.errors.map(({ path, code }) => ({ path, code }))).toEqual([{ path: '/detail', code: 'not-listable' }])
  })

  // Data's refusal is the answer -- a record that is gone, a policy that
  // says no, a server that is down -- and its code and sentence are the
  // server's, which never echo a value. A refusal on a later page is still
  // a refusal: no part of the lines is handed over.
  test('passes Data’s refusals on, and hands over nothing after one', async () => {
    const gone = dataFixture(orderForms(), ORDER_MENU)
    const missing = await readReportData(gone.client, orderReport(), { ...ORDER, header: { form: 'order', record: 'o-404' } })
    expect(missing).toEqual({ ok: false, errors: [{ path: '/header', code: 'refused', message: 'No such form or record.', refusal: { status: 404, code: 'not-found' } }] })
    const down = dataFixture(orderForms(120), ORDER_MENU)
    let pages = 0
    const client = { ...down.client, list: async (...args: Parameters<typeof down.client.list>) => (++pages === 2 ? { ok: false as const, status: 503, code: 'unavailable', message: 'The database is not answering.' } : down.client.list(...args)) }
    const partial = await readReportData(client, orderReport(), ORDER)
    expect(partial).toEqual({ ok: false, errors: [{ path: '/detail', code: 'refused', message: 'The database is not answering.', refusal: { status: 503, code: 'unavailable' } }] })
    // The form, the menu and a label are Data's answers too.
    for (const [suffix, path] of [['/v1/forms/order', '/header'], ['/v1/forms', '/detail/parent'], ['/lookups/customers/resolve', '/header']] as const) {
      const fixture = dataFixture(orderForms(), ORDER_MENU)
      fixture.answerNext(suffix, 403, { code: 'forbidden', message: 'This person may not do that.' })
      const result = await readReportData(fixture.client, orderReport(), ORDER)
      expect(result).toEqual({ ok: false, errors: [{ path, code: 'refused', message: 'This person may not do that.', refusal: { status: 403, code: 'forbidden' } }] })
    }
  })

  // A label the person may not see is left out of Data's answer, not an
  // error there. Printed as nothing it would be a silently dropped value,
  // and printed as the token an opaque one; the report is refused, naming
  // the field and never the token.
  test('refuses a lookup whose label the person may not see, naming the field and not the value', async () => {
    const fixture = dataFixture(orderForms(), ORDER_MENU)
    fixture.answerNext('/lookups/customers/resolve', 200, { rows: [] })
    const result = await readReportData(fixture.client, orderReport(), ORDER)
    expect(result.ok ? 'read' : result.errors).toEqual([{ path: '/header/customer', code: 'unresolved-label', message: 'one value of customer names a record whose label this person may not see' }])
    expect(JSON.stringify(result)).not.toContain('c-9')
    // In the lines, the first row that holds one, and how many there are.
    const forms = orderForms(4)
    const line = forms['order-line'] as FixtureForm
    const lines = dataFixture({ ...forms, 'order-line': { ...line, labels: { orders: {} } } }, ORDER_MENU)
    const report = orderReport()
    const detail = report.datasets.detail!
    const withOrder: ReportDefinition = { ...report, datasets: { ...report.datasets, detail: { ...detail, fields: [...detail.fields, { id: 'order', type: 'string', label: 'Order', nullable: false }] } } }
    const many = await readReportData(lines.client, withOrder, ORDER)
    expect(many.ok ? 'read' : many.errors).toEqual([{ path: '/detail/0/order', code: 'unresolved-label', message: '4 values of order name records whose label this person may not see' }])
  })

  // One page's tokens for one lookup fit one resolve (formancy.ai-data
  // 0044); more in one request, and Data refuses it. Tokens are asked once
  // each, however many rows hold them.
  test('resolves labels at most fifty tokens a request, each token once', async () => {
    const forms = orderForms(120)
    const line = forms['order-line'] as FixtureForm
    const labels = Object.fromEntries(Array.from({ length: 60 }, (_, index) => [`o-${String(index)}`, `Order ${String(index)}`]))
    const records = line.records.map((row, index) => ({ ...row, answers: { ...row.answers, order: `o-${String(index % 60)}` } }))
    const fixture = dataFixture({ ...forms, 'order-line': { ...line, records, labels: { orders: labels } } }, ORDER_MENU)
    const report = orderReport()
    const lines = report.datasets.detail!
    const withOrder: ReportDefinition = { ...report, datasets: { ...report.datasets, detail: { ...lines, fields: [...lines.fields, { id: 'order', type: 'string', label: 'Order', nullable: false }] } } }
    const data = read(await readReportData(fixture.client, withOrder, { header: HEADER, detail: { form: 'order-line' } }))
    expect(data.detail?.[61]?.['order']).toBe('Order 1')
    const asked = fixture.requests.filter((request) => request.path.endsWith('/lookups/orders/resolve')).map((request) => (request.body as { tokens: string[] }).tokens)
    expect(asked.map((tokens) => tokens.length)).toEqual([50, 10])
    expect(new Set(asked.flat()).size).toBe(60)
  })

  // A host that gives up -- the person closed the page -- stops the reads
  // still to come; Data stops a lookup's statement when its request is
  // abandoned (formancy.ai-data 0061). Swallowed, the abort would surface
  // as a refusal the host never caused.
  test('stops on an abort, rejecting with the abort', async () => {
    const fixture = dataFixture(orderForms(120), ORDER_MENU)
    const controller = new AbortController()
    controller.abort()
    await expect(readReportData(fixture.client, orderReport(), ORDER, { signal: controller.signal })).rejects.toThrow(/abort/i)
    expect(fixture.requests).toEqual([])
  })

  // The provider reads `datasets` and nothing else of the report; a
  // malformed one would throw from deep inside it. The runtime would refuse
  // it later anyway, and nothing is asked of Data first.
  test('refuses a report report-spec refuses, without a request', async () => {
    const fixture = dataFixture(orderForms(), ORDER_MENU)
    const result = await readReportData(fixture.client, { ...orderReport(), datasets: { header: { id: 'order', fields: 'all' } } } as unknown as ReportDefinition, ORDER)
    expect(result.ok ? 'read' : result.errors.map(({ path, code }) => ({ path, code }))).toEqual([{ path: '', code: 'invalid-report' }])
    expect(fixture.requests).toEqual([])
  })

  // The runtime holds every value to its field's type, once (0010). A value
  // the provider passes through that breaks the report's contract -- a
  // decimal with more digits than the report's scale -- is the runtime's
  // to refuse, and it does; the provider rounds nothing.
  test('hands a value over as Data gave it, for the runtime to judge', async () => {
    const forms = orderForms()
    const order = forms['order'] as FixtureForm
    const precise = order.records.map((row) => ({ ...row, answers: { ...row.answers, total: '3143.0049' } }))
    const fixture = dataFixture({ ...forms, order: { ...order, records: precise } }, ORDER_MENU)
    const data = read(await readReportData(fixture.client, orderReport(), ORDER))
    expect(data.header?.['total']).toBe('3143.0049')
    const resolution = resolveReport(orderReport(), data, { mode: 'final', ...RESOLVE })
    expect(resolution.ok ? 'resolved' : resolution.errors.map(({ path }) => path)).toEqual(['/header/total'])
  })
})
