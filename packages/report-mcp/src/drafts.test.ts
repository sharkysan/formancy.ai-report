import { createReportClient } from '@formancy/report-client'
import type { ReportClient } from '@formancy/report-client'
import { missingWords } from '@formancy/report-core'
import type { MissingWord, MissingWords } from '@formancy/report-core'
import { INVOICE, QUOTATION, STARTER_IMAGES } from '@formancy/report-corpus'
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

/** A word expression: it prints a string and holds a quote, so a language translates it. */
const WORDS = '"Thank" + " you"'

/** `report` held to the validator, as the case's own reports are. */
function valid(report: unknown): ReportDefinition {
  const outcome = validateReport(report)
  if (!outcome.valid) throw new Error(`the case's report is invalid: ${outcome.errors.map(({ code, path }) => `${code} ${path}`).join(', ')}`)
  return outcome.report
}

/** Keeps every image `report` declares on the case's server, as a person's builder keeps one, through a client the case does not record. */
async function keepImagesOf(report: ReportDefinition): Promise<void> {
  const builder = createReportClient({ server: server.at, token: () => server.sign() })
  for (const { digest } of report.assets) {
    const image = STARTER_IMAGES.find((each) => each.digest === digest)
    if (image === undefined) throw new Error(`no starter image is kept under ${digest}`)
    const kept = await builder.keepImage(image.bytes, image.digest, image.mediaType)
    if (!kept.ok) throw new Error(`the image ${digest} was refused: ${kept.refusal.code}`)
  }
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
    expect(created.data).toEqual({ template: 'invoice', revision: 1, digest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/) as unknown, lacking: [] })
    const replaced = await saveDraft(client, 'invoice', report('Changed'), versionOf(created))
    expect(replaced.ok).toBe(true)
    expect(dataOf<{ revision: number }>(replaced).revision).toBe(2)
    expect(saves()).toEqual([{ ifNoneMatch: '*' }, { ifMatch: draftTag(versionOf(created)) }])
    expect(dataOf<{ report: unknown }>(await readDraft(client, 'invoice')).report).toEqual(report('Changed'))
  })

  // Saves only what was checked, of what an agent can fix (0088,
  // formancy.ai 0056): a report the validator refuses, one past the size a
  // draft may have, one whose own diagnostics refuse every render, and one
  // with a language's error that is no word missing -- a translation that
  // prints another type than its source -- are answered as validate_report
  // answers them, and nothing is sent.
  test('never sends a report with what an agent can fix: the validator’s errors, the size, its own errors, a language’s other than a word missing', async () => {
    const client = clientAs()
    const broken = report('Invoice', [{ kind: 'expression', expression: { cel: 'params.nope' } }])
    const words = report('Invoice', [{ kind: 'expression', expression: { cel: WORDS } }])
    const differs = valid({ ...words, translations: [{ locale: 'fr-CH', words: [], expressions: [{ cel: WORDS, expression: { cel: '1 + 2' } }] }] })
    expect(checkReport(differs).summary).toContain('fr-CH')
    for (const [what, refused] of [
      ['no report', { reportSpecVersion: '9' }],
      ['past MAX_REPORT_BYTES', quotationOf(MAX_REPORT_BYTES + 1)],
      ['a render refused', broken],
      ['a translation that differs', differs],
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

  // A draft is unfinished by nature, and a language is translated word by
  // word: a word missing refuses that language's render and no save. Gated
  // on it, an agent that left the QR-bill's message to a person, as the
  // translate prompt tells it, could never save the invoice, or would write
  // French into the slip. Saved, and the answer names the word for the
  // person to write.
  test('saves the French invoice that lacks the slip’s message alone, and names that word for the person', async () => {
    await keepImagesOf(INVOICE.report)
    /** `report` with `locale` added and every word in `words` of it translated. */
    const writing = (report: ReportDefinition, locale: string, words: (lacking: MissingWords) => readonly MissingWord[]): ReportDefinition => {
      const added = dataOf<{ report: ReportDefinition }>(applyCommands(report, [{ command: 'addLanguage', args: [locale] }])).report
      const steps = words(missingWords(added, locale)).map(({ kind, source }) =>
        kind === 'word'
          ? { command: 'translateWord', args: [locale, source, `${locale}:${source}`] }
          : { command: 'translateExpression', args: [locale, source, { cel: source }] },
      )
      const translated = applyCommands(added, steps)
      expect(translated.ok, locale).toBe(true)
      return dataOf<{ report: ReportDefinition }>(translated).report
    }
    // French lacks the slip's message alone; Italian, whose person wrote the slip's words too, lacks nothing and is not named.
    const french = writing(INVOICE.report, 'fr-CH', ({ rest }) => rest)
    const report = writing(french, 'it-CH', ({ rest, paymentPart }) => [...rest, ...paymentPart])
    const saved = await saveDraft(clientAs(), 'invoice', report)
    expect(saved.ok).toBe(true)
    expect(saved.data).toMatchObject({
      template: 'invoice',
      revision: 1,
      lacking: [{ locale: 'fr-CH', missing: 1, forPerson: [{ kind: 'word', source: 'Rechnung ', at: '/paymentPart/message/0/text' }] }],
    })
    expect(saved.summary).toContain('"Rechnung "')
    expect(saved.summary).toContain('ask the person')
    expect(dataOf<{ report: unknown }>(await readDraft(clientAs(), 'invoice')).report).toEqual(report)
  })

  // A person saved a draft in a builder with a language not yet written;
  // the agent asked to fix one word of the title would otherwise have to
  // write that whole language first, or save nothing.
  test('takes an agent’s one-word fix of a draft a person saved with a language unfinished', async () => {
    const unfinished = dataOf<{ report: ReportDefinition }>(applyCommands(report(), [{ command: 'addLanguage', args: ['fr-CH'] }])).report
    // The person's builder saves through a client of its own, which the case does not record.
    const person = createReportClient({ server: server.at, token: () => server.sign() })
    expect((await person.saveDraft('invoice', unfinished, null)).ok).toBe(true)
    const read = dataOf<{ report: ReportDefinition; hash: string; revision: number; digest: string }>(await readDraft(clientAs(), 'invoice'))
    const fixed = dataOf<{ report: ReportDefinition }>(applyCommands(read.report, [{ command: 'setTitle', args: ['Rechnung'] }], read.hash)).report
    const saved = await saveDraft(clientAs(), 'invoice', fixed, { revision: read.revision, digest: read.digest })
    expect(saved.ok).toBe(true)
    expect(saved.data).toMatchObject({ revision: 2, lacking: [{ locale: 'fr-CH', forPerson: [] }] })
    expect(saved.summary).toContain('fr-CH')
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

  // A template is named by a report's id, report-server-core's rule. Not
  // held to it, `..` is one path segment that fetch's URL parser resolves
  // away, asking GET /v1/draft, a route no tool means, and a lone
  // surrogate throws from encodeURIComponent before anything is sent,
  // which a save would answer as not known to be written. Refused here as
  // the server refuses it, and nothing sent.
  test('refuses a template that is no report id before anything is sent, as the server would', async () => {
    for (const template of ['..', '.', `in${String.fromCharCode(0xd800)}valid`, '']) {
      for (const answer of [await readDraft(clientAs(), template), await saveDraft(clientAs(), template, report())]) {
        expect(answer.ok, JSON.stringify(template)).toBe(false)
        expect(answer.data, JSON.stringify(template)).toEqual({ sent: false, refusal: REFUSALS['template-id-invalid'] })
        expect(answer.summary, JSON.stringify(template)).toContain('Nothing was sent')
      }
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

  // A report-server names, in asset-not-kept, the assets of the report sent
  // that it does not keep: one naming an asset the report does not declare
  // is no answer to that save, and its ids are handed on in nothing (#116's
  // re-review, N12).
  test('reads an asset-not-kept that names an asset the report sent does not declare as no answer of the API', async () => {
    const naming = createReportClient({
      server: server.at,
      token: () => server.sign(),
      fetch: recordingFetch(async () => Response.json({ ...REFUSALS['asset-not-kept'], assets: ['logo', 'kept-by-nobody'] }, { status: 422 })).fetch,
    })
    const answer = await saveDraft(naming, 'quotation', QUOTATION.report)
    expect(answer.ok).toBe(false)
    expect(answer.data).toEqual({ answered: false, route: 'PUT /v1/templates/:template/draft' })
    expect(JSON.stringify(answer)).not.toContain('kept-by-nobody')
  })

  // A person's draft can hold an error of its own in the payment part or
  // the e-invoice -- an amount reading a field since removed -- which the
  // agent is told a person writes: refused, as an error of its own is, and
  // named for the person, as forPerson names a word (#116's re-review, N14).
  test('names an error of its own that stands in the payment part for the person, and sends nothing', async () => {
    const broken = valid({ ...INVOICE.report, paymentPart: { ...INVOICE.report.paymentPart, amount: { cel: 'totals.nope' } } })
    const answer = await saveDraft(clientAs(), 'invoice', broken)
    expect(answer.ok).toBe(false)
    expect(answer.summary).toContain('Nothing was sent')
    expect(answer.summary).toContain('/paymentPart/amount/cel')
    expect(answer.summary).toContain('Ask the person')
    expect(dataOf<{ forPerson: readonly { path: string; severity: string }[] }>(answer).forPerson).toEqual([
      expect.objectContaining({ path: '/paymentPart/amount/cel', severity: 'error' }),
    ])
    expect(asked).toEqual([])
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

describe('what a tool may ask', () => {
  // Each tool is given the client's one method it asks, and nothing else:
  // a tool that reached for another -- an image's keep or read -- would
  // throw here, and would not compile (0088, MCP_ROUTES).
  test('is each tool’s one method of the client, which it asks alone', async () => {
    const me = { subject: SUBJECT, tenant: 'acme', roles: [], capacities: [], actions: [] }
    expect((await whoAmI({ whoami: async () => ({ ok: true, value: me }) })).ok).toBe(true)
    expect((await listTemplates({ listTemplates: async () => ({ ok: true, value: { templates: [] } }) })).ok).toBe(true)
    const draft = { format: 1 as const, template: 'invoice', revision: 1, digest: `sha256:${'a'.repeat(64)}`, savedBy: SUBJECT, report: report() }
    expect((await readDraft({ readDraft: async () => ({ ok: true, value: draft }) }, 'invoice')).ok).toBe(true)
    const saved = { template: 'invoice', revision: 1, digest: draft.digest }
    expect((await saveDraft({ saveDraft: async () => ({ ok: true, value: saved }) }, 'invoice', report())).ok).toBe(true)
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
