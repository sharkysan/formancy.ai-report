import { FIELD_TYPES as REPORT_TYPES } from '@formancy/report-spec'
import type { FieldType, ReportDefinition } from '@formancy/report-spec'
import { FIELD_TYPES as FORM_KINDS, schemaHash } from '@formancy/spec'
import { describe, expect, test } from 'vitest'
import readme from '../README.md?raw'
import { KINDS } from './kinds.js'
import { answers, field, formOf, headerOf, read, readData, refusals, reportOf, rowsOf } from './test-support.js'

/**
 * The mapping from formancy's field kinds to the report's field types,
 * decided once (`kinds.ts`, 0042): each kind read as the type it maps to,
 * and every other pairing refused per render, against the version that
 * collected the submission, naming the field and the version's hash.
 */

const CATALOGUE = {
  defaultLocale: 'en',
  messages: {
    en: { high: 'High', low: 'Low', taste: 'Taste', good: 'Good', poor: 'Poor', roof: 'Roof' },
    'de-CH': { high: 'Hoch', low: 'Niedrig', taste: 'Geschmack', good: 'Gut', poor: 'Schlecht', roof: 'Dach' },
  },
}
const severity = { key: 'severity', type: 'radio', options: [{ value: 'high', label: { $t: 'high' } }, { value: 'low', label: { $t: 'low' } }] }

describe('the mapping', () => {
  // A kind the table does not name would be read by whatever branch
  // happens to catch it; every kind the pinned formancy has is named, as
  // read, refused or holding no answer.
  test('names every kind formancy has', () => {
    expect(Object.keys(KINDS).sort()).toEqual([...FORM_KINDS].sort())
  })

  // Text is printed as stored: a blank answer is a blank, which a person
  // typed, and an answer the submission does not have -- hidden and
  // pruned, or never asked -- is null, which prints as nothing. A time of
  // day has no report type and prints as formancy stores it. Read any
  // other way, a typed blank would vanish and a missing answer print as
  // a blank someone typed.
  test('reads text, a long text, a hidden value and a time of day as strings, blank as blank and absent as null', () => {
    const form = formOf([{ key: 'name', type: 'text' }, { key: 'notes', type: 'textarea' }, { key: 'ref', type: 'hidden' }, { key: 'at', type: 'time' }])
    const report = reportOf({ header: answers(field('name', 'string', 'name'), field('notes', 'string', 'notes'), field('ref', 'string', 'ref'), field('at', 'string', 'at')) })
    expect(headerOf(read(report, form, { name: 'Anna Schär', notes: '', ref: 'INS-7', at: '09:50' }))).toEqual({ name: 'Anna Schär', notes: '', ref: 'INS-7', at: '09:50' })
    expect(headerOf(read(report, form, {}))).toEqual({ name: null, notes: null, ref: null, at: null })
    expect(refusals(read(report, form, { at: '9:50' }))).toEqual(['invalid-answer /submission/data/at'])
    expect(refusals(read(report, form, { name: 7, ref: { id: 7 } }))).toEqual(['invalid-answer /submission/data/name', 'invalid-answer /submission/data/ref'])
  })

  // Formancy Data writes a decimal into a form as text under a pattern, and
  // a host may keep one in a hidden field: read as a decimal or an integer,
  // its string is handed over and held to the type's one spelling, so the
  // remedy the number rule names reads, and a text that is no number is
  // refused rather than printed as one.
  test('reads a text or a hidden value as an integer or a decimal, held to its one spelling', () => {
    const form = formOf([{ key: 'total', type: 'hidden' }, { key: 'count', type: 'text' }])
    const report = reportOf({ header: answers(field('total', 'decimal', 'total', { scale: 2 }), field('count', 'integer', 'count')) })
    expect(headerOf(read(report, form, { total: '99999999999999.99', count: '12' }))).toEqual({ total: '99999999999999.99', count: '12' })
    expect(refusals(read(report, form, { total: '1,50', count: '1.0' }))).toEqual(['invalid-answer /submission/data/total', 'invalid-answer /submission/data/count'])
  })

  // A rich text answer is formatting around words; a report prints the
  // words, through formancy's own reading, so that nothing here parses
  // its markup a second way and prints its asterisks.
  test('reads a rich text as its plain text', () => {
    const form = formOf([{ key: 'notes', type: 'richtext' }])
    const report = reportOf({ header: answers(field('notes', 'string', 'notes')) })
    expect(headerOf(read(report, form, { notes: '**Dringend:** die Rinne' }))).toEqual({ notes: 'Dringend: die Rinne' })
  })

  // A number is a double in a submission and exact digits in a report: a
  // count by whole steps is an integer, hours by quarters a decimal, and
  // what binary arithmetic made, or a double past 2^53 that has lost its
  // last digits, is refused, never rounded (the number rule). An integer
  // field over a number that steps through fractions -- by its step, or
  // from a fractional least value -- would refuse half its answers one by
  // one; the version says so once.
  test('reads a number as an integer or a decimal by the number rule', () => {
    const form = formOf([{ key: 'parts', type: 'number', min: 0, step: 1 }, { key: 'hours', type: 'number', step: 0.25 }, { key: 'free', type: 'number' }, { key: 'offset', type: 'number', min: 0.5, step: 1 }])
    const report = reportOf({ header: answers(field('parts', 'integer', 'parts'), field('hours', 'decimal', 'hours', { scale: 2 }), field('free', 'decimal', 'free')) })
    expect(headerOf(read(report, form, { parts: 3, hours: 1.25, free: 1234.5 }))).toEqual({ parts: '3', hours: '1.25', free: '1234.5' })
    expect(refusals(read(report, form, { free: 0.1 + 0.2 }))).toEqual(['inexact-number /submission/data/free'])
    expect(refusals(read(report, form, { free: 10000000000000001 }))).toEqual(['inexact-number /submission/data/free'])
    expect(refusals(read(report, form, { parts: '3' }))).toEqual(['invalid-answer /submission/data/parts'])
    const counted = reportOf({ header: answers(field('hours', 'integer', 'hours')) })
    expect(refusals(read(counted, form, { hours: 2 }))).toEqual(['version-retypes-field /datasets/header/fields/0/form'])
    const offset = reportOf({ header: answers(field('offset', 'integer', 'offset')) })
    expect(refusals(read(offset, form, { offset: 1.5 }))).toEqual(['version-retypes-field /datasets/header/fields/0/form'])
    const free = reportOf({ header: answers(field('free', 'integer', 'free')) })
    expect(headerOf(read(free, form, { free: 12 }))).toEqual({ free: '12' })
    expect(refusals(read(free, form, { free: 12.5 }))).toEqual(['inexact-number /submission/data/free'])
    expect(refusals(read(free, form, { free: 2 ** 60 }))).toEqual(['inexact-number /submission/data/free'])
  })

  // A tick box never answered is neither yes nor no: printed as no, a
  // question nobody reached would say something was not done.
  test('reads a tick box as a boolean, and null as null', () => {
    const form = formOf([{ key: 'fixed', type: 'checkbox' }])
    const report = reportOf({ header: answers(field('fixed', 'boolean', 'fixed')) })
    expect([true, false, null].map((fixed) => headerOf(read(report, form, { fixed }))['fixed'])).toEqual([true, false, null])
    expect(refusals(read(report, form, { fixed: 'true' }))).toEqual(['invalid-answer /submission/data/fixed'])
  })

  // A choice prints the label its option has in the version that
  // collected it, in the report's language (plan 12.2), or the value it
  // stores where the report asks for that; a value no option of the
  // version offers is an answer of another version, or none, and is said
  // once for the answer, however many fields read it.
  test('reads a choice as its label in the report’s language, or as its value', () => {
    const form = formOf([severity], { i18n: CATALOGUE })
    const report = reportOf({ header: answers(field('severity', 'string', 'severity'), field('code', 'string', 'severity', { read: 'value' })) })
    expect(headerOf(read(report, form, { severity: 'high' }))).toEqual({ severity: 'Hoch', code: 'high' })
    expect(headerOf(read(reportOf(report.datasets, 'en'), form, { severity: 'high' }))).toEqual({ severity: 'High', code: 'high' })
    // A locale the form has no catalogue for reads its default: formancy's resolvedLocale, not a guess here.
    expect(headerOf(read(reportOf(report.datasets, 'fr-CH'), form, { severity: 'low' }))).toEqual({ severity: 'Low', code: 'low' })
    expect(refusals(read(report, form, { severity: 'medium' }))).toEqual(['unknown-option /submission/data/severity'])
    const select = formOf([{ ...severity, type: 'select' }], { i18n: CATALOGUE })
    expect(headerOf(read(report, select, { severity: 'low' }))).toEqual({ severity: 'Niedrig', code: 'low' })
    // A select may offer nothing in the document, and formancy then takes
    // any value but an empty one (formancy.ai 0076, 0189): it has no label
    // to print, and its value prints when asked for, as formancy stored it.
    const bare = formOf([{ key: 'kind', type: 'select' }])
    expect(refusals(read(reportOf({ header: answers(field('kind', 'string', 'kind')) }), bare, { kind: 'x' }))).toEqual(['unresolved-label /submission/data/kind'])
    expect(headerOf(read(reportOf({ header: answers(field('kind', 'string', 'kind', { read: 'value' })) }), bare, { kind: 'x' }))).toEqual({ kind: 'x' })
  })

  // An empty string is no choice: formancy's engine refuses it for one
  // from 0.8.0 (formancy.ai 0189), as a value no control writes, and an
  // unanswered choice is null or absent. Printed as its value, it would
  // be a blank where a field declared never null refuses a final render;
  // so it is refused as the wrong shape, as text for a number is, whether
  // the field offers options, offers none or names a source.
  test('refuses an empty choice as no choice’s value', () => {
    const offered = formOf([severity], { i18n: CATALOGUE })
    const bare = formOf([{ key: 'severity', type: 'select' }])
    const sourced = formOf([{ key: 'severity', type: 'select', optionsSource: 'severities' }])
    const valued = reportOf({ header: answers(field('severity', 'string', 'severity', { read: 'value' })) })
    const labelled = reportOf({ header: answers(field('severity', 'string', 'severity')) })
    const outcome = (report: ReportDefinition, form: unknown) => {
      const got = read(report, form, { severity: '' }, { labels: () => 'Leer' })
      return got.ok ? headerOf(got) : refusals(got)
    }
    const refused = ['invalid-answer /submission/data/severity']
    expect([outcome(valued, offered), outcome(valued, bare), outcome(valued, sourced), outcome(labelled, sourced)]).toEqual([refused, refused, refused, refused])
  })

  // A select whose options a deployment resolves (formancy.ai 0077) has no
  // labels in the document: the host gives each, in the report's language,
  // and one it does not give -- no string, or a resolver that throws -- is
  // refused rather than printed as its value, as the Data provider refuses
  // an unseen lookup label (0016). The host's exception never escapes the
  // read, nor its words into a refusal: they may hold the value.
  test('reads a sourced choice’s label from the host, and refuses one it does not give', () => {
    const form = formOf([{ key: 'canton', type: 'select', optionsSource: 'cantons' }])
    const report = reportOf({ header: answers(field('canton', 'string', 'canton'), field('code', 'string', 'canton', { read: 'value' })) })
    const asked: unknown[] = []
    const labels = (option: { source: string; value: string; locale: string }) => {
      asked.push(option)
      return option.value === 'BE' ? 'Bern' : undefined
    }
    expect(headerOf(read(report, form, { canton: 'BE' }, { labels }))).toEqual({ canton: 'Bern', code: 'BE' })
    expect(asked).toEqual([{ source: 'cantons', value: 'BE', locale: 'de-CH' }])
    expect(refusals(read(report, form, { canton: 'ZH' }, { labels }))).toEqual(['unresolved-label /submission/data/canton'])
    expect(refusals(read(report, form, { canton: 'BE' }))).toEqual(['unresolved-label /submission/data/canton'])
    expect(refusals(read(report, form, { canton: 'BE' }, { labels: () => 7 as never }))).toEqual(['unresolved-label /submission/data/canton'])
    const throwing = read(report, form, { canton: 'BE' }, {
      labels: () => {
        throw new Error('no label for BE')
      },
    })
    expect(refusals(throwing)).toEqual(['unresolved-label /submission/data/canton'])
    if (!throwing.ok) expect(JSON.stringify(throwing.errors)).not.toContain('BE')
    expect(headerOf(read(reportOf({ header: answers(field('code', 'string', 'canton', { read: 'value' })) }), form, { canton: 'ZH' }))).toEqual({ code: 'ZH' })
  })

  // Dates are formancy's fixed shapes. Read loosely, a date in another
  // shape would print as whatever it parsed to, and a date and time with
  // an offset as another instant than the one formancy stored in UTC.
  test('reads a date as a date and a date and time as an instant', () => {
    const form = formOf([{ key: 'on', type: 'date' }, { key: 'at', type: 'datetime' }])
    const report = reportOf({ header: answers(field('on', 'date', 'on'), field('at', 'instant', 'at')) })
    expect(headerOf(read(report, form, { on: '2026-10-15', at: '2026-10-15T07:45:00Z' }))).toEqual({ on: '2026-10-15', at: '2026-10-15T07:45:00Z' })
    expect(refusals(read(report, form, { on: '15.10.2026', at: '2026-10-15T09:45:00+02:00' }))).toEqual(['invalid-answer /submission/data/on', 'invalid-answer /submission/data/at'])
  })

  // A matrix asks one question of each row, so a field reads one row,
  // which prints the label of the column chosen; a row left unanswered is
  // null. A row the version does not have is a field the version lacks.
  // The answer is read whole, as formancy's engine checks it: a row the
  // version has no row for, or a column it offers in no row, is another
  // version's answer even where the report reads another row of it.
  test('reads a matrix row as the label of the column chosen, the answer held whole to the version', () => {
    const form = formOf([{ key: 'rating', type: 'matrix', rows: [{ value: 'taste', label: { $t: 'taste' } }, { value: 'delivery', label: 'Delivery' }], options: [{ value: 'good', label: { $t: 'good' } }, { value: 'poor', label: { $t: 'poor' } }] }], { i18n: CATALOGUE })
    const report = reportOf({ header: answers(field('taste', 'string', 'rating', { member: 'taste' }), field('delivery', 'string', 'rating', { member: 'delivery', read: 'value' })) })
    expect(headerOf(read(report, form, { rating: { taste: 'good', delivery: 'poor' } }))).toEqual({ taste: 'Gut', delivery: 'poor' })
    expect(headerOf(read(report, form, { rating: { taste: 'poor' } }))).toEqual({ taste: 'Schlecht', delivery: null })
    expect(refusals(read(report, form, { rating: { taste: 'great' } }))).toEqual(['unknown-option /submission/data/rating'])
    expect(refusals(read(report, form, { rating: ['good'] }))).toEqual(['invalid-answer /submission/data/rating'])
    const tasted = reportOf({ header: answers(field('taste', 'string', 'rating', { member: 'taste' })) })
    expect(refusals(read(tasted, form, { rating: { taste: 'good', price: 'poor' } }))).toEqual(['unknown-answer /submission/data/rating'])
    expect(refusals(read(tasted, form, { rating: { taste: 'good', delivery: 'great' } }))).toEqual(['unknown-option /submission/data/rating'])
    expect(refusals(read(tasted, form, { rating: { taste: 'good', delivery: 2 } }))).toEqual(['invalid-answer /submission/data/rating'])
    const missing = reportOf({ header: answers(field('price', 'string', 'rating', { member: 'price' })) })
    expect(refusals(read(missing, form, {}))).toEqual(['version-lacks-field /datasets/header/fields/0/form'])
    expect(refusals(read(reportOf({ header: answers(field('rating', 'string', 'rating')) }), form, {}))).toEqual(['version-retypes-field /datasets/header/fields/0/form'])
  })

  // Ticked boxes are a list, and a report computes with yes and no: a
  // field reads one option, ticked or not. Nothing ticked is an answer,
  // `[]`, so every option is no; a list never answered is null. Options a
  // deployment resolves are not in the document, so which one a field
  // names cannot be checked: refused.
  test('reads a ticked box as a boolean per option', () => {
    const form = formOf([{ key: 'checks', type: 'selectboxes', options: [{ value: 'roof', label: { $t: 'roof' } }, { value: 'wiring', label: 'Wiring' }] }], { i18n: CATALOGUE })
    const report = reportOf({ header: answers(field('roof', 'boolean', 'checks', { member: 'roof' }), field('wiring', 'boolean', 'checks', { member: 'wiring' })) })
    expect(headerOf(read(report, form, { checks: ['wiring'] }))).toEqual({ roof: false, wiring: true })
    expect(headerOf(read(report, form, { checks: [] }))).toEqual({ roof: false, wiring: false })
    expect(headerOf(read(report, form, {}))).toEqual({ roof: null, wiring: null })
    expect(refusals(read(report, form, { checks: ['roof', 'pool'] }))).toEqual(['unknown-option /submission/data/checks'])
    expect(refusals(read(report, form, { checks: 'roof' }))).toEqual(['invalid-answer /submission/data/checks'])
    const sourced = formOf([{ key: 'checks', type: 'selectboxes', optionsSource: 'checks' }])
    expect(refusals(read(report, sourced, {}))).toEqual(['unsupported-field /datasets/header/fields/0/form', 'unsupported-field /datasets/header/fields/1/form'])
    expect(refusals(read(reportOf({ header: answers(field('pool', 'boolean', 'checks', { member: 'pool' })) }), form, {}))).toEqual(['version-lacks-field /datasets/header/fields/0/form'])
  })

  // What the bridge cannot print yet is refused by name, as the Data
  // provider refuses an image field (0016): a ranking until someone asks
  // for one (0.3.0's FB-Q8), a file and a signature until the host can
  // approve them as image assets (F7). Read as anything, each would print
  // as something it is not.
  test('refuses a ranking, a file and a signature, naming the field and the version', () => {
    const form = formOf([{ key: 'order', type: 'ranking', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }, { key: 'photo', type: 'file' }, { key: 'signed', type: 'signature', box: [300, 100] }])
    const report = reportOf({ header: answers(field('order', 'string', 'order'), field('photo', 'image', 'photo'), field('signed', 'image', 'signed')) })
    const outcome = read(report, form, {})
    expect(refusals(outcome)).toEqual(['unsupported-field /datasets/header/fields/0/form', 'unsupported-field /datasets/header/fields/1/form', 'unsupported-field /datasets/header/fields/2/form'])
    if (!outcome.ok) for (const error of outcome.errors) expect(error.message).toContain(schemaHash(form))
  })

  // A field the report reads that the version has as another kind prints
  // wrong whatever its answer: a text read as a date, a group read as a
  // string, static text that holds no answer, a member or a choice's
  // reading on a field that has none, a yes-or-no radio read as a
  // boolean. Refused for the version, naming the field and the version's
  // hash, before any answer is read.
  test('refuses a field whose kind in the version its type does not read', () => {
    const form = formOf([
      { key: 'on', type: 'text' },
      { key: 'note', type: 'static', label: 'Read me' },
      { key: 'inspector', type: 'group', fields: [{ key: 'name', type: 'text' }] },
      { key: 'items', type: 'repeater', fields: [{ key: 'x', type: 'text' }] },
      { key: 'paid', type: 'radio', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
    ])
    const report = reportOf({
      header: answers(field('on', 'date', 'on'), field('note', 'string', 'note'), field('inspector', 'string', 'inspector'), field('items', 'string', 'items'), field('name', 'string', 'inspector.name', { member: 'x' }), field('code', 'string', 'on', { read: 'value' }), field('paid', 'boolean', 'paid')),
    })
    const outcome = read(report, form, { on: '2026-10-15', inspector: { name: 'Anna' } })
    expect(refusals(outcome)).toEqual([0, 1, 2, 3, 4, 5, 6].map((index) => `version-retypes-field /datasets/header/fields/${index}/form`))
    if (!outcome.ok) {
      expect(outcome.errors[0]?.message).toContain(schemaHash(form))
      expect(outcome.errors[0]?.message).toContain('on')
    }
  })

  // A repeater's rows are a scope of their own: a header field read at a
  // row's path would find no answer in the submission's scope and print
  // null for every visit, so the version has no field there.
  test('refuses a header field read across into a repeater’s rows', () => {
    const form = formOf([{ key: 'findings', type: 'repeater', fields: [{ key: 'ref', type: 'text' }] }])
    expect(refusals(read(reportOf({ header: answers(field('ref', 'string', 'findings.ref')) }), form, { findings: [{ _id: 'r1', ref: 'F-01' }] }))).toEqual(['version-lacks-field /datasets/header/fields/0/form'])
  })

  // formancy's engine stores each kind in one shape; an answer in another
  // is no answer of that version, whatever it would print as, and is
  // refused where it stands rather than printed as something else.
  test('refuses an answer that is not what its kind stores', () => {
    const form = formOf([{ key: 'notes', type: 'richtext' }, severity, { key: 'rating', type: 'matrix', rows: [{ value: 'taste', label: 'Taste' }], options: [{ value: 'good', label: 'Good' }, { value: 'poor', label: 'Poor' }] }, { key: 'checks', type: 'selectboxes', options: [{ value: 'roof', label: 'Roof' }] }], { i18n: CATALOGUE })
    const report = reportOf({ header: answers(field('notes', 'string', 'notes'), field('severity', 'string', 'severity'), field('taste', 'string', 'rating', { member: 'taste' }), field('roof', 'boolean', 'checks', { member: 'roof' })) })
    expect(refusals(read(report, form, { notes: ['x'], severity: 1, rating: { taste: 2 }, checks: [true] }))).toEqual(['invalid-answer /submission/data/notes', 'invalid-answer /submission/data/severity', 'invalid-answer /submission/data/rating', 'invalid-answer /submission/data/checks'])
  })

  // A repeater's rows are read by the same table as the submission's
  // answers: read by another, a row's number could print a computed
  // double that the header would refuse.
  test('reads a repeater’s rows by the same mapping', () => {
    const form = formOf([{ key: 'findings', type: 'repeater', fields: [{ key: 'ref', type: 'text' }, severity, { key: 'hours', type: 'number' }] }], { i18n: CATALOGUE })
    const report = reportOf({ detail: rowsOf('findings', field('ref', 'string', 'ref'), field('severity', 'string', 'severity'), field('hours', 'decimal', 'hours')) })
    const data = readData(read(report, form, { findings: [{ _id: 'r1', ref: 'F-01', severity: 'high', hours: 1.1 }, { _id: 'r2', ref: 'F-02' }] }))
    expect(data.detail).toEqual([
      { ref: 'F-01', severity: 'Hoch', hours: '1.1' },
      { ref: 'F-02', severity: null, hours: null },
    ])
    expect(refusals(read(report, form, { findings: [{ _id: 'r1', hours: 0.1 * 3 }] }))).toEqual(['inexact-number /submission/data/findings/0/hours'])
  })

  // A group or a repeater that is null holds no answers and no rows, as
  // one never answered does: read as a record, it would refuse a
  // submission whose engine cleared a whole section.
  test('reads a group or a repeater that is null as unanswered', () => {
    const form = formOf([{ key: 'inspector', type: 'group', fields: [{ key: 'name', type: 'text' }] }, { key: 'findings', type: 'repeater', fields: [{ key: 'ref', type: 'text' }] }])
    const report = reportOf({ header: answers(field('inspector', 'string', 'inspector.name')), detail: rowsOf('findings', field('ref', 'string', 'ref')) })
    const data = readData(read(report, form, { inspector: null, findings: null }))
    expect([data.header, data.detail]).toEqual([{ inspector: null }, []])
  })

  // formancy's engine stores `[]` for ticked boxes none ticked and `{}`
  // for a matrix none answered from 0.8.0, never null (formancy.ai 0189),
  // but a submission stored before may hold null, and formancy does not
  // examine it again. Refused, every such submission a host kept would
  // stop printing; null is what an answer never given reads as.
  test('reads ticked boxes or a matrix that is null as unanswered', () => {
    const form = formOf([
      { key: 'checks', type: 'selectboxes', options: [{ value: 'roof', label: 'Roof' }] },
      { key: 'rating', type: 'matrix', rows: [{ value: 'taste', label: 'Taste' }], options: [{ value: 'good', label: 'Good' }, { value: 'poor', label: 'Poor' }] },
    ])
    const report = reportOf({ header: answers(field('roof', 'boolean', 'checks', { member: 'roof' }), field('taste', 'string', 'rating', { member: 'taste' })) })
    expect(headerOf(read(report, form, { checks: null, rating: null }))).toEqual({ roof: null, taste: null })
  })
})

/** The README's mapping table: each formancy kind it names, the report types it says the kind is read as, and its second column's words. */
function readmeTable(): ReadonlyMap<string, { readonly types: readonly string[]; readonly as: string }> {
  const lines = readme.split('\n')
  const start = lines.findIndex((line) => line.startsWith('| formancy kind | read as |'))
  const table = new Map<string, { readonly types: readonly string[]; readonly as: string }>()
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('|')) break
    const [kinds = '', as = ''] = line.split('|').slice(1).map((cell) => cell.trim())
    const types = [...as.matchAll(/`([a-z]+)`/g)].map((match) => match[1] as string)
    for (const [, kind] of kinds.matchAll(/`([a-z]+)`/g)) table.set(kind as string, { types, as })
  }
  return table
}

/** One field of each kind formancy has, at the key `x`, as the pinned validator accepts it. */
const OPTIONS = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]
const ONE_OF_EACH: { readonly [K in (typeof FORM_KINDS)[number]]: Readonly<Record<string, unknown>> } = {
  text: {},
  textarea: {},
  number: {},
  checkbox: {},
  select: { options: OPTIONS },
  radio: { options: OPTIONS },
  selectboxes: { options: OPTIONS },
  ranking: { options: OPTIONS },
  matrix: { rows: [{ value: 'a', label: 'A' }], options: OPTIONS },
  date: {},
  time: {},
  datetime: {},
  file: {},
  richtext: {},
  signature: { box: [300, 100] },
  hidden: {},
  static: { label: 'Read me' },
  group: { fields: [{ key: 'inner', type: 'text' }] },
  page: { fields: [{ key: 'inner', type: 'text' }] },
  repeater: { fields: [{ key: 'inner', type: 'text' }] },
}

describe('the README’s mapping table', () => {
  // The table in the README is what a host reads to bind a report, and it
  // restates `KINDS` by hand. Held here, pairing by pairing, against what
  // the bridge does with each: every formancy kind read at every report
  // type, read exactly where the table lists the type and refused
  // everywhere else, where a table that drifted would tell a host to bind
  // what the bridge refuses, or a widened kind print an answer as a type
  // nobody decided it maps to.
  test('names every kind once, and each is read as exactly the types it lists', () => {
    const table = readmeTable()
    expect([...table.keys()].sort()).toEqual([...FORM_KINDS].sort())
    for (const kind of FORM_KINDS) {
      const row = table.get(kind) as { readonly types: readonly string[]; readonly as: string }
      for (const type of REPORT_TYPES) {
        const member = kind === 'matrix' || kind === 'selectboxes' ? { member: 'a' } : {}
        const outcome = read(reportOf({ header: answers(field('x', type as FieldType, 'x', member)) }), formOf([{ key: 'x', type: kind, ...ONE_OF_EACH[kind] }]), {})
        const pairing = `${kind} as ${type}`
        if (row.types.includes(type)) {
          expect(outcome.ok ? headerOf(outcome) : refusals(outcome), pairing).toEqual({ x: null })
          continue
        }
        // A page is looked through, so no data path names it; what the table refuses is refused as unsupported.
        const code = kind === 'page' ? 'version-lacks-field' : row.as === 'refused' ? 'unsupported-field' : 'version-retypes-field'
        expect(refusals(outcome), pairing).toEqual([`${code} /datasets/header/fields/0/form`])
      }
    }
  })
})
