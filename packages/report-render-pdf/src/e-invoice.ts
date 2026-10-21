import { FACTUR_X, FACTUR_X_PROFILES, RenderRefusal, XRECHNUNG, XRECHNUNG_COPY_PARAGRAPH, XRECHNUNG_VERSIONS } from '@formancy/report-runtime'
import type { Block, EInvoiceFile, FacturXFile, XRechnungFile } from '@formancy/report-runtime'

/**
 * The e-invoice a document carries (0027), by its kind: the XML the runtime
 * wrote from the values the page prints, and what it is. A Factur-X file
 * says what to embed it as -- the file's name, its relationship to the PDF
 * and the conformance level the PDF's XMP states, report-spec's `FACTUR_X`
 * and `FACTUR_X_PROFILES` handed on by the runtime -- and is drawn as a
 * PDF/A-3b that embeds it (`pdfa.ts`, 0031). An XRechnung's says its
 * syntax, guideline and version, report-spec's `XRECHNUNG`: its XML is the
 * invoice a host sends, and its document is drawn as a plain PDF, the copy,
 * labelled so on every page by the runtime (0038). The renderer decides
 * none of them, and writes nothing of the XML.
 *
 * **What it does not know it refuses**, before pdfmake sees the document:
 * a file it is not handed as one, of a kind it does not know, XML that is
 * not text or that holds a lone surrogate, which UTF-8 cannot encode as it
 * stands, a name, a conformance level, a relationship, a syntax, a
 * guideline or a version that is not report-spec's, and an XRechnung whose
 * pages are not labelled as the copy in the runtime's own paragraph. A
 * file from a runtime that names it otherwise would be embedded as
 * something its reader does not look for, or drawn as something it is
 * not. A refusal names what is unknown, never a value: the XML holds
 * people's names, accounts and VAT identifiers.
 */

const refusal = (message: string): RenderRefusal => new RenderRefusal('unsupported', message, 'eInvoice')

/** A Factur-X file, once the renderer knows it: report-spec's name, one of its profiles' conformance levels, and that profile's relationship. */
function checkFacturX(file: Record<string, unknown>, xml: string): FacturXFile {
  const { fileName, relationship, conformanceLevel } = file
  if (fileName !== FACTUR_X.fileName) throw refusal('the e-invoice is embedded under a file name the renderer does not know')
  // Each profile's own terms, by value: a lookup by the level's name would find 'constructor' on every object.
  const profile = Object.values(FACTUR_X_PROFILES).find((each) => each.conformanceLevel === conformanceLevel)
  if (profile === undefined) throw refusal('the e-invoice states a conformance level the renderer does not know')
  if (relationship !== profile.relationship) throw refusal('the e-invoice is related to the PDF otherwise than a file of its conformance level is')
  return { kind: 'facturX', xml, fileName, relationship: profile.relationship, conformanceLevel: profile.conformanceLevel }
}

/** An XRechnung's file, once the renderer knows it: one of report-spec's versions, and that version's syntax and guideline. */
function checkXRechnung(file: Record<string, unknown>, xml: string): XRechnungFile {
  const { syntax, guideline, version } = file
  // A version by the list, never by a lookup that would find 'constructor' on every object.
  const known = XRECHNUNG_VERSIONS.find((each) => each === version)
  if (known === undefined) throw refusal('the XRechnung is of a version the renderer does not know')
  const terms = XRECHNUNG[known]
  if (syntax !== terms.syntax) throw refusal('the XRechnung is written in a syntax the renderer does not know')
  if (guideline !== terms.guideline) throw refusal('the XRechnung names another specification identifier than its version has')
  return { kind: 'xrechnung', xml, syntax: terms.syntax, guideline: terms.guideline, version: known }
}

/** `file`, once the renderer knows it: its XML text an encoder writes as it stands, and its kind's terms report-spec's. */
export function checkEInvoice(file: unknown): EInvoiceFile {
  if (typeof file !== 'object' || file === null) throw refusal('the e-invoice is not a file the renderer knows')
  const { kind, xml } = file as Record<string, unknown>
  if (typeof xml !== 'string') throw refusal("the e-invoice's XML is not text")
  // An encoder writes U+FFFD for a lone surrogate without a word: the PDF would embed other bytes than the runtime wrote.
  if (LONE_SURROGATE.test(xml)) throw refusal("the e-invoice's XML holds a lone surrogate, which UTF-8 cannot encode as it stands")
  if (kind === 'facturX') return checkFacturX(file as Record<string, unknown>, xml)
  if (kind === 'xrechnung') return checkXRechnung(file as Record<string, unknown>, xml)
  throw refusal('the e-invoice is of a kind the renderer does not know')
}

/**
 * Refuses an XRechnung's document whose page header does not open with the
 * runtime's label paragraph, `XRECHNUNG_COPY_PARAGRAPH`, as the runtime
 * writes it: its text, `XRECHNUNG_COPY_LABEL`, the one run, at its size,
 * bold and in its colour, and nothing else. The page header repeats on
 * every page, so the label opening it is on every page, and no block of
 * the header's is drawn over another: blocks flow. A copy drawn without it
 * would be a final picture of an invoice that says nothing of what it is
 * (0038), and so would one whose label is drawn in white or at one point,
 * where PDF.js still finds the text. The runtime writes it; a document
 * made otherwise, or by a runtime that forgot, is refused here. What this
 * does not see: the label names no font, and prints in the renderer's
 * default, and the paper is white because the renderer draws none.
 */
export function checkCopyLabel(pageHeader: readonly Block[]): void {
  if (!samePlain(pageHeader[0], XRECHNUNG_COPY_PARAGRAPH)) {
    throw new RenderRefusal('unsupported', "an XRechnung's PDF is a copy of its XML, labelled so at the top of every page, and this document's page header does not open with the label as the runtime writes it", 'pageHeader')
  }
}

/** Whether two values of a resolved document are the same data: equal primitives, or two arrays, or two objects that are not, of the same keys holding the same values. */
function samePlain(a: unknown, b: unknown): boolean {
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return a === b
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const [left, right] = [Object.keys(a), Object.keys(b)]
  return left.length === right.length && left.every((key) => right.includes(key) && samePlain((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
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
