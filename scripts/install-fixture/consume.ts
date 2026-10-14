/*
 * A consumer that knows nothing about the workspace.
 *
 * Copied into a temporary npm project by install-test.mjs, installed from the
 * packed tarballs, type-checked with skipLibCheck OFF and run under Node. What
 * is on trial is that the published entry points resolve, with the types that
 * shipped.
 */
import { checkSpecVersion, REPORT_FORMAT, REPORT_SPEC_VERSION } from '@formancy/report-spec'
import type { SpecVersionCheck } from '@formancy/report-spec'

// The published code carries the refusal, not only the source: a formancy
// form handed over as a report is named as a form, and the version this
// package reads is read. A type-only export that lost the union, or a dist
// that lost the check, fails here rather than in a host.
const form: SpecVersionCheck = checkSpecVersion({ specVersion: '3', id: 'order', title: 'Order', model: { fields: [] } })
if (form.ok || form.code !== 'not-a-report') throw new Error('a formancy form was not refused as not a report')
const report: SpecVersionCheck = checkSpecVersion({ reportSpecVersion: REPORT_SPEC_VERSION })
if (!report.ok) throw new Error(`reportSpecVersion ${REPORT_SPEC_VERSION} was not read: ${report.message}`)

console.log(`ok: ${REPORT_FORMAT} ${REPORT_SPEC_VERSION}; a form refused, a report read`)
