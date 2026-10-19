// @vitest-environment node

import { createReportEditor, SCENARIO_PNG, SCENARIO_PNG_DIGEST } from '@formancy/report-builder-core'
import type { AddedImage, ImageFile } from '@formancy/report-builder-core'
import { openReportSession, putAsset } from '@formancy/report-core'
import { E_INVOICE, readPdf, STARTER_IMAGES, STARTERS } from '@formancy/report-corpus'
import { assetDigest } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { afterAll, beforeAll, describe, expect, test, vi, type MockInstance } from 'vitest'
import { preview } from '../preview/pipeline.js'
import { decodeStarters, encodeStarters } from '../starters/codec.js'
import { BLANK } from '../starters/starters.js'
import { studioImages } from './image-store.js'

/**
 * The page's store of images (0033): what its lookup hands the Preview,
 * and for how long. The last case adds an image through the editor, as
 * either builder hands it a file, and prints it through the preview's own
 * pipeline -- the runtime and the renderer's browser entry -- read back
 * from the PDF with PDF.js (0003), under Node as pipeline.test.ts is.
 */

const { images } = decodeStarters(encodeStarters(STARTERS, STARTER_IMAGES))
const CREATED = '2026-10-19T08:00:00Z'

/** The file a person chose, as a builder hands it on: the scenarios' 2 × 1 PNG. */
const logo = (): ImageFile => ({ name: 'logo.png', size: SCENARIO_PNG.length, arrayBuffer: async () => Uint8Array.from(SCENARIO_PNG).buffer })

/**
 * A baseline JPEG of 16 × 16 pixels in four components, which PDFKit draws
 * in DeviceCMYK: its frame header, a scan header and three bytes of scan,
 * embedded as they stand, since nothing decodes a JPEG's scan.
 */
const CMYK = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xc0, 0, 20, 8, 0, 16, 0, 16, 4, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0, 4, 0x11, 0, 0xff, 0xda, 0, 14, 4, 1, 0, 2, 0, 3, 0, 4, 0, 0, 63, 0, 1, 2, 3, 0xff, 0xd9,
])

/** An editor over `report` -- a blank one when absent -- its images kept in `store`. */
function editorOver(store: ReturnType<typeof studioImages>['store'], report: ReportDefinition = BLANK.report) {
  const opening = openReportSession(report)
  if (!opening.ok) throw new Error('the report did not open')
  return { session: opening.session, editor: createReportEditor(opening.session, { images: store }) }
}

// pdfmake's browser build warns, outside a browser, that it has no local
// access policy to set, as pipeline.test.ts says; that warning alone.
let warn: MockInstance<typeof console.warn>
beforeAll(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterAll(() => {
  const warnings = new Set(warn.mock.calls.map((call) => String(call[0])))
  warn.mockRestore()
  expect([...warnings].filter((each) => !each.startsWith('No local access policy defined'))).toEqual([])
})

describe('the Studio’s images', () => {
  // The host's lookup gives bytes only for the asset and the digest the
  // data names together (0010): an asset asked for by its id with another
  // digest is not the approved one, and is not handed over, nor bytes of
  // that digest for an id they were never declared under.
  test('hand over a starter’s image only for its id and its digest', () => {
    const { resolve } = studioImages(images)
    const [photo] = images
    if (photo === undefined) throw new Error('the corpus has no starter image')
    expect(resolve({ asset: photo.asset, digest: photo.digest })).toEqual({ mediaType: photo.mediaType, bytes: photo.bytes })
    expect(resolve({ asset: photo.asset, digest: `sha256:${'00'.repeat(32)}` })).toBeUndefined()
    expect(resolve({ asset: 'another', digest: photo.digest })).toBeUndefined()
  })

  // What a person added is answered for by the id and digest the editor
  // named it with, and kept as it was handed over: bytes the page changed
  // afterwards in the buffer it handed would otherwise print, under a
  // digest that is not theirs.
  test('keep a copy of what they are handed, and answer for it by its id and digest', async () => {
    const { resolve, store } = studioImages([])
    const bytes = Uint8Array.from(SCENARIO_PNG)
    const image: AddedImage = { asset: 'logo', mediaType: 'image/png', digest: SCENARIO_PNG_DIGEST, bytes, fileName: 'logo.png', width: 2, height: 1 }
    expect(await store.keep(image)).toEqual({ ok: true })
    bytes.fill(0)
    expect(resolve({ asset: 'logo', digest: SCENARIO_PNG_DIGEST })?.bytes).toEqual(SCENARIO_PNG)
    expect(resolve({ asset: 'logo', digest: SCENARIO_PNG_DIGEST })?.mediaType).toBe('image/png')
    expect(resolve({ asset: 'logo-2', digest: SCENARIO_PNG_DIGEST })).toBeUndefined()
  })

  // An undo takes the declaration back and a redo gives it back; the bytes
  // stay, so the Preview prints the image again after the redo, where a
  // store that let them go on the undo would print `missing-asset`.
  test('keep what an undo takes back, for the redo', async () => {
    const { resolve, store } = studioImages([])
    const { session, editor } = editorOver(store)
    expect(await editor.addImage(logo())).toEqual({ ok: true })
    const [declared] = session.document().assets
    if (declared === undefined) throw new Error('no asset was declared')
    editor.dispatch({ type: 'undo' })
    expect(session.document().assets).toEqual([])
    expect(resolve({ asset: declared.id, digest: declared.digest })?.bytes).toEqual(SCENARIO_PNG)
    editor.dispatch({ type: 'redo' })
    expect(session.document().assets).toEqual([declared])
    expect(resolve({ asset: declared.id, digest: declared.digest })?.bytes).toEqual(SCENARIO_PNG)
    editor.dispose()
  })

  // The page's whole path for an image a person adds: the editor reads and
  // checks it, the page keeps it, the report declares it, Insert's Image
  // draws it, and the preview prints it at once from the page's lookup --
  // one image, where the box was put, at the PNG's 2:1. A lookup that did
  // not answer for what the store kept would refuse the preview, and a
  // PNG the renderer would not draw would refuse it at print.
  test('print an image a person added, where it was inserted, through the preview’s pipeline', async () => {
    const { resolve, store } = studioImages([])
    const { session, editor } = editorOver(store)
    expect(await editor.addImage(logo())).toEqual({ ok: true })
    expect(editor.dispatch({ type: 'insert', kind: 'image', target: { region: 'reportHeader', index: 0 } })).toEqual({ ok: true })
    const outcome = await preview({ report: session.document(), starter: BLANK, mode: 'final', images: resolve, creationDate: CREATED }, new AbortController().signal)
    if (outcome.kind !== 'printed') throw new Error(`the image was not printed: ${JSON.stringify(outcome)}`)
    const [first] = (await readPdf(outcome.pdf)).pages
    expect(first?.images.map(({ x, top, width, height }) => [x, top, width, height].map((points) => Math.round(points * 100) / 100))).toEqual([[56.69, 56.69, 100, 50]])
    editor.dispose()
  })

  // An e-invoice is drawn as a PDF/A-3b beside which no image may be CMYK
  // (0031): the renderer refuses one at the final render, and the editor
  // at the door of an e-invoice (0033). Two places decide it, so both are
  // held here, on the e-invoice sample: were the renderer to draw it, or
  // the editor to take it, this fails. In any other report it prints.
  test('refuse a CMYK JPEG at the door of an e-invoice, as its final render refuses it, and print it elsewhere', async () => {
    const { resolve, store } = studioImages(images)
    const file: ImageFile = { name: 'druckerei.jpg', size: CMYK.length, arrayBuffer: async () => Uint8Array.from(CMYK).buffer }
    const invoice = editorOver(store, E_INVOICE.report)
    expect(await invoice.editor.addImage(file)).toMatchObject({ ok: false, code: 'not-an-image' })
    expect(invoice.session.canUndo()).toBe(false)
    // The same image declared and drawn without the editor: the final render refuses it.
    const digest = assetDigest(CMYK)
    expect(await store.keep({ asset: 'druckerei', mediaType: 'image/jpeg', digest, bytes: CMYK, fileName: file.name, width: 16, height: 16 })).toEqual({ ok: true })
    expect(invoice.session.apply((report) => putAsset(report, 'druckerei', { mediaType: 'image/jpeg', digest }))).toMatchObject({ ok: true })
    expect(invoice.editor.dispatch({ type: 'insert', kind: 'image', target: { region: 'reportHeader', index: 0 } })).toEqual({ ok: true })
    const refused = await preview({ report: invoice.session.document(), starter: E_INVOICE, mode: 'final', images: resolve, creationDate: CREATED }, new AbortController().signal)
    expect(refused).toMatchObject({ kind: 'not-drawn', refusal: { code: 'unsupported', subject: 'druckerei' } })
    invoice.editor.dispose()
    // In a report with no e-invoice, the editor takes it and the final render draws it.
    const blank = editorOver(store)
    expect(await blank.editor.addImage(file)).toEqual({ ok: true })
    expect(blank.editor.dispatch({ type: 'insert', kind: 'image', target: { region: 'reportHeader', index: 0 } })).toEqual({ ok: true })
    const printed = await preview({ report: blank.session.document(), starter: BLANK, mode: 'final', images: resolve, creationDate: CREATED }, new AbortController().signal)
    expect(printed.kind).toBe('printed')
    blank.editor.dispose()
  })
})
