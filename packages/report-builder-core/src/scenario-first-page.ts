/**
 * The builder scenarios about what page 1 prints at its top (0060): page 1
 * given a header of its own from the report's properties, its group in the
 * outline once it is there, a text put in it from the keyboard and drawn
 * in the design view, undone and redone, and page 1 given the page header
 * back, the group and the text going with it, and undone; and a page
 * number, which has no value in page 1's own header, offered the page
 * header and never that.
 */
import type { ReportDefinition, TextComponent } from '@formancy/report-spec'
import { PROPERTY_ROLES } from './model-properties.js'
import { scenarioReport } from './scenario-report.js'
import type { BuilderScenario, ScenarioQuery, ScenarioStep } from './scenario-steps.js'
import { contentLocale, editorText } from './text.js'
import type { EditorLocale } from './text.js'

/** What page 1's own header holds, its kinds in order; undefined where the report has none. */
const ownHeader = (report: ReportDefinition): string | undefined => report.regions.firstPageHeader?.map((component) => component.kind).join()

/** The text the page footer of `folioReport` prints: the page's number. */
const FOLIO: TextComponent = { id: 'folio', kind: 'text', content: [{ kind: 'text', text: 'Page ' }, { kind: 'pageNumber' }] }

/** The scenario report with a page number in its page footer and an empty header of page 1's own: the page header prints from page 2 on. */
function folioReport(): ReportDefinition {
  const report = scenarioReport()
  return { ...report, regions: { ...report.regions, firstPageHeader: [], pageFooter: [FOLIO] } }
}

/** The scenarios about page 1's header, their names in `locale`. */
export function firstPageScenarios(locale: EditorLocale): readonly BuilderScenario[] {
  const t = editorText(locale)
  const tree = (name: string, selected?: boolean): ScenarioQuery => ({ role: 'treeitem', name, ...(selected === undefined ? {} : { selected }) })
  const button = (name: string): ScenarioQuery => ({ role: 'button', name })
  const choice: ScenarioQuery = { role: PROPERTY_ROLES.select, name: t('field.firstPageHeader') }
  const ownGroup: ScenarioQuery = { role: 'group', name: t('region.firstPageHeader') }
  const insideOwn = button(t('target.inside', { where: t('region.firstPageHeader') }))
  const insideRunning = button(t('target.inside', { where: t('region.pageHeader') }))
  /** The live region: the one status with no name. */
  const said: ScenarioQuery = { role: 'status', name: '' }
  // What a new text says is in the report's language, which prints, not the editor's.
  const newText = editorText(contentLocale(scenarioReport().locale))('default.text')
  const folio = `Page ${t('label.pageNumber')}`
  const scenario = (name: string, steps: readonly ScenarioStep[], report: () => ReportDefinition): BuilderScenario => ({ name, locale, report, steps })

  return [
    // The choice is the region's presence: chosen, an empty header of its
    // own is put in and listed before the page header; a text placed in it
    // by the place chooser is drawn there; undo and redo take it out and
    // put it back; and the page header chosen again takes the region away
    // with what it holds, in one step that undo takes back whole.
    scenario(
      'give page 1 a header of its own, put a text in it by keyboard, and give page 1 the page header back',
      [
        { expect: 'absent', ...ownGroup },
        { expect: 'value', ...choice, value: 'pageHeader' },
        { do: 'choose', ...choice, option: t('option.ownHeader') },
        { expect: 'document', says: 'page 1 has an empty header of its own', check: (report) => ownHeader(report) === '' },
        { expect: 'present', ...ownGroup },
        { expect: 'text', ...said, text: t('status.ownHeaderChosen') },
        { do: 'focus', ...button(t('kind.text')) },
        { do: 'press', key: 'Enter' },
        { do: 'focus', ...insideOwn },
        { do: 'press', key: 'Enter' },
        { expect: 'focused', ...tree(newText, true) },
        { expect: 'document', says: 'page 1’s own header holds the new text', check: (report) => ownHeader(report) === 'text' },
        { expect: 'present', role: 'img', name: newText },
        { do: 'click', ...button(t('action.undo')) },
        { expect: 'absent', ...tree(newText) },
        { expect: 'document', says: 'undo took the text out, and left page 1 its own header', check: (report) => ownHeader(report) === '' },
        { do: 'click', ...button(t('action.redo')) },
        { expect: 'present', ...tree(newText) },
        { expect: 'value', ...choice, value: 'firstPageHeader' },
        { do: 'choose', ...choice, option: t('option.runningHeader') },
        { expect: 'document', says: 'page 1 prints the page header again', check: (report) => ownHeader(report) === undefined },
        { expect: 'absent', ...ownGroup },
        { expect: 'absent', ...tree(newText) },
        { expect: 'text', ...said, text: t('status.pageHeaderChosen') },
        { do: 'click', ...button(t('action.undo')) },
        { expect: 'present', ...ownGroup },
        { expect: 'present', ...tree(newText) },
        { expect: 'document', says: 'undo gave page 1 its own header back, the text in it', check: (report) => ownHeader(report) === 'text' },
      ],
      scenarioReport,
    ),
    // A page number in page 1's own header would print a number nothing
    // counts, which report-spec refuses there: the place chooser offers
    // the page header, which counts its pages, and never page 1's own.
    scenario(
      'move a page number by keyboard: the page header is offered, page 1’s own header is not',
      [
        { do: 'click', ...tree(folio) },
        { do: 'focus', ...button(t('action.moveTo')) },
        { do: 'press', key: 'Enter' },
        { expect: 'present', role: 'dialog', name: t('places.move', { name: folio }) },
        { expect: 'absent', ...insideOwn },
        { do: 'focus', ...insideRunning },
        { do: 'press', key: 'Enter' },
        {
          expect: 'document',
          says: 'the page number heads the page header, and page 1’s own header is empty',
          check: (report) => report.regions.pageHeader.map((component) => component.id).join() === 'folio' && ownHeader(report) === '',
        },
        { expect: 'focused', ...tree(folio, true) },
      ],
      folioReport,
    ),
  ]
}
