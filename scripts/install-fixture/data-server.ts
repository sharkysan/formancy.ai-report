/*
 * A data server answering Formancy Data 0.5.0's runtime routes, which the
 * install gate's Data provider reads the quotation from (0016): the two
 * published forms, the menu that makes the lines the quotation's
 * children, the quotation's one record and its lines on one page, every
 * value as Data spells it, each answer in Data 0.5.0's shape, which the
 * real @formancy/data-client checks. consume.ts installs it as the global
 * fetch. It lives apart because it changes when Data's wire contract does,
 * and the rest of consume.ts does not.
 */
import type { PublishedForm } from '@formancy/data-client'

type Answers = Readonly<Record<string, unknown>>

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
 * record's children: one page, none after it. Any other route is a 404.
 */
export function serveQuotation(server: string, record: string, header: Answers, lines: readonly Answers[]): void {
  const lineKeys = ['quotation', ...Object.keys(lines[0] ?? {})]
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
    'POST /v1/forms/quotation-line/records/list': {
      rows: lines.map((line, index) => ({ record: `l-${String(index)}`, version: '1', answers: { quotation: record, ...line } })),
      hasMore: false,
      next: null,
    },
  }
  Object.assign(globalThis, {
    fetch: (input: string, init: RequestInit): Promise<Response> => {
      const route = `${init.method ?? 'GET'} ${input.slice(server.length)}`
      const body = Object.hasOwn(routes, route) ? routes[route] : { code: 'not-found', message: 'No such route.' }
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: Object.hasOwn(routes, route) ? 200 : 404, headers: { 'content-type': 'application/json' } }),
      )
    },
  })
}
