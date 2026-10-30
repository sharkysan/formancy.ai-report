import { validateReport, walkComponents } from '@formancy/report-spec'
import type { Component, ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { insertComponent, moveComponent, removeComponent } from './commands/components.js'
import { locationOf, locations, validLocations } from './locations.js'
import type { Location } from './tree.js'
import { accepted, frozenSample, sampleReport } from './test-support.js'

const spacer: Component = { id: 'added', kind: 'spacer', height: 4 }

/** A location as one line, for comparing lists of them. */
const said = ({ region, parent, column, index }: Location): string => [region, parent ?? '', column ?? '', index].join(':')

describe('locationOf', () => {
  // Keyboard move and focus after deletion start from where a component
  // stands. Where it stands is the place moveComponent puts it back: so a
  // move to its own location changes nothing, for every component at every
  // depth -- a region, a section, a keep-together block, a column.
  test('names the place a move puts each component back, at every depth', () => {
    const report = frozenSample()
    for (const { component } of walkComponents(report)) {
      const location = locationOf(report, component.id)
      expect(location, component.id).toBeDefined()
      expect(accepted(moveComponent(report, component.id, location as Location)), component.id).toEqual(report)
    }
  })

  test('says where a nested component stands, in the location shape commands take', () => {
    const report = frozenSample()
    expect(locationOf(report, 'gap')).toEqual({ region: 'body', index: 1 })
    expect(locationOf(report, 'note')).toEqual({ region: 'body', parent: 'keep', index: 1 })
    expect(locationOf(report, 'title')).toEqual({ region: 'reportHeader', parent: 'heading', column: 1, index: 0 })
    expect(locationOf(report, 'nowhere')).toBeUndefined()
  })
})

describe('locations', () => {
  // Every place a component could be put, in reading order: before each
  // component and at the end of each list, a container's list right after
  // the place before the container. A drop target outside this list would
  // be refused by insertComponent; one missing from it could never be chosen.
  test('lists every place in reading order, each one insertComponent takes', () => {
    const report = frozenSample()
    const all = locations(report)
    for (const location of all) expect(insertComponent(report, location, spacer).ok, said(location)).toBe(true)
    const lists =
      5 +
      walkComponents(report).reduce(
        (count, { component }) => count + (component.kind === 'columns' ? component.columns.length : 'components' in component ? 1 : 0),
        0,
      )
    expect(all).toHaveLength(walkComponents(report).length + lists)
    expect(all.filter(({ region }) => region === 'body').map(said)).toEqual([
      'body:::0',
      'body:::1',
      'body:::2',
      'body:::3',
      'body:keep::0',
      'body:keep::1',
      'body:keep::2',
      'body:::4',
      'body:::5',
    ])
  })
})

describe('validLocations', () => {
  /** The locations insertComponent or moveComponent offers for `subject`, split by what the validator says of the result. */
  function verdicts(report: ReportDefinition, subject: Component | string): { valid: string[]; refused: string[] } {
    const candidates = typeof subject === 'string' ? locations(accepted(removeComponent(report, subject))) : locations(report)
    const put = (location: Location) => (typeof subject === 'string' ? moveComponent(report, subject, location) : insertComponent(report, location, subject))
    const valid = candidates.filter((location) => validateReport(accepted(put(location))).valid)
    return { valid: valid.map(said), refused: candidates.filter((location) => !valid.includes(location)).map(said) }
  }

  // The validator is the one place placement is decided (0007): a page
  // counter only in the page header and footer, a table only in the body
  // and the summary and never inside columns or a keep-together block. The
  // destinations are exactly the places the validator accepts, so a
  // builder that offers them never offers a drop the session refuses.
  test.each<[string, Component | string]>([
    ['a new page counter', { id: 'counter', kind: 'text', content: [{ kind: 'pageNumber' }] }],
    ['a new spacer', spacer],
    ['the detail table, moved', 'lines'],
    ['a component inside a container, moved', 'note'],
  ])('are exactly the places the validator accepts for %s', (_name, subject) => {
    const report = frozenSample()
    const { valid } = verdicts(report, subject)
    expect(validLocations(report, subject).map(said)).toEqual(valid)
  })

  test('offer a page counter only the page regions, and the table only the flow outside columns and blocks', () => {
    const report = frozenSample()
    const counter = validLocations(report, { id: 'counter', kind: 'text', content: [{ kind: 'pageNumber' }] })
    expect(new Set(counter.map(({ region }) => region))).toEqual(new Set(['pageHeader', 'pageFooter']))
    const table = validLocations(report, 'lines')
    expect(new Set(table.map(({ region }) => region))).toEqual(new Set(['body', 'summary']))
    expect(table.some(({ parent }) => parent === 'closing')).toBe(true)
    expect(table.some(({ parent }) => parent === 'keep' || parent === 'heading')).toBe(false)
  })

  // A second detail table is refused everywhere, and a component the
  // report lacks cannot be moved anywhere: no destination, not an error.
  test('are none for a second detail table, or a component the report lacks', () => {
    const second = { ...(sampleReport().regions.body[2] as Component), id: 'again' }
    expect(validLocations(frozenSample(), second)).toEqual([])
    expect(validLocations(frozenSample(), 'nowhere')).toEqual([])
  })
})
