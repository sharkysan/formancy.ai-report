import { expectation, readPdf, SITE_VISIT_HIGH, SITE_VISIT_SUBMISSION_V2, SITE_VISIT_V2, verify } from '@formancy/report-corpus'
import type { PdfTextItem } from '@formancy/report-corpus'
import { renderPdf } from '@formancy/report-render-pdf'
import { resolveReport } from '@formancy/report-runtime'
import { schemaHash } from '@formancy/spec'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { FORMS_ERROR_CODES } from './errors.js'
import { formOf, generate, generatedFrom, readData, readMany, readOne, SUBMISSION } from './test-support.js'

/**
 * A generated report reads the submissions of the version it was made
 * from (0045): the binding it writes is the one report-forms reads by
 * (0042), so a submission of that version, read into the draft and
 * rendered, prints, proved on the PDF it produced (0003). And any form
 * formancy accepts gives a draft the runtime compiles and the bridge reads
 * a submission into, or a refusal by a code the bridge lists.
 */

/** Long enough for a render on a runner busy with other suites; one that hangs still fails. */
const TIMEOUT = 120_000

const VISIT = { id: 'site-visit', locale: 'de-CH', detail: { kind: 'repeater', repeater: 'findings' } } as const

/** The items printed on the line of `item`, on its page: their tops within half a point. */
const lineOf = (items: readonly PdfTextItem[], item: PdfTextItem): string => items.filter((other) => Math.abs(other.top - item.top) < 0.5).map((other) => other.text.trim()).join(' ')

describe('a generated report reads its version’s submissions', () => {
  // A draft whose bindings the bridge read otherwise than it wrote them
  // would print nothing, or the wrong answer, under each label, and no
  // check of the draft alone would see it. Generated from version 2, the
  // draft reads a visit version 2 collected and prints it: each answer on
  // its line, an unanswered one as nothing, the ticked boxes as boxes, the
  // findings one a row with version 2's labels, the hours to the places
  // their step has, and the pages counted; the manifest names the version
  // by the hash the bridge computed.
  test('prints a version-2 visit read into the draft made from version 2', async () => {
    const { report } = generatedFrom(generate(SITE_VISIT_V2, VISIT))
    const data = readData(readOne(report, { form: SITE_VISIT_V2, submission: SITE_VISIT_SUBMISSION_V2 }))
    const resolution = resolveReport(report, data, { mode: 'final', creationDate: '2026-10-22T08:00:00Z', timeZone: 'Europe/Zurich' })
    if (!resolution.ok) throw new Error(`refused: ${JSON.stringify(resolution.errors)}`)
    expect(resolution.manifest.source).toEqual({ provider: 'formancy-form', submissions: [{ id: SITE_VISIT_SUBMISSION_V2.id, form: 'site-visit', formHash: schemaHash(SITE_VISIT_V2) }] })

    const pdf = await readPdf(await renderPdf(resolution.document, { maxPages: 10 }))
    const stated = {
      maxPagesExpected: 1,
      exactText: ['Site visit', 'Objekt: Bahnhofplatz 1, 3011 Bern', 'Besucht am: 21.10.2026', 'Ergebnis: Nicht bestanden', 'Name: Marc Rüegg', 'Ausweis: BE-5120', 'Dach: [ ]', 'Elektrik: [x]', 'Heizkessel: [ ]', 'Sicherheit: Schlecht', 'Zusammenfassung: Die Elektrik ist sofort zu prüfen.', '1 / 1'],
    }
    expect(verify({ id: 'site-visit-generated', title: 'A version-2 visit in the draft made from version 2', document: resolution.document, maxPages: 10, expect: expectation(resolution.document, stated) }, pdf)).toEqual([])
    const items = pdf.pages.flatMap((page) => page.items)
    const rows = ['F-01', 'F-02', 'F-03'].map((ref) => lineOf(items, items.find((item) => item.text.trim() === ref) as PdfTextItem))
    expect(rows).toEqual([`F-01 Dachrinne Nord ${SITE_VISIT_HIGH.v2} 1.50 0 [x]`, 'F-02 Heizraum Niedrig 0.25 1 [ ]', `F-03 Treppenhaus ${SITE_VISIT_HIGH.v2} 2.00 2 [ ]`])
    // An answer the visit left out prints nothing after its label.
    for (const label of ['Begonnen um:', 'Sauberkeit:']) expect(items.some((item) => item.text.trim() === label), label).toBe(true)
  }, TIMEOUT)
})

/** A field of the model, before its key is given. */
interface Node {
  readonly type: string
  readonly fields?: readonly Node[]
  readonly [more: string]: unknown
}

/**
 * What every label of these forms starts with, and no word of the
 * generator's own does: a note that held it would be quoting the form.
 */
const MARK = '§'

const option = (value: string) => ({ value, label: `${MARK}Option ${value}` })
const OPTIONS = [option('a'), option('b c'), option('d-e')]

/** One leaf of each shape the generator reads differently, required or not, and the answer a visit gives it. */
const SHAPES: readonly { readonly node: Node; readonly answer?: unknown }[] = [
  { node: { type: 'text', label: `${MARK}Text` }, answer: 'Wert' },
  { node: { type: 'textarea' }, answer: 'Lang' },
  { node: { type: 'hidden' }, answer: 'Quelle' },
  { node: { type: 'richtext', label: `${MARK}Notes` }, answer: 'Notiz' },
  { node: { type: 'time' }, answer: '08:30' },
  { node: { type: 'number', step: 1, min: 0 }, answer: 3 },
  { node: { type: 'number', step: 0.05 }, answer: 1.25 },
  { node: { type: 'number' }, answer: 2.5 },
  { node: { type: 'checkbox', label: `${MARK}Done?` }, answer: true },
  { node: { type: 'date' }, answer: '2026-10-22' },
  { node: { type: 'datetime' }, answer: '2026-10-22T08:00:00Z' },
  { node: { type: 'select', options: OPTIONS }, answer: 'b c' },
  { node: { type: 'select', optionsSource: 'regions' }, answer: 'north' },
  { node: { type: 'radio' }, answer: 'frei' },
  { node: { type: 'selectboxes', options: OPTIONS }, answer: ['a', 'd-e'] },
  { node: { type: 'matrix', rows: OPTIONS, options: OPTIONS }, answer: { a: 'd-e', 'b c': 'a', 'd-e': 'b c' } },
  { node: { type: 'static', label: `${MARK}Read me` } },
  { node: { type: 'file' } },
  { node: { type: 'ranking', options: OPTIONS } },
]

/** The answer a visit gives a leaf of `type` and these options, or none for a leaf that holds none. */
const answerOf = (node: Node): unknown => SHAPES.find(({ node: shape }) => shape.type === node.type && shape['step'] === node['step'] && shape['optionsSource'] === node['optionsSource'] && (shape.type !== 'number' || shape['min'] === node['min']))?.answer

const LEAF: fc.Arbitrary<Node> = fc
  .tuple(fc.constantFrom(...SHAPES.map(({ node }) => node)), fc.boolean())
  .map(([leaf, required]) => (required && leaf.type !== 'static' ? { ...leaf, required } : leaf))

/** A field `depth` containers deep at most, as formancy nests them: a group anywhere, a repeater in no repeater. */
function nodeOf(depth: number, inRows: boolean): fc.Arbitrary<Node> {
  const kinds = [LEAF]
  if (depth > 0) {
    kinds.push(fieldsOf(depth - 1, inRows).map((fields) => ({ type: 'group', label: 'Group', fields })))
    if (!inRows) kinds.push(fieldsOf(depth - 1, true).map((fields) => ({ type: 'repeater', label: 'Rows', fields })))
  }
  return fc.oneof(...kinds)
}

const fieldsOf = (depth: number, inRows: boolean): fc.Arbitrary<readonly Node[]> => fc.array(nodeOf(depth, inRows), { maxLength: 5 })

/** A model's fields: any of those, and pages of them, a page at the top alone, each labelled. */
const MODELS = fc.array(fc.oneof(nodeOf(3, false), fieldsOf(2, false).map((fields): Node => ({ type: 'page', fields }))), { maxLength: 6 })

/** `nodes` with a key each, unique in the form, and the paths of the repeaters among them, through groups. */
function keyed(nodes: readonly Node[], next = { key: 0 }, prefix = '', repeaters: string[] = []): { readonly fields: unknown[]; readonly repeaters: string[] } {
  const fields = nodes.map((node) => {
    const key = `k${next.key++}`
    const path = node.type === 'page' ? prefix : `${prefix}${key}`
    if (node.type === 'repeater') repeaters.push(path)
    const inner = node.fields === undefined ? undefined : keyed(node.fields, next, node.type === 'group' ? `${path}.` : node.type === 'page' ? prefix : '\u0000', node.type === 'repeater' ? [] : repeaters).fields
    return { ...node, key, ...(inner === undefined ? {} : { fields: inner }) }
  })
  return { fields, repeaters }
}

/** A visit that answered every field of `fields` a visit answers, as formancy's engine stores one: a group's in an object, a page's where it stands, a repeater's two rows. */
function answered(fields: readonly unknown[]): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const field of fields as readonly (Node & { readonly key: string })[]) {
    if (field.type === 'page') Object.assign(data, answered(field.fields ?? []))
    else if (field.type === 'group') data[field.key] = answered(field.fields ?? [])
    else if (field.type === 'repeater') data[field.key] = ['r1', 'r2'].map((id) => ({ _id: id, ...answered(field.fields ?? []) }))
    else if (answerOf(field) !== undefined) data[field.key] = answerOf(field)
  }
  return data
}

/** The host's label of an option a deployment resolves: one word, as a host gives one. */
const regions = (): string => 'Nord'

/** The codes a generation may refuse a valid form with: what the format, or the page, cannot hold. */
const FORMAT_REFUSALS = ['too-many-fields', 'too-many-columns', 'too-many-components', 'label-too-long', 'path-too-long', 'id-too-long', 'colliding-ids', 'nothing-to-print'] as const

/** One draft in this many is rendered: enough to meet every shape over a run, few enough that the run stays a few seconds. */
const RENDER_EVERY = 20

describe('any form formancy accepts', () => {
  // A draft the runtime compiled but whose bindings the bridge could not
  // fill, or whose nullability refused a visit that answered, or whose
  // table the renderer refused, would be a draft that does not print, and
  // a test of one form would not see it. Over models of every leaf the
  // generator reads differently, required or not, in groups, pages and
  // repeaters, the table any repeater or one row per submission or none:
  // each draft is generated twice alike, the runtime compiles it
  // (`generate`), and the bridge reads into it a submission that answered
  // nothing and one that answered every field, the second resolved in a
  // final render and, one draft in RENDER_EVERY, rendered and read back.
  // No note quotes a label of the form, and a refusal is only ever for
  // what the format cannot hold.
  test('gives a draft its version’s submissions read into and that prints, or a refusal of what the format cannot hold', async () => {
    expect(FORMAT_REFUSALS.filter((code) => !(FORMS_ERROR_CODES as readonly string[]).includes(code))).toEqual([])
    let drafts = 0
    let printed = 0
    await fc.assert(
      fc.asyncProperty(MODELS, fc.nat(), fc.constantFrom('en', 'de-CH'), async (nodes, choice, locale) => {
        const { fields, repeaters } = keyed(nodes)
        const form = formOf(fields, { i18n: { defaultLocale: 'en', messages: { en: {} } } })
        const details = [undefined, { kind: 'submissions' }, ...repeaters.map((repeater) => ({ kind: 'repeater', repeater }))]
        const detail = details[choice % details.length]
        const options = { id: 'draft', locale, ...(detail === undefined ? {} : { detail }) }
        const outcome = generate(form, options)
        if (!outcome.ok) {
          expect(outcome.errors.map((error) => error.code).filter((code) => !(FORMAT_REFUSALS as readonly string[]).includes(code))).toEqual([])
          return
        }
        drafts += 1
        expect(generate(form, options)).toEqual(outcome)
        expect(outcome.notes.filter((note) => note.message.includes(MARK))).toEqual([])
        const perSubmission = outcome.report.datasets.detail?.form?.kind === 'submissions'
        const readOf = (data: unknown) =>
          perSubmission ? readMany(outcome.report, { forms: [form], submissions: [{ id: SUBMISSION, formHash: schemaHash(form), data }], complete: true }, { labels: regions }) : readOne(outcome.report, { form, submission: { id: SUBMISSION, data } }, { labels: regions })
        const empty = readOf({})
        expect(empty.ok ? [] : empty.errors).toEqual([])
        const full = readOf(answered(fields))
        if (!full.ok) throw new Error(`a visit that answered every field was refused: ${JSON.stringify(full.errors)}`)
        const resolution = resolveReport(outcome.report, full.data, { mode: 'final', creationDate: '2026-10-22T08:00:00Z', timeZone: 'Europe/Zurich' })
        if (!resolution.ok) throw new Error(`a visit that answered every field did not resolve: ${JSON.stringify(resolution.errors)}`)
        if (drafts % RENDER_EVERY !== 1) return
        const pdf = await readPdf(await renderPdf(resolution.document, { maxPages: 50 }))
        expect(pdf.pages.flatMap((page) => page.items).some((item) => item.text.includes('Site visit'))).toBe(true)
        printed += 1
      }),
      { numRuns: 400 },
    )
    // Most such forms are drafts, not refusals: a generator that refused them all would pass the rest unread.
    expect(drafts).toBeGreaterThan(200)
    expect(printed).toBeGreaterThan(5)
  }, TIMEOUT)
})
