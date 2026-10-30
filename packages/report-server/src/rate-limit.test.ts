import { describe, expect, test } from 'vitest'
import { DEFAULT_RATE_LIMIT, RATE_LIMIT_REFUSAL, rateLimitProblem, rateLimitSetting } from './rate-limit.js'

/**
 * `FORMANCY_REPORT_RATE_LIMIT`, by formancy.ai-data's rule for its own: a
 * whole number of requests a minute per client address, the window always
 * a minute, so the number an operator writes is the number of requests.
 */
describe('rateLimitSetting', () => {
  // Formancy Data's default, taken so a host behind both servers meets one
  // limit (0046): a choice, not a measurement.
  test('is 600 a minute unset', () => {
    expect(DEFAULT_RATE_LIMIT).toEqual({ max: 600, timeWindowMs: 60_000 })
    expect(rateLimitSetting(undefined)).toEqual({ ok: true, rateLimit: DEFAULT_RATE_LIMIT })
  })

  // The number an operator writes is the number of requests a minute, the
  // window always a minute, and a large one is read as written.
  test('reads a whole number of at least one', () => {
    expect(rateLimitSetting('1')).toEqual({ ok: true, rateLimit: { max: 1, timeWindowMs: 60_000 } })
    expect(rateLimitSetting('10000000')).toEqual({ ok: true, rateLimit: { max: 10_000_000, timeWindowMs: 60_000 } })
  })

  // Number() reads all of these as numbers, some as other numbers than
  // were meant -- 6e2, 0x10, 9007199254740993 -- and a limit nobody chose
  // stops the server instead (formancy.ai-data 0034's cases).
  test('refuses anything else, with the sentence that names the setting', () => {
    for (const text of ['', '0', '-1', '1.5', 'abc', '9007199254740993', ' 60', '6e2', '0x10']) {
      expect(rateLimitSetting(text), text).toEqual({ ok: false, problem: RATE_LIMIT_REFUSAL })
    }
    expect(RATE_LIMIT_REFUSAL).toBe('FORMANCY_REPORT_RATE_LIMIT is a whole number of requests a minute per client address, at least 1.')
  })
})

describe('rateLimitProblem', () => {
  // An embedder's limit is held to the same rule as the setting, so a
  // limit of zero, which refuses every request, or a fraction, does not
  // start a server.
  test('refuses a limit an embedder passes that the setting could not say', () => {
    expect(rateLimitProblem({ max: 2, timeWindowMs: 1000 })).toBeUndefined()
    for (const limit of [
      { max: 0, timeWindowMs: 60_000 },
      { max: 1.5, timeWindowMs: 60_000 },
      { max: 2, timeWindowMs: 0 },
      { max: 2, timeWindowMs: Number.NaN },
      null,
    ]) {
      expect(rateLimitProblem(limit), JSON.stringify(limit)).toBe('rateLimit is { max, timeWindowMs }, each a whole number of at least 1.')
    }
  })
})
