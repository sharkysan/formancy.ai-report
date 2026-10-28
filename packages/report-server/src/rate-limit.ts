/**
 * The per-address request limit, and the setting that changes it, by
 * formancy.ai-data's rule for its own (its 0034): the composition root reads
 * `FORMANCY_REPORT_RATE_LIMIT` (main.ts, through settings.ts) and it is
 * parsed here, so the rule is tested without starting a process.
 */

/**
 * Requests per client address per minute, unless the operator says
 * otherwise: 600, Formancy Data's default, taken so that a host behind both
 * servers meets one limit. Derived, not measured: nothing here measured a
 * rate. What it is for is a client replaying tokens at the verifier as fast
 * as the network allows, which every request but `/health` begins with.
 */
export const DEFAULT_RATE_LIMIT = Object.freeze({ max: 600, timeWindowMs: 60_000 })

export interface RateLimit {
  max: number
  timeWindowMs: number
}

/** What main.ts prints, and stops, when the setting is anything but a whole number of at least one. */
export const RATE_LIMIT_REFUSAL = 'FORMANCY_REPORT_RATE_LIMIT is a whole number of requests a minute per client address, at least 1.'

export type RateLimitSetting = { ok: true; rateLimit: RateLimit } | { ok: false; problem: string }

/**
 * `FORMANCY_REPORT_RATE_LIMIT` as written: unset is the default; otherwise
 * decimal digits only -- no sign, fraction, exponent or space -- and a value
 * a JavaScript number holds exactly.
 */
export function rateLimitSetting(text: string | undefined): RateLimitSetting {
  if (text === undefined) return { ok: true, rateLimit: { ...DEFAULT_RATE_LIMIT } }
  const max = /^[0-9]+$/.test(text) ? Number(text) : Number.NaN
  if (!Number.isSafeInteger(max) || max < 1) return { ok: false, problem: RATE_LIMIT_REFUSAL }
  return { ok: true, rateLimit: { max, timeWindowMs: DEFAULT_RATE_LIMIT.timeWindowMs } }
}

const whole = (value: unknown): boolean => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1

/** What is wrong with a limit an embedder passes, or `undefined`. */
export function rateLimitProblem(limit: unknown): string | undefined {
  const given = limit as Partial<RateLimit> | null
  return given !== null && typeof given === 'object' && whole(given.max) && whole(given.timeWindowMs) ? undefined : 'rateLimit is { max, timeWindowMs }, each a whole number of at least 1.'
}
