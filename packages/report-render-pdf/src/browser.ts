import pdfmake from 'pdfmake/build/pdfmake.js'
import vfs from 'pdfmake/build/vfs_fonts.js'
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'
import type { ResolvedDocument } from '@formancy/report-runtime'
import { fromBase64 } from './bytes.js'
import { collect, glyphsOnce, type Engine, type PdfStream } from './engine.js'
import type { RenderOptions } from './options.js'
import { render } from './render.js'

export { REFUSAL_CODES, RenderRefusal } from '@formancy/report-runtime'
export type { RefusalCode, ResolvedDocument } from '@formancy/report-runtime'
export type { RenderOptions } from './options.js'

/**
 * The renderer in a browser: pdfmake's browser build, with Roboto 3.014
 * from pdfmake's `vfs_fonts.js`, which carries the four font files of
 * pdfmake's package as base64 -- the same bytes, which a test holds, so the
 * same OFL-1.1 fonts the dependency-licence guard reads (0006). Nothing here
 * touches a file system: the fonts are pdfmake's virtual files, and every
 * address is denied.
 *
 * Everything but the fonts and the build is the Node entry's own
 * (`render.ts`), so the two hand pdfmake the same definitions.
 *
 * The fonts go into pdfmake's virtual file system under names of the
 * renderer's own, so that a host's files of the same name and the renderer's
 * cannot replace each other, and they and the font table are set again
 * before every document, as in Node: pdfmake is one configuration per page.
 */

const FILES = { normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf', italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-MediumItalic.ttf' } as const
const own = (file: string): string => `formancy-report-render-pdf/${file}`

function fontFiles(): Record<string, string> {
  return Object.fromEntries(
    Object.values(FILES).map((file) => {
      const data = vfs[file]
      if (data === undefined) throw new Error(`pdfmake's vfs_fonts.js has no ${file}`)
      return [own(file), data]
    }),
  )
}

const FONTS = { Roboto: { normal: own(FILES.normal), bold: own(FILES.bold), italics: own(FILES.italics), bolditalics: own(FILES.bolditalics) } }

async function run(definition: TDocumentDefinitions): Promise<Uint8Array> {
  pdfmake.addVirtualFileSystem(fontFiles())
  pdfmake.setFonts(FONTS)
  pdfmake.setUrlAccessPolicy(() => false)
  return collect((await pdfmake.createPdf(definition).getStream()) as unknown as PdfStream)
}

/** pdfmake's browser build, and the glyphs of the very virtual files it embeds. */
const engine: Engine = { run, glyphs: glyphsOnce((face) => Promise.resolve(fromBase64(vfs[FILES[face]] as string))) }

/**
 * Renders `document` to a PDF in a browser, or rejects with a
 * `RenderRefusal` saying why it was not printed, exactly as the Node entry
 * does: the same refusals, the same pages.
 */
export function renderPdf(document: ResolvedDocument, options: RenderOptions): Promise<Uint8Array> {
  return render(engine, document, options)
}
