import { FACTUR_X, FACTUR_X_PROFILES, RenderRefusal } from '@formancy/report-runtime'

/**
 * The e-invoice a document carries (0027): the XML the runtime wrote from
 * the values the page prints, and what to embed it as -- the file's name,
 * its relationship to the PDF and the conformance level the PDF's XMP
 * states, report-spec's `FACTUR_X` and `FACTUR_X_PROFILES` handed on by the
 * runtime. The renderer decides none of them, and writes nothing of the XML.
 *
 * **This release draws none.** An e-invoice is drawn as a PDF/A-3 with its
 * XML embedded, and the renderer writes no PDF/A-3 yet. In Germany the
 * embedded XML of a hybrid invoice is the invoice, so a plain PDF of one
 * would be a picture of an invoice without the invoice, handed over as
 * though it were one. Every document with an e-invoice is refused as
 * `unsupported`, in both entries, before pdfmake sees it.
 *
 * **What it does not know it refuses first**, for that: a file it is not
 * handed as one, XML that is not text, a name, a conformance level or a
 * relationship that is not report-spec's. A file from a runtime that names
 * it otherwise would be embedded as something its reader does not look
 * for; refused for being unknown, it stays refused once e-invoices are
 * drawn. A refusal names what is unknown, never a value: the XML holds
 * people's names, accounts and VAT identifiers.
 */
export function refuseEInvoice(file: unknown): never {
  const refusal = (message: string): RenderRefusal => new RenderRefusal('unsupported', message, 'eInvoice')
  if (typeof file !== 'object' || file === null) throw refusal('the e-invoice is not a file the renderer knows')
  const { xml, fileName, relationship, conformanceLevel } = file as Record<string, unknown>
  if (typeof xml !== 'string') throw refusal("the e-invoice's XML is not text")
  if (fileName !== FACTUR_X.fileName) throw refusal('the e-invoice is embedded under a file name the renderer does not know')
  // Each profile's own terms, by value: a lookup by the level's name would find 'constructor' on every object.
  const profile = Object.values(FACTUR_X_PROFILES).find((each) => each.conformanceLevel === conformanceLevel)
  if (profile === undefined) throw refusal('the e-invoice states a conformance level the renderer does not know')
  if (relationship !== profile.relationship) throw refusal('the e-invoice is related to the PDF otherwise than a file of its conformance level is')
  throw refusal('an e-invoice is drawn as PDF/A-3, which this release does not do')
}
