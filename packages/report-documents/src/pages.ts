import { decodedBytes, type InflateBudget } from './inflate.js'
import { isArray, isDict, isRef, isStream, resolved, type PdfDict, type PdfObjects, type PdfStream, type PdfValue } from './model.js'
import type { ParsedDocument } from './parse.js'
import { caught, onPage, refuse, type DocumentRefusal } from './refusals.js'

/**
 * Each page of a document as a viewer shows it (ISO 32000-1 7.7.3.3): the
 * box it shows -- its CropBox within its MediaBox, corners ordered --
 * turned by its /Rotate, at the size its /UserUnit gives, drawing its
 * content with its resources. The tree is the parse's, walked once and
 * checked there (page-tree.ts): its pages are read here in its order and
 * it is never walked again. A document whose catalog says it has layers is
 * refused here; anything a page draws with that is marked as a layer is
 * the closure's to refuse (closure.ts). A refusal found while a page is
 * read names the page.
 */

/** A page's turn, clockwise, as a viewer shows it. */
export type Rotation = 0 | 90 | 180 | 270

/** A transformation matrix, as PDF writes one. */
export type Matrix = readonly [a: number, b: number, c: number, d: number, e: number, f: number]

/** An annotation's appearance, drawn over its page as `q matrix cm /Name Do Q`: the form keeps its own /Matrix, which Do applies. */
export interface FlattenedAppearance {
  readonly form: PdfStream
  readonly matrix: Matrix
}

export interface PrintablePage {
  /** The page as a viewer shows it: its CropBox within its MediaBox, corners ordered, in the page's own units. */
  readonly box: readonly [x0: number, y0: number, x1: number, y1: number]
  readonly rotate: Rotation
  /** /UserUnit, 1 where absent. */
  readonly userUnit: number
  /** The size it is shown at, in points: the box turned by `rotate`, times `userUnit`. */
  readonly width: number
  readonly height: number
  /** Its content streams, decoded and joined by a newline where it has several; as encoded where it has one. */
  readonly content: PdfStream
  /** Its /Resources, inherited where the page has none. */
  readonly resources: PdfDict
  /** Its /Group, a transparency group's attributes, where it has one. */
  readonly group?: PdfDict
  /** Its annotations' appearances, flattened into what prints: none until the annotations are read. */
  readonly appearances: readonly FlattenedAppearance[]
}

type Box = PrintablePage['box']

/** What a page takes from the nearest node above it that holds it (ISO 32000-1 7.7.3.4). */
const INHERITED = ['MediaBox', 'CropBox', 'Resources', 'Rotate'] as const
type Inherited = { readonly [Key in (typeof INHERITED)[number]]?: PdfValue }

/** `above`, with what `dict` holds of its own in its place. */
function within(dict: PdfDict, above: Inherited): Inherited {
  if (!INHERITED.some((key) => dict.entries.has(key))) return above
  const held: { [Key in (typeof INHERITED)[number]]?: PdfValue } = { ...above }
  for (const key of INHERITED) {
    const value = dict.entries.get(key)
    if (value !== undefined) held[key] = value
  }
  return held
}

/**
 * What each page inherits, every node of the tree read once: a page's
 * climb up its /Parent stops at the first node an earlier climb read, so
 * that a thousand pages under a chain of a hundred thousand nodes cost a
 * hundred thousand steps and not a hundred million. The walk held every
 * /Parent to the node that holds it, so every climb ends at the root.
 */
class Inheritance {
  private readonly objects: PdfObjects
  private readonly nodes = new Map<number, Inherited>()

  constructor(objects: PdfObjects) {
    this.objects = objects
  }

  of(page: PdfDict): Inherited {
    const climbed: (readonly [number, PdfDict])[] = []
    let above: Inherited = {}
    let parent = page.entries.get('Parent')
    while (isRef(parent)) {
      const known = this.nodes.get(parent.object)
      if (known !== undefined) {
        above = known
        break
      }
      const node = this.objects.get(parent.object) as PdfDict
      climbed.push([parent.object, node])
      parent = node.entries.get('Parent')
    }
    for (const [num, node] of climbed.reverse()) {
      above = within(node, above)
      this.nodes.set(num, above)
    }
    return within(page, above)
  }
}

/** A rectangle written as four numbers, its corners ordered. The grammar reads no number that is not finite. */
function boxOf(objects: PdfObjects, value: PdfValue | undefined): Box {
  const box = resolved(objects, value)
  if (!isArray(box) || box.length !== 4) refuse('box')
  const [a, b, c, d] = box.map((item) => {
    const n = resolved(objects, item)
    return typeof n === 'number' ? n : refuse('box')
  }) as [number, number, number, number]
  return [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)]
}

/** What a page shows: its CropBox, where it has one, within its MediaBox, which it must have. */
function shownBox(objects: PdfObjects, inherited: Inherited): Box {
  const media = boxOf(objects, inherited.MediaBox)
  const crop = inherited.CropBox === undefined ? media : boxOf(objects, inherited.CropBox)
  const shown: Box = [Math.max(media[0], crop[0]), Math.max(media[1], crop[1]), Math.min(media[2], crop[2]), Math.min(media[3], crop[3])]
  if (shown[2] <= shown[0] || shown[3] <= shown[1]) refuse('area')
  return shown
}

/** A turn by a multiple of 90 degrees, either way and by any number of turns, as the quarter turn it comes to. */
function rotationOf(value: PdfValue | PdfStream | undefined): Rotation {
  if (value === undefined) return 0
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value % 90 !== 0) refuse('rotation')
  return (((value % 360) + 360) % 360) as Rotation
}

/** How many points a unit of the page is, 1 where it does not say. */
function unitOf(value: PdfValue | PdfStream | undefined): number {
  if (value === undefined) return 1
  if (typeof value !== 'number' || value <= 0) refuse('user-unit')
  return value
}

/** A stream as its file encodes it, with the filters that decode it and nothing else of its dictionary: its /Length is the writer's to give. */
function kept(stream: PdfStream): PdfStream {
  const entries = new Map<string, PdfValue>()
  for (const key of ['Filter', 'DecodeParms']) {
    const value = stream.dict.entries.get(key)
    if (value !== undefined) entries.set(key, value)
  }
  return { dict: { entries }, bytes: stream.bytes }
}

/** `bytes` of content the pages hold -- again, or joining two streams -- taken from `budget`, refused in words of their own once it is spent. */
function spend(budget: InflateBudget, bytes: number): void {
  budget.left -= bytes
  if (budget.left < 0) refuse('repeated')
}

/** The content of a page that draws nothing. */
const empty = (): PdfStream => ({ dict: { entries: new Map() }, bytes: new Uint8Array(0) })

/** Streams' bytes, a newline between each and the next, so that the last token of one never runs into the first of the next. */
function joined(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, parts.length - 1))
  let at = 0
  for (const [i, part] of parts.entries()) {
    if (i > 0) out[at++] = 0x0a
    out.set(part, at)
    at += part.length
  }
  return out
}

/**
 * The pages of one document, read in order: what they inherit, and their
 * content, held to the document's budget all of it together. Each content
 * stream is decoded once and charged what its filters write -- nothing for
 * a stream the file holds unfiltered, whose bytes are the file's own; each
 * later hold of its bytes -- by another page, or again in one list -- and
 * each newline that joins them is charged again as it is met, so that what
 * the pages hold passes `MAX_DOCUMENT_INFLATED` by no more than the file's
 * unfiltered content once, and a list past it stops where the budget ends.
 */
class Pages {
  private readonly objects: PdfObjects
  private readonly budget: InflateBudget
  private readonly inheritance: Inheritance
  /** Each content stream decoded, by its number. */
  private readonly decoded = new Map<number, Uint8Array>()
  /** The content streams a page holds already, whose next hold is charged. */
  private readonly held = new Set<number>()
  /** Each content built, by what a /Contents names: the same stream or list is the same content, built once. */
  private readonly contents = new Map<PdfStream | readonly PdfValue[], PdfStream>()

  constructor(parsed: ParsedDocument) {
    this.objects = parsed.objects
    this.budget = parsed.budget
    this.inheritance = new Inheritance(parsed.objects)
  }

  /**
   * A page's own keys refuse a reference that names no object, which ISO
   * 32000-1 7.3.10 reads as null and the closure passes over: a box, a turn,
   * a unit, content, resources or a group that names nothing is a damaged
   * page, where a reference deep in a resource that names nothing draws
   * nothing.
   */
  page(num: number): PrintablePage {
    const objects = this.objects
    const dict = objects.get(num) as PdfDict
    const inherited = this.inheritance.of(dict)
    const box = shownBox(objects, inherited)
    const rotate = rotationOf(resolved(objects, inherited.Rotate))
    const userUnit = unitOf(resolved(objects, dict.entries.get('UserUnit')))
    const turned = rotate === 90 || rotate === 270
    const content = this.content(dict.entries.get('Contents'))
    // None anywhere above the page: it draws with none, as every viewer reads it.
    const resources = inherited.Resources === undefined ? { entries: new Map() } : resolved(objects, inherited.Resources)
    if (!isDict(resources)) refuse('resources')
    const group = resolved(objects, dict.entries.get('Group'))
    if (group !== undefined && !isDict(group)) refuse('group')
    return {
      box,
      rotate,
      userUnit,
      width: (turned ? box[3] - box[1] : box[2] - box[0]) * userUnit,
      height: (turned ? box[2] - box[0] : box[3] - box[1]) * userUnit,
      content,
      resources,
      ...(group === undefined ? {} : { group }),
      appearances: [],
    }
  }

  /** A page's content, built once for what its /Contents names and charged again for every page that holds it. */
  private content(value: PdfValue | undefined): PdfStream {
    if (value === undefined) return empty()
    // One stream, or a list of them; anything else is content no two viewers draw alike.
    const target = resolved(this.objects, value)
    if (!isStream(target) && !isArray(target)) refuse('contents')
    const known = this.contents.get(target)
    if (known !== undefined) {
      spend(this.budget, known.bytes.length)
      return known
    }
    const content = this.built(isStream(target) ? [value] : target)
    this.contents.set(target, content)
    return content
  }

  /**
   * A content from the streams a page lists: none an empty page (ISO
   * 32000-1 7.7.3.3), one kept as encoded, several decoded and joined. A
   * lone stream is decoded too, so that what it inflates to is held to the
   * budget here, not in a viewer of the report.
   */
  private built(list: readonly PdfValue[]): PdfStream {
    const [first] = list
    if (list.length === 0) return empty()
    if (list.length === 1) {
      const [num, stream] = this.stream(first)
      this.decode(num, stream)
      this.hold(num, stream.bytes.length)
      return kept(stream)
    }
    const parts: Uint8Array[] = []
    for (const item of list) {
      const [num, stream] = this.stream(item)
      if (parts.length > 0) spend(this.budget, 1)
      const bytes = this.decode(num, stream)
      this.hold(num, bytes.length)
      parts.push(bytes)
    }
    return { dict: { entries: new Map() }, bytes: joined(parts) }
  }

  /** The content stream a list names by reference, and its number. */
  private stream(item: PdfValue | undefined): readonly [number, PdfStream] {
    if (!isRef(item)) refuse('contents')
    const stream = this.objects.get(item.object)
    return isStream(stream) ? [item.object, stream] : refuse('contents')
  }

  /** A stream's bytes held by a page: the first hold is what its decode charged, every later one is charged again. */
  private hold(num: number, length: number): void {
    if (this.held.has(num)) spend(this.budget, length)
    else this.held.add(num)
  }

  private decode(num: number, stream: PdfStream): Uint8Array {
    const known = this.decoded.get(num)
    if (known !== undefined) return known
    const bytes = decodedBytes(stream, this.budget)
    this.decoded.set(num, bytes)
    return bytes
  }
}

/** Internal: every page in order, or why not. */
export function pagesOf(parsed: ParsedDocument): readonly PrintablePage[] | DocumentRefusal {
  return caught(() => {
    if (parsed.catalog.entries.has('OCProperties')) refuse('layers')
    const pages = new Pages(parsed)
    return parsed.pages.map((num, i) => onPage(i + 1, () => pages.page(num)))
  })
}
