import { encode } from 'uqr'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { RenderRefusal, type QrCode } from './document.js'
import { QR_MAX_CHARACTERS, QR_MIN_MODULE, QR_QUIET_ZONE, qrSymbol, qrSymbolVersion, SWISS_QR_MAX_CHARACTERS, swissSymbol, type QrSymbol } from './qr-symbol.js'

/**
 * What decides a QR code's symbol, and what refuses one (0020, 0022), where
 * every engine reads it (0074): held here on the symbol itself -- its
 * modules a side, which are its version's, and the level its format
 * information states -- and on each refusal's code, subject and words.
 * What the symbol says to a scanner is proved where it is drawn: on the
 * PDF by report-render-pdf's `qr.test.ts`, and on the Word file by
 * report-render-docx's `codes.test.ts`, each with ZXing.
 */

// Every call to the encoder, counted, and passed through to it: text
// refused for its length is refused before it costs an encoding.
vi.mock('uqr', async (importOriginal) => {
  const actual = await importOriginal<typeof import('uqr')>()
  return { ...actual, encode: vi.fn(actual.encode) }
})
beforeEach(() => {
  vi.mocked(encode).mockClear()
})

function qr(text: string, size: number, errorCorrection: QrCode['errorCorrection'] = 'M', id = 'payment-code'): QrCode {
  return { kind: 'qrCode', id, text, size, errorCorrection }
}

/** Wide enough for any square a case here asks for. */
const WIDE = 1000

function refusal(make: () => unknown): unknown {
  try {
    make()
  } catch (error) {
    return error
  }
  return 'drawn'
}

/**
 * The level a symbol states, read from its format information beside the
 * top left finder pattern (ISO/IEC 18004, 7.9): its two highest bits, at
 * the first two modules of row 8, under the mask 101010000010010, whose
 * own two highest are 1 and 0. The standard numbers the levels 01, 00,
 * 11 and 10 for L, M, Q and H.
 */
function levelOf(symbol: QrSymbol): string {
  const bits = (Number(symbol.modules[8]![0]) ^ 1) * 2 + Number(symbol.modules[8]![1])
  return ['M', 'L', 'H', 'Q'][bits]!
}

/**
 * The bytes of `text` in UTF-8, counted here by each character's code
 * point: one below U+0080, two below U+0800, three below U+10000 and
 * four from there. The suite compiles with neither Node's types nor the
 * DOM's, as the package does, so it has no `TextEncoder`; and a count of
 * its own is not the rule's.
 */
const utf8 = (text: string): number =>
  [...text].reduce((bytes, character) => {
    const point = character.codePointAt(0)!
    return bytes + (point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4)
  }, 0)

describe('a QR code’s symbol', () => {
  // A symbol with a border of its own would be drawn inside a second quiet
  // zone, its modules smaller than the floor was held to; one that is not
  // square, or not its version's side, is no symbol a scanner reads.
  test('is a square of its version’s modules, without a quiet zone: the finder pattern stands in its corner', () => {
    const symbol = qrSymbol(qr('https://formancy.ai/report/', 120), WIDE)
    const side = symbol.modules.length
    expect(symbol.modules.every((row) => row.length === side)).toBe(true)
    expect((side - 17) % 4).toBe(0)
    expect(qrSymbolVersion(symbol)).toBe((side - 17) / 4)
    // The finder pattern's outer ring is dark along the symbol's first row and column, and its inner ring light.
    expect(symbol.modules[0]!.slice(0, 7)).toEqual(Array.from({ length: 7 }, () => true))
    expect(symbol.modules.slice(0, 7).map((row) => row[0])).toEqual(Array.from({ length: 7 }, () => true))
    expect(symbol.modules[1]!.slice(1, 6)).toEqual(Array.from({ length: 5 }, () => false))
  })

  // uqr can raise the level to the highest the version it chose still
  // holds (`boostEcc`), which prints a code at another level than the
  // report asks for. Version 1 holds 17, 14, 11 and 7 bytes at L, M, Q and
  // H: twelve bytes at L fit M's 14, nine at M fit Q's 11, five at Q fit
  // H's 7, and each is drawn at the level it asks for.
  test.each([
    ['L', 'twelve bytes'],
    ['M', 'nine char'],
    ['Q', 'five!'],
    ['H', 'seven b'],
  ] as const)('keeps level %s, in the smallest version that holds the text', (level, text) => {
    const symbol = qrSymbol(qr(text, 60, level), WIDE)
    expect(levelOf(symbol)).toBe(level)
    expect(qrSymbolVersion(symbol)).toBe(1)
  })

  // A version larger than the text needs has finer modules in its square
  // than it must: fourteen bytes are version 1 at M, and fifteen version 2.
  test('takes the next version only once the text no longer fits', () => {
    expect(qrSymbolVersion(qrSymbol(qr('x'.repeat(14), 60), WIDE))).toBe(1)
    expect(qrSymbolVersion(qrSymbol(qr('x'.repeat(15), 60), WIDE))).toBe(2)
  })

  // A preview hands on a code whose content resolved to nothing: refused,
  // the whole preview would fail where its paragraphs print nothing.
  test('encodes empty text as a version 1 symbol of no data', () => {
    expect(qrSymbolVersion(qrSymbol(qr('', 60), WIDE))).toBe(1)
  })

  // One symbol for a check and a drawing is one decision; a second encoding is a second.
  test('encodes the text once', () => {
    qrSymbol(qr('INV-2026-0042', 60), WIDE)
    expect(encode).toHaveBeenCalledTimes(1)
  })
})

describe('what a QR code is refused by', () => {
  // A square of no size draws nothing, or everything; wider than where it
  // stands, it runs into the next column or past the margin. Both engines
  // ask here, so both say it in these words.
  test.each([
    ['of no size', 0],
    ['of a size that is not a number', Number.NaN],
    ['of an endless size', Number.POSITIVE_INFINITY],
    ['of a negative size', -60],
  ])('refuses a square %s as unsupported, unencoded', (_, size) => {
    const refused = refusal(() => qrSymbol(qr('A', size), WIDE))
    expect(refused).toBeInstanceOf(RenderRefusal)
    expect(refused).toMatchObject({ code: 'unsupported', subject: 'payment-code', message: `the QR code payment-code is drawn ${size} pt a side` })
    expect(encode).not.toHaveBeenCalled()
  })

  test('refuses a square wider than where it stands, naming both widths, and draws one exactly as wide', () => {
    expect(refusal(() => qrSymbol(qr('A', 120.5), 120))).toMatchObject({
      code: 'content-too-large',
      subject: 'payment-code',
      message: 'the QR code payment-code is 120.5 pt wide; it stands 120.00 pt wide',
    })
    expect(encode).not.toHaveBeenCalled()
    expect(qrSymbolVersion(qrSymbol(qr('A', 120), 120))).toBe(1)
  })

  // What no encoder can draw as written.
  test.each([
    ['a level the standard does not have', { ...qr('A', 60), errorCorrection: 'X' as 'L' }, "asks for the error correction level 'X'"],
    ['text that is not a string', { ...qr('A', 60), text: ['A'] as unknown as string }, 'encodes something that is not text'],
    ['a lone half of a surrogate pair', qr('receipt \uD83E', 60), 'holds U+D83E, half of a surrogate pair'],
  ])('refuses %s as unsupported', (_, code, words) => {
    expect(refusal(() => qrSymbol(code, WIDE))).toMatchObject({ code: 'unsupported', subject: 'payment-code', message: expect.stringContaining(words) })
    expect(encode).not.toHaveBeenCalled()
  })

  // Encoding takes time and memory with the length of the text, and a
  // field's value can be any length: text longer than any code holds is
  // refused without being encoded. A character is a code point: 7090
  // receipts are 14180 code units and 7090 characters, and 3600 of them,
  // more code units than the cap and fewer characters, are refused for
  // their bytes, by the encoder.
  test('refuses text past the most any version holds, unencoded, counting an emoji as one character', () => {
    expect(QR_MAX_CHARACTERS).toBe(7089)
    for (const text of ['1'.repeat(7090), '\u{1F9FE}'.repeat(7090)]) {
      expect(refusal(() => qrSymbol(qr(text, 300, 'L'), WIDE))).toMatchObject({
        code: 'content-too-large',
        subject: 'payment-code',
        message: 'the QR code payment-code holds 7090 characters; no QR code holds more than 7089',
      })
    }
    expect(encode).not.toHaveBeenCalled()
    expect(refusal(() => qrSymbol(qr('\u{1F9FE}'.repeat(3600), 300, 'L'), WIDE))).toMatchObject({
      code: 'content-too-large',
      message: `the QR code payment-code holds ${4 * 3600} bytes of text, more than a QR code at level L holds`,
    })
    expect(encode).toHaveBeenCalledTimes(1)
  })

  // The bytes a refusal names are the text's in UTF-8, as the encoder
  // writes them: an umlaut two, the euro sign three.
  test('refuses text no version holds at its level, naming its bytes in UTF-8', () => {
    const text = `${'ü'.repeat(636)}€`
    expect(utf8(text)).toBe(1275)
    expect(refusal(() => qrSymbol(qr(text, 300, 'H'), WIDE))).toMatchObject({
      code: 'content-too-large',
      subject: 'payment-code',
      message: 'the QR code payment-code holds 1275 bytes of text, more than a QR code at level H holds',
    })
  })

  // Modules finer than a printer and a scanner resolve make a code that
  // does not scan: the floor is 0.4 mm, SIX's figure for print, and the
  // refusal names the square the text needs, rounded up so that the size
  // it names is one that is drawn.
  test('refuses a square too small for its text, and draws one whose modules are exactly the smallest', () => {
    expect(QR_MIN_MODULE).toBeCloseTo((0.4 * 72) / 25.4, 12)
    expect(QR_QUIET_ZONE).toBe(4)
    const text = 'https://formancy.ai/report/'
    const across = qrSymbol(qr(text, 150), WIDE).modules.length + 2 * QR_QUIET_ZONE
    const smallest = across * QR_MIN_MODULE
    expect(qrSymbol(qr(text, smallest), WIDE).modules).toHaveLength(across - 8)
    const refused = refusal(() => qrSymbol(qr(text, smallest - 0.01), WIDE))
    expect(refused).toMatchObject({ code: 'content-too-large', subject: 'payment-code' })
    expect((refused as Error).message).toBe(
      `the QR code payment-code is ${smallest - 0.01} pt a side, which makes the ${across} modules across its symbol and quiet zone ${((smallest - 0.01) / across).toFixed(2)} pt each; the smallest module is 0.4 mm (1.13 pt), so its text needs a square of at least ${(Math.ceil(smallest * 100) / 100).toFixed(2)} pt`,
    )
  })

  // The encoder failing for any other reason than text too long is the
  // engine failing, and said so, never a report refused for its length.
  test('passes on an encoder error that is not about the text’s length', () => {
    vi.mocked(encode).mockImplementationOnce(() => {
      throw new RangeError('Invalid value')
    })
    const failed = refusal(() => qrSymbol(qr('A', 60), WIDE))
    expect(failed).toBeInstanceOf(RangeError)
    expect(failed).not.toBeInstanceOf(RenderRefusal)
  })
})

describe('a QR-bill’s Swiss QR Code', () => {
  // SIX: level M (IG 6.1), version 25 at most (6.2), which is 117 modules
  // a side and holds 997 bytes. A code at another level, or in a larger
  // version, is one a bank's reader need not take.
  test('is encoded at level M, in the smallest version that holds it, up to version 25', () => {
    const short = swissSymbol('SPC\n0200\n1')
    expect(levelOf(short)).toBe('M')
    expect(qrSymbolVersion(short)).toBe(1)
    expect(SWISS_QR_MAX_CHARACTERS).toBe(997)
    const most = swissSymbol('x'.repeat(997))
    expect(levelOf(most)).toBe('M')
    expect(most.modules).toHaveLength(117)
  })

  // Every refusal names the payment part, and none quotes the payload: it holds names and accounts.
  test.each([
    ['something that is not text', 42, 'unsupported', 'holds something that is not text'],
    ['half of a surrogate pair', 'SPC\uDC00', 'unsupported', 'holds U+DC00, half of a surrogate pair'],
    ['more characters than SIX allows', 'x'.repeat(998), 'content-too-large', 'holds 998 characters; SIX allows 997'],
  ] as const)('refuses %s, unencoded', (_, payload, code, words) => {
    const refused = refusal(() => swissSymbol(payload))
    expect(refused).toBeInstanceOf(RenderRefusal)
    expect(refused).toMatchObject({ code, subject: 'paymentPart', message: expect.stringContaining(`the payment part's Swiss QR Code ${words}`) })
    expect(encode).not.toHaveBeenCalled()
  })

  // 500 umlauts are 500 characters and 1000 bytes: within SIX's count, and more than version 25 holds, which only the encoder finds.
  test('refuses a payload whose bytes no version up to 25 holds, once it is encoded', () => {
    expect(refusal(() => swissSymbol('ü'.repeat(500)))).toMatchObject({
      code: 'content-too-large',
      subject: 'paymentPart',
      message: "the payment part's Swiss QR Code holds 1000 bytes, more than version 25 holds at level M, the largest code SIX allows",
    })
    expect(encode).toHaveBeenCalledTimes(1)
  })

  test('passes on an encoder error that is not about the payload’s length', () => {
    vi.mocked(encode).mockImplementationOnce(() => {
      throw new RangeError('Invalid value')
    })
    expect(refusal(() => swissSymbol('SPC'))).not.toBeInstanceOf(RenderRefusal)
  })
})
