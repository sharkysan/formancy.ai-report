import { describe, expect, test } from 'vitest'
import * as entry from './index.js'
import { API_PREFIX, CROSS_ORIGIN_REQUEST_HEADERS, REFUSALS, ROUTES } from './wire.js'

/**
 * What a client compiles against (0046): the API's version line, the routes
 * it answers, and the refusals it gives, each a code and a sentence.
 */
describe('the wire', () => {
  // The API is a version line of its own (0046, extending 0004): a route
  // outside /v1 would be one no version names, and a later shape would
  // change it for every client at once.
  test('answers every route under /v1, by method and path, each named for its audit event', () => {
    expect(API_PREFIX).toBe('/v1')
    expect(ROUTES).toEqual({ 'GET /v1/whoami': 'whoami' })
    for (const route of Object.keys(ROUTES)) expect(route).toMatch(/^(GET|PUT|POST|DELETE) \/v1\/[a-z/:-]+$/)
    expect(Object.isFrozen(ROUTES)).toBe(true)
  })

  // A refusal is a stable code a client branches on and a sentence a
  // person reads; one whose code was not its key would let the two drift,
  // and a sentence that could hold a value is one a token could ride into.
  test('gives every refusal a code that is its key and a fixed sentence', () => {
    for (const [key, refusal] of Object.entries(REFUSALS)) {
      expect(refusal.code).toBe(key)
      expect(refusal.message).toMatch(/^[A-Z][^{}<>]*\.$/)
      expect(Object.isFrozen(refusal)).toBe(true)
    }
    expect(Object.keys(REFUSALS).sort()).toEqual([
      'bad-request',
      'cross-origin-refused',
      'internal',
      'not-found',
      'path-not-plain',
      'rate-limited',
      'unauthenticated',
    ])
    expect(Object.isFrozen(REFUSALS)).toBe(true)
  })

  // The routes are read with a token and nothing else a page sets, so a
  // grant across origins names that header alone; a header granted and
  // never read is surface for nothing.
  test('lets a page across origins send the token and nothing else', () => {
    expect(CROSS_ORIGIN_REQUEST_HEADERS).toEqual(['authorization'])
    expect(Object.isFrozen(CROSS_ORIGIN_REQUEST_HEADERS)).toBe(true)
  })
})

describe('the entry', () => {
  // What a server, a store and a client import is this list; anything else
  // in the entry is surface a later release could not remove unnoticed.
  test('exports the actions table, the wire and nothing else', () => {
    expect(Object.keys(entry).sort()).toEqual([
      'ACTIONS',
      'API_PREFIX',
      'CAPACITIES',
      'CROSS_ORIGIN_REQUEST_HEADERS',
      'REFUSALS',
      'ROUTES',
      'actionsOf',
      'can',
      'capacitiesOf',
    ])
  })
})
