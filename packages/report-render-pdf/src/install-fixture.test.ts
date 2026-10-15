import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { QUOTATION } from '@formancy/report-corpus'
import { expect, test } from 'vitest'

/**
 * The install gate's consumer renders a copy of the quotation starter,
 * because the corpus it comes from is never published
 * (`scripts/install-fixture/quotation.ts`). A copy is a second place for one
 * fact; this holds it to the starter, so that the README's example runs on
 * the report the README's picture shows.
 */

const copy = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'scripts', 'install-fixture', 'quotation.ts')

// A starter that changed without its copy would leave the install gate
// rendering a report nobody maintains any more.
test("the install gate's quotation is the quotation starter", async () => {
  const { quotation, quotationData } = (await import(pathToFileURL(copy).href)) as { quotation: unknown; quotationData: unknown }
  expect(quotation).toEqual(QUOTATION.report)
  expect(quotationData).toEqual(QUOTATION.data)
})
