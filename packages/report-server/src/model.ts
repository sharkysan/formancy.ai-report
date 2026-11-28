/**
 * The model's routes (0084): `GET /v1/model` and `POST /v1/model/complete`,
 * each an adapter over report-server-core's use case of its name, which
 * decides who may, what a request must be, the briefing it is asked under
 * and the status of every answer.
 *
 * What only a route can decide is how a body is read, how often a person
 * may ask, and when the server stops waiting:
 *
 * - **The body** is JSON alone, up to report-ai's `MAX_MODEL_REQUEST_BYTES`,
 *   the bound the request builder and `askThrough` hold a page's body to,
 *   measured as it is sent, `{ kind, user, briefing }` as JSON (0085): one
 *   number for both ends. A body past it is refused `request-too-large` by
 *   the length it declares before it is read, or once it is read past it
 *   where it declares none (app.ts).
 * - **The rate** is `rateLimit` requests a window per person, the token's
 *   tenant and subject, counted after the token is verified, beside the
 *   per-address limit every route but `/health` has: an office behind one
 *   address is not one budget, and one author cannot spend another's.
 * - **The time** is `MODEL_TIMEOUT_MS`; and a client that goes away is
 *   heard at once, from the response's close, or before the handler where
 *   it went while its token was checked.
 *
 * The briefing table is built here, once, from report-ai's `modelBriefing`
 * and `briefingDigest` over its `REQUEST_KINDS`, so the server asks under
 * the briefings the page's report-ai reads the answer against, and nothing
 * else (0085).
 */
import { briefingDigest, MAX_MODEL_REQUEST_BYTES, modelBriefing, REQUEST_KINDS } from '@formancy/report-ai'
import { askModel, readModel, REFUSALS } from '@formancy/report-server-core'
import type { DeploymentModel, ModelAsked, ModelBriefings, ModelEnd, ModelEnding, ReportIdentity, RolePolicy } from '@formancy/report-server-core'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { RateLimit } from './rate-limit.js'
import { rateLimitProblem } from './rate-limit.js'

declare module 'fastify' {
  interface FastifyRequest {
    /** What the trail says of a request to the model that passed every check: its kind, its length and how it ended (0084). */
    modelAsked?: ModelAsked
  }
}

/**
 * How long the server waits for a completer's answer before it tells the
 * completer to abandon the request and answers 504 `model-timed-out`:
 * 300 s, chosen as `REQUEST_TIMEOUT_MS`, the time a request may take to
 * arrive, and not measured against any provider. A long answer a provider
 * would have finished after it is cut; the person asks for the rest.
 */
export const MODEL_TIMEOUT_MS = 300_000

/**
 * Requests to complete per person per minute, unless the embedder says
 * otherwise: 10, formancy.ai 0165's, a run of three turns, three times.
 * Derived, not measured.
 */
export const DEFAULT_MODEL_RATE_LIMIT = Object.freeze({ max: 10, timeWindowMs: 60_000 })

/** The model an embedder gives `createReportServer`: report-server-core's `DeploymentModel`, and how often a person may ask it. */
export interface ReportServerModel extends DeploymentModel {
  /** Requests to complete per person per window. Default `DEFAULT_MODEL_RATE_LIMIT`, 10 a minute. */
  readonly rateLimit?: RateLimit
}

const MODEL_PROBLEM =
  'model is { provider, model, completer }: provider and model each a name, and completer an object whose complete(prompt, cancellation) asks the model; leave it out for none.'

/**
 * What is wrong with the model an embedder passes, or `undefined`: absent is
 * none. A JavaScript embedder that passed a completer without `complete`,
 * or no names, would start a server that failed every author's first
 * request.
 */
export function modelProblem(model: unknown): string | undefined {
  if (model === undefined) return undefined
  if (model === null || typeof model !== 'object') return MODEL_PROBLEM
  const given = model as Partial<Record<keyof ReportServerModel, unknown>>
  const named = (value: unknown) => typeof value === 'string' && value !== ''
  const completer = given.completer as { complete?: unknown } | null | undefined
  if (!named(given.provider) || !named(given.model) || typeof completer?.complete !== 'function') return MODEL_PROBLEM
  const limited = given.rateLimit === undefined ? undefined : rateLimitProblem(given.rateLimit)
  return limited === undefined ? undefined : `model.${limited}`
}

/** The briefings the server asks under, by report-ai's kinds: each kind's system part and its digest, frozen. */
export function modelBriefings(): ModelBriefings {
  return Object.freeze(Object.fromEntries(REQUEST_KINDS.map((kind) => [kind, Object.freeze({ system: modelBriefing(kind), digest: briefingDigest(kind) })])))
}

/**
 * A request's ending, as the use case is told it: the response closing
 * before it was written, which is a client gone -- at once where it had
 * already closed, as it has for a client that went while its token was
 * checked, whose response never closes again -- or the timer. `settle`
 * stops both once the use case has answered, so a close after an answer,
 * which is how every response ends, tells nobody anything.
 */
export function endingOf(reply: FastifyReply): { readonly ending: ModelEnding; readonly settle: () => void } {
  const response = reply.raw
  const listeners: ((end: ModelEnd) => void)[] = []
  let ended: ModelEnd | undefined = response.destroyed && !response.writableFinished ? 'gone' : undefined
  const end = (why: ModelEnd): void => {
    if (ended !== undefined) return
    ended = why
    for (const listener of listeners.splice(0)) listener(why)
  }
  const closed = (): void => {
    if (!response.writableFinished) end('gone')
  }
  response.once('close', closed)
  const timer = setTimeout(() => {
    end('timed-out')
  }, MODEL_TIMEOUT_MS)
  return {
    ending: {
      onEnd(listener) {
        if (ended === undefined) listeners.push(listener)
        else listener(ended)
      },
    },
    settle: () => {
      clearTimeout(timer)
      response.off('close', closed)
    },
  }
}

/** Who a person is, as the per-person limit keys them: their tenant and subject as a JSON array, so no two people run together. */
const personKey = (identity: ReportIdentity): string => JSON.stringify(['model', identity.tenant, identity.subject])

/**
 * Registers the two routes in `api`, whose hooks have verified the token
 * before either runs, in a context of their own, JSON alone. Each is one
 * `ROUTES` names, with its audit name.
 */
export function registerModelRoutes(api: FastifyInstance, options: { model: ReportServerModel | undefined; roles: RolePolicy }): void {
  const { model, roles } = options
  const briefings = modelBriefings()
  const limit = model?.rateLimit ?? DEFAULT_MODEL_RATE_LIMIT
  const asking = (request: FastifyRequest) => ({ identity: request.identity as ReportIdentity, roles, model, briefings })

  void api.register(async (routes) => {
    // JSON alone, by Fastify's own parser, which refuses a prototype key.
    routes.removeContentTypeParser('text/plain')

    routes.get('/v1/model', async (request, reply) => {
      const answered = readModel(asking(request))
      return reply.code(answered.status).send(answered.body)
    })

    // A limiter of its own, keyed by person: the plugin's per-route
    // setting would replace the per-address count on this route, and its
    // `rateLimit()` hook would find the request counted already, by
    // address, and count nothing.
    const perPerson = routes.createRateLimit({
      max: limit.max,
      timeWindow: limit.timeWindowMs,
      keyGenerator: (request) => personKey(request.identity as ReportIdentity),
    })

    routes.post(
      '/v1/model/complete',
      {
        bodyLimit: MAX_MODEL_REQUEST_BYTES,
        config: { tooLarge: 'request-too-large' },
        // After the token and the body, before the use case: a request
        // refused for its token spends no person's budget.
        preHandler: async (request, reply) => {
          const counted = await perPerson(request)
          if (counted.isAllowed || !counted.isExceeded) return undefined
          return reply.code(429).header('retry-after', String(counted.ttlInSeconds)).send(REFUSALS['model-rate-limited'])
        },
      },
      async (request, reply) => {
        const { ending, settle } = endingOf(reply)
        let answered
        try {
          answered = await askModel(asking(request), request.body, ending)
        } finally {
          settle()
        }
        const { asked } = answered
        if (asked !== undefined) {
          request.modelAsked = asked
          // The provider's status, which is what an operator has to go on;
          // its words go nowhere (formancy's SAFETY-ANALYSIS C3).
          if (asked.outcome === 'unavailable') request.log.error({ model: { kind: asked.kind, status: asked.status ?? null } }, 'the model could not be asked')
        }
        return reply.code(answered.answered.status).send(answered.answered.body)
      },
    )
  })
}
