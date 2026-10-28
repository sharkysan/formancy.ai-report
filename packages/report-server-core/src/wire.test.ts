import { describe, expect, expectTypeOf, test } from 'vitest'
import * as entry from './index.js'
import type { ServerRefusal } from './index.js'
import { API_PREFIX, CROSS_ORIGIN_REQUEST_HEADERS, DRAFT_FORMAT, REFUSALS, ROUTES } from './wire.js'

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
  // The draft slice's refusals answer a request that carries a template's
  // content, an id and a digest. A sentence with a brace, an angle bracket,
  // a dollar sign, a quote or a backtick is the shape of one that has a
  // value written into it, and one that does not end in a full stop is one
  // a client would show cut.
  test('gives every refusal a code that is its key and a fixed sentence that quotes nothing a request carries', () => {
    for (const [key, refusal] of Object.entries(REFUSALS)) {
      expect(refusal.code).toBe(key)
      expect(refusal.message).toMatch(/^[A-Z][^{}<>$"'`]*\.$/)
      expect(Object.isFrozen(refusal)).toBe(true)
    }
    expect(Object.keys(REFUSALS).sort()).toEqual([
      'asset-not-kept',
      'bad-request',
      'cross-origin-refused',
      'digest-invalid',
      'digest-mismatch',
      'draft-changed',
      'forbidden',
      'image-refused',
      'image-too-large',
      'internal',
      'no-asset',
      'no-draft',
      'not-found',
      'path-not-plain',
      'precondition-required',
      'rate-limited',
      'report-invalid',
      'report-too-large',
      'template-id-invalid',
      'template-id-mismatch',
      'unauthenticated',
      'unsupported-media-type',
    ])
    expect(Object.isFrozen(REFUSALS)).toBe(true)
  })

  // A client may show the sentence and not the code, so two codes with one
  // sentence would let a person not tell a stale draft from a missing one.
  test('gives no two refusals the same sentence', () => {
    const sentences = Object.values(REFUSALS).map((refusal) => refusal.message)
    expect(new Set(sentences).size).toBe(sentences.length)
  })

  // The stored draft's format is the fourth version line (0046): a reader
  // that finds another number refuses it, so the number a writer stamps and
  // a reader compares must be one constant, and a number that is not 1
  // would fail every record already written.
  test('stamps a draft with format 1, as a constant', () => {
    expect(DRAFT_FORMAT).toBe(1)
    expectTypeOf(DRAFT_FORMAT).toEqualTypeOf<1>()
  })

  // Four refusals carry a field to the requester alone. A client that
  // branches on the code must be given the field by the type, or it reads
  // `errors` off a refusal that has none; a plain refusal, `forbidden`
  // among them, needs no field. The narrowing is checked by `typecheck`,
  // which compiles this file: vitest erases types and would pass a type
  // that narrowed nothing.
  test('narrows a refusal that carries a field by its code', () => {
    const narrow = (refusal: ServerRefusal) => {
      if (refusal.code === 'report-invalid') return refusal.errors
      if (refusal.code === 'draft-changed') return refusal.revision
      if (refusal.code === 'asset-not-kept') return refusal.assets
      if (refusal.code === 'image-refused') return refusal.reason
      return refusal.message
    }
    expect(narrow({ ...REFUSALS.forbidden })).toBe(REFUSALS.forbidden.message)
    expect(narrow({ ...REFUSALS['draft-changed'], revision: null })).toBeNull()
    expect(narrow({ ...REFUSALS['asset-not-kept'], assets: ['logo'] })).toEqual(['logo'])
    // A refusal of a code that carries a field is not one without it: a
    // use case that forgot the revision would otherwise answer a client
    // that reads `revision` off `draft-changed` with undefined.
    // @ts-expect-error the type must refuse draft-changed without its revision
    const bare: ServerRefusal = { ...REFUSALS['draft-changed'] }
    expect(bare.code).toBe('draft-changed')
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
    expect(Object.keys(entry).sort()).toEqual(['ACTIONS', 'API_PREFIX', 'CAPACITIES', 'CROSS_ORIGIN_REQUEST_HEADERS', 'DRAFT_FORMAT', 'REFUSALS', 'ROUTES', 'actionsOf', 'can', 'capacitiesOf'])
  })
})
