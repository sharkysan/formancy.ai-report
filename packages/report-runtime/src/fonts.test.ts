import * as spec from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import * as runtime from './index.js'

/**
 * The font reader an engine reads, handed on by the runtime (0040). The
 * renderer depends on the runtime alone, and reads the faces it embeds
 * through report-spec's reader by way of it; a runtime that handed on a
 * copy, or another reader, would let a builder approve a font by one rule
 * and the renderer print it by another, which nothing in the workspace
 * would see but this and the install gate.
 */

describe("what an engine reads of report-spec's font reader", () => {
  test("hands it on as report-spec's own", () => {
    expect(runtime.readFont).toBe(spec.readFont)
    expect(runtime.characterMap).toBe(spec.characterMap)
    expect(runtime.FONT_REFUSAL_CODES).toBe(spec.FONT_REFUSAL_CODES)
    expect(runtime.FONT_FORMATS).toBe(spec.FONT_FORMATS)
    expect(runtime.FONT_EMBEDDING_REFUSALS).toBe(spec.FONT_EMBEDDING_REFUSALS)
    expect(runtime.MAX_FONT_BYTES).toBe(spec.MAX_FONT_BYTES)
    expect(runtime.MAX_FONT_CHARACTERS).toBe(spec.MAX_FONT_CHARACTERS)
  })

  // A font is at most what any asset may be, which the runtime holds a host's answer to before it copies a byte.
  test('bounds a font within what an asset may be', () => {
    expect(runtime.MAX_FONT_BYTES).toBeLessThanOrEqual(runtime.MAX_ASSET_BYTES)
  })
})
