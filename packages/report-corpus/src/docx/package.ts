import { child, childrenNamed, conform, parseXml, type ElementDef, type XmlNode } from './xml.js'
import { readZip } from './zip.js'

/**
 * A package of ECMA-376's Part 2, the Open Packaging Conventions, read
 * back for the corpus's tests (0068): a zip's entries as parts, each with
 * the content type `[Content_Types].xml` gives it, and each part's
 * relationships, every target resolved to a part. It knows nothing of
 * what the parts hold, so a workbook is read by it as a Word file is.
 *
 * Refused, naming the part: a part with no content type, a relationships
 * part of a part the package does not hold, a relationship to an address
 * (`TargetMode="External"`), to no part of the package or under an id its
 * part uses twice, and a part no relationship reaches from the package's
 * own: a file that carries what nothing shows is not the file that was
 * asked for.
 */

/** A relationship of a part, or of the package: its id in its source, its type and the part it leads to. */
export interface Relationship {
  readonly id: string
  readonly type: string
  /** The target part's name, as the zip holds it: `word/media/image1.png`. */
  readonly target: string
}

export interface Part {
  readonly name: string
  readonly contentType: string
  readonly bytes: Uint8Array
}

export interface OpcPackage {
  /** Every part but the content types and the relationships parts, by its name. */
  readonly parts: ReadonlyMap<string, Part>
  /** The relationships of the part `source`, or the package's own for `''`, in their part's order. */
  readonly relationships: (source: string) => readonly Relationship[]
}

const CONTENT_TYPES = 'http://schemas.openxmlformats.org/package/2006/content-types'
const RELATIONSHIPS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const RELS_TYPE = 'application/vnd.openxmlformats-package.relationships+xml'

const leaf = (uri: string, local: string, attributes: readonly string[]): ElementDef => ({ uri, local, attributes, content: () => [] })

const TYPES: ElementDef = {
  uri: CONTENT_TYPES,
  local: 'Types',
  attributes: [],
  content: () => [
    { of: [leaf(CONTENT_TYPES, 'Default', ['Extension', 'ContentType']), leaf(CONTENT_TYPES, 'Override', ['PartName', 'ContentType'])], many: true },
  ],
}

const RELS: ElementDef = {
  uri: RELATIONSHIPS,
  local: 'Relationships',
  attributes: [],
  content: () => [{ of: [leaf(RELATIONSHIPS, 'Relationship', ['Id', 'Type', 'Target', 'TargetMode'])], many: true }],
}

/** A part's bytes as the UTF-8 text they are; throws where they are not. */
export function utf8(bytes: Uint8Array, name: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error(`${name} is not UTF-8`)
  }
}

/** `bytes` parsed and held to `def`, every failure naming the part. */
export function readPart(bytes: Uint8Array, name: string, def: ElementDef): XmlNode {
  try {
    const root = parseXml(utf8(bytes, name))
    conform(root, def)
    return root
  } catch (error) {
    throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
}

const required = (node: XmlNode, key: string, name: string): string => {
  const value = node.attributes.get(key)
  if (value === undefined) throw new Error(`${name}: ${node.local} has no ${key}`)
  return value
}

/** The package `bytes` are; throws, naming the part, where they are not one this reads. */
export function readPackage(bytes: Uint8Array): OpcPackage {
  const entries = new Map(readZip(bytes).map((entry) => [entry.name, entry.bytes]))
  const types = entries.get('[Content_Types].xml')
  if (types === undefined) throw new Error('the package has no [Content_Types].xml')
  const typed = contentTypes(readPart(types, '[Content_Types].xml', TYPES))
  const parts = new Map<string, Part>()
  const rels = new Map<string, Uint8Array>()
  for (const [name, each] of entries) {
    if (name === '[Content_Types].xml') continue
    const contentType = typed(name)
    if (contentType === undefined) throw new Error(`${name} has no content type`)
    const source = sourceOf(name)
    if (source === undefined) parts.set(name, { name, contentType, bytes: each })
    else if (contentType !== RELS_TYPE) throw new Error(`${name} is a relationships part of another content type`)
    else rels.set(source, each)
  }
  const relationships = new Map<string, readonly Relationship[]>()
  for (const [source, each] of rels) {
    if (source !== '' && !parts.has(source)) throw new Error(`${relsName(source)} holds the relationships of a part the package does not hold`)
    relationships.set(source, readRelationships(each, source, parts))
  }
  const of = (source: string): readonly Relationship[] => relationships.get(source) ?? []
  const reached = new Set<string>()
  const follow = (source: string): void => {
    for (const { target } of of(source)) {
      if (reached.has(target)) continue
      reached.add(target)
      follow(target)
    }
  }
  follow('')
  const unreached = [...parts.keys()].find((name) => !reached.has(name))
  if (unreached !== undefined) throw new Error(`${unreached} is reached by no relationship`)
  return { parts, relationships: of }
}

/** The content type of a part by its name: its override, or its extension's default, as Part 2 reads them, without regard to case. */
function contentTypes(root: XmlNode): (name: string) => string | undefined {
  const defaults = new Map<string, string>()
  const overrides = new Map<string, string>()
  for (const each of childrenNamed(root, CONTENT_TYPES, 'Default'))
    defaults.set(required(each, 'Extension', '[Content_Types].xml').toLowerCase(), required(each, 'ContentType', '[Content_Types].xml'))
  for (const each of childrenNamed(root, CONTENT_TYPES, 'Override'))
    overrides.set(required(each, 'PartName', '[Content_Types].xml').toLowerCase(), required(each, 'ContentType', '[Content_Types].xml'))
  return (name) => overrides.get(`/${name}`.toLowerCase()) ?? defaults.get(name.slice(name.lastIndexOf('.') + 1).toLowerCase())
}

/** The part whose relationships the part `name` holds -- `''` for the package's own -- or undefined where `name` is no relationships part. */
function sourceOf(name: string): string | undefined {
  const match = /^(.*\/)?_rels\/([^/]*)\.rels$/.exec(name)
  return match === null ? undefined : `${match[1] ?? ''}${match[2]!}`
}

const relsName = (source: string): string => {
  const cut = source.lastIndexOf('/') + 1
  return `${source.slice(0, cut)}_rels/${source.slice(cut)}.rels`
}

function readRelationships(bytes: Uint8Array, source: string, parts: ReadonlyMap<string, Part>): Relationship[] {
  const name = relsName(source)
  const root = readPart(bytes, name, RELS)
  const ids = new Set<string>()
  return childrenNamed(root, RELATIONSHIPS, 'Relationship').map((each) => {
    const [id, type, written] = [required(each, 'Id', name), required(each, 'Type', name), required(each, 'Target', name)]
    if (ids.has(id)) throw new Error(`${name} holds the relationship ${id} twice`)
    ids.add(id)
    const mode = each.attributes.get('TargetMode') ?? 'Internal'
    if (mode !== 'Internal') throw new Error(`${name}: the relationship ${id} leads outside the package`)
    const target = resolve(source, written)
    if (target === undefined || !parts.has(target)) throw new Error(`${name}: the relationship ${id} leads to no part of the package`)
    return { id, type, target }
  })
}

/** `target` as a part's name, read from the folder of `source`, or from the package's root where it starts with a slash; undefined where it climbs out or is no path. */
function resolve(source: string, target: string): string | undefined {
  if (/[:?#\\]/.test(target) || target === '') return undefined
  const steps = target.startsWith('/') ? [] : source.split('/').slice(0, -1)
  for (const step of target.replace(/^\//, '').split('/')) {
    if (step === '' || step === '.') return undefined
    if (step === '..') {
      if (steps.length === 0) return undefined
      steps.pop()
    } else steps.push(step)
  }
  return steps.join('/')
}

/** The one child of `node` named `local` in `uri`; throws where there is none. */
export function only(node: XmlNode, uri: string, local: string, name: string): XmlNode {
  const found = child(node, uri, local)
  if (found === undefined) throw new Error(`${name}: ${node.local} holds no ${local}`)
  return found
}
