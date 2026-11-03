import { expect } from 'vitest'
import { letter, outcome, pagesFile, printed, type Body } from './pages-test-support.js'
import { refusal, type AnnotationPlace, type DocumentRefusal, type DocumentRefusalCode, type Finding } from './refusals.js'
import { CONTENT } from './test-pdf.js'

/**
 * What the annotations' and the notices' tests write and assert, once:
 * annotated pages written object by object, and a refusal that names the
 * annotation and the page where it was found and nothing of the file.
 * Never published: nothing in `index.ts` exports it.
 */

/** What `annotated` writes besides its annotations. */
export interface AnnotatedOptions {
  /** Objects beside the annotations, which may write any of them again; 20 and on are the annotations'. */
  readonly objects?: Readonly<Record<number, Body>>
  /** The page's own entries, besides its /Annots. */
  readonly page?: string
  /** The catalog's own entries. */
  readonly catalog?: string
}

/** A file of one US Letter page whose /Annots lists `annots`, objects 20, 21, … in order. */
export function annotated(annots: readonly Body[], { objects = {}, page = '', catalog = '' }: AnnotatedOptions = {}): Uint8Array {
  const listed = annots.map((_, i) => `${20 + i} 0 R`).join(' ')
  return pagesFile([letter(`/Annots[${listed}]${page}`)], { ...Object.fromEntries(annots.map((body, i) => [20 + i, body])), ...objects }, { catalog })
}

/** An annotation of `subtype`, its flags `flags` as written -- Print (4) unless said otherwise -- `entries` after. */
export const annotation = (subtype: string, entries: string, flags: number | string = 4): string => `<</Type/Annot/Subtype/${subtype}/F ${flags}${entries}>>`

/** A form field's widget, its flags `flags`, `entries` after. */
export const widget = (entries: string, flags = 4): string => annotation('Widget', entries, flags)

/** An appearance: a form XObject whose box is `bbox`, drawing a line, `entries` after. */
export const form = (bbox: string, entries = ''): Body => ({ dict: `/Type/XObject/Subtype/Form/BBox${bbox}${entries}`, data: CONTENT })

/** The words that place a refusal at `annotation` of `page`, as a person reads them. */
const placed = (page: number, { index, subtype }: AnnotationPlace): string =>
  `, annotation ${index}${subtype === undefined ? '' : ` (${subtype})`}, on page ${page};`

/**
 * That `bytes` are refused as `code`, for what `finding` says, at
 * `annotation` of `page`: the finding's words, then the annotation's place
 * and its subtype where ISO 32000 defines it, then the page, then the
 * code's advice, and nothing of the file -- no field's name or value, no
 * subtype the reader does not know.
 */
export function expectAnnotationRefused(bytes: Uint8Array, code: DocumentRefusalCode, finding: Finding, page: number, annotation: AnnotationPlace): void {
  const result = printed(bytes)
  expect(outcome(result)).toEqual(refusal(finding, page, annotation))
  expect(result).toMatchObject({ ok: false, code, page, annotation: annotation.index })
  const message = (result as DocumentRefusal).message
  expect(message).toContain(placed(page, annotation))
  expect(message.replace(placed(page, annotation), ';')).toMatch(/^[A-Za-z ,;'-]+$/)
}
