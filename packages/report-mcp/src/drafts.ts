/**
 * The tools that need Report's server, as plain functions of a
 * report-client (0088): who the server takes the token's holder to be, the
 * tenant's templates, a template's draft, and a save from the version it
 * names -- each asked through the client a host's page asks with, as the
 * person whose token it sends, so that what an agent saves is saved as
 * them, `savedBy` the token's subject (0049).
 *
 * Apart from tools.ts, whose tools reach nothing but their arguments, so
 * that the composition guard holds them to that. Every verdict here is
 * another package's: tools.ts's judgement of a report -- report-spec's
 * validator and report-core's diagnostics -- before a save sends anything,
 * and report-server's answer after. A 2xx is held to the wire type
 * report-server-core gives its route before anything of it is handed on,
 * and what report-client throws -- an answer that is no answer of the API,
 * a network that failed, a token that could not be read -- is said as
 * such, by the client's own sentence, which names a route by its pattern
 * and quotes no token: never guessed at (formancy.ai 0022). No tool here
 * publishes, and the routes they ask are `MCP_ROUTES`.
 */
import type { Answered, ReportClient } from '@formancy/report-client'
import { DRAFT_FORMAT, isRevision } from '@formancy/report-server-core'
import type { Action, Draft, DraftSaved, DraftVersion, RefusalCode, Route, ServerRefusal, TemplateSummary, WhoAmI } from '@formancy/report-server-core'
import { isDigest, reportHash, validateReport } from '@formancy/report-spec'
import { TOKEN_SETTING } from './settings.js'
import { invalid, judged, plural } from './tools.js'
import type { ToolResult } from './tools.js'

/**
 * Every route the tools here ask, by `ROUTES`' own keys, so that a route
 * renamed there does not compile here: whoami, the list, a draft's read and
 * its save. No image is kept and no version published: `drafts.test.ts`
 * holds the list to what a recording fetch sees the tools ask, and to no
 * route of a version.
 */
export const MCP_ROUTES = Object.freeze([
  'GET /v1/whoami',
  'GET /v1/templates',
  'GET /v1/templates/:template/draft',
  'PUT /v1/templates/:template/draft',
] as const) satisfies readonly Route[]

type McpRoute = (typeof MCP_ROUTES)[number]

/** What the client answered, or why nothing the API answers came back: what it threw, in its own sentence. */
type Asked<T> = Answered<T> | { readonly ok: 'unanswered'; readonly why: string }

/** A code Node gives a failure of the network, as `ECONNREFUSED`: what alone is said of one. */
const NETWORK_CODE = /^[A-Z][A-Z0-9_]*$/

/**
 * What a thrown error says, in words that quote nothing a request held:
 * report-client's own sentence, which names a route by its pattern and a
 * status, or the token reader's, each a fixed sentence -- and, for a
 * failure of the network, which fetch throws as a `TypeError` whose message
 * and cause are not this package's to vouch for, a sentence of this
 * package's with Node's code alone.
 */
function whyOf(error: unknown): string {
  if (error instanceof TypeError) {
    const cause: unknown = error.cause
    const code = typeof cause === 'object' && cause !== null ? (cause as { readonly code?: unknown }).code : undefined
    return `the request did not reach Report’s server, or its answer did not come back${typeof code === 'string' && NETWORK_CODE.test(code) ? ` (${code})` : ''}`
  }
  if (error instanceof Error) return error.message.replace(/\.$/, '')
  return 'the request ended in a throw of what is no error'
}

/** `call`'s answer, or what it threw, said: report-client's own sentences quote no token and no id, and fetch is handed no token it would quote. */
async function asking<T>(call: () => Promise<Answered<T>>): Promise<Asked<T>> {
  try {
    return await call()
  } catch (error) {
    return { ok: 'unanswered', why: whyOf(error) }
  }
}

/** Where a save's answer is not known: whether it was written is not, and read_draft says. */
const UNKNOWN_SAVE = 'Whether the draft was written is not known: call read_draft to see which revision stands before saving again.'

/** Nothing the API answers came back to `route`: why, and nothing read into it. */
function unanswered(route: McpRoute, why: string, then = 'Nothing was read into it.'): ToolResult {
  return { ok: false, summary: `No answer of report-server’s API came back to ${route}: ${why}. ${then}`, data: { answered: false, route } }
}

/** `route` answered a 2xx that is not the wire type report-server-core says it answers: said, and nothing of it handed on. */
function unreadable(route: McpRoute, type: string, then = 'Nothing of it was read.'): ToolResult {
  return {
    ok: false,
    summary: `Report’s server answered ${route} with what is not the ${type} report-server-core says that route answers. ${then}`,
    data: { answered: false, route },
  }
}

/** What to do about a refusal, beside its own sentence, for those an agent can do something about. */
const NEXT: Partial<Readonly<Record<RefusalCode, string>>> = {
  unauthenticated: `The token this server was given, which ${TOKEN_SETTING} names, was refused: it may have expired. The person’s host issues the next one -- into the file the setting names, which is read again before each request, or into the variable, read when the bin starts -- and nothing here makes one.`,
  forbidden: 'The roles the token carries do not allow this action: whoami says which actions they give.',
  'no-draft': 'This template has no draft yet: save_draft with no from saves its first.',
  'asset-not-kept':
    'save_draft keeps no image and maps no font: a person adds the image in a builder, which keeps it on the server, or the report declares it no longer. The assets listed are those.',
  'template-id-mismatch': 'A template is named by its report’s id: save the report as the template its id names.',
}

/** A refusal the API gave, answered with its status, its code and its sentence, and what to do where there is something. */
function refusedBy({ status, refusal }: { readonly status: number; readonly refusal: ServerRefusal }): ToolResult {
  const next = NEXT[refusal.code]
  return {
    ok: false,
    summary: `Refused ${refusal.code}, ${String(status)}: ${refusal.message}${next === undefined ? '' : ` ${next}`}`,
    data: { status, refusal },
  }
}

const isText = (value: unknown): value is string => typeof value === 'string'
const isTexts = (value: unknown): value is readonly string[] => Array.isArray(value) && value.every(isText)
const isObject = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Whether `value` names a draft's version as a read or a save answers one: a revision report-server-core takes, and a digest report-spec does. */
const isVersion = (value: unknown): value is DraftVersion => isObject(value) && isRevision(value['revision']) && isDigest(value['digest'])

/**
 * Whether `value` is each route's wire type, as far as a tool reads it: the
 * strings and versions it hands on. An action or a capacity of a later
 * release is a string all the same, and handed on as one.
 */
const isWhoAmI = (value: unknown): value is WhoAmI =>
  isObject(value) && isText(value['subject']) && isText(value['tenant']) && isTexts(value['roles']) && isTexts(value['capacities']) && isTexts(value['actions'])
const isSummary = (value: unknown): value is TemplateSummary =>
  isObject(value) && isText(value['template']) && isRevision(value['revision']) && isText(value['title'])
/** A draft of `template`, in the format this release reads, its report left to report-spec's validator. */
const isDraftOf = (value: unknown, template: string): value is Draft =>
  isVersion(value) && isObject(value) && value['format'] === DRAFT_FORMAT && value['template'] === template && isText(value['savedBy'])
const isSavedAs = (value: unknown, template: string): value is DraftSaved => isVersion(value) && isObject(value) && value['template'] === template

/** The action a save needs, by the actions table's own name. */
const SAVE: Action = 'draft.save'

/**
 * Who Report's server takes the token's holder to be (0046): their subject
 * and tenant, their roles, and the capacities and actions the operator's
 * role policy gives them, and whether `draft.save`, which save_draft needs,
 * is among them.
 */
export async function whoAmI(client: ReportClient): Promise<ToolResult> {
  const route = 'GET /v1/whoami' satisfies McpRoute
  const answered = await asking(() => client.whoami())
  if (answered.ok === 'unanswered') return unanswered(route, answered.why)
  if (!answered.ok) return refusedBy(answered)
  const me: unknown = answered.value
  if (!isWhoAmI(me)) return unreadable(route, 'WhoAmI')
  const { subject, tenant, roles, capacities, actions } = me
  const saves = actions.includes(SAVE) ? `${SAVE} among their actions: save_draft is theirs, and saves as them` : `not ${SAVE}: save_draft is refused them`
  return {
    ok: true,
    summary: `Report’s server takes the token’s holder to be ${subject}, of tenant ${tenant}. Their roles give ${capacities.length === 0 ? 'no capacity' : capacities.join(' and ')}, and ${saves}.`,
    data: { subject, tenant, roles, capacities, actions },
  }
}

/** The tenant's templates on Report's server, each by its id, with its newest draft's revision and title. */
export async function listTemplates(client: ReportClient): Promise<ToolResult> {
  const route = 'GET /v1/templates' satisfies McpRoute
  const answered = await asking(() => client.listTemplates())
  if (answered.ok === 'unanswered') return unanswered(route, answered.why)
  if (!answered.ok) return refusedBy(answered)
  // report-client answers a 2xx only as the JSON object it holds, and throws any other body.
  const templates: unknown = (answered.value as unknown as Readonly<Record<string, unknown>>)['templates']
  if (!Array.isArray(templates) || !templates.every(isSummary)) return unreadable(route, 'TemplateList')
  const listed = templates.map(({ template, revision, title }) => ({ template, revision, title }))
  return {
    ok: true,
    summary: `${plural(listed.length, 'template')} of the tenant, each by its id with its newest draft’s revision and title; read_draft reads one.`,
    data: { templates: listed },
  }
}

/**
 * A template's newest draft: its version, which save_draft names as
 * `from`, who saved it, the report, and the report's hash, which
 * apply_commands names as `expectedHash`. A draft of another format, of
 * another template, or whose report this release's validator refuses is
 * said as such: an agent that edited it would save what no builder opens.
 */
export async function readDraft(client: ReportClient, template: string): Promise<ToolResult> {
  const route = 'GET /v1/templates/:template/draft' satisfies McpRoute
  const answered = await asking(() => client.readDraft(template))
  if (answered.ok === 'unanswered') return unanswered(route, answered.why)
  if (!answered.ok) return refusedBy(answered)
  const draft: unknown = answered.value
  if (!isDraftOf(draft, template)) return unreadable(route, 'Draft')
  const { revision, digest, savedBy } = draft
  // Served as it was saved, and never validated again by the server (0049): a report a later format refuses is this release's to say so of.
  const validation = validateReport(draft.report)
  if (!validation.valid) return invalid(validation.errors, `The draft of ${template} the server answered, revision ${String(revision)},`)
  return {
    ok: true,
    summary: `The draft of ${template}, revision ${String(revision)}. Edit it with apply_commands and the hash answered here, and save it with save_draft from { revision, digest } as answered here.`,
    data: { template, revision, digest, savedBy, hash: reportHash(validation.report), report: validation.report },
  }
}

/** A save refused because the draft it named is no longer the newest: the revision that stands, and nothing written. */
function changed(status: number, refusal: ServerRefusal & { readonly code: 'draft-changed' }): ToolResult {
  const standing = refusal.revision
  const stands =
    standing === null
      ? 'no draft stands, so there is none to replace: save_draft with no from saves its first'
      : `revision ${String(standing)} stands, not the draft this save named: call read_draft, make the change again on the draft it answers -- with apply_commands and the hash it answers -- and save from the version it answers`
  return { ok: false, summary: `Refused draft-changed, ${String(status)}: ${stands}. Nothing was written.`, data: { status, refusal, standing } }
}

/**
 * A report saved as a template's next draft, as the person whose token
 * the client sends: judged first as validate_report judges it, and sent
 * only where that is `ok` -- never a report the validator, the size bound,
 * its own diagnostics or a declared language's refuse (formancy.ai 0056)
 * -- from `from`, the version of the draft it replaces, with `If-Match`,
 * or, with none, as the template's first, with `If-None-Match: *` (0049).
 * A save from a draft no longer the newest is refused `draft-changed`,
 * answered with the revision that stands. A save is never a publish.
 */
export async function saveDraft(client: ReportClient, template: string, report: unknown, from?: unknown): Promise<ToolResult> {
  const route = 'PUT /v1/templates/:template/draft' satisfies McpRoute
  if (from !== undefined && !isVersion(from)) {
    return {
      ok: false,
      summary:
        'Nothing was sent: from is the version of the draft this report replaces, { revision, digest } as read_draft or the last save_draft answered it -- a whole number from 1, and sha256: with 64 lower-case hexadecimal digits -- or left out for a template not yet saved.',
      data: { sent: false },
    }
  }
  const { result, report: checked } = judged(report)
  if (!result.ok || checked === undefined)
    return { ok: false, summary: `Nothing was sent: save_draft sends only a report validate_report answers ok. ${result.summary}`, data: result.data }
  const answered = await asking(() => client.saveDraft(template, checked, from === undefined ? null : { revision: from.revision, digest: from.digest }))
  if (answered.ok === 'unanswered') return unanswered(route, answered.why, UNKNOWN_SAVE)
  if (!answered.ok) return answered.refusal.code === 'draft-changed' ? changed(answered.status, answered.refusal) : refusedBy(answered)
  const saved: unknown = answered.value
  if (!isSavedAs(saved, template)) return unreadable(route, 'DraftSaved', UNKNOWN_SAVE)
  const { revision, digest } = saved
  return {
    ok: true,
    summary: `Saved as revision ${String(revision)} of ${template}, as the person whose token this server was given. Save the next change from { revision, digest } as answered here.`,
    data: { template, revision, digest },
  }
}
