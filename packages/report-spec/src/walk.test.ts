import { describe, expect, test } from 'vitest'
import { getAt, richReport } from './test-support.js'
import { COMPONENT_KINDS } from './types.js'
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
    expect(walkComponents(report).map(({ component }) => component.id).sort()).toEqual(componentsIn(report).sort())
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
