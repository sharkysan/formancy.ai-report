import { isAnnotationSubtype, type AnnotationSubtype } from './annotation-subtypes.js'
import { decodedBytes } from './inflate.js'
import { heldInlineImages, ownResources } from './inline-images.js'
import { LISTING_VALUES } from './limits.js'
import {
  isArray,
  isCount,
  isDict,
  isName,
  isRef,
  isStream,
  resolved,
  type PdfDict,
  type PdfName,
  type PdfObjects,
  type PdfStream,
  type PdfValue,
} from './model.js'
import { actionOf, actionsIn, type DocumentNoticeCode, type Tally } from './notices.js'
import type { FlattenedAppearance, Matrix, Rotation } from './pages.js'
import type { ParsedDocument } from './parse.js'
import type { InflateBudget } from './reading.js'
import { onAnnotation, refuse, type Finding } from './refusals.js'

/**
 * A page's annotations, flattened into what prints by the print rule (ISO
 * 32000-1 12.5.3): an annotation prints where its Print flag is set and
 * its Hidden flag clear -- and, of a subtype ISO does not define, its
 * Invisible flag clear -- as the appearance its file holds -- the form its
 * /AP /N names, or the one of its states /AS names -- placed over its
 * /Rect as ISO 32000-1 12.5.5 places it. What a print cannot draw as a
 * viewer shows it is refused: an annotation that prints over an area and
 * holds no appearance, or names a state it does not hold; one that stays
 * upright on a turned page; a link whose border a viewer draws; and one in
 * a layer. A form a viewer draws -- from XFA, or its fields afresh -- is
 * refused before any is read (`formAsks`). What does not survive printing
 * is counted in the notices (notices.ts) and never named: each link, form
 * field, signature and attachment as what it is, printed or not, each
 * other annotation the print rule leaves out, and every action an
 * annotation or a field holds. A Popup is never drawn by itself, and never
 * counted.
 *
 * Bounded by what the pages list, every page together: each listing is
 * counted on the document's one count of values, as `LISTING_VALUES`, and
 * read at a constant cost -- an annotation listed many times is read once
 * -- every field above a widget is read once, and each appearance's form
 * is decoded once, from the document's one budget, and its inline images
 * held with its own resources (inline-images.ts).
 */

/** The flags the print rule reads (ISO 32000-1 Table 165). */
const INVISIBLE = 1
const HIDDEN = 2
const PRINT = 4
const NO_ROTATE = 16

/** The code an annotation that is no widget is counted under for what it is. A Map, not an object's keys: /constructor would find what an object's prototype holds. */
const KINDS: ReadonlyMap<string, DocumentNoticeCode> = new Map([
  ['Link', 'links'],
  ['FileAttachment', 'attachments'],
])

type Box = readonly [x0: number, y0: number, x1: number, y1: number]

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

/** What `dict` holds under `key`, a reference resolved one level, and a reference to no object -- null (ISO 32000-1 7.3.10) -- nothing. */
function entry(objects: PdfObjects, dict: PdfDict, key: string): PdfValue | PdfStream | undefined {
  return resolved(objects, dict.entries.get(key)) ?? undefined
}

/** `count` numbers, each resolved one level, or refused for what `finding` says. The grammar reads no number that is not finite. */
function numbers(objects: PdfObjects, value: PdfValue | PdfStream | undefined, count: number, finding: Finding): number[] {
  if (!isArray(value) || value.length !== count) refuse(finding)
  return value.map((item) => {
    const n = resolved(objects, item)
    return typeof n === 'number' ? n : refuse(finding)
  })
}

const hasArea = (box: Box): boolean => box[2] > box[0] && box[3] > box[1]

/** An annotation's /Rect, its corners ordered. */
function rectOf(objects: PdfObjects, annot: PdfDict): Box {
  const [a, b, c, d] = numbers(objects, entry(objects, annot, 'Rect'), 4, 'rect') as [number, number, number, number]
  return [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)]
}

/**
 * The upright box a form covers in the space it is drawn into: its /BBox's
 * corners under its /Matrix, the identity where it has none (ISO 32000-1
 * 12.5.5, step 1). Each number is written in at most 32 characters
 * (`MAX_DOCUMENT_NUMBER_LENGTH`), below 10^32 and, but for 0, no nearer it
 * than 10^-31, so that every product, sum and quotient of them here and in
 * `placed` stays finite.
 */
function coveredBy(objects: PdfObjects, form: PdfStream): Box {
  const [x0, y0, x1, y1] = numbers(objects, entry(objects, form.dict, 'BBox'), 4, 'bbox') as [number, number, number, number]
  const written = entry(objects, form.dict, 'Matrix')
  const [a, b, c, d, e, f] = written === undefined ? IDENTITY : (numbers(objects, written, 6, 'matrix') as unknown as Matrix)
  const corners = [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ] as const
  const xs = corners.map(([x, y]) => a * x + c * y + e)
  const ys = corners.map(([x, y]) => b * x + d * y + f)
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

/** The matrix that scales and moves the box a form covers onto its annotation's rectangle (ISO 32000-1 12.5.5, step 2): Do applies the form's own /Matrix after it. */
function placed(rect: Box, covered: Box): Matrix {
  const sx = (rect[2] - rect[0]) / (covered[2] - covered[0])
  const sy = (rect[3] - rect[1]) / (covered[3] - covered[1])
  return [sx, 0, 0, sy, rect[0] - covered[0] * sx, rect[1] - covered[1] * sy]
}

/** An annotation's flags, none where it gives none. */
function flagsOf(value: PdfValue | PdfStream | undefined): number {
  if (value === undefined) return 0
  return isCount(value) ? value : refuse('flags')
}

/** Whether `subtype` is a name ISO 32000 defines for an annotation. */
const defined = (subtype: PdfValue | PdfStream | undefined): subtype is PdfName => isName(subtype) && isAnnotationSubtype(subtype.name)

/** Whether the print rule draws an annotation (ISO 32000-1 Table 165): Print set and Hidden clear, and, of a subtype ISO does not define, Invisible clear. */
function printed(flags: number, subtype: PdfValue | PdfStream | undefined): boolean {
  if ((flags & HIDDEN) !== 0 || (flags & PRINT) === 0) return false
  return (flags & INVISIBLE) === 0 || defined(subtype)
}

/**
 * Whether a viewer draws a link's border where it has no appearance (ISO
 * 32000-1 12.5.4, Table 164): its /BS's width where it has a /BS, else
 * /Border's third number, a point where it gives neither. Anything but a
 * width of 0 is a border, unless it has no colour -- /C an empty list,
 * transparent -- which draws nothing whatever its width.
 */
function borderDrawn(objects: PdfObjects, link: PdfDict): boolean {
  const colour = entry(objects, link, 'C')
  if (isArray(colour) && colour.length === 0) return false
  const style = entry(objects, link, 'BS')
  if (style !== undefined) return !isDict(style) || entry(objects, style, 'W') !== 0
  const border = entry(objects, link, 'Border')
  return !isArray(border) || resolved(objects, border[2]) !== 0
}

/** What the actions an annotation holds count as: its /A -- but a link's, which is the link, counted as one -- and each its /AA holds. */
function actionsOf(objects: PdfObjects, annot: PdfDict, subtype: PdfValue | PdfStream | undefined): DocumentNoticeCode[] {
  const own = isName(subtype, 'Link') ? undefined : actionOf(objects, annot.entries.get('A'))
  return [...(own === undefined ? [] : [own]), ...actionsIn(objects, annot.entries.get('AA'))]
}

/** The subtype a refusal names: one ISO 32000 defines, and nothing the file chose. */
function subtypeOf(objects: PdfObjects, annot: PdfValue | PdfStream | undefined): AnnotationSubtype | undefined {
  const subtype = isDict(annot) ? entry(objects, annot, 'Subtype') : undefined
  return defined(subtype) ? (subtype.name as AnnotationSubtype) : undefined
}

/**
 * What the document's form asks a viewer to do that a print of what its
 * fields hold cannot, if anything: draw the form from XFA -- packets under
 * its /AcroForm's /XFA, a list or a stream, or the catalog's
 * /NeedsRendering (ISO 32000-1 12.7.8) -- which Report does not draw, and
 * which is asked first; or draw its fields afresh (/NeedAppearances, ISO
 * 32000-1 12.7.2).
 */
export function formAsks(parsed: ParsedDocument): 'xfa' | 'need-appearances' | undefined {
  const { objects, catalog } = parsed
  const form = resolved(objects, catalog.entries.get('AcroForm'))
  const said = (key: string): PdfValue | PdfStream | undefined => (isDict(form) ? resolved(objects, form.entries.get(key)) : undefined)
  const xfa = said('XFA')
  if (isArray(xfa) || isStream(xfa) || resolved(objects, catalog.entries.get('NeedsRendering')) === true) return 'xfa'
  return said('NeedAppearances') === true ? 'need-appearances' : undefined
}

/** What a field says of itself, or the nearest field above it that says it (ISO 32000-1 12.7.3.1): its type, and whether it holds a value. */
interface Field {
  readonly type: PdfValue | PdfStream | undefined
  readonly valued: boolean
}

/** `above`, with what `node` says of its own in its place. */
function within(objects: PdfObjects, node: PdfDict, above: Field): Field {
  const type = node.entries.get('FT')
  return { type: type === undefined ? above.type : resolved(objects, type), valued: above.valued || node.entries.has('V') }
}

/**
 * The fields above widgets, each read once: a widget's climb up its
 * /Parent stops at the first field an earlier climb read, as a page's up
 * its tree does (pages.ts), so that a thousand widgets under a chain of ten
 * thousand fields cost ten thousand steps and not ten million, and each
 * field's /AA -- calculate, format, validate -- is counted once, as the
 * field is first read, however many widgets it has. A climb that reaches a
 * field it climbed already would never end, and is refused; a /Parent that
 * names no dictionary ends it.
 */
class Fields {
  private readonly objects: PdfObjects
  private readonly tally: Tally
  private readonly fields = new Map<number, Field>()

  constructor(objects: PdfObjects, tally: Tally) {
    this.objects = objects
    this.tally = tally
  }

  /** What a widget is counted as: a signature where its field is a signature field that holds a value, a form field otherwise. */
  kindOf(widget: PdfDict): DocumentNoticeCode {
    const climbed: (readonly [number, PdfDict])[] = []
    const seen = new Set<number>()
    let above: Field = { type: undefined, valued: false }
    let parent = widget.entries.get('Parent')
    while (isRef(parent)) {
      const known = this.fields.get(parent.object)
      if (known !== undefined) {
        above = known
        break
      }
      const node = this.objects.get(parent.object)
      if (!isDict(node)) break
      if (seen.has(parent.object)) refuse('fields')
      seen.add(parent.object)
      climbed.push([parent.object, node])
      parent = node.entries.get('Parent')
    }
    for (const [num, node] of climbed.reverse()) {
      above = within(this.objects, node, above)
      this.fields.set(num, above)
      for (const code of actionsIn(this.objects, node.entries.get('AA'))) this.tally.add(code)
    }
    const field = within(this.objects, widget, above)
    return isName(field.type, 'Sig') && field.valued ? 'signatures' : 'form-fields'
  }
}

/** A code, and how many of it one listing of an annotation counts. */
type Counted = readonly [code: DocumentNoticeCode, count: number]

/** What one annotation comes to, wherever a page lists it: what it is counted as, what it draws, and whether that stays upright on a turned page. */
interface Outcome {
  readonly counted: readonly Counted[]
  readonly drawn?: FlattenedAppearance
  readonly upright: boolean
}

/**
 * `codes` as a count of each, in the order they are first met: what each
 * listing of an annotation adds, so that a listing costs as many additions
 * as the kinds it is counted as -- at most three -- and not one for each of
 * the twenty-two actions it may hold. Two million listings of an annotation
 * of twenty-one actions took 1.5 s, one a code, against 0.5 s without them:
 * the median of five cold runs each, a fresh worker a run, Node 22.23.3 on
 * an Apple M2, at a load near 4, on 6 November 2026.
 */
function folded(codes: readonly DocumentNoticeCode[]): readonly Counted[] {
  const counts = new Map<DocumentNoticeCode, number>()
  for (const code of codes) counts.set(code, (counts.get(code) ?? 0) + 1)
  return [...counts]
}

const NOTHING: Outcome = { counted: [], upright: false }

/** Internal: the annotations of a document's pages, read page by page, what does not survive printing counted into a tally. */
export class Annotations {
  private readonly parsed: ParsedDocument
  private readonly objects: PdfObjects
  private readonly budget: InflateBudget
  private readonly tally: Tally
  private readonly fields: Fields
  /** What each annotation comes to, read once however many times the pages list it. */
  private readonly outcomes = new Map<PdfDict, Outcome>()
  /** The forms decoded and read for inline images already, each charged once however many annotations draw it. */
  private readonly decoded = new Set<PdfStream>()

  constructor(parsed: ParsedDocument, tally: Tally) {
    this.parsed = parsed
    this.objects = parsed.objects
    this.budget = parsed.budget
    this.tally = tally
    this.fields = new Fields(parsed.objects, tally)
  }

  /**
   * What a page's annotations print, in its /Annots' order, each counted
   * where it does not survive printing, and the actions of the page's own
   * /AA counted too. A page's own key refuses a reference that names no
   * object, as its others do (pages.ts); in its list, one is null, and no
   * annotation. Each listing, null or not, is counted on the document's one
   * count as `LISTING_VALUES` values, beside every value the file holds and
   * every decoder it builds, so that one list a thousand pages share is not
   * walked into a billion, and the pages' listings take no more than the
   * values bound leaves.
   */
  of(page: PdfDict, rotate: Rotation): readonly FlattenedAppearance[] {
    for (const code of actionsIn(this.objects, page.entries.get('AA'))) this.tally.add(code)
    const listing = page.entries.get('Annots')
    if (listing === undefined) return []
    const annots = resolved(this.objects, listing)
    if (!isArray(annots)) refuse('annots')
    const drawn: FlattenedAppearance[] = []
    for (const [i, item] of annots.entries()) {
      this.budget.reading.counted(LISTING_VALUES)
      const annot = resolved(this.objects, item)
      if (annot === null) continue
      const outcome = onAnnotation(
        i + 1,
        () => subtypeOf(this.objects, annot),
        () => this.listing(annot, rotate),
      )
      if (outcome.drawn !== undefined) drawn.push(outcome.drawn)
    }
    return drawn
  }

  /** An annotation where a page lists it: read once, counted and drawn each time, and refused on a turned page where it keeps upright. */
  private listing(annot: PdfValue | PdfStream | undefined, rotate: Rotation): Outcome {
    if (!isDict(annot)) refuse('annotation')
    let outcome = this.outcomes.get(annot)
    if (outcome === undefined) {
      outcome = this.read(annot)
      this.outcomes.set(annot, outcome)
    }
    for (const [code, count] of outcome.counted) this.tally.add(code, count)
    if (outcome.upright && rotate !== 0) refuse('upright')
    return outcome
  }

  /**
   * What an annotation comes to, by the print rule. It is counted as what
   * it is -- a link, a form field, a signature, an attachment -- whether it
   * prints or not, and otherwise, where the print rule leaves it out, as
   * an annotation that is not printed; each action it holds is counted
   * too, a script as a script (`actionsOf`). One that prints over no area
   * paints nothing whatever it holds, and needs no appearance (ISO 32000-2
   * Table 166); one over an area prints its appearance, or, a link that
   * holds none, nothing where its border is not drawn.
   */
  private read(annot: PdfDict): Outcome {
    const objects = this.objects
    if (annot.entries.has('OC')) refuse('layers')
    const subtype = entry(objects, annot, 'Subtype')
    if (isName(subtype, 'Popup')) return NOTHING
    const kind = this.kindOf(annot, subtype)
    const actions = actionsOf(objects, annot, subtype)
    const flags = flagsOf(entry(objects, annot, 'F'))
    if (!printed(flags, subtype)) return { counted: folded([kind ?? 'unprinted-annotations', ...actions]), upright: false }
    const counted = folded(kind === undefined ? actions : [kind, ...actions])
    const rect = rectOf(objects, annot)
    if (!hasArea(rect)) return { counted, upright: false }
    const form = this.appearance(annot)
    if (form === undefined) {
      if (!isName(subtype, 'Link')) refuse('no-appearance')
      if (borderDrawn(objects, annot)) refuse('link-border')
      return { counted, upright: false }
    }
    const covered = coveredBy(objects, form)
    if (!hasArea(covered)) return { counted, upright: false }
    if (!this.decoded.has(form)) {
      heldInlineImages(this.parsed, decodedBytes(form, this.budget), ownResources(objects, form), this.budget)
      this.decoded.add(form)
    }
    return { counted, drawn: { form, matrix: placed(rect, covered) }, upright: (flags & NO_ROTATE) !== 0 }
  }

  /** What an annotation is counted as for what it is: a widget as its field is, a link or an attachment as one; anything else as nothing. */
  private kindOf(annot: PdfDict, subtype: PdfValue | PdfStream | undefined): DocumentNoticeCode | undefined {
    if (!isName(subtype)) return undefined
    return subtype.name === 'Widget' ? this.fields.kindOf(annot) : KINDS.get(subtype.name)
  }

  /**
   * The form an annotation prints (ISO 32000-1 12.5.5): its normal
   * appearance, /AP /N, or the one of its states /AS names, looked up by
   * that name and never walked; none where it holds none. An /AP, an /N or
   * a state that is not what ISO writes there, or a stream that says it is
   * another kind of XObject than a form, is no appearance.
   */
  private appearance(annot: PdfDict): PdfStream | undefined {
    const objects = this.objects
    const appearances = entry(objects, annot, 'AP')
    if (appearances === undefined) return undefined
    if (!isDict(appearances)) refuse('no-appearance')
    let normal = entry(objects, appearances, 'N')
    if (normal === undefined) return undefined
    if (isDict(normal)) {
      const state = entry(objects, annot, 'AS')
      const chosen = isName(state) ? normal.entries.get(state.name) : undefined
      if (chosen === undefined) refuse('appearance-state')
      normal = resolved(objects, chosen)
    }
    if (!isStream(normal)) refuse('no-appearance')
    const subtype = entry(objects, normal.dict, 'Subtype')
    if (subtype !== undefined && !isName(subtype, 'Form')) refuse('no-appearance')
    return normal
  }
}
