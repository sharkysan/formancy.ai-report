import {
  expectation,
  readPdf,
  SITE_VISIT_HIGH,
  SITE_VISIT_REPORT,
  SITE_VISIT_SUBMISSION_V1,
  SITE_VISIT_V1,
  SITE_VISIT_V2,
  verify,
} from '@formancy/report-corpus'
import type { PdfTextItem } from '@formancy/report-corpus'
import { renderPdf } from '@formancy/report-render-pdf'
import { resolveReport } from '@formancy/report-runtime'
import { schemaHash } from '@formancy/spec'
import { describe, expect, test } from 'vitest'
import { readSubmission } from './read.js'

/**
 * A reprint of a form's submission uses the labels of the version that
 * collected it, never today's (plan 12.2), proved on the PDF it produced,
 * read back with PDF.js (0003) -- not on the data handed over, and not on
 * the document the renderer was given.
 */

/** Long enough for a render on a runner busy with other suites; one that hangs still fails. */
const TIMEOUT = 120_000

/** The items printed on the line of `item`, on its page: their tops within half a point. */
const lineOf = (items: readonly PdfTextItem[], item: PdfTextItem): string[] =>
  items.filter((other) => Math.abs(other.top - item.top) < 0.5).map((other) => other.text.trim())

describe('a submission printed', () => {
  // The site visit's version 2 rewrote the label of a high severity,
  // "Hoch" to "Kritisch". A version-1 visit, read against version 1 and
  // printed, prints "Hoch" on every finding of high severity and
  // "Kritisch" nowhere; every finding is a row, in place, with the
  // header above the table and the total under it (the corpus's checks);
  // and the manifest kept beside the PDF names the version by the hash the
  // bridge computed, version 1's and not version 2's.
  test(
    'prints a version-1 visit with version 1’s labels, every finding a row, and names version 1 in its manifest',
    async () => {
      const read = readSubmission(SITE_VISIT_REPORT, { form: SITE_VISIT_V1, submission: SITE_VISIT_SUBMISSION_V1 })
      if (!read.ok) throw new Error(`refused: ${JSON.stringify(read.errors)}`)
      const resolution = resolveReport(SITE_VISIT_REPORT, read.data, { mode: 'final', creationDate: '2026-10-22T08:00:00Z', timeZone: 'Europe/Zurich' })
      if (!resolution.ok) throw new Error(`refused: ${JSON.stringify(resolution.errors)}`)
      expect(resolution.manifest.source).toEqual({
        provider: 'formancy-form',
        submissions: [{ id: SITE_VISIT_SUBMISSION_V1.id, form: 'site-visit', formHash: schemaHash(SITE_VISIT_V1) }],
      })
      expect(schemaHash(SITE_VISIT_V1)).not.toBe(schemaHash(SITE_VISIT_V2))

      const pdf = await readPdf(await renderPdf(resolution.document, { maxPages: 10 }))
      const stated = {
        maxPagesExpected: 2,
        exactText: ['Ergebnis: Reparaturen nötig (repair)', 'Sicherheit: Mittel', 'Dach geprüft', 'Inspektor: Anna Schär, Ausweis BE-4471'],
      }
      expect(
        verify(
          {
            id: 'site-visit-v1',
            title: 'A version-1 site visit',
            document: resolution.document,
            maxPages: 10,
            expect: expectation(resolution.document, stated),
          },
          pdf,
        ),
      ).toEqual([])

      const items = pdf.pages.flatMap((page) => page.items.map((item) => ({ ...item, top: item.top + page.number * 10_000 })))
      const findings = (SITE_VISIT_SUBMISSION_V1.data['findings'] as readonly { readonly ref: string; readonly severity: string }[]).map(
        ({ ref, severity }) => {
          const key = items.find((item) => item.text.trim() === ref)
          return [ref, key === undefined ? [] : lineOf(items, key)] as const
        },
      )
      for (const [ref, line] of findings) {
        const severity = (SITE_VISIT_SUBMISSION_V1.data['findings'] as readonly { readonly ref: string; readonly severity: string }[]).find(
          (finding) => finding.ref === ref,
        )?.severity
        expect(line, ref).toContain(severity === 'high' ? SITE_VISIT_HIGH.v1 : 'Niedrig')
      }
      expect(items.filter((item) => item.text.trim() === SITE_VISIT_HIGH.v1)).toHaveLength(4)
      expect(items.some((item) => item.text.includes(SITE_VISIT_HIGH.v2))).toBe(false)
    },
    TIMEOUT,
  )
})
