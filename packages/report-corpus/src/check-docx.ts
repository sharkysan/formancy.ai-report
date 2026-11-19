import { checkSvg, E_INVOICE_PREVIEW_LABEL, imageHeader, PREVIEW_LABEL, XRECHNUNG_COPY_LABEL } from '@formancy/report-runtime'
import { paragraphsOf, verifyContainer } from './check-docx-blocks.js'
import { copyProblems, copyRefusal } from './check-docx-copy.js'
import { decodedProblems, type FoundCodes } from './check-docx-codes.js'
import { slipCodeProblems, verifySlip } from './check-docx-slip.js'
import { pageDimensions, type Block, type Image, type ResolvedDocument, type Section } from './document.js'
import type { Docx, DocxBlock, DocxParagraph, DocxRegion, DocxRun, DocxTable } from './docx/model.js'
import { normalise, type ExpectedImage, type ExpectedRefusal, type ExpectedShiftedRun, type ExpectedTable, type Fixture } from './fixture.js'

/**
 * A Word file proved against its fixture (0068, extending 0003): on the
 * file the writer produced, as `readDocx` read it back, never on what the
 * writer was about to write.
 *
 * Two things are held. The expectation the corpus derives from the
 * document and holds its PDF to (`fixture.ts`), for what a Word file can
 * show of it: every key once and in order, every table's header, rows and
 * cells, the header row marked as the one to repeat, a group header's
 * rows kept, the regions' lines, the footer's page fields, the kept
 * groups, the images and the runs set off the line. Not its pages: where
 * a line and a page break is Word's, so nothing here counts a page,
 * finds an orphan or measures a margin. And what the document states
 * outright, block by block (`check-docx-blocks.ts`), with the page, the
 * regions' parts, the title and the creation date.
 *
 * A code is held on its picture (0074): the pixels the file embeds, read
 * back by the corpus's own PNG reader, and what ZXing reads in them, as a
 * scanner would (`check-docx-codes.ts`). That reading is not at hand at
 * once, so the check is waited for. A chart is held on its part (0076):
 * Word's own chart as the file states it, its words, its values' digits
 * and its axis (`check-docx-charts.ts`). A QR-bill's slip is held on its
 * page, the file's last section, and its Swiss QR Code on its picture
 * (0075, `check-docx-slip.ts`). A copy of an e-invoice is held on every
 * header the file states, a slip's page's among them, each of which
 * opens with the copy's label (0077, `check-docx-copy.ts`).
 *
 * What this cannot show is that Word opens the file, or prints it so.
 */
export async function verifyDocx(fixture: Fixture, docx: Docx): Promise<string[]> {
  const { document, expect } = fixture
  const { fonts } = document
  const paper = pageDimensions(document.page)
  const width = paper.width - document.page.margins.left - document.page.margins.right
  const first = document.firstPageHeader
  const regions: readonly (readonly [string, readonly Block[], DocxRegion | undefined, 'header' | 'footer'])[] = [
    ['pageHeader', document.pageHeader, docx.header, 'header'],
    ['firstPageHeader', first ?? [], docx.firstHeader, 'header'],
    ['pageFooter', document.pageFooter, docx.footer, 'footer'],
  ]
  const codes: FoundCodes = { pending: [], paragraphs: new Set() }
  // A report paid by a QR-bill ends its section with the last paragraph of its body, and its slip's page follows (0075). A body that
  // writes nothing is given an empty line a point tall to end it with, which is then no block of the document's.
  const ending = docx.body.at(-1)
  const ended = ending?.kind === 'paragraph' && ending.endsSection === true
  const given = ended && docx.body.length === 1 && ending.runs.length === 0 && ending.line?.rule === 'exact' && ending.line.height === 1
  const body =
    given && verifyContainer(document.body, [], { at: 'body', width, kind: 'body' }, fonts, { pending: [], paragraphs: new Set() }).length === 0
      ? []
      : docx.body
  const slip = verifySlip(document, docx)
  const stated = [
    ...(ended === (document.paymentPart !== undefined)
      ? []
      : ["the report's section is not ended by the last paragraph of its body exactly where the document is paid by a QR-bill"]),
    ...slip.problems,
    ...copyProblems(document, docx),
    ...pageProblems(document, docx),
    ...regions.flatMap(([at, blocks, region, kind]) => {
      if (blocks.length === 0) return region === undefined ? [] : [`${at} holds nothing, and the file has a ${kind} for it`]
      return region === undefined ? [`${at} has no ${kind} in the file`] : verifyContainer(blocks, region.blocks, { at, width, kind }, fonts, codes)
    }),
    ...(first !== undefined && docx.footer !== undefined && docx.firstFooter?.part !== docx.footer.part
      ? ['page 1 does not print the page footer every page prints']
      : []),
    ...(first === undefined && (docx.firstHeader !== undefined || docx.firstFooter !== undefined)
      ? ['the file gives page 1 a header or footer of its own, and the document none']
      : []),
    ...verifyContainer(document.body, body, { at: 'body', width, kind: 'body' }, fonts, codes),
    ...expectedProblems(expect, { ...docx, body }, codes.paragraphs),
    ...fontProblems(docx),
  ]
  const scanned = slip.code === undefined || document.paymentPart === undefined ? [] : await slipCodeProblems(document.paymentPart, slip.code)
  return [...stated, ...(await decodedProblems(codes.pending)), ...scanned]
}

const NEAR = 0.026
const near = (read: number, stated: number): boolean => Math.abs(read - stated) <= NEAR

/** The paper, its margins, the regions' distances from its edges, page 1's own header, the title and the creation date. */
function pageProblems(document: ResolvedDocument, docx: Docx): string[] {
  const { page } = docx
  const paper = pageDimensions(document.page)
  const { margins, orientation } = document.page
  const created = docx.created === undefined ? Number.NaN : Date.parse(docx.created)
  return [
    ...(near(page.width, paper.width) && near(page.height, paper.height)
      ? []
      : [`the paper is ${page.width} × ${page.height} pt where the document's is ${paper.width} × ${paper.height}`]),
    ...(page.orientation === orientation ? [] : [`the page is ${page.orientation} where the document's is ${orientation}`]),
    ...(['top', 'right', 'bottom', 'left'] as const).flatMap((side) =>
      near(page.margins[side], margins[side]) ? [] : [`the ${side} margin is ${page.margins[side]} pt where the document's is ${margins[side]}`],
    ),
    // Both regions stand inside the printable area, the body between them: each starts at the margin.
    ...(near(page.header, margins.top) && near(page.footer, margins.bottom) ? [] : ['the header or the footer stands elsewhere than at its margin']),
    ...(page.titlePage === (document.firstPageHeader !== undefined) ? [] : [`page 1 ${page.titlePage ? 'has' : 'has not'} a header of its own in the file`]),
    ...(docx.title === document.info.title ? [] : [`the title is '${String(docx.title)}' where the document's is '${document.info.title}'`]),
    ...(created === Date.parse(document.info.creationDate) && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(docx.created ?? '')
      ? []
      : [`the creation date is '${String(docx.created)}', which is not the document's instant in UTC`]),
  ]
}

/** Every family a run or a paragraph's mark names is in the font table, which says what a reader without it chooses another by. */
function fontProblems(docx: Docx): string[] {
  const listed = new Set(docx.fonts.map((font) => font.name))
  const named = new Set<string>()
  const regions = [docx.body, docx.header?.blocks ?? [], docx.firstHeader?.blocks ?? [], docx.footer?.blocks ?? []]
  for (const paragraph of regions.flatMap(paragraphsOf))
    for (const props of [paragraph.mark, ...paragraph.runs.map((run) => run.props)]) if (props.family !== undefined) named.add(props.family)
  if (docx.defaults.run.family !== undefined) named.add(docx.defaults.run.family)
  return [...named].filter((family) => !listed.has(family)).map((family) => `the family ${family} is named by a run and missing from the font table`)
}

/** The title of the chart `paragraph` draws, as a line of extracted text has it; undefined where it draws none, or one with no title. */
function titleOf(paragraph: DocxParagraph): string | undefined {
  const [run] = paragraph.runs
  return run?.kind === 'chart' && run.frame.chart.title !== undefined ? normalise(run.frame.chart.title.text) : undefined
}

/** A paragraph's words as a line of extracted text has them; a field as nothing. */
const lineOf = (paragraph: DocxParagraph): string => normalise(paragraph.runs.map((run) => (run.kind === 'text' ? run.text : '')).join(''))

const hasField = (paragraph: DocxParagraph): boolean => paragraph.runs.some((run) => run.kind === 'field')

/** The lines a list of blocks prints, without those that hold a page field or nothing. */
const plainLines = (blocks: readonly DocxBlock[]): string[] =>
  paragraphsOf(blocks).flatMap((paragraph) => (hasField(paragraph) || lineOf(paragraph) === '' ? [] : [lineOf(paragraph)]))

const wholeWords = (line: string, words: string): boolean => ` ${line} `.includes(` ${words} `)

/** Whether `lines` hold each of `expected`, in order. */
function inOrder(lines: readonly string[], expected: readonly string[]): string | undefined {
  let from = 0
  for (const each of expected) {
    const at = lines.findIndex((line, index) => index >= from && line === each)
    if (at < 0) return each
    from = at + 1
  }
  return undefined
}

/** The expectation held to the file; `coded` are the paragraphs its codes are written as, whose pictures are no image of the document's. */
function expectedProblems(expect: Fixture['expect'], docx: Docx, coded: ReadonlySet<DocxParagraph>): string[] {
  const problems: string[] = []
  const body = paragraphsOf(docx.body)
  const lines = body.map(lineOf)
  const [header, firstHeader, footer] = [docx.header?.blocks ?? [], docx.firstHeader?.blocks ?? [], docx.footer?.blocks ?? []]
  // The lines each word stands on: a key is sought where its first word is, never on every line for every key.
  const standing = new Map<string, number[]>()
  lines.forEach((line, index) => {
    for (const word of new Set(line.split(' '))) {
      const known = standing.get(word)
      if (known === undefined) standing.set(word, [index])
      else known.push(index)
    }
  })
  let from = 0
  for (const key of expect.keys) {
    const found = (standing.get(key.split(' ')[0]!) ?? []).filter((index) => wholeWords(lines[index]!, key))
    if (found.length !== 1) problems.push(`the key '${key}' is printed ${found.length} times in the body`)
    else if (found[0]! < from) problems.push(`the key '${key}' is printed before the key it follows`)
    else from = found[0]!
  }
  const tables = docx.body.filter((node): node is DocxTable => node.kind === 'table' && node.rows[0]?.header === true)
  let next = 0
  for (const table of expect.tables) {
    const at = tables.findIndex((each, index) => index >= next && tableProblems(table, each, expect.noOrphanedHeaders).length === 0)
    if (at >= 0) next = at + 1
    else
      problems.push(
        ...(tables[next] === undefined ? [`table ${table.id} is not in the file`] : tableProblems(table, tables[next++]!, expect.noOrphanedHeaders)),
      )
  }
  const missing = (where: string, read: readonly DocxBlock[], stated: readonly string[]): void => {
    const lost = inOrder(plainLines(read), stated)
    if (lost !== undefined) problems.push(`${where} does not print '${lost}' as a line of its own, in its order`)
  }
  missing('the page header', header, expect.pageHeaderLines)
  missing('the page footer', footer, expect.pageFooterLines)
  if (expect.firstPage !== undefined) missing("page 1's own header", firstHeader, expect.firstPage.headerLines)
  const pattern = expect.footerEveryPage
  if (pattern !== undefined && !paragraphsOf(footer).some((paragraph) => hasField(paragraph) && pattern.test(fieldsAsDigits(paragraph)))) {
    problems.push(`the page footer has no line of the page's number and count that reads as ${pattern.source}`)
  }
  const everywhere = [...lines, ...[header, firstHeader, footer].flatMap((blocks) => paragraphsOf(blocks).map(lineOf))]
  for (const text of expect.exactText) if (!everywhere.some((line) => wholeWords(line, text))) problems.push(`'${text}' is on no line`)
  const squeezed = everywhere.map((line) => line.replace(/\s+/g, ''))
  for (const text of expect.wrappedText) if (!squeezed.includes(text.replace(/\s+/g, ''))) problems.push(`'${text}' is no paragraph of its own`)
  // A line that stands in the body itself is kept with the next unless it is the group's last; one in a table's cell may stand in the row that ends
  // its block, which is kept with nothing after it, and what it is kept with is the block walk's to say (`check-docx-blocks.ts`).
  const standsAlone = new Set<DocxBlock>(docx.body)
  for (const group of expect.keptTogether) {
    // A group's lines are sought in their order, each after the one before it. A chart's title is a word of its part and no paragraph of
    // the body: it is found at the chart's own paragraph, there and nowhere else, whatever a paragraph elsewhere says.
    let from = 0
    const kept = group.map((line) => {
      const at = body.findIndex((paragraph, index) => index >= from && (lineOf(paragraph) === line || titleOf(paragraph) === line))
      if (at >= 0) from = at + 1
      return body[at]
    })
    const charted = kept.map((paragraph) => paragraph !== undefined && titleOf(paragraph) !== undefined)
    // A heading kept with the chart under it is one paragraph kept with the next, and neither keeps its lines: only a keep-together
    // block's do. So a chart's line, and the line before it, are held by what each is kept with, and their lines by the block walk.
    const loose = (paragraph: DocxParagraph, index: number): boolean =>
      (!paragraph.keepLines && charted[index] !== true && charted[index + 1] !== true) ||
      (index < kept.length - 1 && standsAlone.has(paragraph) && !paragraph.keepNext)
    if (kept.some((paragraph, index) => paragraph === undefined || loose(paragraph, index)))
      problems.push(`the kept lines from '${group[0] ?? ''}' are not all marked to stay on one page`)
  }
  const pictures = (blocks: readonly DocxBlock[]): DocxParagraph[] =>
    paragraphsOf(blocks).filter((paragraph) => !coded.has(paragraph) && paragraph.runs.some((run) => run.kind === 'picture'))
  problems.push(...imageProblems('the body', expect.images, pictures(docx.body)))
  problems.push(...imageProblems('the page header and footer', expect.pageRegionImages, pictures([...header, ...footer])))
  problems.push(...shiftedProblems('the body', expect.shiftedRuns, docx.body))
  problems.push(...shiftedProblems('the page header and footer', expect.pageRegionShiftedRuns, [...header, ...footer]))
  if (expect.firstPage !== undefined) {
    problems.push(...imageProblems("page 1's regions", expect.firstPage.regionImages, pictures([...firstHeader, ...footer])))
    problems.push(...shiftedProblems("page 1's regions", expect.firstPage.shiftedRuns, [...firstHeader, ...footer]))
  }
  return problems
}

/** A paragraph's line with each page field as a digit, as a page prints it: what the footer's pattern is matched against. */
const fieldsAsDigits = (paragraph: DocxParagraph): string =>
  normalise(paragraph.runs.map((run: DocxRun) => (run.kind === 'text' ? run.text : run.kind === 'field' ? '1' : '')).join(''))

/** A cell's words, every paragraph of it. */
const cellText = (cell: DocxTable['rows'][number]['cells'][number]): string => normalise(paragraphsOf(cell.blocks).map(lineOf).join(' '))

const rowKept = (row: DocxTable['rows'][number] | undefined): boolean =>
  row !== undefined && row.cells.every((cell) => paragraphsOf(cell.blocks).every((paragraph) => paragraph.keepNext))

function tableProblems(expected: ExpectedTable, table: DocxTable, noOrphans: boolean): string[] {
  const at = `table ${expected.id}`
  const [header, ...rows] = table.rows
  const printed = (row: DocxTable['rows'][number]): string[] => row.cells.map(cellText).filter((text) => text !== '')
  if (header === undefined || printed(header).join('\u0000') !== expected.header.join('\u0000'))
    return [`${at}'s header does not print ${expected.header.join(', ')}`]
  const problems: string[] = []
  if (!header.header) problems.push(`${at}'s header is not marked as the row to repeat on every page`)
  const empty = expected.emptyText === '' ? [] : rows.splice(0, 1)
  if (expected.emptyText !== '' && (empty[0] === undefined || empty[0].cells.length !== 1 || cellText(empty[0].cells[0]!) !== expected.emptyText))
    problems.push(`${at} does not print '${expected.emptyText}' across it in place of its detail rows`)
  if (rows.length !== expected.rows.length)
    return [...problems, `${at} holds ${rows.length} rows under its header where the document has ${expected.rows.length}`]
  if (noOrphans && rows.length > 0 && !rowKept(header)) problems.push(`${at}'s header is not kept with the row under it`)
  expected.rows.forEach((row, index) => {
    const read = rows[index]!
    const cells = read.cells.map(cellText)
    const stated = cells.map((_, column) => row.cells.find((cell) => cell.column === column)?.text ?? '')
    if (cells.join('\u0000') !== stated.join('\u0000') || row.cells.some((cell) => cell.column >= cells.length))
      problems.push(`${at}: the row '${row.key}' prints ${cells.join(' | ')}`)
    const keeps = row.kind === 'groupHeader' && index + 1 < rows.length ? (row.keepWithRows ?? (noOrphans ? 1 : 0)) : 0
    for (let each = 0; each < keeps; each++)
      if (!rowKept(rows[index + each])) problems.push(`${at}: the group header '${row.key}' is not kept with ${keeps} of the rows after it`)
  })
  return problems
}

/** Each picture in its box: the picture's own extent with the room its paragraph leaves around it. */
function imageProblems(where: string, expected: readonly ExpectedImage[], read: readonly DocxParagraph[]): string[] {
  if (read.length !== expected.length) return [`${where} holds ${read.length} pictures where the document has ${expected.length} images`]
  return expected.flatMap((image, index) => {
    const paragraph = read[index]!
    const run = paragraph.runs.find((each) => each.kind === 'picture')
    if (run?.kind !== 'picture') return []
    const { picture } = run
    const [width, height] = [picture.width + 2 * paragraph.indent, paragraph.before + picture.height + paragraph.after]
    return [
      ...(near(width, image.width) && near(height, image.height)
        ? []
        : [`${where}: image ${index + 1} takes ${width} × ${height} pt where its box is ${image.width} × ${image.height}`]),
      ...((picture.svg !== undefined) === (image.kind === 'vector') ? [] : [`${where}: image ${index + 1} is ${picture.svg === undefined ? 'no' : 'an'} SVG`]),
    ]
  })
}

function shiftedProblems(where: string, expected: readonly ExpectedShiftedRun[], blocks: readonly DocxBlock[]): string[] {
  const read = paragraphsOf(blocks).flatMap((paragraph) =>
    paragraph.runs.flatMap((run) =>
      run.kind === 'text' && run.props.shift !== undefined && normalise(run.text) !== ''
        ? [{ text: normalise(run.text), shift: run.props.shift, size: run.props.size }]
        : [],
    ),
  )
  if (read.length !== expected.length) return [`${where} sets ${read.length} runs off the line where the document sets ${expected.length}`]
  return expected.flatMap((run, index) => {
    const found = read[index]!
    const same =
      found.text === run.text && found.shift === run.shift && (run.size === undefined || (found.size !== undefined && Math.abs(found.size - run.size) <= 0.26))
    return same ? [] : [`${where}: the run '${run.text}' set ${run.shift} is '${found.text}' set ${found.shift} at ${String(found.size)} pt`]
  })
}

/**
 * The refusal a Word file's writer owes `document`, or undefined where it
 * owes none of these: derived from the document alone, by the corpus's
 * own reading of record 0068, in the order the writer refuses -- the
 * e-invoice, a labelled preview, an XRechnung's PDF copy, a copy of an
 * e-invoice whose headers are not all labelled as the runtime labels one
 * (0077), then the page header,
 * page 1's own, the page footer and the body, each block in document
 * order, and last the pictures, in that order too, since an engine reads a
 * picture's bytes once every block has been walked. It knows what belongs
 * to the PDF and what nobody has seen Word print as the PDF does; what any
 * engine refuses of a malformed document, a code the rules below both
 * engines refuse among it (0074), and what the PDF renderer refuses of
 * what it measured, are a fixture's own to state. A chart was refused
 * here until 0076: Word draws one of its own, and a chart is refused
 * only as any engine refuses it. A payment part was refused here until
 * 0075: its slip is written on a page of its own, and a bill is refused
 * only as the rules below both engines refuse it, or where a line of it
 * does not fit its place.
 */
export function wordRefusal(document: ResolvedDocument): ExpectedRefusal | undefined {
  if (document.eInvoice !== undefined) return { code: 'unsupported', subject: 'eInvoice' }
  const opening = (header: readonly Block[] | undefined): string | undefined => {
    const label = header?.[0]
    const run = label?.kind === 'paragraph' && label.runs.length === 1 ? label.runs[0] : undefined
    return run !== undefined && 'text' in run ? run.text : undefined
  }
  const words = opening(document.pageHeader)
  if (words === PREVIEW_LABEL || words === E_INVOICE_PREVIEW_LABEL) return { code: 'unsupported', subject: 'pageHeader' }
  // An XRechnung's PDF copy, its XML taken off: labelled as a PDF on either header (0077).
  if (words === XRECHNUNG_COPY_LABEL) return { code: 'unsupported', subject: 'pageHeader' }
  if (opening(document.firstPageHeader) === XRECHNUNG_COPY_LABEL) return { code: 'unsupported', subject: 'firstPageHeader' }
  // A copy of an e-invoice labelled otherwise than the runtime labels one, on every header (0077).
  const copy = copyRefusal(document)
  if (copy !== undefined) return copy
  const regions: readonly (readonly [string, readonly Block[]])[] = [
    ['pageHeader', document.pageHeader],
    ['firstPageHeader', document.firstPageHeader ?? []],
    ['pageFooter', document.pageFooter],
    ['body', document.body],
  ]
  for (const [path, blocks] of regions) {
    const refusal = refusalAmong(blocks, path, false)
    if (refusal !== undefined) return refusal
  }
  const picture = regions.flatMap(([, blocks]) => imagesOf(blocks)).find(unseen)
  return picture === undefined ? undefined : { code: 'unsupported', subject: picture.asset.id }
}

/** Every image among `blocks`, however deep, in document order. */
function imagesOf(blocks: readonly Block[]): Image[] {
  return blocks.flatMap((block) =>
    block.kind === 'image'
      ? [block]
      : block.kind === 'columns'
        ? block.columns.flatMap((slot) => imagesOf(slot.blocks))
        : block.kind === 'section' || block.kind === 'keepTogether'
          ? imagesOf(block.blocks)
          : [],
  )
}

const framed = (section: Section): boolean => section.border !== undefined || section.fill !== undefined || (section.padding ?? 0) > 0

function refusalAmong(blocks: readonly Block[], path: string, inFrame: boolean): ExpectedRefusal | undefined {
  for (const [index, block] of blocks.entries()) {
    const at = `${path}[${index}]`
    const unsupported = (subject: string): ExpectedRefusal => ({ code: 'unsupported', subject })
    if (block.kind === 'table' && inFrame) return unsupported(block.id)
    if (block.kind === 'pageBreak' && inFrame) return unsupported(at)
    const inner =
      block.kind === 'columns'
        ? block.columns.map((slot, column) => refusalAmong(slot.blocks, `${at}.columns[${column}].blocks`, inFrame)).find((each) => each !== undefined)
        : block.kind === 'section' || block.kind === 'keepTogether'
          ? refusalAmong(block.blocks, `${at}.blocks`, inFrame || (block.kind === 'section' && framed(block)))
          : undefined
    if (inner !== undefined) return inner
  }
  return undefined
}

/** Whether nobody has seen Word print `image` as the PDF does: a JPEG its Exif block turns, one of four components, and an SVG that covers a box of other proportions than its own. */
function unseen(image: Image): boolean {
  if (image.asset.mediaType === 'image/svg+xml') {
    const read = checkSvg(image.asset.bytes)
    return (
      read.ok &&
      image.fit === 'cover' &&
      Math.abs(read.viewBox.width * image.height - read.viewBox.height * image.width) > 1e-6 * read.viewBox.width * image.height
    )
  }
  const read = imageHeader(image.asset.bytes)
  return read.ok && read.mediaType === 'image/jpeg' && (read.orientation !== undefined || read.components === 4)
}
