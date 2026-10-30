import { openReportSession } from '@formancy/report-core'
import type { ReportSession } from '@formancy/report-core'
import {
  expectation,
  readPdf,
  SITE_VISIT_STARTER,
  SITE_VISIT_SUBMISSION_V2,
  SITE_VISIT_SUBMISSION_V3,
  SITE_VISIT_V2,
  SITE_VISIT_V3,
  verify,
} from '@formancy/report-corpus'
import { renderPdf } from '@formancy/report-render-pdf'
import { resolveReport } from '@formancy/report-runtime'
import type { ReportDefinition } from '@formancy/report-spec'
import { schemaHash } from '@formancy/spec'
import { describe, expect, test } from 'vitest'
import { readSubmission } from './read.js'
import { reviewFormVersion } from './review.js'
import type { FormReview } from './review.js'

/**
 * A version that moved a field the report prints is refused until its
 * author reviews it, and then prints the field from where it moved
 * (0048), proved on the PDF it produced, read back with PDF.js (0003):
 * not on the data the review's resolution lets through, and not on the
 * document the renderer was given.
 */

/** Long enough for a render on a runner busy with other suites; one that hangs still fails. */
const TIMEOUT = 120_000

/** The review of version 3 for `report`, made from version 2, failing the test where it was refused. */
function reviewOf(report: ReportDefinition): Extract<FormReview, { ok: true }> {
  const review = reviewFormVersion(report, { form: SITE_VISIT_V3, versions: [SITE_VISIT_V2] })
  if (!review.ok) throw new Error(`refused: ${JSON.stringify(review.errors)}`)
  return review
}

/** Applies the first resolution of the first item that blocks, as a host applies it: against the hash it was computed for, one undo step. */
function resolveFirst(session: ReportSession): void {
  const item = reviewOf(session.document()).items.find((each) => each.blocks)
  const resolution = item?.resolutions[0]
  if (resolution === undefined) throw new Error('nothing to resolve')
  expect([resolution.kind, resolution.declared]).toEqual(['follow-rename', true])
  const outcome = session.apply(resolution.descriptor, { expectedHash: resolution.expectedHash, label: 'follow-rename' })
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.message}`)
}

describe('a version that moved a printed field, reviewed', () => {
  // The corpus's version 3 renamed the inspector's group the
  // technician's, declared. The starter made from version 2 reads the
  // name and the licence at `inspector.*`: a version-3 visit is refused,
  // both fields named, until reviewed. The review offers the declared
  // rename first, for each; applied, one at a time against the report it
  // was computed for, the same visit prints the technician's name and
  // licence from their new paths, and its manifest names version 3. A
  // version-2 visit goes on printing its inspector.
  test(
    'refuses a version-3 visit, and prints it once the declared rename is followed',
    async () => {
      const starter = SITE_VISIT_STARTER.report
      const before = readSubmission(starter, { form: SITE_VISIT_V3, submission: SITE_VISIT_SUBMISSION_V3 })
      expect(before.ok ? [] : before.errors.map((error) => `${error.code} ${error.path}`)).toEqual([
        'version-lacks-field /datasets/header/fields/5/form',
        'version-lacks-field /datasets/header/fields/6/form',
      ])

      const review = reviewOf(starter)
      expect(review.status).toBe('blocked')
      expect(review.items.map((item) => [item.field, item.change, item.blocks, item.resolutions[0]?.kind])).toEqual([
        ['name', 'field.renamed', true, 'follow-rename'],
        ['licence', 'field.renamed', true, 'follow-rename'],
      ])

      const opening = openReportSession(starter)
      if (!opening.ok) throw new Error('the starter did not open')
      const { session } = opening
      resolveFirst(session)
      resolveFirst(session)
      expect(reviewOf(session.document()).status).toBe('compatible')
      const reviewed = session.document()

      const read = readSubmission(reviewed, { form: SITE_VISIT_V3, submission: SITE_VISIT_SUBMISSION_V3 })
      if (!read.ok) throw new Error(`refused: ${JSON.stringify(read.errors)}`)
      const resolution = resolveReport(reviewed, read.data, { mode: 'final', creationDate: '2026-10-22T08:00:00Z', timeZone: 'Europe/Zurich' })
      if (!resolution.ok) throw new Error(`refused: ${JSON.stringify(resolution.errors)}`)
      expect(resolution.manifest.source).toEqual({
        provider: 'formancy-form',
        submissions: [{ id: SITE_VISIT_SUBMISSION_V3.id, form: 'site-visit', formHash: schemaHash(SITE_VISIT_V3) }],
      })

      const pdf = await readPdf(await renderPdf(resolution.document, { maxPages: 10 }))
      const stated = {
        maxPagesExpected: 1,
        exactText: ['Objekt: Kramgasse 49, 3011 Bern', 'Name: Lea Gerber', 'Ausweis: BE-6203', 'Zusammenfassung: Keine dringenden Befunde.', '1 / 1'],
      }
      expect(
        verify(
          {
            id: 'site-visit-v3-reviewed',
            title: 'A version-3 visit, after the rename was followed',
            document: resolution.document,
            maxPages: 10,
            expect: expectation(resolution.document, stated),
          },
          pdf,
        ),
      ).toEqual([])
      const words = pdf.pages.flatMap((page) => page.items.map((item) => item.text.trim()))
      expect(words.some((word) => word.includes('Marc Rüegg'))).toBe(false)

      const earlier = readSubmission(reviewed, { form: SITE_VISIT_V2, submission: SITE_VISIT_SUBMISSION_V2 })
      expect(earlier.ok ? [earlier.data.header?.['name'], earlier.data.header?.['licence']] : earlier.errors).toEqual(['Marc Rüegg', 'BE-5120'])
    },
    TIMEOUT,
  )
})
