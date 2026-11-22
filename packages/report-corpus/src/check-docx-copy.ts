import { readCopyLabel } from '@formancy/report-runtime'
import type { Block, ResolvedDocument } from './document.js'
import type { Docx, DocxRegion } from './docx/model.js'
import type { ExpectedRefusal } from './fixture.js'

/**
 * A copy of an e-invoice held to what a Word file states for it (0077,
 * extending 0068 and 0003), by the corpus's own reading of that record:
 * the document's page header opens with the runtime's label of a copy,
 * and every header the file states -- the one every page of the report's
 * section prints, page 1's own where that section has one, and the one
 * of a slip's page where the file has a second section -- opens with a
 * paragraph of those words alone, at 8 pt, bold and in the label's red.
 * A page of the file that printed the invoice's page without it would be
 * a picture of an invoice that says nothing of what it is.
 *
 * Which words they are is the runtime's (`readCopyLabel`); how a file
 * states them is read here from the file.
 *
 * On a slip's page the label is the header's one paragraph, 5 mm in from
 * the paper's sides, which the page's own margins, none, would otherwise
 * put at the paper's edge; the header's distance from the paper's top is
 * `check-docx-slip.ts`'s to hold, with the page.
 *
 * What it cannot show is that Word prints a header on every page: that
 * is Word's, and nothing here opens the file in it. Nor that the file
 * embeds no invoice: it cannot, by the reader's closed vocabulary, which
 * refuses a part no relationship reaches, a relationship of a type a
 * file does not hold and one that leads outside the package
 * (`docx/package.ts`, `docx/read.ts`).
 */

const mm = (value: number): number => (value * 72) / 25.4

/** Where a copy's label stands on a slip's page: 5 mm from the paper's top and sides, the margin SIX keeps clear around a slip's sections. */
export const COPY_LABEL_INSET = mm(5)

/** What the label is printed in, as the runtime writes every label: small, bold, red. */
const LOOK = { size: 8, color: '#b00020' } as const

const NEAR = 0.026

/** The words every header of `document`'s file opens with where it is a copy of an e-invoice; undefined where it is none. */
export function copyWords(document: ResolvedDocument): string | undefined {
  const run = readCopyLabel(document.pageHeader)?.paragraph.runs[0]
  return run !== undefined && 'text' in run ? run.text : undefined
}

/** What is wrong with `region` as a header that opens with the label `words`; nothing where it does. */
function labelProblems(where: string, region: DocxRegion | undefined, words: string): string[] {
  if (region === undefined) return [`${where} is missing, where every page of a copy says that it is one`]
  const first = region.blocks[0]
  const run = first?.kind === 'paragraph' && first.runs.length === 1 ? first.runs[0] : undefined
  if (run?.kind !== 'text' || run.text !== words) return [`${where} does not open with the label of a copy, alone in its paragraph`]
  const { size, bold, italic, color, shift } = run.props
  return size === LOOK.size && bold && !italic && color === LOOK.color && shift === undefined
    ? []
    : [`${where} prints the label of a copy otherwise than at ${LOOK.size} pt, bold and in ${LOOK.color}`]
}

/** What `docx` states otherwise than a copy of an e-invoice is written: nothing where `document` is no copy. */
export function copyProblems(document: ResolvedDocument, docx: Docx): string[] {
  const words = copyWords(document)
  if (words === undefined) return []
  const { slip } = docx
  const problems = [
    ...labelProblems('the page header', docx.header, words),
    ...(docx.page.titlePage || docx.firstHeader !== undefined ? labelProblems("page 1's own header", docx.firstHeader, words) : []),
  ]
  if (slip === undefined) return problems
  const where = "the header of the slip's page"
  const stated = labelProblems(where, slip.header, words)
  if (stated.length > 0 || slip.header === undefined) return [...problems, ...stated]
  const [label, ...more] = slip.header.blocks
  if (more.length > 0 || slip.header.part === docx.header?.part)
    problems.push(`${where} holds more than the label of a copy, or is the report's own, whose height nobody measured above the slip`)
  if (label?.kind === 'paragraph' && (Math.abs(label.indent - COPY_LABEL_INSET) > NEAR || Math.abs(label.indentRight - COPY_LABEL_INSET) > NEAR))
    problems.push(`${where} sets the label ${label.indent} and ${label.indentRight} pt in from the paper's sides, where it stands 5 mm in`)
  return problems
}

/**
 * The refusal a Word file's writer owes a document whose headers are
 * labelled as a copy otherwise than the runtime labels one, or undefined
 * where it owes none: the page header's label printed otherwise than as
 * written, or missing where page 1's own header carries one; then page
 * 1's own header, where the document has one, opening with anything but
 * the page header's label as written.
 */
export function copyRefusal(document: ResolvedDocument): ExpectedRefusal | undefined {
  const label = readCopyLabel(document.pageHeader)
  const first: readonly Block[] | undefined = document.firstPageHeader
  const own = first === undefined ? undefined : readCopyLabel(first)
  if (label === undefined ? own !== undefined : !label.asWritten) return { code: 'unsupported', subject: 'pageHeader' }
  if (label !== undefined && first !== undefined && !(own?.asWritten === true && own.paragraph === label.paragraph))
    return { code: 'unsupported', subject: 'firstPageHeader' }
  return undefined
}
