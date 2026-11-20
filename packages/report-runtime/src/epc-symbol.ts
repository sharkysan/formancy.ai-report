import { EPC_MAX_BYTES, EPC_MAX_VERSION, epcCaptionBreak, epcLeastVersion, utf8Length } from '@formancy/report-spec'
import { encode } from 'uqr'
import { RenderRefusal, type EpcQrCode } from './document.js'
import { loneSurrogate, qrSymbolVersion, refuseFineModules, refuseSquare, tooLong, type QrSymbol } from './qr-symbol.js'

/**
 * An EPC QR code's symbol (EPC069-12 v3.1), and what refuses one: decided
 * here once, below every engine, as a QR code's is (`qr-symbol.ts`, 0074).
 * Its payload as UTF-8 at level M, in a symbol of version 13 at most,
 * which an engine encodes once, when it checks the document.
 *
 * Without a caption it is a QR code's symbol, in a square with a quiet
 * zone of four modules inside it, held to the 0.4 mm floor. With
 * Austria's caption it is the PSA's (PSA v3.0 5), by report-spec's
 * `epc-print.ts`, the one place those rules are decided: modules of 15 to
 * 20 mil, and a symbol as tall as the caption beside it. In a square the
 * author sized, the version that just holds a payload may have modules
 * over 20 mil: the symbol is the least version that prints there
 * (`epcLeastVersion`), a larger symbol of the same payload at the same
 * level.
 *
 * Every refusal names the code by its id, and none quotes the payload: it
 * holds a name and an account.
 */

/**
 * `code`'s symbol where it stands `width` points wide, or the refusal
 * that says why it is not drawn: a square of no size, a caption no engine
 * knows, or a payload that is not text, as `unsupported`; a square wider
 * than where it stands, a payload past 331 bytes, refused unencoded when
 * it is longer than that in characters, or modules the square cannot
 * print, as `content-too-large`.
 */
export function epcSymbol(code: EpcQrCode, width: number): QrSymbol {
  const { id, payload, size, caption } = code
  const what = `the EPC QR code ${id}`
  refuseSquare(what, id, size, width)
  if (caption !== undefined && caption !== 'zahlenMitCode')
    throw new RenderRefusal('unsupported', `${what} asks for the caption '${String(caption)}', which a report does not know`, id)
  if (typeof payload !== 'string') throw new RenderRefusal('unsupported', `${what} holds something that is not text`, id)
  const lone = loneSurrogate(payload)
  if (lone !== undefined) throw new RenderRefusal('unsupported', `${what} holds ${lone}, half of a surrogate pair without the other, which has no UTF-8`, id)
  // No character is fewer bytes than code units, so a payload longer than the limit in code units is longer in bytes, and is refused without being encoded.
  if (payload.length > EPC_MAX_BYTES) throw new RenderRefusal('content-too-large', `${what} holds more than the ${EPC_MAX_BYTES} bytes the EPC allows`, id)
  const square = caption === undefined ? undefined : epcCaptionBreak(size)
  if (square !== undefined) throw new RenderRefusal('content-too-large', `${what} cannot be printed as the PSA prints it: ${square}`, id)
  // A size the caption's rules take has a least version (report-spec's epc-print.test.ts holds every one).
  const least = epcLeastVersion(size, caption) as number
  let symbol: QrSymbol
  try {
    symbol = { modules: encode(payload, { ecc: 'M', border: 0, boostEcc: false, minVersion: least, maxVersion: EPC_MAX_VERSION }).data }
  } catch (error) {
    if (!tooLong(error)) throw error
    throw new RenderRefusal(
      'content-too-large',
      `${what} holds ${utf8Length(payload)} bytes, more than version ${EPC_MAX_VERSION} holds at level M, the largest code the EPC allows`,
      id,
    )
  }
  if (caption === undefined) {
    refuseFineModules(symbol, size, what, 'its payload', id)
    return symbol
  }
  const version = epcCaptionBreak(size, qrSymbolVersion(symbol))
  if (version !== undefined) throw new RenderRefusal('content-too-large', `${what} cannot be printed as the PSA prints it: ${version}`, id)
  return symbol
}
