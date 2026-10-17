import { PassThrough } from 'node:stream'
import { fileURLToPath } from 'node:url'
import pdfmake from 'pdfmake'
import { readPdf } from '@formancy/report-corpus'
import { describe, expect, test } from 'vitest'
import { collect, type PdfStream } from './engine.js'
import { renderPdf } from './node.js'
import { fixture } from './testing/documents.js'

/**
 * pdfmake as the Node entry configures it, and the PDF read from it.
 */

const attempt = (source: string): Promise<Buffer> => pdfmake.createPdf({ images: { source }, content: [{ image: 'source', width: 10, height: 10 }] }).getBuffer()

describe('pdfmake as the renderer configures it', () => {
  // The renderer's documents name no file and no address, but pdfmake reads
  // either when a definition names one. Its policies are what would stop a
  // definition that reached it from reading the server's files or calling
  // out: set by the renderer, they allow the four font files and nothing else.
  test('reads no file but its fonts, and no address at all', async () => {
    await renderPdf(fixture('one-row').document, { maxPages: 5 })
    await expect(attempt('https://example.invalid/logo.png')).rejects.toThrow(/Access to URL denied/)
    await expect(attempt(fileURLToPath(import.meta.url))).rejects.toThrow(/Access to local file denied/)
  })

  // pdfmake's fonts and policies are one setting for the whole process. A
  // host that configured pdfmake for something else -- every file and
  // address allowed, no fonts -- must not change what the renderer renders
  // with: it sets its own again for every render, so the render still embeds
  // Roboto, and afterwards pdfmake still reads nothing else.
  test('sets its fonts and policies again for each render, over what anything else set', async () => {
    pdfmake.setFonts({})
    pdfmake.setLocalAccessPolicy(() => true)
    pdfmake.setUrlAccessPolicy(() => true)
    const pdf = await readPdf(await renderPdf(fixture('one-row').document, { maxPages: 5 }))
    expect(pdf.fonts.map((font) => font.name.replace(/^[A-Z]{6}\+/, ''))).toContain('Roboto-Regular')
    expect(pdf.fonts.filter((font) => !font.embedded)).toEqual([])
    await expect(attempt(fileURLToPath(import.meta.url))).rejects.toThrow(/Access to local file denied/)
    await expect(attempt('https://example.invalid/logo.png')).rejects.toThrow(/Access to URL denied/)
  })
})

describe("pdfmake's measuring, which the renderer reads", () => {
  // The word check reads each text node's widest word from the _minWidth
  // pdfmake writes onto it, in the function pdfmake calls for the first
  // page's background, before it lays out a line (words.ts). Were pdfmake
  // to stop writing it, or to call that function first, every word would
  // pass unchecked; this fails first.
  test("has written each text node's widest word by the time it asks for the first background", async () => {
    // A render leaves pdfmake configured with the renderer's fonts and policies.
    await renderPdf(fixture('one-row').document, { maxPages: 5 })
    const node = { text: 'short WWWWWWWWWW tail' }
    const lone = { text: 'WWWWWWWWWW' }
    const seen: unknown[] = []
    await pdfmake
      .createPdf({
        content: [node, lone],
        defaultStyle: { font: 'Roboto' },
        background: (page) => {
          if (page === 1) seen.push((node as { _minWidth?: unknown })._minWidth, (lone as { _maxWidth?: unknown })._maxWidth)
          return null
        },
      })
      .getBuffer()
    expect(typeof seen[0]).toBe('number')
    expect(seen[0]).toBeCloseTo(seen[1] as number, 6)
  })
})

describe("pdfmake's positions, which the table rules read", () => {
  // A block's rule reads the page its last row starts on from the row's
  // cell itself (build.ts's pageOf), because pdfmake's queries walk every
  // node to the end of the document for each rule. pdfmake records each
  // node's positions on the node, and corrects the page of one with an id
  // that an unbreakable block moved to the next page; this fails first if
  // either stops.
  test('records each node’s pages on it, and corrects a moved one with an id', async () => {
    await renderPdf(fixture('one-row').document, { maxPages: 5 })
    const filler = Array.from({ length: 70 }, (_, index) => ({ text: `Line ${index}`, fontSize: 9 }))
    const moved = { text: 'moved', id: 'moved' }
    const seen: (number | undefined)[] = []
    await pdfmake
      .createPdf({
        content: [...filler, { stack: [{ text: 'kept' }, moved], unbreakable: true }],
        defaultStyle: { font: 'Roboto' },
        pageBreakBefore: (node) => {
          if (node.id === 'moved') seen.push(node.startPosition.pageNumber, (moved as { positions?: { pageNumber: number }[] }).positions?.[0]?.pageNumber)
          return false
        },
      })
      .getBuffer()
    expect(seen).toEqual([2, 2])
  })
})

describe("pdfmake's footer, which a QR-bill's slip is drawn as", () => {
  // The slip is the last page's footer (definition.ts): pdfmake lays the
  // footer out once every page is, knowing their count, in a box as tall as
  // the bottom margin, and content placed absolutely above that box's top
  // has the room down to the paper's foot. Were pdfmake to stop calling the
  // footer with the count, or to measure that room from the box, a slip
  // would be drawn on the wrong page or lose its lower lines without a
  // word; this fails first.
  test('lays out content placed above the footer’s top on the last page, with the room down to the paper’s foot', async () => {
    await renderPdf(fixture('one-row').document, { maxPages: 5 })
    const lines = Array.from({ length: 30 }, (_, index) => ({ text: `Slip line ${index}`, fontSize: 10, lineHeight: 1 }))
    const calls: (readonly [number, number])[] = []
    const bytes = await pdfmake
      .createPdf({
        pageSize: { width: 595.28, height: 841.89 },
        pageMargins: [40, 40, 40, 40],
        content: [{ text: 'Body', pageBreak: 'after' }, { text: 'More' }],
        defaultStyle: { font: 'Roboto' },
        footer: (page, count) => {
          calls.push([page, count])
          return page === count ? { stack: lines, absolutePosition: { x: 40, y: -320 } } : null
        },
      })
      .getBuffer()
    expect(calls).toEqual([
      [1, 2],
      [2, 2],
    ])
    const pdf = await readPdf(new Uint8Array(bytes))
    expect(pdf.pages[0]!.items.filter((item) => item.text.startsWith('Slip line'))).toEqual([])
    const drawn = pdf.pages[1]!.items.filter((item) => item.text.startsWith('Slip line'))
    expect(drawn).toHaveLength(30)
    // Roboto's line is 2400 of its 2048 units, its ascender 1900: the first line's top 320 pt above the footer's, at 841.89 - 40.
    const baseline = (item: (typeof drawn)[number]): number => item.bottom - 0.2 * item.height
    expect(baseline(drawn[0]!)).toBeCloseTo(841.89 - 40 - 320 + (1900 / 2048) * 10, 2)
    expect(baseline(drawn[29]!) - baseline(drawn[0]!)).toBeCloseTo(29 * (2400 / 2048) * 10, 2)
  })
})

describe('reading the PDF out of PDFKit', () => {
  // pdfmake's own getBuffer waits for the end of the stream and never
  // listens for an error, so a stream that fails would leave the render
  // pending forever: a job that neither finishes nor fails.
  test('rejects when the stream fails, rather than waiting for an end that never comes', async () => {
    const stream = new PassThrough()
    const reading = collect(stream as unknown as PdfStream)
    stream.destroy(new Error('the stream failed'))
    await expect(reading).rejects.toThrow('the stream failed')
  })

  // Every chunk, in order: a PDF missing a chunk, or with two swapped, is a
  // file no reader opens.
  test('joins every chunk in order', async () => {
    // PDFKit has written its pages by the time pdfmake hands the stream over; ending it writes the rest.
    const stream = new PassThrough()
    stream.write(Buffer.from('%PDF-'))
    stream.write(Buffer.from('1.3'))
    expect(new TextDecoder().decode(await collect(stream as unknown as PdfStream))).toBe('%PDF-1.3')
  })
})
