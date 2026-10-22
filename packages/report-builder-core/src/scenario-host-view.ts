/**
 * The builder scenarios about a view of the host's own -- the Studio's
 * Preview -- that a builder makes room for (0029): in the design view's
 * place, which the toolbar's Design view gives back and a side pane hidden
 * gives its room and the keyboard; beside the builder, where the design
 * view keeps its place; the keyboard going with the middle pane as the
 * host moves the view; and the builder's keys and its zoom stopping at
 * it. Each scenario's editor is made with the view, and the runner gives
 * the builder the view's one button.
 */
import type { ReportDefinition } from '@formancy/report-spec'
import { PROPERTY_ROLES } from './model-properties.js'
import { body, scenarioReport } from './scenario-report.js'
import type { BuilderScenario, ScenarioHost, ScenarioQuery, ScenarioStep } from './scenario-steps.js'
import { editorText, formatZoom } from './text.js'
import type { EditorLocale } from './text.js'

/**
 * The host's view the scenarios about one are given: the Studio's Preview
 * and its Download PDF. Its words are the host's, the same in every
 * language the editor speaks.
 */
const PREVIEW: ScenarioHost = { name: 'Preview', control: 'Download PDF' }

/** The host's view's scenarios, their names in `locale`. */
export function hostViewScenarios(locale: EditorLocale): readonly BuilderScenario[] {
  const t = editorText(locale)
  const outline: ScenarioQuery = { role: 'tree', name: t('pane.outline') }
  const tree = (name: string): ScenarioQuery => ({ role: 'treeitem', name })
  const button = (name: string): ScenarioQuery => ({ role: 'button', name })
  const zoom: ScenarioQuery = { role: 'status', name: t('zoom.label') }
  /** The live region: the one status with no name. */
  const said: ScenarioQuery = { role: 'status', name: '' }
  const designView: ScenarioQuery = { role: 'region', name: t('canvas.label') }
  const preview: ScenarioQuery = { role: 'region', name: PREVIEW.name }
  const scenario = (name: string, steps: readonly ScenarioStep[], report: () => ReportDefinition, host: ScenarioHost): BuilderScenario => ({ name, locale, report, steps, host })

  return [
    // The host's view -- the Studio's PDF -- stands where the design view
    // stood, with the outline and the properties beside it, so a person
    // edits and watches what prints; the live region says the way back,
    // and the toolbar's Design view is it, the keyboard going with it.
    scenario(
      'a host’s view takes the design view’s place, and the toolbar’s Design view gives it back',
      [
        { expect: 'present', ...designView },
        { do: 'host', action: { type: 'showHostView' } },
        { expect: 'present', ...preview },
        { expect: 'present', ...button(PREVIEW.control) },
        { expect: 'absent', ...designView },
        { expect: 'present', ...outline },
        { expect: 'present', role: PROPERTY_ROLES.text, name: t('field.title') },
        { expect: 'text', ...said, text: t('status.hostViewShown', { view: PREVIEW.name, pane: t('pane.canvas') }) },
        { do: 'click', ...button(t('pane.canvas')) },
        { expect: 'absent', ...preview },
        { expect: 'focused', ...designView },
      ],
      scenarioReport,
      PREVIEW,
    ),
    // The builder's shortcuts stop at the host's view: Ctrl+Z on the
    // Preview's own control would otherwise undo the report the person is
    // looking at, and Ctrl+- zoom a design view nobody can see.
    scenario(
      'a key pressed in a host’s view is the host’s',
      [
        { do: 'click', ...tree('Introduction') },
        { do: 'press', key: 'Delete' },
        { expect: 'document', says: 'the introduction is gone', check: (report) => !body(report).includes('intro') },
        { do: 'focus', ...button(PREVIEW.control) },
        { do: 'press', key: 'z', modifiers: ['Control'] },
        { expect: 'document', says: 'the introduction is still gone: nothing was undone', check: (report) => !body(report).includes('intro') },
        { do: 'press', key: '-', modifiers: ['Control'] },
        { expect: 'text', ...zoom, text: formatZoom(1, locale) },
        { expect: 'focused', ...button(PREVIEW.control) },
      ],
      scenarioReport,
      { ...PREVIEW, shown: true },
    ),
    // A pane hidden for the room gives it to whatever stands in the middle:
    // the host's view, and the keyboard lands there.
    scenario(
      'a side pane hidden beside a host’s view gives it the room and the keyboard',
      [
        { do: 'click', ...button(t('action.hidePane', { pane: t('pane.outline') })) },
        { expect: 'absent', ...outline },
        { expect: 'focused', ...preview },
        { do: 'click', ...button(t('pane.outline')) },
        { expect: 'present', ...outline },
        { expect: 'present', ...preview },
      ],
      scenarioReport,
      { ...PREVIEW, shown: true },
    ),
    // Beside the builder the host draws its view, and the design view keeps
    // its place: the toolbar's Design view takes nothing away there, so the
    // view placed back in the middle is still shown.
    scenario(
      'a host’s view placed beside the builder leaves the design view in its place',
      [
        { do: 'host', action: { type: 'placeHostView', place: 'beside' } },
        { expect: 'present', ...designView },
        { expect: 'absent', ...preview },
        { do: 'click', ...button(t('pane.canvas')) },
        { expect: 'focused', ...designView },
        { do: 'host', action: { type: 'placeHostView', place: 'middle' } },
        { expect: 'present', ...preview },
        { expect: 'absent', ...designView },
      ],
      scenarioReport,
      { ...PREVIEW, shown: true },
    ),
    // The window crossing a width moves the host's view between the
    // middle and beside, swapping the middle pane under the keyboard: it
    // goes to whatever stands there now, never down to the page, where a
    // keyboard's next Tab would start from the top. Anywhere else it stays.
    scenario(
      'the keyboard goes with the middle pane when the host moves its view, and stays anywhere else',
      [
        { do: 'click', ...button(t('pane.canvas')) },
        { expect: 'focused', ...designView },
        { do: 'host', action: { type: 'placeHostView', place: 'middle' } },
        { expect: 'focused', ...preview },
        { do: 'host', action: { type: 'placeHostView', place: 'beside' } },
        { expect: 'focused', ...designView },
        { do: 'click', ...tree('Introduction') },
        { do: 'host', action: { type: 'placeHostView', place: 'middle' } },
        { expect: 'present', ...preview },
        { expect: 'focused', ...tree('Introduction') },
      ],
      scenarioReport,
      { ...PREVIEW, shown: true, place: 'beside' },
    ),
    // The zoom is the design view's: with the host's view in its place a
    // zoom would change a readout beside the host's own and nothing anybody
    // sees, so the toolbar's zoom says why it does nothing, and works again
    // once the design view is back.
    scenario(
      'the zoom says it is the design view’s while a host’s view stands in its place',
      [
        { do: 'click', ...button(t('action.zoomIn')) },
        { expect: 'text', ...zoom, text: formatZoom(1, locale) },
        { expect: 'text', ...said, text: t('status.zoomHidden', { view: PREVIEW.name, pane: t('pane.canvas') }) },
        { do: 'click', ...button(t('pane.canvas')) },
        { do: 'click', ...button(t('action.zoomIn')) },
        { expect: 'text', ...zoom, text: formatZoom(1.25, locale) },
      ],
      scenarioReport,
      { ...PREVIEW, shown: true },
    ),
  ]
}
