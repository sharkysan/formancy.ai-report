/**
 * The report's own fields, shown while nothing is selected: its title, its
 * language, its page, and what page 1 prints at its top.
 *
 * Apart from `property-fields.ts`, whose fields are a component's, a
 * column's or a part's, because these change with the report's own level:
 * the page it prints on and the header page 1 prints, which is a region's
 * presence rather than a value (0060).
 */
import type { ReportDefinition } from '@formancy/report-spec'
import { choiceField, lengthField, textField } from './property-fields.js'
import type { FieldSpec } from './property-fields.js'
import type { EditorText, MessageId } from './text.js'

/** Where page 1's own header stands: what the choice of page 1's header puts in and takes away. */
export const FIRST_PAGE_HEADER = '/regions/firstPageHeader'

/**
 * What page 1 prints at its top: the page header, while the report has no
 * header of page 1's own, or that header, which prints none while it holds
 * nothing (0060). Its options name the region page 1 prints; choosing the
 * page header stores the region's absence, choosing its own an empty one.
 * The option shown, chosen again, is left alone: a header of its own put in
 * afresh would empty the one page 1 has.
 */
function firstPageField(report: ReportDefinition, t: EditorText): FieldSpec {
  const current = report.regions.firstPageHeader === undefined ? 'pageHeader' : 'firstPageHeader'
  const options = [
    { value: 'pageHeader', label: t('option.runningHeader'), stored: null },
    { value: 'firstPageHeader', label: t('option.ownHeader'), stored: [] },
  ]
  const choice = choiceField(FIRST_PAGE_HEADER, { id: 'field.firstPageHeader' }, 'select', options, current)
  return { ...choice, write: (input) => (input === current ? { ok: true, unchanged: true } : choice.write(input)) }
}

/** The report's own fields: its title, language and page, then what page 1 prints at its top. */
export function reportFields(report: ReportDefinition, t: EditorText): FieldSpec[] {
  const sizes = (['A4', 'Letter'] as const).map((size) => ({ value: size, label: size, stored: size }))
  const orientations = (['portrait', 'landscape'] as const).map((orientation) => ({
    value: orientation,
    label: t(`option.${orientation}`),
    stored: orientation,
  }))
  const margin = (side: 'top' | 'right' | 'bottom' | 'left', id: MessageId) =>
    lengthField(`/page/margins/${side}`, { id }, report.page.margins[side], 'required')
  return [
    textField('/title', { id: 'field.title' }, 'text', () => report.title),
    textField('/locale', { id: 'field.locale' }, 'text', () => report.locale),
    choiceField('/page/size', { id: 'field.pageSize' }, 'select', sizes, report.page.size),
    choiceField('/page/orientation', { id: 'field.orientation' }, 'select', orientations, report.page.orientation),
    margin('top', 'field.marginTop'),
    margin('right', 'field.marginRight'),
    margin('bottom', 'field.marginBottom'),
    margin('left', 'field.marginLeft'),
    firstPageField(report, t),
  ]
}
