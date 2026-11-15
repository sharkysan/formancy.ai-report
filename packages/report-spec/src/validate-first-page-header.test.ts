import { describe, expect, test } from 'vitest'
import { reportHash } from './hash.js'
import { MAX_REGION_COMPONENTS } from './limits.js'
import { edited, editable, getAt, refusals, removeAt, richReport, setAt } from './test-support.js'
import { validateReport } from './validate.js'

/** Where the first page header is (0060). */
const REGION = '/regions/firstPageHeader'

/** A letterhead: a mark beside the sender, and a rule under them -- the components a page header may hold. */
const LETTERHEAD = [
  {
    id: 'letterhead',
    kind: 'columns',
    columns: [
      { width: 120, components: [{ id: 'mark', kind: 'image', source: { kind: 'asset', asset: 'logo' }, width: 100, height: 40, fit: 'contain' }] },
      { width: 'fill', components: [{ id: 'sender', kind: 'text', style: 'title', content: [{ kind: 'text', text: 'Orders by site' }] }] },
    ],
  },
  { id: 'letterhead-rule', kind: 'line', thickness: 0.5, color: '#999999' },
]

/** The fixture with `components` for its first page header. */
function headed(components: unknown): Record<string, unknown> {
  return edited((r) => setAt(r, REGION, components))
}

/** The report a valid document is read as, or the test fails naming its refusals. */
function read(document: unknown): ReturnType<typeof richReport> {
  const outcome = validateReport(document)
  if (!outcome.valid) throw new Error(`refused: ${outcome.errors.map(({ code, path }) => `${code} ${path}`).join(', ')}`)
  return outcome.report
}

describe('a first page header (0060)', () => {
  // Its presence is the whole choice: absent, page 1 prints the page
  // header; present, its own; empty, none. A validator that dropped an
  // empty region, or wrote one where there was none, would print another
  // page 1 than the one saved, and the three would hash as fewer reports
  // than they are.
  test('is read back absent, empty or holding components as it was written, and each hashes differently', () => {
    const absent = read(richReport())
    const empty = read(headed([]))
    const holding = read(headed(LETTERHEAD))
    expect(absent.regions).not.toHaveProperty('firstPageHeader')
    expect(empty.regions.firstPageHeader).toEqual([])
    expect(holding.regions.firstPageHeader).toEqual(LETTERHEAD)
    expect(new Set([absent, empty, holding].map(reportHash)).size).toBe(3)
  })

  // An optional region is optional alone: a report that holds one still
  // holds every other, and the format's own regions are the only ones it
  // reads, so a misspelt or invented region is refused, never ignored.
  test('is a list, beside the five regions every report holds, and no other region is read', () => {
    for (const wrong of [{}, 'none', null, 0]) expect(refusals(headed(wrong)), JSON.stringify(wrong)).toEqual([`wrong-type ${REGION}`])
    expect(refusals(edited((r) => setAt(r, '/regions/lastPageHeader', [])))).toEqual(['unknown-property /regions/lastPageHeader'])
    const withoutPageHeader = headed(LETTERHEAD)
    removeAt(withoutPageHeader, '/regions/pageHeader')
    expect(refusals(withoutPageHeader)).toEqual(['missing-property /regions/pageHeader'])
  })

  // It is drawn at the top of page 1 at the height it measures, as the
  // page header is on every page: content that flows, breaks or grows
  // there has no defined layout, so each is refused as it is in the page
  // header.
  test('holds no table, chart, page break or keep-together block', () => {
    // The table is taken out of the body, so that it is the report's one detail table still.
    const table = edited((r) => {
      const lines = getAt(r, '/regions/body/2')
      removeAt(r, '/regions/body/2')
      setAt(r, REGION, [lines])
    })
    expect(getAt(table, `${REGION}/0`)).toMatchObject({ kind: 'table' })
    expect(refusals(table), 'table').toEqual([`misplaced-flow-component ${REGION}/0`])
    const chart = getAt(editable(richReport()), '/regions/summary/4')
    expect(chart).toMatchObject({ kind: 'chart' })
    for (const component of [
      { ...(chart as object), id: 'moved-chart' },
      { id: 'moved-break', kind: 'pageBreak' },
      { id: 'moved-keep', kind: 'keepTogether', components: [] },
    ]) {
      expect(refusals(headed([component])), component.id).toEqual([`misplaced-flow-component ${REGION}/0`])
    }
  })

  // Page 1's own header is drawn when page 1 is laid out, before the pages
  // are counted (0060): a page count there would print nothing, and a page
  // number is always 1, which is text. So both are refused, at any depth,
  // with a message that says where page 1's number and count do print.
  test('refuses a page number and a page count, sending them to the page footer', () => {
    for (const counter of [{ kind: 'pageNumber' }, { kind: 'pageCount' }]) {
      const outcome = validateReport(headed([{ id: 'counter', kind: 'text', content: [{ kind: 'text', text: 'Page ' }, counter] }]))
      expect(outcome.valid ? [] : outcome.errors.map(({ code, path, message }) => ({ code, path, message })), counter.kind).toEqual([
        {
          code: 'misplaced-page-counter',
          path: `${REGION}/0/content/1`,
          message:
            "the first page's own header is drawn before pages are counted, so a page number or count has no value in it; the page footer prints page 1's",
        },
      ])
    }
    const nested = edited((r) => {
      setAt(r, REGION, LETTERHEAD)
      setAt(r, `${REGION}/0/columns/1/components/0/content/0`, { kind: 'pageNumber' })
    })
    expect(refusals(nested)).toEqual([`misplaced-page-counter ${REGION}/0/columns/1/components/0/content/0`])
  })

  // Every region has a budget of its own. One shared with the page header
  // would refuse a report whose two headers each fit theirs; none would
  // let a report hold a header of any size the bound exists to refuse.
  test('holds at most MAX_REGION_COMPONENTS components of its own, beside a page header that holds as many', () => {
    const fill = (prefix: string, count: number) => Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}`, kind: 'spacer', height: 1 }))
    const both = (first: number) =>
      edited((r) => {
        setAt(r, REGION, fill('first', first))
        setAt(r, '/regions/pageHeader', fill('running', MAX_REGION_COMPONENTS))
      })
    expect(refusals(both(MAX_REGION_COMPONENTS))).toEqual([])
    expect(refusals(both(MAX_REGION_COMPONENTS + 1))).toEqual([`too-many ${REGION}`])
  })

  // A component is named by its id across the whole report (0008): one
  // id in two regions would let a command meant for one edit the other.
  test('shares one space of component ids with every other region', () => {
    expect(refusals(headed([{ id: 'rule', kind: 'spacer', height: 1 }]))).toEqual([`duplicate-component-id ${REGION}/0/id`])
    expect(refusals(headed([{ id: 'page-of', kind: 'spacer', height: 1 }]))).toEqual(['duplicate-component-id /regions/pageFooter/0/id'])
  })
})
