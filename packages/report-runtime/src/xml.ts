/**
 * XML, written one way: a tree of elements serialised with the same bytes
 * for the same tree, every text escaped so that a parser gives back exactly
 * what was written. The e-invoice's CII is built as such a tree
 * (`cii.ts`), and this is the one place it becomes text.
 *
 * Exactly, to a parser: a reader that applies the schema reads an element
 * the XSD types as xs:token -- an identifier, a code -- with its white
 * space collapsed. report-spec's rules refuse such a text that holds any
 * (`token` in `en16931.ts`), so what such a reader reads is what was
 * written too.
 *
 * - **Deterministic.** `<?xml version="1.0" encoding="UTF-8"?>`, no byte
 *   order mark, a line feed after every line, two spaces a level, an empty
 *   element closed at once, attributes in the order given. Nothing reads a
 *   clock or the machine.
 * - **Escaped.** In text `&`, `<` and `>`, and a carriage return as
 *   `&#13;`, which a parser would otherwise read as a line feed (XML 1.0,
 *   2.11). In an attribute the double quote too, and a tab, a line feed and
 *   a carriage return as references, which a parser would otherwise read
 *   as spaces (3.3.3).
 * - **Never a character XML 1.0 cannot hold.** report-spec's
 *   `xmlCharacterBreak` decides which: the e-invoice's rules refuse a text
 *   that holds one where it is read, naming its term. One that reaches the
 *   writer anyway is a defect, thrown as a RangeError, never dropped, since
 *   dropping it would change what the invoice says.
 */
import { xmlCharacterBreak } from '@formancy/report-spec'

/** An attribute: its qualified name and its value. */
export type XmlAttribute = readonly [name: string, value: string]

/** An element: its qualified name, its attributes, and either its text or the elements it holds. */
export interface XmlElement {
  readonly name: string
  readonly attributes: readonly XmlAttribute[]
  readonly content: string | readonly XmlElement[]
}

/** An element holding `children`, in order; an undefined child is a term the document leaves out. */
export function element(name: string, children: readonly (XmlElement | undefined)[], attributes: readonly XmlAttribute[] = []): XmlElement {
  return { name, attributes, content: children.filter((child): child is XmlElement => child !== undefined) }
}

/** An element holding the text `text`. */
export function leaf(name: string, text: string, attributes: readonly XmlAttribute[] = []): XmlElement {
  return { name, attributes, content: text }
}

/** `text` with no character XML 1.0 cannot write; a RangeError when it holds one, which the rules refuse before. */
function writable(text: string): string {
  const broken = xmlCharacterBreak(text)
  if (broken !== undefined) throw new RangeError(`a text ${broken}; the e-invoice's rules refuse it where it is read`)
  return text
}

const TEXT = /[&<>\r]/g
const ATTRIBUTE = /[&<>"\t\n\r]/g
const REFERENCES: { readonly [character: string]: string } = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\t': '&#9;', '\n': '&#10;', '\r': '&#13;' }

const escaped = (pattern: RegExp) => (text: string): string => writable(text).replace(pattern, (character) => REFERENCES[character] as string)
const text = escaped(TEXT)
const attribute = escaped(ATTRIBUTE)

/** `node` written into `lines`, at `depth` levels. */
function write(node: XmlElement, depth: number, lines: string[]): void {
  const indent = '  '.repeat(depth)
  const open = `${indent}<${node.name}${node.attributes.map(([name, value]) => ` ${name}="${attribute(value)}"`).join('')}`
  if (typeof node.content === 'string') {
    lines.push(`${open}>${text(node.content)}</${node.name}>`)
    return
  }
  if (node.content.length === 0) {
    lines.push(`${open}/>`)
    return
  }
  lines.push(`${open}>`)
  for (const child of node.content) write(child, depth + 1, lines)
  lines.push(`${indent}</${node.name}>`)
}

/** The document whose root is `root`, as UTF-8 XML text: its declaration first, a line feed after every line. */
export function xmlDocument(root: XmlElement): string {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>']
  write(root, 0, lines)
  return `${lines.join('\n')}\n`
}
