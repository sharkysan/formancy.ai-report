import type {
  Docx,
  DocxBlock,
  DocxBorder,
  DocxCell,
  DocxPage,
  DocxParagraph,
  DocxPicture,
  DocxRegion,
  DocxRow,
  DocxRun,
  DocxRunProps,
  DocxTable,
  Sides,
} from './model.js'
import { only, readPackage, readPart, type OpcPackage, type Part } from './package.js'
import { attr, CORE, DOCUMENT, FONTS, FOOTER, HEADER, NS, SETTINGS, STYLES } from './vocabulary.js'
import { child, childrenNamed, type XmlNode } from './xml.js'

/**
 * A Word file read back whole, for the corpus's tests, by readers that are
 * not its writer (0068): the zip by a walk of its own and Node's zlib
 * (`zip.ts`), the package by ECMA-376's Part 2 (`package.ts`), each part's
 * XML by saxes against a closed vocabulary (`xml.ts`, `vocabulary.ts`).
 * What it returns is what the file states (`model.ts`), in points.
 *
 * It reads what report-render-docx writes and refuses everything else,
 * naming the part: beyond the vocabulary, a relationship of a type it does
 * not know or that nothing in its part uses, a `w:t` without
 * `xml:space="preserve"` -- Word strips the spaces at either end of one,
 * and a run that ends in a space is the commonest a report has -- a field
 * other than `PAGE` and `NUMPAGES` or one not written as its three runs, a
 * run that mixes text with a field or a picture, a border that is no
 * single line, a width in a unit other than twentieths of a point, a table
 * of another layout than fixed or whose rows do not fill its grid, a cell
 * whose text is turned otherwise than from bottom to top, and a cell, a
 * header or a footer that does not end with a paragraph.
 *
 * What this cannot show is that Word opens the file, or what it then
 * prints: no reader here lays out a line.
 */

const TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const CORE_TYPE = 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties'
const MAIN = 'application/vnd.openxmlformats-officedocument.wordprocessingml'
/** The extension an SVG is embedded under, as Microsoft's Open XML SDK names it. */
const SVG_EXTENSION = '{96DAC541-7B7A-43D3-8B79-37D633B846F1}'

/** A part's reading: its name, for a refusal, the relationships it may use, and which of them it did. */
interface Reading {
  readonly name: string
  readonly opc: OpcPackage
  readonly used: Set<string>
}

function fail(reading: { readonly name: string }, message: string): never {
  throw new Error(`${reading.name}: ${message}`)
}

/** The attribute `key` of `node`, a whole number, in `unit`s to the point; undefined where it is absent. */
function measure(reading: Reading, node: XmlNode, key: string, unit: number): number | undefined {
  const written = node.attributes.get(key)
  if (written === undefined) return undefined
  if (!/^-?\d+$/.test(written)) fail(reading, `${node.local} states ${key} as '${written}', which is no whole number`)
  return Number(written) / unit
}

function needed(reading: Reading, node: XmlNode, key: string, unit: number): number {
  return measure(reading, node, key, unit) ?? fail(reading, `${node.local} has no ${key}`)
}

const w = (local: string): string => attr('w', local)
const TWIPS = 20
const EMU = 12700

/** A colour as the document writes one: `#` and six lower-case hex digits, from Word's six of either case. */
function color(reading: Reading, written: string | undefined, of: string): string {
  if (written === undefined || !/^[0-9A-Fa-f]{6}$/.test(written)) fail(reading, `${of} names the colour '${String(written)}', which is not six hex digits`)
  return `#${written.toLowerCase()}`
}

function border(reading: Reading, node: XmlNode | undefined): DocxBorder | undefined {
  if (node === undefined) return undefined
  if (node.attributes.get(w('val')) !== 'single' || node.attributes.get(w('space')) !== '0')
    fail(reading, `the border ${node.local} is no single line at no distance`)
  return { weight: needed(reading, node, w('sz'), 8), color: color(reading, node.attributes.get(w('color')), `the border ${node.local}`) }
}

function sides<T>(node: XmlNode | undefined, read: (side: XmlNode | undefined) => T | undefined): Sides<T> {
  const found: { -readonly [K in keyof Sides<T>]: T } = {}
  for (const side of ['top', 'left', 'bottom', 'right'] as const) {
    const value = read(node === undefined ? undefined : child(node, NS.w, side))
    if (value !== undefined) found[side] = value
  }
  return found
}

/** A width in twentieths of a point, the one unit the writer states one in. */
function dxa(reading: Reading, node: XmlNode | undefined): number | undefined {
  if (node === undefined) return undefined
  if (node.attributes.get(w('type')) !== 'dxa') fail(reading, `${node.local} states a width in another unit than twentieths of a point`)
  return needed(reading, node, w('w'), TWIPS)
}

function runProps(reading: Reading, node: XmlNode | undefined): DocxRunProps {
  if (node === undefined) return { bold: false, italic: false }
  const fonts = child(node, NS.w, 'rFonts')
  const families = fonts === undefined ? [] : ['ascii', 'hAnsi', 'eastAsia', 'cs'].map((slot) => fonts.attributes.get(w(slot)))
  if (families.some((family) => family === undefined || family !== families[0])) fail(reading, 'a run names its four font slots otherwise than alike')
  const [colour, size, sizeCs, shift] = ['color', 'sz', 'szCs', 'vertAlign'].map((local) => child(node, NS.w, local))
  if ((size === undefined) !== (sizeCs === undefined) || size?.attributes.get(w('val')) !== sizeCs?.attributes.get(w('val')))
    fail(reading, 'a run states its size and its complex-script size otherwise than alike')
  const shifted = shift?.attributes.get(w('val'))
  if (shifted !== undefined && shifted !== 'subscript' && shifted !== 'superscript') fail(reading, `a run is set off the line as '${shifted}'`)
  return {
    ...(families[0] === undefined ? {} : { family: families[0] }),
    bold: child(node, NS.w, 'b') !== undefined,
    italic: child(node, NS.w, 'i') !== undefined,
    ...(colour === undefined ? {} : { color: color(reading, colour.attributes.get(w('val')), 'a run') }),
    ...(size === undefined ? {} : { size: needed(reading, size, w('val'), 2) }),
    ...(shifted === undefined ? {} : { shift: shifted }),
  }
}

function picture(reading: Reading, drawing: XmlNode): DocxPicture {
  const inline = only(drawing, NS.wp, 'inline', reading.name)
  const extent = only(inline, NS.wp, 'extent', reading.name)
  const named = only(inline, NS.wp, 'docPr', reading.name)
  const data = only(only(inline, NS.a, 'graphic', reading.name), NS.a, 'graphicData', reading.name)
  if (data.attributes.get('uri') !== NS.pic) fail(reading, 'a drawing that is no picture')
  const pic = only(data, NS.pic, 'pic', reading.name)
  const fill = only(pic, NS.pic, 'blipFill', reading.name)
  const blip = only(fill, NS.a, 'blip', reading.name)
  const shape = only(only(only(pic, NS.pic, 'spPr', reading.name), NS.a, 'xfrm', reading.name), NS.a, 'ext', reading.name)
  const [width, height] = [needed(reading, extent, 'cx', EMU), needed(reading, extent, 'cy', EMU)]
  if (needed(reading, shape, 'cx', EMU) !== width || needed(reading, shape, 'cy', EMU) !== height)
    fail(reading, 'a picture whose shape is another size than its extent')
  if (child(fill, NS.a, 'stretch') === undefined) fail(reading, 'a picture that is not stretched to its shape')
  const extensions = childrenNamed(child(blip, NS.a, 'extLst') ?? { ...blip, children: [] }, NS.a, 'ext')
  if (extensions.some((each) => each.attributes.get('uri') !== SVG_EXTENSION)) fail(reading, 'a picture with an extension that is no SVG')
  const svg = extensions.map((each) => only(each, NS.asvg, 'svgBlip', reading.name))
  if (svg.length > 1) fail(reading, 'a picture with two SVGs')
  const crop = child(fill, NS.a, 'srcRect')
  const cut = (side: string): number => (crop === undefined ? 0 : (measure(reading, crop, side, 100_000) ?? 0))
  return {
    id: needed(reading, named, 'id', 1),
    name: named.attributes.get('name') ?? fail(reading, 'a picture with no name'),
    width,
    height,
    part: image(reading, blip),
    ...(svg[0] === undefined ? {} : { svg: image(reading, svg[0]) }),
    ...(crop === undefined ? {} : { crop: { left: cut('l'), top: cut('t'), right: cut('r'), bottom: cut('b') } }),
  }
}

/** The part `node` embeds, through an image relationship of the part being read. */
function image(reading: Reading, node: XmlNode): Part {
  return related(reading, node.attributes.get(attr('r', 'embed')), 'image')
}

/** The part the relationship `id` of the part being read leads to, of the type `kind`; the relationship is then used. */
function related(reading: Reading, id: string | undefined, kind: string): Part {
  const found = reading.opc.relationships(reading.name).find((each) => each.id === id)
  if (found === undefined) return fail(reading, `the relationship ${String(id)}, which the part does not have`)
  if (found.type !== `${TYPE}/${kind}`) fail(reading, `the relationship ${found.id} is used as a ${kind} and is none`)
  reading.used.add(found.id)
  return reading.opc.parts.get(found.target)!
}

/** A paragraph's runs: text and line breaks joined run by run, a field read from the three runs it is written as, a picture alone in its run. */
function runs(reading: Reading, paragraph: XmlNode): DocxRun[] {
  const read: DocxRun[] = []
  let field: { instruction: string | undefined; readonly props: DocxRunProps } | undefined
  for (const run of childrenNamed(paragraph, NS.w, 'r')) {
    const props = runProps(reading, child(run, NS.w, 'rPr'))
    const content = run.children.filter((each) => each.local !== 'rPr')
    const kinds = new Set(content.map((each) => each.local))
    const alone = (local: string): boolean => kinds.size === 1 && kinds.has(local) && content.length === 1
    const sameProps = (): boolean => JSON.stringify(props) === JSON.stringify(field?.props)
    if (alone('fldChar')) {
      const type = content[0]!.attributes.get(w('fldCharType'))
      if (type === 'begin' && field === undefined) field = { instruction: undefined, props }
      else if (type === 'end' && field?.instruction !== undefined && sameProps()) {
        const name = field.instruction.trim()
        if (name !== 'PAGE' && name !== 'NUMPAGES') fail(reading, `the field '${name}', where a file holds PAGE and NUMPAGES alone`)
        read.push({ kind: 'field', field: name, props })
        field = undefined
      } else fail(reading, 'a field that is not written as its beginning, its instruction and its end')
    } else if (alone('instrText')) {
      if (field === undefined || field.instruction !== undefined || !sameProps()) fail(reading, 'a field instruction outside a field')
      preserved(reading, content[0]!)
      field.instruction = content[0]!.text
    } else if (field !== undefined) fail(reading, 'a field with something else inside it')
    else if (alone('drawing')) read.push({ kind: 'picture', picture: picture(reading, content[0]!), props })
    else if (content.length > 0 && content.every((each) => each.local === 't' || each.local === 'br')) {
      read.push({ kind: 'text', text: content.map((each) => (each.local === 'br' ? '\n' : preserved(reading, each))).join(''), props })
    } else fail(reading, 'a run that is empty, or mixes text with a field or a picture')
  }
  if (field !== undefined) fail(reading, 'a field that does not end')
  return read
}

/** A text element's text, once it says its white space is kept: Word strips one that does not at either end. */
function preserved(reading: Reading, node: XmlNode): string {
  if (node.attributes.get(attr('xml', 'space')) !== 'preserve')
    fail(reading, `${node.local} without xml:space="preserve": Word would strip the spaces at its ends`)
  return node.text
}

function paragraph(reading: Reading, node: XmlNode): DocxParagraph {
  const properties = child(node, NS.w, 'pPr')
  const has = (local: string): XmlNode | undefined => (properties === undefined ? undefined : child(properties, NS.w, local))
  const [spacing, indent, borders] = [has('spacing'), has('ind'), has('pBdr')]
  const align = has('jc')?.attributes.get(w('val'))
  if (align !== undefined && align !== 'left' && align !== 'center' && align !== 'right') fail(reading, `a paragraph is aligned '${align}'`)
  return {
    kind: 'paragraph',
    runs: runs(reading, node),
    ...(align === undefined ? {} : { align }),
    keepNext: has('keepNext') !== undefined,
    keepLines: has('keepLines') !== undefined,
    pageBreakBefore: has('pageBreakBefore') !== undefined,
    ...spaced(reading, spacing),
    indent: indent === undefined ? 0 : (measure(reading, indent, w('left'), TWIPS) ?? 0),
    ...lines(reading, borders),
    mark: runProps(reading, has('rPr')),
  }
}

/** A paragraph's space before and after it and its line, as `w:spacing` states them. */
function spaced(reading: Reading, spacing: XmlNode | undefined): Pick<DocxParagraph, 'before' | 'after' | 'line'> {
  if (spacing === undefined) return { before: 0, after: 0 }
  const rule = spacing.attributes.get(w('lineRule'))
  const height = measure(reading, spacing, w('line'), rule === 'auto' ? 240 : TWIPS)
  if ((height === undefined) !== (rule === undefined) || (rule !== undefined && rule !== 'exact' && rule !== 'auto'))
    fail(reading, 'a paragraph states its line without saying whether exactly, or the rule without the line')
  return {
    before: measure(reading, spacing, w('before'), TWIPS) ?? 0,
    after: measure(reading, spacing, w('after'), TWIPS) ?? 0,
    ...(height === undefined ? {} : { line: { height, rule: rule as 'exact' | 'auto' } }),
  }
}

function lines(reading: Reading, borders: XmlNode | undefined): Pick<DocxParagraph, 'bottom' | 'between'> {
  if (borders === undefined) return {}
  const [bottom, between] = [border(reading, child(borders, NS.w, 'bottom')), border(reading, child(borders, NS.w, 'between'))]
  if (borders.children.some((each) => each.local !== 'bottom' && each.local !== 'between')) fail(reading, 'a paragraph bordered above or beside')
  return { ...(bottom === undefined ? {} : { bottom }), ...(between === undefined ? {} : { between }) }
}

function table(reading: Reading, node: XmlNode): DocxTable {
  const properties = only(node, NS.w, 'tblPr', reading.name)
  if (child(properties, NS.w, 'tblLayout')?.attributes.get(w('type')) !== 'fixed') fail(reading, 'a table that is not of fixed layout')
  const grid = childrenNamed(only(node, NS.w, 'tblGrid', reading.name), NS.w, 'gridCol').map((column) => needed(reading, column, w('w'), TWIPS))
  const borders = child(properties, NS.w, 'tblBorders')
  const [insideH, insideV] = ['insideH', 'insideV'].map((local) => border(reading, borders === undefined ? undefined : child(borders, NS.w, local)))
  const margins = child(properties, NS.w, 'tblCellMar')
  const rows = childrenNamed(node, NS.w, 'tr').map((each) => row(reading, each))
  if (rows.length === 0 || rows.some((each) => each.cells.reduce((sum, cell) => sum + cell.span, 0) !== grid.length))
    fail(reading, 'a table with no row, or with a row whose cells do not fill its grid')
  return {
    kind: 'table',
    width: dxa(reading, child(properties, NS.w, 'tblW')) ?? fail(reading, 'a table with no width'),
    grid,
    borders: {
      ...sides(borders, (side) => border(reading, side)),
      ...(insideH === undefined ? {} : { insideH }),
      ...(insideV === undefined ? {} : { insideV }),
    },
    ...(margins === undefined ? {} : { margins: sides(margins, (side) => dxa(reading, side)) }),
    rows,
  }
}

function row(reading: Reading, node: XmlNode): DocxRow {
  const properties = child(node, NS.w, 'trPr')
  const has = (local: string): XmlNode | undefined => (properties === undefined ? undefined : child(properties, NS.w, local))
  const height = has('trHeight')
  const rule = height?.attributes.get(w('hRule'))
  if (height !== undefined && rule !== 'exact' && rule !== 'atLeast') fail(reading, 'a row states its height without saying whether exactly or at least')
  return {
    header: has('tblHeader') !== undefined,
    cantSplit: has('cantSplit') !== undefined,
    ...(height === undefined ? {} : { height: { value: needed(reading, height, w('val'), TWIPS), rule: rule as 'exact' | 'atLeast' } }),
    cells: childrenNamed(node, NS.w, 'tc').map((each) => cell(reading, each)),
  }
}

function cell(reading: Reading, node: XmlNode): DocxCell {
  const properties = only(node, NS.w, 'tcPr', reading.name)
  const shade = child(properties, NS.w, 'shd')
  if (shade !== undefined && (shade.attributes.get(w('val')) !== 'clear' || shade.attributes.get(w('color')) !== 'auto'))
    fail(reading, 'a cell shaded otherwise than by a plain fill')
  const span = child(properties, NS.w, 'gridSpan')
  const direction = child(properties, NS.w, 'textDirection')?.attributes.get(w('val'))
  if (direction !== undefined && direction !== 'btLr')
    fail(reading, `a cell whose text is turned '${direction}', where a file turns one from bottom to top alone`)
  return {
    width: dxa(reading, child(properties, NS.w, 'tcW')) ?? fail(reading, 'a cell with no width'),
    span: span === undefined ? 1 : needed(reading, span, w('val'), 1),
    borders: sides(child(properties, NS.w, 'tcBorders'), (side) => border(reading, side)),
    ...(shade === undefined ? {} : { shade: color(reading, shade.attributes.get(w('fill')), 'a cell') }),
    ...(direction === undefined ? {} : { direction }),
    blocks: blocks(reading, node, 'a cell'),
  }
}

/** The paragraphs and tables `node` holds, which end with a paragraph wherever Word asks for one: in `what`, a cell, a header or a footer. */
function blocks(reading: Reading, node: XmlNode, what?: string): DocxBlock[] {
  const read = node.children.flatMap((each): DocxBlock[] =>
    each.local === 'p' ? [paragraph(reading, each)] : each.local === 'tbl' ? [table(reading, each)] : [],
  )
  if (what !== undefined && read.at(-1)?.kind !== 'paragraph') fail(reading, `${what} that does not end with a paragraph`)
  return read
}

/** A header's or a footer's part, read once however many references name it. */
function region(opc: OpcPackage, part: Part, kind: 'header' | 'footer'): DocxRegion {
  const reading: Reading = { name: part.name, opc, used: new Set() }
  if (part.contentType !== `${MAIN}.${kind}+xml`) fail(reading, `the part is referenced as a ${kind} and is of another content type`)
  const root = readPart(part.bytes, part.name, kind === 'header' ? HEADER : FOOTER)
  const read = { part: part.name, blocks: blocks(reading, root, `a ${kind}`) }
  unused(reading, [])
  return read
}

/** Refuses a relationship of the part read that nothing in it used, and one of a type the part may not have. */
function unused(reading: Reading, kinds: readonly string[]): void {
  for (const { id, type } of reading.opc.relationships(reading.name)) {
    if (![...kinds, 'image'].some((kind) => type === `${TYPE}/${kind}`)) fail(reading, `the relationship ${id} is of a type a file does not hold (${type})`)
    if (!reading.used.has(id)) fail(reading, `the relationship ${id} is used by nothing in the part`)
  }
}

/** `bytes` read as a Word file; throws, naming the part, where they are not one report-render-docx writes. */
export function readDocx(bytes: Uint8Array): Docx {
  const opc = readPackage(bytes)
  const own = opc.relationships('')
  const main = own.filter((each) => each.type === `${TYPE}/officeDocument`)
  const core = own.filter((each) => each.type === CORE_TYPE)
  if (main.length !== 1 || core.length > 1 || own.length !== main.length + core.length)
    throw new Error('_rels/.rels: the package has not one main document, or a relationship of a type a file does not hold')
  const part = opc.parts.get(main[0]!.target)!
  const reading: Reading = { name: part.name, opc, used: new Set() }
  if (part.contentType !== `${MAIN}.document.main+xml`) fail(reading, 'the main document is of another content type')
  const body = only(readPart(part.bytes, part.name, DOCUMENT), NS.w, 'body', part.name)
  const section = only(body, NS.w, 'sectPr', part.name)
  const regions = new Map<string, DocxRegion>()
  const referenced = (kind: 'header' | 'footer', type: 'default' | 'first'): DocxRegion | undefined => {
    const references = childrenNamed(section, NS.w, `${kind}Reference`)
    if (references.some((each) => each.attributes.get(w('type')) !== 'default' && each.attributes.get(w('type')) !== 'first'))
      fail(reading, `a ${kind} for pages other than the first and the rest`)
    const named = references.filter((each) => each.attributes.get(w('type')) === type)
    if (named.length > 1) fail(reading, `two ${type} ${kind}s`)
    if (named[0] === undefined) return undefined
    const target = related(reading, named[0].attributes.get(attr('r', 'id')), kind)
    const known = regions.get(target.name) ?? region(opc, target, kind)
    regions.set(target.name, known)
    return known
  }
  const [header, firstHeader, footer, firstFooter] = [
    referenced('header', 'default'),
    referenced('header', 'first'),
    referenced('footer', 'default'),
    referenced('footer', 'first'),
  ]
  const read = blocks(reading, body)
  const single = (kind: string, suffix: string): Part => {
    const found = opc.relationships(part.name).filter((each) => each.type === `${TYPE}/${kind}`)
    if (found.length !== 1) fail(reading, `the document has not one ${kind} part`)
    reading.used.add(found[0]!.id)
    const target = opc.parts.get(found[0]!.target)!
    if (target.contentType !== `${MAIN}.${suffix}+xml`) fail({ name: target.name }, `the part is the document's ${kind} and is of another content type`)
    return target
  }
  const [styles, settings, fonts] = [single('styles', 'styles'), single('settings', 'settings'), single('fontTable', 'fontTable')]
  unused(reading, ['header', 'footer', 'styles', 'settings', 'fontTable'])
  const properties = core[0] === undefined ? undefined : readPart(opc.parts.get(core[0].target)!.bytes, core[0].target, CORE)
  const [title, created] = ['title', 'created'].map((local, index) =>
    properties === undefined ? undefined : child(properties, index === 0 ? NS.dc : NS.dcterms, local)?.text,
  )
  const mode = compatibilityMode(readPart(settings.bytes, settings.name, SETTINGS))
  return {
    page: page({ ...reading, name: part.name }, section),
    body: read,
    ...(header === undefined ? {} : { header }),
    ...(firstHeader === undefined ? {} : { firstHeader }),
    ...(footer === undefined ? {} : { footer }),
    ...(firstFooter === undefined ? {} : { firstFooter }),
    fonts: childrenNamed(readPart(fonts.bytes, fonts.name, FONTS), NS.w, 'font').map((font) => ({
      name: font.attributes.get(w('name')) ?? fail({ name: fonts.name }, 'a font with no name'),
      family: child(font, NS.w, 'family')?.attributes.get(w('val')) ?? fail({ name: fonts.name }, 'a font with no family'),
      pitch: child(font, NS.w, 'pitch')?.attributes.get(w('val')) ?? fail({ name: fonts.name }, 'a font with no pitch'),
    })),
    defaults: defaults({ name: styles.name, opc, used: new Set() }, readPart(styles.bytes, styles.name, STYLES)),
    ...(mode === undefined ? {} : { compatibilityMode: mode }),
    ...(title === undefined ? {} : { title }),
    ...(created === undefined ? {} : { created }),
    parts: opc.parts,
    relationships: opc.relationships,
  }
}

function page(reading: Reading, section: XmlNode): DocxPage {
  const [size, margins] = [only(section, NS.w, 'pgSz', reading.name), only(section, NS.w, 'pgMar', reading.name)]
  const orientation = size.attributes.get(w('orient')) ?? 'portrait'
  if (orientation !== 'portrait' && orientation !== 'landscape') fail(reading, `the page is turned '${orientation}'`)
  const margin = (side: string): number => needed(reading, margins, w(side), TWIPS)
  if (margin('gutter') !== 0) fail(reading, 'the page has a gutter')
  return {
    width: needed(reading, size, w('w'), TWIPS),
    height: needed(reading, size, w('h'), TWIPS),
    orientation,
    margins: { top: margin('top'), right: margin('right'), bottom: margin('bottom'), left: margin('left') },
    header: margin('header'),
    footer: margin('footer'),
    titlePage: child(section, NS.w, 'titlePg') !== undefined,
  }
}

function defaults(reading: Reading, styles: XmlNode): Docx['defaults'] {
  const stated = child(styles, NS.w, 'docDefaults')
  const run = stated === undefined ? undefined : child(stated, NS.w, 'rPrDefault')
  const paragraphs = stated === undefined ? undefined : child(stated, NS.w, 'pPrDefault')
  const properties = paragraphs === undefined ? undefined : child(paragraphs, NS.w, 'pPr')
  return {
    run: runProps(reading, run === undefined ? undefined : child(run, NS.w, 'rPr')),
    ...spaced(reading, properties === undefined ? undefined : child(properties, NS.w, 'spacing')),
  }
}

function compatibilityMode(settings: XmlNode): string | undefined {
  const compat = child(settings, NS.w, 'compat')
  const setting =
    compat === undefined ? undefined : childrenNamed(compat, NS.w, 'compatSetting').find((each) => each.attributes.get(w('name')) === 'compatibilityMode')
  return setting?.attributes.get(w('val'))
}
