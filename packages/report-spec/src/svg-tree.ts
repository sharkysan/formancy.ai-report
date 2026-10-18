/**
 * An SVG's tokens read into the tree the cleaner works on: the elements it
 * keeps, each with its geometry, its presentation attributes, its id, its
 * classes and its `style`; the text of its stylesheets; and, as it goes,
 * what it removes and what it refuses (0030).
 *
 * Namespaces are XML's: an element is an SVG one by its namespace, not its
 * prefix, so `svg:rect` is a rect, and an element in any other namespace --
 * an editor's layers, its metadata -- is removed with everything inside it.
 * A prefixed attribute is in its prefix's namespace, never the attribute of
 * the same local name, so `svg:fill` is not `fill` (Namespaces in XML,
 * 6.2) and is removed as a browser ignores it.
 *
 * Inside what is removed nothing is read but well-formedness, with one
 * exception: an SVG `style` there would still style the drawing in a
 * browser, so it is refused rather than skipped.
 */
import { MAX_SVG_DEPTH, MAX_SVG_ELEMENTS } from './limits.js'
import {
  CHILDREN,
  CONDITIONAL_ATTRIBUTES,
  GEOMETRY,
  GRADIENTS,
  isKept,
  isRemovedAttribute,
  type KeptElement,
  LINK_ATTRIBUTES,
  type Property,
  propertyFate,
  REFUSED_ELEMENTS,
  REMOVED_ELEMENTS,
  ROOT_REMOVED,
  TRANSFORMED,
} from './svg-allow.js'
import { CSS_ADVICE, refuse, Removals, shown } from './svg-refusal.js'
import { type XmlAttribute, XmlReader } from './svg-syntax.js'

export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink'
const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace'

/** A value as written, and where, for a message about it. */
export interface Located {
  readonly value: string
  readonly where: string
}

export interface SvgElement {
  readonly name: KeptElement
  /** An `a`, read as the group it draws as: its link removed, its transform and its paint kept (0030). */
  readonly link: boolean
  readonly path: string
  readonly parent: SvgElement | undefined
  readonly children: SvgElement[]
  readonly depth: number
  /** Geometry, `transform` and a gradient's `href`, as written. */
  readonly attributes: Map<string, Located>
  /** The kept properties written as presentation attributes. */
  readonly presentation: Map<Property, Located>
  id: string | undefined
  classes: readonly string[]
  style: Located | undefined
}

export interface SvgDocument {
  readonly root: SvgElement
  /** Every stylesheet's text, in document order. */
  readonly styles: readonly Located[]
  /** The root's width and height, which give the viewBox when it has none. */
  readonly width: Located | undefined
  readonly height: Located | undefined
}

/** Where the reader is: a kept element, inside something removed, or inside a stylesheet. */
interface Frame {
  readonly qname: string
  readonly declared: readonly string[]
  readonly kind: 'kept' | 'removed' | 'style'
  readonly element: SvgElement | undefined
  /** The nearest kept element's path, or a stylesheet's own. */
  readonly path: string
  readonly siblings: Map<string, number>
  readonly text: string[]
}

/** Whether a text holds a character past ASCII: a byte past 0x7F as Latin-1 reads it, or a reference to one. */
export function hasNonAscii(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) if (text.charCodeAt(i) > 0x7f) return true
  return false
}

function split(qname: string): { readonly prefix: string; readonly local: string } {
  const colon = qname.indexOf(':')
  return colon < 0 ? { prefix: '', local: qname } : { prefix: qname.slice(0, colon), local: qname.slice(colon + 1) }
}

export function readTree(bytes: Uint8Array, removals: Removals): SvgDocument {
  return new TreeReader(bytes, removals).read()
}

class TreeReader {
  private readonly reader: XmlReader
  private readonly removals: Removals
  private readonly frames: Frame[] = []
  /** Each prefix's bindings, innermost last; `''` is the default namespace. */
  private readonly namespaces = new Map<string, string[]>([['xml', [XML_NAMESPACE]]])
  private readonly styles: Located[] = []
  private root: SvgElement | undefined
  private closed = false
  private doctype = false
  private elements = 0
  private readonly ids = new Set<string>()
  private width: Located | undefined
  private height: Located | undefined

  constructor(bytes: Uint8Array, removals: Removals) {
    this.reader = new XmlReader(bytes)
    this.removals = removals
  }

  read(): SvgDocument {
    for (let token = this.reader.next(); token !== undefined; token = this.reader.next()) {
      const top = this.frames.at(-1)
      switch (token.kind) {
        case 'declaration':
          if (token.version !== '1.0') refuse('unsupported', 'the file is XML 1.1, which this format does not read', 'save it as XML 1.0')
          if (token.encoding !== undefined && !/^(utf-8|us-ascii|iso-8859-1)$/i.test(token.encoding))
            refuse('encoding', 'the file declares an encoding other than UTF-8, US-ASCII or ISO-8859-1', 'save it as UTF-8')
          this.removals.add('declaration', 'declaration')
          break
        case 'doctype':
          if (this.doctype || this.root !== undefined) refuse('not-well-formed', 'a DOCTYPE after the root or a second one')
          this.doctype = true
          this.removals.add('doctype', 'doctype')
          break
        case 'comment':
          if (top?.kind !== 'removed') this.removals.add('comment', 'comment')
          break
        case 'pi':
          if (top?.kind !== 'removed') refuse('unsupported', `${this.reader.path} holds a processing instruction (${shown(token.target, 'one')}), which this format does not read`, 'save it as plain SVG')
          break
        case 'text':
        case 'cdata':
          this.characters(top, token.kind, token.start, token.end)
          break
        case 'start':
          this.start(top, token.name, token.attributes, token.empty)
          break
        default:
          this.end(top, token.name)
      }
    }
    if (this.root === undefined) refuse('not-svg', 'the file holds no svg element')
    if (this.frames.length > 0) refuse('not-well-formed', `${this.reader.path} is not closed`)
    return { root: this.root, styles: this.styles, width: this.width, height: this.height }
  }

  private characters(top: Frame | undefined, kind: 'text' | 'cdata', start: number, end: number): void {
    if (top === undefined) {
      if (kind === 'cdata' || !this.reader.isWhite(start, end)) refuse('not-well-formed', 'character data outside the root')
      return
    }
    if (top.kind === 'removed') return
    if (top.kind === 'style') {
      top.text.push(kind === 'cdata' ? this.reader.raw(start, end) : this.reader.decode(start, end, false))
      return
    }
    if (kind === 'cdata') refuse('unsupported', `${this.reader.path} holds a CDATA section, which this format reads in a style alone`, 'save it as plain SVG')
    if (!this.reader.isWhite(start, end)) refuse('text', `${this.reader.path} holds text`)
  }

  private lookup(prefix: string): string | undefined {
    return this.namespaces.get(prefix)?.at(-1)
  }

  /** The namespaces a start tag declares, bound until its end tag; checked as Namespaces in XML checks them. */
  private declare(attributes: readonly XmlAttribute[]): string[] {
    const declared: string[] = []
    for (const attribute of attributes) {
      if (attribute.name !== 'xmlns' && !attribute.name.startsWith('xmlns:')) continue
      const prefix = attribute.name === 'xmlns' ? '' : attribute.name.slice(6)
      const uri = this.reader.decode(attribute.start, attribute.end, true)
      if (prefix === 'xmlns' || (prefix === 'xml') !== (uri === XML_NAMESPACE) || (prefix !== '' && uri === ''))
        refuse('not-well-formed', `${this.reader.path}: a namespace declaration XML forbids`)
      const bindings = this.namespaces.get(prefix) ?? []
      bindings.push(uri)
      this.namespaces.set(prefix, bindings)
      declared.push(prefix)
    }
    return declared
  }

  private start(top: Frame | undefined, qname: string, attributes: readonly XmlAttribute[], empty: boolean): void {
    if (top === undefined && (this.root !== undefined || this.closed)) refuse('not-well-formed', 'a second element after the root')
    const declared = this.declare(attributes)
    const { prefix, local } = split(qname)
    const uri = this.lookup(prefix)
    if (prefix !== '' && uri === undefined) refuse('not-well-formed', `${this.reader.path}: an element of a prefix no namespace is declared for`)
    this.attributesUnique(attributes)
    const frame = (kind: Frame['kind'], path: string, element?: SvgElement): void => {
      const pushed: Frame = { qname, declared, kind, element, path, siblings: new Map(), text: [] }
      if (empty) this.close(pushed)
      else {
        this.frames.push(pushed)
        if (element !== undefined) this.reader.path = element.path
      }
    }
    if (top?.kind === 'removed') {
      if (uri === SVG_NAMESPACE && local === 'style') refuse('unsupported', `${this.reader.path} holds a style inside what is removed, which a browser would still apply`, 'move the style out of it, or delete the style')
      frame('removed', top.path)
      return
    }
    if (top?.kind === 'style') refuse('unsupported', `${this.reader.path} holds an element inside a style`, CSS_ADVICE)
    if (top === undefined && (local !== 'svg' || uri !== SVG_NAMESPACE)) refuse('not-svg', 'the root is not an svg element in the SVG namespace')
    const path = this.path(top, local)
    if (uri !== SVG_NAMESPACE) {
      this.removals.add('element', qname)
      frame('removed', top?.path ?? path)
      return
    }
    // Unprefixed SVG elements below would be in another namespace, which a browser draws none of.
    if (declared.includes('') && this.lookup('') !== SVG_NAMESPACE) refuse('unsupported', `${path} declares another default namespace than SVG's`, 'save it as plain SVG')
    if (REMOVED_ELEMENTS.has(local)) {
      this.removals.add('element', local)
      frame('removed', top?.path ?? path)
      return
    }
    if (local === 'style') {
      this.styleAttributes(attributes, path)
      this.removals.add('element', 'style')
      frame('style', path)
      return
    }
    frame('kept', path, this.keep(top?.element, local, path, attributes))
  }

  /** An SVG element neither removed nor a stylesheet: refused, or kept where its parent may hold it, within the bounds. */
  private keep(parent: SvgElement | undefined, local: string, path: string, attributes: readonly XmlAttribute[]): SvgElement {
    const refused = REFUSED_ELEMENTS.get(local)
    if (refused !== undefined) refuse(refused.code, `${path} is ${local}`, refused.advice)
    if (local === 'svg' && parent !== undefined) refuse('unsupported', `${path} is an svg inside the drawing, and this format draws one svg alone`, 'ungroup it into the outer drawing')
    const link = local === 'a'
    const name = link ? 'g' : local
    if (!isKept(name)) refuse('unsupported', `${path} is ${shown(local, 'an element')}, which this format does not draw`)
    if (parent !== undefined && !CHILDREN[parent.name].has(name)) refuse('unsupported', `${path} is not drawn inside a ${parent.name}`, `move it out of the ${parent.name}`)
    const depth = (parent?.depth ?? 0) + 1
    if (depth > MAX_SVG_DEPTH) refuse('too-deep', `${path} nests past ${MAX_SVG_DEPTH} levels`)
    this.elements += 1
    if (this.elements > MAX_SVG_ELEMENTS) refuse('too-large', `the drawing has more than ${MAX_SVG_ELEMENTS} elements`)
    const element: SvgElement = { name, link, path, parent, children: [], depth, attributes: new Map(), presentation: new Map(), id: undefined, classes: [], style: undefined }
    if (link) this.removals.add('element', 'a')
    this.attributes(element, attributes)
    if (parent === undefined) this.root = element
    else parent.children.push(element)
    return element
  }

  private path(top: Frame | undefined, local: string): string {
    if (top?.element === undefined) return local
    // The name as a message may repeat it: an element this format does not know may be named anything.
    const name = shown(local, 'element')
    const count = (top.siblings.get(name) ?? 0) + 1
    top.siblings.set(name, count)
    return `${top.element.path}/${name}${count > 1 ? `[${count}]` : ''}`
  }

  /** No two attributes of one element name the same thing, prefixes resolved: `xlink:href` and `x:href` bound to one namespace are one attribute twice. */
  private attributesUnique(attributes: readonly XmlAttribute[]): void {
    const seen = new Set<string>()
    for (const { name } of attributes) {
      const { prefix, local } = split(name)
      if (prefix === '' || prefix === 'xmlns') continue
      const uri = this.lookup(prefix)
      if (uri === undefined) refuse('not-well-formed', `${this.reader.path}: an attribute of a prefix no namespace is declared for`)
      const key = `${uri} ${local}`
      if (seen.has(key)) refuse('not-well-formed', `${this.reader.path}: an attribute given twice under two prefixes`)
      seen.add(key)
    }
  }

  /** A stylesheet is read only when it is CSS for every medium, as a browser would apply it to a printed page. */
  private styleAttributes(attributes: readonly XmlAttribute[], path: string): void {
    for (const attribute of attributes) {
      const value = this.reader.decode(attribute.start, attribute.end, true).trim().toLowerCase()
      if (attribute.name === 'type' && value !== '' && value !== 'text/css') refuse('unsupported', `${path} is a stylesheet that is not CSS`, CSS_ADVICE)
      if (attribute.name === 'media' && value !== 'all') refuse('unsupported', `${path} is a stylesheet for some media alone`, CSS_ADVICE)
    }
  }

  private attributes(element: SvgElement, attributes: readonly XmlAttribute[]): void {
    const root = element.parent === undefined
    for (const attribute of attributes) {
      const { name: qname } = attribute
      if (qname === 'xmlns' || qname.startsWith('xmlns:')) {
        if (qname !== 'xmlns') this.removals.add('attribute', qname)
        continue
      }
      const where = `${element.path}@${shown(qname, 'an attribute')}`
      const { prefix, local } = split(qname)
      const value = (): string => this.reader.decode(attribute.start, attribute.end, true)
      if (prefix !== '') {
        if (this.lookup(prefix) === XLINK_NAMESPACE && local === 'href') this.href(element, value(), where)
        else if (!element.link || this.lookup(prefix) !== XLINK_NAMESPACE) this.removals.add('attribute', qname)
        continue
      }
      if (root && ROOT_REMOVED.has(local)) {
        if (local === 'width') this.width = { value: value(), where }
        if (local === 'height') this.height = { value: value(), where }
        this.removals.add('attribute', local)
      } else if (local === 'href') this.href(element, value(), where)
      else if (element.link && LINK_ATTRIBUTES.has(local)) continue
      else if (isRemovedAttribute(local)) this.removals.add('attribute', local)
      else if (CONDITIONAL_ATTRIBUTES.has(local)) refuse('unsupported', `${where} is a conditional-processing attribute, by which a browser may hide the element`, `remove ${local} from it`)
      else if (local === 'id') this.id(element, value(), where)
      else if (local === 'class') element.classes = value().split(' ').filter((name) => name !== '')
      else if (local === 'style') element.style = { value: value(), where }
      else if (GEOMETRY[element.name].includes(local) || local === 'transform') this.geometry(element, local, value(), where)
      else this.presentation(element, local, value(), where)
    }
  }

  /** An element's id, refused when another element has it: which of the two a reference names, readers decide differently. */
  private id(element: SvgElement, id: string, where: string): void {
    if (this.ids.has(id)) refuse('reference', `${where} is an id another element has too`, 'give each element an id of its own')
    this.ids.add(id)
    element.id = id
  }

  private geometry(element: SvgElement, name: string, value: string, where: string): void {
    if (name === 'transform' && !TRANSFORMED.has(element.name) && element.parent !== undefined) {
      // A transform on defs moves nothing: what defs holds is drawn, if at all, in the user space of what refers to it.
      if (element.name === 'defs') this.removals.add('attribute', 'transform')
      else refuse('unsupported', `${where} transforms an element this format does not transform`, "move the transform onto a group around it, or onto a gradient's gradientTransform")
      return
    }
    element.attributes.set(name, { value: ascii(value, where), where })
  }

  private presentation(element: SvgElement, name: string, value: string, where: string): void {
    const fate = propertyFate(name, value.trim().toLowerCase().replace(/\s+/g, ' '))
    if (fate === undefined) refuse('unsupported', `${where} is not an attribute this format draws as a browser draws it`)
    if (fate.fate === 'removed') this.removals.add('attribute', name)
    else if (fate.fate === 'refused') refuse('unsupported', `${where} is not drawn by this format`, fate.advice)
    else element.presentation.set(fate.property, { value: ascii(value, where), where })
  }

  /** A gradient's reference to another gradient, the one reference an attribute may hold; a link's is removed with the link. */
  private href(element: SvgElement, value: string, where: string): void {
    if (element.link) return
    if (!GRADIENTS.has(element.name)) refuse('reference', `${where} is a reference this format does not follow`)
    if (element.attributes.has('href')) refuse('reference', `${where}: href and xlink:href both, which readers choose between differently`, 'keep one of them')
    element.attributes.set('href', { value: ascii(value, where), where })
  }

  private end(top: Frame | undefined, qname: string): void {
    if (top === undefined || top.qname !== qname) refuse('not-well-formed', `${this.reader.path}: an end tag that does not match its start`)
    this.frames.pop()
    this.close(top)
    this.reader.path = this.frames.at(-1)?.path ?? 'the document'
  }

  private close(frame: Frame): void {
    for (const prefix of frame.declared) this.namespaces.get(prefix)?.pop()
    if (frame.kind === 'style') this.styles.push({ value: frame.text.join(''), where: frame.path })
    if (frame.element !== undefined && frame.element.parent === undefined) this.closed = true
  }
}

/** A kept value, refused when it holds a byte past ASCII: what is kept must read alike in every reader. */
function ascii(value: string, where: string): string {
  if (hasNonAscii(value)) refuse('encoding', `${where} holds a byte past ASCII`, 'write it in ASCII')
  return value
}
