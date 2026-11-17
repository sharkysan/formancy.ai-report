import { SaxesParser } from 'saxes'

/**
 * A part's XML read strictly, by saxes 6.0.0 with every prefix resolved to
 * its namespace, into a tree, and held to a closed vocabulary (0068): an
 * element is known by its namespace URI and local name, never its prefix;
 * one the vocabulary does not hold where it stands, an attribute it does
 * not hold, an element's children out of the order ECMA-376 gives them, a
 * second of one that stands once, and text where an element holds none are
 * each refused. So is a document type, an entity of the document's own
 * and a processing instruction, none of which a written part holds.
 */

/** An element as it was read: its attributes by `{namespace}local`, or the bare name for one in no namespace. */
export interface XmlNode {
  readonly uri: string
  readonly local: string
  readonly attributes: ReadonlyMap<string, string>
  readonly children: readonly XmlNode[]
  readonly text: string
}

/** What an element may be: its name, the attributes it may carry, what it holds and in which order, and whether it holds text. */
export interface ElementDef {
  readonly uri: string
  readonly local: string
  /** Each `{namespace}local`, or the bare name of one in no namespace. */
  readonly attributes: readonly string[]
  /** Its children, group after group: one that stands at most once, or any number of several in any order. A function, since a table's cell holds tables. */
  readonly content: () => readonly Group[]
  /** Whether it holds text; an element that does holds no element. */
  readonly text?: true
}

export interface Group {
  readonly of: readonly ElementDef[]
  /** Any number of them, in any order among themselves; absent, at most one of the one. */
  readonly many?: true
}

const XMLNS = 'http://www.w3.org/2000/xmlns/'

/** An attribute's key: `{namespace}local`, or the local name alone in no namespace. */
export const attributeKey = (uri: string, local: string): string => (uri === '' ? local : `{${uri}}${local}`)

interface Building {
  readonly uri: string
  readonly local: string
  readonly attributes: Map<string, string>
  readonly children: Building[]
  text: string
}

/** `xml` parsed: its root element. Throws where it is not well-formed, not namespace-well-formed, or holds what no written part does. */
export function parseXml(xml: string): XmlNode {
  const open: Building[] = []
  let root: Building | undefined
  const parser = new SaxesParser({ xmlns: true })
  parser.on('error', (error) => {
    throw error
  })
  parser.on('doctype', () => {
    throw new Error('a document type')
  })
  parser.on('processinginstruction', ({ target }) => {
    throw new Error(`a processing instruction (${target})`)
  })
  parser.on('opentag', (tag) => {
    const attributes = new Map<string, string>()
    for (const { uri, local, value } of Object.values(tag.attributes)) if (uri !== XMLNS) attributes.set(attributeKey(uri, local), value)
    const element: Building = { uri: tag.uri, local: tag.local, attributes, children: [], text: '' }
    const parent = open.at(-1)
    if (parent === undefined) root = element
    else parent.children.push(element)
    open.push(element)
  })
  const append = (chunk: string): void => {
    const element = open.at(-1)
    if (element !== undefined) element.text += chunk
  }
  parser.on('text', append)
  parser.on('cdata', append)
  parser.on('closetag', () => {
    open.pop()
  })
  parser.write(xml).close()
  return root as Building
}

/** An element's name in Clark's notation, which no prefix can make ambiguous. */
export const clark = ({ uri, local }: { readonly uri: string; readonly local: string }): string => `{${uri}}${local}`

/** `node` held to `def`, and every element under it to its own; throws at the first thing the vocabulary does not hold. */
export function conform(node: XmlNode, def: ElementDef): void {
  if (node.uri !== def.uri || node.local !== def.local) throw new Error(`${clark(node)} where ${clark(def)} stands`)
  for (const key of node.attributes.keys()) {
    if (!def.attributes.includes(key)) throw new Error(`the attribute ${key} on ${clark(node)}, which the vocabulary does not hold there`)
  }
  if (def.text === true) {
    if (node.children.length > 0) throw new Error(`an element inside ${clark(node)}, which holds text`)
    return
  }
  if (node.text !== '') throw new Error(`text inside ${clark(node)}, which holds none`)
  const groups = def.content()
  let at = 0
  let taken = false
  for (const child of node.children) {
    let found: ElementDef | undefined
    for (; at < groups.length; at++, taken = false) {
      const group = groups[at]!
      found = group.of.find((each) => each.uri === child.uri && each.local === child.local)
      if (found !== undefined && (group.many === true || !taken)) break
      if (found !== undefined) throw new Error(`a second ${clark(child)} in ${clark(node)}`)
    }
    if (found === undefined) {
      const known = groups.some((group) => group.of.some((each) => each.uri === child.uri && each.local === child.local))
      throw new Error(
        known ? `${clark(child)} out of its order in ${clark(node)}` : `${clark(child)} in ${clark(node)}, which the vocabulary does not hold there`,
      )
    }
    taken = true
    conform(child, found)
  }
}

/** The child of `node` named `local` in `uri`, or undefined. */
export function child(node: XmlNode, uri: string, local: string): XmlNode | undefined {
  return node.children.find((each) => each.uri === uri && each.local === local)
}

/** Every child of `node` named `local` in `uri`, in order. */
export function childrenNamed(node: XmlNode, uri: string, local: string): XmlNode[] {
  return node.children.filter((each) => each.uri === uri && each.local === local)
}
