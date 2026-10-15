import { describe, expect, test } from 'vitest'
import { REFUSAL_CODES, RenderRefusal } from './document.js'

describe('RenderRefusal', () => {
  // A refusal is told apart from an engine's crash by its class and its code.
  // If either were lost -- a plain Error, or a code that did not survive the
  // constructor -- a caller would report a crash as the refusal it can
  // explain, or the refusal as a crash.
  test('is an Error that keeps its code, its subject and its message', () => {
    const refusal = new RenderRefusal('invalid-asset', 'asset logo is not a PNG', 'logo')
    expect(refusal).toBeInstanceOf(Error)
    expect(refusal).toBeInstanceOf(RenderRefusal)
    expect(refusal.name).toBe('RenderRefusal')
    expect(refusal.code).toBe('invalid-asset')
    expect(refusal.subject).toBe('logo')
    expect(refusal.message).toBe('asset logo is not a PNG')
  })

  // A refusal about the whole document names no subject, and says so with
  // undefined rather than an empty string a caller could mistake for a name.
  test('has no subject when none is given', () => {
    expect(new RenderRefusal('too-many-pages', 'the report needs 99 pages; the limit is 20').subject).toBeUndefined()
  })

  // A caller decides what to tell the person from the code alone -- shorten
  // the report, replace an asset, try again -- so every code must come back
  // as the one it was refused with, and the list a caller switches over must
  // hold each code once.
  test.each(REFUSAL_CODES)('keeps the code %s', (code) => {
    expect(new RenderRefusal(code, 'refused').code).toBe(code)
    expect(REFUSAL_CODES.filter((each) => each === code)).toHaveLength(1)
  })
})
