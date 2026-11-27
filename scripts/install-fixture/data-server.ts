/*
 * A data server answering Formancy Data 0.5.0's runtime routes, which the
 * install gate's Data provider reads the quotation from (0016): the two
 * published forms, the menu that makes the lines the quotation's
 * children, the quotation's one record and its lines, every value as Data
 * spells it, each answer in Data 0.5.0's shape, which the real
 * @formancy/data-client checks. The lines come `PAGE` a page, each page
 * after the row the one before ended with (formancy.ai-data 0108): fewer
 * than the provider asks for, which Data does not answer while more
 * follow, so that a real `next` crosses the packed client and comes back
 * as `after` in a quotation of twelve lines. consume.ts installs it as the global
 * fetch. It lives apart because it changes when Data's wire contract does,
 * and the rest of consume.ts does not.
 */
import type { PublishedForm } from '@formancy/data-client'

type Answers = Readonly<Record<string, unknown>>

/** The lines a page holds. */
const PAGE = 6

/** A form this person may read and list and nothing else, at spec 5, as Data 0.5.0 answers `GET /v1/forms/:id` for it. */
const formOf = (id: string, keys: readonly string[]): PublishedForm => ({
  form: {
    specVersion: '5',
    id,
    title: id,
    model: {
      fields: keys.map((key) => (key === 'quotation' ? { key, type: 'select', label: key, optionsSource: 'quotations' } : { key, type: 'text', label: key })),
    },
  },
  operations: ['read'],
  readable: [...keys],
  list: { searchable: [], sortable: [...keys], filterable: [], views: [], own: [] },
  deleting: null,
  copied: null,
  versions: null,
  writable: { create: null, update: null },
  moves: null,
  opens: [],
  together: null,
  actions: [],
  bulk: { delete: false, update: null },
})

/**
 * Makes the global fetch answer for `server` as a Data 0.5.0 server holding
 * the quotation `header` under the token `record` and its `lines` as that
 * record's children, a cursor it never gave refused `409 cursor-gone`. Any
 * other route is a 404. Says how many pages of lines it answered.
 */
export function serveQuotation(server: string, record: string, header: Answers, lines: readonly Answers[]): { pages: () => number } {
  const lineKeys = ['quotation', ...Object.keys(lines[0] ?? {})]
  const rows = lines.map((line, index) => ({ record: `l-${String(index)}`, version: '1', answers: { quotation: record, ...line } }))
  let pages = 0
  const page = (after: unknown): { status: number; body: unknown } => {
    const from = after === null || after === undefined ? 0 : rows.findIndex((row) => `c1:${row.record}` === after) + 1
    if (from === 0 && after !== null && after !== undefined) return { status: 409, body: { code: 'cursor-gone', message: 'No such row to continue after.' } }
    const shown = rows.slice(from, from + PAGE)
    const last = shown.at(-1)
    const hasMore = from + PAGE < rows.length && last !== undefined
    pages += 1
    return { status: 200, body: { rows: shown, hasMore, next: hasMore ? `c1:${last.record}` : null } }
  }
  const routes: Readonly<Record<string, unknown>> = {
    'GET /v1/forms': {
      forms: [
        {
          id: 'quotation',
          title: 'Quotations',
          group: null,
          operations: ['read'],
          children: [{ form: 'quotation-line', field: 'quotation', one: false, when: null }],
        },
      ],
    },
    'GET /v1/forms/quotation': formOf('quotation', Object.keys(header)),
    'GET /v1/forms/quotation-line': formOf('quotation-line', lineKeys),
    'POST /v1/forms/quotation/records/read': { record, version: '1', answers: header },
  }
  Object.assign(globalThis, {
    fetch: (input: string, init: RequestInit): Promise<Response> => {
      const route = `${init.method ?? 'GET'} ${input.slice(server.length)}`
      const asked = typeof init.body === 'string' ? (JSON.parse(init.body) as { after?: unknown }) : {}
      const listed = route === 'POST /v1/forms/quotation-line/records/list' ? page(asked.after) : undefined
      const { status, body } =
        listed ??
        (Object.hasOwn(routes, route) ? { status: 200, body: routes[route] } : { status: 404, body: { code: 'not-found', message: 'No such route.' } })
      return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))
    },
  })
  return { pages: () => pages }
}
