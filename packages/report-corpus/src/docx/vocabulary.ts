import type { ElementDef, Group } from './xml.js'

/**
 * The closed vocabulary a Word file is read in (0068): every element and
 * attribute `readDocx` reads, and each element's children in the order
 * ECMA-376 Part 1 gives them, transcribed from ISO/IEC 29500-4:2016's
 * transitional `wml.xsd`, `dml-main.xsd`, `dml-picture.xsd` and
 * `dml-wordprocessingDrawing.xsd` for these elements and no others; a
 * chart's part is `chart-vocabulary.ts`'s, from `dml-chart.xsd` (0076). An
 * element that stands in two places with other contents -- `w:top` a
 * border in `w:tblBorders` and a width in `w:tblCellMar`, `a:ext` a size
 * in `a:xfrm` and an extension in `a:extLst` -- is a definition for each.
 *
 * The schema makes a run's and a row's properties a choice, in any order;
 * they are held here to the order the schema lists them in, which is the
 * order Word writes. What is transcribed is transcribed once more in the
 * writer: a mistake made in both passes here, and a schema in a gate
 * would find it.
 */

export const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  c: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
  asvg: 'http://schemas.microsoft.com/office/drawing/2016/SVG/main',
  xml: 'http://www.w3.org/XML/1998/namespace',
  cp: 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties',
  dc: 'http://purl.org/dc/elements/1.1/',
  dcterms: 'http://purl.org/dc/terms/',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance',
} as const

type Prefix = keyof typeof NS

/** `{namespace}local` for an attribute written `prefix:local`. */
export const attr = (prefix: Prefix, local: string): string => `{${NS[prefix]}}${local}`

const W = (...locals: string[]): string[] => locals.map((local) => attr('w', local))

/** One element at most. */
export const one = (def: ElementDef): Group => ({ of: [def] })
/** Any number of these, in any order. */
export const many = (...of: ElementDef[]): Group => ({ of, many: true })

export const element = (prefix: Prefix, local: string, attributes: readonly string[] = [], content: () => readonly Group[] = () => []): ElementDef => ({
  uri: NS[prefix],
  local,
  attributes,
  content,
})

export const text = (prefix: Prefix, local: string, attributes: readonly string[] = []): ElementDef => ({ ...element(prefix, local, attributes), text: true })

/** An element that is on by standing there: the writer writes none off, and no `w:val`. */
const flag = (local: string): ElementDef => element('w', local)

const border = (local: string): ElementDef => element('w', local, W('val', 'sz', 'space', 'color'))
const width = (local: string): ElementDef => element('w', local, W('w', 'type'))
const value = (local: string): ElementDef => element('w', local, W('val'))

/** A run's properties, in the order `CT_RPr` lists the ones written. */
const rPr: ElementDef = element('w', 'rPr', [], () => [
  one(element('w', 'rFonts', W('ascii', 'hAnsi', 'eastAsia', 'cs'))),
  one(flag('b')),
  one(flag('i')),
  one(value('color')),
  one(value('sz')),
  one(value('szCs')),
  one(value('vertAlign')),
])

/** A paragraph's properties, in `CT_PPr`'s order. */
const pPr: ElementDef = element('w', 'pPr', [], () => [
  one(flag('keepNext')),
  one(flag('keepLines')),
  one(flag('pageBreakBefore')),
  one(element('w', 'pBdr', [], () => [one(border('top')), one(border('left')), one(border('bottom')), one(border('right')), one(border('between'))])),
  one(element('w', 'spacing', W('before', 'after', 'line', 'lineRule'))),
  one(element('w', 'ind', W('left', 'right'))),
  one(value('jc')),
  one(rPr),
  // The section a paragraph ends (0075): read through `content`, never before the module is whole.
  one(sectionDef()),
])

const blip: ElementDef = element('a', 'blip', [attr('r', 'embed')], () => [
  one(element('a', 'extLst', [], () => [many(element('a', 'ext', ['uri'], () => [one(element('asvg', 'svgBlip', [attr('r', 'embed')]))]))])),
])

const picture: ElementDef = element('pic', 'pic', [], () => [
  one(element('pic', 'nvPicPr', [], () => [one(element('pic', 'cNvPr', ['id', 'name'])), one(element('pic', 'cNvPicPr'))])),
  one(
    element('pic', 'blipFill', [], () => [
      one(blip),
      one(element('a', 'srcRect', ['l', 't', 'r', 'b'])),
      one(element('a', 'stretch', [], () => [one(element('a', 'fillRect'))])),
    ]),
  ),
  one(
    element('pic', 'spPr', [], () => [
      one(element('a', 'xfrm', [], () => [one(element('a', 'off', ['x', 'y'])), one(element('a', 'ext', ['cx', 'cy']))])),
      one(element('a', 'prstGeom', ['prst'], () => [one(element('a', 'avLst'))])),
    ]),
  ),
])

const drawing: ElementDef = element('w', 'drawing', [], () => [
  one(
    element('wp', 'inline', ['distT', 'distB', 'distL', 'distR'], () => [
      one(element('wp', 'extent', ['cx', 'cy'])),
      one(element('wp', 'docPr', ['id', 'name'])),
      // A picture, or the reference to a chart's part (0076): which of the two is `uri`'s to say, and the reader's to hold.
      one(element('a', 'graphic', [], () => [one(element('a', 'graphicData', ['uri'], () => [one(picture), one(element('c', 'chart', [attr('r', 'id')]))]))])),
    ]),
  ),
])

const run: ElementDef = element('w', 'r', [], () => [
  one(rPr),
  many(
    text('w', 't', [attr('xml', 'space')]),
    element('w', 'br'),
    element('w', 'fldChar', W('fldCharType')),
    text('w', 'instrText', [attr('xml', 'space')]),
    drawing,
  ),
])

const paragraph: ElementDef = element('w', 'p', [], () => [one(pPr), many(run)])

const sides = (make: (local: string) => ElementDef, ...locals: string[]): Group[] => locals.map((local) => one(make(local)))

const cell: ElementDef = element('w', 'tc', [], () => [
  one(
    element('w', 'tcPr', [], () => [
      one(width('tcW')),
      one(value('gridSpan')),
      one(element('w', 'tcBorders', [], () => sides(border, 'top', 'left', 'bottom', 'right'))),
      one(element('w', 'shd', W('val', 'color', 'fill'))),
      one(value('textDirection')),
      one(value('vAlign')),
    ]),
  ),
  many(paragraph, table),
])

const row: ElementDef = element('w', 'tr', [], () => [
  one(element('w', 'trPr', [], () => [one(flag('cantSplit')), one(element('w', 'trHeight', W('val', 'hRule'))), one(flag('tblHeader'))])),
  many(cell),
])

/** Hoisted, since a cell holds tables: read through `content`, never before the module is whole. */
function tableContent(): readonly Group[] {
  return [
    one(
      element('w', 'tblPr', [], () => [
        one(width('tblW')),
        one(element('w', 'tblBorders', [], () => sides(border, 'top', 'left', 'bottom', 'right', 'insideH', 'insideV'))),
        one(element('w', 'tblLayout', W('type'))),
        one(element('w', 'tblCellMar', [], () => sides(width, 'top', 'left', 'bottom', 'right'))),
      ]),
    ),
    one(element('w', 'tblGrid', [], () => [many(element('w', 'gridCol', W('w')))])),
    many(row),
  ]
}

const table: ElementDef = { uri: NS.w, local: 'tbl', attributes: [], content: tableContent }

const reference = (local: string): ElementDef => element('w', local, [attr('w', 'type'), attr('r', 'id')])

/** Hoisted, since a paragraph's properties hold the section it ends. */
function sectionDef(): ElementDef {
  return section
}

const section: ElementDef = element('w', 'sectPr', [], () => [
  many(reference('headerReference'), reference('footerReference')),
  one(element('w', 'pgSz', W('w', 'h', 'orient'))),
  one(element('w', 'pgMar', W('top', 'right', 'bottom', 'left', 'header', 'footer', 'gutter'))),
  one(flag('titlePg')),
])

/** `word/document.xml`. */
export const DOCUMENT: ElementDef = element('w', 'document', [], () => [one(element('w', 'body', [], () => [many(paragraph, table), one(section)]))])

/** A header part and a footer part. */
export const HEADER: ElementDef = element('w', 'hdr', [], () => [many(paragraph, table)])
export const FOOTER: ElementDef = element('w', 'ftr', [], () => [many(paragraph, table)])

/** `word/styles.xml`: the document's defaults, and no style. */
export const STYLES: ElementDef = element('w', 'styles', [], () => [
  one(element('w', 'docDefaults', [], () => [one(element('w', 'rPrDefault', [], () => [one(rPr)])), one(element('w', 'pPrDefault', [], () => [one(pPr)]))])),
])

/** `word/settings.xml`: the compatibility mode alone. */
export const SETTINGS: ElementDef = element('w', 'settings', [], () => [
  one(element('w', 'compat', [], () => [many(element('w', 'compatSetting', W('name', 'uri', 'val')))])),
])

/** `word/fontTable.xml`. */
export const FONTS: ElementDef = element('w', 'fonts', [], () => [
  many(element('w', 'font', W('name'), () => [one(value('altName')), one(value('family')), one(value('pitch'))])),
])

/** `docProps/core.xml`: the title and the creation date. */
export const CORE: ElementDef = element('cp', 'coreProperties', [], () => [one(text('dc', 'title')), one(text('dcterms', 'created', [attr('xsi', 'type')]))])
