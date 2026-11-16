import { validateReport } from '@formancy/report-spec'
import type { Component, ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { diagnose } from '../diagnostics/diagnose.js'
import { expressionSites } from '../diagnostics/parts.js'
import { locations, validLocations } from '../locations.js'
import { openReportSession } from '../session.js'
import type { ReportSession } from '../session.js'
import { accepted, frozen, frozenSample, refused, sampleReport } from '../test-support.js'
import type { Location } from '../tree.js'
import { insertComponent, moveComponent, removeComponent } from './components.js'
import { putFirstPageHeader, removeFirstPageHeader } from './first-page-header.js'
import { fieldReaders, removeFieldWithReaders } from './readers.js'

/**
 * A first page's own header (0060): page 1 prints it in place of the page
 * header, and an empty one prints none. Its presence is the choice, so
 * these two commands are how a builder or a proposal makes it; what stands
 * in it is every component command's, once it is there.
 */

/** A letterhead: what page 1 prints at its top in place of the page header. */
const LETTERHEAD: readonly Component[] = [
  { id: 'sender', kind: 'text', style: 'title', content: [{ kind: 'text', text: 'Orders by site' }] },
  { id: 'letterhead-rule', kind: 'line', thickness: 0.5, color: '#999999' },
]

/** A text that prints the page's number. */
const COUNTER: Component = { id: 'counter', kind: 'text', content: [{ kind: 'pageNumber' }] }

/** A location as one line, for comparing lists of them. */
const said = ({ region, parent, column, index }: Location): string => [region, parent ?? '', column ?? '', index].join(':')

function open(report: ReportDefinition = sampleReport()): ReportSession {
  const opening = openReportSession(report)
  if (!opening.ok) throw new Error('the report did not open')
  return opening.session
}

/** The sample with `components` for its first page header. */
function headed(components: readonly Component[] = LETTERHEAD): ReportDefinition {
  return frozen(accepted(putFirstPageHeader(sampleReport(), components)))
}

describe('putFirstPageHeader', () => {
  // A builder gives page 1 a header of its own, and a proposal may replace
  // the one it has whole; either way the rest of the report is the very
  // object it was, so a builder redraws nothing the header does not touch.
  test('gives page 1 a header of its own, or replaces the one it has, and shares the rest', () => {
    const report = frozenSample()
    const added = accepted(putFirstPageHeader(report, LETTERHEAD))
    expect(added.regions.firstPageHeader).toBe(LETTERHEAD)
    for (const region of ['reportHeader', 'pageHeader', 'body', 'pageFooter', 'summary'] as const)
      expect(added.regions[region], region).toBe(report.regions[region])
    expect(added.paymentPart).toBe(report.paymentPart)
    const replaced = accepted(putFirstPageHeader(headed(), []))
    expect(replaced.regions.firstPageHeader).toEqual([])
    expect(validateReport(replaced).valid).toBe(true)
  })

  // An empty one is how a report says page 1 has no header (0060): a put
  // that dropped an empty list, or wrote one as absent, would print the
  // page header on page 1 where the person chose none.
  test('keeps an empty header, which prints none, apart from no header of its own', () => {
    const empty = accepted(putFirstPageHeader(frozenSample(), []))
    expect(empty.regions).toHaveProperty('firstPageHeader', [])
    expect(frozenSample().regions).not.toHaveProperty('firstPageHeader')
  })

  // What stands in it is the validator's to judge, as it is anywhere
  // (0008): a page number there is refused by the session, which keeps the
  // report it had.
  test('leaves judging what it holds to the validator, which the session asks', () => {
    const session = open()
    const before = session.document()
    const outcome = refused(session.apply((report) => putFirstPageHeader(report, [COUNTER])))
    expect(outcome.code).toBe('invalid-document')
    expect(outcome.errors?.map((error) => `${error.code} ${error.path}`)).toEqual(['misplaced-page-counter /regions/firstPageHeader/0/content/0'])
    expect(session.document()).toBe(before)
  })
})

describe('removeFirstPageHeader', () => {
  // Giving page 1 the page header back takes what its own header held,
  // and is one edit: undo gives back the very header, components and all.
  // The rest of the report is the very object it was: a removal that lost
  // the bill, or another region, would print another report and say
  // nothing.
  test('gives page 1 the page header back, its components with it, and its undo gives back the very header', () => {
    const report = headed()
    const removed = accepted(removeFirstPageHeader(report))
    for (const region of ['reportHeader', 'pageHeader', 'body', 'pageFooter', 'summary'] as const)
      expect(removed.regions[region], region).toBe(report.regions[region])
    expect(removed.paymentPart).toBe(report.paymentPart)
    const session = open(headed())
    const before = session.document().regions.firstPageHeader
    expect(session.apply((report) => removeFirstPageHeader(report)).ok).toBe(true)
    expect(session.document().regions).not.toHaveProperty('firstPageHeader')
    expect(session.revision()).toBe(1)
    expect(session.undo()).toBe(true)
    expect(session.document().regions.firstPageHeader).toBe(before)
  })

  // A removal of what is not there would report success for nothing, as
  // every command that names a thing refuses when it is not there.
  test('refuses a report whose page 1 prints the page header, naming where its own would be', () => {
    expect(refused(removeFirstPageHeader(frozenSample()))).toMatchObject({ code: 'not-found', path: '/regions/firstPageHeader' })
  })
})

describe('a first page header in a session', () => {
  // Each choice is one undo step, and so is each edit inside the region:
  // a choice that took two steps would leave undo halfway, a header of its
  // own with nothing a person put in it.
  test('is chosen, edited and given back one undo step at a time, and redone in order', () => {
    const session = open()
    const start = session.document()
    expect(session.apply((report) => putFirstPageHeader(report, [])).ok).toBe(true)
    expect(session.apply((report) => insertComponent(report, { region: 'firstPageHeader', index: 0 }, LETTERHEAD[0] as Component)).ok).toBe(true)
    expect(session.document().regions.firstPageHeader?.map(({ id }) => id)).toEqual(['sender'])
    expect(session.apply((report) => removeFirstPageHeader(report)).ok).toBe(true)
    expect(session.revision()).toBe(3)
    expect(session.undo()).toBe(true)
    expect(session.document().regions.firstPageHeader?.map(({ id }) => id)).toEqual(['sender'])
    expect(session.undo()).toBe(true)
    expect(session.document().regions.firstPageHeader).toEqual([])
    expect(session.undo()).toBe(true)
    expect(session.document()).toBe(start)
    expect(session.redo()).toBe(true)
    expect(session.document().regions.firstPageHeader).toEqual([])
  })
})

describe('a place in the first page header', () => {
  // A report without one has no list there: an insert or a move that made
  // one would give page 1 a header of its own nobody chose, and say
  // nothing. Choosing it is putFirstPageHeader's alone.
  test('is refused as not-found while page 1 prints the page header', () => {
    for (const outcome of [
      insertComponent(frozenSample(), { region: 'firstPageHeader', index: 0 }, LETTERHEAD[0] as Component),
      moveComponent(frozenSample(), 'gap', { region: 'firstPageHeader', index: 0 }),
    ]) {
      expect(refused(outcome)).toMatchObject({ code: 'not-found', path: '/regions/firstPageHeader' })
    }
  })

  // A builder offers the places locations lists. Listed without the
  // region, a drop target would name a list the report lacks; listed out
  // of its place, the keyboard's next place would jump past the page
  // header.
  test("is listed only where the report has one, between the report header's places and the page header's", () => {
    expect(locations(frozenSample()).some(({ region }) => region === 'firstPageHeader')).toBe(false)
    const regions = locations(headed()).map(({ region }) => region)
    const first = regions.indexOf('firstPageHeader')
    expect(regions.slice(first - 1, first + 4)).toEqual(['reportHeader', 'firstPageHeader', 'firstPageHeader', 'firstPageHeader', 'pageHeader'])
    expect(
      locations(headed())
        .filter(({ region }) => region === 'firstPageHeader')
        .map(said),
    ).toEqual(['firstPageHeader:::0', 'firstPageHeader:::1', 'firstPageHeader:::2'])
  })

  // The validator decides what stands where (0007), so a page counter,
  // which has no value on page 1's own header, is offered no place in it,
  // where a spacer is offered every one.
  test('is offered to what the validator accepts there, and never to a page number', () => {
    const spacer: Component = { id: 'added', kind: 'spacer', height: 4 }
    expect(
      validLocations(headed(), spacer)
        .filter(({ region }) => region === 'firstPageHeader')
        .map(said),
    ).toEqual(['firstPageHeader:::0', 'firstPageHeader:::1', 'firstPageHeader:::2'])
    expect(validLocations(frozenSample(), spacer).some(({ region }) => region === 'firstPageHeader')).toBe(false)
    const counter = validLocations(headed(), COUNTER)
    expect(new Set(counter.map(({ region }) => region))).toEqual(new Set(['pageHeader', 'pageFooter']))
  })
})

describe('what reads a field in the first page header', () => {
  /** The sample with its introduction, the one text that prints the order's date, in page 1's own header and out of the body. */
  function introduced(): ReportDefinition {
    const sample = sampleReport()
    const intro = sample.regions.body[0] as Component
    expect(intro.id).toBe('intro')
    return frozen(accepted(putFirstPageHeader(accepted(removeComponent(sample, 'intro')), [intro])))
  }

  // The readers are found by the walk, which visits the region where the
  // report has it. Were it skipped, a field only page 1's header prints
  // would be called unused, and a review's removal of it would leave that
  // text printing a field the report no longer declares.
  test('is found by the diagnostics, the readers and the removal of the field', () => {
    const report = introduced()
    expect(validateReport(report).valid).toBe(true)
    expect(diagnose(report)).toEqual([])
    // The compiler and a review's retyping read the expressions the walk finds, the introduction's among them.
    expect(expressionSites(report).map(({ path }) => path)).toContain('/regions/firstPageHeader/0/content/2/expression/cel')
    const outcome = fieldReaders(report).removal('header', 'orderedOn')
    expect(outcome).toEqual(removeFieldWithReaders(report, 'header', 'orderedOn'))
    expect(outcome.ok ? outcome.removed : outcome.code).toEqual(['/regions/firstPageHeader/0', '/datasets/header/fields/1'])
    expect(outcome.ok && outcome.report.regions.firstPageHeader).toEqual([])
  })
})
