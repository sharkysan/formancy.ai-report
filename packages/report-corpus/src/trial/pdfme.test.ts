import { crc32, deflateSync } from 'node:zlib'
import { PDFDocument } from '@pdfme/pdf-lib'
import { describe, expect, test } from 'vitest'
import { verify, verifyRefusal } from '../checks.js'
import { RenderRefusal, type Block, type Image, type ImageAsset, type Paragraph } from '../document.js'
import type { Fixture } from '../fixture.js'
import { ALL_FIXTURES } from '../fixtures/all.js'
import { documentOf, ledger, paragraph } from '../fixtures/build.js'
import { longTable } from '../fixtures/long-table.js'
import { oneRow } from '../fixtures/one-row.js'
import { encodePng } from '../fixtures/png.js'
import { readPdf } from '../read-pdf.js'
import { pdfme } from './pdfme.js'

/**
 * pdfme 6.2.4 on the corpus, each fixture proved on the PDF pdfme produced.
 *
 * What the trial's pdfme adapter fails, by fixture: why, and exactly the
 * problems the checks report. A gap's case asserts those problems, so it
 * fails the day the fixture passes and the day it fails for another reason:
 * the finding the trial records is what is checked, not merely some failure.
 */
const GAPS: Readonly<Record<string, { readonly reason: string; readonly problems: readonly string[] }>> = {
  // pdfme breaks a table after whichever row fills the page. Its only
  // look-ahead keeps the column header off the foot of a page; nothing keeps
  // one body row with the next. An adapter could correct the break -- split
  // the table before the group header pdfme's own pagination left last on a
  // page, and lay it out again -- and this one does not.
  'group-boundary': {
    reason: 'the trial adapter does not re-paginate, and pdfme keeps no table row with the next, so a group header ends a page',
    problems: ["group-boundary: page 2: the last table row is the group header 'Region R19'"],
  },
}

/** The fixtures the trial's engine comparison covers: the ones mapping no host font, which the trial adapters predate (0005, 0043). */
const TRIAL_FIXTURES = ALL_FIXTURES.filter((fixture) => fixture.document.fonts === undefined)

/** The long fixtures lay out and draw thousands of rows and words; a few seconds each on a developer machine. */
const SLOW = 120_000

/** The problems with what pdfme made of `fixture`: its PDF's, or its refusal's. */
async function problems(fixture: Fixture): Promise<string[]> {
  let bytes: Uint8Array
  try {
    bytes = await pdfme.render(fixture.document, { maxPages: fixture.maxPages })
  } catch (error) {
    return verifyRefusal(fixture, error)
  }
  return verify(fixture, await readPdf(bytes))
}

/** What `render` rejected with, or a failure when it resolved. */
async function refusal(rendering: Promise<Uint8Array>): Promise<RenderRefusal> {
  const error: unknown = await rendering.then(
    () => new Error('rendered a PDF; a refusal was expected'),
    (rejected: unknown) => rejected,
  )
  if (!(error instanceof RenderRefusal)) throw error
  return error
}

function image(asset: ImageAsset, width = 128, height = 64): Image {
  return { kind: 'image', asset, width, height, fit: 'contain' }
}

function png(id: string, bytes: Uint8Array): ImageAsset {
  return { id, mediaType: 'image/png', bytes }
}

function render(blocks: readonly Block[]): Promise<Uint8Array> {
  return pdfme.render(documentOf('pdfme adapter', blocks), { maxPages: 5 })
}

describe('pdfme on the corpus', () => {
  // Every fixture of the trial, rendered and proved on its own PDF: a row
  // lost or repeated, a column header missing from a page, a footer drawn
  // over the body, text past a margin, a font left out of the file, or a
  // refusal the fixture does not allow fails its case. A fixture pdfme
  // cannot satisfy is listed in GAPS with the reason, never left out; the
  // fixtures that map a host font are no part of the trial (TRIAL_FIXTURES).
  for (const fixture of TRIAL_FIXTURES) {
    const gap = GAPS[fixture.id]
    test(gap === undefined ? fixture.id : `${fixture.id} fails: ${gap.reason}`, async () => expect(await problems(fixture)).toEqual(gap?.problems ?? []), SLOW)
  }
})

describe('the pdfme adapter', () => {
  // Two renders of one document must be the same bytes, dated by the
  // document: a PDF that changed from run to run, or carried the time it was
  // made, could not be checked against a stored digest, and a reproduction
  // could not be told from a different report.
  test('renders one document to the same bytes every time, dated by the document', async () => {
    const first = await pdfme.render(oneRow.document, { maxPages: 5 })
    const second = await pdfme.render(oneRow.document, { maxPages: 5 })
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true)
    const loaded = await PDFDocument.load(first, { updateMetadata: false })
    expect(loaded.getCreationDate()).toEqual(new Date(oneRow.document.info.creationDate))
    expect(loaded.getTitle()).toBe(oneRow.document.info.title)
  })

  // The page limit is a bound, not a target: a limit one short of what the
  // document needs refuses it whole, and the limit it needs renders it. An
  // adapter out by one would refuse a report that fits, or let one more page
  // through than the deployment allows.
  test(
    'refuses a document one page over its limit and renders it at its limit',
    async () => {
      const pages = (await readPdf(await pdfme.render(longTable.document, { maxPages: longTable.maxPages }))).pages.length
      const over = await refusal(pdfme.render(longTable.document, { maxPages: pages - 1 }))
      expect(over.code).toBe('too-many-pages')
      expect((await readPdf(await pdfme.render(longTable.document, { maxPages: pages }))).pages).toHaveLength(pages)
    },
    SLOW,
  )

  // A job cancelled before it starts must not start; one cancelled while it
  // runs must not hand back a PDF the caller has stopped waiting for.
  test(
    'refuses with cancelled when the signal is aborted before or during the render',
    async () => {
      const before = new AbortController()
      before.abort()
      expect((await refusal(pdfme.render(oneRow.document, { maxPages: 5, signal: before.signal }))).code).toBe('cancelled')

      const during = new AbortController()
      const rendering = pdfme.render(longTable.document, { maxPages: longTable.maxPages, signal: during.signal })
      during.abort()
      expect((await refusal(rendering)).code).toBe('cancelled')
    },
    SLOW,
  )

  // pdfme reads braces in template text as an expression to evaluate. Body
  // text goes in as input, which pdfme prints as given: a total written
  // "{1+1}" must print as that, never as 2.
  test('prints braces in body text as written', async () => {
    const pdf = await readPdf(await render([paragraph('Reference {1+1} and {pageNumber}')]))
    expect(pdf.pages[0]!.items.map((item) => item.text)).toContain('Reference {1+1} and {pageNumber}')
  })

  // Text with a page number can only reach pdfme as such a template, where
  // braces would be evaluated. Refused, never printed as something else.
  test('refuses page-numbered text with braces in it as unsupported', async () => {
    const footer: Paragraph = { kind: 'paragraph', runs: [{ text: 'Page {1+1} ' }, { field: 'pageNumber' }] }
    const document = { ...documentOf('Braces', [paragraph('Body')]), pageFooter: [footer] }
    const refused = await refusal(pdfme.render(document, { maxPages: 5 }))
    expect(refused.code).toBe('unsupported')
    expect(refused.subject).toBe('pageFooter[0]')
  })

  // A keep-together block taller than a page cannot be kept together; split,
  // it would break its promise, and placed whole it would run off the page.
  test('refuses a keep-together block taller than a page as content-too-large', async () => {
    const lines = Array.from({ length: 90 }, (_, index) => paragraph(`Kept line ${index + 1}`))
    const refused = await refusal(render([{ kind: 'keepTogether', blocks: lines }]))
    expect(refused.code).toBe('content-too-large')
    expect(refused.subject).toBe('body[0]')
  })

  // pdfme keeps lines together only inside one text box, which has one type
  // size and holds only text: a table cannot join one, and paragraphs of two
  // sizes cannot share one. Refused, rather than kept together in name only
  // or set in the wrong size.
  test('refuses a keep-together block that cannot be one text box as unsupported', async () => {
    for (const blocks of [
      [paragraph('Summary'), ledger('inside', [])],
      [paragraph('Summary', { size: 14 }), paragraph('Net total: 1.00')],
    ]) {
      const refused = await refusal(render([{ kind: 'keepTogether', blocks }]))
      expect(refused.code).toBe('unsupported')
      expect(refused.subject).toBe('body[0]')
    }
  })

  // The page header and footer are drawn as they stand on every page. A
  // table there would never grow or split, and drawn over its rows the body
  // would print under it.
  test('refuses a table in the page footer as unsupported', async () => {
    const document = { ...documentOf('Footer table', [paragraph('Body')]), pageFooter: [ledger('totals', [])] }
    const refused = await refusal(pdfme.render(document, { maxPages: 5 }))
    expect(refused.code).toBe('unsupported')
    expect(refused.subject).toBe('pageFooter[0]')
  })

  // A page header that fills the page leaves the body no height; pdfme would
  // be handed a body it cannot put a line in.
  test('refuses page regions that leave no room for the body as content-too-large', async () => {
    const tall: Block = { kind: 'spacer', height: 900 }
    const refused = await refusal(pdfme.render({ ...documentOf('Tall header', [paragraph('Body')]), pageHeader: [tall] }, { maxPages: 5 }))
    expect(refused.code).toBe('content-too-large')
  })

  // A row with fewer cells than columns would have the cells after the gap
  // printed in the wrong columns; one with more would lose its last cells.
  test('refuses a table row whose cells do not match its columns, naming the table', async () => {
    const refused = await refusal(render([ledger('short-row', [{ kind: 'detail', cells: ['ROW-0001', 'Line item 1'] }])]))
    expect(refused.code).toBe('unsupported')
    expect(refused.subject).toBe('short-row')
  })

  // A creation date that is not an instant would reach the PDF's metadata as
  // whatever an invalid Date formats to, and the document would no longer
  // say when it was made.
  test('refuses a creation date that is not an ISO instant as unsupported', async () => {
    const document = documentOf('Undated', [paragraph('Body')])
    const refused = await refusal(pdfme.render({ ...document, info: { ...document.info, creationDate: 'last Tuesday' } }, { maxPages: 5 }))
    expect(refused.code).toBe('unsupported')
  })

  // Bold, italic and bold italic each have a Roboto face of their own. One
  // set in another face -- an italic paragraph upright, bold in the regular
  // weight -- extracts as the same text and passes every other check.
  test('sets bold, italic and bold italic text in their own Roboto faces, each embedded', async () => {
    const pdf = await readPdf(
      await render([paragraph('Bold', { bold: true }), paragraph('Italic', { italic: true }), paragraph('Both', { bold: true, italic: true })]),
    )
    // pdf-lib names an embedded subset after the font with a number appended: Roboto-Italic-1234.
    const faces = pdf.fonts.map((font) => font.name.replace(/-\d+$/, ''))
    expect(faces).toEqual(expect.arrayContaining(['Roboto-Medium', 'Roboto-Italic', 'Roboto-MediumItalic']))
    expect(pdf.fonts.every((font) => font.embedded)).toBe(true)
  })

  // A table whose fixed columns are wider than the printable area would run
  // past the right margin, its last column clipped by the paper's edge.
  test('refuses a table wider than the printable area as content-too-large, naming it', async () => {
    const wide = ledger(
      'too-wide',
      [],
      [
        { width: 300, align: 'left' },
        { width: 'fill', align: 'left' },
        { width: 300, align: 'right' },
      ],
    )
    const refused = await refusal(render([wide]))
    expect(refused.code).toBe('content-too-large')
    expect(refused.subject).toBe('too-wide')
  })
})

describe('the pdfme adapter, on images', () => {
  const valid = encodePng(64, 32, () => [10, 20, 30])

  // Each limit is enforced on the asset's own header bytes, before pdfme
  // decodes anything: an image too large to embed is refused naming it,
  // never drawn as a hole or left to exhaust the worker's memory.
  test('refuses an image wider than 4096 pixels, naming it', async () => {
    const refused = await refusal(
      render([
        image(
          png(
            'wide',
            encodePng(4097, 1, () => [0, 0, 0]),
          ),
        ),
      ]),
    )
    expect(refused.code).toBe('invalid-asset')
    expect(refused.subject).toBe('wide')
  })

  test('refuses an image of more than 20 MB, naming it', async () => {
    const bytes = new Uint8Array(20 * 1024 * 1024 + 1)
    bytes.set(valid)
    const refused = await refusal(render([image(png('heavy', bytes))]))
    expect(refused.code).toBe('invalid-asset')
    expect(refused.subject).toBe('heavy')
  })

  // An asset is what its media type says: PNG bytes approved as a JPEG are
  // a mistake upstream, and drawing them anyway would hide it.
  test('refuses bytes that are not the media type the asset declares', async () => {
    const refused = await refusal(render([image({ id: 'claimed-jpeg', mediaType: 'image/jpeg', bytes: valid })]))
    expect(refused.code).toBe('invalid-asset')
    expect(refused.subject).toBe('claimed-jpeg')
  })

  // A JPEG's size is read from its frame header, found after whatever
  // segments come first, so the pixel limit holds for JPEGs as for PNGs. A
  // JPEG whose scan comes before any frame has no size at all, and one with
  // two colour channels is one PDF cannot hold; pdf-lib says so, and the
  // refusal names the asset.
  test('refuses a JPEG that is too large, has no frame, or has channels PDF cannot hold', async () => {
    const SOI = [0xff, 0xd8]
    const EOI = [0xff, 0xd9]
    // A JFIF APP0 segment of 16 bytes, as most JPEGs begin, then a fill byte before the next marker.
    const APP0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff]
    // SOF0 frames: precision 8, height, width, then the components.
    const wideFrame = [0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x0a, 0x13, 0x88, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]
    const twoChannelFrame = [0xff, 0xc0, 0x00, 0x0e, 0x08, 0x00, 0x0a, 0x00, 0x0a, 0x02, 1, 0x11, 0, 2, 0x11, 0]
    const scan = [0xff, 0xda, 0x00, 0x08, 0x01, 1, 0x00, 0x00, 0x3f, 0x00]
    for (const [id, bytes] of [
      ['wide-jpeg', [...SOI, ...APP0, ...wideFrame, ...EOI]],
      ['scan-first', [...SOI, ...scan, ...twoChannelFrame, ...EOI]],
      ['two-channels', [...SOI, ...twoChannelFrame, ...EOI]],
    ] as const) {
      // Drawn square, as the 10 by 10 frames are, so that only the bytes can be the reason.
      const refused = await refusal(render([image({ id, mediaType: 'image/jpeg', bytes: new Uint8Array(bytes) }, 64, 64)]))
      expect(refused.code, id).toBe('invalid-asset')
      expect(refused.subject, id).toBe(id)
    }
  })

  /** A PNG chunk: its length, its type, its data and the CRC of type and data. */
  function chunk(type: string, data: Uint8Array): Uint8Array {
    const typed = new Uint8Array([...new TextEncoder().encode(type), ...data])
    const framed = new Uint8Array(12 + data.length)
    const view = new DataView(framed.buffer)
    view.setUint32(0, data.length)
    framed.set(typed, 4)
    view.setUint32(8 + data.length, crc32(typed))
    return framed
  }

  /** An 8-bit PNG of `colourType` over `pixelData`, compressed already, with no other chunks. */
  function pngOf(width: number, height: number, colourType: number, interlaced: boolean, pixelData: Uint8Array): Uint8Array {
    const header = new Uint8Array(13)
    const view = new DataView(header.buffer)
    view.setUint32(0, width)
    view.setUint32(4, height)
    header.set([8, colourType, 0, 0, interlaced ? 1 : 0], 8)
    return new Uint8Array([...valid.subarray(0, 8), ...chunk('IHDR', header), ...chunk('IDAT', pixelData), ...chunk('IEND', new Uint8Array(0))])
  }

  /** 64 by 32 truecolour pixels as scanlines: a filter byte and 192 sample bytes each. */
  const scanlines = (): Uint8Array => new Uint8Array(32 * (1 + 64 * 3))

  // A valid header over pixel data that is garbled or cut short. pdfme's PNG
  // decoder never returns on either: it spins past the end of the data, and
  // the test run, the worker and every render queued behind it hang with it.
  // Pixel data that inflates to too few bytes, or names a filter PNG does
  // not have, would decode to garbage. Each is refused, naming the asset,
  // before pdfme sees the bytes.
  test('refuses a PNG whose header is valid and whose pixel data is not', async () => {
    const compressed = deflateSync(scanlines())
    const misfiltered = scanlines()
    misfiltered[0] = 5
    for (const [id, pixelData] of [
      ['garbled', new Uint8Array(compressed.length).fill(0xa5)],
      ['truncated', compressed.subarray(0, compressed.length >> 1)],
      ['short', deflateSync(new Uint8Array(10))],
      ['misfiltered', deflateSync(misfiltered)],
    ] as const) {
      const refused = await refusal(render([image(png(id, pngOf(64, 32, 2, false, pixelData)))]))
      expect(refused.code, id).toBe('invalid-asset')
      expect(refused.subject, id).toBe(id)
    }
  })

  // Colour type 5 is not one PNG has, refused by the adapter's own reading;
  // a palette image without its palette has no colours to draw, and pdf-lib
  // fails on it with a TypeError the refusal must name the asset for. Each
  // over pixel data of the size its header implies -- three bytes a pixel
  // for type 5 read as truecolour, one for a palette index -- so that only
  // the header can be the reason.
  test('refuses a PNG whose header PNG does not allow', async () => {
    for (const [id, colourType, pixelData] of [
      ['colour-type-5', 5, scanlines()],
      ['no-palette', 3, new Uint8Array(32 * (1 + 64))],
    ] as const) {
      const refused = await refusal(render([image(png(id, pngOf(64, 32, colourType, false, deflateSync(pixelData))))]))
      expect(refused.code, id).toBe('invalid-asset')
      expect(refused.subject, id).toBe(id)
    }
  })

  // The size an interlaced PNG's pixel data must inflate to is the sum of
  // Adam7's seven passes. Counted wrong, every interlaced logo would be
  // refused as invalid. For 5 by 3 truecolour pixels, by hand: passes 1, 2
  // and 4 are one row of one pixel (4 bytes each with the filter byte), pass
  // 3 is empty, pass 5 one row of three (10), pass 6 two rows of two (14),
  // pass 7 one row of five (16): 52 bytes.
  test('draws a valid interlaced PNG', async () => {
    const interlaced = pngOf(5, 3, 2, true, deflateSync(new Uint8Array(52)))
    const pdf = await readPdf(await render([image(png('interlaced', interlaced), 50, 30)]))
    expect(pdf.pages.flatMap((page) => page.images)).toHaveLength(1)
  })

  // An image wider than the printable area would run past the right margin.
  test('refuses an image wider than the printable area as content-too-large, naming it', async () => {
    const refused = await refusal(render([image(png('broad', valid), 600, 300)]))
    expect(refused.code).toBe('content-too-large')
    expect(refused.subject).toBe('broad')
  })

  // pdfme fits an image inside its box at the image's own proportions. Drawn
  // into a box of other proportions it would come out smaller than the
  // document says, so the adapter refuses rather than draw it at another size.
  test('refuses an image drawn at proportions other than its own as unsupported', async () => {
    const refused = await refusal(render([image(png('square', valid), 100, 100)]))
    expect(refused.code).toBe('unsupported')
    expect(refused.subject).toBe('square')
  })
})
