import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { offeredPdf, REREADS } from './gate-download.mjs'

/**
 * The page the browser gate drives, standing in for Playwright's, with
 * the Preview's one Download PDF link in jsdom's document. `evaluate` runs
 * the gate's own page function there, as Chromium would; a click on the
 * link downloads, to a file, what its address holds at that moment, and
 * `waitForEvent('download')` hands the download over as Playwright does,
 * its `path()` throwing for an address that holds nothing. `print` is the
 * Preview printing anew, as pdf-view.tsx does: a new address on the link,
 * and the one it replaced revoked. It puts a new link in the old one's
 * place, where React changes the one link's attribute: jsdom keeps the
 * first `blob:` address an anchor had as its `href` however the attribute
 * changes after (its `reinitializeURL`), and Chromium reads the attribute.
 * `beforeEach` runs before each page function, where a render the gate
 * does not wait for would land.
 */
function previewPage(directory) {
  const held = new Map()
  const waiting = []
  let printed = 0
  let downloads = 0
  const current = () => document.querySelector('a[download]')
  const stub = {
    beforeEach: () => undefined,
    reads: 0,
    get downloads() {
      return downloads
    },
    waitForEvent: (name) => (name === 'download' ? new Promise((resolve) => waiting.push(resolve)) : Promise.reject(new Error(`no ${name} event`))),
    evaluate: async (run, argument) => {
      stub.beforeEach()
      return run(argument)
    },
    print(text) {
      printed += 1
      const address = `blob:http://localhost:4392/report/${String(printed)}`
      const replaced = current()
      held.set(address, new TextEncoder().encode(text))
      const link = document.createElement('a')
      link.download = 'quotation.pdf'
      link.textContent = 'Download PDF'
      link.setAttribute('href', address)
      link.addEventListener('click', (event) => {
        event.preventDefault()
        const bytes = held.get(link.href)
        downloads += 1
        const file = join(directory, `${String(printed)}-${String(downloads)}.pdf`)
        const download = {
          path: async () => {
            if (bytes === undefined) throw new Error('download.path: Download failed')
            await writeFile(file, bytes)
            return file
          },
        }
        for (const resolve of waiting.splice(0)) resolve(download)
      })
      document.body.replaceChildren(link)
      if (replaced !== null) held.delete(replaced.href)
      return address
    },
    /** The address revoked and left on the link: a page that offers a PDF it no longer holds. */
    revoke: () => held.delete(current().href),
    /** The link taken away, as a Preview that stopped offering a PDF. */
    remove: () => current().remove(),
    preview: {
      getByRole: (role, { name }) => {
        const found = () => [current()].filter((link) => role === 'link' && link !== null && link.textContent === name)
        return {
          count: async () => found().length,
          evaluate: async (run) => {
            stub.reads += 1
            return run(found()[0])
          },
        }
      },
    },
  }
  document.body.replaceChildren()
  return stub
}

const text = (pdf) => new TextDecoder().decode(pdf.bytes)

let directory
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'gate-download-'))
})
afterAll(async () => {
  await rm(directory, { recursive: true, force: true })
})

// The browser gate's flake on #60, #71 and #74: the Preview printed again between the gate's read
// of Download PDF and its download, replaced the link's address and revoked the one read, and the
// gate stopped with "no link downloads blob:…" rather than read the newer PDF it now offered.
test('reads the link again where the Preview replaced and revoked its address between the read and the download', async () => {
  const page = previewPage(directory)
  const first = page.print('the PDF first offered')
  const newer = page.print('the PDF printed after it')
  const pdf = await offeredPdf(page, page.preview, { href: first })
  expect(pdf?.href).toBe(newer)
  expect(text(pdf)).toBe('the PDF printed after it')
})

// The same race with the read inside: a render landing between offeredPdf's own read and its
// download is read again too.
test('reads it again where the render lands after its own read', async () => {
  const page = previewPage(directory)
  page.print('the PDF first offered')
  let landed = false
  page.beforeEach = () => {
    if (!landed) page.print('the PDF printed after it')
    landed = true
  }
  const pdf = await offeredPdf(page, page.preview)
  expect(text(pdf)).toBe('the PDF printed after it')
  expect(page.downloads).toBe(1)
})

// A reread after any failure would make a Preview that offers a PDF it no longer holds look like a
// race, and wait on it: a download that fails at the address still on the link is the page's own
// failure, thrown as it was, after one look at the link.
test('throws a failed download whose address is still on the link, as it failed, without trying again', async () => {
  const page = previewPage(directory)
  const only = page.print('the PDF offered')
  page.revoke()
  await expect(offeredPdf(page, page.preview, { href: only })).rejects.toThrow('download.path: Download failed')
  expect(page.downloads).toBe(1)
  expect(page.reads).toBe(1)
})

// A Preview that prints anew before every download would keep a reread going for as long as it
// does: the rereads stop after REREADS, and the gate says why rather than wait.
test(`gives up after ${String(REREADS)} rereads where the link moves before every download`, async () => {
  const page = previewPage(directory)
  const first = page.print('printed 1')
  let printed = 1
  page.beforeEach = () => {
    printed += 1
    page.print(`printed ${String(printed)}`)
  }
  await expect(offeredPdf(page, page.preview, { href: first })).rejects.toThrow(
    `the Download PDF moved to another address before each of ${String(REREADS + 1)} downloads`,
  )
  expect(page.reads).toBe(REREADS + 1)
})

// A Preview that took its link away -- a refusal shown where the paper was -- offers no PDF, which
// is what the gate's waits wait through; thrown, it would stop the gate in a state it waits for.
test('is null where the link is gone by the download', async () => {
  const page = previewPage(directory)
  const only = page.print('the PDF offered')
  page.remove()
  expect(await offeredPdf(page, page.preview, { href: only })).toBeNull()
})

// An address read before is a PDF read before: downloaded again, a wait for the next PDF would read
// the last one over and over, and a check that the next one holds an edit would read the last.
test('is null, downloading nothing, where the link offers the address read before', async () => {
  const page = previewPage(directory)
  const only = page.print('the PDF offered')
  expect(await offeredPdf(page, page.preview, { besides: only })).toBeNull()
  expect(page.downloads).toBe(0)
  const newer = page.print('the PDF printed after it')
  expect((await offeredPdf(page, page.preview, { besides: only }))?.href).toBe(newer)
})
