import { openReportSession } from '@formancy/report-core'
import type { ReportDefinition } from '@formancy/report-spec'
import { schemaHash } from '@formancy/spec'
import { describe, expect, test } from 'vitest'
import { reviewFormVersion } from './review.js'
import type { FormReview, ReviewItem } from './review.js'
import { formOf, generate, generatedFrom, headerOf, read, readData, refusals } from './test-support.js'

/**
 * The versions after a review (0048). A form moves on after its author
 * reviewed one version, and most of its later versions change nothing the
 * report reads: each prints without another review (FB-Q5), so a review
 * that follows a rename moves the binding to where the field is now and
 * keeps every version it knows reading where it read. A version a review
 * did not know is offered to read the field where a version the report
 * names reads it, where formancy's diff finds it there unchanged; and a
 * key a version vacated, reused by a later one for a field formancy calls
 * new, is said, never relabelled as though the form had renamed it.
 */

const SITE = { key: 'site', type: 'text', label: 'Site', required: true }
const COUNT = { key: 'count', type: 'text', label: 'Count' }
const FINDINGS = { key: 'findings', type: 'repeater', label: 'Findings', fields: [{ key: 'area', type: 'text', label: 'Area' }] }

/** The first version, and the report made from it, its table over the findings. */
const V1 = formOf([SITE, COUNT, FINDINGS])
const REPORT: ReportDefinition = generatedFrom(generate(V1, { id: 'visit', locale: 'en', detail: { kind: 'repeater', repeater: 'findings' } })).report

/** The second: the site renamed the address, declared. */
const V2 = formOf([{ ...SITE, key: 'address', renamedFrom: 'site' }, COUNT, FINDINGS])

/** The review's status and items, failing the test where it was refused. */
function itemsOf(review: FormReview): { readonly status: string; readonly items: readonly ReviewItem[] } {
  if (!review.ok) throw new Error(`refused: ${review.errors.map((error) => `${error.code} ${error.path}: ${error.message}`).join('; ')}`)
  return review
}

const summary = (items: readonly ReviewItem[]) => items.map((item) => [item.dataset ?? null, item.field ?? item.formPath ?? null, item.change ?? null, item.blocks, item.resolutions.map((resolution) => resolution.kind)])

/** `report` with the resolution of `kind` the review offers for `field` applied, as a host applies it. */
function resolved(review: FormReview, field: string | undefined, kind: string, report: ReportDefinition): ReportDefinition {
  const resolution = itemsOf(review)
    .items.find((each) => each.field === field)
    ?.resolutions.find((each) => each.kind === kind)
  if (resolution === undefined) throw new Error(`no ${kind} for ${String(field)}`)
  const opening = openReportSession(report)
  if (!opening.ok) throw new Error('the report did not open')
  const outcome = opening.session.apply(resolution.descriptor, { expectedHash: resolution.expectedHash })
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.message}`)
  return opening.session.document()
}

/** The report once the second version's declared rename was followed, against the versions in `known`. */
const followed = (known: readonly unknown[] = [V1]): ReportDefinition => resolved(reviewFormVersion(REPORT, { form: V2, versions: known }), 'site', 'follow-rename', REPORT)

describe('a version after a followed rename', () => {
  // Following a rename for one version alone would leave every later
  // version that kept the field where the rename put it refused, one
  // review for each release of the form -- the cost FB-Q5 (a) was chosen
  // to avoid. The binding reads the field where the reviewed version holds
  // it now, and the version the report was made from, and the reviewed
  // one, are named where they read it.
  test('prints without a review, its renamedFrom kept or dropped', () => {
    const report = followed()
    expect(report.datasets.header?.fields[0]?.form).toEqual({ path: 'address', overrides: { [schemaHash(V1)]: { path: 'site' }, [schemaHash(V2)]: { path: 'address' } } })
    const kept = formOf([{ ...SITE, key: 'address', renamedFrom: 'site' }, COUNT, FINDINGS], { title: 'Site visit, revised' })
    const dropped = formOf([{ ...SITE, key: 'address' }, COUNT, FINDINGS], { title: 'Site visit, revised' })
    for (const later of [kept, dropped]) {
      expect(headerOf(read(report, later, { address: 'Bahnhofplatz 1', findings: [] }))['site']).toBe('Bahnhofplatz 1')
      // A field the rename put where the report reads it is no field the version added.
      expect(itemsOf(reviewFormVersion(report, { form: later, versions: [V1, V2] }))).toMatchObject({ status: 'compatible', items: [] })
    }
    expect(headerOf(read(report, V1, { site: 'Hauptstrasse 12', findings: [] }))['site']).toBe('Hauptstrasse 12')
  })

  // A key the rename vacated, reused by a later version for another
  // field, would print that field's answers as the one the report reads,
  // with no review ever asked for, were the binding left at the old key.
  // It reads the field where the rename put it; the new field at the old
  // key is said, and the report is offered no relabel to its label.
  test('reads the field where the rename put it, never the key it vacated and a later version reused', () => {
    const report = followed()
    const reused = formOf([{ ...SITE, key: 'address' }, { key: 'site', type: 'text', label: 'Site (old building)' }, COUNT, FINDINGS])
    expect(headerOf(read(report, reused, { address: 'Bahnhofplatz 1', site: 'Altbau, Bahnhofplatz 3', findings: [] }))['site']).toBe('Bahnhofplatz 1')
    expect(summary(itemsOf(reviewFormVersion(report, { form: reused, versions: [V1, V2] })).items)).toEqual([['header', 'site', 'field.added', false, []]])
  })

  // The detail's rows follow the same way: a later version that kept the
  // renamed repeater prints its rows without another review.
  test("prints the rows of a later version that kept the detail's renamed repeater", () => {
    const defects = { ...FINDINGS, key: 'defects', renamedFrom: 'findings' }
    const renamed = formOf([SITE, COUNT, defects])
    const report = resolved(reviewFormVersion(REPORT, { form: renamed, versions: [V1] }), undefined, 'follow-rename', REPORT)
    expect(report.datasets.detail?.form).toEqual({ kind: 'repeater', repeater: 'defects', overrides: { [schemaHash(V1)]: { repeater: 'findings' }, [schemaHash(renamed)]: { repeater: 'defects' } } })
    const later = formOf([SITE, COUNT, { ...FINDINGS, key: 'defects' }], { title: 'Site visit, revised' })
    expect(readData(read(report, later, { site: 'Bern', defects: [{ _id: 'r1', area: 'Keller' }] })).detail).toEqual([{ area: 'Keller' }])
    expect(readData(read(report, V1, { site: 'Bern', findings: [{ _id: 'r1', area: 'Dach' }] })).detail).toEqual([{ area: 'Dach' }])
  })
})

describe('a version a review did not know', () => {
  /** A version between the first and the second: the first with a new title, which printed without review. */
  const BETWEEN = formOf([SITE, COUNT, FINDINGS], { title: 'Site visit, between' })

  // Every version the host hands a review over goes on reading where it
  // read once the rename is followed: a version that printed before would
  // otherwise be refused after it, though nothing in it changed.
  test('keeps reading where it read, where the review was handed it', () => {
    const report = followed([V1, BETWEEN])
    expect(headerOf(read(report, BETWEEN, { site: 'Kramgasse 49', findings: [] }))['site']).toBe('Kramgasse 49')
  })

  // A version handed over that already holds the field where the rename
  // put it -- a later one, reviewed after it was released -- reads it there
  // as the reviewed version does, formancy's diff finding the same field:
  // held to the old path, it would be refused for nothing it did. One that
  // holds it nowhere stays as it was, refused at the old path.
  test('reads a version handed over that keeps the field where the rename put it there', () => {
    const later = formOf([{ ...SITE, key: 'address' }, COUNT, FINDINGS], { title: 'Site visit, revised' })
    const gone = formOf([COUNT, FINDINGS], { title: 'Site visit, without a site' })
    const report = followed([V1, later, gone])
    expect(headerOf(read(report, later, { address: 'Bahnhofplatz 1', findings: [] }))['site']).toBe('Bahnhofplatz 1')
    expect(Object.keys(report.datasets.header?.fields[0]?.form?.overrides ?? {}).sort()).toEqual([schemaHash(V1), schemaHash(V2), schemaHash(gone)].sort())
    expect(refusals(read(report, gone, { findings: [] }))).toEqual(['version-lacks-field /datasets/header/fields/0/form'])
  })

  // One the review was not handed reads the binding's new path, and is
  // refused there. Its review offers to read the field where the version
  // the report was made from reads it, since formancy's diff finds the
  // same field there -- not labelled declared, since nobody declared it;
  // without it, nothing on offer would keep its answers.
  test('is offered to read the field where a version the report names reads it, the diff finding it unchanged there', () => {
    const report = followed()
    expect(refusals(read(report, BETWEEN, { site: 'Kramgasse 49', findings: [] }))).toEqual(['version-lacks-field /datasets/header/fields/0/form'])
    const review = reviewFormVersion(report, { form: BETWEEN, versions: [V1, V2] })
    expect(summary(itemsOf(review).items)).toEqual([['header', 'site', 'field.removed', true, ['follow-reviewed', 'print-nothing', 'remove']]])
    const [first] = itemsOf(review).items[0]?.resolutions ?? []
    expect([first?.declared, first?.message.includes(schemaHash(V1))]).toEqual([undefined, true])
    expect(headerOf(read(resolved(review, 'site', 'follow-reviewed', report), BETWEEN, { site: 'Kramgasse 49', findings: [] }))['site']).toBe('Kramgasse 49')
  })

  // Where the diff says the field at that path is another -- here held as
  // another kind -- it is not the field a version the report names reads
  // there, whatever its key: nothing is offered that reads it, and the
  // field there is said, as the diff from the second version calls it.
  test('is offered no path where the diff finds another field', () => {
    const hidden = formOf([{ ...SITE, type: 'hidden' }, COUNT, FINDINGS], { title: 'Site visit, between' })
    expect(summary(itemsOf(reviewFormVersion(followed(), { form: hidden, versions: [V1, V2] })).items)).toEqual([
      ['header', 'site', 'field.removed', true, ['print-nothing', 'remove']],
      ['header', 'site', 'field.added', false, []],
    ])
  })

  // The detail's rows the same way: a version the review that followed a
  // rename of the repeater did not know is offered the repeater the
  // version the report was made from reads.
  test("is offered the repeater a version the report names reads the detail's rows from", () => {
    const renamed = formOf([SITE, COUNT, { ...FINDINGS, key: 'defects', renamedFrom: 'findings' }])
    const report = resolved(reviewFormVersion(REPORT, { form: renamed, versions: [V1] }), undefined, 'follow-rename', REPORT)
    const review = reviewFormVersion(report, { form: BETWEEN, versions: [V1, renamed] })
    expect(summary(itemsOf(review).items)).toEqual([['detail', null, 'field.removed', true, ['follow-reviewed']]])
    expect(readData(read(resolved(review, undefined, 'follow-reviewed', report), BETWEEN, { site: 'Bern', findings: [{ _id: 'r1', area: 'Dach' }] })).detail).toEqual([{ area: 'Dach' }])
  })
})

describe('a key a version removed, and a later version added again', () => {
  // The review of the version that removed the count printed nothing of
  // it from there. A later version holds a count again, which formancy's
  // diff calls added since: it prints as the report's count, which the
  // review says, offering to print nothing of it from that version or to
  // remove it -- and no relabel, which would name the report's field after
  // a field the form may only have given the old key.
  test('says the field that prints there is new since the version the report printed nothing of it from', () => {
    const removed = formOf([SITE, FINDINGS])
    const nothing = resolved(reviewFormVersion(REPORT, { form: removed, versions: [V1] }), 'count', 'print-nothing', REPORT)
    // Printing nothing names one version: a later one that lacks the count too is refused until reviewed in turn, the cost 0048 states.
    expect(refusals(read(nothing, formOf([SITE, FINDINGS], { title: 'Site visit, revised' }), { site: 'Bern', findings: [] }))).toEqual(['version-lacks-field /datasets/header/fields/1/form'])
    const again = formOf([SITE, { key: 'count', type: 'text', label: 'Count of visitors' }, FINDINGS])
    expect(headerOf(read(nothing, again, { site: 'Bern', count: '12', findings: [] }))['count']).toBe('12')
    const review = itemsOf(reviewFormVersion(nothing, { form: again, versions: [V1, removed] }))
    expect([review.status, summary(review.items)]).toEqual(['review', [['header', 'count', 'field.added', false, ['print-nothing', 'remove']]]])
    expect(review.items[0]?.message).toContain(schemaHash(removed))
  })
})
