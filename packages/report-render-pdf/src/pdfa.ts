import { FACTUR_X } from '@formancy/report-runtime'
import type { FacturXFile } from '@formancy/report-runtime'

/**
 * An e-invoice drawn as what it is (0031, extending 0027): a PDF/A-3b that
 * embeds the XML the runtime wrote, as `factur-x.xml`, and says so in its
 * XMP. pdfmake takes the PDF/A part of it as two options of the definition
 * (`PDF_A_3B`), and PDFKit writes the rest -- the pdfaid identification,
 * the sRGB output intent and its ICC profile -- as it ends the document.
 * The file and the fx properties have no key in pdfmake's definition, so
 * they are added to PDFKit's document between layout and `end`, the one
 * hook the engines take (`Engine.run`'s `finish`), on the final pass alone.
 *
 * Only a document with an e-invoice is a PDF/A: the version, the subset and
 * the hook are all three its own, and every other report is drawn as it
 * always was (0031 weighs PDF/A for every report, and why not).
 *
 * The renderer decides none of what the file says. The XML is the
 * runtime's, encoded as UTF-8 and changed in nothing; its name, its
 * relationship and the conformance level are the document's, held to
 * report-spec's by `checkEInvoice`; the fx namespace, prefix, document type
 * and version are report-spec's `FACTUR_X`. Only the words that describe
 * the four properties in the extension schema are the renderer's own:
 * PDF/A asks that an extension schema describe each property it declares,
 * and no specification's wording is copied for it.
 */

/**
 * pdfmake's options for a PDF/A-3b. Level b is the one within reach: level
 * a needs a structure tree, which pdfmake does not build, and PDFKit has
 * no level u (pdfkit.js 5320-5332). The version must be given, or PDFKit writes a PDF 1.3
 * with no XMP and says nothing (pdfkit.js 6070; `pdfmake.test.ts`).
 */
export const PDF_A_3B = { version: '1.7', subset: 'PDF/A-3b' } as const

/** What `file` takes in PDFKit 0.19.1 (pdfkit.js 5160-5244): `relationship` among it, which @types/pdfkit 0.17.6 leaves out (`pdfmake.test.ts` pins it). */
export interface PdfKitFileOptions {
  readonly name: string
  /** The media type, written as the stream's /Subtype. */
  readonly type: string
  readonly description: string
  /** Written as the file specification's /AFRelationship. */
  readonly relationship: string
  readonly creationDate: Date
  readonly modifiedDate: Date
}

/**
 * PDFKit's document as pdfmake's `getStream` hands it over in either build,
 * laid out and not yet ended: the two of its methods an e-invoice adds
 * through, typed here at the boundary rather than through @types/pdfkit,
 * whose `file` options lack the relationship.
 */
export interface PdfKitDocument {
  /** `src` an ArrayBuffer: a typed array that is not a Node Buffer falls through to `fs.readFileSync(src)` (pdfkit.js 5172-5184). */
  file(src: ArrayBuffer, options: PdfKitFileOptions): unknown
  appendXML(xml: string): unknown
}

/** What acts on PDFKit's document between layout and `end`: the final pass's alone. */
export type Finish = (document: PdfKitDocument) => void

/**
 * The hook that makes the final pass's PDF the e-invoice: `file` embedded,
 * dated `created`, the document's own creation date -- so that the same
 * document renders to the same bytes, and no file system's clock reaches
 * the PDF: PDFKit dates a file it reads from a path by `fs.statSync`, and
 * one it is handed by nothing but these options (pdfkit.js 5184-5200) --
 * and the fx properties appended to the XMP.
 */
export function embedEInvoice(file: FacturXFile, created: Date): Finish {
  const xml = exactBuffer(new TextEncoder().encode(file.xml))
  const description = `E-invoice XML, ${file.conformanceLevel}`
  return (document) => {
    document.file(xml, {
      name: file.fileName,
      type: FACTUR_X.mediaType,
      description,
      relationship: file.relationship,
      creationDate: created,
      modifiedDate: created,
    })
    document.appendXML(facturXmp(file))
  }
}

/** The ArrayBuffer of exactly `bytes`: an encoder's view may sit in a larger buffer, all of which PDFKit would embed. */
function exactBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

/**
 * The extension schemas' own namespaces: the container's as veraPDF's rule
 * 6.6.2.3.3-1 names it, and the schema's and the property's as akretion's
 * factur-x and PDFlib's sample extension schema write them [S], which
 * veraPDF 1.30.3's 6.6.2.3.3 rules pass (0031; report-corpus's
 * `XMP_NAMESPACES` says the same).
 */
const PDFA_EXTENSION = 'http://www.aiim.org/pdfa/ns/extension/'
const PDFA_SCHEMA = 'http://www.aiim.org/pdfa/ns/schema#'
const PDFA_PROPERTY = 'http://www.aiim.org/pdfa/ns/property#'

/**
 * The extension schema's name, as the Factur-X specification gives it in
 * its section 6.3.1 [S], as 0031 gives it: a name, the one item here not a value, and
 * one no validator in the gate reads.
 */
const SCHEMA_NAME = 'Factur-X PDFA Extension Schema'

/** The four fx properties, each with its description: the renderer's own words, a Text of the external category, as PDF/A has an extension schema declare a property (6.6.2.3.3). */
const PROPERTIES = [
  ['DocumentFileName', 'The name under which this PDF embeds the invoice as XML'],
  ['DocumentType', 'What kind of business document the embedded XML is'],
  ['Version', 'The version of the hybrid format this PDF and its XML follow'],
  ['ConformanceLevel', 'The profile the embedded XML conforms to'],
] as const

/** Text as XML writes it between tags and in a double-quoted attribute. Every value here is report-spec's or checked against it, and is escaped all the same. */
const escaped = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The fx description and the extension schema that declares its four
 * properties, as two `rdf:Description`s PDFKit puts into the packet before
 * its own (pdfkit.js 6011-6013). Without the schema, veraPDF fails the
 * properties (6.6.2.3.1-1, -2).
 */
function facturXmp(file: FacturXFile): string {
  const fx = FACTUR_X.xmpPrefix
  const values: Readonly<Record<(typeof PROPERTIES)[number][0], string>> = {
    DocumentFileName: file.fileName,
    DocumentType: FACTUR_X.documentType,
    Version: FACTUR_X.version,
    ConformanceLevel: file.conformanceLevel,
  }
  const property = ([name, description]: (typeof PROPERTIES)[number]): string =>
    `<rdf:li rdf:parseType="Resource"><pdfaProperty:name>${name}</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>${escaped(description)}</pdfaProperty:description></rdf:li>`
  return [
    `<rdf:Description rdf:about="" xmlns:${fx}="${escaped(FACTUR_X.xmpNamespace)}">`,
    ...PROPERTIES.map(([name]) => `<${fx}:${name}>${escaped(values[name])}</${fx}:${name}>`),
    '</rdf:Description>',
    `<rdf:Description rdf:about="" xmlns:pdfaExtension="${PDFA_EXTENSION}" xmlns:pdfaSchema="${PDFA_SCHEMA}" xmlns:pdfaProperty="${PDFA_PROPERTY}">`,
    '<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">',
    `<pdfaSchema:schema>${SCHEMA_NAME}</pdfaSchema:schema>`,
    `<pdfaSchema:namespaceURI>${escaped(FACTUR_X.xmpNamespace)}</pdfaSchema:namespaceURI>`,
    `<pdfaSchema:prefix>${fx}</pdfaSchema:prefix>`,
    `<pdfaSchema:property><rdf:Seq>${PROPERTIES.map(property).join('')}</rdf:Seq></pdfaSchema:property>`,
    '</rdf:li></rdf:Bag></pdfaExtension:schemas>',
    '</rdf:Description>',
  ].join('\n')
}
