import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { childrenOf, E_INVOICE_SAMPLES, propertiesOf, readPdf, readPdfObjects, readXmp, starterImages, XMP_NAMESPACES, type PdfObjects, type Starter, type Xmp, type XmlElement } from '@formancy/report-corpus'
import { E_INVOICE_PREVIEW_LABEL, resolveReport, type ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderPdf } from './node.js'
import { bareDocument, paragraph, TIMEOUT } from './testing/documents.js'
import { invoiced } from './testing/e-invoice.js'

/**
 * The e-invoice samples drawn as what an e-invoice is (0031, extending
 * 0027): a PDF/A-3b that embeds the XML the runtime wrote, read back from
 * the PDF the engine produced (0003) by two readers that are not the
 * pdfkit that wrote it -- PDF.js for the pages and the name tree, pdf-lib
 * for the objects -- and its XMP parsed strictly by saxes. Each sample is
 * resolved by the real runtime, in a final render, and drawn through the
 * Node entry; `browser.test.ts` holds the browser entry to the same file
 * and profile.
 *
 * What this cannot show is that a validator takes the PDF: veraPDF and
 * Mustang are the e-invoice gate's.
 */

const CREATED = '2026-10-16T08:00:00Z'

/** The creation date as a PDF date string, as pdfkit writes a `Date` (pdfkit.js 149-150): the file's dates are the document's. */
const PDF_DATE = 'D:20261016080000Z'

/**
 * The fx extension as the transcription of the Factur-X 1.09.2
 * specification gives it in its section 6.3.1 [S], as 0031's Context
 * quotes it, corroborated by akretion's generator and the PDFlib sample it
 * ships, and by Mustang 2.26.0, which reads the four properties by local
 * name and so holds none of their namespace. The transcription's own
 * BR-HYBRID-04 gives the namespace without `:invoice`, an inconsistency it
 * resolves for section 6.3.1, as 0031 says. These are NOT the official ZUGFeRD 2.5.2
 * package's XMP example, which needs a FeRD registration only the owner
 * can make: until it is recorded they rest on [S], as 0031 says. Written
 * here as literals, never read from report-spec's `FACTUR_X`, so that a
 * constant changed there fails here, and a renderer that compared its
 * output with its own constants would compare them with nothing.
 */
const CITED = {
  namespace: 'urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#',
  prefix: 'fx',
  schema: 'Factur-X PDFA Extension Schema',
  properties: { DocumentType: 'INVOICE', DocumentFileName: 'factur-x.xml', Version: '1.0', ConformanceLevel: 'EN 16931' },
} as const

/**
 * The SHA-256 of the ICC's sRGB2014.icc, which pdfkit 0.19.1 ships as
 * `js/data/sRGB_IEC61966_2_1.icc` and embeds as every PDF/A's output
 * profile: the digest the dependency-licence guard's reviewed list holds
 * with the ICC's licence sentence (0006, as 0031 extends it).
 */
const SRGB2014 = '384b832de3412066743b52a75ee906b6fb9fb8d9e09e936fc2c43223815c6e0a'

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

function resolved(sample: Starter, mode: 'final' | 'preview' = 'final'): ResolvedDocument {
  const outcome = resolveReport(sample.report, sample.data, { mode, parameters: sample.parameters, images: starterImages, creationDate: CREATED })
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome.document
}

/** What a sample's PDF says of itself, read once per sample. */
interface Drawn {
  readonly document: ResolvedDocument
  readonly bytes: Uint8Array
  readonly objects: PdfObjects
  readonly xmp: Xmp
}

const drawn = new Map<string, Promise<Drawn>>()
function draw(sample: Starter): Promise<Drawn> {
  let found = drawn.get(sample.id)
  if (found === undefined) {
    found = (async () => {
      const document = resolved(sample)
      const bytes = await renderPdf(document, { maxPages: 5 })
      const objects = await readPdfObjects(bytes)
      if (objects.metadata === undefined) throw new Error(`${sample.id}'s PDF has no XMP`)
      return { document, bytes, objects, xmp: readXmp(objects.metadata.xmp) }
    })()
    drawn.set(sample.id, found)
  }
  return found
}

const samples = E_INVOICE_SAMPLES.map((sample) => [sample.id, sample] as const)

/** The one text of `element`'s child at `steps`, or undefined where there is not exactly one. */
const textAt = (element: XmlElement, ...steps: readonly (readonly [string, string])[]): string | undefined => {
  const found = childrenOf(element, ...steps)
  return found.length === 1 ? found[0]!.text : undefined
}

const { rdf, pdfaid, pdfaExtension, pdfaSchema, pdfaProperty, dc } = XMP_NAMESPACES

describe('an e-invoice sample drawn', () => {
  // In Germany the XML a hybrid invoice embeds is the invoice. A PDF that
  // embedded another file, or this one under another name, as another
  // type, in another relationship, undated, or reachable from one place a
  // reader looks and not the other, is an invoice its receiver's software
  // does not find; one whose bytes were re-encoded on the way -- a BOM
  // added, an umlaut turned into two characters -- is another invoice.
  // Both readers must find the same bytes, and they must be the runtime's
  // XML as UTF-8, exactly.
  test.each(samples)('%s embeds one file, factur-x.xml: the XML as UTF-8 byte for byte, text/xml, Alternative, on the catalog /AF and in the name tree, dated the document', async (_, sample) => {
    const { document, bytes, objects } = await draw(sample)
    const xml = new TextEncoder().encode(document.eInvoice!.xml)
    expect(objects.associatedFiles).toHaveLength(1)
    const [file] = objects.associatedFiles
    expect(file).toMatchObject({ type: 'Filespec', relationship: 'Alternative', f: 'factur-x.xml', uf: 'factur-x.xml', description: 'E-invoice XML, EN 16931' })
    expect(file!.embedded).toMatchObject({ type: 'EmbeddedFile', subtype: 'text/xml', params: { creationDate: PDF_DATE, modDate: PDF_DATE, size: xml.byteLength } })
    expect(Buffer.from(file!.embedded!.bytes).equals(Buffer.from(xml))).toBe(true)
    expect(objects.embeddedFiles.map(({ name, associated }) => ({ name, associated }))).toEqual([{ name: 'factur-x.xml', associated: 0 }])
    const { attachments } = await readPdf(bytes)
    expect(attachments.map(({ name, description }) => ({ name, description }))).toEqual([{ name: 'factur-x.xml', description: 'E-invoice XML, EN 16931' }])
    expect(Buffer.from(attachments[0]!.bytes!).equals(Buffer.from(xml))).toBe(true)
  }, TIMEOUT)

  // A PDF/A-3's XMP is checked by every validator that reads one: not
  // well-formed, it fails veraPDF (6.6.2.1-4); without pdfaid it is no
  // PDF/A; with an fx property no extension schema declares, it fails
  // 6.6.2.3.1; and with the fx properties in another namespace, under
  // another prefix or with other values, it is a Factur-X a receiver's
  // software does not recognise, which no validator in the gate would
  // notice, since Mustang reads them by local name. So each is held to
  // the values the transcription gives, and the schema to declaring exactly
  // those four, each a Text of the external category.
  test.each(samples)('%s states PDF/A-3b and the fx properties the transcription gives, in a well-formed XMP whose extension schema declares them', async (_, sample) => {
    const { objects, xmp } = await draw(sample)
    expect(objects.metadata).toMatchObject({ type: 'Metadata', subtype: 'XML' })
    expect(propertiesOf(xmp, pdfaid, 'part').map(({ text, prefix }) => ({ text, prefix }))).toEqual([{ text: '3', prefix: 'pdfaid' }])
    expect(propertiesOf(xmp, pdfaid, 'conformance').map(({ text }) => text)).toEqual(['B'])
    for (const [name, value] of Object.entries(CITED.properties)) {
      expect(propertiesOf(xmp, CITED.namespace, name).map(({ text, prefix }) => ({ text, prefix })), name).toEqual([{ text: value, prefix: CITED.prefix }])
    }
    expect(xmp.properties.filter(({ uri }) => uri === CITED.namespace).map(({ local }) => local).sort()).toEqual(Object.keys(CITED.properties).sort())

    // One extension schema, the fx one: PDFKit declares none of its own, and a second, incomplete one would fail veraPDF (6.6.2.3.3).
    const schemas = propertiesOf(xmp, pdfaExtension, 'schemas').flatMap((each) => childrenOf(each, [rdf, 'Bag'], [rdf, 'li']))
    expect(schemas).toHaveLength(1)
    const fx = schemas.filter((schema) => textAt(schema, [pdfaSchema, 'namespaceURI']) === CITED.namespace)
    expect(fx).toHaveLength(1)
    expect(textAt(fx[0]!, [pdfaSchema, 'prefix'])).toBe(CITED.prefix)
    expect(textAt(fx[0]!, [pdfaSchema, 'schema'])).toBe(CITED.schema)
    const declared = childrenOf(fx[0]!, [pdfaSchema, 'property'], [rdf, 'Seq'], [rdf, 'li'])
    expect(declared.map((property) => textAt(property, [pdfaProperty, 'name'])).sort()).toEqual(Object.keys(CITED.properties).sort())
    for (const property of declared) {
      expect([textAt(property, [pdfaProperty, 'valueType']), textAt(property, [pdfaProperty, 'category'])]).toEqual(['Text', 'external'])
      expect(textAt(property, [pdfaProperty, 'description'])?.trim()).not.toBe('')
    }
  }, TIMEOUT)

  // The title is passed to pdfmake as in every report, and pdfkit writes
  // it twice: into the information dictionary and, unescaped, into the
  // XMP's dc:title (pdfkit.js 6025-6032). An e-invoice report's title is refused where
  // it would break the XMP (report-spec, and `checkEInvoice` here); one
  // that passed lands in both, the same.
  test.each(samples)('%s titles the PDF in its information dictionary and its dc:title alike', async (_, sample) => {
    const { document, objects, xmp } = await draw(sample)
    expect(objects.info['Title']).toBe(document.info.title)
    const titles = propertiesOf(xmp, dc, 'title').flatMap((title) => childrenOf(title, [rdf, 'Alt'], [rdf, 'li']))
    expect(titles.map(({ text }) => text)).toEqual([document.info.title])
  }, TIMEOUT)

  // A PDF/A draws DeviceRGB only beside an RGB output intent (veraPDF
  // 6.2.4.3-2), and the profile it carries is embedded in every invoice
  // a customer sends: it is the reviewed ICC sRGB2014, byte for byte the
  // file pdfkit reads, which the licence guard admits by this digest.
  // A pdfkit that shipped another profile would fail here and in the
  // guard, before any customer's PDF carried it.
  test.each(samples)('%s carries one sRGB output intent, its profile the reviewed sRGB2014 pdfkit ships, byte for byte', async (_, sample) => {
    const { objects } = await draw(sample)
    expect(objects.outputIntents.map(({ type, s, outputConditionIdentifier, profile }) => ({ type, s, outputConditionIdentifier, n: profile?.n }))).toEqual([
      { type: 'OutputIntent', s: 'GTS_PDFA1', outputConditionIdentifier: 'sRGB IEC61966-2.1', n: 3 },
    ])
    const profile = objects.outputIntents[0]!.profile!.bytes
    expect(sha256(profile)).toBe(SRGB2014)
    const pdfkit = createRequire(createRequire(import.meta.url).resolve('pdfmake')).resolve('pdfkit')
    expect(Buffer.from(profile).equals(readFileSync(path.join(path.dirname(pdfkit), 'data', 'sRGB_IEC61966_2_1.icc')))).toBe(true)
  }, TIMEOUT)

  // pdfkit writes the XMP only at a version above 1.3 (pdfkit.js 6070),
  // and a PDF/A forbids /Encrypt (6.1.3-2): the reader refuses an
  // encrypted PDF, and the bytes hold no trailer key of that name.
  test.each(samples)('%s is a PDF 1.7, unencrypted', async (_, sample) => {
    const { bytes, objects } = await draw(sample)
    expect(objects.version).toBe('1.7')
    expect(Buffer.from(bytes).includes('/Encrypt')).toBe(false)
  }, TIMEOUT)

  // PDF/A-3b is the container, not the page: the same document drawn
  // without its e-invoice prints every run and image where the e-invoice
  // prints it, in the same fonts. Were the subset or the version to move
  // a line, the page a receiver reads would not be the page proved
  // against the XML.
  test.each(samples)('%s prints the very pages it prints drawn plain', async (_, sample) => {
    const { document, bytes } = await draw(sample)
    const { eInvoice: _file, ...plain } = document
    const [invoice, picture] = [await readPdf(bytes), await readPdf(await renderPdf(plain, { maxPages: 5 }))]
    expect(invoice.pages).toEqual(picture.pages)
    expect(invoice.fonts).toEqual(picture.fonts)
    expect(picture.attachments).toEqual([])
  }, TIMEOUT)
})

describe("an e-invoice's title", () => {
  // The renderer refuses a title PDFKit would write into the XMP as
  // something not well-formed (`refusals.test.ts`), and nothing XML 1.0
  // writes as it stands: a tab, a line break, a carriage return, and a
  // character beyond the Basic Multilingual Plane, a surrogate pair in
  // JavaScript. Refused, a template's title of two lines would stop
  // rendering for nothing; drawn, the XMP that holds it parses, and holds
  // it as XML reads it back, a carriage return read as a line feed.
  test('drawn with what XML writes as it stands, lands in a well-formed XMP', async () => {
    const char = (code: number): string => String.fromCodePoint(code)
    const title = `Rechnung${char(0x09)}2026${char(0x0a)}Teil 2 ${char(0x1f9fe)}${char(0x0d)}`
    const document = invoiced({ ...bareDocument('Rechnung', [paragraph('Rechnung')]), info: { title, creationDate: CREATED } })
    const objects = await readPdfObjects(await renderPdf(document, { maxPages: 1 }))
    expect(objects.info['Title']).toBe(title)
    const titles = propertiesOf(readXmp(objects.metadata!.xmp), dc, 'title').flatMap((each) => childrenOf(each, [rdf, 'Alt'], [rdf, 'li']))
    expect(titles.map(({ text }) => text)).toEqual([`Rechnung${char(0x09)}2026${char(0x0a)}Teil 2 ${char(0x1f9fe)}${char(0x0a)}`])
  }, TIMEOUT)
})

describe('a preview of an e-invoice sample', () => {
  // A preview writes no XML (0027): in Germany the embedded XML is the
  // invoice, so a preview is not one, and must not look like one to
  // software either -- no PDF/A, no file, no fx -- nor to a person, who
  // reads on every page that it is not an e-invoice, complete data or not.
  test.each(samples)('%s is a plain PDF that embeds nothing, and says so on every page', async (_, sample) => {
    const document = resolved(sample, 'preview')
    expect(document.eInvoice).toBeUndefined()
    const bytes = await renderPdf(document, { maxPages: 5 })
    const objects = await readPdfObjects(bytes)
    expect(objects).toMatchObject({ version: '1.3', metadata: undefined, associatedFiles: [], embeddedFiles: [], outputIntents: [] })
    const pdf = await readPdf(bytes)
    expect(pdf.attachments).toEqual([])
    expect(pdf.pages.length).toBeGreaterThan(0)
    expect(pdf.pages.map((page) => page.items.some((item) => item.text === E_INVOICE_PREVIEW_LABEL))).toEqual(pdf.pages.map(() => true))
  }, TIMEOUT)
})
