import { strToU8, zipSync, type Zippable } from 'fflate'
import { SWISS_CODE_SIZE, type Block, type Chart, type ImageAsset, type QrSymbol, type ResolvedDocument } from '@formancy/report-runtime'
import { SVG_FALLBACK, type Picture } from './assets.js'
import { nodesOf, type Build } from './blocks.js'
import { chartXml } from './chart-xml.js'
import type { Checked } from './check.js'
import { codePng } from './code-png.js'
import { CAPTION_FAMILY, captioned, type Code } from './codes.js'
import type { DocxFonts, FontEntry } from './fonts.js'
import { DEFAULT_SIZE, REGION_GAP } from './look.js'
import { emptyLine, SEPARATOR, type BlockNode, type RelationshipId, type SectionNode } from './nodes.js'
import { slipNodes, slipPage } from './slip.js'
import { swissPixels, swissPng } from './slip-code.js'
import { SLIP_FAMILY, SLIP_OTHER_FAMILY } from './slip-widths.js'
import { halfPoints } from './units.js'
import { fontSlots, NAMESPACES, sectionProperties, writer } from './wml.js'
import { attribute, element, own, part, text, type AttributeValue, type Name, type Xml } from './xml.js'

/**
 * The file itself (0068): the package's parts, their content types and
 * relationships as ECMA-376's Part 2 has them, zipped by fflate.
 *
 * Every name in it is the writer's own. A part is named by what it is
 * and its order -- `word/header1.xml`, `word/media/image2.png` -- a
 * relationship by its order in its part, a picture by its number;
 * nothing a document carries is a part's name, a relationship's target
 * or a field's instruction, and no relationship leads outside the
 * package.
 *
 * The same document gives the same bytes: the parts are written in one
 * order, every entry is dated `zipEpoch` and deflated by fflate's own
 * code, which is the same in every host -- or stored as it is, where it
 * is a PNG or a JPEG, which are compressed already. A code's picture is
 * a PNG the writer makes of its symbol (`code-png.ts`), whose data
 * fflate deflated already, and is stored as one. A chart is a part of its
 * own, `word/charts/chart1.xml`, numbered as the body meets it, which
 * the body's part alone leads to and which leads nowhere: it has no
 * relationships part, so no workbook and no address (0076).
 *
 * A report paid by a QR-bill is two sections (0075): the report's, which
 * its body's last paragraph ends, and the slip's page, the file's last,
 * which the body's end states. A section with no header or footer of its
 * own prints the one before it, so where the report prints a page header
 * or a page footer the slip's section names an empty one in its place,
 * `word/header3.xml` and `word/footer2.xml`: a header of unknown height
 * above the slip would push it down the page, and a footer would print
 * into it.
 */

/**
 * What every entry of the zip is dated: 1 January 1980, 00:00:00, the
 * first date a zip can hold. Made of local fields, since fflate reads a
 * date's local fields into the entry: the same fields, and so the same
 * bytes, whatever the machine's clock and time zone.
 *
 * Made for each file, never once as the module loads: a date is an
 * instant, and its local fields are those of the zone the process is in
 * when they are read. A process that sets its zone after its imports
 * would read another day of a date made before, and one of 1979 is an
 * Error of fflate's and no refusal.
 */
export function zipEpoch(): Date {
  return new Date(1980, 0, 1, 0, 0, 0)
}

const RELATIONSHIPS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const MAIN = 'application/vnd.openxmlformats-officedocument.wordprocessingml'

type RelationshipKind = 'styles' | 'settings' | 'fontTable' | 'header' | 'footer' | 'image' | 'chart'

const CHART_TYPE = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml'

/** One part's relationships, each named by its order; a target named twice is one relationship. */
interface Relationships {
  readonly to: (kind: RelationshipKind, target: string) => RelationshipId
  /** The relationships part's text, or undefined where the part has none. */
  readonly part: () => string | undefined
}

function relationships(): Relationships {
  // By target, in the order each was first named, which a Map keeps: found by its key, never by a walk of those named before it, since
  // a part asks once for every picture it draws.
  const targets = new Map<string, { readonly kind: RelationshipKind; readonly id: RelationshipId }>()
  return {
    to: (kind, target) => {
      const known = targets.get(target)
      if (known !== undefined) return known.id
      const id: RelationshipId = `rId${targets.size + 1}`
      targets.set(target, { kind, id })
      return id
    },
    part: () => (targets.size === 0 ? undefined : relationshipsPart([...targets].map(([target, { kind }]) => [own(`${RELATIONSHIPS}/${kind}`), target]))),
  }
}

/** A relationships part: each target is the writer's own name of a part, written as an attribute all the same. */
function relationshipsPart(targets: readonly (readonly [Xml, string])[]): string {
  return part(
    element(
      'Relationships',
      [['xmlns', own('http://schemas.openxmlformats.org/package/2006/relationships')]],
      targets.map(([type, target], index) =>
        element('Relationship', [
          ['Id', own(`rId${index + 1}`)],
          ['Type', type],
          ['Target', attribute(target)],
        ]),
      ),
    ),
  )
}

const EXTENSIONS: Readonly<Record<Picture['kind'], { readonly extension: string; readonly contentType: string }>> = {
  png: { extension: 'png', contentType: 'image/png' },
  jpeg: { extension: 'jpeg', contentType: 'image/jpeg' },
  svg: { extension: 'svg', contentType: 'image/svg+xml' },
}

/** The file's pictures: each asset's bytes a part, written once however often it is drawn, and each code's picture a part, numbered as it is first met. */
interface Media {
  readonly of: (asset: ImageAsset, picture: Picture) => string
  readonly fallback: () => string
  /** The part of `code`'s picture: its symbol drawn at `pixels` a module. */
  readonly code: (code: Code, symbol: QrSymbol, pixels: number) => string
  /** The part of a slip's Swiss QR Code: its symbol with the Swiss cross over it. */
  readonly swiss: (symbol: QrSymbol) => string
  /** Each part's name under `word/`, its bytes, and whether it is deflated. */
  readonly parts: Map<string, { readonly bytes: Uint8Array; readonly kind: Picture['kind'] }>
}

function media(): Media {
  const parts: Media['parts'] = new Map()
  const names = new Map<ImageAsset | Code | 'fallback' | 'swiss', string>()
  const named = (key: ImageAsset | Code | 'fallback' | 'swiss', bytes: () => Uint8Array, kind: Picture['kind']): string => {
    const known = names.get(key)
    if (known !== undefined) return known
    const name = `media/image${names.size + 1}.${EXTENSIONS[kind].extension}`
    names.set(key, name)
    parts.set(name, { bytes: bytes(), kind })
    return name
  }
  return {
    of: (asset, picture) => named(asset, () => asset.bytes, picture.kind),
    fallback: () => named('fallback', () => SVG_FALLBACK, 'png'),
    code: (code, symbol, pixels) => named(code, () => codePng(symbol, pixels), 'png'),
    swiss: (symbol) => named('swiss', () => swissPng(symbol, swissPixels(symbol)), 'png'),
    parts,
  }
}

/** An element whose one attribute is `w:val`. */
const valued = (name: Name, value: AttributeValue): Xml => element(name, [['w:val', value]])

/** The styles part: what Word would otherwise add to every paragraph -- space after it, a line taller than single -- taken away, and the default face and size. */
function styles(fonts: DocxFonts): string {
  const size = halfPoints(DEFAULT_SIZE)
  const run = element('w:rPrDefault', [], [element('w:rPr', [], [fontSlots(fonts.family(undefined)), valued('w:sz', size), valued('w:szCs', size)])])
  const spacing = element('w:spacing', [
    ['w:before', 0],
    ['w:after', 0],
    ['w:line', 240],
    ['w:lineRule', own('auto')],
  ])
  const paragraph = element('w:pPrDefault', [], [element('w:pPr', [], [spacing])])
  return part(element('w:styles', [NAMESPACES[0]!], [element('w:docDefaults', [], [run, paragraph])]))
}

/** The settings part: the compatibility mode Word itself writes, 15, so that the file is read as one of the current format and laid out by its rules. */
function settings(): string {
  const mode = element('w:compatSetting', [
    ['w:name', own('compatibilityMode')],
    ['w:uri', own('http://schemas.microsoft.com/office/word')],
    ['w:val', own('15')],
  ])
  return part(element('w:settings', [NAMESPACES[0]!], [element('w:compat', [], [mode])]))
}

/** The font table: each family the file may name, another name a reader may find it by where it has one, and the kind a reader without it chooses another by; a modern face is of fixed pitch. */
function fontTable(families: readonly FontEntry[]): string {
  const entries = families.map(({ name, kind, other }) =>
    element(
      'w:font',
      [['w:name', attribute(name)]],
      [
        ...(other === undefined ? [] : [valued('w:altName', attribute(other))]),
        valued('w:family', own(kind)),
        valued('w:pitch', own(kind === 'modern' ? 'fixed' : 'variable')),
      ],
    ),
  )
  return part(element('w:fonts', [NAMESPACES[0]!], entries))
}

/** The core properties: the title, and the creation date the document carries, as the writer wrote it out. */
function core(title: string, created: string): string {
  return part(
    element(
      'cp:coreProperties',
      [
        ['xmlns:cp', own('http://schemas.openxmlformats.org/package/2006/metadata/core-properties')],
        ['xmlns:dc', own('http://purl.org/dc/elements/1.1/')],
        ['xmlns:dcterms', own('http://purl.org/dc/terms/')],
        ['xmlns:xsi', own('http://www.w3.org/2001/XMLSchema-instance')],
      ],
      [element('dc:title', [], [text(title)]), element('dcterms:created', [['xsi:type', own('dcterms:W3CDTF')]], [text(created)])],
    ),
  )
}

function contentTypes(overrides: readonly (readonly [string, string])[], kinds: ReadonlySet<Picture['kind']>): string {
  const standard = (extension: string, contentType: string): Xml =>
    element('Default', [
      ['Extension', attribute(extension)],
      ['ContentType', attribute(contentType)],
    ])
  return part(
    element(
      'Types',
      [['xmlns', own('http://schemas.openxmlformats.org/package/2006/content-types')]],
      [
        standard('rels', 'application/vnd.openxmlformats-package.relationships+xml'),
        standard('xml', 'application/xml'),
        ...(['png', 'jpeg', 'svg'] as const)
          .filter((kind) => kinds.has(kind))
          .map((kind) => standard(EXTENSIONS[kind].extension, EXTENSIONS[kind].contentType)),
        ...overrides.map(([name, contentType]) =>
          element('Override', [
            ['PartName', attribute(`/${name}`)],
            ['ContentType', attribute(contentType)],
          ]),
        ),
      ],
    ),
  )
}

/** `document`, which the checks passed, as the bytes of its Word file. */
export function writePackage(document: ResolvedDocument, checked: Checked, fonts: DocxFonts): Uint8Array {
  const { page } = checked
  const pictures = media()
  const drawn = { pictures: 0 }
  const write = writer()
  const building = (links: Relationships): Build => ({
    fonts,
    pictures: checked.pictures,
    embed: (asset, picture) => links.to('image', pictures.of(asset, picture)),
    fallback: () => links.to('image', pictures.fallback()),
    codes: checked.codes,
    code: (code, symbol, pixels) => links.to('image', pictures.code(code, symbol, pixels)),
    chart: (chart) => links.to('chart', chartPart(chart)),
    drawn,
  })
  const files: [string, string][] = []
  const overrides: [string, string][] = []
  /** A chart's part, its name under `word/`: one for each chart the body draws, numbered as the body meets it. */
  let charts = 0
  const chartPart = (chart: Chart): string => {
    charts += 1
    const name = `charts/chart${charts}.xml`
    files.push([`word/${name}`, chartXml(chart, fonts)])
    overrides.push([`word/${name}`, CHART_TYPE])
    return name
  }
  /** A header's or a footer's part, where the region holds blocks: its name under `word/`. A header ends, and a footer begins, with the gap to the body. */
  const region = (blocks: readonly Block[], kind: 'header' | 'footer', name: string): string | undefined => {
    if (blocks.length === 0) return undefined
    const links = relationships()
    const nodes = nodesOf(blocks, building(links), page.width)
    const whole: BlockNode[] = kind === 'header' ? [...nodes, emptyLine(REGION_GAP)] : [emptyLine(REGION_GAP), ...closed(nodes)]
    files.push([`word/${name}`, part(element(kind === 'header' ? 'w:hdr' : 'w:ftr', NAMESPACES, [write.blocks(whole)]))])
    const rels = links.part()
    if (rels !== undefined) files.push([`word/_rels/${name}.rels`, rels])
    overrides.push([`word/${name}`, `${MAIN}.${kind}+xml`])
    return name
  }
  // In the order the checks walk, which is the order the pictures are numbered in.
  const header = region(document.pageHeader, 'header', 'header1.xml')
  const first = region(document.firstPageHeader ?? [], 'header', 'header2.xml')
  const footer = region(document.pageFooter, 'footer', 'footer1.xml')
  const links = relationships()
  for (const kind of ['styles', 'settings', 'fontTable'] as const) links.to(kind, `${kind}.xml`)
  const firstPage = document.firstPageHeader !== undefined
  const reference = (kind: 'header' | 'footer', type: 'default' | 'first', target: string | undefined): SectionNode['references'] =>
    target === undefined ? [] : [{ kind, type, id: links.to(kind, target) }]
  const references = [
    ...reference('header', 'default', header),
    ...reference('header', 'first', first),
    ...reference('footer', 'default', footer),
    ...(firstPage ? reference('footer', 'first', footer) : []),
  ]
  /**
   * The report's section: the paper, turned where the document's is, its
   * margins, and the header's and the footer's distance from the paper's
   * edge the top and bottom margins, so that both stand inside the
   * printable area with the body between them, as the document says; Word
   * moves the body down past a header taller than nothing. Page 1's own
   * header (0060) is `w:titlePg` and a header of the first page's own --
   * none where the document's list is empty, which ECMA-376 has Word
   * print as a blank one (Part 1, 17.10.5) -- with the page footer
   * referenced for the first page and for the rest.
   */
  const report: SectionNode = {
    paperWidth: page.paperWidth,
    paperHeight: page.paperHeight,
    landscape: document.page.orientation === 'landscape',
    margins: page.margins,
    header: page.margins.top,
    footer: page.margins.bottom,
    references,
    firstPage,
  }
  const body = closed(nodesOf(document.body, building(links), page.width))
  const { slip } = checked
  let last = report
  if (slip !== undefined) {
    // The report's section is ended by a paragraph of its own, an empty line a point tall, whatever the body ends with.
    body.push({ ...emptyLine(SEPARATOR), section: report })
    /** An empty header or footer of the slip's page, where the report prints one that the page would otherwise print too. */
    const none = (kind: 'header' | 'footer', printed: string | undefined, name: string): SectionNode['references'] => {
      if (printed === undefined) return []
      files.push([`word/${name}`, part(element(kind === 'header' ? 'w:hdr' : 'w:ftr', NAMESPACES, [write.blocks([emptyLine(SEPARATOR)])]))])
      overrides.push([`word/${name}`, `${MAIN}.${kind}+xml`])
      return reference(kind, 'default', name)
    }
    last = { ...slipPage(), references: [...none('header', header, 'header3.xml'), ...none('footer', footer, 'footer2.xml')] }
    drawn.pictures += 1
    const picture = { id: drawn.pictures, width: SWISS_CODE_SIZE, height: SWISS_CODE_SIZE, embed: links.to('image', pictures.swiss(slip.symbol)) }
    body.push(...slipNodes(slip, picture))
  }
  const main = element('w:document', NAMESPACES, [element('w:body', [], [write.blocks(body), sectionProperties(last)])])
  const kinds = new Set([...pictures.parts.values()].map(({ kind }) => kind))
  const parts: Zippable = {}
  const add = (name: string, content: string): void => void (parts[name] = strToU8(content))
  add(
    '[Content_Types].xml',
    contentTypes(
      [
        ['word/document.xml', `${MAIN}.document.main+xml`],
        ['word/styles.xml', `${MAIN}.styles+xml`],
        ['word/settings.xml', `${MAIN}.settings+xml`],
        ['word/fontTable.xml', `${MAIN}.fontTable+xml`],
        ...overrides,
        ['docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml'],
      ],
      kinds,
    ),
  )
  add(
    '_rels/.rels',
    relationshipsPart([
      [own(`${RELATIONSHIPS}/officeDocument`), 'word/document.xml'],
      [own('http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties'), 'docProps/core.xml'],
    ]),
  )
  add('docProps/core.xml', core(document.info.title, checked.created))
  add('word/document.xml', part(main))
  add('word/_rels/document.xml.rels', links.part()!)
  add('word/styles.xml', styles(fonts))
  add('word/settings.xml', settings())
  // The family an EPC QR code's caption and a slip are named in is the one a file names that no report maps (`codes.ts`, `slip-widths.ts`): listed
  // where one is written, with the face of its widths as its other name.
  const named = new Set([...([...checked.codes.keys()].some(captioned) ? [CAPTION_FAMILY] : []), ...(slip === undefined ? [] : [SLIP_FAMILY])])
  const more = [...named].filter((family) => !fonts.table.some((entry) => entry.name === family))
  add('word/fontTable.xml', fontTable([...fonts.table, ...more.map((name): FontEntry => ({ name, kind: 'swiss', other: SLIP_OTHER_FAMILY }))]))
  for (const [name, content] of files) add(name, content)
  // A PNG and a JPEG are compressed already, and are stored as they are; an SVG is text, and is deflated.
  for (const [name, { bytes, kind }] of pictures.parts) parts[`word/${name}`] = kind === 'svg' ? bytes : [bytes, { level: 0 }]
  return zipSync(parts, { mtime: zipEpoch() })
}

/** A list of nodes that ends a part or a cell: after a table stands one empty paragraph a point tall. */
function closed(nodes: readonly BlockNode[]): BlockNode[] {
  return nodes.at(-1)?.kind === 'table' ? [...nodes, emptyLine(SEPARATOR)] : [...nodes]
}
