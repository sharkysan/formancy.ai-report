// The PDF the Studio's Preview offers, downloaded as a person downloads
// it: what every check of the browser gate that reads a printed PDF reads
// -- the journey's pictured pages (browser-test.mjs), the framework switch
// (gate-switch.mjs), an image added (gate-images.mjs), a QR-bill
// (gate-payment-part.mjs) and an e-invoice (gate-e-invoice.mjs) edited;
// the XML a final render of an e-invoice offers beside it, downloaded
// the same way (gate-e-invoice.mjs, 0065); and the Word file a printed
// render offers after them (gate-word.mjs, 0068).
// It imports no package, so its test needs nothing built.
//
// Read from the DOM: the link's address, which the accessibility tree
// holds only as text, and the link itself, clicked by its own `click()`.

import { readFile } from 'node:fs/promises'

/**
 * How many times a download is tried again at the address the link moved
 * to: chosen, not measured. Each move is a render that landed between the
 * gate's read of the link and its download; three in a row, while the gate
 * edits nothing, is a Preview that does not settle, which is a fault of its
 * own and said. The worst it costs is bounded at about four times the
 * download's wait, the page's default timeout (`WITHIN`, 30 s, in the
 * gate): reading the link waits for nothing, and a download lost to the
 * race fails at once, its link not found.
 */
export const REREADS = 3

/** The rereads made on each page the gate drives, by the page. */
const rereadsMade = new WeakMap()

/**
 * How many downloads were tried again on `page` at an address the link had
 * moved to: what the gate measures once a pass, so that a green run says
 * whether the race was lost and read again, which no check can.
 */
export const rereadsOn = (page) => rereadsMade.get(page) ?? 0

/** The Preview's links to its downloads, by their accessible names. */
const PDF_LINK = 'Download PDF'
const XML_LINK = 'Download XML'
const WORD_LINK = 'Download Word'

/**
 * Where the link of `preview`, the Preview's region, named `name` -- its
 * Download PDF unless said otherwise -- points now: its `blob:` address,
 * or null while it offers none. Read in one round trip, which waits for
 * nothing: a count and then a read of the one link counted would wait out
 * the page's timeout for a link a render took away between the two.
 */
export async function downloadAddress(preview, name = PDF_LINK) {
  const addresses = await preview.getByRole('link', { name, exact: true }).evaluateAll((links) => links.map((link) => link.href))
  return addresses.length === 1 ? addresses[0] : null
}

/**
 * The bytes of the file at `href`, a download link's, as a person
 * downloading it gets them, and the name the browser saves it under: the
 * link clicked in the page and the download read. Not fetched from its
 * `blob:` address in the page, which the demo's `connect-src 'none'`
 * refuses (0051); clicked by the element's own `click()`, which moves no
 * focus a check after it measures.
 */
async function fileBytes(page, href) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate((address) => {
      const link = [...document.querySelectorAll('a[download]')].find((anchor) => anchor.href === address)
      if (link === undefined) throw new Error(`no link downloads ${address}`)
      link.click()
    }, href),
  ])
  return { bytes: new Uint8Array(await readFile(await download.path())), fileName: download.suggestedFilename() }
}

/**
 * The file the link named `link` of `preview`, the Preview's region,
 * offers, downloaded (fileBytes), with the address it was downloaded from
 * and the name it was saved under: from `href`, where the caller read the
 * link already, or else from where the link points now. Null while it
 * offers none, or offers `besides`, an address read before: each file the
 * Preview offers has an address of its own, so one read already is not
 * read again.
 *
 * The Preview gives each PDF it prints a new address and revokes the one
 * it replaced (src/preview/pdf-view.tsx), so a render that lands between
 * the read of the link and the download takes the address read away: the
 * download fails, though the page offers a PDF. Where it fails and the
 * link points elsewhere by then, the address read was replaced, and the
 * one the link holds now is downloaded instead, up to REREADS times, each
 * counted for the page (rereadsOn); where the link is gone by then, at any
 * reread, the Preview offers none. Where it fails and the link still
 * points where it did, the page failed to give the file it offers, and
 * that is thrown as it failed.
 */
async function offered(page, preview, link, { href, besides = null } = {}) {
  let at = href === undefined ? await downloadAddress(preview, link) : href
  if (at === null || at === besides) return null
  for (let rereads = 0; ; rereads += 1) {
    try {
      return { href: at, ...(await fileBytes(page, at)) }
    } catch (error) {
      const now = await downloadAddress(preview, link)
      if (now === at) throw error
      if (now === null) return null
      if (rereads === REREADS)
        throw new Error(`the ${link} moved to another address before each of ${String(REREADS + 1)} downloads, the last from ${at}`, { cause: error })
      rereadsMade.set(page, rereadsOn(page) + 1)
      at = now
    }
  }
}

/** The PDF the Preview offers, as `offered` downloads it: `{ href, bytes, fileName }`, or null. */
export const offeredPdf = (page, preview, options) => offered(page, preview, PDF_LINK, options)

/** The XML a final render of an e-invoice offers beside its PDF (0065), as `offered` downloads it: `{ href, bytes, fileName }`, or null. */
export const offeredXml = (page, preview, options) => offered(page, preview, XML_LINK, options)

/** The Word file a printed render offers after its PDF (0068), as `offered` downloads it: `{ href, bytes, fileName }`, or null where the Preview offers none. */
export const offeredWord = (page, preview, options) => offered(page, preview, WORD_LINK, options)
