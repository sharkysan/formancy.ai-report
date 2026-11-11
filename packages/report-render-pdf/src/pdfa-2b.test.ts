import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import pdfmake from 'pdfmake'
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'
import {
  E_INVOICE,
  propertiesOf,
  QUOTATION,
  readAnnotations,
  readPdf,
  readPdfObjects,
  readXmp,
  starterImages,
  STARTERS,
  XMP_NAMESPACES,
  type Starter,
} from '@formancy/report-corpus'
import { resolveReport, type RenderManifest, type ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test, vi } from 'vitest'
import { renderPdf } from './node.js'
import type { RenderOptions } from './options.js'
import { TIMEOUT } from './testing/documents.js'

/**
 * The PDF/A-2b a host asks for with `pdfa: '2b'` (0056), proved on the
 * PDF the engine produced (0003): every starter that is no e-invoice,
 * resolved by the real runtime in a final render with the starters'
 * approved images (`starterImages`, the lookup of `STARTER_IMAGES`) and
 * a fixed creation date, drawn through the Node entry with and without
 * the option, and read back by readers that are not the PDFKit that wrote
 * it: pdf-lib for the objects, saxes for the XMP, PDF.js for the pages
 * and the annotations. What it shows is that a 2b says it is one, carries
 * the one output intent PDF/A asks for, embeds nothing, holds no action,
 * and is the very pages the plain render prints.
 *
 * Expected values are literals, never `PDF_A_2B`, so that a constant
 * changed in the code fails here. What this cannot show is that a
 * validator takes the PDF: veraPDF's PDF/A-2B profile is the e-invoice
 * gate's.
 */

const CREATED = '2026-11-11T08:00:00Z'

/** As `starters.test.ts` prints a starter. */
const MAX_PAGES = 20

/** The options a starter is drawn with: plain, or as `pdfa`. */
const optionsFor = (pdfa?: '2b'): RenderOptions => (pdfa === undefined ? { maxPages: MAX_PAGES } : { maxPages: MAX_PAGES, pdfa })

/** The starters a PDF/A-2b is drawn of: each but those with an e-invoice, which a 2b refuses (`pdfa-check.test.ts`). */
const DRAWN = STARTERS.filter((starter) => starter.report.eInvoice === undefined)
const samples = DRAWN.map((starter) => [starter.id, starter] as const)

const { pdfaid } = XMP_NAMESPACES

/** `starter` resolved against its data in `mode`, failing the test with the errors when the runtime refuses it. */
function resolution(starter: Starter, mode: 'final' | 'preview' = 'final'): { readonly document: ResolvedDocument; readonly manifest: RenderManifest } {
  const outcome = resolveReport(starter.report, starter.data, { mode, parameters: starter.parameters, images: starterImages, creationDate: CREATED })
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome
}

const resolved = (starter: Starter): ResolvedDocument => resolution(starter).document

/** Each starter's PDF, drawn once as a PDF/A-2b and once plain, with no test watching pdfmake. */
const drawings = new Map<string, Promise<Uint8Array>>()
function drawn(starter: Starter, pdfa?: '2b'): Promise<Uint8Array> {
  const at = `${starter.id} ${pdfa ?? 'plain'}`
  let found = drawings.get(at)
  if (found === undefined) {
    found = renderPdf(resolved(starter), optionsFor(pdfa))
    drawings.set(at, found)
  }
  return found
}

/** A definition as `browser.test.ts` writes one: every function by its source, and the page header and footer by what they lay out on pages 2 and 3 of 3. */
function serialised(definition: TDocumentDefinitions): string {
  const regions = [definition.header, definition.footer].flatMap((region) =>
    [2, 3].map((page) => (typeof region === 'function' ? region(page, 3, { width: 0, height: 0, orientation: 'portrait' }) : region)),
  )
  return JSON.stringify({ definition, regions }, (_, value: unknown) => (typeof value === 'function' ? `function ${String(value)}` : value))
}

/**
 * The final pass's definition of `starter` drawn with `pdfa`: its version
 * and subset apart, and the rest as `serialised` writes it, both read the
 * moment pdfmake is handed it, since pdfmake then writes a `version` of
 * '1.3' into a definition that has none (Printer.js 38).
 */
async function finalDefinition(starter: Starter, pdfa?: '2b'): Promise<{ readonly version: unknown; readonly subset: unknown; readonly rest: string }> {
  const seen: { version: unknown; subset: unknown; rest: string }[] = []
  const createPdf = pdfmake.createPdf.bind(pdfmake)
  const spy = vi.spyOn(pdfmake, 'createPdf').mockImplementation((definition, options) => {
    const { version, subset, ...rest } = definition
    seen.push({ version, subset, rest: serialised(rest) })
    return createPdf(definition, options)
  })
  try {
    await renderPdf(resolved(starter), optionsFor(pdfa))
  } finally {
    spy.mockRestore()
  }
  return seen.at(-1)!
}

describe('the starters drawn as PDF/A-2b', () => {
  // The list is derived, and one that came out empty would pass every
  // case below by running none: it is every starter but the e-invoice.
  test('are every starter but the e-invoice, which a PDF/A-2b refuses', () => {
    expect(STARTERS.filter((starter) => !DRAWN.includes(starter)).map(({ id }) => id)).toEqual([E_INVOICE.id])
  })

  // A PDF/A identifies itself in its XMP, which PDFKit writes only at a
  // version above 1.3 (pdfkit.js 6070): a 2b whose XMP said part 3 would
  // be validated as a 3b, one that said conformance A would claim the
  // structure tree pdfmake does not build, and one whose packet is not
  // well-formed is no PDF/A at all. The packet is read strictly, by saxes.
  test.each(samples)(
    '%s drawn as PDF/A-2b is a PDF 1.7 whose well-formed XMP says part 2, conformance B',
    async (_, starter) => {
      const objects = await readPdfObjects(await drawn(starter, '2b'))
      expect(objects.version).toBe('1.7')
      expect(objects.metadata).toMatchObject({ type: 'Metadata', subtype: 'XML' })
      const xmp = readXmp(objects.metadata!.xmp)
      expect(propertiesOf(xmp, pdfaid, 'part').map(({ text, prefix }) => ({ text, prefix }))).toEqual([{ text: '2', prefix: 'pdfaid' }])
      expect(propertiesOf(xmp, pdfaid, 'conformance').map(({ text }) => text)).toEqual(['B'])
    },
    TIMEOUT,
  )

  // A PDF/A draws DeviceRGB only beside an RGB output intent, and the
  // profile is embedded in every 2b an archive keeps: one intent, for
  // PDF/A, its profile the very file PDFKit ships, which the licence guard
  // admits by its digest (0006, as 0031 extends it). A PDFKit that wrote
  // no intent into a 2b, or another profile, fails here.
  test.each(samples)(
    '%s carries one sRGB output intent, GTS_PDFA1, its profile PDFKit’s own file byte for byte',
    async (_, starter) => {
      const { outputIntents } = await readPdfObjects(await drawn(starter, '2b'))
      expect(outputIntents.map(({ type, s, outputConditionIdentifier, profile }) => ({ type, s, outputConditionIdentifier, n: profile?.n }))).toEqual([
        { type: 'OutputIntent', s: 'GTS_PDFA1', outputConditionIdentifier: 'sRGB IEC61966-2.1', n: 3 },
      ])
      const pdfkit = createRequire(createRequire(import.meta.url).resolve('pdfmake')).resolve('pdfkit')
      const file = readFileSync(path.join(path.dirname(pdfkit), 'data', 'sRGB_IEC61966_2_1.icc'))
      expect(Buffer.from(outputIntents[0]!.profile!.bytes).equals(file)).toBe(true)
    },
    TIMEOUT,
  )

  // A PDF/A-2 may embed a file only where it is a PDF/A-1 or -2 itself,
  // and a 2b has nothing to embed: the e-invoice's hook, which embeds its
  // XML, runs for a 3b alone. So a 2b names no file on /AF, where PDF/A-3
  // wants one, nor in the name tree, where a viewer finds one, which holds
  // only the empty /Dests PDFKit names in every PDF (pdfkit.js 6118-6120);
  // and PDF.js finds no attachment.
  test.each(samples)(
    '%s embeds no file: nothing on /AF, nothing in the name tree',
    async (_, starter) => {
      const bytes = await drawn(starter, '2b')
      const objects = await readPdfObjects(bytes)
      expect([objects.associatedFiles, objects.embeddedFiles]).toEqual([[], []])
      expect(objects.catalogKeys).not.toContain('AF')
      expect(objects.nameTreeKeys).toEqual(['Dests'])
      expect((await readPdf(bytes)).attachments).toEqual([])
    },
    TIMEOUT,
  )

  // A PDF/A may run no JavaScript and its catalog may name no /AA, and
  // part 2 holds the actions, forms and annotations it does admit to
  // rules of their own. A 2b holds none of them -- no /OpenAction, /AA or
  // /AcroForm, no JavaScript in the name tree, no annotation, such as the
  // link an SVG's <a> would write and `svg-content.ts` refuses -- since
  // neither pdfmake nor the renderer writes any; read from the file, a
  // pdfmake that began to would show here. That the reader finds such
  // keys where they are is `objects.test.ts`'s.
  test.each(samples)(
    '%s holds no action, form or annotation',
    async (_, starter) => {
      const bytes = await drawn(starter, '2b')
      const { catalogKeys, nameTreeKeys } = await readPdfObjects(bytes)
      expect(catalogKeys).toContain('Pages')
      expect(catalogKeys.filter((key) => ['OpenAction', 'AA', 'AcroForm'].includes(key))).toEqual([])
      expect(nameTreeKeys).not.toContain('JavaScript')
      expect(await readAnnotations(bytes)).toEqual([])
    },
    TIMEOUT,
  )

  // The archive keeps the 2b as the report a person saw: a 2b whose page
  // broke elsewhere, whose footer counted otherwise, or whose run moved,
  // changed its face or lost an image would be another document filed as
  // that one. The definition pdfmake is handed is the plain one's but for
  // the version and the subset, and every page PDF.js reads holds the same
  // runs at the same places in the same faces, subset tags included, the
  // same images, paths and clips, and the same fonts, each embedded.
  test.each(samples)(
    '%s is the plain render’s pages',
    async (_, starter) => {
      const [archival, plain] = [await finalDefinition(starter, '2b'), await finalDefinition(starter)]
      expect([archival.version, archival.subset]).toEqual(['1.7', 'PDF/A-2b'])
      expect([plain.version, plain.subset]).toEqual([undefined, undefined])
      expect(archival.rest).toBe(plain.rest)
      const [twoB, picture] = [await readPdf(await drawn(starter, '2b')), await readPdf(await drawn(starter))]
      expect(twoB.pages.length).toBeGreaterThan(0)
      expect(twoB.pages).toEqual(picture.pages)
      expect(twoB.fonts).toEqual(picture.fonts)
      expect(twoB.fonts.filter(({ embedded }) => !embedded)).toEqual([])
    },
    TIMEOUT,
  )

  // The renderer has no mode (0056): a preview that lacks nothing carries
  // no label, and is its final render's document. Drawn as 2b it is that
  // render's 2b, byte for byte; refused, or drawn otherwise, a host that
  // archived the preview would hold another PDF than the report's.
  test(
    'a preview of the quotation that lacks nothing is its final render’s document, and draws to the same PDF/A-2b',
    async () => {
      const preview = resolution(QUOTATION, 'preview')
      expect([preview.manifest.mode, preview.manifest.completeness.complete]).toEqual(['preview', true])
      expect(preview.document).toEqual(resolved(QUOTATION))
      const bytes = await renderPdf(preview.document, optionsFor('2b'))
      expect(Buffer.from(bytes).equals(Buffer.from(await drawn(QUOTATION, '2b')))).toBe(true)
    },
    TIMEOUT,
  )

  // An archived PDF is found again by its digest, or by nothing: the 2b's
  // XMP holds the document's creation date and no clock, and its /ID is
  // the information dictionary's. Resolved and drawn again, each starter
  // is the same bytes.
  test(
    'draws a PDF/A-2b to the same bytes twice',
    async () => {
      for (const starter of DRAWN) {
        const again = await renderPdf(resolved(starter), optionsFor('2b'))
        expect(Buffer.from(again).equals(Buffer.from(await drawn(starter, '2b'))), starter.id).toBe(true)
      }
    },
    TIMEOUT,
  )
})
