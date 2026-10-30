import { SITE_VISIT_V1, SITE_VISIT_V2 } from '@formancy/report-corpus'
import { reportHash, walkComponents } from '@formancy/report-spec'
import type { Component, ReportDefinition } from '@formancy/report-spec'
import { schemaHash } from '@formancy/spec'
import { describe, expect, test } from 'vitest'
import { NOTE_CODES } from './notes.js'
import { formOf, generate, generatedFrom, generationRefusals, notesOf } from './test-support.js'

/**
 * A report generated from a formancy form version is a deterministic first
 * draft, and what it left out is listed (0045): a title, a line of label
 * and value for each answered field in model order, a group's fields in a
 * section of its own, one table over the repeater the person chose, page
 * numbers in the footer, the provenance of the version it was made from,
 * and the binding that reads that version's submissions into it. Every
 * report a test generates is held to the runtime's `checkReport`
 * (`test-support.ts`).
 */

const VISIT = { id: 'site-visit', locale: 'de-CH', detail: { kind: 'repeater', repeater: 'findings' } } as const

/** Each component of `report`'s body as its id and kind, a container's after it, indented. */
function outline(components: readonly Component[], depth = 0): string[] {
  return components.flatMap((component) => [`${'  '.repeat(depth)}${component.id} ${component.kind}`, ...('components' in component ? outline(component.components, depth + 1) : [])])
}

/** The text a text component prints when it holds only literal runs, or its runs' kinds. */
function said(component: Component | undefined): string {
  if (component?.kind !== 'text') return String(component?.kind)
  return component.content.map((run) => (run.kind === 'text' ? run.text : `{${run.kind}}`)).join('')
}

/** Every component of `report`, anywhere, a container before what it holds. */
const everything = (report: ReportDefinition): Component[] => walkComponents(report).map(({ component }) => component)

describe('generateReport, the site visit', () => {
  // A draft out of model order would print the visit as no form showed it,
  // a group's fields loose would lose who the inspector was, and labels in
  // another language would print English under a German report. So: the
  // answers in model order, the inspector a section, the ticked boxes and
  // the matrix a section of a line each, the findings one table, the
  // summary's line after it, the pages counted in the footer, each line the
  // field's label from the version in the report's language and its value.
  test('lays the version out in model order: a line per answer, a section per group, one table over the findings', () => {
    const { report } = generatedFrom(generate(SITE_VISIT_V2, VISIT))
    expect([report.id, report.title, report.locale]).toEqual(['site-visit', 'Site visit', 'de-CH'])
    expect(report.regions.reportHeader.map(said)).toEqual(['Site visit'])
    expect(outline(report.regions.body)).toEqual([
      'line-1 text',
      'line-2 text',
      'line-3 text',
      'line-4 text',
      'line-5 text',
      'section-1 section',
      '  heading-1 text',
      '  line-6 text',
      '  line-7 text',
      'section-2 section',
      '  heading-2 text',
      '  line-8 text',
      '  line-9 text',
      '  line-10 text',
      'section-3 section',
      '  heading-3 text',
      '  line-11 text',
      '  line-12 text',
      'heading-4 text',
      'table table',
      'line-13 text',
    ])
    const lines = everything(report).filter((component) => component.kind === 'text' && component.id.startsWith('line-')).map(said)
    expect(lines).toEqual([
      'Objekt: {field}',
      'Besucht am: {field}',
      'Angekommen um: {field}',
      'Begonnen um: {field}',
      'Ergebnis: {field}',
      'Name: {field}',
      'Ausweis: {field}',
      'Dach: {expression}',
      'Elektrik: {expression}',
      'Heizkessel: {expression}',
      'Sicherheit: {field}',
      'Sauberkeit: {field}',
      'Zusammenfassung: {field}',
    ])
    expect(everything(report).filter((component) => component.id.startsWith('heading-')).map(said)).toEqual(['Inspektor', 'Geprüft', 'Zustand', 'Befunde'])
    const table = everything(report).find((component) => component.kind === 'table')
    expect(table?.kind === 'table' ? table.columns.map((column) => `${column.header} ${column.align}`) : []).toEqual(['Nr. left', 'Bereich left', 'Dringlichkeit left', 'Stunden right', 'Teile right', 'Vor Ort behoben left'])
    expect(report.regions.pageFooter.map(said)).toEqual(['{pageNumber} / {pageCount}'])
    expect([report.regions.pageHeader, report.regions.summary]).toEqual([[], []])
  })

  // A binding at another path than the version's would be refused at the
  // first read, a type other than the mapping's would print a count as
  // `3.00` or refuse an hour's quarter, and a field declared never null
  // that the version lets go unanswered would refuse a valid visit's final
  // render. So each answer is read at its path -- a group's child by the
  // group's key and its own, a ticked box and a matrix row by its member,
  // the findings' rows by the repeater's path -- typed as the mapping reads
  // its kind, and never null only where the version proves it answered.
  test('declares each answer the report prints, typed by the mapping and bound to its path in the version', () => {
    const { report } = generatedFrom(generate(SITE_VISIT_V2, VISIT))
    const contract = (fields: readonly { readonly id: string; readonly type: string; readonly label: string; readonly nullable: boolean; readonly scale?: number; readonly form?: object }[] | undefined) =>
      fields?.map(({ id, type, label, nullable, scale, form }) => [id, type, label, nullable, scale, form])
    expect(report.datasets.header?.form).toEqual({ kind: 'submission' })
    expect(contract(report.datasets.header?.fields)).toEqual([
      ['site', 'string', 'Objekt', false, undefined, { path: 'site' }],
      ['visitedOn', 'date', 'Besucht am', false, undefined, { path: 'visitedOn' }],
      ['arrivedAt', 'instant', 'Angekommen um', true, undefined, { path: 'arrivedAt' }],
      ['startedAt', 'string', 'Begonnen um', true, undefined, { path: 'startedAt' }],
      ['outcome', 'string', 'Ergebnis', true, undefined, { path: 'outcome' }],
      ['name', 'string', 'Name', true, undefined, { path: 'inspector.name' }],
      ['licence', 'string', 'Ausweis', true, undefined, { path: 'inspector.licence' }],
      ['checks_roof', 'boolean', 'Geprüft: Dach', true, undefined, { path: 'checks', member: 'roof' }],
      ['checks_wiring', 'boolean', 'Geprüft: Elektrik', true, undefined, { path: 'checks', member: 'wiring' }],
      ['checks_boiler', 'boolean', 'Geprüft: Heizkessel', true, undefined, { path: 'checks', member: 'boiler' }],
      ['condition_safety', 'string', 'Zustand: Sicherheit', true, undefined, { path: 'condition', member: 'safety' }],
      ['condition_cleanliness', 'string', 'Zustand: Sauberkeit', true, undefined, { path: 'condition', member: 'cleanliness' }],
      ['summary', 'string', 'Zusammenfassung', true, undefined, { path: 'summary' }],
    ])
    expect(report.datasets.detail?.form).toEqual({ kind: 'repeater', repeater: 'findings' })
    expect(contract(report.datasets.detail?.fields)).toEqual([
      ['ref', 'string', 'Nr.', true, undefined, { path: 'ref' }],
      ['area', 'string', 'Bereich', true, undefined, { path: 'area' }],
      ['severity', 'string', 'Dringlichkeit', true, undefined, { path: 'severity' }],
      ['hours', 'decimal', 'Stunden', true, 2, { path: 'hours' }],
      ['parts', 'integer', 'Teile', true, undefined, { path: 'parts' }],
      ['fixed', 'boolean', 'Vor Ort behoben', true, undefined, { path: 'fixed' }],
    ])
  })

  // A draft that named no version, or one by a hash it did not compute,
  // could not be reviewed against a later version (P13); one that named
  // the form by the report's id would send the review to another form. So
  // the provenance names the form by the version's own id and the version
  // by the hash the bridge computed of the document it validated, whatever
  // the report is called.
  test('names the version it was made from, by the form’s id and the hash computed of it', () => {
    const { report } = generatedFrom(generate(SITE_VISIT_V2, { ...VISIT, id: 'visit-draft' }))
    expect(report.id).toBe('visit-draft')
    expect(report.provenance).toEqual({ kind: 'form', form: 'site-visit', formHash: schemaHash(SITE_VISIT_V2) })
  })

  // What was assumed is listed, in model order, each by a code and the
  // field's place in the form: the two fields the version proves always
  // there, a time of day printed as stored, ticked boxes and a tick box
  // printed as boxes, and each number's reading.
  test('lists what it assumed, in model order, by code and place', () => {
    const { notes } = generatedFrom(generate(SITE_VISIT_V2, VISIT))
    expect(notesOf(notes)).toEqual([
      'present-always /form/model/fields/0',
      'present-always /form/model/fields/1',
      'time-as-text /form/model/fields/3',
      'yes-no-box /form/model/fields/6',
      'number-decimal /form/model/fields/8/fields/3',
      'number-integer /form/model/fields/8/fields/4',
      'yes-no-box /form/model/fields/8/fields/5',
    ])
    for (const note of notes) expect(note.message.length).toBeGreaterThan(20)
  })

  // A note ends up where a host shows or logs it, and a label is the
  // form's words, which may name a person or a place: a note that quoted
  // one would carry the form's text out with it. In every language the
  // site visit is drafted in, its own and the default's fallback among
  // them, no note quotes a message of its catalogues.
  test('quotes no label of the form, in any language it is drafted in', () => {
    const catalogues = (SITE_VISIT_V2 as { readonly i18n: { readonly messages: Readonly<Record<string, Readonly<Record<string, string>>>> } }).i18n.messages
    const messages = Object.values(catalogues).flatMap((catalogue) => Object.values(catalogue))
    for (const locale of ['de-CH', 'en', 'fr-CH']) {
      const { notes } = generatedFrom(generate(SITE_VISIT_V2, { ...VISIT, locale }))
      const quoted = notes.flatMap((note) => messages.filter((message) => note.message.includes(message)).map((message) => `${note.code}: ${message}`))
      expect(quoted, locale).toEqual([])
    }
  })
})

/** `value` with every object's keys in the reverse order, at every depth: the same JSON to formancy, another object to JavaScript. */
function reversed(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reversed)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(Object.entries(value).reverse().map(([key, inner]) => [key, reversed(inner)]))
}

describe('generateReport is deterministic', () => {
  // A draft that changed with the order a host's store hands the form's
  // keys over in would give two reports of one version, and a reviewer
  // could not tell which was made from it. The same version and options
  // give the same report, to its hash, with every key of the form and the
  // options in another order: the version is named by formancy's canonical
  // hash, and the report is walked from the model's order alone.
  test('gives the same report, to its hash, from the same version and options', () => {
    const first = generatedFrom(generate(SITE_VISIT_V2, VISIT))
    const again = generatedFrom(generate(reversed(SITE_VISIT_V2), reversed(VISIT)))
    expect(reportHash(again.report)).toBe(reportHash(first.report))
    expect(again).toEqual(first)
  })

  // Version 2 rewrote one option's label, which the report does not hold:
  // a choice's label is read from each submission's own version when it is
  // printed (0042). So the two drafts are the same report but for the
  // version each names, and their hashes differ only because of that.
  test('gives a version that differs only in what the report does not hold the same report, naming that version', () => {
    const one = generatedFrom(generate(SITE_VISIT_V1, VISIT))
    const two = generatedFrom(generate(SITE_VISIT_V2, VISIT))
    expect(schemaHash(SITE_VISIT_V1)).not.toBe(schemaHash(SITE_VISIT_V2))
    expect(reportHash(one.report)).not.toBe(reportHash(two.report))
    expect({ ...one.report, provenance: two.report.provenance }).toEqual(two.report)
    expect(one.notes).toEqual(two.notes)
  })

  // Spec 5 adds what helps a person fill a form in, and nothing an answer
  // holds (formancy.ai 0201). A draft that printed help text or an example
  // would print the form's words as answers, and one that took a default
  // or a rule's message as proof of an answer would declare a field never
  // null that a person can leave empty. So version 2 at spec 5, with all
  // of it, is the same report but for the version it names.
  test('gives a version that adds only what spec 5 adds for filling it in the same report, naming that version', () => {
    const two = generatedFrom(generate(SITE_VISIT_V2, VISIT))
    const five = generatedFrom(generate(atSpec5(SITE_VISIT_V2), VISIT))
    expect({ ...two.report, provenance: five.report.provenance }).toEqual(five.report)
    expect(five.report.provenance).toEqual({ kind: 'form', form: 'site-visit', formHash: schemaHash(atSpec5(SITE_VISIT_V2)) })
    expect(two.notes).toEqual(five.notes)
  })
})

/** What spec 5 adds to the site visit's fields, by key: help text, an example, autofill, defaults and a shuffled order (formancy.ai 0194 to 0200). */
const SPEC_5_FIELDS: Readonly<Record<string, Record<string, unknown>>> = {
  site: { description: 'Street, number and town', placeholder: 'Hauptstrasse 12, 3011 Bern', autocomplete: 'street-address', default: 'Bern' },
  outcome: { shuffle: true, default: 'pass' },
  inspector: { description: 'Who visited' },
  name: { autocomplete: 'name' },
  checks: { shuffle: true, default: ['roof'] },
  findings: { description: 'One row a finding' },
  hours: { placeholder: '1.5', default: 1 },
  fixed: { default: false },
}

/** `form` at spec 5, with what `SPEC_5_FIELDS` adds, the boiler an option chosen on its own and kept in place, and a rule that says its own message. */
function atSpec5(form: Readonly<Record<string, unknown>>): Record<string, unknown> {
  type Def = Readonly<Record<string, unknown>> & { readonly key: string; readonly fields?: readonly Def[]; readonly options?: readonly Readonly<Record<string, unknown>>[] }
  const added = (def: Def): Def => ({
    ...def,
    ...SPEC_5_FIELDS[def.key],
    ...(def.fields === undefined ? {} : { fields: def.fields.map(added) }),
    ...(def.key === 'checks' && def.options !== undefined ? { options: def.options.map((option) => (option['value'] === 'boiler' ? { ...option, exclusive: true, keepPlace: true } : option)) } : {}),
  })
  const model = form['model'] as { readonly fields: readonly Def[] }
  return { ...form, specVersion: '5', model: { fields: model.fields.map(added) }, logic: { rules: [{ target: 'findings[].hours', kind: 'validate', cel: 'value <= 24.0', code: 'longerThanADay', message: 'A visit lasts a day at most' }] } }
}

describe('generateReport, its labels', () => {
  // Labels are the version's, in the language asked for, and in the
  // form's default language where the version has no catalogue for it,
  // which is said: a French report of a form in English and German would
  // otherwise print English labels unannounced.
  test('reads labels in the locale asked for, and says where the version has none in it', () => {
    const english = generatedFrom(generate(SITE_VISIT_V2, { ...VISIT, locale: 'en' }))
    expect(english.report.datasets.header?.fields.map((field) => field.label).slice(0, 3)).toEqual(['Site', 'Visited on', 'Arrived at'])
    expect(notesOf(english.notes).filter((note) => note.startsWith('labels'))).toEqual([])
    const french = generatedFrom(generate(SITE_VISIT_V2, { ...VISIT, locale: 'fr-CH' }))
    expect(french.report.locale).toBe('fr-CH')
    expect(french.report.datasets.header?.fields.map((field) => field.label).slice(0, 3)).toEqual(['Site', 'Visited on', 'Arrived at'])
    expect(notesOf(french.notes)[0]).toBe('labels-default-locale /form/i18n')
    // The default locale is the form's own string, which formancy bounds by length alone: said as what it is, never quoted.
    const named = formOf([{ key: 'a', type: 'text', label: { $t: 'a' } }], { i18n: { defaultLocale: 'Erika Mustermann', messages: { 'Erika Mustermann': { a: 'A' } } } })
    const { notes } = generatedFrom(generate(named, { id: 'r', locale: 'en' }))
    expect(notesOf(notes)).toEqual(['labels-default-locale /form/i18n'])
    expect(JSON.stringify(notes)).not.toContain('Erika')
  })

  // A title of white space, which formancy's length rule admits, would
  // head the draft with nothing, a warning in the problems pane of every
  // draft made of it: titled by the form's id instead, said. A title of
  // a character no font draws would be refused only when it printed, and
  // is refused here; its white space, a tab among it, is one space.
  test('titles a draft of a blank title by the form’s id, and refuses one no font draws', () => {
    const blank = generatedFrom(generate(formOf([{ key: 'a', type: 'text' }], { title: ' \t ' }), { id: 'r', locale: 'en' }))
    expect([blank.report.title, blank.report.regions.reportHeader.map(said)]).toEqual(['site-visit', ['site-visit']])
    expect(notesOf(blank.notes)[0]).toBe('untitled /form/title')
    const spaced = generatedFrom(generate(formOf([{ key: 'a', type: 'text' }], { title: 'Site\tvisit ' }), { id: 'r', locale: 'en' }))
    expect([spaced.report.title, spaced.report.regions.reportHeader.map(said)]).toEqual(['Site visit', ['Site visit']])
    expect(generationRefusals(generate(formOf([{ key: 'a', type: 'text' }], { title: 'Site\u0000visit' }), { id: 'r', locale: 'en' }))).toEqual(['label-unprintable /form/title'])
  })

  // A layout the version names arranges the form for filling it in --
  // sections, tabs, a print layout that leaves a field out -- and the
  // draft follows none of them: it is in model order, which is said, so a
  // reader who knows the form by its layout is not surprised.
  test('follows no layout the version names, and says so', () => {
    const form = formOf([{ key: 'a', type: 'text', label: 'A' }, { key: 'b', type: 'text', label: 'B' }], { layouts: [{ name: 'print', nodes: [{ kind: 'field', path: 'b' }, { kind: 'field', path: 'a' }] }] })
    const { report, notes } = generatedFrom(generate(form, { id: 'r', locale: 'en' }))
    expect(report.regions.body.map(said)).toEqual(['A: {field}', 'B: {field}'])
    expect(notesOf(notes)).toEqual(['layouts-not-followed /form/layouts'])
  })

  // A field formancy lets go unlabelled, or labelled with a blank, printed
  // with nothing before its value, could not be told from the next: it is
  // labelled by its key, said, so the person knows the label is no word
  // the form chose.
  test('labels an unlabelled field by its key, and says so', () => {
    const outcome = generatedFrom(generate(formOf([{ key: 'ref', type: 'text' }, { key: 'note', type: 'text', label: { $t: 'blank' } }], { i18n: { defaultLocale: 'en', messages: { en: { blank: ' ' } } } }), { id: 'r', locale: 'en' }))
    expect(outcome.report.datasets.header?.fields.map((field) => field.label)).toEqual(['ref', 'note'])
    expect(notesOf(outcome.notes)).toEqual(['unlabelled /form/model/fields/0', 'unlabelled /form/model/fields/1'])
  })

  // A colon after every label would print `Ort::` and `Dach dicht?:`:
  // after one that already ends in a colon or asks a question, a space.
  test('puts a colon after a label, unless it ends in one or in a question mark', () => {
    const { report } = generatedFrom(generate(formOf([{ key: 'a', type: 'text', label: 'Ort:' }, { key: 'b', type: 'text', label: 'Dach dicht?' }, { key: 'c', type: 'text', label: 'Ort' }]), { id: 'r', locale: 'de-CH' }))
    expect(report.regions.body.map(said)).toEqual(['Ort: {field}', 'Dach dicht? {field}', 'Ort: {field}'])
  })
})

describe('generateReport, its options', () => {
  // The options say what the report is, and nothing else: an id the format
  // takes, a locale it reads, and a detail that is a repeater's path or one
  // row per submission. A hash among them would be a version named by the
  // host rather than computed (0042), and is refused as an option the
  // generator does not take.
  test('refuses options the format does not take, and anything else handed over with them', () => {
    const refused = (options: unknown) => generationRefusals(generate(SITE_VISIT_V2, options))
    expect(refused({ ...VISIT, id: 'Site Visit' })).toEqual(['invalid-input /options/id'])
    expect(refused({ ...VISIT, locale: 'de_CH' })).toEqual(['invalid-input /options/locale'])
    expect(refused({ ...VISIT, locale: 7 })).toEqual(['invalid-input /options/locale'])
    expect(refused({ ...VISIT, formHash: schemaHash(SITE_VISIT_V2) })).toEqual(['invalid-input /options/formHash'])
    expect(refused({ locale: 'de-CH' })).toEqual(['invalid-input /options/id'])
    expect(refused({ ...VISIT, detail: 'findings' })).toEqual(['invalid-input /options/detail'])
    expect(refused({ ...VISIT, detail: { kind: 'repeater', repeater: 'findings[]' } })).toEqual(['invalid-input /options/detail/repeater'])
    expect(refused({ ...VISIT, detail: { kind: 'submission' } })).toEqual(['invalid-input /options/detail/kind'])
    expect(refused('visit')).toEqual(['invalid-input /options'])
  })

  // The detail is a repeater of the version, found at its path as a
  // submission's rows are: a path the version holds nothing at, or holds
  // no repeater at, is refused as a read of that version would be, never
  // guessed from a name.
  test('refuses a detail the version holds no repeater at, as a read would', () => {
    expect(generationRefusals(generate(SITE_VISIT_V2, { ...VISIT, detail: { kind: 'repeater', repeater: 'befunde' } }))).toEqual(['version-lacks-field /options/detail/repeater'])
    expect(generationRefusals(generate(SITE_VISIT_V2, { ...VISIT, detail: { kind: 'repeater', repeater: 'inspector' } }))).toEqual(['version-retypes-field /options/detail/repeater'])
    // A generator's option is no report a review could lift a refusal of: the refusal names none (0048).
    const refusal = generate(SITE_VISIT_V2, { ...VISIT, detail: { kind: 'repeater', repeater: 'befunde' } })
    expect(refusal.ok ? '' : refusal.errors[0]?.message).not.toContain('reviewFormVersion')
  })

  // A form formancy's validator refuses is no version, and a report made
  // from it would print by rules formancy never accepted.
  test('refuses a form that is no version, as a read does', () => {
    expect(generationRefusals(generate({ ...SITE_VISIT_V2, specVersion: '6' }, VISIT))).toEqual(['unsupported-spec-version /form/specVersion'])
    expect(generationRefusals(generate(formOf([{ key: 'a', type: 'text' }, { key: 'a', type: 'text' }]), VISIT))).toEqual(['invalid-form /form/model/fields/1/key'])
    expect(generationRefusals(generate(Object.defineProperty({}, 'id', { get: () => 'x', enumerable: true }), VISIT))).toEqual(['not-data /form/id'])
  })
})

describe('generateReport, its notes', () => {
  // A code NOTE_CODES lists that no form is given is vocabulary a host
  // would handle for nothing, and a code it does not list one a host
  // cannot handle at all: between them, two forms are given every code
  // and no other. What is said of the whole form comes first, in the
  // list's order, so a host shows it before what is said of a field. And
  // since they are given every code, no note of theirs quotes a word of
  // their labels or headings, which all start with a mark no note's own
  // words hold: a note that quoted one would carry the form's text into a
  // log.
  test('are each code NOTE_CODES lists, what is said of the form first, quoting no label', () => {
    const marked = (label: string): string => `§${label}`
    let deep: unknown[] = [{ key: 'leaf', type: 'text', label: marked('Leaf') }]
    for (let level = 5; level >= 1; level -= 1) deep = [{ key: `g${level}`, type: 'group', label: marked(`G${level}`), fields: deep }]
    const wide = Array.from({ length: 7 }, (_, index) => ({ key: `c${index}`, type: 'text', label: marked(`C${index}`) }))
    const form = formOf(
      [
        {
          key: 'p',
          type: 'page',
          label: marked('Page'),
          fields: [
            { key: 'intro', type: 'static', label: marked('Hi') },
            { key: 'photo', type: 'file', label: marked('Photo') },
            { key: 'rows', type: 'repeater', label: marked('Rows'), fields: [{ key: 'r', type: 'text', label: marked('R') }] },
            { key: 'wide', type: 'repeater', label: marked('Wide'), fields: wide },
            { key: 'count', type: 'number', label: marked('Count'), step: 1 },
            { key: 'hours', type: 'number', label: marked('Hours') },
            { key: 'done', type: 'checkbox', label: marked('Done') },
            { key: 'at', type: 'time', label: marked('At') },
            { key: 'notes', type: 'richtext', label: marked('Notes') },
            { key: 'source', type: 'hidden', label: marked('Source') },
            { key: 'region', type: 'select', label: marked('Region'), optionsSource: 'regions' },
            { key: 'free', type: 'radio', label: marked('Free') },
            { key: 'nameless', type: 'text' },
            { key: 'consent', type: 'checkbox', label: marked('I agree. '.repeat(30)) },
            { key: 'site', type: 'text', label: marked('Site'), required: true },
            ...deep,
          ],
        },
      ],
      { title: ' ', i18n: { defaultLocale: 'en', messages: { en: {} } }, layouts: [{ name: 'web', nodes: [{ kind: 'field', path: 'site' }] }] },
    )
    const first = generatedFrom(generate(form, { id: 'r', locale: 'fr-CH', detail: { kind: 'repeater', repeater: 'wide' } })).notes
    expect(first.slice(0, 5).map((note) => note.code)).toEqual(['untitled', 'labels-default-locale', 'layouts-not-followed', 'pages-not-breaks', 'table-landscape'])
    // A catalogue in the report's language that lacks one message: that label alone is the default's.
    const partly = formOf([{ key: 'a', type: 'text', label: { $t: 'a' } }], { i18n: { defaultLocale: 'en', messages: { en: { a: marked('A') }, 'fr-CH': {} } } })
    const second = generatedFrom(generate(partly, { id: 'r', locale: 'fr-CH' })).notes
    const notes = [...first, ...second]
    expect([...new Set(notes.map((note) => note.code))].sort()).toEqual([...NOTE_CODES].sort())
    expect(notes.filter((note) => note.message.includes(marked(''))).map((note) => note.code)).toEqual([])
  })
})
