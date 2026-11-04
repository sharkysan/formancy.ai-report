import { isArray, isDict, isName, resolved, type PdfObjects, type PdfValue } from './model.js'
import type { ParsedDocument } from './parse.js'

/**
 * What a document holds that does not survive printing, said to whoever
 * adds it: Report prints a document's pages, and what a viewer does with
 * a document besides showing them -- following a link, running a script,
 * opening an attachment, filling a field, checking a signature -- the
 * report's PDF cannot do. Each is counted and never named: a script's
 * name, a file's name or a field's value may be a person's data.
 */

/**
 * What a document holds that does not survive printing. An annotation is
 * counted each time a page lists it, a field's actions once; `javascript`,
 * `actions` and `attachments` are counted from the catalog as well.
 */
export const DOCUMENT_NOTICE_CODES = [
  /** Each Link annotation, printed or not: it prints as the appearance it holds, where it holds one, and follows nowhere; its /A is the link, counted as one. */
  'links',
  /** Each script the catalog names (/Names /JavaScript), and each action that runs JavaScript (/S /JavaScript) wherever `actions` would count it. */
  'javascript',
  /**
   * Each other action: each an /AA holds under a trigger ISO 32000-1
   * defines -- the catalog's, a page's, an annotation's, a form field's,
   * once a field -- an annotation's /A but a link's, and an /OpenAction
   * other than one that opens a view, a destination or a GoTo. An
   * action's /Next is not followed.
   */
  'actions',
  /** Each file the catalog embeds (/Names /EmbeddedFiles), and each FileAttachment annotation. */
  'attachments',
  /** Each widget of a signature field that holds a value: printed, its appearance is a picture of the signature, which holds no more. */
  'signatures',
  /** Each other widget: printed as the appearance it holds, and filled in no more. */
  'form-fields',
  /** Each other annotation the print rule does not draw -- Hidden, without Print, or Invisible and of a subtype ISO does not define -- a Popup aside. */
  'unprinted-annotations',
] as const
export type DocumentNoticeCode = (typeof DOCUMENT_NOTICE_CODES)[number]

/**
 * How many of one kind of thing a document holds that does not survive
 * printing: a code and a count, never a name, a value or anything else
 * the file wrote. A kind it holds none of is no notice, so that a
 * document that loses nothing has none; the notices keep the codes' order.
 */
export interface DocumentNotice {
  readonly code: DocumentNoticeCode
  readonly count: number
}

/** Internal: the counts, kept as a document is read, and the notices they come to. */
export class Tally {
  private readonly counts = new Map<DocumentNoticeCode, number>()

  add(code: DocumentNoticeCode, count = 1): void {
    if (count > 0) this.counts.set(code, (this.counts.get(code) ?? 0) + count)
  }

  /** A notice for each code counted, in the codes' order. */
  notices(): readonly DocumentNotice[] {
    return DOCUMENT_NOTICE_CODES.flatMap((code) => {
      const count = this.counts.get(code)
      return count === undefined ? [] : [{ code, count }]
    })
  }
}

/**
 * The triggers of an additional-actions dictionary ISO 32000-1 defines: an
 * annotation's (Table 194), a page's (Table 195), a form field's (Table
 * 196) and the document's (Table 197). An /AA is read under these alone,
 * looked up by name and never walked: a key no viewer runs is no action,
 * and an /AA of a million keys costs no more than one of twenty.
 */
const TRIGGERS = ['E', 'X', 'D', 'U', 'Fo', 'Bl', 'PO', 'PC', 'PV', 'PI', 'O', 'C', 'K', 'F', 'V', 'WC', 'WS', 'DS', 'WP', 'DP'] as const

/** Internal: what an action counts as (ISO 32000-1 12.6): a script where it runs JavaScript, an action otherwise, and nothing where it is no action dictionary. */
export function actionOf(objects: PdfObjects, value: PdfValue | undefined): DocumentNoticeCode | undefined {
  const action = resolved(objects, value)
  if (!isDict(action)) return undefined
  return isName(resolved(objects, action.entries.get('S')), 'JavaScript') ? 'javascript' : 'actions'
}

/** Internal: what each action of an additional-actions dictionary counts as, under the triggers ISO defines; none where it is no dictionary. */
export function actionsIn(objects: PdfObjects, value: PdfValue | undefined): DocumentNoticeCode[] {
  const triggers = resolved(objects, value)
  if (!isDict(triggers)) return []
  return TRIGGERS.flatMap((trigger) => actionOf(objects, triggers.entries.get(trigger)) ?? [])
}

/**
 * The entries a name tree holds (ISO 32000-1 7.9.6): each leaf's pairs,
 * a key with no value none. Walked without recursion, each list read once
 * by what it is: a node is reached only through a list of kids, so that
 * kids that name one another end, a list of kids a thousand nodes share is
 * walked once and not a thousand times, and a list of names counted once
 * however many nodes hold it.
 */
function entriesOf(objects: PdfObjects, root: PdfValue | undefined): number {
  const seen = new Set<readonly PdfValue[]>()
  const nodes: (PdfValue | undefined)[] = [root]
  let count = 0
  while (nodes.length > 0) {
    const node = resolved(objects, nodes.pop())
    if (!isDict(node)) continue
    const names = resolved(objects, node.entries.get('Names'))
    const kids = resolved(objects, node.entries.get('Kids'))
    if (isArray(names) && !seen.has(names)) count += Math.floor(names.length / 2)
    if (isArray(kids) && !seen.has(kids)) for (const kid of kids) nodes.push(kid)
    for (const list of [names, kids]) if (isArray(list)) seen.add(list)
  }
  return count
}

/**
 * Internal: what the catalog holds that does not survive printing, counted
 * into `tally` beside what the pages counted, and the notices that comes
 * to. A count is said and nothing is refused: what it cannot read as ISO
 * 32000 writes it holds nothing to count.
 */
export function noticesOf(parsed: ParsedDocument, tally: Tally): readonly DocumentNotice[] {
  const { objects, catalog } = parsed
  const names = resolved(objects, catalog.entries.get('Names'))
  if (isDict(names)) {
    tally.add('javascript', entriesOf(objects, names.entries.get('JavaScript')))
    tally.add('attachments', entriesOf(objects, names.entries.get('EmbeddedFiles')))
  }
  // An open action that opens a view -- a destination, or a GoTo to one -- is lost in nothing a print shows;
  // a GoTo with a /Next runs what follows it, which is not followed, and so is counted as an action.
  const opened = resolved(objects, catalog.entries.get('OpenAction'))
  const view = isDict(opened) && isName(resolved(objects, opened.entries.get('S')), 'GoTo') && !opened.entries.has('Next')
  const action = view ? undefined : actionOf(objects, catalog.entries.get('OpenAction'))
  if (action !== undefined) tally.add(action)
  for (const code of actionsIn(objects, catalog.entries.get('AA'))) tally.add(code)
  return tally.notices()
}
