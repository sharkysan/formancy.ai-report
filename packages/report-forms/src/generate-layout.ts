/**
 * The outline of a report generated from a form laid out in the format
 * (0045): the form's title over the body, a line of label and value for
 * each answer, a section for each group, the table under its repeater's
 * label, and the page's number and count in the footer. Nothing is
 * positioned: the body flows, and what the format prints of a value is the
 * runtime's to decide -- a date in the report's locale, a decimal to its
 * places.
 *
 * The page is A4, portrait unless the table has more columns than a
 * portrait page gives `MIN_COLUMN_WIDTH` each, and landscape up to as many
 * as a landscape page gives; a table of more is refused (`generate.ts`).
 *
 * Every id is the next of its kind -- `line-3`, `section-1` -- so the same
 * outline is laid out alike every time, and no id is made of a key the
 * format's syntax for ids would refuse. Every style declared is used, and
 * nothing printed is empty, so the editor warns of nothing in a draft.
 */
import { MAX_TABLE_COLUMNS, printableArea } from '@formancy/report-spec'
import type { Component, DatasetRole, Inline, Orientation, PageSettings, PrintStyle, Regions, TableColumn } from '@formancy/report-spec'
import type { Planned } from './generate-fields.js'
import type { Block } from './generate-walk.js'

/** A generated report's margins: 20 mm a side, as report-spec's empty report has them. */
export const MARGIN = 56.69

/** The page a generated report stands on, `orientation` as its table asks. */
export function pageOf(orientation: Orientation): PageSettings {
  return { size: 'A4', orientation, margins: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } }
}

/**
 * The narrowest a generated table's column is, in points, its padding
 * included. The renderer breaks no word in a cell and refuses one wider
 * than its column, the header's included (0011); inside its 4 pt of
 * padding a side, a column of 80 pt holds a heading word of 72 pt in the
 * header's Roboto Medium at 9 pt -- `Massnahmenplan`, 71.7 pt,
 * `Verantwortlich` 58.8 pt -- and not `Zusammenfassung`, 77.8 pt.
 * Measured with fontkit from the renderer's font file, and held on the
 * PDF at the most columns each orientation gives and one more
 * (`generate-print.test.ts`), on 22 October 2026. The generator holds no
 * font, so a wider word, or an answer of one, is still the renderer's to
 * refuse.
 */
export const MIN_COLUMN_WIDTH = 80

/** The most columns a table of a generated report has standing `orientation`: as many as its page gives `MIN_COLUMN_WIDTH`, and no more than a table holds. */
export function columnsOn(orientation: Orientation): number {
  return Math.min(MAX_TABLE_COLUMNS, Math.floor(printableArea(pageOf(orientation)).width / MIN_COLUMN_WIDTH))
}

const STYLES = {
  title: { id: 'title', size: 16, bold: true },
  heading: { id: 'heading', size: 11, bold: true },
  footer: { id: 'footer', size: 8, align: 'center' },
} as const satisfies Readonly<Record<string, PrintStyle>>

/** What an empty table prints instead of rows: a dash, the same in every language. */
const EMPTY = '–'

/** The next id of each kind, in the order the layout asks for them. */
class Ids {
  readonly #next = new Map<string, number>()

  of(kind: string): string {
    const next = (this.#next.get(kind) ?? 0) + 1
    this.#next.set(kind, next)
    return `${kind}-${next}`
  }
}

const text = (value: string): Inline => ({ kind: 'text', text: value })

/** A label as its line starts: a colon after it, unless it ends in one or asks a question. */
const labelled = (label: string): string => (/[:?]$/.test(label) ? `${label} ` : `${label}: `)

/**
 * What prints `planned`'s value where `role`'s fields are read: a yes or a
 * no as a box, by an expression that reads the field by its id in brackets,
 * which any field key is in CEL, `in` and `true` among them; a date and an
 * instant in the report's locale; a decimal to its places.
 */
function valueOf(planned: Planned, role: DatasetRole): Inline {
  const { field, prints } = planned
  const ref = { dataset: role, field: field.id }
  if (prints === 'box') {
    const read = `${role === 'header' ? 'header' : 'row'}["${field.id}"]`
    return { kind: 'expression', expression: { cel: `${read} == true ? "[x]" : ${read} == false ? "[ ]" : ""` } }
  }
  if (prints === 'date') return { kind: 'field', field: ref, format: { kind: 'date', style: 'medium' } }
  if (prints === 'plain') return { kind: 'field', field: ref }
  return { kind: 'field', field: ref, format: { kind: 'number', scale: prints.scale, grouping: true } }
}

/** The components a body's blocks lay out as, and the table's columns where it has one. */
function componentsOf(blocks: readonly Block[], detail: readonly Planned[], ids: Ids): Component[] {
  const heading = (label: string): Component => ({ id: ids.of('heading'), kind: 'text', style: STYLES.heading.id, keepWithNext: true, content: [text(label)] })
  return blocks.flatMap((block): Component[] => {
    switch (block.kind) {
      case 'line':
        return [{ id: ids.of('line'), kind: 'text', content: [text(labelled(block.planned.line)), valueOf(block.planned, 'header')] }]
      case 'section': {
        if (block.flat) return [heading(block.heading), ...componentsOf(block.blocks, detail, ids)]
        const id = ids.of('section')
        return [{ id, kind: 'section', components: [heading(block.heading), ...componentsOf(block.blocks, detail, ids)] }]
      }
      case 'table': {
        const columns = detail.map(
          (planned, index): TableColumn => ({ id: `column-${index + 1}`, header: planned.field.label, width: 'fill', align: planned.field.type === 'integer' || planned.field.type === 'decimal' ? 'right' : 'left', value: valueOf(planned, 'detail') }),
        )
        return [...(block.heading === undefined ? [] : [heading(block.heading)]), { id: 'table', kind: 'table', dataset: 'detail', columns, emptyText: EMPTY, repeatHeader: true }]
      }
    }
  })
}

/** How many components `components` hold, those in sections included, as a region counts them. */
export function counted(components: readonly Component[]): number {
  return components.reduce((sum, component) => sum + 1 + (component.kind === 'section' ? counted(component.components) : 0), 0)
}

/** The regions and the styles of a report titled `title`, of `blocks` and the table's `detail`. */
export function laidOut(title: string, blocks: readonly Block[], detail: readonly Planned[]): { readonly regions: Regions; readonly styles: readonly PrintStyle[] } {
  const body = componentsOf(blocks, detail, new Ids())
  // A section is headed, flat or not, and holds every other section and any table in it.
  const headed = blocks.some((block) => block.kind === 'section' || (block.kind === 'table' && block.heading !== undefined))
  return {
    regions: {
      reportHeader: [{ id: 'title', kind: 'text', style: STYLES.title.id, content: [text(title)] }],
      pageHeader: [],
      body,
      pageFooter: [{ id: 'page-number', kind: 'text', style: STYLES.footer.id, content: [{ kind: 'pageNumber' }, text(' / '), { kind: 'pageCount' }] }],
      summary: [],
    },
    styles: [STYLES.title, ...(headed ? [STYLES.heading] : []), STYLES.footer],
  }
}
