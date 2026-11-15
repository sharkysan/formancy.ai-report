/**
 * The report's own properties, as fields: its title, its language and its
 * page; and its languages (0063), a group whose field adds one by its tag
 * and whose buttons remove each it has.
 *
 * In a language besides the report's own, the title's field writes the
 * title's translation, as every field at a word does (`word-fields.ts`);
 * the Language field still names the report's own language, the one its
 * words are written in, and changes it (report-core's `setLocale`).
 */
import { addLanguage } from '@formancy/report-core'
import type { ReportDefinition } from '@formancy/report-spec'
import type { Edited } from './languages.js'
import { languageName } from './languages.js'
import { choiceField, lengthField, refused, textField, UNCHANGED, value } from './property-fields.js'
import type { FieldContext, FieldSpec, GroupSpec } from './property-fields.js'
import type { EditorLocale, EditorText, MessageId } from './text.js'
import { wordOrTextField } from './word-fields.js'

/** The report's own fields: its title, in the language edited, its language and its page. */
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
