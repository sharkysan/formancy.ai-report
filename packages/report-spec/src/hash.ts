/**
 * The content hash that names a report definition.
 */
import { schemaHash } from '@formancy/spec'
import { describeErrors } from './errors.js'
import type { ReportDefinition } from './types.js'
import { validateReport } from './validate.js'
import { REPORT_FORMAT } from './version.js'

/**
 * A 64-character lower-case hex SHA-256 of the report's canonical JSON,
 * taken over an envelope that names the format and its version, so a
 * formancy form and a report whose bodies are equal never share a hash.
 *
 * Only a valid report has a hash. The report is validated first, and a
 * RangeError naming every error is thrown for one the validator refuses,
 * whatever its type says: a hash is what publication pins, and pinning a
 * report the runtime would refuse helps nobody. What is hashed is the copy
 * validation read, so a getter never runs and the hash is of what was
 * checked.
 *
 * Canonicalisation is formancy's (`@formancy/spec`), not a second one: keys
 * sorted, so key order never changes the hash. It builds each object by
 * assignment, so an own `__proto__` key would vanish from it; the validator
 * refuses such a key first.
 */
export function reportHash(report: ReportDefinition): string {
  const outcome = validateReport(report)
  if (!outcome.valid) throw new RangeError(`only a valid report has a hash, and this one is not: ${describeErrors(outcome.errors)}`)
  return schemaHash({ format: REPORT_FORMAT, reportSpecVersion: outcome.report.reportSpecVersion, report: outcome.report })
}
