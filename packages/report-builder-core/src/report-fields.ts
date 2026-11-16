/**
 * The report's own properties, as fields: its title, its language, its
 * page, and what page 1 prints at its top, a region's presence rather than
 * a value (0060); and its languages (0063), a group whose field adds one by
 * its tag and whose buttons remove each it has.
 *
 * In a language besides the report's own, the title's field writes the
 * title's translation, as every field at a word does (`word-fields.ts`);
 * the Language field still names the report's own language, the one its
 * words are written in, and changes it (report-core's `setLocale`).
 */
import { addLanguage } from '@formancy/report-core'
import type { ReportDefinition } from '@formancy/report-spec'
import { choiceField, lengthField, refused, textField, UNCHANGED, value } from './field-specs.js'
import type { FieldSpec } from './field-specs.js'
import type { Edited } from './languages.js'
import { languageName } from './languages.js'
import type { FieldContext, GroupSpec } from './property-fields.js'
import type { EditorLocale, EditorText, MessageId } from './text.js'
import { wordOrTextField } from './word-fields.js'

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
  return { ...choice, write: (input) => (input === current ? UNCHANGED : choice.write(input)) }
}

/** The report's own fields: its title, in the language edited, its language and its page, then what page 1 prints at its top. */
export function reportFields(report: ReportDefinition, t: EditorText, locale: EditorLocale, edited?: Edited): FieldSpec[] {
  const context: FieldContext = { report, t, locale, row: false, ...(edited === undefined ? {} : { edited }) }
  const sizes = (['A4', 'Letter'] as const).map((size) => ({ value: size, label: size, stored: size }))
  const orientations = (['portrait', 'landscape'] as const).map((orientation) => ({
    value: orientation,
    label: t(`option.${orientation}`),
    stored: orientation,
  }))
  const margin = (side: 'top' | 'right' | 'bottom' | 'left', id: MessageId) =>
    lengthField(`/page/margins/${side}`, { id }, report.page.margins[side], 'required')
  return [
    wordOrTextField('/title', { id: 'field.title' }, report.title, context),
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

/**
 * The report's languages: one field, Add language, which takes a tag --
 * `/translations/-`, the pointer past a list's last item -- and adds the
 * language with no words yet (report-core's `addLanguage`), leaving the
 * field empty again, and a Remove for each translation the report
 * declares, which takes the language away with its words and gives the
 * keyboard to Add language. Whether a tag is one, and not the report's own
 * or one it has, report-core and the validator say, on the field.
 */
export function languagesGroup(report: ReportDefinition, locale: EditorLocale): GroupSpec {
  const add: FieldSpec = {
    key: '/translations/-',
    words: { id: 'field.addLanguage' },
    kind: 'text',
    required: false,
    placeholder: 'option.languageTag',
    read: () => '',
    write: (input) => {
      if (typeof input !== 'string') return refused('input.option')
      return input.trim() === '' ? UNCHANGED : value(input.trim())
    },
    change: (tag) => ({
      command: (r) => addLanguage(r, tag as string),
      step: { do: 'said', id: 'history.addLanguage' },
      said: 'status.languageAdded',
      values: { name: languageName(tag as string, locale) },
    }),
  }
  return {
    key: '/translations',
    words: 'languages.heading',
    fields: [add],
    buttons: (report.translations ?? []).map(({ locale: tag }) => ({
      words: 'action.removeLanguage',
      name: languageName(tag, locale),
      action: { type: 'removeLanguage', locale: tag },
      available: true,
      then: { group: '/translations' },
    })),
  }
}
