/**
 * Where a rename the form's author declared moved what a version held
 * (0048), read from formancy's `diffSchemas`, never guessed.
 *
 * The diff names a field by its data path, decides which `renamedFrom` it
 * accepts and reports each as `field.renamed` at the new path, and reports
 * a field it matched no other way as `field.added`. It says nothing of the
 * paths beneath a renamed group or repeater, whose answers move with it.
 * So the moves are read from what the diff reports, and the scopes
 * beneath a container translated as the diff translates them, by the key
 * each container had before -- its `renamedFrom`, or its key -- which
 * `review-moves.test.ts` holds to the diff itself over any model.
 */
import type { Change, FieldDef, FormSchema } from '@formancy/spec'

const FIELDS = 'model.fields.'

/** The data paths the diff reports a change of `kind` at. */
function reported(changes: readonly Change[], kind: string): ReadonlySet<string> {
  return new Set(changes.filter((change) => change.kind === kind && change.path.startsWith(FIELDS)).map((change) => change.path.slice(FIELDS.length)))
}

/**
 * Each data path of the version before that a declared rename moved, and
 * where `after` holds it: a field renamed itself, and everything a renamed
 * group or repeater holds, after a dot or a repeater's `[].` as formancy
 * writes a path. `changes` are `diffSchemas(before, after)`. A path that
 * stayed where it was, or that the diff calls removed, is not in it.
 */
export function declaredMoves(after: FormSchema, changes: readonly Change[]): ReadonlyMap<string, string> {
  const renamed = reported(changes, 'field.renamed')
  const added = reported(changes, 'field.added')
  const moves = new Map<string, string>()
  const walk = (fields: readonly FieldDef[], scope: string, beforeScope: string): void => {
    for (const def of fields) {
      // A page scopes nothing: its fields are its scope's.
      if (def.type === 'page') {
        walk(def.fields ?? [], scope, beforeScope)
        continue
      }
      const path = `${scope}${def.key}`
      const from = renamed.has(path) ? `${beforeScope}${def.renamedFrom as string}` : added.has(path) ? undefined : `${beforeScope}${def.key}`
      if (from !== undefined && from !== path) moves.set(from, path)
      if (def.type === 'group' || def.type === 'repeater') {
        const marker = def.type === 'repeater' ? '[].' : '.'
        walk(def.fields ?? [], `${path}${marker}`, `${beforeScope}${def.renamedFrom ?? def.key}${marker}`)
      }
    }
  }
  walk(after.model.fields, '', '')
  return moves
}

/** What the diff reports at a data path, as kinds: what an item says the version did there. */
export function changesAt(changes: readonly Change[], path: string): ReadonlySet<string> {
  return new Set(changes.filter((change) => change.path === `${FIELDS}${path}`).map((change) => change.kind))
}
