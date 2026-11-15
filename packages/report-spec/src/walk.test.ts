import { describe, expect, test } from 'vitest'
import { COMPONENT_KINDS } from './components.js'
import type { ReportDefinition } from './definition.js'
import { eInvoiceReport, getAt, richReport } from './test-support.js'
import { componentAt, walkComponents } from './walk.js'

/** Every component-shaped object in a JSON value: an `id` string and a `kind` the format lists. */
function componentsIn(value: unknown, into: string[] = []): string[] {
  if (typeof value !== 'object' || value === null) return into
  const record = value as Record<string, unknown>
  if (typeof record.id === 'string' && (COMPONENT_KINDS as readonly unknown[]).includes(record.kind)) into.push(record.id)
  for (const child of Object.values(record)) componentsIn(child, into)
  return into
}

describe('walkComponents', () => {
  // The fixture is what proves the walk complete; a kind it lacked would be
  // a container the walk could miss without any test noticing.
  test('is tested on a report that holds every component kind', () => {
    const kinds = new Set(walkComponents(richReport()).map(({ component }) => component.kind))
    expect([...kinds].sort()).toEqual([...COMPONENT_KINDS].sort())
  })

  // The core's commands, the builder's outline and the runtime all walk the
  // report in one order: regions as the page reads, each depth-first.
  test('visits every component in document order, with its region and depth', () => {
    expect(walkComponents(richReport()).map(({ component, region, depth }) => `${region} ${depth} ${component.id}`)).toEqual([
      'reportHeader 0 heading',
      'reportHeader 1 logo-image',
      'reportHeader 1 title',
      'reportHeader 0 rule',
      'pageHeader 0 running-title',
      'body 0 intro',
      'body 0 gap',
      'body 0 lines',
      'body 0 keep',
      'body 1 box',
      'body 1 note',
      'body 0 break',
      'pageFooter 0 page-of',
      'summary 0 closing',
      'summary 1 threshold',
      'summary 1 statistics',
      'summary 1 signature-image',
      'summary 0 seal-image',
      'summary 0 order-code',
      'summary 0 payment-code',
      'summary 0 site-chart',
    ])
  })

  // A path is the JSON Pointer validation errors use, so an error and the
  // component it names can be matched; each resolves to that component.
  test('gives each component the JSON Pointer that resolves to it', () => {
    const report = richReport()
    for (const { component, path } of walkComponents(report)) expect(getAt(report, path)).toBe(component)
  })

  // The walk and the validator each know where containers keep their
  // children. If they disagreed, a component the validator checked would be
  // one the walk never visits.
  test('finds every component the report holds', () => {
    const report = richReport()
    expect(
      walkComponents(report)
        .map(({ component }) => component.id)
        .sort(),
    ).toEqual(componentsIn(report).sort())
  })
})

describe('walkComponents over an e-invoice', () => {
  // An e-invoice is no component and holds none: its line table is the
  // report's own, which the walk already visits. Were a part of it ever
  // component-shaped, the core's commands would find a component the
  // validator never read as one, or the walk would miss one it did.
  test('finds no component in the e-invoice, and the same ones as in the report without it', () => {
    const report = eInvoiceReport()
    const { eInvoice, ...plain } = report
    expect(componentsIn(eInvoice)).toEqual([])
    expect(walkComponents(report).map(({ path }) => path)).toEqual(walkComponents(plain).map(({ path }) => path))
    expect(componentAt(report, eInvoice?.lines.table ?? '')?.component.kind).toBe('table')
  })
})

describe('walkComponents over a first page header (0060)', () => {
  // The walk is how the core's commands, the readers' diagnostics and a
  // form review find a component. One that skipped the first page header
  // would leave a field only it prints unread; one that visited it out of
  // its place would put it in the outline after the page it heads.
  test("finds its components between the report header's and the page header's, a container before what it holds", () => {
    const report = richReport()
    const first = {
      ...report,
      regions: {
        ...report.regions,
        firstPageHeader: [
          { id: 'letterhead', kind: 'section', components: [{ id: 'sender', kind: 'text', content: [{ kind: 'text', text: 'Orders' }] }] },
          { id: 'letterhead-rule', kind: 'line', thickness: 0.5, color: '#999999' },
        ],
      },
    } as ReportDefinition
    const walked = walkComponents(first).map(({ component, region, depth, path }) => `${region} ${depth} ${component.id} ${path}`)
    expect(walked.slice(3, 7)).toEqual([
      'reportHeader 0 rule /regions/reportHeader/1',
      'firstPageHeader 0 letterhead /regions/firstPageHeader/0',
      'firstPageHeader 1 sender /regions/firstPageHeader/0/components/0',
      'firstPageHeader 0 letterhead-rule /regions/firstPageHeader/1',
    ])
    expect(walked[7]).toBe('pageHeader 0 running-title /regions/pageHeader/0')
    for (const { component, path } of walkComponents(first)) expect(getAt(first, path)).toBe(component)
  })

  // Absent, it holds nothing to visit: a walk that met an absent region
  // as an empty one would throw, or name a list the report does not have.
  test('finds nothing of it in a report without one', () => {
    expect(walkComponents(richReport()).filter(({ region }) => region === 'firstPageHeader')).toEqual([])
  })
})

describe('componentAt', () => {
  // Diagnostics name a component by id; the builder selects it by the same.
  test('finds a component by id, however deep, and nothing for an id the report lacks', () => {
    expect(componentAt(richReport(), 'title')).toMatchObject({
      region: 'reportHeader',
      depth: 1,
      path: '/regions/reportHeader/0/columns/1/components/0',
      component: { id: 'title', kind: 'text' },
    })
    expect(componentAt(richReport(), 'nowhere')).toBeUndefined()
  })
})
