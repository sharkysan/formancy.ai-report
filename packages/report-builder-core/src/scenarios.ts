/**
 * What each native builder must do, as data: user-visible scenarios that
 * the React and the Angular builder each run with Testing Library and
 * user-event, finding every element by its role and accessible name and
 * nothing else (plan 21, formancy.ai's parity approach) -- but one: the
 * file input Add image… opens, hidden and without a role, which an
 * `upload` step hands its file to by reading the DOM (0033).
 *
 * One list for both, so neither builder's tests can quietly expect less
 * than the other's; a framework's runner fails when it skips one, and it
 * implements every kind of step, because every kind is used. The names come
 * from the editor's catalogue and from the scenario report's own content,
 * so the list exists in each of the editor's languages; the frameworks run
 * the English one, and may run the others.
 *
 * What a scenario is, and what a runner does for each kind of step,
 * `scenario-steps.ts` says. The scenarios of editing the report -- its
 * outline, its structure, its properties, its history and its problems --
 * and of the zoom and the panes are here. A subject with fixtures of its
 * own stands beside them: the payment codes (`scenario-payments.ts`), a
 * report's QR-bill selected and edited (`scenario-payment-part.ts`), its
 * e-invoice selected and edited (`scenario-e-invoice.ts`), a host's view
 * (`scenario-host-view.ts`) and images (`scenario-images.ts`).
 */
import { emptyReport } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { PROPERTY_ROLES } from './model-properties.js'
import { hostViewScenarios } from './scenario-host-view.js'
import { imageScenarios } from './scenario-images.js'
import { eInvoiceScenarios } from './scenario-e-invoice.js'
import { paymentPartScenarios } from './scenario-payment-part.js'
import { paymentScenarios } from './scenario-payments.js'
import { body, scenarioReport } from './scenario-report.js'
import type { BuilderScenario, ScenarioQuery, ScenarioStep } from './scenario-steps.js'
import { contentLocale, editorText, formatZoom } from './text.js'
import type { EditorLocale } from './text.js'

/** The scenario report with the introduction shown only when a parameter nobody declared says so: an error the diagnostics link to it. */
function brokenReport(): ReportDefinition {
  const report = scenarioReport()
  return {
    ...report,
    regions: {
      ...report.regions,
      body: report.regions.body.map((component) => (component.id === 'intro' ? { ...component, visibleWhen: { cel: 'params.missing' } } : component)),
    },
  }
}

/** A report with nothing in any region: the outline has no row to be a tab stop. */
function blankReport(): ReportDefinition {
  return emptyReport('blank', 'Blank', 'en')
}

const held = (report: ReportDefinition, id: string): string[] => {
  const found = report.regions.body.find((component) => component.id === id)
  return found !== undefined && 'components' in found ? found.components.map((component) => component.id) : []
}

/** The scenarios, their names in `locale`. */
export function builderScenarios(locale: EditorLocale): readonly BuilderScenario[] {
  const t = editorText(locale)
  const region = t('region.body')
  const spacer = t('kind.spacer')
  const section = t('kind.section')
  const height = t('field.withUnit', { label: t('field.height'), unit: t('unit.mm') })
  const outline: ScenarioQuery = { role: 'tree', name: t('pane.outline') }
  const tree = (name: string, selected?: boolean): ScenarioQuery => ({ role: 'treeitem', name, ...(selected === undefined ? {} : { selected }) })
  const button = (name: string): ScenarioQuery => ({ role: 'button', name })
  const zoom: ScenarioQuery = { role: 'status', name: t('zoom.label') }
  /** The live region: the one status with no name. */
  const said: ScenarioQuery = { role: 'status', name: '' }
  const problems: ScenarioQuery = { role: 'status', name: t('pane.problems') }
  const error = (where: string): ScenarioQuery => button(t('problem.item', { severity: t('severity.error'), where }))
  // What a new text says is in the report's language, which prints, not the editor's.
  const newText = editorText(contentLocale(scenarioReport().locale))('default.text')
  const scenario = (name: string, steps: readonly ScenarioStep[], report: () => ReportDefinition = scenarioReport): BuilderScenario => ({
    name,
    locale,
    report,
    steps,
  })

  // In the order the scenarios were written, which is the order every runner runs them in.
  return [
    scenario('insert a text into the body by keyboard', [
      { do: 'focus', ...button(t('kind.text')) },
      { do: 'press', key: 'Enter' },
      { expect: 'present', role: 'dialog', name: t('places.insert', { kind: t('kind.text') }) },
      { do: 'focus', ...button(t('target.after', { where: region, name: spacer })) },
      { do: 'press', key: 'Enter' },
      { expect: 'absent', role: 'dialog', name: t('places.insert', { kind: t('kind.text') }) },
      { expect: 'focused', ...tree(newText, true) },
      { expect: 'document', says: 'the body ends with a new text', check: (report) => body(report).join() === 'findings,intro,notes,gap,text' },
    ]),
    scenario('select in the outline, and walk it with the arrow keys', [
      { do: 'click', ...tree('Introduction') },
      { expect: 'focused', ...tree('Introduction', true) },
      { expect: 'value', role: PROPERTY_ROLES.multiline, name: t('field.text'), value: 'Introduction' },
      { do: 'press', key: 'ArrowDown' },
      { expect: 'focused', ...tree(section, true) },
      { do: 'press', key: 'ArrowRight' },
      { expect: 'focused', ...tree('Note', true) },
      { do: 'press', key: 'ArrowLeft' },
      { expect: 'focused', ...tree(section, true) },
      { do: 'press', key: 'ArrowUp' },
      { expect: 'focused', ...tree('Introduction', true) },
    ]),
    scenario('focus selects an outline row, and the arrows walk on from it', [
      { do: 'focus', ...tree('Findings') },
      { expect: 'focused', ...tree('Findings', true) },
      { expect: 'value', role: PROPERTY_ROLES.multiline, name: t('field.text'), value: 'Findings' },
      { do: 'press', key: 'ArrowDown' },
      { expect: 'focused', ...tree('Introduction', true) },
    ]),
    scenario('edit the report’s title', [
      { expect: 'value', role: PROPERTY_ROLES.text, name: t('field.title'), value: 'Site visit' },
      { do: 'fill', role: PROPERTY_ROLES.text, name: t('field.title'), text: 'Site visit, Zürich' },
      { expect: 'document', says: 'the title is the one typed', check: (report) => report.title === 'Site visit, Zürich' },
      { expect: 'value', role: PROPERTY_ROLES.text, name: t('field.title'), value: 'Site visit, Zürich' },
    ]),
    scenario('go back to the report’s own properties from a selection', [
      { do: 'click', ...tree('Introduction') },
      { expect: 'absent', role: PROPERTY_ROLES.text, name: t('field.title') },
      { do: 'click', ...button(t('properties.report')) },
      { expect: 'focused', role: PROPERTY_ROLES.text, name: t('field.title') },
      { expect: 'value', role: PROPERTY_ROLES.text, name: t('field.title'), value: 'Site visit' },
      { expect: 'absent', ...tree('Introduction', true) },
    ]),
    scenario('refuse an invalid property, with the error on its field', [
      { do: 'click', ...tree(spacer) },
      { do: 'fill', role: PROPERTY_ROLES.length, name: height, text: '400' },
      { expect: 'invalid', role: PROPERTY_ROLES.length, name: height },
      {
        expect: 'document',
        says: 'the spacer is as tall as it was',
        unchanged: true,
        check: (report) => report.regions.body.some((component) => component.id === 'gap' && component.kind === 'spacer' && component.height === 12),
      },
    ]),
    scenario('move a component down and back up by keyboard', [
      { do: 'click', ...tree('Findings') },
      { do: 'press', key: 'ArrowDown', modifiers: ['Alt'] },
      { expect: 'document', says: 'the findings come after the introduction', check: (report) => body(report).join() === 'intro,findings,notes,gap' },
      { expect: 'focused', ...tree('Findings', true) },
      { do: 'press', key: 'ArrowUp', modifiers: ['Alt'] },
      { expect: 'document', says: 'the findings are first again', check: (report) => body(report).join() === 'findings,intro,notes,gap' },
    ]),
    scenario('move into a section and out again by keyboard', [
      { do: 'click', ...tree(spacer) },
      { do: 'press', key: 'ArrowRight', modifiers: ['Alt'] },
      { expect: 'document', says: 'the spacer is the section’s last', check: (report) => held(report, 'notes').join() === 'note,gap' },
      { expect: 'focused', ...tree(spacer, true) },
      { do: 'press', key: 'ArrowLeft', modifiers: ['Alt'] },
      { expect: 'document', says: 'the spacer follows the section again', check: (report) => body(report).join() === 'findings,intro,notes,gap' },
    ]),
    scenario('move to a place chosen by keyboard', [
      { do: 'click', ...tree('Findings') },
      { do: 'focus', ...button(t('action.moveTo')) },
      { do: 'press', key: 'Enter' },
      { expect: 'present', role: 'dialog', name: t('places.move', { name: 'Findings' }) },
      { do: 'focus', ...button(t('target.after', { where: section, name: 'Note' })) },
      { do: 'press', key: 'Enter' },
      { expect: 'document', says: 'the findings are in the section, after the note', check: (report) => held(report, 'notes').join() === 'note,findings' },
      { expect: 'focused', ...tree('Findings', true) },
    ]),
    scenario('delete moves focus to the next item, or the one before', [
      { do: 'click', ...tree('Introduction') },
      { do: 'press', key: 'Delete' },
      { expect: 'absent', ...tree('Introduction') },
      { expect: 'document', says: 'the introduction is gone', check: (report) => !body(report).includes('intro') },
      { expect: 'focused', ...tree(section, true) },
      { do: 'click', ...tree(spacer) },
      { do: 'press', key: 'Delete' },
      { expect: 'focused', ...tree(section, true) },
    ]),
    scenario('duplicate selects the copy', [
      { do: 'click', ...tree('Introduction') },
      { do: 'press', key: 'd', modifiers: ['Control'] },
      { expect: 'document', says: 'a copy follows the introduction', check: (report) => body(report).join() === 'findings,intro,intro-2,notes,gap' },
      { expect: 'present', ...tree(t('outline.duplicate', { label: 'Introduction', id: 'intro' })) },
      { expect: 'focused', ...tree(t('outline.duplicate', { label: 'Introduction', id: 'intro-2' }), true) },
    ]),
    // Undo takes the copy away and leaves nothing selected. Focus that went
    // to the first row would select it -- focus and selection are one in the
    // outline -- and the next Delete would delete a component the person
    // never chose; it goes to the tree itself instead.
    scenario('undo a duplicate, and Delete then deletes nothing', [
      { do: 'click', ...tree('Introduction') },
      { do: 'press', key: 'd', modifiers: ['Control'] },
      { expect: 'document', says: 'a copy follows the introduction', check: (report) => body(report).join() === 'findings,intro,intro-2,notes,gap' },
      { do: 'press', key: 'z', modifiers: ['Control'] },
      { expect: 'focused', ...outline },
      { expect: 'absent', ...tree('Findings', true) },
      { do: 'press', key: 'Delete' },
      { expect: 'document', says: 'nothing was deleted', check: (report) => body(report).join() === 'findings,intro,notes,gap' },
    ]),
    // A tree with no row in it is still the outline's one tab stop, and says
    // it holds nothing; the regions' names, with no row under them, are no
    // tree's children (axe's aria-required-children: a tree owns rows).
    scenario(
      'an empty report’s outline is one tab stop, and says it is empty',
      [
        { expect: 'present', ...outline },
        { do: 'focus', ...outline },
        { expect: 'focused', ...outline },
        { do: 'press', key: 'ArrowDown' },
        { expect: 'text', ...said, text: t('outline.empty') },
        { expect: 'focused', ...outline },
      ],
      blankReport,
    ),
    scenario('undo and redo, from the toolbar and the keyboard', [
      { do: 'click', ...tree(spacer) },
      { do: 'press', key: 'Delete' },
      { expect: 'document', says: 'the spacer is gone', check: (report) => !body(report).includes('gap') },
      { do: 'click', ...button(t('action.undo')) },
      { expect: 'present', ...tree(spacer) },
      { expect: 'document', says: 'the spacer is back', check: (report) => body(report).includes('gap') },
      { do: 'click', ...button(t('action.redo')) },
      { expect: 'absent', ...tree(spacer) },
      { do: 'press', key: 'z', modifiers: ['Control'] },
      { expect: 'present', ...tree(spacer) },
    ]),
    scenario(
      'a diagnostic links to its component',
      [
        { expect: 'present', ...button(t('problem.item', { severity: t('severity.error'), where: 'Introduction' })) },
        { do: 'click', ...button(t('problem.item', { severity: t('severity.error'), where: 'Introduction' })) },
        { expect: 'focused', ...tree('Introduction', true) },
      ],
      brokenReport,
    ),
    scenario('the problems are counted, and said, as they change', [
      { do: 'click', ...tree('Introduction') },
      { do: 'fill', role: PROPERTY_ROLES.expression, name: t('field.visibleWhen'), text: 'params.missing' },
      { expect: 'text', ...problems, text: `${t('pane.problems')} 1` },
      { expect: 'present', ...error('Introduction') },
      { do: 'click', ...button(t('action.undo')) },
      { expect: 'absent', ...error('Introduction') },
    ]),
    scenario('a tool with nothing to do keeps focus, and says why', [
      { do: 'focus', ...button(t('action.undo')) },
      { do: 'press', key: 'Enter' },
      { expect: 'focused', ...button(t('action.undo')) },
      { expect: 'text', ...said, text: t('status.nothingToUndo') },
      { expect: 'document', says: 'nothing changed', unchanged: true, check: (report) => body(report).join() === 'findings,intro,notes,gap' },
    ]),
    scenario('zoom from the toolbar and the keyboard', [
      { expect: 'text', ...zoom, text: formatZoom(1, locale) },
      { do: 'click', ...button(t('action.zoomIn')) },
      { expect: 'text', ...zoom, text: formatZoom(1.25, locale) },
      { do: 'press', key: '0', modifiers: ['Control'] },
      { expect: 'text', ...zoom, text: formatZoom(1, locale) },
    ]),
    // A side pane hidden for the room goes from the page and from what a
    // screen reader finds; the keyboard lands in the design view that took
    // its room, the live region says how to bring it back, and the
    // toolbar's tool does.
    scenario('hide the outline for the design view, and show it again from the toolbar', [
      { do: 'click', ...button(t('action.hidePane', { pane: t('pane.outline') })) },
      { expect: 'absent', ...outline },
      { expect: 'focused', role: 'region', name: t('canvas.label') },
      { expect: 'text', ...said, text: t('status.paneHidden', { pane: t('pane.outline') }) },
      { do: 'click', ...button(t('pane.outline')) },
      { expect: 'present', ...outline },
      { expect: 'present', ...button(t('action.hidePane', { pane: t('pane.outline') })) },
    ]),
    // The third column holds two panes: each hides alone, and the column
    // goes with the second, as nothing is left in it.
    scenario('hide the properties and the problems, and show the problems again', [
      { do: 'click', ...button(t('action.hidePane', { pane: t('pane.properties') })) },
      { expect: 'absent', role: PROPERTY_ROLES.text, name: t('field.title') },
      { expect: 'present', ...problems },
      { do: 'click', ...button(t('action.hidePane', { pane: t('pane.problems') })) },
      { expect: 'absent', ...problems },
      { expect: 'present', ...outline },
      { do: 'click', ...button(t('pane.problems')) },
      { expect: 'present', ...problems },
      { expect: 'absent', role: PROPERTY_ROLES.text, name: t('field.title') },
    ]),
    ...paymentScenarios(locale),
    ...paymentPartScenarios(locale),
    ...eInvoiceScenarios(locale),
    scenario('choose a style from a picker', [
      { do: 'click', ...tree('Introduction') },
      { do: 'choose', role: PROPERTY_ROLES.style, name: t('field.style'), option: 'heading' },
      {
        expect: 'document',
        says: 'the introduction has the heading style',
        check: (report) => report.regions.body.some((component) => component.id === 'intro' && component.style === 'heading'),
      },
    ]),
    ...hostViewScenarios(locale),
    ...imageScenarios(locale),
  ]
}

/** The scenarios every native builder runs: the English ones. */
export const BUILDER_SCENARIOS: readonly BuilderScenario[] = builderScenarios('en')
