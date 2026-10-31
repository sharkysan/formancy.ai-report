/**
 * A form version, read (0042): the document the host handed over, copied
 * as data, held to the pinned `@formancy/spec`'s validator, and named by
 * the `schemaHash` computed here of exactly that copy -- never by a hash
 * handed over, which can only be checked against it. What the version's
 * model holds is indexed by scope once, for the fields a report reads and
 * the answers a submission holds, so that no answer re-indexes a scope:
 * the scopes give exactly the data paths formancy's `modelDataPaths`
 * writes (`version.test.ts`).
 *
 * Report accepts what upstream's validator accepts and adds no reading of
 * its own (0004): a `specVersion` it does not know is refused with both
 * versions named, before anything else is read, and every other refusal
 * is formancy's, with its code.
 */
import { isFieldKey } from '@formancy/report-spec'
import { schemaHash, SPEC_VERSIONS } from '@formancy/spec'
import type { FieldDef, FormSchema } from '@formancy/spec'
import { validateSchema } from '@formancy/spec/validate'
import type { Findings } from './errors.js'
import { at } from './errors.js'
import { copyJson, formKeyAt } from './json.js'

/** One scope of a submission: the submission's answers, a group's, or a repeater's row. Its fields by key, pages looked through. */
export type Scope = ReadonlyMap<string, FieldDef>

export interface Version {
  /** The copy that was validated and hashed: what every label is read from. */
  readonly schema: FormSchema
  /** `schemaHash` of `schema`: the version's identity. */
  readonly hash: string
  /** The form's id, as this version writes it: a version may change it. */
  readonly id: string
  /** The submission's own scope. */
  readonly answers: Scope
  /** Each group's and each repeater's scope, by its field: a group's answers, a repeater's row. */
  readonly within: ReadonlyMap<FieldDef, Scope>
}

/** A segment of a pointer that names the form's structure: an index, or a field key, as formancy writes one. */
const STRUCTURAL = (segment: string): boolean => /^(0|[1-9]\d{0,8})$/.test(segment) || isFieldKey(segment)

/**
 * Where in the form at `path` a pointer formancy's validator writes
 * points, as a refusal names it: cut before its first segment that is
 * neither an index nor a field key -- a catalogue's locale, a message's id,
 * which may be a name -- as a submission's path is cut (`answerAt`). So no
 * path a refusal names grows with what the form holds: each segment it
 * keeps is at most a field key's 64 characters, and there are no more of
 * them than the `MAX_DOCUMENT_DEPTH` levels the copy reads.
 */
function pointedAt(path: string, pointer: string): string {
  let named = path
  for (const segment of pointer.split('/').slice(1)) {
    if (!STRUCTURAL(segment)) break
    named = `${named}/${segment}`
  }
  return named
}

/** The fields of a scope by key, a page's fields among them: a page is presentation and scopes nothing, as `modelDataPaths` writes it. */
function scopeOf(fields: readonly FieldDef[] | undefined, into = new Map<string, FieldDef>()): Map<string, FieldDef> {
  for (const field of fields ?? []) {
    if (field.type === 'page') scopeOf(field.fields, into)
    else into.set(field.key, field)
  }
  return into
}

/** `fields`' scope, and every group's and repeater's within it, each indexed once into `within`. */
function indexed(fields: readonly FieldDef[] | undefined, within: Map<FieldDef, Scope>): Scope {
  const scope = scopeOf(fields)
  for (const field of scope.values()) if (field.type === 'group' || field.type === 'repeater') within.set(field, indexed(field.fields, within))
  return scope
}

const VERSIONS = SPEC_VERSIONS.map((version) => `"${version}"`).join(', ')

/**
 * `raw`, at `path` in what the host handed over, read as a form version, or
 * undefined after reporting why it is not one.
 */
export function readVersion(f: Findings, raw: unknown, path: string): Version | undefined {
  const copy = copyJson(raw, path, formKeyAt)
  if (!copy.ok) {
    f.report(copy.path, 'not-data', copy.message)
    return undefined
  }
  const document = copy.value
  const declared =
    typeof document === 'object' && document !== null && !Array.isArray(document) ? (document as Record<string, unknown>)['specVersion'] : undefined
  if (typeof declared === 'string' && !(SPEC_VERSIONS as readonly string[]).includes(declared)) {
    const shown = /^\d{1,8}$/.test(declared) ? `"${declared}"` : 'a version that is no string of digits'
    f.report(
      at(path, 'specVersion'),
      'unsupported-spec-version',
      `specVersion ${shown} is not one this release reads: it reads formancy's spec versions ${VERSIONS}, as its @formancy/spec does, and a form of another is refused whole, never partly read`,
    )
    return undefined
  }
  const validation = validateSchema(document)
  if (!validation.valid) {
    for (const error of validation.errors) {
      const where = pointedAt(path, error.path)
      // Once for each of formancy's codes where it points: two of one code in one catalogue are one refusal.
      f.report(where, 'invalid-form', `formancy's validator refuses the form: ${error.code}`, `invalid-form ${where} ${error.code}`)
    }
    return undefined
  }
  const { schema } = validation
  const within = new Map<FieldDef, Scope>()
  return { schema, hash: schemaHash(schema), id: schema.id, answers: indexed(schema.model.fields, within), within }
}
