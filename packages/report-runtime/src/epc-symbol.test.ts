import { encode } from 'uqr'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { RenderRefusal, type EpcQrCode } from './document.js'
import { epcSymbol } from './epc-symbol.js'
import { qrSymbolVersion, type QrSymbol } from './qr-symbol.js'

/**
 * What decides an EPC QR code's symbol, and what refuses one (0025), where
 * every engine reads it (0074): held here on the symbol -- its version,
 * and the level its format information states -- and on each refusal's
 * code, subject and words. What it says to a banking app is proved where
 * it is drawn: on the PDF by report-render-pdf's `epc-qr-code.test.ts`,
 * and on the Word file by report-render-docx's `codes.test.ts`.
 *
 * "EPC" is EPC069-12 version 3.1, whose first example (2.3) is the
 * payload here; "PSA" is Austria's "QR-Code und BCD Definition", version
 * 3.0.
 */

// Every call to the encoder, counted, and passed through to it.
vi.mock('uqr', async (importOriginal) => {
  const actual = await importOriginal<typeof import('uqr')>()
  return { ...actual, encode: vi.fn(actual.encode) }
})
beforeEach(() => {
  vi.mocked(encode).mockClear()
})

/** EPC 2.3's first example: 95 characters, 96 bytes of UTF-8, "Resulting QR code version 6". */
const V1 = ['BCD', '001', '1', 'SCT', 'BHBLDEHHXXX', 'Franz Mustermänn', 'DE71110220330123456789', 'EUR12.3', 'GDDS', 'RF18539007547034'].join('\n')

/** The bytes of `text` in UTF-8, counted by code point: the suite compiles with no `TextEncoder`, as the package does, and a count of its own is not the rule's. */
const utf8 = (text: string): number =>
  [...text].reduce((bytes, character) => {
    const point = character.codePointAt(0)!
    return bytes + (point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4)
  }, 0)

/** A payload of the EPC's shape and `bytes` bytes, its last character `last`; cut short where fewer are asked for than its elements take. */
function payloadOf(bytes: number, last = 'I'): string {
  const head = ['BCD', '001', '1', 'SCT', 'BHBLDEHHXXX', 'N'.repeat(70), 'DE89370400440532013000', 'EUR999999999.99', 'GDDS', '', 'T'.repeat(140)].join('\n')
  const rest = bytes - utf8(`${head}\n${last}`)
  return rest < 0 ? head.slice(0, bytes) : `${head}\n${'I'.repeat(rest)}${last}`
}

function epc(payload: string, size: number, caption?: 'zahlenMitCode', id = 'pay-code'): EpcQrCode {
  return { kind: 'epcQrCode', id, payload, size, ...(caption === undefined ? {} : { caption }) }
}

const WIDE = 1000

function refusal(make: () => unknown): unknown {
  try {
    make()
  } catch (error) {
    return error
  }
  return 'drawn'
}

/** A refusal's message, which names the code and the rule and never quotes the payload: it holds a name and an account. */
function refused(code: EpcQrCode, as: string, width = WIDE): string {
  const error = refusal(() => epcSymbol(code, width))
  expect(error).toBeInstanceOf(RenderRefusal)
  expect(error).toMatchObject({ code: as, subject: 'pay-code' })
  const { message } = error as Error
  for (const quoted of ['Mustermänn', 'DE71110220330123456789', 'BHBLDEHHXXX', 'RF18539007547034', 'N'.repeat(10)]) expect(message).not.toContain(quoted)
  return message
}

/** The level a symbol states (ISO/IEC 18004, 7.9), as `qr-symbol.test.ts` reads it. */
function levelOf(symbol: QrSymbol): string {
  return ['M', 'L', 'H', 'Q'][(Number(symbol.modules[8]![0]) ^ 1) * 2 + Number(symbol.modules[8]![1])]!
}

describe('an EPC QR code’s symbol', () => {
  // Level M, and version 13 at most: a code at another level or in a
  // larger version is one a bank's app need not read (EPC 2.1). Without a
  // caption the version is the smallest that holds the payload: the EPC's
  // own example says 6.
  test('without a caption is the smallest version that holds its payload, at level M', () => {
    const symbol = epcSymbol(epc(V1, 85.04), WIDE)
    expect(levelOf(symbol)).toBe('M')
    expect(qrSymbolVersion(symbol)).toBe(6)
    expect(encode).toHaveBeenCalledTimes(1)
    expect(qrSymbolVersion(epcSymbol(epc(payloadOf(331), 100), WIDE))).toBe(13)
  })

  // In a square the author sized, the version that just holds a short
  // payload has modules over the PSA's 20 mil: the code is the least
  // version that prints there, a larger symbol of the same payload at the
  // same level. In 30 mm, version 6 would be 0.556 mm a module; version 8
  // is 0.479.
  test('with the caption is the least version whose modules are the PSA’s, or the payload’s own where that is larger', () => {
    const raised = epcSymbol(epc(V1, 85.04, 'zahlenMitCode'), WIDE)
    expect(qrSymbolVersion(raised)).toBe(8)
    expect(levelOf(raised)).toBe('M')
    // 200 bytes need version 10 at M, more than the least a 95 pt square prints.
    expect(qrSymbolVersion(epcSymbol(epc(payloadOf(200), 95, 'zahlenMitCode'), WIDE))).toBe(10)
  })
})

describe('what an EPC QR code is refused by', () => {
  test.each([
    ['of no size', 0],
    ['of a size that is not a number', Number.NaN],
    ['of an endless size', Number.POSITIVE_INFINITY],
  ])('refuses a square %s as unsupported, unencoded', (_, size) => {
    expect(refused(epc(V1, size), 'unsupported')).toBe(`the EPC QR code pay-code is drawn ${size} pt a side`)
    expect(encode).not.toHaveBeenCalled()
  })

  // A captioned code in a column narrower than its square would be drawn over the column beside it.
  test('refuses a square wider than where it stands, with the caption and without', () => {
    for (const caption of [undefined, 'zahlenMitCode'] as const)
      expect(refused(epc(V1, 85.04, caption), 'content-too-large', 80)).toBe('the EPC QR code pay-code is 85.04 pt wide; it stands 80.00 pt wide')
    expect(encode).not.toHaveBeenCalled()
  })

  // A caption no engine knows is never drawn as no caption, or as some other.
  test.each([
    [
      'a caption no engine knows',
      { ...epc(V1, 85.04), caption: 'girocode' as 'zahlenMitCode' },
      "asks for the caption 'girocode', which a report does not know",
    ],
    ['a payload that is not a string', { ...epc(V1, 85.04), payload: [V1] as unknown as string }, 'holds something that is not text'],
    ['a lone half of a surrogate pair', epc(`${V1}\n\uD83E`, 85.04), 'holds U+D83E, half of a surrogate pair'],
  ])('refuses %s as unsupported, unencoded', (_, code, words) => {
    expect(refused(code, 'unsupported')).toContain(words)
    expect(encode).not.toHaveBeenCalled()
  })

  // Past 331 bytes the EPC's code is no longer one: a payload longer than
  // that in characters is refused without being encoded; one whose
  // characters fit but whose UTF-8 does not, once the encoder finds no
  // version up to 13 holds it.
  test('refuses a payload past 331 bytes, unencoded when its characters are already past it', () => {
    expect(refused(epc(payloadOf(332), 100), 'content-too-large')).toBe('the EPC QR code pay-code holds more than the 331 bytes the EPC allows')
    expect(encode).not.toHaveBeenCalled()
    const wide = payloadOf(332, 'ä')
    expect(wide).toHaveLength(331)
    expect(refused(epc(wide, 100), 'content-too-large')).toBe(
      'the EPC QR code pay-code holds 332 bytes, more than version 13 holds at level M, the largest code the EPC allows',
    )
    expect(encode).toHaveBeenCalledTimes(1)
  })

  // Without a caption, 0020's floor: the EPC's first example is version
  // 6, 49 modules with its quiet zone, at least 55.56 pt.
  test('refuses, without a caption, a square too small for its payload at 0.4 mm a module', () => {
    expect(refused(epc(V1, 55.55), 'content-too-large')).toContain('so its payload needs a square of at least 55.56 pt')
    expect(qrSymbolVersion(epcSymbol(epc(V1, 55.56), WIDE))).toBe(6)
  })

  // With the caption, the square alone can break the PSA's rules, and is
  // refused before anything is encoded.
  test.each([
    [68.05, 'a code needs a square of at least 68.06 pt'],
    [118.61, 'a code needs a square of at most 118.60 pt'],
  ])('refuses, with the caption, a square of %s pt, which no version prints in, unencoded', (size, rule) => {
    expect(refused(epc(V1, size, 'zahlenMitCode'), 'content-too-large')).toContain(`cannot be printed as the PSA prints it: with the caption, ${rule}`)
    expect(encode).not.toHaveBeenCalled()
  })

  // 282 bytes need version 12, whose modules in 85.04 pt are 0.374 mm: refused, never drawn finer or at a lower level.
  test('refuses, with the caption, a payload whose version has modules under 15 mil in its square', () => {
    expect(refused(epc(payloadOf(282), 85.04, 'zahlenMitCode'), 'content-too-large')).toContain('this version 12 code has modules of 0.374 mm')
  })

  test('passes on an encoder error that is not about the payload’s length', () => {
    vi.mocked(encode).mockImplementationOnce(() => {
      throw new RangeError('Invalid value')
    })
    const failed = refusal(() => epcSymbol(epc(V1, 85.04), WIDE))
    expect(failed).toBeInstanceOf(RangeError)
    expect(failed).not.toBeInstanceOf(RenderRefusal)
  })
})
