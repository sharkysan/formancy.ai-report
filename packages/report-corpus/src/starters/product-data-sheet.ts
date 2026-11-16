import type { ReportData, ReportDefinition } from '@formancy/report-runtime'
import { sender } from './invoice.js'
import { GERMAN } from './invoice-words.js'
import { LETTERHEAD, LOGO_ASSET } from './logo.js'
import { ENGLISH_SHEET, FRENCH_SHEET, GERMAN_SHEET, ITALIAN_SHEET, UNITS } from './product-data-sheet-words.js'
import type { SheetWords } from './product-data-sheet-words.js'
import type { Starter } from './starter.js'

/**
 * The product data sheet (0064): the firm's technical sheet for a board it
 * sells, under its letterhead (0032), on one A4 page. It proves values set
 * with runs below and above the line (0061) -- the cube of kg/m³, the
 * squares of m² and of W/(m²·K), CO₂'s index and two footnotes' marks,
 * each a run of its own and never one of Unicode's super- or subscript
 * digits -- and one report written in Swiss German with its words in
 * French, Italian and English (0063), each printing whole, the values
 * formatted as each locale writes them.
 *
 * Each value stands beside its label in a row of two columns. The U-value
 * is no value of the data's: it is the report's own, 1/R rounded to the
 * hundredth, an expression that prints a number and so no word in any
 * language. The data holds numbers, the date the sheet was issued, and the
 * product's name, its article number and its fire class: names and codes,
 * which print as the host hands them over in every language (0063).
 *
 * `product-data-sheet-words.ts` holds the words of each language; this
 * file the one sheet they are put into, so that the four differ in nothing
 * but what they say, and the translations are those words, keyed by the
 * German.
 */

const header = (field: string) => ({ dataset: 'header', field }) as const
const text = (value: string) => ({ kind: 'text', text: value }) as const
const raised = (value: string) => ({ kind: 'text', text: value, baseline: 'superscript' }) as const
const lowered = (value: string) => ({ kind: 'text', text: value, baseline: 'subscript' }) as const
const number = (scale: number) => ({ kind: 'number', scale, grouping: false }) as const

type Component = ReportDefinition['regions']['body'][number]
type Run = Extract<Component, { kind: 'text' }>['content'][number]

/** A row of the sheet: its label beside its value, the label's column as wide on every row so that the values line up. */
function row(id: string, label: readonly Run[], value: readonly Run[]): Component {
  return {
    id: `${id}-row`,
    kind: 'columns',
    columns: [
      { width: 230, components: [{ id: `${id}-label`, kind: 'text', content: label }] },
      { width: 'fill', components: [{ id, kind: 'text', content: value }] },
    ],
  }
}

/** The sheet written in `words`' language alone, with no translations. */
function sheet(words: SheetWords): ReportDefinition {
  return {
    reportSpecVersion: '0',
    id: 'product-data-sheet',
    title: words.title,
    locale: words.locale,
    page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
    styles: [
      { id: 'sender', size: 8, color: '#555555' },
      { id: 'title', size: 16, bold: true },
      { id: 'product', size: 13, bold: true, color: '#1f4e79' },
      { id: 'heading', size: 11, bold: true },
      { id: 'note', size: 8, color: '#555555' },
      { id: 'footer', size: 8, color: '#555555', align: 'center' },
    ],
    datasets: {
      header: {
        id: 'product',
        fields: [
          { id: 'product', type: 'string', label: 'Produkt', nullable: false },
          { id: 'article', type: 'string', label: 'Artikelnummer', nullable: false },
          { id: 'thickness', type: 'integer', label: 'Dicke in mm', nullable: false },
          { id: 'density', type: 'integer', label: 'Rohdichte in kg/m3', nullable: false },
          { id: 'conductivity', type: 'decimal', label: 'Wärmeleitfähigkeit', nullable: false, scale: 3 },
          { id: 'resistance', type: 'decimal', label: 'Wärmedurchlasswiderstand', nullable: false, scale: 2 },
          { id: 'compressive', type: 'integer', label: 'Druckspannung in kPa', nullable: false },
          { id: 'fireClass', type: 'string', label: 'Brandverhaltensklasse', nullable: false },
          { id: 'warming', type: 'decimal', label: 'Treibhauspotenzial', nullable: false, scale: 1 },
          { id: 'issuedOn', type: 'date', label: 'Stand', nullable: false },
        ],
      },
    },
    parameters: [],
    assets: [LOGO_ASSET],
    aggregates: [],
    regions: {
      pageHeader: [],
      reportHeader: [
        ...LETTERHEAD,
        { id: 'sender', kind: 'text', style: 'sender', content: [text(sender(GERMAN.creditor, words.vatNumber))] },
        { id: 'sender-gap', kind: 'spacer', height: 18 },
        { id: 'title', kind: 'text', style: 'title', content: [text(words.title)] },
        { id: 'product', kind: 'text', style: 'product', content: [{ kind: 'field', field: header('product') }] },
        { id: 'article', kind: 'text', content: [text(words.article), { kind: 'field', field: header('article') }] },
        { id: 'article-gap', kind: 'spacer', height: 8 },
        { id: 'description', kind: 'text', content: [text(words.description)] },
        { id: 'head-gap', kind: 'spacer', height: 18 },
      ],
      body: [
        { id: 'technical', kind: 'text', style: 'heading', content: [text(words.technical)], keepWithNext: true },
        row('thickness', [text(words.thickness)], [{ kind: 'field', field: header('thickness'), format: number(0) }, text(UNITS.millimetres)]),
        row('density', [text(words.density)], [{ kind: 'field', field: header('density'), format: number(0) }, text(UNITS.perCubicMetre), raised('3')]),
        row('conductivity', [text(words.conductivity)], [{ kind: 'field', field: header('conductivity'), format: number(3) }, text(UNITS.conductivity)]),
        row(
          'resistance',
          [text(words.resistance)],
          [{ kind: 'field', field: header('resistance'), format: number(2) }, text(UNITS.resistance[0]), raised('2'), text(UNITS.resistance[1])],
        ),
        row(
          'transmittance',
          [text(words.transmittance), raised('1')],
          [
            { kind: 'expression', expression: { cel: 'divide(dec("1"), header.resistance, 2)' }, format: number(2) },
            text(UNITS.transmittance[0]),
            raised('2'),
            text(UNITS.transmittance[1]),
          ],
        ),
        row('compressive', [text(words.compressive)], [{ kind: 'field', field: header('compressive'), format: number(0) }, text(UNITS.kilopascals)]),
        row('fire', [text(words.fire)], [{ kind: 'field', field: header('fireClass') }]),
        { id: 'environment-gap', kind: 'spacer', height: 12 },
        { id: 'environment', kind: 'text', style: 'heading', content: [text(words.environment)], keepWithNext: true },
        row(
          'warming',
          [text(words.warming), raised('2')],
          [{ kind: 'field', field: header('warming'), format: number(1) }, text(words.carbon[0]), lowered('2'), text(words.carbon[1]), raised('2')],
        ),
        { id: 'notes-gap', kind: 'spacer', height: 18 },
        { id: 'note-1', kind: 'text', style: 'note', content: [raised('1'), text(words.notes[0])] },
        { id: 'note-2', kind: 'text', style: 'note', content: [raised('2'), text(words.notes[1])] },
      ],
      summary: [],
      pageFooter: [
        {
          id: 'issued',
          kind: 'text',
          style: 'footer',
          content: [text(words.issued[0]), { kind: 'field', field: header('issuedOn'), format: { kind: 'date', style: 'long' } }, text(words.issued[1])],
        },
      ],
    },
    provenance: { kind: 'blank' },
  }
}

/** The editions the sheet is written in, its own language first. */
export const SHEET_EDITIONS: readonly SheetWords[] = [GERMAN_SHEET, FRENCH_SHEET, ITALIAN_SHEET, ENGLISH_SHEET]

/** Every word the sheet prints in `words`' language, in the order the report holds them: the same places in every language, the units among them. */
const wordsOf = (words: SheetWords): readonly string[] => [
  words.title,
  sender(GERMAN.creditor, words.vatNumber),
  words.article,
  words.description,
  words.technical,
  words.thickness,
  UNITS.millimetres,
  words.density,
  UNITS.perCubicMetre,
  words.conductivity,
  UNITS.conductivity,
  words.resistance,
  ...UNITS.resistance,
  words.transmittance,
  ...UNITS.transmittance,
  words.compressive,
  UNITS.kilopascals,
  words.fire,
  words.environment,
  words.warming,
  ...words.carbon,
  ...words.notes,
  ...words.issued,
]

type Translation = NonNullable<ReportDefinition['translations']>[number]

/**
 * The sheet's German words written in `words`' language: each German word
 * once, as a translation keys it (0063). A word that stands in two places
 * -- the title is the heading too -- is one word, and is refused here if
 * two places would need two translations of it.
 */
function translation(words: SheetWords): Translation {
  const own = wordsOf(GERMAN_SHEET)
  const translated = new Map<string, string>()
  wordsOf(words).forEach((text, index) => {
    const word = own[index] as string
    const known = translated.get(word)
    if (known !== undefined && known !== text) throw new Error(`the sheet's ${JSON.stringify(word)} stands where ${words.locale} writes it two ways`)
    translated.set(word, text)
  })
  return { locale: words.locale, words: [...translated].map(([word, text]) => ({ word, text })), expressions: [] }
}

/** The sheet written in `words`' language alone, with no translations: what a render of the starter in that locale prints. */
export const productDataSheetAlone = (words: SheetWords): ReportDefinition => sheet(words)

/** The sheet's data: an invented board, 30 mm thick, and the day its sheet was issued. */
export function productDataSheetData(): ReportData {
  return {
    header: {
      product: 'ThermoPlan FB 30',
      article: 'TP-FB30-1200',
      thickness: '30',
      density: '30',
      conductivity: '0.033',
      resistance: '0.90',
      compressive: '150',
      fireClass: 'E',
      warming: '2.9',
      issuedOn: '2026-11-02',
    },
    completeness: { complete: true, captured: 0 },
    consistency: 'host-captured',
  }
}

export const PRODUCT_DATA_SHEET: Starter = {
  id: 'product-data-sheet',
  title: 'Produktdatenblatt',
  proves:
    'values set below and above the line -- a unit’s power, an index and a footnote’s mark -- and one report written in German, French, Italian and English, each printing whole',
  report: { ...sheet(GERMAN_SHEET), translations: [FRENCH_SHEET, ITALIAN_SHEET, ENGLISH_SHEET].map(translation) },
  data: productDataSheetData(),
  parameters: {},
}
