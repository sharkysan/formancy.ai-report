import { describe, expect, test } from 'vitest'
import { field, formOf, readData, read, reportOf, rowsOf } from './test-support.js'

/**
 * A read takes time linear in what it is handed (0042): the version's
 * scopes, option lists and rows are indexed once, never again for every
 * answer that reads them. Read per answer, a form of many options or a
 * group of many fields, answered in many rows, made a read quadratic in
 * what the host handed over: a few megabytes stalled it for minutes.
 *
 * Each case is a form and a submission a host could hand over: many rows,
 * each answering a field of many options or a group of many fields.
 * Measured on 22 October 2026 on an Intel i9-10900K under Node 24.21.0,
 * other workflows' builds and tests loading it to between a third and a
 * half: read per answer, the three reads below took 174, 13 and 16
 * seconds; indexed once, each case took under half a second, its input
 * built and its data checked included. `BOUND` is chosen between the two,
 * so a runner ten times slower still passes, and a read that indexes per
 * answer still fails.
 */
const BOUND = 5_000

/** `count` options, `o0` up. */
const options = (count: number) => Array.from({ length: count }, (_, index) => ({ value: `o${index}`, label: `Option ${index}` }))

/** How long `run` took, in milliseconds, and what it returned. */
function timed<T>(run: () => T): { readonly value: T; readonly ms: number } {
  const start = performance.now()
  const value = run()
  return { value, ms: performance.now() - start }
}

describe('a read takes time linear in what it is handed', () => {
  test('ticked boxes of many options, answered in many rows', () => {
    const form = formOf([{ key: 'rows', type: 'repeater', fields: [{ key: 'b', type: 'selectboxes', options: options(40_000) }] }])
    const rows = Array.from({ length: 40_000 }, (_, index) => ({ _id: `r${index}`, b: ['o39999'] }))
    const { value, ms } = timed(() => read(reportOf({ detail: rowsOf('rows', field('b', 'boolean', 'b', { member: 'o0' })) }), form, { rows }))
    expect(readData(value).detail).toHaveLength(40_000)
    expect(ms).toBeLessThan(BOUND)
  }, 300_000)

  test('a choice of many options, answered in many rows', () => {
    const form = formOf([{ key: 'rows', type: 'repeater', fields: [{ key: 's', type: 'select', options: options(40_000) }] }])
    const rows = Array.from({ length: 40_000 }, (_, index) => ({ _id: `r${index}`, s: 'o39999' }))
    const { value, ms } = timed(() => read(reportOf({ detail: rowsOf('rows', field('s', 'string', 's')) }), form, { rows }))
    expect(readData(value).detail?.[0]).toEqual({ s: 'Option 39999' })
    expect(ms).toBeLessThan(BOUND)
  }, 300_000)

  test('a group of many fields, answered in many rows', () => {
    const group = Array.from({ length: 10_000 }, (_, index) => ({ key: `f${index}`, type: 'text' }))
    const form = formOf([{ key: 'rows', type: 'repeater', fields: [{ key: 'ref', type: 'text' }, { key: 'g', type: 'group', fields: group }] }])
    const rows = Array.from({ length: 20_000 }, (_, index) => ({ _id: `r${index}`, ref: 'x', g: {} }))
    const { value, ms } = timed(() => read(reportOf({ detail: rowsOf('rows', field('ref', 'string', 'ref')) }), form, { rows }))
    expect(readData(value).detail).toHaveLength(20_000)
    expect(ms).toBeLessThan(BOUND)
  }, 300_000)
})
