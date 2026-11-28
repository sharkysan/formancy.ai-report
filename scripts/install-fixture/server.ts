/*
 * The server's host (0046): a consumer that knows nothing about the
 * workspace, with Node's types, the packed report-server and what it
 * declares, and nothing else -- no runtime, no renderer, no builder.
 *
 * Copied into a temporary npm project by install-test.mjs, installed from
 * the packed tarballs, type-checked with skipLibCheck OFF and run under
 * Node. What is on trial: the published entry points resolve, with the
 * types that shipped, @formancy/data-identity 0.5.0 among what npm brings;
 * and the server, made in this process over a file store on a directory of
 * its own and listening on a socket, answers
 * /health, refuses a request without a token, with a tenantless token, a
 * forgery or a malformed token with the one 401, and answers whoami for a
 * token this host signed, with its tenant and the actions its roles give.
 * Through the packed report-client, installed beside it with what it
 * declares (0049), a draft is saved, read back at the version it was saved
 * at, and a save from the draft read refused draft-changed once another has
 * saved since, with the revision that stands.
 * And the server's model (0084): the server made with a completer of this
 * check's own, which answers what it was asked under the briefing it was
 * asked under, says which model it asks and report-ai's briefing digest,
 * and is asked through report-ai's askThrough over the packed client's
 * completeModel, as a builder's host asks it; the trail records each
 * request, the request to complete with its kind, its length and how it
 * ended, and nothing of what was asked or answered.
 * The tokens are signed with node:crypto alone, as a host on any stack can
 * sign one, and their secrets are this check's own.
 */
import { createHmac } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { askThrough } from '@formancy/report-ai'
import { briefingDigest, modelBriefing } from '@formancy/report-ai'
import type { ModelPrompt } from '@formancy/report-ai'
import { createReportClient } from '@formancy/report-client'
import { ACTIONS, REFUSALS } from '@formancy/report-server-core'
import type { AuditEvent, Completer, Health, Refusal, WhoAmI } from '@formancy/report-server-core'
import { createReportServer, createReportVerifier, openFileTemplateStore } from '@formancy/report-server'
import type { ReportServerOptions } from '@formancy/report-server'
import { emptyReport } from '@formancy/report-spec'

const hostSecret = 'the-install-checks-own-secret-of-at-least-32-bytes'

const base64url = (text: string) => Buffer.from(text).toString('base64url')
/** An HS256 token as a host signs one: the header, the claims and the signature, base64url; under `secret`, the host's unless a forger's is given. */
function sign(claims: Record<string, unknown>, secret = hostSecret): string {
  const body = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify(claims))}`
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}
const now = Math.floor(Date.now() / 1000)
const claims = { iss: 'https://login.example', aud: 'formancy-report', sub: 'u-1', tid: 'acme', roles: ['report-authors'], iat: now, exp: now + 300 }
const token = sign(claims)
const tenantless = sign({ ...claims, tid: undefined })
const forged = sign(claims, 'a-forgers-secret-that-is-not-the-hosts-of-32-bytes')

const events: AuditEvent[] = []
const audit: ReportServerOptions['audit'] = { sink: (event) => void events.push(event) }

/** The embedder's completer, scripted: it answers the user part it was asked, and records the system part it was asked under. */
const briefed: string[] = []
const completer: Completer = {
  complete: async (prompt) => {
    briefed.push(prompt.system)
    return { ok: true, text: prompt.user }
  },
}

// The store's directory is the host's to make, and the store never makes it (0049): this check's own, removed at the end.
const storeDirectory = await mkdtemp(join(tmpdir(), 'formancy-report-install-'))

const verifyIdentity = await createReportVerifier({
  key: { kind: 'secret', secret: hostSecret },
  issuer: 'https://login.example',
  audience: 'formancy-report',
  tenantClaim: 'tid',
})
const opened = await openFileTemplateStore(storeDirectory)
if (!opened.ok) throw new Error(opened.problem)
const server = await createReportServer({
  verifyIdentity,
  roles: { author: ['report-authors'], publisher: ['report-publishers'], admin: ['report-admins'] },
  audit,
  store: opened.store,
  model: { provider: 'my-provider', model: 'my-model', completer },
})
await server.listen({ host: '127.0.0.1', port: 0 })

try {
  const { port } = server.server.address() as AddressInfo
  const at = `http://127.0.0.1:${String(port)}`

  const health = await fetch(`${at}/health`)
  const healthy = (await health.json()) as Health
  if (health.status !== 200 || healthy.status !== 'ok') throw new Error(`/health answered ${String(health.status)}`)

  for (const authorization of [undefined, `Bearer ${tenantless}`, `Bearer ${forged}`, 'Bearer not.a.token']) {
    const refused = await fetch(`${at}/v1/whoami`, authorization === undefined ? {} : { headers: { authorization } })
    const body = (await refused.json()) as Refusal
    if (refused.status !== 401 || body.code !== REFUSALS.unauthenticated.code || refused.headers.get('www-authenticate') !== 'Bearer') {
      throw new Error(
        `whoami ${authorization === undefined ? 'without a token' : 'with a bad token'} answered ${String(refused.status)} ${body.code}, not the one 401`,
      )
    }
  }

  const answered = await fetch(`${at}/v1/whoami`, { headers: { authorization: `Bearer ${token}` } })
  const me = (await answered.json()) as WhoAmI
  const authors = Object.entries(ACTIONS)
    .filter(([, capacities]) => (capacities as readonly string[]).includes('author'))
    .map(([action]) => action)
  if (answered.status !== 200 || me.tenant !== 'acme' || me.subject !== 'u-1' || JSON.stringify(me.actions) !== JSON.stringify(authors)) {
    throw new Error(`whoami for the host's token answered ${String(answered.status)} ${JSON.stringify(me)}`)
  }

  const unknown = await fetch(`${at}/v1/versions`, { headers: { authorization: `Bearer ${token}` } })
  if (unknown.status !== 404) throw new Error(`/v1/versions answered ${String(unknown.status)}, where no route of this release answers`)
  if (events.length !== 5) throw new Error(`the trail holds ${String(events.length)} events for five requests whoami answered`)

  // A host's page, as the packed client asks for it: a draft saved and read
  // back at the version the save answered, then saved from the draft it read
  // once another author has saved from it since, which writes nothing and
  // names the revision that stands.
  const reports = createReportClient({ server: at, token: () => token })
  const saved = await reports.saveDraft('invoice', emptyReport('invoice', 'Invoice', 'en'), null)
  if (!saved.ok) throw new Error(`the first save was refused: ${saved.refusal.code}`)
  const opened = await reports.readDraft('invoice')
  if (!opened.ok) throw new Error(`the draft could not be read: ${opened.refusal.code}`)
  if (
    opened.value.revision !== saved.value.revision ||
    opened.value.digest !== saved.value.digest ||
    opened.value.savedBy !== claims.sub ||
    JSON.stringify(opened.value.report) !== JSON.stringify(emptyReport('invoice', 'Invoice', 'en'))
  ) {
    throw new Error(`the draft saved at revision ${String(saved.value.revision)} was read back otherwise, at revision ${String(opened.value.revision)}`)
  }
  const theirs = await reports.saveDraft('invoice', emptyReport('invoice', 'Theirs', 'en'), opened.value)
  const mine = await reports.saveDraft('invoice', emptyReport('invoice', 'Mine', 'en'), opened.value)
  if (!theirs.ok || mine.ok || mine.refusal.code !== 'draft-changed' || mine.refusal.revision !== theirs.value.revision) {
    throw new Error(
      `a save from revision ${String(opened.value.revision)} after another's was answered ${mine.ok ? 'as saved' : `${String(mine.status)} ${mine.refusal.code}`}, not draft-changed`,
    )
  }
  // One event for each of the client's requests, by its route and how it was answered, after whoami's five.
  const trail = events.slice(5).map((event) => `${event.operation} ${event.outcome}`)
  if (JSON.stringify(trail) !== JSON.stringify(['draft.save ok', 'draft.read ok', 'draft.save ok', 'draft.save draft-changed']))
    throw new Error(`the trail holds ${JSON.stringify(trail)} for the client's four requests`)

  // A builder's host asks the server's model as its page would (0084):
  // whether there is one, then report-ai's AskModel over the client, a
  // prompt as report-ai's run builds one, and the trail's two events, the
  // second saying what was asked by its kind and its length alone.
  const offered = await reports.model()
  if (!offered.ok || offered.value.provider === null) throw new Error('this server asks no model')
  const ask = askThrough(reports.completeModel) // the AskModel a builder's host gives its editor
  if (offered.value.briefings['translation'] !== briefingDigest('translation'))
    throw new Error(`the server names the translation's briefing ${String(offered.value.briefings['translation'])}, not report-ai's`)
  const user = '{"into":"fr-CH","words":[{"key":"w1","source":"Offerte"}]}'
  const prompt: ModelPrompt<'translation'> = { kind: 'translation', system: modelBriefing('translation'), user, attempt: 1, limit: 1 }
  const modelSaid = await ask(prompt, { onCancel: () => undefined })
  if (modelSaid !== user || JSON.stringify(briefed) !== JSON.stringify([modelBriefing('translation')]))
    throw new Error(`the server's model answered ${modelSaid}, asked under ${String(briefed.length)} briefings`)
  const asked = events.slice(9)
  const said = asked.map((event) => `${event.operation} ${event.outcome} ${JSON.stringify(event.model ?? null)}`)
  if (
    JSON.stringify(said) !==
    JSON.stringify(['model.read ok null', `model.ask ok {"kind":"translation","characters":${String(user.length)},"outcome":"answered"}`])
  )
    throw new Error(`the trail holds ${JSON.stringify(said)} for the model's two requests`)
  if (JSON.stringify(asked).includes('Offerte')) throw new Error('the trail holds a word of what the model was asked')

  console.log(
    `ok: report-server listened on a socket of its own; /health answered, whoami refused no token, a tenantless one, a forgery and a malformed one with the one 401, and answered the host's token as tenant ${me.tenant} with ${String(me.actions.length)} actions; nothing else answered; through report-client a draft was saved at revision ${String(saved.value.revision)} and read back, and a save from it after revision ${String(theirs.value.revision)} was refused ${mine.refusal.code}; the server named ${offered.value.provider}'s ${offered.value.model} and report-ai's briefing digest, and its model was asked through askThrough over the client under report-ai's briefing; the trail held one event for each request the API answered, and nothing of what the model was asked`,
  )
} finally {
  await server.close()
  await rm(storeDirectory, { recursive: true, force: true })
}
