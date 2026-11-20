/**
 * The one place a string becomes XML (0068). Everything a report or its
 * data carries -- a title, a run, a cell, a font's family -- is a string
 * somebody else wrote, and a Word file is XML, in which a string that is
 * not escaped is markup, a field Word runs, or a relationship to an
 * address Word fetches.
 *
 * So markup is a type of its own, `Xml`, which only this module makes:
 * `text` and `attribute` escape a string, `own` admits a literal the
 * writer typed itself, and `element` builds from those and nothing else.
 * A string from a document does not compile where markup stands, and an
 * element's and an attribute's name is a literal with one of the
 * writer's prefixes, never a value.
 *
 * Both escapers are whole: each writes any string as XML that reads back
 * as that string, or throws. What they throw at -- a character no XML
 * document holds -- the checks refuse before anything is written
 * (`check-text.ts`), naming the block; reaching it here is a defect.
 */

declare const markup: unique symbol

/** XML the writer made: escaped text, an attribute's escaped value, or elements built of them. */
export type Xml = string & { readonly [markup]: true }

type Prefix = 'w' | 'r' | 'wp' | 'a' | 'pic' | 'asvg' | 'c' | 'cp' | 'dc' | 'dcterms' | 'xsi' | 'xml' | 'xmlns'

/** An element's or an attribute's name: one of the writer's prefixes, or a name of a package's own vocabulary, which has none. */
export type Name = `${Prefix}:${string}` | PackageName
type PackageName =
  | 'Types'
  | 'Default'
  | 'Override'
  | 'Relationships'
  | 'Relationship'
  | 'Extension'
  | 'ContentType'
  | 'PartName'
  | 'Id'
  | 'Type'
  | 'Target'
  | 'xmlns'
  | 'uri'
  | 'id'
  | 'name'
  | 'cx'
  | 'cy'
  | 'x'
  | 'y'
  | 'l'
  | 't'
  | 'r'
  | 'b'
  | 'prst'
  | 'distT'
  | 'distB'
  | 'distL'
  | 'distR'
  | 'val'
  | 'idx'
  | 'sz'
  | 'i'
  | 'rot'
  | 'vert'
  | 'w'
  | 'typeface'
  | 'formatCode'
  | 'sourceLinked'

/** A string type that is a literal, or a union of literals: never `string` itself. */
type Literal<T extends string> = string extends T ? never : T

/**
 * XML 1.0's Char: tab, line feed, carriage return, and every code point
 * from U+0020 but the surrogates, U+FFFE and U+FFFF. A lone surrogate is
 * read as its own code point, and is none.
 */
export function xmlCharacter(point: number): boolean {
  return point === 0x9 || point === 0xa || point === 0xd || (point >= 0x20 && point <= 0xd7ff) || (point >= 0xe000 && point <= 0xfffd) || point >= 0x10000
}

const ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\t': '&#9;', '\n': '&#10;', '\r': '&#13;' }

function escaped(value: string, pattern: RegExp): Xml {
  for (const character of value) {
    if (!xmlCharacter(character.codePointAt(0)!))
      throw new Error('a character no XML document holds reached the writer: the checks refuse it before anything is written')
  }
  return value.replace(pattern, (character) => ESCAPES[character]!) as Xml
}

/**
 * `value` as an element's text: `&`, `<` and `>` escaped, so that no
 * markup, no `]]>` and no closing tag is in it, and a carriage return as
 * its character reference, which a reader would otherwise read as a line
 * feed.
 */
export function text(value: string): Xml {
  return escaped(value, /[&<>\r]/g)
}

/**
 * `value` as an attribute's value between double quotes: the quote
 * escaped with the rest, and a tab, a line feed and a carriage return as
 * character references, which a reader would otherwise read as spaces.
 */
export function attribute(value: string): Xml {
  return escaped(value, /[&<>"\t\n\r]/g)
}

/** A literal of the writer's own, or a value of a closed list of them, as markup: it holds nothing to escape, and a `string` does not compile here. */
export function own<T extends string>(literal: Literal<T>): Xml {
  if (/[&<>"\t\n\r]/.test(literal)) throw new Error('a literal of the writer holds a character to escape')
  return literal as string as Xml
}

/** A colour as Word writes one, six upper-case hex digits, from the document's `#rrggbb`: held to being one here, so that what is written is hex digits whatever it was handed. */
export function hexColor(color: string): Xml {
  if (!/^#[0-9a-f]{6}$/.test(color)) throw new Error('a colour that is not #rrggbb reached the writer: the checks refuse it before anything is written')
  return color.slice(1).toUpperCase() as Xml
}

/**
 * A decimal as the runtime writes one -- a minus or none, digits, and a
 * point and digits or none -- as markup, digit for digit: a chart's value
 * and its axis's ends are the report's own digits (0076), never a number
 * JavaScript read and wrote again. Held to being one here, so that what
 * is written is digits whatever it was handed; the checks refuse anything
 * else before anything is written.
 */
export function decimal(exact: string): Xml {
  if (!/^-?\d+(?:\.\d+)?$/.test(exact)) throw new Error('a value that is no decimal reached the writer: the checks refuse it before anything is written')
  return exact as Xml
}

/** An attribute's value: markup, or a whole number, which the writer's units are. */
export type AttributeValue = Xml | number

/** `name` with its attributes, in the order given, and its children; empty, it is closed where it opens. */
export function element(name: Name, attributes: readonly (readonly [Name, AttributeValue])[] = [], children: readonly Xml[] = []): Xml {
  let open = `<${name}`
  for (const [key, value] of attributes) {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error(`the attribute ${key} of ${name} is no whole number`)
    open += ` ${key}="${String(value)}"`
  }
  return (children.length === 0 ? `${open}/>` : `${open}>${children.join('')}</${name}>`) as Xml
}

/** Several pieces of markup as one. */
export function joined(parts: readonly Xml[]): Xml {
  return parts.join('') as Xml
}

/** The declaration every part opens with. */
const DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

/** A part's text: the declaration and its one element. */
export function part(root: Xml): string {
  return `${DECLARATION}${root}`
}
