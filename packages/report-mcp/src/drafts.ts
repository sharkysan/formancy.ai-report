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
import { DRAFT_FORMAT, isRevision, REFUSALS } from '@formancy/report-server-core'
import type { Action, Draft, DraftSaved, DraftVersion, RefusalCode, Route, ServerRefusal, TemplateSummary, WhoAmI } from '@formancy/report-server-core'
import { isDigest, isIdentifier, reportHash, validateReport } from '@formancy/report-spec'
import { TOKEN_SETTING, TokenUnavailable } from './settings.js'
import { invalid, judgedForSave, plural } from './tools.js'
import type { Lacking, ToolResult } from './tools.js'

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

/**
 * What the client answered, or why nothing the API answers came back --
 * what it threw, in its own sentence -- and whether anything was sent:
 * nothing, where the token could not be had, or not known, where a
 * request went out and no answer of the API came back.
 */
type Asked<T> = Answered<T> | { readonly ok: 'unanswered'; readonly why: string; readonly sent: 'nothing' | 'unknown' }

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

/**
 * `call`'s answer, or what it threw, said: report-client's own sentences
 * quote no token and no id, and fetch is handed no token it would quote. A
 * token the bin's settings could not give is thrown before anything is
 * sent, `TokenUnavailable`; anything else may have been sent.
 */
async function asking<T>(call: () => Promise<Answered<T>>): Promise<Asked<T>> {
  try {
    return await call()
  } catch (error) {
    return { ok: 'unanswered', why: whyOf(error), sent: error instanceof TokenUnavailable ? 'nothing' : 'unknown' }
  }
}

/** Where a save's answer is not known: whether it was written is not, and read_draft says. */
const UNKNOWN_SAVE = 'Whether the draft was written is not known: call read_draft to see which revision stands before saving again.'

/**
 * Nothing the API answers came back to `route`: where nothing was sent,
 * said so; else why, `then` -- for a save, that whether it was written is
 * not known -- and nothing read into it.
 */
function unanswered(
  route: McpRoute,
  { why, sent }: { readonly why: string; readonly sent: 'nothing' | 'unknown' },
  then = 'Nothing was read into it.',
): ToolResult {
  if (sent === 'nothing') return { ok: false, summary: `Nothing was sent to Report’s server for ${route}: ${why}.`, data: { sent: false, route } }
  return { ok: false, summary: `No answer of report-server’s API came back to ${route}: ${why}. ${then}`, data: { answered: false, route } }
}

/**
 * A template the format allows no report to be named by, refused before
 * anything is sent, as the server refuses one (report-server-core's
 * `template-id-invalid`): `..` and `.` are segments fetch resolves away,
 * asking another route, and a lone surrogate no path carries.
 */
function notATemplate(): ToolResult {
  const refusal = REFUSALS['template-id-invalid']
  return {
    ok: false,
    summary: `Nothing was sent: refused ${refusal.code}, as the server refuses it. ${refusal.message} A template is named by its report’s id, as list_templates names it.`,
    data: { sent: false, refusal },
  }
}

/** `route` answered what is not what report-server-core says it answers -- `what` -- said, and nothing of it handed on. */
function unreadable(route: McpRoute, what: string, then = 'Nothing of it was read.'): ToolResult {
  return { ok: false, summary: `Report’s server answered ${route} with what is not ${what}. ${then}`, data: { answered: false, route } }
}

/** A route's wire type, as `unreadable` says what an answer is not. */
const wire = (type: string): string => `the ${type} report-server-core says that route answers`

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
export async function whoAmI(client: Pick<ReportClient, 'whoami'>): Promise<ToolResult> {
  const route = 'GET /v1/whoami' satisfies McpRoute
  const answered = await asking(() => client.whoami())
  if (answered.ok === 'unanswered') return unanswered(route, answered)
  if (!answered.ok) return refusedBy(answered)
  const me: unknown = answered.value
  if (!isWhoAmI(me)) return unreadable(route, wire('WhoAmI'))
  const { subject, tenant, roles, capacities, actions } = me
  const saves = actions.includes(SAVE) ? `${SAVE} among their actions: save_draft is theirs, and saves as them` : `not ${SAVE}: save_draft is refused them`
  return {
    ok: true,
    summary: `Report’s server takes the token’s holder to be ${subject}, of tenant ${tenant}. Their roles give ${capacities.length === 0 ? 'no capacity' : capacities.join(' and ')}, and ${saves}.`,
    data: { subject, tenant, roles, capacities, actions },
  }
}

/** The tenant's templates on Report's server, each by its id, with its newest draft's revision and title. */
export async function listTemplates(client: Pick<ReportClient, 'listTemplates'>): Promise<ToolResult> {
  const route = 'GET /v1/templates' satisfies McpRoute
  const answered = await asking(() => client.listTemplates())
  if (answered.ok === 'unanswered') return unanswered(route, answered)
  if (!answered.ok) return refusedBy(answered)
  // report-client answers a 2xx only as the JSON object it holds, and throws any other body.
  const templates: unknown = (answered.value as unknown as Readonly<Record<string, unknown>>)['templates']
  if (!Array.isArray(templates) || !templates.every(isSummary)) return unreadable(route, wire('TemplateList'))
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
export async function readDraft(client: Pick<ReportClient, 'readDraft'>, template: string): Promise<ToolResult> {
  const route = 'GET /v1/templates/:template/draft' satisfies McpRoute
  if (!isIdentifier(template)) return notATemplate()
  const answered = await asking(() => client.readDraft(template))
  if (answered.ok === 'unanswered') return unanswered(route, answered)
  if (!answered.ok) return refusedBy(answered)
  const draft: unknown = answered.value
  if (!isDraftOf(draft, template)) return unreadable(route, wire('Draft'))
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
 * Each language a saved report still lacks words in, in a sentence: how
 * many, that a render in it is refused until it has them, and those that
 * stand in the payment part, which a person writes, so the agent asks the
 * person rather than writing them (0039, 0085, 0088).
 */
function lackingSaid(lacking: readonly Lacking[]): string {
  return lacking
    .map(({ locale, missing, forPerson }) => {
      const still = `${locale} still lacks ${plural(missing, 'word')}, and a render in ${locale} is refused until it has them`
      if (forPerson.length === 0) return ` ${still}: translate them with apply_commands, or leave them for later.`
      const words = forPerson.map(({ source }) => JSON.stringify(source)).join(', ')
      return ` ${still}; of them, the payment part's ${words}, which a person writes: ask the person for them, and apply only what they give.`
    })
    .join('')
}

/**
 * A report saved as a template's next draft, as the person whose token
 * the client sends: judged first by `judgedForSave`, and sent unless it
 * holds what an agent can fix -- the validator's errors, the size bound,
 * an error of its own, a declared language's other than a word missing
 * (formancy.ai 0056) -- a draft whose languages lack words being saved,
 * and each named with the words a person writes; from `from`, the version
 * of the draft it replaces, with `If-Match`, or, with none, as the
 * template's first, with `If-None-Match: *` (0049). A save from a draft no
 * longer the newest is refused `draft-changed`, answered with the revision
 * that stands. A save is never a publish.
 */
export async function saveDraft(client: Pick<ReportClient, 'saveDraft'>, template: string, report: unknown, from?: unknown): Promise<ToolResult> {
  const route = 'PUT /v1/templates/:template/draft' satisfies McpRoute
  if (!isIdentifier(template)) return notATemplate()
  if (from !== undefined && !isVersion(from)) {
    return {
      ok: false,
      summary:
        'Nothing was sent: from is the version of the draft this report replaces, { revision, digest } as read_draft or the last save_draft answered it -- a whole number from 1, and sha256: with 64 lower-case hexadecimal digits -- or left out for a template not yet saved.',
      data: { sent: false },
    }
  }
  const judged = judgedForSave(report)
  if ('refused' in judged) {
    const { refused, forPerson } = judged
    // An error of its own where a person writes -- the payment part, the e-invoice -- is the person's to fix, as forPerson names a word (#116's re-review, N14).
    const person =
      forPerson.length === 0
        ? ''
        : ` Of its own errors, those in the payment part or the e-invoice are a person's to fix, since a person writes those parts: ${forPerson.map(({ code, path }) => `${code} at ${path}`).join(', ')}. Ask the person.`
    return {
      ok: false,
      summary: `Nothing was sent: save_draft sends a report once nothing an agent can fix is left -- the validator's errors, MAX_REPORT_BYTES, an error of its own, a language's other than a word it lacks. ${refused.summary}${person}`,
      data: forPerson.length === 0 ? refused.data : { ...(refused.data as Readonly<Record<string, unknown>>), forPerson },
    }
  }
  const { report: checked, lacking } = judged
  const answered = await asking(() => client.saveDraft(template, checked, from === undefined ? null : { revision: from.revision, digest: from.digest }))
  if (answered.ok === 'unanswered') return unanswered(route, answered, UNKNOWN_SAVE)
  if (!answered.ok) {
    const { refusal } = answered
    if (refusal.code === 'draft-changed') return changed(answered.status, refusal)
    // The server names the assets of the report sent that it does not keep: one naming another is no answer to this save (#116's re-review, N12).
    if (refusal.code === 'asset-not-kept' && !refusal.assets.every((id) => checked.assets.some((asset) => asset.id === id)))
      return unreadable(route, 'an asset-not-kept of the report sent, since it names assets that report does not declare', UNKNOWN_SAVE)
    return refusedBy(answered)
  }
  const saved: unknown = answered.value
  if (!isSavedAs(saved, template)) return unreadable(route, wire('DraftSaved'), UNKNOWN_SAVE)
  const { revision, digest } = saved
  return {
    ok: true,
    summary: `Saved as revision ${String(revision)} of ${template}, as the person whose token this server was given. Save the next change from { revision, digest } as answered here.${lackingSaid(lacking)}`,
    data: { template, revision, digest, lacking },
  }
}
