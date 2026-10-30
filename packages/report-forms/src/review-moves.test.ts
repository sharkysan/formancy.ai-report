import { SITE_VISIT_V2, SITE_VISIT_V3 } from '@formancy/report-corpus'
import { diffSchemas, modelDataPaths } from '@formancy/spec'
import type { FormSchema } from '@formancy/spec'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { Findings } from './errors.js'
import { declaredMoves } from './review-moves.js'
import { formOf } from './test-support.js'
import { readVersion } from './version.js'

/**
 * Where a declared rename moved what a version held (0048): a field whose
 * own key was renamed with `renamedFrom`, and everything inside a group or
 * a repeater that was. formancy's `diffSchemas` decides which renames it
 * accepts, and reports each as `field.renamed`, but says nothing of the
 * paths beneath a renamed group, whose answers move with it. The review
 * reads the renames from the diff and translates the scopes beneath them
 * as the diff does; were the two to disagree, a review would offer a
 * rename formancy does not hold, or miss one it does -- so the
 * translation is held to the diff itself, over the corpus and over any
 * model, rather than to a reading of upstream's code.
 */

/** `form` read as a version's schema, failing the test where it is none. */
function schemaOf(form: unknown): FormSchema {
  const f = new Findings()
  const version = readVersion(f, form, '/form')
  if (version === undefined) throw new Error(`not a version: ${JSON.stringify(f.errors())}`)
  return version.schema
}

/** What a version holds, before its keys: a leaf, or a group or a repeater of more. */
interface Node {
  readonly type: string
  readonly fields?: readonly Node[]
}

const LEAF: fc.Arbitrary<Node> = fc.constantFrom<Node>({ type: 'text' }, { type: 'number' }, { type: 'date' })

function nodeOf(depth: number, inRows: boolean): fc.Arbitrary<Node> {
  const kinds = [LEAF]
  if (depth > 0) {
    kinds.push(fc.array(nodeOf(depth - 1, inRows), { maxLength: 3 }).map((fields) => ({ type: 'group', fields })))
    if (!inRows) kinds.push(fc.array(nodeOf(depth - 1, true), { maxLength: 3 }).map((fields) => ({ type: 'repeater', fields })))
  }
  return fc.oneof(...kinds)
}

/** What becomes of a field in the next version: kept, renamed with renamedFrom, or removed. */
type Fate = 'keep' | 'rename' | 'remove'

interface Keyed {
  readonly type: string
  readonly key: string
  readonly renamedFrom?: string
  readonly fields?: readonly Keyed[]
}

/** `nodes`, each keyed uniquely in the form. */
function keyed(nodes: readonly Node[], next: { key: number }): Keyed[] {
  return nodes.map((node) => ({ type: node.type, key: `k${next.key++}`, ...(node.fields === undefined ? {} : { fields: keyed(node.fields, next) }) }))
}

/** The next version of `fields`: each field's fate applied in turn, a new field added after each kept container's own. */
function next(fields: readonly Keyed[], fates: () => Fate, fresh: { key: number }): Keyed[] {
  return fields.flatMap((field): Keyed[] => {
    const fate = fates()
    if (fate === 'remove') return []
    const children = field.fields === undefined ? {} : { fields: [...next(field.fields, fates, fresh), { type: 'text', key: `n${fresh.key++}` }] }
    const { renamedFrom: _old, ...kept } = field
    return [fate === 'rename' ? { ...kept, key: `r${fresh.key++}`, renamedFrom: field.key, ...children } : { ...kept, ...children }]
  })
}

/** The data paths a model holds, as formancy writes them. */
const pathsOf = (schema: FormSchema): readonly string[] => modelDataPaths(schema.model)

/** What the moves claim, held to the diff and to both versions' paths. */
function heldToTheDiff(before: FormSchema, after: FormSchema): void {
  const changes = diffSchemas(before, after)
  const moves = declaredMoves(after, changes)
  const at = (kind: string) => new Set(changes.filter((change) => change.kind === kind).map((change) => change.path.slice('model.fields.'.length)))
  const removed = at('field.removed')
  const added = at('field.added')
  const [was, now] = [new Set(pathsOf(before)), new Set(pathsOf(after))]
  for (const [from, to] of moves) {
    // A move is from a path the old version held to one the new holds, and neither is what the diff calls a removal or an addition.
    expect([was.has(from), now.has(to), removed.has(from), added.has(to)], `${from} -> ${to}`).toEqual([true, true, false, false])
  }
  // Every rename the diff reports is a move, its destination where the diff says.
  for (const renamed of at('field.renamed')) expect([...moves.values()], renamed).toContain(renamed)
  // Every path the old version held and the diff did not remove is in the new one: where it was, or where a move took it.
  for (const path of was) if (!removed.has(path)) expect(now.has(moves.get(path) ?? path), path).toBe(true)
  // No two paths moved to one.
  expect(new Set(moves.values()).size).toBe(moves.size)
}

describe('declaredMoves', () => {
  // The corpus's version 3 renames the inspector's group: its name and
  // its licence move with it, though the diff reports the group alone.
  test("moves what a renamed group holds with it, as the corpus's version 3 renames the inspector's", () => {
    const [before, after] = [schemaOf(SITE_VISIT_V2), schemaOf(SITE_VISIT_V3)]
    const changes = diffSchemas(before, after)
    expect(changes.filter((change) => change.severity !== 'compatible')).toEqual([])
    expect([...declaredMoves(after, changes)]).toEqual([
      ['inspector', 'technician'],
      ['inspector.name', 'technician.name'],
      ['inspector.licence', 'technician.licence'],
    ])
    heldToTheDiff(before, after)
  })

  // A key changed without renamedFrom is a removal and an addition: the
  // diff guesses no rename, and neither may a review.
  test('moves nothing the form did not declare', () => {
    const before = schemaOf(
      formOf([
        { key: 'site', type: 'text' },
        { key: 'inspector', type: 'group', fields: [{ key: 'name', type: 'text' }] },
      ]),
    )
    const after = schemaOf(
      formOf([
        { key: 'address', type: 'text' },
        { key: 'name', type: 'text' },
        { key: 'inspector', type: 'group', fields: [] },
      ]),
    )
    expect([...declaredMoves(after, diffSchemas(before, after))]).toEqual([])
    heldToTheDiff(before, after)
  })

  // A repeater renamed takes its rows' fields with it, after `[].`, as
  // formancy writes a row's path.
  test("moves a renamed repeater's rows' fields with it", () => {
    const before = schemaOf(
      formOf([
        {
          key: 'findings',
          type: 'repeater',
          fields: [
            { key: 'area', type: 'text' },
            { key: 'hours', type: 'number' },
          ],
        },
      ]),
    )
    const after = schemaOf(
      formOf([
        {
          key: 'defects',
          type: 'repeater',
          renamedFrom: 'findings',
          fields: [
            { key: 'zone', type: 'text', renamedFrom: 'area' },
            { key: 'hours', type: 'number' },
          ],
        },
      ]),
    )
    expect([...declaredMoves(after, diffSchemas(before, after))]).toEqual([
      ['findings', 'defects'],
      ['findings[].area', 'defects[].zone'],
      ['findings[].hours', 'defects[].hours'],
    ])
    heldToTheDiff(before, after)
  })

  // Any model of groups, repeaters and pages, any field of it kept,
  // renamed or removed and new ones added: what the moves claim is what
  // the diff holds, path by path. A page scopes nothing, renamed or not.
  test('agrees with the diff over any model, any rename', () => {
    const page = fc.array(nodeOf(2, false), { maxLength: 3 }).map((fields): Node => ({ type: 'page', fields }))
    const models = fc.array(fc.oneof(nodeOf(3, false), page), { minLength: 1, maxLength: 5 })
    const fates = fc.array(fc.constantFrom<Fate>('keep', 'keep', 'rename', 'remove'), { minLength: 1, maxLength: 64 })
    fc.assert(
      fc.property(models, fates, (nodes, drawn) => {
        const fields = keyed(nodes, { key: 0 })
        let at = 0
        const after = next(fields, () => drawn[at++ % drawn.length] as Fate, { key: 0 })
        heldToTheDiff(schemaOf(formOf(fields)), schemaOf(formOf(after)))
      }),
      { numRuns: 500 },
    )
  })
})
