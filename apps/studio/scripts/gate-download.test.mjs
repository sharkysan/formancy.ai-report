import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { offeredPdf, offeredXml, REREADS, rereadsOn } from './gate-download.mjs'

/**
 * The page the browser gate drives, standing in for Playwright's, with
 * the Preview's one Download PDF link in jsdom's document, and with
 * `xml`, a Download XML link beside it (0065). `evaluate` runs
 * the gate's own page function there, as Chromium would; a click on a
 * link downloads, to a file, what its address holds at that moment, and
 * `waitForEvent('download')` hands the download over as Playwright does,
 * its `path()` throwing for an address that holds nothing, and its
 * `suggestedFilename()` the link's `download`. The Preview's
 * region finds its links by name in one read, as a locator's
 * `evaluateAll` does, and counts the reads.
 *
 * `print` is the Preview printing anew, as pdf-view.tsx does: a new
 * address on the link, and the one it replaced revoked. It puts a new link
 * in the old one's place, where React changes the one link's attribute:
 * jsdom keeps the first `blob:` address an anchor had as its `href`
 * however the attribute changes after (its `reinitializeURL`), and
 * Chromium reads the attribute. With `keep`, the link it replaced stays in
 * the document under another name, its address still held: an address a
 * caller read that can still be downloaded, though the Preview's link has
 * moved on. `beforeEach` runs before each page function, where a render
 * the gate does not wait for would land.
 */
function previewPage(directory) {
  const held = new Map()
  const waiting = []
  let printed = 0
  let downloads = 0
  let link = null
  const anchor = (address, name = 'Download PDF', file = 'quotation.pdf') => {
    const element = document.createElement('a')
    element.download = file
    element.textContent = name
    element.setAttribute('href', address)
    element.addEventListener('click', (event) => {
      event.preventDefault()
      const bytes = held.get(element.href)
      downloads += 1
      const file = join(directory, `${String(printed)}-${String(downloads)}.pdf`)
      const download = {
        suggestedFilename: () => element.download,
        path: async () => {
          if (bytes === undefined) throw new Error('download.path: Download failed')
          await writeFile(file, bytes)
          return file
        },
      }
      for (const resolve of waiting.splice(0)) resolve(download)
    })
    return element
  }
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
    print(text, { keep = false } = {}) {
      printed += 1
      const address = `blob:http://localhost:4392/report/${String(printed)}`
      held.set(address, new TextEncoder().encode(text))
      if (link !== null && keep) link.textContent = 'An earlier Download PDF'
      if (link !== null && !keep) {
        held.delete(link.href)
        link.remove()
      }
      link = anchor(address)
      document.body.append(link)
      return address
    },
    /** A Download XML link beside the PDF's, at an address of its own, offering `text` as `file`. */
    xml(text, file) {
      const address = `blob:http://localhost:4392/report/xml-${String(printed)}`
      held.set(address, new TextEncoder().encode(text))
      document.body.append(anchor(address, 'Download XML', file))
      return address
    },
    /** The address revoked and left on the link: a page that offers a PDF it no longer holds. */
    revoke: () => held.delete(link.href),
    /** The link taken away, as a Preview that stopped offering a PDF. */
    remove: () => link.remove(),
    preview: {
      getByRole: (role, { name }) => ({
        evaluateAll: async (run) => {
          stub.reads += 1
          return run([...document.querySelectorAll('a')].filter((each) => role === 'link' && each.textContent === name))
        },
      }),
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
  // Counted for the page, which the gate measures once a pass: a green run says whether the race was lost and read again.
  expect(rereadsOn(page)).toBe(1)
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
  expect(rereadsOn(page)).toBe(1)
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
  expect(rereadsOn(page)).toBe(0)
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
  expect(rereadsOn(page)).toBe(REREADS)
})

// A link gone at the last reread is a Preview that stopped offering a PDF, as it is at any other:
// said as a link that kept moving, it would name the wrong fault, and stop a wait that goes on
// through a Preview offering none.
test('is null where the link is gone at the last reread, not a link that kept moving', async () => {
  const page = previewPage(directory)
  const first = page.print('printed 1')
  let printed = 1
  page.beforeEach = () => {
    printed += 1
    if (printed <= REREADS + 1) page.print(`printed ${String(printed)}`)
    else page.remove()
  }
  expect(await offeredPdf(page, page.preview, { href: first })).toBeNull()
  expect(page.reads).toBe(REREADS + 1)
  expect(rereadsOn(page)).toBe(REREADS)
})

// A Preview that took its link away -- a refusal shown where the paper was -- offers no PDF, which
// is what the gate's waits wait through; thrown, it would stop the gate in a state it waits for.
test('is null where the link is gone by the download', async () => {
  const page = previewPage(directory)
  const only = page.print('the PDF offered')
  page.remove()
  expect(await offeredPdf(page, page.preview, { href: only })).toBeNull()
})

// The address handed over is the PDF asked for. gate-switch hands over the address its settled frame
// read; wherever that address still downloads, its bytes are the ones returned. Read from the link
// instead, a PDF printed since would stand in for the frame's whenever one landed in between.
test('downloads the address handed over where it still downloads, not the one the link offers since', async () => {
  const page = previewPage(directory)
  const read = page.print('the PDF the frame showed')
  page.print('a PDF printed since', { keep: true })
  const pdf = await offeredPdf(page, page.preview, { href: read })
  expect(pdf?.href).toBe(read)
  expect(text(pdf)).toBe('the PDF the frame showed')
  expect(page.reads).toBe(0)
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

// A final render of an e-invoice offers its XML beside its PDF (0065): the gate downloads each link
// by its own name, and says the name the browser saves it under. Read by the PDF's name, the XML
// would be the PDF; with no name, nothing would show it is the starter's .xml.
test('downloads Download XML by its own name, beside Download PDF, with the name the browser saves it under', async () => {
  const page = previewPage(directory)
  page.print('the PDF offered')
  const address = page.xml('<?xml version="1.0" encoding="UTF-8"?>', 'e-invoice.xml')
  const xml = await offeredXml(page, page.preview)
  expect([xml?.href, xml?.fileName, text(xml)]).toEqual([address, 'e-invoice.xml', '<?xml version="1.0" encoding="UTF-8"?>'])
  const pdf = await offeredPdf(page, page.preview)
  expect([pdf?.fileName, text(pdf)]).toEqual(['quotation.pdf', 'the PDF offered'])
})
