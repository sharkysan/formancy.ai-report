/**
 * The values a person supplies before rendering, held to the report's
 * parameters.
 *
 * A parameter is read by exactly the rules a dataset field of its type is
 * (`values.ts`), so `params.copies` is an integer however it reached the
 * report: from a parameter form, an API call or a default. Then:
 *
 * - **Defaults apply** to a parameter left out. A default is written as the
 *   format writes it -- an exact string, or a boolean -- and read by the
 *   same rules as a value.
 * - **Required is enforced.** A required parameter with neither a value nor
 *   a default is refused.
 * - **Null only where there may be none.** A parameter that is neither
 *   required nor defaulted may be null; any other is never null when an
 *   expression reads it (0009), so null for it is refused, not read as its
 *   default.
 * - **Nothing undeclared.** A value for a parameter the report does not
 *   declare is refused.
 *
 * The values are checked again here even when a parameter form checked
 * them already (plan 12.4): what reaches a render is decided by the
 * runtime, never by the browser that sent it.
 */
import { MAX_KEY_LENGTH } from '@formancy/report-spec'
import type { ParameterDef, ReportDefinition } from '@formancy/report-spec'
import { at, DataFindings, isLongKey, keyAt } from './data-errors.js'
import type { DataError } from './data-errors.js'
import { readRecord } from './input.js'
import { readValue } from './values.js'
import type { CheckedValue } from './values.js'

/** The parameters' values by id, each read as its type or null. It has no prototype, so a parameter named `constructor` is its own value. */
export type CheckedParameters = { readonly [parameter: string]: CheckedValue | null }

export type ParameterCheck = { readonly ok: true; readonly values: CheckedParameters } | { readonly ok: false; readonly errors: readonly DataError[] }

/** The value `parameter` takes when nobody supplied one; undefined when it must be supplied. */
function absent(errors: DataFindings, parameter: ParameterDef, path: string): CheckedValue | null | undefined {
  if (parameter.default !== undefined) {
    const read = readValue(parameter.type, parameter.default)
    if (read.ok) return read.value
    errors.report(path, read.code, `${parameter.id}: its default is not a ${parameter.type}: ${read.message}`)
    return undefined
  }
  if (!parameter.required) return null
  errors.report(path, 'missing-parameter', `${parameter.id}: the report requires this parameter, and it has no value and no default`)
  return undefined
}

/**
 * `values` held to `report`'s parameters, with defaults applied, or every
 * reason they are refused. `report` is one the validator accepts. A path is
 * a JSON Pointer into `values`: `/copies`.
 */
export function checkParameters(report: ReportDefinition, values: Readonly<Record<string, unknown>>): ParameterCheck {
  const errors = new DataFindings()
  const read = readRecord(values)
  if (!read.ok) return { ok: false, errors: [{ path: '', code: read.code, message: `parameters are ${read.message}` }] }
  const unreadable = new Set<string>()
  for (const problem of read.problems) {
    if (problem.key !== undefined) unreadable.add(problem.key)
    errors.report(problem.key === undefined ? '' : keyAt('', problem.key), 'not-data', problem.message)
  }
  const checked = Object.create(null) as Record<string, CheckedValue | null>
  for (const parameter of report.parameters) {
    const path = at('', parameter.id)
    if (unreadable.has(parameter.id)) continue
    if (!read.entries.has(parameter.id)) {
      const value = absent(errors, parameter, path)
      if (value !== undefined) checked[parameter.id] = value
      continue
    }
    const raw = read.entries.get(parameter.id)
    if (raw === null) {
      if (!parameter.required && parameter.default === undefined) checked[parameter.id] = null
      else {
        const why = parameter.default === undefined ? 'the report requires it' : 'it has a default; leave it out to use the default'
        errors.report(path, 'unexpected-null', `${parameter.id}: never null, because ${why}`)
      }
      continue
    }
    const value = readValue(parameter.type, raw)
    if (value.ok) checked[parameter.id] = value.value
    else errors.report(path, value.code, `${parameter.id}: ${value.message}`)
  }
  const declared = new Set(report.parameters.map(({ id }) => id))
  for (const key of read.entries.keys()) {
    if (declared.has(key)) continue
    const what = isLongKey(key) ? `a name longer than ${MAX_KEY_LENGTH} characters, which no parameter has` : 'the report declares no such parameter'
    errors.report(keyAt('', key), 'undeclared-parameter', `${what}; a report reads nothing it was not written to read`)
  }
  if (!errors.empty) return { ok: false, errors: errors.errors() }
  return { ok: true, values: Object.freeze(checked) }
}
