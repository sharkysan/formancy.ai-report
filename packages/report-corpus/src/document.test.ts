import { describe, expect, test } from 'vitest'
import { pageDimensions, RenderRefusal } from './document.js'

describe('pageDimensions', () => {
  // Every margin check and every boundary fixture is computed from these
  // numbers. A4 written as Letter, or a landscape page left portrait, would
  // move each of them, and a check of "inside the margins" would pass or fail
  // for a page the document never asked for.
  test('gives A4 and Letter in points, and swaps them for landscape', () => {
    const margins = { top: 36, right: 40, bottom: 36, left: 40 }
    expect(pageDimensions({ size: 'A4', orientation: 'portrait', margins })).toEqual({ width: 595.28, height: 841.89 })
    expect(pageDimensions({ size: 'A4', orientation: 'landscape', margins })).toEqual({ width: 841.89, height: 595.28 })
    expect(pageDimensions({ size: 'Letter', orientation: 'portrait', margins })).toEqual({ width: 612, height: 792 })
    expect(pageDimensions({ size: 'Letter', orientation: 'landscape', margins })).toEqual({ width: 792, height: 612 })
  })
})

describe('RenderRefusal', () => {
  // A refusal is told apart from an engine's crash by its class and its code.
  // If either were lost -- a plain Error, or a code that did not survive the
  // constructor -- a trial would count a crash as the refusal it expected, or
  // the refusal as a crash.
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
  // undefined rather than an empty string a check could mistake for a name.
  test('has no subject when none is given', () => {
    expect(new RenderRefusal('too-many-pages', 'the report needs 99 pages; the limit is 20').subject).toBeUndefined()
  })
})
