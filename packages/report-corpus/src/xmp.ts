import { SaxesParser } from 'saxes'

/**
 * A PDF's XMP packet, read strictly: saxes 6.0.0, a parser that is not the
 * writer, with every prefix resolved to its namespace. A packet that is not
 * well-formed, or uses a prefix bound to nothing, throws, as veraPDF fails
 * it (6.6.2.1-4). A property is found by its namespace URI and local name,
 * never by its prefix, and its prefix is reported beside it, since PDF/A
 * fixes the prefixes of its own schemas and an extension schema states the
 * prefix of the rest (veraPDF 6.6.2.3.3, 6.6.4-4).
 *
 * What this cannot show is that a validator takes the packet: the value
 * types and the extension schema's fields are veraPDF's to judge.
 */

/**
 * The namespaces a PDF/A-3's XMP is read in. `x` and `rdf` are the packet's
 * own, and `xml` is the one Namespaces in XML binds; `pdfaExtension` is
 * named by veraPDF's rule 6.6.2.3.3-1; `pdfaSchema` and `pdfaProperty` as
 * akretion's factur-x 7.7 and PDFlib's sample extension schema write them
 * [S]; `pdfaid`, `dc`, `xmp` and `pdf` as pdfkit 0.19.1 writes its own
 * descriptions (pdfkit.js 5282-5289, 6014-6066); and veraPDF 1.30.3 passed
 * every one of them as PDF/A-3b, on 17 October 2026 and again in the
 * e-invoice gate's recorded run (0031).
 */
export const XMP_NAMESPACES = {
  x: 'adobe:ns:meta/',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  xml: 'http://www.w3.org/XML/1998/namespace',
  pdfaid: 'http://www.aiim.org/pdfa/ns/id/',
  pdfaExtension: 'http://www.aiim.org/pdfa/ns/extension/',
  pdfaSchema: 'http://www.aiim.org/pdfa/ns/schema#',
  pdfaProperty: 'http://www.aiim.org/pdfa/ns/property#',
  dc: 'http://purl.org/dc/elements/1.1/',
  xmp: 'http://ns.adobe.com/xap/1.0/',
  pdf: 'http://ns.adobe.com/pdf/1.3/',
} as const

const XMLNS = 'http://www.w3.org/2000/xmlns/'

export interface XmlAttribute {
  readonly uri: string
  readonly prefix: string
  readonly local: string
  readonly value: string
}

/** An element as a parser that resolves namespaces gives it back. */
export interface XmlElement {
  readonly uri: string
  /** The prefix the packet wrote it with, empty for the default namespace. */
  readonly prefix: string
  readonly local: string
  /** Its attributes but the namespace declarations, in document order. */
  readonly attributes: readonly XmlAttribute[]
  readonly children: readonly XmlElement[]
  /** The text directly inside it, CDATA included, as the parser gives it back. */
  readonly text: string
}

export interface Xmp {
  /** The bodies of the `xpacket` processing instructions before and after the packet's element, undefined where there is none. */
  readonly packet: { readonly header: string | undefined; readonly trailer: string | undefined }
  /** `x:xmpmeta`, the packet's element. */
  readonly root: XmlElement
  /**
   * Every property of every `rdf:Description` in the packet's `rdf:RDF`, in
   * document order: each element in it, and each attribute of it in a
   * namespace but RDF's and XML's, as an element of that name holding the
   * value, as RDF reads a property so written.
   */
  readonly properties: readonly XmlElement[]
}

interface Building {
  readonly uri: string
  readonly prefix: string
  readonly local: string
  readonly attributes: XmlAttribute[]
  readonly children: Building[]
  text: string
}

/** `text` read as an XMP packet; throws where it is not well-formed, not namespace-well-formed, or not a packet. */
export function readXmp(text: string): Xmp {
  const { root, before, after } = parse(text)
  const named = (element: XmlElement, uri: string, local: string): boolean => element.uri === uri && element.local === local
  if (!named(root, XMP_NAMESPACES.x, 'xmpmeta')) throw new Error(`the packet's element is ${clark(root)}, where it is x:xmpmeta`)
  const rdf = root.children.filter((child) => named(child, XMP_NAMESPACES.rdf, 'RDF'))
  if (rdf.length !== 1 || root.children.length !== 1)
    throw new Error(`x:xmpmeta holds ${String(rdf.length)} rdf:RDF and ${String(root.children.length - rdf.length)} other elements, where it holds one rdf:RDF`)
  const descriptions = rdf[0]!.children
  const other = descriptions.find((child) => !named(child, XMP_NAMESPACES.rdf, 'Description'))
  if (other !== undefined) throw new Error(`rdf:RDF holds ${clark(other)}, where it holds only rdf:Description`)
  const properties = descriptions.flatMap((description) => [
    ...description.attributes
      .filter(({ uri }) => uri !== XMP_NAMESPACES.rdf && uri !== XMP_NAMESPACES.xml && uri !== '')
      .map(({ uri, prefix, local, value }) => ({ uri, prefix, local, attributes: [], children: [], text: value })),
    ...description.children,
  ])
  return { packet: { header: xpacket(before.at(0)), trailer: xpacket(after.at(-1)) }, root, properties }
}

/** Every property named `local` in the namespace `uri`, in document order. */
export function propertiesOf(xmp: Xmp, uri: string, local: string): XmlElement[] {
  return xmp.properties.filter((property) => property.uri === uri && property.local === local)
}

/** Every element below `from` at the path `steps`, each a namespace URI and a local name, in document order. */
export function childrenOf(from: XmlElement, ...steps: readonly (readonly [uri: string, local: string])[]): XmlElement[] {
  return steps.reduce<XmlElement[]>(
    (found, [uri, local]) => found.flatMap((element) => element.children.filter((child) => child.uri === uri && child.local === local)),
    [from],
  )
}

/** An element's name in Clark's notation, `{namespace}local`, which no prefix can make ambiguous. */
const clark = ({ uri, local }: XmlElement): string => `{${uri}}${local}`

const xpacket = (instruction: { readonly target: string; readonly body: string } | undefined): string | undefined =>
  instruction?.target === 'xpacket' ? instruction.body : undefined

interface Parsed {
  readonly root: XmlElement
  /** The processing instructions before the element and after it. */
  readonly before: readonly { readonly target: string; readonly body: string }[]
  readonly after: readonly { readonly target: string; readonly body: string }[]
}

function parse(text: string): Parsed {
  const open: Building[] = []
  let root: Building | undefined
  const before: { target: string; body: string }[] = []
  const after: { target: string; body: string }[] = []
  const parser = new SaxesParser({ xmlns: true })
  parser.on('error', (error) => {
    throw error
  })
  parser.on('processinginstruction', ({ target, body }) => {
    if (open.length === 0) (root === undefined ? before : after).push({ target, body })
  })
  parser.on('opentag', (tag) => {
    const attributes = Object.values(tag.attributes)
      .filter(({ uri }) => uri !== XMLNS)
      .map(({ uri, prefix, local, value }) => ({ uri, prefix, local, value }))
    const element: Building = { uri: tag.uri, prefix: tag.prefix, local: tag.local, attributes, children: [], text: '' }
    const parent = open.at(-1)
    if (parent === undefined) root = element
    else parent.children.push(element)
    open.push(element)
  })
  // White space outside the element is reported too, and is nobody's text; anything else there saxes refuses.
  const append = (chunk: string): void => {
    const element = open.at(-1)
    if (element !== undefined) element.text += chunk
  }
  parser.on('text', append)
  parser.on('cdata', append)
  parser.on('closetag', () => {
    open.pop()
  })
  // saxes refuses a document with no element, as an error.
  parser.write(text).close()
  return { root: root as Building, before, after }
}
