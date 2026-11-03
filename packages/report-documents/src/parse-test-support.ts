import { expect } from 'vitest'
import { parseDocument, type ParsedDocument } from './parse.js'
import { refusal, type DocumentRefusal, type DocumentRefusalCode, type Finding } from './refusals.js'

/**
 * What the parse's tests assert, written once: a file read, or refused with
 * a code for one finding, in a message of the reader's own words. Never
 * published: nothing in `index.ts` exports it.
 */

/**
 * For a test that reads a file at a bound, which is the reader's own work
 * and not a hang: the costliest, a hundred thousand pages, took 0.9 s, and
 * 2.6 s under coverage, in Node 22.23.3 on an Apple M2 on 3 November 2026,
 * so that a runner several times slower still passes. Time is not what any
 * of them asserts; each asserts its refusal.
 */
export const AT_A_BOUND = { timeout: 30_000 }

/** The document `bytes` parse to, failing the test where they are refused. */
export function parsed(bytes: Uint8Array): ParsedDocument {
  const result = parseDocument(bytes)
  if ('ok' in result) throw new Error(`refused: ${result.message}`)
  return result
}

/**
 * That `bytes` are refused as `code`, for what `finding` says, in a message
 * that names no byte of the file: the finding's words and the code's advice
 * and nothing else -- no digit, no PDF delimiter -- so that no offset,
 * object number, name or string of the file reaches it.
 */
export function expectRefused(bytes: Uint8Array, code: DocumentRefusalCode, finding: Finding): void {
  const result = parseDocument(bytes)
  expect(result).toEqual(refusal(finding))
  expect(result).toMatchObject({ ok: false, code })
  expect((result as DocumentRefusal).message).toMatch(/^[A-Za-z ,;'-]+$/)
}
