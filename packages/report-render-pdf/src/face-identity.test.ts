import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readPdf } from '@formancy/report-corpus'
import { RenderRefusal, readFont, type FontAsset, type ResolvedDocument, type ResolvedFonts } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { drawnAs, OWN_FACES, type HostFace } from './face-identity.js'
import type { Glyphs } from './glyphs.js'
import { planFonts } from './host-fonts.js'
import { renderPdf } from './node.js'
import { bareBillDocument, GERMAN, resolvedBill } from './testing/bills.js'
import { bareDocument, PAGE, paragraph, TIMEOUT } from './testing/documents.js'
import { face, fontkit, LIBERATION_BOLD, LIBERATION_REGULAR, named, ROBOTO_REGULAR, withEms, withPostScriptNames } from './testing/fonts.js'

/**
 * A host face PDFKit would draw as another face of the render (0043): two
 * faces of one PostScript name, a name PDFKit keeps fonts under before it
 * reads one, and a face of the renderer's own bytes, which it draws as the
 * renderer's own. Each refusal is in numbers and the asset's id alone, and
 * none quotes the name the font states.
 */

const OPTIONS = { maxPages: 5 }

/** Roboto's four faces, each mapping 'A', for a plan made without the engine. */
const ROBOTO: Glyphs = { normal: new Set([0x41]), bold: new Set([0x41]), italics: new Set([0x41]), bolditalics: new Set([0x41]) }

/** The refusal `document` is rejected with, or 'rendered'; anything but a refusal, a TypeError out of PDFKit among them, fails the test. */
async function refusal(document: ResolvedDocument): Promise<RenderRefusal | 'rendered'> {
  return renderPdf(document, OPTIONS).then(
    () => 'rendered' as const,
    (error: unknown) => {
      if (error instanceof RenderRefusal) return error
      throw error
    },
  )
}

/** A document of `body` alone on a page whose body is `body` points tall, mapping `fonts`. */
function onBody(height: number, body: ResolvedDocument['body'], fonts: ResolvedFonts): ResolvedDocument {
  const margin = (841.89 - height) / 2
  return { ...bareDocument('Identity', body), page: { ...PAGE, margins: { ...PAGE.margins, top: margin, bottom: margin } }, fonts }
}

/** A QR-bill's slip under one paragraph in the sans, which opens the sans before the slip's Liberation Sans; `fonts` mapped. */
const billed = (fonts?: ResolvedFonts): ResolvedDocument => ({ ...bareBillDocument(resolvedBill(GERMAN), [paragraph('Rechnung')]), ...(fonts === undefined ? {} : { fonts }) })

/** The slip's runs, below the instruction to separate it, as their text, where they start and how wide they are. */
async function slipRuns(document: ResolvedDocument): Promise<{ readonly text: string; readonly x: number; readonly width: number }[]> {
  const { pages } = await readPdf(await renderPdf(document, OPTIONS))
  return pages.at(-1)!.items.filter((item) => item.top > 500).map((item) => ({ text: item.text, x: Math.round(item.x * 100) / 100, width: Math.round(item.width * 100) / 100 }))
}

describe('a host face of the PostScript name of another face of the render', () => {
  // The review's cases, each of which printed: a sans of Liberation Sans's
  // name and a 4 em line laid the slip out in its line, and 7 of the
  // slip's runs were gone, the debtor's address, the message and "Zahlbar
  // durch" among them; a mono of Roboto Regular's name and a 4 em line,
  // opened first, printed a 96 pt Roboto paragraph at its line, and 'BIG'
  // was gone; one of a half-em line, opened after Roboto, printed its
  // 96 pt text at Roboto's 112.5 pt line in a body of 100, and 'BIG' was
  // gone. Each is refused, naming the asset and the renderer's own face it
  // shares a name with, never the name the font states.
  test.each<[string, ResolvedDocument, string]>([
    ['Liberation Sans of a 4 em line, beside a QR-bill’s slip', billed({ sans: { normal: face('brand', withEms(LIBERATION_REGULAR, 4)) } }), 'Liberation Sans Regular'],
    ['Roboto of a 4 em line, opened before Roboto', onBody(300, [paragraph('code', { font: 'mono', size: 4 }), paragraph('BIG', { size: 96 })], { mono: { normal: face('brand', withEms(ROBOTO_REGULAR, 4)) } }), 'Roboto Regular'],
    ['Roboto of a half-em line, opened after Roboto', onBody(100, [paragraph('r', { size: 4 }), paragraph('BIG', { font: 'mono', size: 96 })], { mono: { normal: face('brand', withEms(ROBOTO_REGULAR, 0.5)) } }), 'Roboto Regular'],
  ])('refuses %s', async (_, document, own) => {
    const outcome = await refusal(document)
    expect(outcome).toMatchObject({ code: 'invalid-asset', subject: 'brand', message: `the font asset brand has the PostScript name of the renderer's own ${own}, with other bytes: PDFKit draws two faces of one PostScript name as whichever it opened first, and accepts only the renderer's own bytes under that name` })
  }, TIMEOUT)

  // Two host faces of one name: the serif, of a 4 em line, opened first,
  // and the mono's 60 pt 'BIG', counted 67 pt in its own line in a body of
  // 100, printed in the serif's 240 pt line and was gone. The second asset
  // is refused, naming the first.
  test('refuses a second host face of the first’s PostScript name and other bytes', async () => {
    const fonts = { serif: { normal: face('tall', withEms(named(LIBERATION_REGULAR, 'HostSans'), 4)) }, mono: { normal: face('plain', named(LIBERATION_REGULAR, 'HostSans')) } }
    const outcome = await refusal(onBody(100, [paragraph('s', { font: 'serif', size: 4 }), paragraph('BIG', { font: 'mono', size: 60 })], fonts))
    expect(outcome).toMatchObject({ code: 'invalid-asset', subject: 'plain', message: 'the font asset plain has a PostScript name of the font asset tall, with other bytes: PDFKit draws two faces of one PostScript name as whichever it opened first' })
  }, TIMEOUT)

  // fontkit returns the last English record's name, and report-spec's
  // reader the best: a face whose Windows record says Brand and whose later
  // Macintosh record says Liberation Sans's name is Brand to the reader and
  // Liberation Sans to PDFKit, which drew the slip in its 4 em line and lost
  // 7 of its runs. Every record's name is read, and it is refused.
  test('refuses a face whose later record holds the name, though its best is its own', async () => {
    const crafted = withPostScriptNames(withEms(LIBERATION_REGULAR, 4), 'Brand', 'LiberationSans')
    const read = readFont(crafted)
    expect(read.ok && read.names.postScriptName).toBe('Brand')
    expect(fontkit.create(Buffer.from(crafted)).postscriptName).toBe('LiberationSans')
    expect(await refusal(billed({ sans: { normal: face('brand', crafted) } }))).toMatchObject({ code: 'invalid-asset', subject: 'brand' })
  }, TIMEOUT)
})

describe('a host face of a name PDFKit keeps fonts under before it reads one', () => {
  // PDFKit looks a face opened from bytes up under `null` first and takes
  // what is there: a sans named null printed the mono beside it, Liberation
  // Mono, in itself. A name of every object's prototype finds a function,
  // and PDFKit threw a TypeError out of the render, naming nothing. Each is
  // refused as the asset it is.
  test.each(['null', 'constructor', '__proto__', 'toString', 'valueOf'])('refuses %s', async (name) => {
    const fonts = { sans: { normal: face('brand', named(LIBERATION_REGULAR, name)) }, mono: { normal: face('code', named(LIBERATION_BOLD, 'HostMono')) } }
    const outcome = await refusal(onBody(700, [paragraph('SANS', { font: 'sans' }), paragraph('MONO', { font: 'mono' })], fonts))
    expect(outcome).toMatchObject({ code: 'invalid-asset', subject: 'brand', message: 'the font asset brand has a PostScript name PDFKit keeps fonts under before it reads one, and would draw it as another face or fail on it' })
  }, TIMEOUT)
})

describe('a host face of the renderer’s own bytes', () => {
  // A host's sans of the very bytes of the renderer's Liberation Sans,
  // stripped of its layout tables, was the copy PDFKit drew the slip in,
  // opened first by the body: unkerned, the slip's runs printed wider than
  // the slip was measured, by up to 3.9 pt where a bill's names kerned. It
  // is embedded as the renderer embeds its own, kerned, and the slip prints
  // run for run as with the sans unmapped.
  test('prints a QR-bill’s slip as the renderer’s own face does', async () => {
    const control = await slipRuns(billed())
    expect(await slipRuns(billed({ sans: { normal: face('brand', LIBERATION_REGULAR) } }))).toEqual(control)
  }, TIMEOUT)

  // What the engine is handed of such a face is the face, layout tables and
  // all; any other face is stripped (`host-fonts.test.ts`).
  test('hands the engine the renderer’s own bytes', () => {
    const { files } = planFonts({ sans: { normal: face('brand', LIBERATION_REGULAR) }, serif: { normal: face('serif', named(LIBERATION_REGULAR, 'HostSans')) } }, ROBOTO).engine
    const [own, other] = [...files.values()]
    expect(Buffer.from(own!).equals(Buffer.from(LIBERATION_REGULAR))).toBe(true)
    expect(Buffer.from(other!).equals(Buffer.from(named(LIBERATION_REGULAR, 'HostSans')))).toBe(false)
  })

  // Two assets of one font's bytes are one face, which PDFKit draws as one:
  // allowed, whatever their names.
  test('prints two host assets of one font’s bytes', async () => {
    const bytes = named(LIBERATION_REGULAR, 'HostSans')
    expect(await refusal(onBody(700, [paragraph('Serif', { font: 'serif' }), paragraph('Mono', { font: 'mono' })], { serif: { normal: face('one', bytes) }, mono: { normal: face('two', bytes) } }))).toBe('rendered')
  }, TIMEOUT)
})

describe('drawnAs, the rule', () => {
  const own = createRequire(fileURLToPath(new URL('../package.json', import.meta.url)))
  const files = [
    ...['Roboto-Regular', 'Roboto-Medium', 'Roboto-Italic', 'Roboto-MediumItalic'].map((file) => path.join(path.dirname(own.resolve('pdfmake/package.json')), 'fonts', 'Roboto', `${file}.ttf`)),
    ...['LiberationSans-Regular', 'LiberationSans-Bold'].map((file) => fileURLToPath(new URL(`../fonts/${file}.ttf`, import.meta.url))),
  ]
  const hosted = (asset: FontAsset): HostFace => {
    const read = readFont(asset.bytes)
    if (!read.ok) throw new Error(read.message)
    return { asset, postScriptNames: read.names.postScriptNames }
  }

  // Each of the renderer's own faces, handed in by a host, is that face:
  // the engine embeds it as the renderer does. A table that named a face by
  // another's digest or name would strip one or refuse the other.
  test.each(files.map((file, index) => [path.basename(file), file, index] as const))('knows %s as the renderer’s own', (_, file, index) => {
    expect(drawnAs(hosted(face('host', new Uint8Array(readFileSync(file)))), [])).toBe(OWN_FACES[index])
  })

  // A face of a name of its own is drawn as itself, and so is one asset
  // seen twice, which is one face.
  test('draws a face of a name of its own as itself', () => {
    const probe = hosted(face('probe', named(LIBERATION_REGULAR, 'HostSans')))
    expect(drawnAs(probe, [])).toBeUndefined()
    expect(drawnAs(probe, [probe])).toBeUndefined()
  })
})
