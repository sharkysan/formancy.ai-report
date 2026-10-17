import { SaxesParser } from 'saxes'

/**
 * The CII XML the runtime writes of an e-invoice, read back for the
 * corpus's tests by a parser that is not the writer: saxes 6.0.0, strictly,
 * its namespaces resolved. An element is known by its namespace URI and
 * local name, under a prefix of this reader's own, so that a prefix bound
 * to another namespace is read as what it is. A malformed file, or an
 * element of a namespace the CII binding does not use, throws.
 *
 * What this cannot show is that a validator takes the file: the XSD's
 * order and the schematron's rules are the e-invoice gate's.
 */

export const CII_NAMESPACES = {
  rsm: 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100',
  ram: 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100',
  udt: 'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100',
} as const

const PREFIXES: { readonly [uri: string]: string } = Object.fromEntries(Object.entries(CII_NAMESPACES).map(([prefix, uri]) => [uri, prefix]))

export interface CiiElement {
  /** `prefix:local`, the prefix this reader's own. */
  readonly name: string
  /** Its attributes in no namespace, by local name. */
  readonly attributes: Readonly<Record<string, string>>
  readonly children: readonly CiiElement[]
  /** The text directly inside it, as the parser gives it back. */
  readonly text: string
}

interface Building {
  readonly name: string
  readonly attributes: Record<string, string>
  readonly children: Building[]
  text: string
}

/** `xml` parsed strictly, with namespaces: its root element. */
export function readCii(xml: string): CiiElement {
  const open: Building[] = []
  let root: Building | undefined
  const parser = new SaxesParser({ xmlns: true })
  parser.on('error', (error) => {
    throw error
  })
  parser.on('opentag', (tag) => {
    const prefix = PREFIXES[tag.uri]
    if (prefix === undefined) throw new Error(`an element of the namespace ${tag.uri}`)
    const attributes: Record<string, string> = {}
    for (const attribute of Object.values(tag.attributes)) if (attribute.uri === '') attributes[attribute.local] = attribute.value
    const element: Building = { name: `${prefix}:${tag.local}`, attributes, children: [], text: '' }
    const parent = open.at(-1)
    if (parent === undefined) root = element
    else parent.children.push(element)
    open.push(element)
  })
  // White space outside the root is reported too, and is nobody's text; anything else there saxes refuses.
  parser.on('text', (chunk) => {
    const element = open.at(-1)
    if (element !== undefined) element.text += chunk
  })
  parser.on('closetag', () => {
    open.pop()
  })
  // saxes refuses a document with no root element, as an error.
  parser.write(xml).close()
  return root as Building
}

/** Every element at `path` below `from`, `prefix:local` names joined by `/`, in document order. */
export function elementsAt(from: CiiElement, path: string): CiiElement[] {
  return path.split('/').reduce<CiiElement[]>((found, name) => found.flatMap((element) => element.children.filter((child) => child.name === name)), [from])
}

/** The texts of every element at `path` below `from`, in document order. */
export function textsAt(from: CiiElement, path: string): string[] {
  return elementsAt(from, path).map((element) => element.text)
}

/** The text of the one element at `path` below `from`, or undefined where there is none; two are a defect, and throw. */
export function textAt(from: CiiElement, path: string): string | undefined {
  const texts = textsAt(from, path)
  if (texts.length > 1) throw new Error(`${texts.length} elements at ${path}`)
  return texts[0]
}

/** Every element's text that is not blank by its path from the root, and every attribute by the element's path and `@name`, each in document order. */
export function pathsOf(root: CiiElement): { readonly texts: ReadonlyMap<string, readonly string[]>; readonly attributes: ReadonlyMap<string, readonly string[]> } {
  const texts = new Map<string, string[]>()
  const attributes = new Map<string, string[]>()
  const add = (map: Map<string, string[]>, key: string, value: string): void => {
    map.set(key, [...(map.get(key) ?? []), value])
  }
  const walk = (element: CiiElement, above: string): void => {
    const at = above === '' ? element.name : `${above}/${element.name}`
    for (const [name, value] of Object.entries(element.attributes)) add(attributes, `${at}/@${name}`, value)
    if (element.text.trim() !== '') add(texts, at, element.text)
    for (const child of element.children) walk(child, at)
  }
  walk(root, '')
  return { texts, attributes }
}
