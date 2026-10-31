import { describe, expect, test } from 'vitest'
import { plainPath } from './paths.js'

/**
 * The paths the server routes (paths.ts, formancy.ai-data 0037's rule),
 * as a request target arrives: app.test.ts holds what the server answers
 * for one that is not plain; here the rule itself, for the targets inject
 * cannot send as written.
 */
describe('plainPath', () => {
  // The routes the server answers, and the parameters later routes take,
  // are each written in nothing a proxy would normalise.
  test('accepts a path of plain segments, whatever its query', () => {
    for (const target of ['/health', '/v1/whoami', '/v1/whoami?q=%41&r=/x', "/v1/a-b_c.d~e!$&'()*+,;=:@"]) expect(plainPath(target), target).toBe(true)
  })

  // Each of these is a path a proxy may decode, resolve or collapse before
  // it forwards, or one a router reads otherwise than a proxy: an escape, a
  // dot segment, an empty one, a backslash, a fragment, a character outside
  // ASCII, a target that is no path at all.
  test('refuses every target with anything in it to normalise', () => {
    for (const target of [
      '/v1/%77hoami',
      '/v1/./whoami',
      '/v1/../whoami',
      '/v1/whoami/.',
      '/v1//whoami',
      '/v1/whoami/',
      '/',
      '',
      '*',
      'v1/whoami',
      'http://host.example/v1/whoami',
      '/v1\\whoami',
      '/v1/whoami#x',
      '/v1/whoämi',
      '/v1/who ami',
    ]) {
      expect(plainPath(target), target).toBe(false)
    }
  })
})
