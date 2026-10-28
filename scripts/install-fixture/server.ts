/*
 * The server's host (0046): a consumer that knows nothing about the
 * workspace, with Node's types, the packed report-server and what it
 * declares, and nothing else -- no runtime, no renderer, no builder.
 *
 * Copied into a temporary npm project by install-test.mjs, installed from
 * the packed tarballs, type-checked with skipLibCheck OFF and run under
 * Node. What is on trial: the published entry points resolve, with the
 * types that shipped, @formancy/data-identity 0.3.0 among what npm brings;
 * and the server, made in this process and listening on a socket, answers
 * /health, refuses a request without a token, with a tenantless token, a
 * forgery or a malformed token with the one 401, and answers whoami for a
 * token this host signed, with its tenant and the actions its roles give.
 * The tokens are signed with node:crypto alone, as a host on any stack can
 * sign one, and their secrets are this check's own.
 */
import { createHmac } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { ACTIONS, REFUSALS } from '@formancy/report-server-core'
import type { Health, Refusal, WhoAmI } from '@formancy/report-server-core'
import { createReportServer, createReportVerifier } from '@formancy/report-server'
import type { ReportServerOptions } from '@formancy/report-server'

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

const events: unknown[] = []
const audit: ReportServerOptions['audit'] = { sink: (event) => void events.push(event) }

const verifyIdentity = await createReportVerifier({ key: { kind: 'secret', secret: hostSecret }, issuer: 'https://login.example', audience: 'formancy-report', tenantClaim: 'tid' })
const server = await createReportServer({ verifyIdentity, roles: { author: ['report-authors'], publisher: ['report-publishers'], admin: ['report-admins'] }, audit })
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
      throw new Error(`whoami ${authorization === undefined ? 'without a token' : 'with a bad token'} answered ${String(refused.status)} ${body.code}, not the one 401`)
    }
  }

  const answered = await fetch(`${at}/v1/whoami`, { headers: { authorization: `Bearer ${token}` } })
  const me = (await answered.json()) as WhoAmI
  const authors = Object.entries(ACTIONS).filter(([, capacities]) => (capacities as readonly string[]).includes('author')).map(([action]) => action)
  if (answered.status !== 200 || me.tenant !== 'acme' || me.subject !== 'u-1' || JSON.stringify(me.actions) !== JSON.stringify(authors)) {
    throw new Error(`whoami for the host's token answered ${String(answered.status)} ${JSON.stringify(me)}`)
  }

  const unknown = await fetch(`${at}/v1/templates`, { headers: { authorization: `Bearer ${token}` } })
  if (unknown.status !== 404) throw new Error(`/v1/templates answered ${String(unknown.status)}, where nothing but /health and /v1/whoami answers`)
  if (events.length !== 5) throw new Error(`the trail holds ${String(events.length)} events for five requests whoami answered`)

  console.log(`ok: report-server listened on a socket of its own; /health answered, whoami refused no token, a tenantless one, a forgery and a malformed one with the one 401, and answered the host's token as tenant ${me.tenant} with ${String(me.actions.length)} actions; nothing else answered; the trail held one event for each request whoami answered`)
} finally {
  await server.close()
}
