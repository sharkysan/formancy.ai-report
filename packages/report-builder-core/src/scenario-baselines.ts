/**
 * The scenarios of a run of a paragraph set below or above the line
 * (0061): the digit of a formula selected in its field and lowered from
 * the keyboard, the keyboard following it to the run that holds it, undone
 * and redone from the toolbar, and set back on the line by its pressed
 * button, the runs joined again; and a value raised whole, as a bound run
 * is. Apart from `scenarios.ts` because they change when what a run's
 * buttons do does.
 */
import type { Inline, ReportDefinition } from '@formancy/report-spec'
import { PROPERTY_ROLES } from './model-properties.js'
import { scenarioReport } from './scenario-report.js'
import type { BuilderScenario, ScenarioQuery } from './scenario-steps.js'
import { editorText } from './text.js'
import type { EditorLocale } from './text.js'

/** The scenario report with a text that raises a parameter's value: ten to the power the report is given. */
function exponentReport(): ReportDefinition {
  const report = scenarioReport()
  const power = {
    id: 'power',
    kind: 'text',
    content: [
      { kind: 'text', text: '10' },
      { kind: 'parameter', parameter: 'exponent' },
    ],
  } as const
  return {
    ...report,
    parameters: [{ id: 'exponent', type: 'integer', label: 'Exponent', required: true }],
    regions: { ...report.regions, body: [...report.regions.body, power] },
  }
}

/** The runs of the body's text `id`, as JSON: what a scenario's `document` expectation compares. */
function runsOf(report: ReportDefinition, id: string): string {
  const found = report.regions.body.find((component) => component.id === id)
  return JSON.stringify(found?.kind === 'text' ? found.content : null)
}

const runs = (...content: readonly Inline[]): string => JSON.stringify(content)

export function baselineScenarios(locale: EditorLocale): readonly BuilderScenario[] {
  const t = editorText(locale)
  const tree = (name: string): ScenarioQuery => ({ role: 'treeitem', name })
  const button = (name: string, pressed?: boolean): ScenarioQuery => ({ role: 'button', name, ...(pressed === undefined ? {} : { pressed }) })
  const lowered = (name: string, pressed: boolean): ScenarioQuery => button(t('action.subscriptOf', { name }), pressed)
  const raised = (name: string, pressed: boolean): ScenarioQuery => button(t('action.superscriptOf', { name }), pressed)
  const text = t('field.text')
  const part = (n: number, kind: 'text' | 'parameter'): string => t('field.part', { n, kind: t(`run.${kind}`) })
  const field = (name: string): ScenarioQuery => ({ role: PROPERTY_ROLES.multiline, name })
  /** The live region: the one status with no name. */
  const said: ScenarioQuery = { role: 'status', name: '' }
  return [
    {
      name: 'set part of a text below the line from the keyboard, undo it, and set it back on the line',
      locale,
      report: scenarioReport,
      steps: [
        { do: 'click', ...tree('Introduction') },
        { do: 'fill', ...field(text), text: 'H2O' },
        { do: 'selectText', ...field(text), start: 1, end: 2 },
        { do: 'focus', ...lowered(text, false) },
        { do: 'press', key: 'Enter' },
        {
          expect: 'document',
          says: 'the 2 is set below the line, between the H and the O',
          check: (report) =>
            runsOf(report, 'intro') === runs({ kind: 'text', text: 'H' }, { kind: 'text', text: '2', baseline: 'subscript' }, { kind: 'text', text: 'O' }),
        },
        // The keyboard follows the digit to the run that holds it now, its button pressed.
        { expect: 'focused', ...lowered(part(2, 'text'), true) },
        { expect: 'present', role: 'group', name: part(2, 'text') },
        { expect: 'value', ...field(part(1, 'text')), value: 'H' },
        { expect: 'value', ...field(part(2, 'text')), value: '2' },
        { expect: 'value', ...field(part(3, 'text')), value: 'O' },
        { expect: 'present', ...raised(part(2, 'text'), false) },
        { expect: 'present', ...lowered(part(1, 'text'), false) },
        { expect: 'text', ...said, text: t('status.subscript', { name: text }) },
        { do: 'click', ...button(t('action.undo')) },
        {
          expect: 'document',
          says: 'the text is one run on the line again',
          check: (report) => runsOf(report, 'intro') === runs({ kind: 'text', text: 'H2O' }),
        },
        { expect: 'value', ...field(text), value: 'H2O' },
        { expect: 'absent', role: 'group', name: part(2, 'text') },
        { do: 'click', ...button(t('action.redo')) },
        { expect: 'present', ...lowered(part(2, 'text'), true) },
        // Pressed, its button sets the digit back on the line, and the three runs are one again.
        { do: 'click', ...lowered(part(2, 'text'), true) },
        {
          expect: 'document',
          says: 'set back on the line, the runs are one',
          check: (report) => runsOf(report, 'intro') === runs({ kind: 'text', text: 'H2O' }),
        },
        { expect: 'focused', ...lowered(text, false) },
        { expect: 'text', ...said, text: t('status.onTheLine', { name: part(2, 'text') }) },
      ],
    },
    {
      name: 'set a bound run above the line whole',
      locale,
      report: exponentReport,
      steps: [
        { do: 'click', ...tree('10[Exponent]') },
        { do: 'focus', ...raised(part(2, 'parameter'), false) },
        { do: 'press', key: 'Enter' },
        {
          expect: 'document',
          says: 'the parameter is set above the line, whole',
          check: (report) =>
            runsOf(report, 'power') === runs({ kind: 'text', text: '10' }, { kind: 'parameter', parameter: 'exponent', baseline: 'superscript' }),
        },
        { expect: 'focused', ...raised(part(2, 'parameter'), true) },
        { expect: 'present', ...lowered(part(2, 'parameter'), false) },
        { expect: 'value', role: PROPERTY_ROLES.binding, name: part(2, 'parameter'), value: 'parameter:exponent' },
      ],
    },
  ]
}
