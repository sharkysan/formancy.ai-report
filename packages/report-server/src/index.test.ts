import { describe, expect, test } from 'vitest'
import * as entry from './index.js'

describe('the entry', () => {
  // What a host embedding the server imports is this list: the server, the
  // verifier it is given, and the formula its trail names who asked by.
  // The settings and their opening are main.ts's, the container's, and a
  // later release can change them without breaking an embedder.
  test('exports the server, its verifier and the audit reference, and nothing else', () => {
    expect(Object.keys(entry).sort()).toEqual(['auditReference', 'createReportServer', 'createReportVerifier'])
  })
})
