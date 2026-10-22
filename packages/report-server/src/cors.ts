/**
 * Across origins, by formancy.ai-data 0060's rule: the API answers a page on
 * another origin when the operator lists that origin exactly, and nothing
 * else does. Report has one API and no administrator's plane apart from it,
 * so every route `ROUTES` names is offered to a listed origin, and `/health`
 * to none.
 *
 * - `FORMANCY_REPORT_CORS_ORIGINS`, read by the composition root and parsed
 *   here, and `origins`, which createReportServer holds to the same rule.
 * - `crossOrigin`, which createReportServer calls on every server: with a
 *   list, an `OPTIONS` route at each API path granting a preflight for the
 *   method that path answers and the token's header alone, and the listed
 *   origin carried back on every answer of the API, refusals included; with
 *   or without one, a token-bearing request a browser marks cross-site or
 *   same-site refused before its token is read, unless its origin is listed.
 *
 * Never a wildcard, a pattern, `null` or credentials.
 */
import { CROSS_ORIGIN_REQUEST_HEADERS, REFUSALS, ROUTES } from '@formancy/report-server-core'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

/**
 * How long a browser may keep a granted preflight, in seconds: 600, the
 * longest every engine honours as written, WebKit's cap, which Formancy
 * Data read in each engine's source on 2026-10-13 (formancy.ai-data 0060).
 * Derived, not measured here; it is also the longest a browser that cached
 * a grant keeps sending without asking after its origin leaves the list,
 * which the refusal below closes for every browser that sends
 * Sec-Fetch-Site.
 */
export const PREFLIGHT_MAX_AGE_SECONDS = 600

const SETTING = 'FORMANCY_REPORT_CORS_ORIGINS'

/** Plain HTTP is accepted on these hosts only, where a developer's page is: never across a network. */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

/** One label of a host name as a browser's URL parser leaves it. Anchored, one class, so linear. */
const LABEL = /^[a-z0-9_-]+$/

/**
 * Why `entry` is not an origin this server lists, as the end of a sentence
 * that never repeats it, or `undefined`: accepted only when the URL parser
 * gives it back unchanged as its origin, over `https:`, or `http:` on
 * loopback, with a host that is a DNS name or an IP address.
 */
function originProblem(entry: unknown): string | undefined {
  if (typeof entry !== 'string') return 'is not a string'
  if (entry === '*' || entry === 'null') return 'is a wildcard or the opaque origin, which is never listed: each origin is named exactly'
  let url: URL
  try {
    url = new URL(entry)
  } catch {
    return 'is not an origin: a scheme, a host and, where it is not the default, a port'
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'is not an https: origin'
  if (url.origin !== entry) return 'is not written as a browser sends Origin: lower case, a punycode name, no path or trailing slash, no default port and no user information'
  const host = url.hostname
  if (!(host.startsWith('[') || host.split('.').every((label) => LABEL.test(label)))) return 'names a pattern or a host that is no DNS name or IP address'
  if (url.protocol === 'http:' && !LOOPBACK.has(host)) return 'is plain HTTP on a host other than localhost, 127.0.0.1 or [::1]: anything else is listed as https:'
  return undefined
}

export type CorsOriginsSetting = { ok: true; origins: string[] } | { ok: false; problem: string }

/**
 * `FORMANCY_REPORT_CORS_ORIGINS` as written: origins separated by commas,
 * space around each ignored, each kept once. Unset, empty or nothing but
 * commas and space is no origin. Any entry that is not an origin refuses
 * the whole setting, named by its place and never quoted.
 */
export function corsOriginsSetting(text: string | undefined): CorsOriginsSetting {
  const entries = (text ?? '').split(',').map((entry) => entry.trim()).filter((entry) => entry !== '')
  for (const [index, entry] of entries.entries()) {
    const problem = originProblem(entry)
    if (problem !== undefined) return { ok: false, problem: `${SETTING}: entry ${String(index + 1)} ${problem}.` }
  }
  return { ok: true, origins: [...new Set(entries)] }
}

/** What is wrong with `origins` as an embedder passed it, by place, or `undefined`: the setting's rule, without trimming. */
export function originsProblem(origins: unknown): string | undefined {
  if (!Array.isArray(origins)) return 'origins is not a list of origins.'
  for (const [index, entry] of origins.entries()) {
    const problem = originProblem(entry)
    if (problem !== undefined) return `origins[${String(index)}] ${problem}.`
  }
  return undefined
}

/**
 * `existing` Vary with `name` added once, by its token case-insensitively;
 * `*` stays `*`. No API route sets Vary of its own today; one that does --
 * Accept-Encoding, once a route compresses -- keeps it.
 */
export function varyWith(existing: number | string | string[] | undefined, name: string): string {
  const tokens = [existing ?? []].flat().flatMap((value) => String(value).split(',')).map((token) => token.trim()).filter((token) => token !== '')
  if (tokens.includes('*')) return '*'
  return tokens.some((token) => token.toLowerCase() === name.toLowerCase()) ? tokens.join(', ') : [...tokens, name].join(', ')
}

/**
 * The origin as a log line may name it: only one the URL parser gives back
 * unchanged, no longer than an origin can be, so nothing a caller pasted
 * into a URL rides into the log with it.
 */
function loggable(origin: unknown): { origin?: string } {
  if (typeof origin !== 'string' || origin.length > 267) return {}
  try {
    return new URL(origin).origin === origin ? { origin } : {}
  } catch {
    return {}
  }
}

/** `METHOD url` as ROUTES keys it. */
const routeKey = (request: FastifyRequest) => `${request.method} ${request.routeOptions.url ?? ''}`

const OFFERED = new Set<string>(Object.keys(ROUTES))

/** The methods ROUTES answers at each path. */
const METHODS = new Map<string, Set<string>>()
for (const key of OFFERED) {
  const [method = '', path = ''] = key.split(' ')
  METHODS.set(path, (METHODS.get(path) ?? new Set()).add(method))
}

const VARY_PREFLIGHT = 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers'

/**
 * Called by createReportServer on every server, before any route, so its
 * hooks cover every route registered after it.
 */
export function crossOrigin(app: FastifyInstance, options: { origins: readonly string[] }): void {
  const listed = new Set(options.origins)

  // A browser that cached a grant keeps sending without asking for up to
  // Max-Age; after its origin left the list its requests would run and only
  // their answers go unread. So a token-bearing request whose Sec-Fetch-Site
  // says another site sent it is refused here unless its origin is listed:
  // after the limiter's onRequest, so it is counted, and before the API's
  // preHandler, which reads the token, so no token is read and no work is
  // done; the API's own hooks still write its one event. With no route, the
  // 404 is left as it is.
  app.addHook('preHandler', async (request, reply) => {
    if (request.routeOptions.url === undefined || request.headers.authorization === undefined) return undefined
    const site = request.headers['sec-fetch-site']
    if (site !== 'cross-site' && site !== 'same-site') return undefined
    const origin = request.headers.origin
    const fromListed = typeof origin === 'string' && listed.has(origin)
    if (fromListed && OFFERED.has(routeKey(request))) return undefined
    request.log.info({ reason: fromListed ? 'route not offered across origins' : 'origin not listed', ...loggable(origin) }, 'cross-origin request refused')
    return reply.code(403).send(REFUSALS['cross-origin-refused'])
  })

  if (listed.size === 0) return

  // Every answer of the API, refusals included, so a page on a listed
  // origin reads the server's sentence; Vary on all of them, since the same
  // route answers another origin without the grant.
  app.addHook('onSend', async (request, reply, payload) => {
    if (!OFFERED.has(routeKey(request))) return payload
    reply.header('vary', varyWith(reply.getHeader('vary'), 'Origin'))
    const origin = request.headers.origin
    if (typeof origin === 'string' && listed.has(origin)) reply.header('access-control-allow-origin', origin)
    return payload
  })

  // One OPTIONS route per API path: a preflight reads no token and does no
  // work, so it is no audit event, and it is not counted, so the limiter's
  // 429, which a page can read, never becomes a refused preflight, which it
  // cannot. The reason a preflight is refused is the log's, not the answer's.
  // A preflight carries no body; one that does is no browser's, and is
  // refused before it is read, its connection closed: uncounted, it would
  // otherwise be parsed whatever it held, and held open however slowly it
  // came.
  const bodiless = async (request: FastifyRequest, reply: FastifyReply) => {
    const length = request.headers['content-length']
    if ((length === undefined || length === '0') && request.headers['transfer-encoding'] === undefined) return undefined
    request.log.info({ reason: 'a preflight carries no body' }, 'preflight refused')
    return reply.code(400).header('connection', 'close').send(REFUSALS['bad-request'])
  }
  for (const [path, methods] of METHODS) {
    app.options(path, { config: { rateLimit: false }, onRequest: bodiless }, async (request, reply) => {
      const origin = request.headers.origin
      const method = request.headers['access-control-request-method']
      const asked = String(request.headers['access-control-request-headers'] ?? '').split(',').map((name) => name.trim().toLowerCase()).filter((name) => name !== '')
      const reason =
        typeof origin !== 'string' || typeof method !== 'string'
          ? 'not a preflight'
          : !listed.has(origin)
            ? 'origin not listed'
            : !methods.has(method)
              ? 'method not offered on this route'
              : !asked.every((name) => (CROSS_ORIGIN_REQUEST_HEADERS as readonly string[]).includes(name))
                ? 'header not allowed'
                : undefined
      if (reason !== undefined) {
        request.log.info({ reason, ...loggable(origin) }, 'preflight refused')
        return reply.code(403).header('vary', VARY_PREFLIGHT).send(REFUSALS['cross-origin-refused'])
      }
      return reply
        .code(204)
        .headers({
          'access-control-allow-origin': String(origin),
          'access-control-allow-methods': String(method),
          'access-control-allow-headers': CROSS_ORIGIN_REQUEST_HEADERS.join(', '),
          'access-control-max-age': String(PREFLIGHT_MAX_AGE_SECONDS),
          vary: VARY_PREFLIGHT,
        })
        .send()
    })
  }
}
