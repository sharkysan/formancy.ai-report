/**
 * An SVG asset: cleaned once, when it is approved, into the one form the
 * renderer draws, and refused at print in any other (0030).
 *
 * `cleanSvg` runs where an asset is approved -- a host, and later a
 * builder's upload. It reads the file, removes what never draws and lists
 * it, refuses what would draw unsafely or otherwise than a browser draws
 * it, and writes the rest in the canonical form (`svg-write.ts`). The
 * approved asset is the bytes it returns, and its digest is theirs.
 *
 * `checkSvg` is the renderer's: it accepts bytes only when cleaning them
 * would change nothing -- when they are already exactly what `cleanSvg`
 * writes, and nothing would be removed. Nothing is dropped at print, so
 * what prints is in the approved form.
 *
 * One reader, here, because a host's approval, a builder's upload and the
 * renderer must all apply the same rules, and builder-core may import
 * report-spec alone of the packages that could hold them: a second copy
 * could disagree with the first, and nobody would find out until a logo
 * printed otherwise than it was approved.
 */
import { MAX_SVG_BYTES } from './limits.js'
import { styleTree } from './svg-computed.js'
import { costOf } from './svg-cost.js'
import { buildDrawing, type ViewBox } from './svg-drawing.js'
import type { SvgExtent } from './svg-extent.js'
import { refuse, Removals, type SvgRefusal, SvgRefused, type SvgRemoval } from './svg-refusal.js'
import { Stylesheet } from './svg-style.js'
import { readTree } from './svg-tree.js'
import { writeDrawing } from './svg-write.js'

export interface CleanSvg {
  readonly ok: true
  /** The canonical drawing: ASCII, what the approved asset holds. */
  readonly bytes: Uint8Array
  /** The drawing's own coordinates: what `contain` and `cover` keep the proportions of. */
  readonly viewBox: ViewBox
  /** What it costs a reader to paint, in the weighted segments `MAX_SVG_SEGMENTS` bounds. */
  readonly segments: number
  /** The transparency groups it makes, in the units `MAX_SVG_GROUPS` bounds. */
  readonly groups: number
  /** What the converter draws each time it draws it -- moves, lines and closes; curves; elements read, a clip path's for every element it clips; gradient stops written, a gradient's for every shape painted with it -- for the renderer's budget across pages. */
  readonly drawn: { readonly lines: number; readonly curves: number; readonly elements: number; readonly stops: number }
  /** How far the numbers svg-to-pdfkit writes for it reach wherever it is placed, and how deep it nests the graphics state: what the renderer holds an image of it to in an e-invoice's PDF/A-3 (`svg-extent.ts`). */
  readonly extent: SvgExtent
  /** What cleaning removed, by kind and name with a count: names only, never a value; the first `MAX_SVG_REMOVED_NAMES` names. */
  readonly removed: readonly SvgRemoval[]
  /** Removals of names past those listed, counted. */
  readonly removedMore: number
}

/** What `checkSvg` accepts: the drawing, which cleaning would not change. */
export type CheckedSvg = Omit<CleanSvg, 'removed' | 'removedMore'>

export function cleanSvg(bytes: Uint8Array): CleanSvg | SvgRefusal {
  try {
    return clean(bytes)
  } catch (error) {
    if (error instanceof SvgRefused) return { ok: false, code: error.code, message: error.message }
    throw error
  }
}

function clean(bytes: Uint8Array): CleanSvg {
  if (!(bytes instanceof Uint8Array)) refuse('not-svg', 'the asset has no bytes', 'hand it the bytes of the file')
  if (bytes.length > MAX_SVG_BYTES) refuse('too-large', `the file is ${bytes.length} bytes; the limit is ${MAX_SVG_BYTES}`)
  const removals = new Removals()
  const document = readTree(bytes, removals)
  const sheet = new Stylesheet(document.styles, removals)
  const drawing = buildDrawing(document, styleTree(document.root, sheet, removals), removals)
  const { segments, groups, drawn, extent } = costOf(drawing)
  const text = writeDrawing(drawing)
  if (text.length > MAX_SVG_BYTES) refuse('too-large', `the cleaned drawing would be ${text.length} bytes; the limit is ${MAX_SVG_BYTES}`)
  const written = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i += 1) written[i] = text.charCodeAt(i)
  return { ok: true, bytes: written, viewBox: drawing.viewBox, segments, groups, drawn, extent, removed: removals.list(), removedMore: removals.more }
}

/** The renderer's check: the drawing, when `bytes` are already what `cleanSvg` writes; refused naming the first difference otherwise. */
export function checkSvg(bytes: Uint8Array): CheckedSvg | SvgRefusal {
  const cleaned = cleanSvg(bytes)
  if (!cleaned.ok) return cleaned
  const { removed, removedMore: _, ...checked } = cleaned
  const [first] = removed
  if (first !== undefined) {
    const what = first.kind === first.name ? `a ${first.kind}` : `the ${first.kind} ${first.name}`
    return { ok: false, code: 'unsupported', message: `the drawing holds ${what}, which cleaning removes; clean it with cleanSvg first` }
  }
  const length = Math.min(bytes.length, checked.bytes.length)
  let at = 0
  while (at < length && bytes[at] === checked.bytes[at]) at += 1
  if (at < length || bytes.length !== checked.bytes.length)
    return { ok: false, code: 'unsupported', message: `the drawing is not in the form cleanSvg writes, from byte ${at}; clean it with cleanSvg first` }
  return checked
}
