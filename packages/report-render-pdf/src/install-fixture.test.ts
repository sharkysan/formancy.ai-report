import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { LOGO, QUOTATION } from '@formancy/report-corpus'
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
// rendering a report nobody maintains any more. The copy carries the
// firm's mark too (0032), the bytes the host approved and the digest the
// report declares them by: a mark copied wrong would print, from the packed
// packages, a drawing nobody reviewed, or be refused as missing.
test("the install gate's quotation is the quotation starter, with its mark", async () => {
  const { quotation, quotationData, logo } = (await import(pathToFileURL(copy).href)) as {
    quotation: unknown
    quotationData: unknown
    logo: { digest: unknown; bytes: unknown } | undefined
  }
  expect(quotation).toEqual(QUOTATION.report)
  expect(quotationData).toEqual(QUOTATION.data)
  expect(logo === undefined ? undefined : { digest: logo.digest, bytes: [...(logo.bytes as Uint8Array)] }).toEqual({
    digest: LOGO.digest,
    bytes: [...LOGO.bytes],
  })
})
