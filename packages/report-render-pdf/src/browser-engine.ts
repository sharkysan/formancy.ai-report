import pdfmake from 'pdfmake/build/pdfmake.js'
import vfs from 'pdfmake/build/vfs_fonts.js'
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { fromBase64 } from './bytes.js'
import { BILL_FACES, FACES, faceWidths, glyphsOf, glyphsOnce, loadOnce, registerHostFonts, written, type Engine, type VirtualFs } from './engine.js'
import type { BillFace } from './glyphs.js'
import type { HostFontFiles } from './host-fonts.js'
import { LIBERATION_SANS } from './style.js'

/**
 * The renderer's engine in a browser: pdfmake's browser build, with Roboto
 * 3.014 from pdfmake's `vfs_fonts.js`, which carries the four font files of
 * pdfmake's package as base64 -- the same bytes, which a test holds, so the
 * same OFL-1.1 fonts the dependency-licence guard reads (0006). Nothing here
 * touches a file system: the fonts are pdfmake's virtual files, and every
 * address is denied. An e-invoice's PDF/A output intent is the ICC profile
 * the browser build carries as base64 (`build/pdfmake.js` 20777), the very
 * bytes of PDFKit's file, which `browser.test.ts` holds.
 *
 * A QR-bill's slip and an EPC QR code's caption print in Liberation Sans
 * 2.1.5, whose two faces come as base64 in a module of their own
 * (`bill-fonts.ts`), the very bytes of this package's `fonts` directory,
 * which a test holds too. It is imported the first time a document has a
 * payment part or a captioned EPC QR code, and never otherwise: the build
 * makes it a chunk of its own, and an app's bundler loads that chunk only
 * when a bill or a caption asks for it. An import that failed is not kept:
 * the document it failed for fails, and the next one imports the chunk
 * again.
 *
 * Everything but the fonts and the build is the Node entry's own
 * (`render.ts`), so the two hand pdfmake the same definitions.
 *
 * The fonts go into pdfmake's virtual file system under names of the
 * renderer's own, so that a host's files of the same name and the renderer's
 * cannot replace each other, and they and the font table are set again
 * before every document, as in Node: pdfmake is one configuration per page.
 *
 * The engine stands apart from the browser entry (`browser.ts`), which
 * renders with it, so that a test reaches it and nothing a host imports
 * does; Node's is `node.ts`'s, which is not an entry (`index.ts` is).
 */

const FILES = { normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf', italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-MediumItalic.ttf' } as const
const BILL_FILES = { normal: 'LiberationSans-Regular.ttf', bold: 'LiberationSans-Bold.ttf' } as const
const own = (file: string): string => `formancy-report-render-pdf/${file}`

/** Liberation Sans's faces as base64, once a document with a bill or a captioned code has loaded them. */
let billFonts: Readonly<Record<BillFace, string>> | undefined

/**
 * Liberation Sans's glyphs, from the faces in the chunk that carries them:
 * imported by the first document with a bill or a captioned code and kept
 * once they have been read, and imported again by the next such document
 * after an import that failed, which would otherwise fail every bill and
 * caption until the page reloaded (`loadOnce`).
 */
const billGlyphs = loadOnce(async () => {
  const { LIBERATION_SANS: faces } = await import('./bill-fonts.js')
  const glyphs = await glyphsOf(BILL_FACES, async (face) => fromBase64(faces[face]))
  billFonts = faces
  return glyphs
})

function fontFiles(): Record<string, string> {
  const roboto = Object.values(FILES).map((file) => {
    const data = vfs[file]
    if (data === undefined) throw new Error(`pdfmake's vfs_fonts.js has no ${file}`)
    return [own(file), data] as const
  })
  const loaded = billFonts
  const liberation = loaded === undefined ? [] : BILL_FACES.map((face) => [own(BILL_FILES[face]), loaded[face]] as const)
  return Object.fromEntries([...roboto, ...liberation])
}

const FONTS = {
  Roboto: { normal: own(FILES.normal), bold: own(FILES.bold), italics: own(FILES.italics), bolditalics: own(FILES.bolditalics) },
  [LIBERATION_SANS]: { normal: own(BILL_FILES.normal), bold: own(BILL_FILES.bold) },
}

/** pdfmake's virtual file system in the browser build, where a host face's bytes go for a render, beside the Roboto and Liberation base64 the build carries. */
const virtualfs = (pdfmake as unknown as { readonly virtualfs: VirtualFs }).virtualfs

/**
 * What `use` makes of the document pdfmake makes of `definition`, with the
 * renderer's fonts and `host`'s faces in pdfmake's virtual files and
 * pdfmake configured in the same synchronous step as `createPdf`; the host's
 * faces removed after, whether it answered or threw.
 */
async function withDocument<T>(definition: TDocumentDefinitions, host: HostFontFiles, use: (document: Promise<unknown>) => Promise<T>): Promise<T> {
  pdfmake.addVirtualFileSystem(fontFiles())
  const cleanup = registerHostFonts(virtualfs, host)
  try {
    pdfmake.setFonts({ ...FONTS, ...host.families })
    pdfmake.setUrlAccessPolicy(() => false)
    return await use(pdfmake.createPdf(definition).getStream())
  } finally {
    cleanup()
  }
}

/** pdfmake's browser build, and the glyphs of the very virtual files it embeds. */
export const engine: Engine = {
  run: (definition, host, finish) => withDocument(definition, host, (document) => written(document, finish)),
  widths: (host, faces) => withDocument({ content: [] }, host, (document) => faceWidths(document, faces)),
  glyphs: glyphsOnce(FACES, (face) => Promise.resolve(fromBase64(vfs[FILES[face]] as string))),
  billGlyphs,
}
