import { SITE_VISIT_STARTER, SITE_VISIT_STARTER_OPTIONS, SITE_VISIT_SUBMISSION_V2, SITE_VISIT_V2 } from '@formancy/report-corpus'
import { reportHash } from '@formancy/report-spec'
import { schemaHash } from '@formancy/spec'
import { describe, expect, test } from 'vitest'
import { generate, generatedFrom, readData, readOne } from './test-support.js'

/**
 * The Studio's site visit starter is what the generator writes of the
 * corpus's site visit form, version 2 (0045), held here because the corpus
 * cannot import the bridge -- the bridge's tests import the corpus. The
 * corpus holds the draft and its data written out as data; were the two to
 * drift, the Studio would open, and its gates prove, a starter the
 * generator no longer makes, or data the bridge no longer reads.
 */
describe('the site visit starter', () => {
  // The starter's report is the generated draft, to its hash, its
  // provenance naming version 2 by the hash computed of it.
  test('is the report generateReport writes of the site visit, version 2, to its hash', () => {
    const { report } = generatedFrom(generate(SITE_VISIT_V2, SITE_VISIT_STARTER_OPTIONS))
    expect(reportHash(SITE_VISIT_STARTER.report)).toBe(reportHash(report))
    expect(SITE_VISIT_STARTER.report).toEqual(report)
    expect(SITE_VISIT_STARTER.report.provenance).toEqual({ kind: 'form', form: 'site-visit', formHash: schemaHash(SITE_VISIT_V2) })
  })

  // Its data is the corpus's version-2 visit, read into it by the bridge:
  // the labels, the digits and the boxes the Studio prints are the
  // bridge's reading, not a hand's.
  test('prints the corpus’s version-2 visit, as the bridge reads it into the draft', () => {
    expect(readData(readOne(SITE_VISIT_STARTER.report, { form: SITE_VISIT_V2, submission: SITE_VISIT_SUBMISSION_V2 }))).toEqual(SITE_VISIT_STARTER.data)
  })
})
