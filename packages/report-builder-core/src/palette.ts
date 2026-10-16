/**
 * What the palette offers: each kind the format has, with the component
 * inserting it puts in, or why the report cannot hold one yet.
 *
 * A default is chosen to be valid somewhere in any report that has what it
 * needs: an id `nextComponentId` gives, a size that fits the smallest
 * printable area the format allows, and the report's own asset or field for
 * what has to draw or read one. Whether it is valid in a given place is the
 * validator's question, asked by the drop targets. What a default says --
 * a new text's words -- is in the report's language, because it prints; the
 * palette's own labels are in the editor's.
 */
import { nextComponentId } from '@formancy/report-core'
import { COMPONENT_KINDS, mmToPt, printableArea, squareRoom } from '@formancy/report-spec'
import type { Alignment, Component, ComponentKind, FieldType, ImageSource, ReportDefinition } from '@formancy/report-spec'
import { kindLabel } from './labels.js'
import type { PaletteEntry } from './model.js'
import { contentLocale, editorText } from './text.js'
import type { EditorText, MessageId } from './text.js'

/** A new image's or rectangle's box, in points, when the printable area has room for it. */
const BOX = { image: { width: 100, height: 50 }, rectangle: { width: 100, height: 40 } } as const
/** A new QR code's side, its quiet zone included, in points, when the printable area has room for it both ways: 30 mm. */
const QR_SIDE = mmToPt(30)
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

function imageSource(report: ReportDefinition): ImageSource | undefined {
  const asset = report.assets[0]
  if (asset !== undefined) return { kind: 'asset', asset: asset.id }
  const field = report.datasets.header?.fields.find((candidate) => candidate.type === 'image')
  return field === undefined ? undefined : { kind: 'field', field: { dataset: 'header', field: field.id } }
}

/** What each kind starts with, its words in `words`. A table over every kind, so a kind added to the format without a default does not compile. */
const DEFAULTS: { readonly [K in ComponentKind]: (report: ReportDefinition, words: EditorText) => Body } = {
  text: (_report, words) => ({ content: [{ kind: 'text', text: words('default.text') }] }),
  image: (report) => {
    const source = imageSource(report)
    if (source === undefined) return 'palette.needsImage'
    const room = printableArea(report.page)
    return { source, width: Math.min(BOX.image.width, room.width), height: Math.min(BOX.image.height, room.height), fit: 'contain' }
  },
  qrCode: (report, words) => ({ content: [{ kind: 'text', text: words('default.qrCode') }], size: Math.min(QR_SIDE, squareRoom(printableArea(report.page)).length), errorCorrection: 'M' }),
  line: () => ({ thickness: RULE }),
  rectangle: (report) => {
    const room = printableArea(report.page)
    return { width: Math.min(BOX.rectangle.width, room.width), height: Math.min(BOX.rectangle.height, room.height) }
  },
  spacer: () => ({ height: GAP }),
  columns: () => ({ columns: [{ width: 'fill', components: [] }, { width: 'fill', components: [] }] }),
  section: () => ({ components: [] }),
  table: (report, words) => {
    const field = report.datasets.detail?.fields.find((candidate) => candidate.type !== 'image')
    if (field === undefined) return 'palette.needsDetail'
    const column = { id: 'column-1', header: field.label, width: 'fill', align: ALIGN[field.type], value: { kind: 'field', field: { dataset: 'detail', field: field.id } } }
    return { dataset: 'detail', columns: [column], emptyText: words('default.emptyText'), repeatHeader: true }
  },
  pageBreak: () => ({}),
  keepTogether: () => ({ components: [] }),
}

/** The default component of `kind` for `report`, or the message saying what the report must declare first. */
export function defaultComponent(report: ReportDefinition, kind: ComponentKind): Component | MessageId {
  const body = DEFAULTS[kind](report, editorText(contentLocale(report.locale)))
  if (typeof body === 'string') return body
  return { id: nextComponentId(report, kind), kind, ...body } as Component
}

export function paletteEntries(report: ReportDefinition, t: EditorText): PaletteEntry[] {
  return COMPONENT_KINDS.map((kind) => {
    const component = defaultComponent(report, kind)
    const label = kindLabel(kind, t)
    return typeof component === 'string' ? { kind, label, component: null, unavailable: t(component) } : { kind, label, component }
  })
}
