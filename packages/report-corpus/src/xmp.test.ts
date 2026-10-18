import { describe, expect, test } from 'vitest'
import { readPdfObjects } from './objects.js'
import { pdfmakePdf, type PdfKitDocument } from './testing/pdfmake.js'
import { childrenOf, propertiesOf, readXmp, XMP_NAMESPACES, type Xmp } from './xmp.js'

/**
 * The XMP of PDFs pdfkit writes here, read strictly: saxes 6.0.0, every
 * prefix resolved to its namespace, the packet refused where it is not
 * well-formed. What is appended to pdfkit's packet is what a renderer's
 * hook appends, a description and the extension schema that describes it.
 */

const { rdf, xml, pdfaid, pdfaExtension, pdfaSchema, pdfaProperty, dc, xmp: xap } = XMP_NAMESPACES
/** A namespace of the test's own, ending in `#` as Factur-X's does. */
const TEST = 'urn:formancy:corpus:test#'

/** The XMP packet of the PDF/A-3b pdfkit writes for `finish`'s additions and `title`. */
async function packet(finish?: (document: PdfKitDocument) => void, title?: string): Promise<string> {
  const bytes = await pdfmakePdf({ version: '1.7', subset: 'PDF/A-3b', content: [{ text: 'PDF/A' }], ...(title === undefined ? {} : { info: { title } }) }, finish)
  return (await readPdfObjects(bytes)).metadata!.xmp
}

const appended = (description: string) => (document: PdfKitDocument) => document.appendXML(description)
const texts = (read: Xmp, uri: string, local: string): string[] => propertiesOf(read, uri, local).map(({ text }) => text)

/** A description in the test's namespace, and the extension schema that describes its two properties, as a PDF/A-3 needs (veraPDF 6.6.2.3.1). */
const DESCRIBED = `<rdf:Description rdf:about="" xmlns:ct="${TEST}"><ct:Level>EN 16931</ct:Level><ct:Version>1.0</ct:Version></rdf:Description>
<rdf:Description rdf:about="" xmlns:pdfaExtension="${pdfaExtension}" xmlns:pdfaSchema="${pdfaSchema}" xmlns:pdfaProperty="${pdfaProperty}">
<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">
<pdfaSchema:schema>Corpus test schema</pdfaSchema:schema><pdfaSchema:namespaceURI>${TEST}</pdfaSchema:namespaceURI><pdfaSchema:prefix>ct</pdfaSchema:prefix>
<pdfaSchema:property><rdf:Seq>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>Level</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>a level</pdfaProperty:description></rdf:li>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>Version</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>a version</pdfaProperty:description></rdf:li>
</rdf:Seq></pdfaSchema:property>
</rdf:li></rdf:Bag></pdfaExtension:schemas>
</rdf:Description>`

describe('readXmp', () => {
  // pdfkit's own descriptions are what a PDF/A-3b states of itself: part 3,
  // level B, the title as a language alternative, the creation date. Read
  // by namespace, they are what veraPDF reads (6.6.4-2, 6.6.4-3); a reader
  // that took the first `<pdfaid:part>` it met by its text would read a
  // packet with another namespace under that prefix as PDF/A.
  test("reads pdfkit's packet for a PDF/A-3b: the identification, the title in its language alternative, the creation date", async () => {
    const read = readXmp(await packet())
    expect(texts(read, pdfaid, 'part')).toEqual(['3'])
    expect(texts(read, pdfaid, 'conformance')).toEqual(['B'])
    expect(propertiesOf(read, pdfaid, 'part').map(({ prefix }) => prefix)).toEqual(['pdfaid'])
    const [title] = propertiesOf(read, dc, 'title')
    expect(childrenOf(title!, [rdf, 'Alt'], [rdf, 'li'])).toMatchObject([{ text: 'corpus test', attributes: [{ uri: xml, local: 'lang', value: 'x-default' }] }])
    expect(texts(read, xap, 'CreateDate')).toEqual(['2026-01-01T00:00:00Z'])
  })

  // What a renderer appends is read as a validator reads it: each property
  // by its namespace and local name, the extension schema's fields at the
  // depth PDF/A puts them, and the prefix each was written with, which
  // PDF/A fixes for its own schemas and the extension schema states for
  // the rest (veraPDF 6.6.2.3.3).
  test("reads a description appended to pdfkit's packet, and the extension schema that describes it, by namespace and with each prefix", async () => {
    const read = readXmp(await packet(appended(DESCRIBED)))
    expect(propertiesOf(read, TEST, 'Level')).toMatchObject([{ prefix: 'ct', text: 'EN 16931' }])
    expect(texts(read, TEST, 'Version')).toEqual(['1.0'])
    const [schemas] = propertiesOf(read, pdfaExtension, 'schemas')
    const [schema] = childrenOf(schemas!, [rdf, 'Bag'], [rdf, 'li'])
    expect(childrenOf(schema!, [pdfaSchema, 'namespaceURI']).map(({ text }) => text)).toEqual([TEST])
    expect(childrenOf(schema!, [pdfaSchema, 'prefix']).map(({ text }) => text)).toEqual(['ct'])
    expect(childrenOf(schema!, [pdfaSchema, 'property'], [rdf, 'Seq'], [rdf, 'li'], [pdfaProperty, 'name']).map(({ prefix, text }) => `${prefix}:${text}`)).toEqual(['pdfaProperty:Level', 'pdfaProperty:Version'])
  })

  // A prefix is only a name for a namespace. A packet that binds `ct` to
  // another namespace states nothing of this one, and one that binds
  // another prefix to it states the same as `ct` would -- which is why the
  // prefix is reported beside the namespace, for a test that must hold it.
  test('finds a property by its namespace, whatever prefix the packet binds to it', async () => {
    const other = `<rdf:Description rdf:about="" xmlns:ct="urn:formancy:corpus:other#"><ct:Version>9.9</ct:Version></rdf:Description>`
    const renamed = `<rdf:Description rdf:about="" xmlns:zz="${TEST}"><zz:Version>1.0</zz:Version></rdf:Description>`
    const read = readXmp(await packet(appended(`${other}\n${renamed}`)))
    expect(propertiesOf(read, TEST, 'Version')).toMatchObject([{ prefix: 'zz', text: '1.0' }])
  })

  // RDF lets a simple property be written as an attribute of its
  // description. A reader that saw only elements would report such a
  // packet as stating nothing. `rdf:about` is the description's own, not a
  // property.
  test('reads a property written as an attribute of its description', async () => {
    const read = readXmp(await packet(appended(`<rdf:Description rdf:about="" xmlns:ct="${TEST}" ct:Version="1.0"/>`)))
    expect(propertiesOf(read, TEST, 'Version')).toEqual([{ uri: TEST, prefix: 'ct', local: 'Version', attributes: [], children: [], text: '1.0' }])
    expect(propertiesOf(read, rdf, 'about')).toEqual([])
  })

  // pdfkit writes the title into the packet unescaped (pdfkit.js 6025-6032), and veraPDF
  // fails such a file (6.6.2.1-4, 6.6.2.1-5, 6.6.4-1). A reader that
  // matched text would still find the title there, and every check of the
  // XMP would pass on a file no validator takes.
  test('refuses the packet pdfkit writes for a title that holds & and <', async () => {
    const written = await packet(undefined, 'Müller & Söhne <AG>')
    expect(written).toContain('Müller & Söhne <AG>')
    expect(() => readXmp(written)).toThrow()
  })

  // A prefix bound to no namespace makes the packet not namespace-
  // well-formed; read as a name, its property would look like one.
  test('refuses a property whose prefix is bound to no namespace', async () => {
    const written = await packet(appended('<rdf:Description rdf:about=""><ct:Version>1.0</ct:Version></rdf:Description>'))
    expect(() => readXmp(written)).toThrow(/prefix/)
  })

  // The packet's wrapper -- `x:xmpmeta`, one `rdf:RDF`, descriptions in it
  // -- is where every property is looked for. Something else read as an
  // empty packet would answer "no such property" for any question, which
  // a test that a property is absent would take.
  test('refuses XML that is not an XMP packet', () => {
    const wrapped = (inside: string) => `<x:xmpmeta xmlns:x="adobe:ns:meta/">${inside}</x:xmpmeta>`
    expect(() => readXmp('<a/>')).toThrow("the packet's element is {}a, where it is x:xmpmeta")
    expect(() => readXmp(wrapped(''))).toThrow('x:xmpmeta holds 0 rdf:RDF and 0 other elements, where it holds one rdf:RDF')
    expect(() => readXmp(wrapped(`<rdf:RDF xmlns:rdf="${rdf}"/><rdf:RDF xmlns:rdf="${rdf}"/>`))).toThrow('x:xmpmeta holds 2 rdf:RDF and 0 other elements')
    expect(() => readXmp(wrapped(`<rdf:RDF xmlns:rdf="${rdf}"/><other/>`))).toThrow('x:xmpmeta holds 1 rdf:RDF and 1 other elements')
    expect(() => readXmp(wrapped(`<rdf:RDF xmlns:rdf="${rdf}"><rdf:Seq/></rdf:RDF>`))).toThrow(`rdf:RDF holds {${rdf}}Seq, where it holds only rdf:Description`)
    expect(() => readXmp('')).toThrow()
  })

  // The packet header must not carry `bytes` or `encoding` (veraPDF
  // 6.6.2.1-2, 6.6.2.1-3), which only the header's own text shows; a
  // packet without one says so rather than reading as pdfkit's, and an
  // instruction inside the element is neither its header nor its trailer.
  test("reports the packet's header and trailer as written, and their absence", async () => {
    expect(readXmp(await packet()).packet).toEqual({ header: 'begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"', trailer: 'end="w"' })
    expect(readXmp(`<x:xmpmeta xmlns:x="adobe:ns:meta/"><?xpacket end="w"?><rdf:RDF xmlns:rdf="${rdf}"/></x:xmpmeta>`).packet).toEqual({ header: undefined, trailer: undefined })
  })
})
