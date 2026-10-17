import { RenderRefusal, type Block, type Columns, type QrCode, type Rectangle, type ResolvedDocument, type Section, type Table, type TextStyle } from '../document.js'

/**
 * What the document grew after the renderer trial, which neither trial
 * adapter draws: columns, sections, rectangles, QR codes, a payment part,
 * fonts but the sans, colour, rules of another weight or colour, and table
 * rows and cells with styles of their own or running across the table. Both adapters
 * refuse it here, as `unsupported` and naming where it stands, before they
 * build anything: a block skipped or a style ignored would print a report
 * that is not the one asked for, with nothing to say so.
 *
 * The trial's findings stand on the document it ran on (0005). Drawing the
 * rest is the renderer's, judged on the same corpus. An image's fit is each
 * adapter's own check, since only they read an image's pixels.
 */

/** The blocks the trial's document did not have. */
export type Undrawn = Columns | Section | Rectangle | QrCode

/** The weight both trial adapters draw a rule at: `RULE` in `pdfmake-content.ts`, `RULE_WEIGHT` in `pdfme.ts`. */
const TRIAL_RULE = 0.5

/** The colour both trial adapters print text and rules in. */
const BLACK = '#000000'

export function isUndrawn(block: Block): block is Undrawn {
  return block.kind === 'columns' || block.kind === 'section' || block.kind === 'rectangle' || block.kind === 'qrCode'
}

/** Refuses the first thing in `document` that neither trial adapter draws: a payment part, then what the page regions and the body hold. */
export function refuseUndrawn(document: ResolvedDocument): void {
  const bill = document.paymentPart === undefined ? undefined : { message: 'the document has a payment part', subject: 'paymentPart' }
  const problem = bill ?? problemIn(document.pageHeader, 'pageHeader') ?? problemIn(document.pageFooter, 'pageFooter') ?? problemIn(document.body, 'body')
  if (problem !== undefined) throw new RenderRefusal('unsupported', `${problem.message}; the trial's document had no such thing, and neither trial adapter draws it`, problem.subject)
}

interface Problem {
  readonly message: string
  readonly subject: string
}

function problemIn(blocks: readonly Block[], path: string): Problem | undefined {
  for (const [index, block] of blocks.entries()) {
    const at = `${path}[${index}]`
    const problem = problemOf(block, at)
    if (problem !== undefined) return problem
  }
  return undefined
}

function problemOf(block: Block, at: string): Problem | undefined {
  if (isUndrawn(block)) return { message: `${at} is a ${block.kind} block`, subject: at }
  if (block.kind === 'keepTogether') return problemIn(block.blocks, `${at}.blocks`)
  if (block.kind === 'paragraph') {
    const problem = styleProblem(block.style)
    return problem === undefined ? undefined : { message: `${at} is ${problem}`, subject: at }
  }
  if (block.kind === 'rule' && (block.thickness !== TRIAL_RULE || (block.color ?? BLACK) !== BLACK)) {
    return { message: `${at} is a rule of ${block.thickness} pt in ${block.color ?? 'the default colour'}, not ${TRIAL_RULE} pt in black`, subject: at }
  }
  if (block.kind === 'table') return tableProblem(block)
  return undefined
}

/** What a paragraph's style asks for that the trial did not draw: another font, or a colour. */
function styleProblem(style: TextStyle | undefined): string | undefined {
  if (style?.font !== undefined && style.font !== 'sans') return `set in the ${style.font} font`
  if (style?.color !== undefined && style.color !== BLACK) return `printed in ${style.color}`
  return undefined
}

/** The trial's adapters set every cell of a table in their own fixed style, and every row in its columns. */
function tableProblem(table: Table): Problem | undefined {
  const subject = table.id
  if (table.headerStyle !== undefined) return { message: `table ${table.id} styles its header`, subject }
  const row = table.rows.findIndex((each) => each.style !== undefined || each.cellStyles !== undefined || each.across === true)
  if (row < 0) return undefined
  const what = table.rows[row]!.across === true ? 'runs across the table' : 'has a style of its own'
  return { message: `row ${row} of table ${table.id} ${what}`, subject }
}
