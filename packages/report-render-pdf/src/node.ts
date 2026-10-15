import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import pdfmake from 'pdfmake'
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'
import type { ResolvedDocument } from '@formancy/report-runtime'
import { collect, glyphsOnce, type Engine, type PdfStream } from './engine.js'
import type { RenderOptions } from './options.js'
import { render } from './render.js'

/**
 * The renderer in Node: pdfmake's Node build, reading Roboto 3.014 from the
 * four font files in pdfmake's own package -- which the dependency-licence
 * guard reads as OFL-1.1 (0006) -- and no other file, and no address at all.
 * The renderer reads the same four files once, for the characters they have
 * glyphs for (`glyphs.ts`).
 *
 * pdfmake is one configuration per process. It is set again before every
 * document, in the same synchronous step as `createPdf`, which reads it, so
 * that nothing else in the process that configures pdfmake can change the
 * fonts or the access policies a render runs with. The cost runs the other
 * way too: a host that uses pdfmake for something of its own finds this
 * configuration in place after every report.
 */

const require = createRequire(import.meta.url)
const pdfmakeDirectory = path.dirname(require.resolve('pdfmake/package.json'))
const roboto = (file: string): string => path.join(pdfmakeDirectory, 'fonts', 'Roboto', file).split(path.sep).join('/')
const FONTS = {
  Roboto: { normal: roboto('Roboto-Regular.ttf'), bold: roboto('Roboto-Medium.ttf'), italics: roboto('Roboto-Italic.ttf'), bolditalics: roboto('Roboto-MediumItalic.ttf') },
}
const FONT_FILES: ReadonlySet<string> = new Set(Object.values(FONTS.Roboto))

async function run(definition: TDocumentDefinitions): Promise<Uint8Array> {
  pdfmake.setFonts(FONTS)
  pdfmake.setUrlAccessPolicy(() => false)
  pdfmake.setLocalAccessPolicy((file) => FONT_FILES.has(file))
  return collect((await pdfmake.createPdf(definition).getStream()) as unknown as PdfStream)
}

/** pdfmake in Node, and the glyphs of the very font files it embeds. */
const engine: Engine = { run, glyphs: glyphsOnce(async (face) => new Uint8Array(await readFile(FONTS.Roboto[face]))) }

/**
 * Renders `document` to a PDF, or rejects with a `RenderRefusal` saying why
 * it was not printed: `too-many-pages`, `content-too-large`,
 * `invalid-asset`, `cancelled` or `unsupported`. A refused render returns
 * nothing, never a truncated or partial PDF. The same document renders to
 * the same bytes.
 */
export function renderPdf(document: ResolvedDocument, options: RenderOptions): Promise<Uint8Array> {
  return render(engine, document, options)
}
