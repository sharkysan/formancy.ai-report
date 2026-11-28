import { createReportClient } from '@formancy/report-client'
import type { ReportClient } from '@formancy/report-client'
import { INVOICE, QUOTATION } from '@formancy/report-corpus'
import { draftTag, REFUSALS, ROUTES } from '@formancy/report-server-core'
import { emptyReport, MAX_REPORT_BYTES, reportHash, validateReport } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { listTemplates, MCP_ROUTES, readDraft, saveDraft, whoAmI } from './drafts.js'
import { quotationOf, recordingFetch, startReportServer, SUBJECT } from './test-support.js'
import type { Asked, RunningServer } from './test-support.js'
import { applyCommands, checkReport } from './tools.js'
import type { ToolResult } from './tools.js'

/**
 * The tools that need Report's server, as plain functions of a
 * report-client (0088): against report-server itself, made in this
 * process over a file store of its own, and asked through a fetch that
 * records each route, its headers and its body before it hands the request
 * on -- so what a tool sends is what the routes read, and what it answers
 * is what they sent, never a stub's idea of either. A stub answers only
 * where no server of this release answers as a case needs: a gateway's
 * page, a body of another shape, a draft of another format.
 */

let server: RunningServer
let asked: Asked[]
/** A client of this case's server as the person whose token `claims` make, through the recording fetch. */
let clientAs: (claims?: Record<string, unknown>) => ReportClient

beforeEach(async () => {
  server = await startReportServer()
  const recording = recordingFetch()
  asked = recording.asked
  clientAs = (claims) => createReportClient({ server: server.at, token: () => server.sign(claims), fetch: recording.fetch })
})

// Whatever a case asks, it asks no route but MCP_ROUTES': a tool that
// reached another -- an image's keep, a version's publish once one exists
// -- would do what no tool says it does.
afterEach(async () => {
  expect(asked.map(({ route }) => route).filter((route) => !(MCP_ROUTES as readonly string[]).includes(route))).toEqual([])
  await server.close()
})

/** The `data` a tool answered with, as the shape the case reads. */
const dataOf = <T>(result: ToolResult): T => result.data as T

/** A report every check passes and the server keeps -- no image, no font -- whose body prints `content`. */
function report(title = 'Invoice', content: readonly unknown[] = [{ kind: 'text', text: 'Thank you.' }]): ReportDefinition {
  const blank = emptyReport('invoice', title, 'en')
  const outcome = validateReport({ ...blank, regions: { ...blank.regions, body: [{ kind: 'text', id: 'note', content }] } })
  if (!outcome.valid) throw new Error(`the case's report is invalid: ${outcome.errors.map(({ code, path }) => `${code} ${path}`).join(', ')}`)
  return outcome.report
}

/** The version a save answered, as the next save names it. */
const versionOf = (result: ToolResult): { revision: number; digest: string } => {
  const { revision, digest } = dataOf<{ revision: number; digest: string }>(result)
  return { revision, digest }
}

/** The saves the server was asked for, by the headers each named its draft with. */
const saves = (): { readonly ifMatch?: string; readonly ifNoneMatch?: string }[] =>
  asked
    .filter(({ route }) => route === 'PUT /v1/templates/:template/draft')
    .map(({ headers }) => ({
      ...(headers['if-match'] === undefined ? {} : { ifMatch: headers['if-match'] }),
      ...(headers['if-none-match'] === undefined ? {} : { ifNoneMatch: headers['if-none-match'] }),
    }))

describe('MCP_ROUTES', () => {
  // The routes the server half may ask are a list a reviewer reads, and
  // the list is what the tools ask: one tool asking a route the list does
  // not hold, or the list holding one no tool asks, and the list says
  // something the code does not do. None of them is a version's: no tool
  // publishes, today or once the route exists.
  test('are routes the server answers, none a version’s, and exactly those the four tools ask', async () => {
    expect(MCP_ROUTES.filter((route) => !Object.hasOwn(ROUTES, route))).toEqual([])
    expect(MCP_ROUTES.map((route) => ROUTES[route]).filter((operation) => operation.startsWith('version.'))).toEqual([])
    const client = clientAs()
    await whoAmI(client)
    await listTemplates(client)
    const first = await saveDraft(client, 'invoice', report())
    await readDraft(client, 'invoice')
    await saveDraft(client, 'invoice', report('Changed'), versionOf(first))
    expect([...new Set(asked.map(({ route }) => route))].sort()).toEqual([...MCP_ROUTES].sort())
  })
})

describe('whoami', () => {
  // Who the server takes the person to be, before anything is saved as
  // them: a wrong tenant or role mapping shows here, and an agent told
  // save_draft is not theirs does not try it.
  test('answers who the token’s holder is, and whether save_draft is theirs', async () => {
    const author = await whoAmI(clientAs())
    expect(author.ok).toBe(true)
    expect(author.data).toEqual({
      subject: SUBJECT,
      tenant: 'acme',
      roles: ['report-authors'],
      capacities: ['author'],
      actions: ['template.list', 'draft.read', 'draft.save', 'asset.keep', 'asset.read', 'version.read', 'version.restore'],
    })
    expect(author.summary).toContain('save_draft is theirs')
    const publisher = await whoAmI(clientAs({ roles: ['report-publishers'] }))
    expect(publisher.ok).toBe(true)
    expect(publisher.summary).toContain('not draft.save')
    // Roles the operator gave nothing are answered, as the server answers them, and said to give nothing.
    const nobody = await whoAmI(clientAs({ roles: ['readers'] }))
    expect(nobody.data).toMatchObject({ capacities: [], actions: [] })
    expect(nobody.summary).toContain('no capacity')
  })

  // An expired token is the API's refusal, said as one with what to do:
  // read as a failure of the tool, the agent would retry it for good.
  test('answers a token the server refuses unauthenticated, and says the host renews it', async () => {
    const expired = clientAs({ exp: Math.floor(Date.now() / 1000) - 60 })
    for (const answer of [await whoAmI(expired), await listTemplates(expired), await readDraft(expired, 'invoice')]) {
      expect(answer.ok).toBe(false)
      expect(answer.data).toEqual({ status: 401, refusal: REFUSALS.unauthenticated })
      expect(answer.summary).toContain('FORMANCY_REPORT_TOKEN')
    }
  })
})

describe('list_templates and read_draft', () => {
  // An agent finds a template by its id and reads its newest draft with
  // the version the next save names and the hash an edit names: without
  // either, its next save or edit is refused as stale for no reason.
  test('list a template saved, and read its draft with its version, who saved it, and the hash apply_commands takes', async () => {
    const client = clientAs()
    expect(dataOf<unknown>(await listTemplates(client))).toEqual({ templates: [] })
    const saved = versionOf(await saveDraft(client, 'invoice', report()))
    expect(dataOf<unknown>(await listTemplates(client))).toEqual({ templates: [{ template: 'invoice', revision: saved.revision, title: 'Invoice' }] })
    const read = await readDraft(client, 'invoice')
    expect(read.ok).toBe(true)
    expect(read.data).toEqual({ template: 'invoice', ...saved, savedBy: SUBJECT, hash: reportHash(report()), report: report() })
    const edited = applyCommands(
      dataOf<{ report: ReportDefinition }>(read).report,
      [{ command: 'setTitle', args: ['Rechnung'] }],
      dataOf<{ hash: string }>(read).hash,
    )
    expect(edited.ok).toBe(true)
  })

  // A template not saved yet has no draft: said as such, with the save
  // that makes one, and not as a failure to read.
  test('answer a template with no draft no-draft, and say the first save makes one', async () => {
    const read = await readDraft(clientAs(), 'invoice')
    expect(read.ok).toBe(false)
    expect(read.data).toEqual({ status: 404, refusal: REFUSALS['no-draft'] })
    expect(read.summary).toContain('save_draft with no from')
  })
})

describe('save_draft', () => {
  // A first save creates, and every later one replaces the draft it names
  // (0049): a save that named none would overwrite a colleague's work,
  // and one that named the wrong one would never save twice.
  test('sends If-None-Match: * for no version, and If-Match from the version given', async () => {
    const client = clientAs()
    const created = await saveDraft(client, 'invoice', report())
    expect(created.ok).toBe(true)
    expect(created.data).toEqual({ template: 'invoice', revision: 1, digest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/) as unknown })
    const replaced = await saveDraft(client, 'invoice', report('Changed'), versionOf(created))
    expect(replaced.ok).toBe(true)
    expect(dataOf<{ revision: number }>(replaced).revision).toBe(2)
    expect(saves()).toEqual([{ ifNoneMatch: '*' }, { ifMatch: draftTag(versionOf(created)) }])
    expect(dataOf<{ report: unknown }>(await readDraft(client, 'invoice')).report).toEqual(report('Changed'))
  })

  // Saves only what was checked (0088, formancy.ai 0056): a report the
  // validator refuses, one past the size a draft may have, one whose own
  // diagnostics refuse every render and one a declared language's refuse
  // are answered as validate_report answers them, and nothing is sent.
  test('never sends a report the format refuses, or one validate_report would refuse', async () => {
    const client = clientAs()
    const french = dataOf<{ report: ReportDefinition }>(applyCommands(report(), [{ command: 'addLanguage', args: ['fr-CH'] }])).report
    const broken = report('Invoice', [{ kind: 'expression', expression: { cel: 'params.nope' } }])
    for (const [what, refused] of [
      ['no report', { reportSpecVersion: '9' }],
      ['past MAX_REPORT_BYTES', quotationOf(MAX_REPORT_BYTES + 1)],
      ['a render refused', broken],
      ['a language’s render refused', french],
    ] as const) {
      const checked = checkReport(refused)
      expect(checked.ok, what).toBe(false)
      const answer = await saveDraft(client, 'invoice', refused)
      expect(answer.ok, what).toBe(false)
      expect(answer.data, what).toEqual(checked.data)
      expect(answer.summary, what).toContain('Nothing was sent')
    }
    expect(asked).toEqual([])
  })

  // Two people save from one draft: the second hears that someone saved
  // since, with the revision that stands, and nothing of theirs is
  // written; a first save of a template that has one is the same.
  // Answered as a write that went through, the agent would think its
  // report kept and the colleague's gone.
  test('answers draft-changed with the revision that stands, and writes nothing', async () => {
    const client = clientAs()
    const first = versionOf(await saveDraft(client, 'invoice', report()))
    const theirs = await saveDraft(client, 'invoice', report('Theirs'), first)
    expect(theirs.ok).toBe(true)
    for (const from of [first, undefined]) {
      const mine = await saveDraft(client, 'invoice', report('Mine'), from)
      expect(mine.ok).toBe(false)
      expect(mine.data).toEqual({ status: 412, refusal: { ...REFUSALS['draft-changed'], revision: 2 }, standing: 2 })
      expect(mine.summary).toContain('revision 2 stands')
      expect(mine.summary).toContain('read_draft')
    }
    expect(dataOf<{ report: unknown }>(await readDraft(client, 'invoice')).report).toEqual(report('Theirs'))
    // A save from a version of a template that has no draft: none stands, and the first save is one with no from.
    const none = await saveDraft(client, 'other', { ...report(), id: 'other' }, first)
    expect(none.data).toEqual({ status: 412, refusal: { ...REFUSALS['draft-changed'], revision: null }, standing: null })
    expect(none.summary).toContain('no draft stands')
  })

  // A version is what read_draft or a save answered: anything else would
  // reach the client, which throws it as no version, and the agent would
  // read a failure of the tool. Refused before the token is asked or
  // anything is sent.
  test('refuses a from that is no draft’s version before anything is sent', async () => {
    const client = clientAs()
    const digest = `sha256:${'a'.repeat(64)}`
    for (const from of [
      { revision: 0, digest },
      { revision: 1.5, digest },
      { revision: 1, digest: 'a'.repeat(64) },
      { revision: 1, digest: digest.toUpperCase() },
      { revision: '1', digest },
      {},
    ]) {
      const answer = await saveDraft(client, 'invoice', report(), from)
      expect(answer.ok, JSON.stringify(from)).toBe(false)
      expect(answer.summary, JSON.stringify(from)).toContain('read_draft')
    }
    expect(asked).toEqual([])
  })

  // What only the server knows of a save is its to refuse, by its code:
  // an id that is not the template's, an image it does not keep -- no tool
  // keeps one -- and a person whose roles do not save. Each said with what
  // to do, and nothing guessed.
  test('answers the server’s refusals by their codes, with what to do', async () => {
    const mismatch = await saveDraft(clientAs(), 'other', report())
    expect(mismatch.data).toEqual({ status: 422, refusal: REFUSALS['template-id-mismatch'] })
    const notKept = await saveDraft(clientAs(), 'quotation', QUOTATION.report)
    expect(notKept.data).toEqual({ status: 422, refusal: { ...REFUSALS['asset-not-kept'], assets: ['logo'] } })
    expect(notKept.summary).toContain('keeps no image')
    const forbidden = await saveDraft(clientAs({ roles: ['report-publishers'] }), 'invoice', report())
    expect(forbidden.data).toEqual({ status: 403, refusal: REFUSALS.forbidden })
    expect(forbidden.summary).toContain('whoami')
    for (const answer of [mismatch, notKept, forbidden]) expect(answer.ok).toBe(false)
  })

  // A refusal with nothing more to do than its own sentence says is
  // answered by that sentence alone, its code and its status beside it.
  test('answers a refusal with no next step by its own sentence', async () => {
    const limited = createReportClient({
      server: server.at,
      token: () => server.sign(),
      fetch: recordingFetch(async () => Response.json(REFUSALS['rate-limited'], { status: 429 })).fetch,
    })
    const answer = await saveDraft(limited, 'invoice', report())
    expect(answer).toEqual({
      ok: false,
      summary: `Refused rate-limited, 429: ${REFUSALS['rate-limited'].message}`,
      data: { status: 429, refusal: REFUSALS['rate-limited'] },
    })
  })
})

describe('an answer the client cannot read', () => {
  /** A client whose every request is answered by `answer`, through the recording fetch. */
  const answering = (answer: () => Response | Promise<Response>): ReportClient =>
    createReportClient({ server: server.at, token: () => server.sign(), fetch: recordingFetch(async () => answer()).fetch })

  // A gateway's page, a body of no JSON: report-client throws them, naming
  // the route and the status. Each tool says so and reads nothing into
  // it; thrown, the agent's call would end without an answer to act on.
  test('says an answer that is no answer of the API as such, naming the route, and reads nothing into it', async () => {
    const gateway = answering(() => new Response('<html>Bad gateway</html>', { status: 502 }))
    for (const [route, answer] of [
      ['GET /v1/whoami', await whoAmI(gateway)],
      ['GET /v1/templates', await listTemplates(gateway)],
      ['GET /v1/templates/:template/draft', await readDraft(gateway, 'invoice')],
      ['PUT /v1/templates/:template/draft', await saveDraft(gateway, 'invoice', report())],
    ] as const) {
      expect(answer.ok, route).toBe(false)
      expect(answer.summary, route).toContain(route)
      expect(answer.summary, route).toContain('502')
      expect(answer.data, route).toEqual({ answered: false, route })
    }
  })

  // A save whose answer never came may have been written or not: told it
  // failed, the agent would save again from a version that may be gone,
  // and be refused; told it saved, it would carry on from a revision that
  // may not exist. It is told the one thing that is known.
  test('says of a save with no answer that whether it was written is not known, and to read the draft', async () => {
    const lost = answering(() => Promise.reject(new TypeError('fetch failed')))
    const answer = await saveDraft(lost, 'invoice', report())
    expect(answer.ok).toBe(false)
    expect(answer.summary).toContain('did not reach Report’s server')
    expect(answer.summary).toContain('not known')
    expect(answer.summary).toContain('read_draft')
    // What is no error at all is said as such, and nothing of it quoted.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- a fetch that rejects with what is no Error is the case
    const odd = await whoAmI(answering(() => Promise.reject('a string, thrown')))
    expect(odd.summary).toContain('a throw of what is no error')
    expect(odd.summary).not.toContain('a string, thrown')
  })

  // A 2xx the client takes for its route's wire type is held to that type
  // here: a whoami of another shape, a list whose revision is no number, a
  // save that answers another template, a draft of another format or one
  // whose report this release does not read. Passed on, an agent would
  // save from a version no read answered, or edit a report no builder
  // opens.
  test('refuses a value that is not the wire type its route answers, and a draft whose report the validator refuses', async () => {
    const digest = `sha256:${'a'.repeat(64)}`
    const draft = { format: 1, template: 'invoice', revision: 3, digest, savedBy: SUBJECT, report: report() }
    const cases: readonly (readonly [string, unknown, (client: ReportClient) => Promise<ToolResult>])[] = [
      ['GET /v1/whoami', { subject: 7, tenant: 'acme', roles: [], capacities: [], actions: [] }, whoAmI],
      ['GET /v1/templates', { templates: [{ template: 'invoice', revision: '3', title: 'Invoice' }] }, listTemplates],
      ['GET /v1/templates/:template/draft', { ...draft, format: 2 }, (client) => readDraft(client, 'invoice')],
      ['GET /v1/templates/:template/draft', { ...draft, template: 'other' }, (client) => readDraft(client, 'invoice')],
      ['PUT /v1/templates/:template/draft', { template: 'other', revision: 3, digest }, (client) => saveDraft(client, 'invoice', report())],
      ['PUT /v1/templates/:template/draft', { template: 'invoice', revision: 0, digest }, (client) => saveDraft(client, 'invoice', report())],
    ]
    for (const [route, value, tool] of cases) {
      const answer = await tool(answering(() => Response.json(value)))
      expect(answer.ok, JSON.stringify(value)).toBe(false)
      expect(answer.summary, JSON.stringify(value)).toContain(route)
      expect(answer.data, JSON.stringify(value)).toEqual({ answered: false, route })
    }
    const unread = await readDraft(
      answering(() => Response.json({ ...draft, report: { ...INVOICE.report, reportSpecVersion: '9' } })),
      'invoice',
    )
    expect(unread.ok).toBe(false)
    expect(dataOf<{ valid: boolean; errors: readonly { code: string }[] }>(unread)).toMatchObject({ valid: false, errors: [{ code: 'unsupported-version' }] })
    expect(unread.summary).toContain('revision 3')
  })
})
