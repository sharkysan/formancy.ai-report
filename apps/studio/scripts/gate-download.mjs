// The PDF the Studio's Preview offers, downloaded as a person downloads
// it: what every check of the browser gate that reads a printed PDF reads
// -- the journey's pictured pages (browser-test.mjs), the framework switch
// (gate-switch.mjs), an image added (gate-images.mjs), a QR-bill
// (gate-payment-part.mjs) and an e-invoice (gate-e-invoice.mjs) edited.
// It imports no package, so its test needs nothing built.
//
// Read from the DOM: the link's address, which the accessibility tree
// holds only as text, and the link itself, clicked by its own `click()`.

import { readFile } from 'node:fs/promises'

/**
 * How many times a download is tried again at the address the link moved
 * to. Each move is a render that landed between the gate's read of the
 * link and its download; three in a row, while the gate edits nothing, is
 * a Preview that does not settle, which is a fault of its own and said.
 */
export const REREADS = 3

/** Where the Download PDF link of `preview`, the Preview's region, points now: its `blob:` address, or null while it offers no PDF. */
export async function downloadAddress(preview) {
  const link = preview.getByRole('link', { name: 'Download PDF', exact: true })
  return (await link.count()) === 1 ? await link.evaluate((anchor) => anchor.href) : null
}

/**
 * The bytes of the PDF at `href`, a Download PDF link's, as a person
 * downloading it gets them: the link clicked in the page and the download
 * read. Not fetched from its `blob:` address in the page, which the demo's
 * `connect-src 'none'` refuses (0051); clicked by the element's own
 * `click()`, which moves no focus a check after it measures.
 */
async function pdfBytes(page, href) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate((address) => {
      const link = [...document.querySelectorAll('a[download]')].find((anchor) => anchor.href === address)
      if (link === undefined) throw new Error(`no link downloads ${address}`)
      link.click()
    }, href),
  ])
  return new Uint8Array(await readFile(await download.path()))
}

/**
 * The PDF `preview`, the Preview's region, offers, downloaded (pdfBytes),
 * with the address it was downloaded from: from `href`, where the caller
 * read its Download PDF already, or else from where the link points now.
 * Null while it offers none, or offers `besides`, an address read before:
 * each PDF the Preview offers has an address of its own, so one read
 * already is not read again.
 *
 * The Preview gives each PDF it prints a new address and revokes the one
 * it replaced (src/preview/pdf-view.tsx), so a render that lands between
 * the read of the link and the download takes the address read away: the
 * download fails, though the page offers a PDF. Where it fails and the
 * link points elsewhere by then, the address read was replaced, and the
 * one the link holds now is downloaded instead, up to REREADS times; where
 * the link is gone by then, the Preview offers none. Where it fails and the
 * link still points where it did, the page failed to give the PDF it
 * offers, and that is thrown as it failed.
 */
export async function offeredPdf(page, preview, { href, besides = null } = {}) {
  let at = href === undefined ? await downloadAddress(preview) : href
  if (at === besides) return null
  for (let rereads = 0; at !== null; rereads += 1) {
    try {
      return { href: at, bytes: await pdfBytes(page, at) }
    } catch (error) {
      const now = await downloadAddress(preview)
      if (now === at) throw error
      if (rereads === REREADS)
        throw new Error(`the Download PDF moved to another address before each of ${String(REREADS + 1)} downloads, the last from ${at}`, { cause: error })
      at = now
    }
  }
  return null
}
