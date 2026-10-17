/**
 * What each native builder must do, as data: user-visible scenarios that
 * the React and the Angular builder each run with Testing Library and
 * user-event, finding every element by its role and accessible name and
 * nothing else (plan 21, formancy.ai's parity approach).
 *
 * One list for both, so neither builder's tests can quietly expect less
 * than the other's; a framework's runner fails when it skips one, and it
 * implements every kind of step, because every kind is used. The names come
 * from the editor's catalogue and from the scenario report's own content,
 * so the list exists in each of the editor's languages; the frameworks run
 * the English one, and may run the others.
 *
 * A runner opens a session over `report()`, mounts its builder over it in
 * `locale`, and does each step in order:
 * - `click`: user-event's click on the element.
 * - `focus`: moves focus to the element, as tabbing to it would. In the
 *   outline that selects the row: focus and selection are one.
 * - `press`: user-event's keyboard, the modifiers held around the key.
 * - `fill`: clears the field, types the text, and tabs away, which commits.
 * - `choose`: selects the option with that label in the combobox.
 * - `present`, `absent`, `focused`: the element is there, is not, has focus.
 * - `value`: the control's value. `text`: the element's text content holds
 *   it. The live region is the status with no name; the problems' count is
 *   the status named by the problems pane.
 * - `invalid`: `aria-invalid="true"`, and an accessible description saying why.
 * - `document`: `check` holds of the session's document.
 */
import { emptyReport } from '@formancy/report-spec'
import type { EpcQrCodeComponent, ReportDefinition } from '@formancy/report-spec'
import { PROPERTY_ROLES } from './model.js'
import { contentLocale, editorText, formatZoom } from './text.js'
import type { EditorLocale } from './text.js'

/** An element, by its role and its accessible name, and the ARIA states it must have. */
export interface ScenarioQuery {
  readonly role: string
  readonly name: string
  readonly selected?: boolean
}

export const SCENARIO_ACTIONS = ['click', 'focus', 'press', 'fill', 'choose'] as const
export const SCENARIO_EXPECTATIONS = ['present', 'absent', 'focused', 'value', 'text', 'invalid', 'document'] as const

export type KeyModifier = 'Alt' | 'Control' | 'Meta' | 'Shift'

export type ScenarioStep =
  | ({ readonly do: 'click' | 'focus' } & ScenarioQuery)
  | { readonly do: 'press'; readonly key: string; readonly modifiers?: readonly KeyModifier[] }
  | ({ readonly do: 'fill'; readonly text: string } & ScenarioQuery)
  | ({ readonly do: 'choose'; readonly option: string } & ScenarioQuery)
  | ({ readonly expect: 'present' | 'absent' | 'focused' | 'invalid' } & ScenarioQuery)
  | ({ readonly expect: 'value'; readonly value: string } & ScenarioQuery)
  | ({ readonly expect: 'text'; readonly text: string } & ScenarioQuery)
  | {
      readonly expect: 'document'
      /** What is checked, for the failure message. */
      readonly says: string
      readonly check: (report: ReportDefinition) => boolean
      /** The check is that something stayed as it was, so it holds of the starting report too. */
      readonly unchanged?: true
    }

export interface BuilderScenario {
  readonly name: string
  readonly locale: EditorLocale
  /** The report the session opens: a fresh copy each call. */
  readonly report: () => ReportDefinition
  readonly steps: readonly ScenarioStep[]
}

const SCENARIO_REPORT: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'site-visit',
  title: 'Site visit',
  locale: 'en',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
  styles: [{ id: 'heading', size: 14, bold: true }],
  datasets: {},
  parameters: [],
  assets: [],
  aggregates: [],
  regions: {
    reportHeader: [],
    pageHeader: [],
    body: [
      { id: 'findings', kind: 'text', style: 'heading', content: [{ kind: 'text', text: 'Findings' }] },
      { id: 'intro', kind: 'text', content: [{ kind: 'text', text: 'Introduction' }] },
      { id: 'notes', kind: 'section', components: [{ id: 'note', kind: 'text', content: [{ kind: 'text', text: 'Note' }] }] },
      { id: 'gap', kind: 'spacer', height: 12 },
    ],
    pageFooter: [],
    summary: [],
  },
}

/** The report every scenario starts from, or breaks one thing in: a fresh copy. scenarios.test.ts opens it, so it is valid. */
export function scenarioReport(): ReportDefinition {
  return JSON.parse(JSON.stringify(SCENARIO_REPORT)) as ReportDefinition
}

/** The scenario report with the introduction shown only when a parameter nobody declared says so: an error the diagnostics link to it. */
function brokenReport(): ReportDefinition {
  const report = scenarioReport()
  return { ...report, regions: { ...report.regions, body: report.regions.body.map((component) => (component.id === 'intro' ? { ...component, visibleWhen: { cel: 'params.missing' } } : component)) } }
}

/**
 * The scenario report with a Swiss QR-bill for its payment part: SIX's
 * QR-IBAN and QR reference (IG 2.4, Annex A), every text literal, as the
 * report reads no data.
 */
function billedReport(): ReportDefinition {
  return {
    ...scenarioReport(),
    paymentPart: {
      kind: 'swissQrBill',
      language: 'en',
      account: [{ kind: 'text', text: 'CH44 3199 9123 0008 8901 2' }],
      creditor: {
        name: [{ kind: 'text', text: 'Max Muster & Söhne' }],
        street: [{ kind: 'text', text: 'Musterstrasse' }],
        buildingNumber: [{ kind: 'text', text: '123' }],
        postalCode: [{ kind: 'text', text: '8000' }],
        town: [{ kind: 'text', text: 'Seldwyla' }],
        country: [{ kind: 'text', text: 'CH' }],
      },
      currency: 'CHF',
      amount: { cel: 'dec("1949.75")' },
      reference: [{ kind: 'text', text: '21 00000 00003 13947 14300 09017' }],
      message: [{ kind: 'text', text: 'Site visit' }],
    },
  }
}

/** Whether `report`'s payment part is still all of the one `billedReport` gave it. */
const billKept = (report: ReportDefinition): boolean => JSON.stringify(report.paymentPart) === JSON.stringify(billedReport().paymentPart)

/** A report with nothing in any region: the outline has no row to be a tab stop. */
function blankReport(): ReportDefinition {
  return emptyReport('blank', 'Blank', 'en')
}

const body = (report: ReportDefinition): string[] => report.regions.body.map((component) => component.id)

/** Whether the body has an EPC payment code whose text at `key` is `text`, one literal run, or, for undefined, absent. */
const codeHas = (report: ReportDefinition, key: 'iban' | 'bic', text: string | undefined): boolean => {
  const code = report.regions.body.find((component): component is EpcQrCodeComponent => component.kind === 'epcQrCode')
  return code !== undefined && JSON.stringify(code[key]) === JSON.stringify(text === undefined ? undefined : [{ kind: 'text', text }])
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
  const newCode = t('label.kindDetail', { kind: t('kind.epcQrCode'), detail: editorText(contentLocale(scenarioReport().locale))('default.epcBeneficiary') })
  const iban: ScenarioQuery = { role: PROPERTY_ROLES.text, name: t('field.iban') }
  const bic: ScenarioQuery = { role: PROPERTY_ROLES.text, name: t('field.bic') }
  const scenario = (name: string, steps: readonly ScenarioStep[], report: () => ReportDefinition = scenarioReport): BuilderScenario => ({ name, locale, report, steps })

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
      { expect: 'document', says: 'the spacer is as tall as it was', unchanged: true, check: (report) => report.regions.body.some((component) => component.id === 'gap' && component.kind === 'spacer' && component.height === 12) },
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
    scenario('an empty report’s outline is one tab stop, and says it is empty', [
      { expect: 'present', ...outline },
      { do: 'focus', ...outline },
      { expect: 'focused', ...outline },
      { do: 'press', key: 'ArrowDown' },
      { expect: 'text', ...said, text: t('outline.empty') },
      { expect: 'focused', ...outline },
    ], blankReport),
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
    // A payment part is the report's, not a region's, and nothing edits it
    // yet: the design view shows where its slip prints, an edit elsewhere
    // keeps it whole, and a page it cannot be printed on is refused on the
    // field that asked for it.
    scenario(
      'a payment part is drawn at the sheet’s foot, and edits keep it',
      [
        { expect: 'present', role: 'img', name: t('canvas.paymentPart') },
        { do: 'fill', role: PROPERTY_ROLES.text, name: t('field.title'), text: 'Site visit, invoiced' },
        { expect: 'document', says: 'the title is the one typed, and the bill is whole', check: (report) => report.title === 'Site visit, invoiced' && billKept(report) },
        { do: 'choose', role: PROPERTY_ROLES.select, name: t('field.orientation'), option: t('option.landscape') },
        { expect: 'invalid', role: PROPERTY_ROLES.select, name: t('field.orientation') },
        { expect: 'document', says: 'the page is upright still, and the bill is whole', check: (report) => report.page.orientation === 'portrait' && billKept(report) },
        { do: 'click', ...tree(spacer) },
        { do: 'press', key: 'Delete' },
        { expect: 'document', says: 'the spacer is gone, and the bill is whole', check: (report) => !body(report).includes('gap') && billKept(report) },
        { expect: 'present', role: 'img', name: t('canvas.paymentPart') },
      ],
      billedReport,
    ),
    // A payment code is inserted as any kind is, and its account typed where
    // it is written: an IBAN whose check digits are wrong is refused on its
    // field, and the code still pays the account it did. An optional text
    // -- the BIC -- is added by typing it into its empty field, and removed
    // by emptying it, as every optional property is.
    scenario('insert an EPC payment code, and type its account', [
      { do: 'focus', ...button(t('kind.epcQrCode')) },
      { do: 'press', key: 'Enter' },
      { do: 'focus', ...button(t('target.after', { where: region, name: spacer })) },
      { do: 'press', key: 'Enter' },
      { expect: 'focused', ...tree(newCode, true) },
      { do: 'fill', ...iban, text: 'DE71 1102 2033 0123 4567 88' },
      { expect: 'invalid', ...iban },
      { expect: 'document', says: 'the new code pays the account it started with', check: (report) => codeHas(report, 'iban', 'DE36 0000 0000 0000 0000 00') },
      { do: 'fill', ...iban, text: 'DE71 1102 2033 0123 4567 89' },
      { expect: 'document', says: 'the code pays the IBAN typed, with no BIC', check: (report) => codeHas(report, 'iban', 'DE71 1102 2033 0123 4567 89') && codeHas(report, 'bic', undefined) },
      { do: 'fill', ...bic, text: 'BHBLDEHHXXX' },
      { expect: 'document', says: 'the code holds the BIC typed', check: (report) => codeHas(report, 'bic', 'BHBLDEHHXXX') },
      { do: 'fill', ...bic, text: '' },
      { expect: 'document', says: 'the code holds no BIC again', check: (report) => codeHas(report, 'bic', undefined) },
      { expect: 'value', ...bic, value: '' },
    ]),
    scenario('choose a style from a picker', [
      { do: 'click', ...tree('Introduction') },
      { do: 'choose', role: PROPERTY_ROLES.style, name: t('field.style'), option: 'heading' },
      { expect: 'document', says: 'the introduction has the heading style', check: (report) => report.regions.body.some((component) => component.id === 'intro' && component.style === 'heading') },
    ]),
  ]
}

/** The scenarios every native builder runs: the English ones. */
export const BUILDER_SCENARIOS: readonly BuilderScenario[] = builderScenarios('en')
