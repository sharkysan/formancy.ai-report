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

/** What a document holds that does not survive printing, each counted where the pages list it, every time they list it. */
export const DOCUMENT_NOTICE_CODES = [
  /** Each Link annotation, printed or not: it prints as the appearance it holds, where it holds one, and follows nowhere. */
  'links',
  /** Each script the catalog names (/Names /JavaScript), and an /OpenAction that runs one. */
  'javascript',
  /** Each /AA -- the catalog's, a page's, an annotation's -- and an /OpenAction of any other kind; a destination it opens at is none. */
  'actions',
  /** Each file the catalog embeds (/Names /EmbeddedFiles), and each FileAttachment annotation. */
  'attachments',
  /** Each widget of a signature field that holds a value: printed, its appearance is a picture of the signature, which holds no more. */
  'signatures',
  /** Each other widget: printed as the appearance it holds, and filled in no more. */
  'form-fields',
  /** Each other annotation the print rule leaves out -- Hidden, or without Print -- that a viewer may show; a Popup is none. */
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
  const opened = resolved(objects, catalog.entries.get('OpenAction'))
  if (isDict(opened)) tally.add(isName(resolved(objects, opened.entries.get('S')), 'JavaScript') ? 'javascript' : 'actions')
  if (catalog.entries.has('AA')) tally.add('actions')
  return tally.notices()
}
