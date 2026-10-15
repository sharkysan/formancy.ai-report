import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { getDynamicTemplate, MM_TO_PT_RATIO, PDFME_VERSION, type BlankPdf, type Font, type Plugins, type Schema, type Template } from '@pdfme/common'
import { generate } from '@pdfme/generator'
import { image, line, table, text } from '@pdfme/schemas'
import { getDynamicLayoutForSchema } from '@pdfme/schemas/dynamicLayout'
import type { CellStyle, ImageSchema, LineSchema, TableSchema, TextSchema } from '@pdfme/schemas/types'
import { escapeInlineMarkdown, measureTextHeight } from '@pdfme/schemas/utils'
import { pageDimensions, RenderRefusal, type Block, type EngineAdapter, type Image, type Paragraph, type RenderOptions, type ResolvedDocument, type Table } from '../document.js'
import { checkedImages, type Pixels } from './pdfme-assets.js'
import { isUndrawn, refuseUndrawn } from './undrawn.js'

/**
 * The renderer trial's pdfme adapter: a resolved document as a pdfme
 * template, rendered by pdfme 6.2.4.
 *
 * pdfme is a template engine. A template is pages of boxes at absolute
 * positions in millimetres; on a blank base page -- a size and a padding,
 * which here are the paper and the space inside its margins left for the
 * body -- pdfme grows its "dynamic" boxes (tables, and text set to expand)
 * to their content and pushes every box below down by as much, splitting a
 * table between rows and a text between lines at the foot of a page, and
 * moving any other box whole to the next page when it does not fit. So the
 * body is a column of boxes stacked in document order, each page break
 * starts a template page of its own, and the page header and footer are the
 * base page's static boxes, which pdfme draws on every page, with
 * `{currentPage}` and `{totalPages}` filled in.
 *
 * What pdfme has no notion of, and this adapter does not pretend to:
 * - keeping a heading with what follows it: `keepWithNext` is not honoured,
 *   since nothing in pdfme moves a box because of the box after it, and no
 *   fixture's checks look for it;
 * - keeping a table row with the next one, which the group-boundary fixture
 *   fails on;
 * - continuing a table row taller than a page, which is refused as
 *   `content-too-large`.
 * A keep-together block is honoured only when it holds paragraphs alone,
 * which can be one text box that pdfme moves whole; anything else in one is
 * refused as `unsupported`.
 */

/** pdfme's own ratio from millimetres to points, which it multiplies by when it draws. */
const POINTS_PER_MM = MM_TO_PT_RATIO

/** Points as pdfme's millimetres, by the inverse of the ratio pdfme converts back with, so that a length reaches the PDF as the document gave it. */
function mm(points: number): number {
  return points / POINTS_PER_MM
}

/**
 * The type size of a paragraph that names none, and of every table cell: the
 * document leaves both to the engine. 9pt, the corpus's body size.
 */
const BODY_SIZE = 9

/** Each line 1.2 times its type size: Roboto's natural line is 1.17 (2400 of 2048 units), and 1.2 is the corpus's model. */
const LINE_HEIGHT = 1.2

/**
 * Roboto's descender, 500 of its 2048 units per em, as a fraction of the
 * type size. pdfme measures a text box to the ascender of its first line and
 * a line height for each line after it, so the last line's descenders hang
 * below the box it measured, over whatever comes next: an image set straight
 * after a heading had the heading's "g" drawn on it. Every text box carries
 * the descender as padding below its last line.
 */
const ROBOTO_DESCENDER = 500 / 2048

/** Between the page header and the body, and between the body and the page footer, in points. */
const REGION_GAP = 6

/** A table cell's padding above and below its text, and either side of it, in points. */
const CELL_PADDING = { vertical: 2, horizontal: 3 } as const

/** The weight of a rule, and of the line under a table's header row, in points. */
const RULE_WEIGHT = 0.5

/**
 * How far a placed box may reach past the foot of the body before it is
 * content that does not fit: pdfme's own tolerance when it decides a box
 * fits, in millimetres.
 */
const FIT = 0.01

/**
 * How far a width or height may differ from the one the document gives
 * before it is another size, in points: what an image drawn at its own
 * proportions may fall short by, and what columns or an image may exceed
 * the printable width by. Half a point, the checks' rounding allowance.
 */
const SIZE_TOLERANCE = 0.5

const PLUGINS: Plugins = { text, table, image, line }

/**
 * Roboto 3.014 from pdfmake's package, its four styles, each embedded as a
 * subset: SIL Open Font License 1.1, which allows embedding in a generated
 * PDF. Not pdfme's bundled default, which is Roboto 2.137 in its regular
 * weight only -- no bold -- and so that both engines in the trial set the
 * same font. Read from disk once, when first needed.
 */
const ROBOTO = { regular: 'Roboto', bold: 'Roboto-Medium', italic: 'Roboto-Italic', boldItalic: 'Roboto-MediumItalic' } as const
const ROBOTO_FILES: Readonly<Record<string, string>> = {
  [ROBOTO.regular]: 'Roboto-Regular.ttf',
  [ROBOTO.bold]: 'Roboto-Medium.ttf',
  [ROBOTO.italic]: 'Roboto-Italic.ttf',
  [ROBOTO.boldItalic]: 'Roboto-MediumItalic.ttf',
}
let roboto: Font | undefined

function robotoFonts(): Font {
  if (roboto !== undefined) return roboto
  const directory = path.join(path.dirname(createRequire(import.meta.url).resolve('pdfmake/package.json')), 'fonts', 'Roboto')
  roboto = Object.fromEntries(
    Object.entries(ROBOTO_FILES).map(([name, file]) => [name, { data: new Uint8Array(readFileSync(path.join(directory, file))), fallback: name === ROBOTO.regular, subset: true }]),
  )
  return roboto
}

function fontFor(bold: boolean, italic: boolean): string {
  if (italic) return bold ? ROBOTO.boldItalic : ROBOTO.italic
  return bold ? ROBOTO.bold : ROBOTO.regular
}

export const pdfme: EngineAdapter = { name: 'pdfme', version: PDFME_VERSION, render }

async function render(document: ResolvedDocument, options: RenderOptions): Promise<Uint8Array> {
  stopIfCancelled(options.signal)
  refuseUndrawn(document)
  const created = new Date(document.info.creationDate)
  if (Number.isNaN(created.getTime())) throw new RenderRefusal('unsupported', `the creation date '${document.info.creationDate}' is not an ISO instant`)
  const font = robotoFonts()
  const images = await checkedImages([...document.pageHeader, ...document.pageFooter, ...document.body])
  const built = await templateOf(document, { font, images, cache: new Map(), input: {}, subjects: new Map() })
  stopIfCancelled(options.signal)

  // pdfme's own pagination, run ahead of generate() -- which runs it again on
  // the same template, to the same pages -- so that a document too long for
  // its page limit, or with a box taller than a page, is refused before a
  // page is drawn. The page-limit test holds the two to one page count.
  const laidOut = await getDynamicTemplate({ template: built.template, input: built.input, options: { font }, _cache: new Map(), getDynamicHeights: getDynamicLayoutForSchema })
  stopIfCancelled(options.signal)
  if (laidOut.schemas.length > options.maxPages) {
    throw new RenderRefusal('too-many-pages', `the document needs ${laidOut.schemas.length} pages; at most ${options.maxPages} are allowed`)
  }
  refuseOverflow(laidOut.schemas, built)

  const pdf = await generate({
    template: built.template,
    inputs: [built.input],
    options: { font, title: document.info.title, creationDate: created, modificationDate: created },
    plugins: PLUGINS,
  })
  // pdfme cannot be interrupted while it draws; a render cancelled meanwhile is still not handed back.
  stopIfCancelled(options.signal)
  return pdf
}

function stopIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new RenderRefusal('cancelled', 'the render was cancelled')
}

/** What the template is built from, and what building it collects. */
interface Context {
  readonly font: Font
  readonly images: ReadonlyMap<string, Pixels>
  readonly cache: Map<string | number, unknown>
  /** The body boxes' values, by box name: pdfme prints an input as given. */
  readonly input: Record<string, string>
  /** What a refusal names for each box: a table's id, an image's asset, or the block's place in the document. */
  readonly subjects: Map<string, string>
}

interface Built {
  readonly template: Template
  readonly input: Record<string, string>
  readonly basePdf: BlankPdf
  readonly subjects: ReadonlyMap<string, string>
}

/** The printable area across the page, in millimetres. */
interface Columns {
  readonly left: number
  readonly width: number
}

async function templateOf(document: ResolvedDocument, context: Context): Promise<Built> {
  const { width, height } = pageDimensions(document.page)
  const { margins } = document.page
  const columns: Columns = { left: mm(margins.left), width: mm(width - margins.left - margins.right) }
  const header = await region(document.pageHeader, 'pageHeader', columns, context)
  const footer = await region(document.pageFooter, 'pageFooter', columns, context)
  const gap = (blocks: readonly Block[]): number => (blocks.length === 0 ? 0 : mm(REGION_GAP))
  const top = mm(margins.top) + header.height + gap(document.pageHeader)
  const bottom = mm(margins.bottom) + footer.height + gap(document.pageFooter)
  if (mm(height) - top - bottom <= 0) throw new RenderRefusal('content-too-large', 'the page header and footer leave no room for the body')
  const basePdf: BlankPdf = {
    width: mm(width),
    height: mm(height),
    padding: [top, mm(margins.right), bottom, mm(margins.left)],
    staticSchema: [...moved(header.schemas, mm(margins.top)), ...moved(footer.schemas, mm(height - margins.bottom) - footer.height)],
  }
  const schemas = await bodyPages(document.body, top, columns, context)
  return { template: { basePdf, schemas }, input: context.input, basePdf, subjects: context.subjects }
}

/** A box placed, and the height it takes in the column, in millimetres. */
interface Placed {
  readonly schema: Schema
  readonly height: number
}

/**
 * The page header or footer, as static boxes stacked from the region's top
 * edge: drawn as they stand on every page, so each is as tall as its content
 * measures. A table, a keep-together block or a page break has no place in
 * one.
 */
async function region(blocks: readonly Block[], where: 'pageHeader' | 'pageFooter', columns: Columns, context: Context): Promise<{ schemas: Schema[]; height: number }> {
  const schemas: Schema[] = []
  let y = 0
  for (const [index, block] of blocks.entries()) {
    const subject = `${where}[${index}]`
    if (block.kind === 'spacer') {
      y += mm(block.height)
      continue
    }
    if (block.kind === 'table' || block.kind === 'keepTogether' || block.kind === 'pageBreak') {
      throw new RenderRefusal('unsupported', `pdfme repeats only fixed boxes on every page; a ${block.kind} cannot be part of the ${where}`, subject)
    }
    // `refuseUndrawn` refuses these before a template is built.
    if (isUndrawn(block)) throw new Error(`a ${block.kind} block reached the pdfme template`)
    const placed =
      block.kind === 'paragraph'
        ? await textBox([block], subject, y, columns, { flowing: false, static: true }, context)
        : fixedBox(block, subject, y, columns, { static: true }, context)
    schemas.push(placed.schema)
    y += placed.height
  }
  return { schemas, height: y }
}

function moved(schemas: readonly Schema[], down: number): Schema[] {
  return schemas.map((schema) => ({ ...schema, position: { ...schema.position, y: schema.position.y + down } }))
}

/** The body, as template pages of boxes stacked from the top of the body: one template page per page break. */
async function bodyPages(blocks: readonly Block[], top: number, columns: Columns, context: Context): Promise<Schema[][]> {
  const pages: Schema[][] = [[]]
  let y = top
  for (const [index, block] of blocks.entries()) {
    const subject = `body[${index}]`
    if (block.kind === 'pageBreak') {
      pages.push([])
      y = top
      continue
    }
    if (block.kind === 'spacer') {
      y += mm(block.height)
      continue
    }
    const placed = await flowingBox(block, subject, y, columns, context)
    if (placed === undefined) continue
    pages.at(-1)!.push(placed.schema)
    y += placed.height
  }
  return pages
}

/**
 * One body block as a box. A paragraph starts one line tall and grows line
 * by line; a table starts with no height and grows row by row; pdfme pushes
 * the boxes below each down by what it grew.
 */
async function flowingBox(block: Exclude<Block, { kind: 'pageBreak' | 'spacer' }>, subject: string, y: number, columns: Columns, context: Context): Promise<Placed | undefined> {
  switch (block.kind) {
    case 'paragraph':
      return textBox([block], subject, y, columns, { flowing: true, static: false }, context)
    case 'keepTogether': {
      if (block.blocks.length === 0) return undefined
      const paragraphs = block.blocks.filter((inner) => inner.kind === 'paragraph')
      if (paragraphs.length !== block.blocks.length) {
        throw new RenderRefusal('unsupported', 'pdfme keeps lines together only inside one text box; this keep-together block holds more than paragraphs', subject)
      }
      // One text box, not dynamic: pdfme places it whole, on the next page when it does not fit on this one.
      return textBox(paragraphs, subject, y, columns, { flowing: false, static: false }, context)
    }
    case 'table':
      return { schema: tableBox(block, y, columns, context), height: 0 }
    case 'image':
    case 'rule':
      return fixedBox(block, subject, y, columns, { static: false }, context)
    // `refuseUndrawn` refuses these before a template is built.
    case 'columns':
    case 'section':
    case 'rectangle':
      throw new Error(`a ${block.kind} block reached the pdfme template`)
  }
}

/** A box's value: an input when it is in the body, which pdfme prints as given; the box's own content when it is static. */
function withValue<T extends Schema>(schema: T, value: string, placement: { static: boolean }, context: Context): T {
  if (placement.static) return { ...schema, content: value }
  context.input[schema.name] = value
  return schema
}

function named(subject: string, context: Context): string {
  const name = `box${context.subjects.size}`
  context.subjects.set(name, subject)
  return name
}

/** An image or a rule, drawn at its own size. */
function fixedBox(block: Image | { kind: 'rule' }, subject: string, y: number, columns: Columns, placement: { static: boolean }, context: Context): Placed {
  if (block.kind === 'rule') {
    const schema: LineSchema = { name: named(subject, context), type: 'line', position: { x: columns.left, y }, width: columns.width, height: mm(RULE_WEIGHT), color: '#000000' }
    return { schema, height: schema.height }
  }
  const { asset } = block
  const pixels = context.images.get(asset.id)!
  if (mm(block.width) > columns.width + mm(SIZE_TOLERANCE)) {
    throw new RenderRefusal('content-too-large', `the image '${asset.id}' is ${block.width}pt wide, wider than the printable area`, asset.id)
  }
  // pdfme fits an image inside its box at the image's own proportions ("contain"); it cannot stretch one.
  const scale = Math.min(block.width / pixels.width, block.height / pixels.height)
  if (Math.abs(pixels.width * scale - block.width) > SIZE_TOLERANCE || Math.abs(pixels.height * scale - block.height) > SIZE_TOLERANCE) {
    throw new RenderRefusal('unsupported', `pdfme draws an image only at its own proportions; '${asset.id}' is ${pixels.width} × ${pixels.height} pixels, drawn at ${block.width} × ${block.height}pt`, asset.id)
  }
  const schema: ImageSchema = { name: named(asset.id, context), type: 'image', position: { x: columns.left, y }, width: mm(block.width), height: mm(block.height) }
  return { schema: withValue(schema, `data:${asset.mediaType};base64,${Buffer.from(asset.bytes).toString('base64')}`, placement, context), height: schema.height }
}

interface TextPlacement {
  /** Grows line by line and splits across pages; otherwise one box as tall as its lines, placed whole. */
  readonly flowing: boolean
  readonly static: boolean
}

/**
 * Paragraphs as one text box. Plain text in one font when they have no page
 * fields and one weight; otherwise a template, which pdfme reads as inline
 * Markdown -- bold as `**` -- with `{currentPage}` and `{totalPages}` filled
 * in. pdfme evaluates anything else in braces in a template as an
 * expression, and has no way to escape a brace, so a template whose text has
 * one is refused rather than printed as something else.
 */
async function textBox(paragraphs: readonly Paragraph[], subject: string, y: number, columns: Columns, placement: TextPlacement, context: Context): Promise<Placed> {
  const style = uniformStyle(paragraphs, subject)
  const runs = paragraphs.flatMap((paragraph) => paragraph.runs.map((run) => ('field' in run ? undefined : (run.bold ?? paragraph.style?.bold ?? false))))
  const weights = new Set(runs.filter((bold) => bold !== undefined))
  const template = runs.includes(undefined) || weights.size > 1
  if (template && paragraphs.some((paragraph) => paragraph.runs.some((run) => 'text' in run && /[{}]/.test(run.text)))) {
    throw new RenderRefusal('unsupported', 'pdfme would evaluate the braces in this text as an expression, and has no way to escape them', subject)
  }
  const value = paragraphs.map((paragraph) => (template ? markdown(paragraph) : paragraph.runs.map((run) => ('text' in run ? run.text : '')).join(''))).join('\n')
  const base: TextSchema = {
    name: named(subject, context),
    type: 'text',
    position: { x: columns.left, y },
    width: columns.width,
    height: 0,
    fontName: fontFor(!template && weights.has(true), style.italic),
    fontSize: style.size,
    lineHeight: LINE_HEIGHT,
    alignment: style.align,
    verticalAlignment: 'top',
    characterSpacing: 0,
    fontColor: '#000000',
    backgroundColor: '',
    padding: { top: 0, right: 0, bottom: mm(ROBOTO_DESCENDER * style.size), left: 0 },
    ...(placement.flowing ? { overflow: 'expand' as const } : {}),
    ...(template
      ? { readOnly: true, content: value, textFormat: 'inline-markdown' as const, fontVariants: { bold: fontFor(true, style.italic) }, fontVariantFallback: 'error' as const }
      : {}),
  }
  const measure = (sample: string): Promise<number> => measureTextHeight({ value: sample, schema: base, font: context.font, _cache: context.cache })
  // A flowing box starts one line tall, the height pdfme gives a first line; a fixed one is as tall as all its lines.
  const height = await measure(placement.flowing ? 'M' : value)
  const schema = { ...base, height }
  return { schema: template ? schema : withValue(schema, value, placement, context), height }
}

/** The one size, alignment and slant a text box has: paragraphs that differ in any of them cannot share one. */
function uniformStyle(paragraphs: readonly Paragraph[], subject: string): { size: number; align: 'left' | 'center' | 'right'; italic: boolean } {
  const styles = paragraphs.map((paragraph) => ({
    size: paragraph.style?.size ?? BODY_SIZE,
    align: paragraph.style?.align ?? 'left',
    italic: paragraph.style?.italic ?? false,
  }))
  const [first] = styles
  if (first === undefined || styles.some((style) => style.size !== first.size || style.align !== first.align || style.italic !== first.italic)) {
    throw new RenderRefusal('unsupported', 'pdfme sets one text box in one size, alignment and slant; these paragraphs differ', subject)
  }
  return first
}

/** A paragraph as inline Markdown: its text escaped, bold runs between `**`, page fields as pdfme's placeholders. */
function markdown(paragraph: Paragraph): string {
  return paragraph.runs
    .map((run) => {
      if ('field' in run) return run.field === 'pageNumber' ? '{currentPage}' : '{totalPages}'
      const escaped = escapeInlineMarkdown(run.text)
      if (!(run.bold ?? paragraph.style?.bold ?? false) || escaped.trim() === '') return escaped
      // Emphasis cannot open on a space or close after one, so the run's outer whitespace stays outside the markers.
      const [, before = '', core = '', after = ''] = /^(\s*)([\s\S]*?)(\s*)$/.exec(escaped) ?? []
      return `${before}**${core}**${after}`
    })
    .join('')
}

/**
 * A table as one table box, its header repeated on every page it reaches.
 * pdfme sizes columns in percentages of the table's width; a `'fill'`
 * column shares what the fixed ones leave. The empty text stands in the
 * first column of the first row when there are no detail rows.
 */
function tableBox(block: Table, y: number, columns: Columns, context: Context): TableSchema {
  const printable = columns.width * POINTS_PER_MM
  const fixed = block.columns.reduce((sum, column) => sum + (column.width === 'fill' ? 0 : column.width), 0)
  const fills = block.columns.filter((column) => column.width === 'fill').length
  const share = fills === 0 ? 0 : (printable - fixed) / fills
  if (fixed > printable + SIZE_TOLERANCE || (fills > 0 && share <= 0)) {
    throw new RenderRefusal('content-too-large', `the table '${block.id}' has ${fixed}pt of fixed columns; the printable area is ${printable.toFixed(2)}pt wide`, block.id)
  }
  const cells = [block.header, ...block.rows.map((row) => row.cells)]
  if (cells.some((row) => row.length !== block.columns.length)) {
    throw new RenderRefusal('unsupported', `the table '${block.id}' has a row whose cells do not match its ${block.columns.length} columns`, block.id)
  }
  const widths = block.columns.map((column) => (column.width === 'fill' ? share : column.width))
  const width = widths.reduce((sum, columnWidth) => sum + columnWidth, 0)
  const empty = block.rows.some((row) => row.kind === 'detail') ? [] : [[block.emptyText, ...block.columns.slice(1).map(() => '')]]
  const body = [...empty, ...block.rows.map((row) => [...row.cells])]
  const schema: TableSchema = {
    name: named(block.id, context),
    type: 'table',
    position: { x: columns.left, y },
    width: mm(width),
    // pdfme gives each piece of the table the height of the rows it holds.
    height: 0,
    showHead: true,
    repeatHead: true,
    head: [...block.header],
    headWidthPercentages: widths.map((columnWidth) => (columnWidth / width) * 100),
    tableStyles: { borderColor: '#000000', borderWidth: 0 },
    headStyles: cellStyle(ROBOTO.bold, RULE_WEIGHT),
    bodyStyles: { ...cellStyle(ROBOTO.regular, 0), alternateBackgroundColor: '' },
    columnStyles: {
      alignment: Object.fromEntries(block.columns.map((column, index) => [index, column.align])),
      verticalAlignment: Object.fromEntries(block.columns.map((_, index) => [index, 'top' as const])),
    },
  }
  return withValue(schema, JSON.stringify(body), { static: false }, context)
}

function cellStyle(fontName: string, ruleBelow: number): CellStyle {
  const vertical = mm(CELL_PADDING.vertical)
  const horizontal = mm(CELL_PADDING.horizontal)
  return {
    fontName,
    alignment: 'left',
    verticalAlignment: 'top',
    fontSize: BODY_SIZE,
    lineHeight: LINE_HEIGHT,
    characterSpacing: 0,
    fontColor: '#000000',
    backgroundColor: '',
    borderColor: '#000000',
    borderWidth: { top: 0, right: 0, bottom: mm(ruleBelow), left: 0 },
    padding: { top: vertical, right: horizontal, bottom: vertical, left: horizontal },
  }
}

/**
 * A box pdfme placed past the foot of the body: a table row, a keep-together
 * block or an image taller than a page, which pdfme places whole at the top
 * of a page and lets run off it. Refused rather than clipped by the paper.
 */
function refuseOverflow(pages: readonly (readonly Schema[])[], built: Built): void {
  const foot = built.basePdf.height - built.basePdf.padding[2]
  for (const [index, page] of pages.entries()) {
    for (const schema of page) {
      const past = schema.position.y + schema.height - foot
      if (past > FIT) {
        const subject = built.subjects.get(schema.name)
        throw new RenderRefusal(
          'content-too-large',
          `'${subject ?? schema.name}' does not fit on a page: on page ${index + 1} it runs ${(past * POINTS_PER_MM).toFixed(1)}pt past the foot of the body. pdfme cannot split a table row, a keep-together block or an image, and would let it run off the page`,
          subject,
        )
      }
    }
  }
}
