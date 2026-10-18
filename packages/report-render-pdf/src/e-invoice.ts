import { FACTUR_X, FACTUR_X_PROFILES, RenderRefusal } from '@formancy/report-runtime'
import type { EInvoiceFile } from '@formancy/report-runtime'

/**
 * The e-invoice a document carries (0027): the XML the runtime wrote from
 * the values the page prints, and what to embed it as -- the file's name,
 * its relationship to the PDF and the conformance level the PDF's XMP
 * states, report-spec's `FACTUR_X` and `FACTUR_X_PROFILES` handed on by the
 * runtime. The renderer decides none of them, and writes nothing of the XML:
 * it draws the document as a PDF/A-3b that embeds the file (`pdfa.ts`,
 * 0031).
 *
 * **What it does not know it refuses**, before pdfmake sees the document:
 * a file it is not handed as one, XML that is not text or that holds a
 * lone surrogate, which UTF-8 cannot encode as it stands, and a name, a
 * conformance level or a relationship that is not report-spec's. A file
 * from a runtime that names it otherwise would be embedded as something
 * its reader does not look for. A refusal names what is unknown, never a
 * value: the XML holds people's names, accounts and VAT identifiers.
 */

/** `file`, once the renderer knows it: report-spec's name, one of its profiles' conformance levels, and that profile's relationship. */
export function checkEInvoice(file: unknown): EInvoiceFile {
  const refusal = (message: string): RenderRefusal => new RenderRefusal('unsupported', message, 'eInvoice')
  if (typeof file !== 'object' || file === null) throw refusal('the e-invoice is not a file the renderer knows')
  const { xml, fileName, relationship, conformanceLevel } = file as Record<string, unknown>
  if (typeof xml !== 'string') throw refusal("the e-invoice's XML is not text")
  // An encoder writes U+FFFD for a lone surrogate without a word: the PDF would embed other bytes than the runtime wrote.
  if (LONE_SURROGATE.test(xml)) throw refusal("the e-invoice's XML holds a lone surrogate, which UTF-8 cannot encode as it stands")
  if (fileName !== FACTUR_X.fileName) throw refusal('the e-invoice is embedded under a file name the renderer does not know')
  // Each profile's own terms, by value: a lookup by the level's name would find 'constructor' on every object.
  const profile = Object.values(FACTUR_X_PROFILES).find((each) => each.conformanceLevel === conformanceLevel)
  if (profile === undefined) throw refusal('the e-invoice states a conformance level the renderer does not know')
  if (relationship !== profile.relationship) throw refusal('the e-invoice is related to the PDF otherwise than a file of its conformance level is')
  return { xml, fileName, relationship: profile.relationship, conformanceLevel: profile.conformanceLevel }
}

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

/**
 * Refuses an e-invoice's title that PDFKit cannot write into the PDF/A's
 * XMP: it puts the title into `dc:title` as it stands, unescaped (pdfkit.js
 * 6025-6032; `pdfmake.test.ts` holds it), so an ampersand or an angle
 * bracket, or a character XML 1.0 cannot write, leaves the XMP not
 * well-formed -- a PDF that says it is a PDF/A and is not one (veraPDF
 * 6.6.2.1-4). report-spec refuses such a title in an e-invoice report, so
 * a report the runtime resolved never reaches this; a document made
 * otherwise is refused here, naming the title and not quoting it. The
 * information dictionary would hold it as written, and in a report that is
 * no e-invoice it reaches no XMP and is drawn.
 */
export function checkEInvoiceTitle(title: string): void {
  if (/[&<>]/.test(title) || [...title].some((character) => !xmlCharacter(character.codePointAt(0)!))) {
    throw new RenderRefusal('unsupported', "an e-invoice's title is written into its PDF/A's XMP as it stands, where it may hold no &, < or > and no character XML 1.0 cannot write: this one does", 'info.title')
  }
}

/** XML 1.0's Char: tab, line feed and carriage return, and every code point from U+0020 but the surrogates, U+FFFE and U+FFFF. A lone surrogate is read as its own code point, and is none. */
function xmlCharacter(code: number): boolean {
  return code === 0x9 || code === 0xa || code === 0xd || (code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code <= 0x10ffff)
}
