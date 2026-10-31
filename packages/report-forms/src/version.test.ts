import { SITE_VISIT_V1, SITE_VISIT_V2 } from '@formancy/report-corpus'
import { modelDataPaths } from '@formancy/spec'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { Findings } from './errors.js'
import { formOf } from './test-support.js'
import { readVersion } from './version.js'
import type { Scope, Version } from './version.js'

/**
 * The scopes a version is read by are the bridge's own index of its model
 * (`version.ts`), which a field's path is looked up in and a submission is
 * walked by. formancy writes the same model's data paths with
 * `modelDataPaths`. Were the two to disagree -- a page scoping its fields,
 * a group looked through, a repeater's rows read as the submission's -- a
 * field would be found where formancy stores no answer, or not found where
 * it does, and nothing else would say so; at the next formancy pin least
 * of all.
 */

/** The data paths the bridge's scopes give `version`, written as formancy writes them: a group's child after a dot, a repeater's after `[].`. */
function pathsOf(version: Version): string[] {
  const paths: string[] = []
  const walk = (scope: Scope, prefix: string): void => {
    for (const [key, def] of scope) {
      paths.push(`${prefix}${key}`)
      const inner = version.within.get(def)
      if (inner !== undefined) walk(inner, `${prefix}${key}${def.type === 'repeater' ? '[]' : ''}.`)
    }
  }
  walk(version.answers, '')
  return paths
}

/** `form` read as a version, failing the test where it is not one. */
function versionOf(form: unknown): Version {
  const f = new Findings()
  const version = readVersion(f, form, '/form')
  if (version === undefined) throw new Error(`not a version: ${JSON.stringify(f.errors())}`)
  return version
}

/** A field of the model, before its key is given. */
interface Node {
  readonly type: string
  readonly fields?: readonly Node[]
  readonly label?: string
}

const LEAF: fc.Arbitrary<Node> = fc.constantFrom<Node>(
  { type: 'text' },
  { type: 'number' },
  { type: 'checkbox' },
  { type: 'date' },
  { type: 'static', label: 'Read me' },
)

/** A field `depth` containers deep at most, as formancy nests them: a group anywhere, a repeater in no repeater. */
function nodeOf(depth: number, inRows: boolean): fc.Arbitrary<Node> {
  const kinds = [LEAF]
  if (depth > 0) {
    kinds.push(fieldsOf(depth - 1, inRows).map((fields) => ({ type: 'group', fields })))
    if (!inRows) kinds.push(fieldsOf(depth - 1, true).map((fields) => ({ type: 'repeater', fields })))
  }
  return fc.oneof(...kinds)
}

const fieldsOf = (depth: number, inRows: boolean): fc.Arbitrary<readonly Node[]> => fc.array(nodeOf(depth, inRows), { maxLength: 4 })

/** A model's fields: any of those, and pages of them, a page at the top alone. */
const MODELS = fc.array(
  fc.oneof(
    nodeOf(3, false),
    fieldsOf(2, false).map((fields): Node => ({ type: 'page', fields })),
  ),
  { maxLength: 5 },
)

/** `nodes` with a key each, unique in the form. */
function keyed(nodes: readonly Node[], next = { key: 0 }): unknown[] {
  return nodes.map((node) => ({ ...node, key: `k${next.key++}`, ...(node.fields === undefined ? {} : { fields: keyed(node.fields, next) }) }))
}

describe('a version’s scopes', () => {
  // The corpus's site visit holds a group, a repeater, a matrix and ticked
  // boxes: the forms the bridge's own tests print.
  test('give the corpus’s forms formancy’s own data paths', () => {
    for (const form of [SITE_VISIT_V1, SITE_VISIT_V2]) {
      const version = versionOf(form)
      expect(pathsOf(version)).toEqual(modelDataPaths(version.schema.model))
    }
  })

  // Any model formancy's validator accepts, of groups in groups, repeaters
  // of groups and pages of either, gives the paths formancy writes.
  test('give any model formancy’s own data paths', () => {
    fc.assert(
      fc.property(MODELS, (nodes) => {
        const version = versionOf(formOf(keyed(nodes)))
        expect(pathsOf(version)).toEqual(modelDataPaths(version.schema.model))
      }),
      { numRuns: 500 },
    )
  })
})
