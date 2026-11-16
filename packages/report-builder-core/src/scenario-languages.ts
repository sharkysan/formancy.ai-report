/**
 * The scenario of a report's languages (0063): a language added at the
 * report's level by its tag -- the report's own refused on the field --
 * its words then missing as problems that name it, the switch in the bar
 * that appears with it, a word written in it from its field and seen in
 * the design view, the report's own words back when the switch goes back,
 * and the word undone.
 */
import type { ReportDefinition } from '@formancy/report-spec'
import { languageName } from './languages.js'
import { PROPERTY_ROLES } from './model-properties.js'
import { scenarioReport } from './scenario-report.js'
import type { BuilderScenario, ScenarioQuery } from './scenario-steps.js'
import { editorText } from './text.js'
import type { EditorLocale } from './text.js'

/** The words the scenario report prints: its title, the findings, the introduction and the note, each missing in a language just added. */
const WORDS = 4

/** The French the report holds for `word`, if any. */
const french = (report: ReportDefinition, word: string): string | undefined =>
  report.translations?.find((translation) => translation.locale === 'fr-CH')?.words.find((entry) => entry.word === word)?.text

/** The scenarios, their names in `locale`. */
export function languageScenarios(locale: EditorLocale): readonly BuilderScenario[] {
  const t = editorText(locale)
  const name = languageName('fr-CH', locale)
  const own = languageName(scenarioReport().locale, locale)
  const switcher: ScenarioQuery = { role: 'combobox', name: t('language.label') }
  const add: ScenarioQuery = { role: PROPERTY_ROLES.text, name: t('field.addLanguage') }
  const text: ScenarioQuery = { role: PROPERTY_ROLES.multiline, name: t('field.text') }
  const problems: ScenarioQuery = { role: 'status', name: t('pane.problems') }
  const missing = (where: string): ScenarioQuery => ({ role: 'button', name: t('problem.itemIn', { severity: t('severity.error'), language: name, where }) })
  return [
    {
      name: 'add a language, write a word in it and see it in the design view, and go back to the report’s own words',
      locale,
      report: scenarioReport,
      steps: [
        { expect: 'absent', ...switcher },
        // The report's own language is no language to add.
        { do: 'fill', ...add, text: scenarioReport().locale },
        { expect: 'invalid', ...add },
        { do: 'fill', ...add, text: 'fr-CH' },
        {
          expect: 'document',
          says: 'the report is written in French as well, with no word yet',
          check: (report) => report.translations?.length === 1 && report.translations[0]?.locale === 'fr-CH' && report.translations[0].words.length === 0,
        },
        { expect: 'value', ...add, value: '' },
        { expect: 'text', ...problems, text: `${t('pane.problems')} ${String(WORDS)}` },
        { expect: 'present', ...missing('Introduction') },
        { do: 'choose', ...switcher, option: t('language.missing', { name, count: WORDS }) },
        { expect: 'value', ...switcher, value: 'fr-CH' },
        // Shown in the report's own words, and said to be missing.
        { expect: 'described', role: 'img', name: 'Introduction', text: t('canvas.missing', { language: name }) },
        { do: 'click', role: 'treeitem', name: 'Introduction' },
        // Not written yet: the field is empty, the report's own word its placeholder.
        { expect: 'value', ...text, value: '' },
        { expect: 'described', ...text, text: t('field.wordMissing', { language: name, count: 1 }) },
        { do: 'fill', ...text, text: 'Présentation' },
        { expect: 'document', says: 'the introduction is written in French', check: (report) => french(report, 'Introduction') === 'Présentation' },
        { expect: 'present', role: 'img', name: 'Présentation' },
        { expect: 'described', ...text, text: t('field.wordIn', { language: name, count: 1 }) },
        { expect: 'present', role: 'treeitem', name: 'Présentation', selected: true },
        { expect: 'absent', ...missing('Présentation') },
        { expect: 'text', ...problems, text: `${t('pane.problems')} ${String(WORDS - 1)}` },
        { do: 'choose', ...switcher, option: t('language.own', { name: own }) },
        { expect: 'present', role: 'img', name: 'Introduction' },
        { expect: 'absent', role: 'img', name: 'Présentation' },
        { expect: 'value', ...text, value: 'Introduction' },
        { do: 'click', role: 'button', name: t('action.undo') },
        { expect: 'document', says: 'the introduction is no longer written in French', check: (report) => french(report, 'Introduction') === undefined },
        { expect: 'text', ...problems, text: `${t('pane.problems')} ${String(WORDS)}` },
      ],
    },
  ]
}
