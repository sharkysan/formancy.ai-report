import {
  LINE_ENDING,
  type BlockNode,
  type CellNode,
  type Line,
  type ParagraphNode,
  type PictureNode,
  type RowNode,
  type RunNode,
  type RunStyle,
  type TableNode,
} from './nodes.js'
import { cropUnits, eighths, emu, halfPoints, twips } from './units.js'
import { attribute, element, hexColor, joined, own, text, type AttributeValue, type Name, type Xml } from './xml.js'

/**
 * The file's paragraphs and tables as WordprocessingML (0068): every
 * element's children in the order ECMA-376 Part 1 gives them, which Word
 * holds a file to -- transcribed from ISO/IEC 29500-4:2016's transitional
 * schemas for the elements below and no others, and transcribed once
 * more in the corpus's reader, which reads nothing out of that order
 * (`vocabulary.ts` there).
 *
 * Every run states what it prints in -- family, weight, slant, colour,
 * size -- since the file has no style to inherit one from, and every
 * paragraph's mark its family and size, which Word sizes the paragraph's
 * last line and an empty paragraph by. Every `w:t` says
 * `xml:space="preserve"`: Word strips the spaces at either end of one
 * that does not, and a run that ends in a space is the commonest a
 * report has.
 */

export const NAMESPACES: readonly (readonly [Name, AttributeValue])[] = [
  ['xmlns:w', own('http://schemas.openxmlformats.org/wordprocessingml/2006/main')],
  ['xmlns:r', own('http://schemas.openxmlformats.org/officeDocument/2006/relationships')],
  ['xmlns:wp', own('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing')],
  ['xmlns:a', own('http://schemas.openxmlformats.org/drawingml/2006/main')],
  ['xmlns:pic', own('http://schemas.openxmlformats.org/drawingml/2006/picture')],
]

const PICTURE = own('http://schemas.openxmlformats.org/drawingml/2006/picture')
const SVG = own('http://schemas.microsoft.com/office/drawing/2016/SVG/main')
/** The extension an SVG is embedded under, as Microsoft's Open XML SDK names it. */
const SVG_EXTENSION = own('{96DAC541-7B7A-43D3-8B79-37D633B846F1}')

const PRESERVE: readonly [Name, AttributeValue] = ['xml:space', own('preserve')]
const DXA: readonly [Name, AttributeValue] = ['w:type', own('dxa')]

/** An element whose one attribute is `w:val`. */
const valued = (name: Name, value: AttributeValue): Xml => element(name, [['w:val', value]])

/** The properties of a run that prints nothing and of the mark of a paragraph that holds no text: a point, so that it fits whatever line it stands in. */
const TINY = element('w:rPr', [], [valued('w:sz', 2), valued('w:szCs', 2)])

/** A family in all four of a run's font slots: Latin, high ANSI, East Asian and complex script alike, so that no character of the run is drawn in another. */
export function fontSlots(family: string): Xml {
  const name = attribute(family)
  return element('w:rFonts', [
    ['w:ascii', name],
    ['w:hAnsi', name],
    ['w:eastAsia', name],
    ['w:cs', name],
  ])
}

/** What writes the nodes of one file: a run's properties are written once for each style and kept, since a table's cells share theirs. */
export interface Writer {
  readonly blocks: (nodes: readonly BlockNode[]) => Xml
}

export function writer(): Writer {
  const kept = new Map<string, Xml>()
  /** A run's properties, in `CT_RPr`'s order: fonts, bold, italic, colour, size, and how it is set against the line. */
  const properties = (style: RunStyle): Xml => {
    const key = `${style.family}\u0000${style.size}\u0000${style.bold}\u0000${style.italic}\u0000${style.color}\u0000${style.shift ?? ''}`
    const known = kept.get(key)
    if (known !== undefined) return known
    const size = halfPoints(style.size)
    const made = element(
      'w:rPr',
      [],
      [
        fontSlots(style.family),
        ...(style.bold ? [element('w:b')] : []),
        ...(style.italic ? [element('w:i')] : []),
        valued('w:color', hexColor(style.color)),
        valued('w:sz', size),
        valued('w:szCs', size),
        ...(style.shift === undefined ? [] : [valued('w:vertAlign', own(style.shift))]),
      ],
    )
    kept.set(key, made)
    return made
  }
  const marks = new Map<string, Xml>()
  const mark = (node: ParagraphNode['mark']): Xml => {
    if (node === undefined) return TINY
    const key = `${node.family}\u0000${node.size}`
    const known = marks.get(key)
    if (known !== undefined) return known
    const size = halfPoints(node.size)
    const made = element('w:rPr', [], [fontSlots(node.family), valued('w:sz', size), valued('w:szCs', size)])
    marks.set(key, made)
    return made
  }

  const run = (node: RunNode): Xml => {
    if (node.kind === 'picture') return element('w:r', [], [TINY, drawing(node.picture)])
    const set = properties(node.style)
    if (node.kind === 'field') {
      // A field as its beginning, its instruction and its end, with no result: the writer knows no page, and writes no number it does not know.
      const char = (type: 'begin' | 'end'): Xml => element('w:r', [], [set, element('w:fldChar', [['w:fldCharType', own(type)]])])
      return joined([char('begin'), element('w:r', [], [set, element('w:instrText', [PRESERVE], [own(` ${node.field} `)])]), char('end')])
    }
    // A line feed, a carriage return, or the two together end a line, as in the PDF: each is a break. The one that ends a paragraph's text is
    // none, and is not in a run's text by now (`nodes.ts`).
    const pieces = node.text
      .split(LINE_ENDING)
      .flatMap((line, index): Xml[] => [...(index === 0 ? [] : [element('w:br')]), ...(line === '' ? [] : [element('w:t', [PRESERVE], [text(line)])])])
    return element('w:r', [], [set, ...pieces])
  }

  const paragraph = (node: ParagraphNode): Xml => {
    const spacing: (readonly [Name, AttributeValue])[] = [
      ...(node.before === undefined || twips(node.before) === 0 ? [] : [['w:before', twips(node.before)] as const]),
      ...(node.after === undefined || twips(node.after) === 0 ? [] : [['w:after', twips(node.after)] as const]),
      ...(node.line === undefined ? [] : [['w:line', twips(node.line)] as const, ['w:lineRule', own('exact')] as const]),
    ]
    // In `CT_PPr`'s order.
    const set = element(
      'w:pPr',
      [],
      [
        ...(node.keepNext ? [element('w:keepNext')] : []),
        ...(node.keepLines ? [element('w:keepLines')] : []),
        ...(node.pageBreakBefore === true ? [element('w:pageBreakBefore')] : []),
        // Between two paragraphs of the same borders Word draws the line between them alone (ECMA-376 Part 1, 17.3.1.7): a rule states both, or two equal rules would print one.
        ...(node.rule === undefined ? [] : [element('w:pBdr', [], [line('w:bottom', node.rule), line('w:between', node.rule)])]),
        ...(spacing.length === 0 ? [] : [element('w:spacing', spacing)]),
        ...(node.indent === undefined || twips(node.indent) === 0 ? [] : [element('w:ind', [['w:left', twips(node.indent)]])]),
        ...(node.align === undefined ? [] : [valued('w:jc', own(node.align))]),
        mark(node.mark),
      ],
    )
    return element('w:p', [], [set, ...node.runs.map(run)])
  }

  const cell = (node: CellNode): Xml => {
    const borders = node.borders
    // In `CT_TcPr`'s order, and a cell's borders in theirs.
    const set = element(
      'w:tcPr',
      [],
      [
        element('w:tcW', [['w:w', node.width], DXA]),
        ...(node.span === undefined ? [] : [valued('w:gridSpan', node.span)]),
        ...(borders === undefined
          ? []
          : [
              element(
                'w:tcBorders',
                [],
                (['top', 'left', 'bottom', 'right'] as const).flatMap((side) => (borders[side] === undefined ? [] : [line(`w:${side}`, borders[side])])),
              ),
            ]),
        ...(node.shade === undefined
          ? []
          : [
              element('w:shd', [
                ['w:val', own('clear')],
                ['w:color', own('auto')],
                ['w:fill', hexColor(node.shade)],
              ]),
            ]),
        ...(node.direction === undefined ? [] : [valued('w:textDirection', own(node.direction))]),
      ],
    )
    return element('w:tc', [], [set, blocks(node.content)])
  }

  const row = (node: RowNode): Xml => {
    // In the order `CT_TrPr` lists them.
    const set = [
      ...(node.cantSplit ? [element('w:cantSplit')] : []),
      ...(node.height === undefined
        ? []
        : [
            element('w:trHeight', [
              ['w:val', twips(node.height)],
              ['w:hRule', own(node.atLeast === true ? 'atLeast' : 'exact')],
            ]),
          ]),
      ...(node.header === true ? [element('w:tblHeader')] : []),
    ]
    return element('w:tr', [], [...(set.length === 0 ? [] : [element('w:trPr', [], set)]), ...node.cells.map(cell)])
  }

  const table = (node: TableNode): Xml => {
    const { rules, padding } = node
    const margin = (side: Name, points: number): Xml => element(side, [['w:w', twips(points)], DXA])
    // In `CT_TblPr`'s order; a fixed layout, so that the grid is the widths and Word fits nothing to the words.
    const set = element(
      'w:tblPr',
      [],
      [
        element('w:tblW', [['w:w', node.grid.reduce((sum, each) => sum + each, 0)], DXA]),
        ...(rules === undefined ? [] : [element('w:tblBorders', [], [line('w:top', rules), line('w:bottom', rules), line('w:insideH', rules)])]),
        element('w:tblLayout', [['w:type', own('fixed')]]),
        element('w:tblCellMar', [], [margin('w:top', padding.y), margin('w:left', padding.x), margin('w:bottom', padding.y), margin('w:right', padding.x)]),
      ],
    )
    const grid = element(
      'w:tblGrid',
      [],
      node.grid.map((each) => element('w:gridCol', [['w:w', each]])),
    )
    return element('w:tbl', [], [set, grid, ...node.rows.map(row)])
  }

  const blocks = (nodes: readonly BlockNode[]): Xml => joined(nodes.map((node) => (node.kind === 'paragraph' ? paragraph(node) : table(node))))
  return { blocks }
}

/** A single line of a border, at no distance from what it borders. */
function line(side: Name, { weight, color }: Line): Xml {
  return element(side, [
    ['w:val', own('single')],
    ['w:sz', eighths(weight)],
    ['w:space', 0],
    ['w:color', hexColor(color)],
  ])
}

/**
 * An inline picture, stretched to its extent: the part it embeds, an
 * SVG's beside the picture a reader that draws none shows, and what is
 * cut from its sides. Its name is the writer's own, its number among the
 * file's pictures.
 */
function drawing(picture: PictureNode): Xml {
  const [cx, cy] = [emu(picture.width), emu(picture.height)]
  const named: readonly (readonly [Name, AttributeValue])[] = [
    ['id', picture.id],
    ['name', own(`Picture ${picture.id}`)],
  ]
  const svg =
    picture.svg === undefined
      ? []
      : [
          element(
            'a:extLst',
            [],
            [
              element(
                'a:ext',
                [['uri', SVG_EXTENSION]],
                [
                  element('asvg:svgBlip', [
                    ['xmlns:asvg', SVG],
                    ['r:embed', own(picture.svg)],
                  ]),
                ],
              ),
            ],
          ),
        ]
  const crop = picture.crop
  const cut =
    crop === undefined
      ? []
      : [
          element('a:srcRect', [
            ['l', cropUnits(crop.across)],
            ['t', cropUnits(crop.down)],
            ['r', cropUnits(crop.across)],
            ['b', cropUnits(crop.down)],
          ]),
        ]
  const pic = element(
    'pic:pic',
    [],
    [
      element('pic:nvPicPr', [], [element('pic:cNvPr', named), element('pic:cNvPicPr')]),
      element('pic:blipFill', [], [element('a:blip', [['r:embed', own(picture.embed)]], svg), ...cut, element('a:stretch', [], [element('a:fillRect')])]),
      element(
        'pic:spPr',
        [],
        [
          element(
            'a:xfrm',
            [],
            [
              element('a:off', [
                ['x', 0],
                ['y', 0],
              ]),
              element('a:ext', [
                ['cx', cx],
                ['cy', cy],
              ]),
            ],
          ),
          element('a:prstGeom', [['prst', own('rect')]], [element('a:avLst')]),
        ],
      ),
    ],
  )
  const inline = element(
    'wp:inline',
    [
      ['distT', 0],
      ['distB', 0],
      ['distL', 0],
      ['distR', 0],
    ],
    [
      element('wp:extent', [
        ['cx', cx],
        ['cy', cy],
      ]),
      element('wp:docPr', named),
      element('a:graphic', [], [element('a:graphicData', [['uri', PICTURE]], [pic])]),
    ],
  )
  return element('w:drawing', [], [inline])
}
