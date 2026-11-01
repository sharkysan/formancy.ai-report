/**
 * What the palette offers: each kind the format has, with the component
 * inserting it puts in, or why the report cannot hold one yet.
 *
 * A default is chosen to be valid somewhere in any report that has what it
 * needs: an id `nextComponentId` gives, a size that fits the smallest
 * printable area the format allows, and the report's own asset or field for
 * what has to draw or read one -- the newest image, so that the one a person
 * just added is the one Insert's Image draws (0033). Whether it is valid in
 * a given place is the validator's question, asked by the drop targets. What a default says --
 * a new text's words -- is in the report's language, because it prints; the
 * palette's own labels are in the editor's.
 */
import { nextComponentId } from '@formancy/report-core'
import { CHART_CATEGORY_TYPES, COMPONENT_KINDS, mmToPt, printableArea, squareRoom } from '@formancy/report-spec'
import type { Alignment, Component, ComponentKind, FieldType, ImageSource, ReportDefinition } from '@formancy/report-spec'
import { kindLabel } from './labels.js'
import type { PaletteEntry } from './model.js'
import { contentLocale, editorText } from './text.js'
import type { EditorText, MessageId } from './text.js'

/** A new image's or rectangle's box, in points, when the printable area has room for it. */
const BOX = { image: { width: 100, height: 50 }, rectangle: { width: 100, height: 40 }, chart: { width: 300, height: 180 } } as const
/** A new QR code's side, its quiet zone included, in points, when the printable area has room for it both ways: 30 mm. */
const QR_SIDE = mmToPt(30)
/**
 * A new EPC payment code's, likewise: 32 mm, the least whole millimetre in
 * which every payload the EPC allows prints, up to version 13's 331 bytes,
 * with Austria's frame and without -- in 30 mm the longest are refused, by
 * the length of the data alone (0025).
 */
const EPC_SIDE = mmToPt(32)
/**
 * What a new EPC payment code pays to until the author says: the IBAN of
 * bank code 00000000, which no bank keeps -- every bank code in the
 * Bundesbank's Bankleitzahlendatei starts with a digit from 1 to 8 -- so a
 * code inserted and never edited pays nobody. Its check digits are right
 * (ISO 13616), or the insert would be refused; and it is the same in every
 * language, so no editor changes whom a new code pays. An e-invoice's
 * payment instructions added from nothing pay it too (0044); in a report
 * with an e-invoice, a new code pays the e-invoice's account instead
 * (`paymentAccount`).
 */
export const NO_ACCOUNT = 'DE36 0000 0000 0000 0000 00'
/**
 * The kinds the format has that the palette does not offer yet. A chart,
 * until the builders edit a chart's own properties and a render draws one:
 * inserted now, it would be a box whose kind, category and series no
 * builder edits, in a report the runtime refuses to render (0051). An
 * insert or a drag of one is refused as of a kind the palette does not
 * have. Its default stands below, held to the validator, for the builders
 * that offer it; the list goes with them.
 */
const NOT_OFFERED: readonly ComponentKind[] = ['chart']
/** A new rule's thickness, in points: a hairline that prints. */
const RULE = 0.5
/** A new spacer's height, in points: about a line of body text. */
const GAP = 12

/** What a column of a new table aligns to, by the type of the field it shows: numbers to the right. */
const ALIGN: { readonly [T in FieldType]: Alignment } = {
  string: 'left',
  integer: 'right',
  decimal: 'right',
  boolean: 'center',
  date: 'left',
  datetime: 'left',
  instant: 'left',
  image: 'left',
}

/** The kind's default component, without its id and kind, or the message saying what the report lacks. */
type Body = Readonly<Record<string, unknown>> | MessageId

/**
 * What a new EPC payment code pays: in a report with an e-invoice, the
 * account the validator holds every payment code printed with it to
 * (BT-84), as written -- its binding where the data gives it -- with its
 * bank's BIC (BT-86) where it names one, which an account outside the EEA
 * needs; without payment instructions there is none, and the message says
 * what to add first (0044). Elsewhere, the account that pays nobody.
 */
function paymentAccount(report: ReportDefinition): Body {
  const invoice = report.eInvoice
  if (invoice === undefined) return { iban: [{ kind: 'text', text: NO_ACCOUNT }] }
  if (invoice.payment === undefined) return 'palette.needsPayment'
  return { iban: invoice.payment.iban, ...(invoice.payment.bic === undefined ? {} : { bic: invoice.payment.bic }) }
}

/** The report's newest asset -- an add appends -- else the header's image field. */
function imageSource(report: ReportDefinition): ImageSource | undefined {
  const asset = report.assets.at(-1)
  if (asset !== undefined) return { kind: 'asset', asset: asset.id }
  const field = report.datasets.header?.fields.find((candidate) => candidate.type === 'image')
  return field === undefined ? undefined : { kind: 'field', field: { dataset: 'header', field: field.id } }
}

/**
 * What each kind starts with, its words in `words`; `stored` says whether
 * the host keeps images a person adds, which is how an image with nothing
 * to draw gets one. A table over every kind, so a kind added to the format
 * without a default does not compile.
 */
const DEFAULTS: { readonly [K in ComponentKind]: (report: ReportDefinition, words: EditorText, stored: boolean) => Body } = {
  text: (_report, words) => ({ content: [{ kind: 'text', text: words('default.text') }] }),
  image: (report, _words, stored) => {
    const source = imageSource(report)
    if (source === undefined) return stored ? 'palette.addImageFirst' : 'palette.needsImage'
    const room = printableArea(report.page)
    return { source, width: Math.min(BOX.image.width, room.width), height: Math.min(BOX.image.height, room.height), fit: 'contain' }
  },
  qrCode: (report, words) => ({
    content: [{ kind: 'text', text: words('default.qrCode') }],
    size: Math.min(QR_SIDE, squareRoom(printableArea(report.page)).length),
    errorCorrection: 'M',
  }),
  // No amount, which the payer fills in, and no frame, which is Austria's to ask for.
  epcQrCode: (report, words) => {
    const account = paymentAccount(report)
    if (typeof account === 'string') return account
    return {
      size: Math.min(EPC_SIDE, squareRoom(printableArea(report.page)).length),
      beneficiary: [{ kind: 'text', text: words('default.epcBeneficiary') }],
      ...account,
    }
  },
  line: () => ({ thickness: RULE }),
  rectangle: (report) => {
    const room = printableArea(report.page)
    return { width: Math.min(BOX.rectangle.width, room.width), height: Math.min(BOX.rectangle.height, room.height) }
  },
  spacer: () => ({ height: GAP }),
  columns: () => ({
    columns: [
      { width: 'fill', components: [] },
      { width: 'fill', components: [] },
    ],
  }),
  section: () => ({ components: [] }),
  table: (report, words) => {
    const field = report.datasets.detail?.fields.find((candidate) => candidate.type !== 'image')
    if (field === undefined) return 'palette.needsDetail'
    const column = {
      id: 'column-1',
      header: field.label,
      width: 'fill',
      align: ALIGN[field.type],
      value: { kind: 'field', field: { dataset: 'detail', field: field.id } },
    }
    return { dataset: 'detail', columns: [column], emptyText: words('default.emptyText'), repeatHeader: true }
  },
  /*
   * A bar chart of the detail rows, by the first field that can name a
   * category: its rows without one labelled whether or not the field may be
   * null, so that a form version that removes the field can be reviewed
   * into printing nothing of it, which declares it nullable (0048). Its
   * series the first other number summed, named as the field is or, where
   * that is blank, after its function; with no number, the rows counted.
   */
  chart: (report, words) => {
    const fields = report.datasets.detail?.fields ?? []
    const category = fields.find((candidate) => CHART_CATEGORY_TYPES.includes(candidate.type))
    if (category === undefined) return 'palette.needsChartData'
    const number = fields.find((candidate) => candidate !== category && (candidate.type === 'integer' || candidate.type === 'decimal'))
    const room = printableArea(report.page)
    const series =
      number === undefined
        ? { id: 'series-1', label: words('default.chartCount'), fn: 'count' }
        : {
            id: 'series-1',
            label: number.label.trim() === '' ? words('default.chartSum') : number.label,
            fn: 'sum',
            of: { dataset: 'detail', field: number.id },
          }
    return {
      chart: 'bar',
      dataset: 'detail',
      width: Math.min(BOX.chart.width, room.width),
      height: Math.min(BOX.chart.height, room.height),
      category: { field: { dataset: 'detail', field: category.id }, order: 'data', nullLabel: words('default.chartNoCategory') },
      series: [series],
      valueFormat: { kind: 'number', scale: number?.scale ?? 0, grouping: true },
      emptyText: words('default.chartEmpty'),
    }
  },
  pageBreak: () => ({}),
  keepTogether: () => ({ components: [] }),
}

/** The default component of `kind` for `report`, or the message saying what the report must declare -- or a person add -- first. */
export function defaultComponent(report: ReportDefinition, kind: ComponentKind, stored = false): Component | MessageId {
  const body = DEFAULTS[kind](report, editorText(contentLocale(report.locale)), stored)
  if (typeof body === 'string') return body
  return { id: nextComponentId(report, kind), kind, ...body } as Component
}

export function paletteEntries(report: ReportDefinition, t: EditorText, stored = false): PaletteEntry[] {
  return COMPONENT_KINDS.filter((kind) => !NOT_OFFERED.includes(kind)).map((kind) => {
    const component = defaultComponent(report, kind, stored)
    const label = kindLabel(kind, t)
    return typeof component === 'string' ? { kind, label, component: null, unavailable: t(component, { add: t('images.add') }) } : { kind, label, component }
  })
}
