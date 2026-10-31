import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pdfmake from 'pdfmake'
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'
import type { ResolvedDocument } from '@formancy/report-runtime'
import { BILL_FACES, FACES, glyphsOnce, registerHostFonts, written, type Engine, type VirtualFs } from './engine.js'
import type { HostFontFiles } from './host-fonts.js'
import type { RenderOptions } from './options.js'
import type { Finish } from './pdfa.js'
import { render } from './render.js'
import { LIBERATION_SANS } from './style.js'

/**
 * The renderer in Node: pdfmake's Node build, reading Roboto 3.014 from the
 * four font files in pdfmake's own package, and Liberation Sans 2.1.5, for
 * a QR-bill's slip, from the two in this package's `fonts` directory -- all
 * of which the dependency-licence guard reads as OFL-1.1 (0006) -- and no
 * other file, and no address at all; but for an e-invoice, whose PDF/A
 * output intent PDFKit reads from its own `data/sRGB_IEC61966_2_1.icc`
 * with `fs`, past pdfmake's policy (pdfkit.js 5265), a profile the guard
 * holds to its reviewed digest (0031). The renderer reads the same files
 * once, for the characters they have glyphs for (`glyphs.ts`): Roboto's
 * for the first document, Liberation Sans's for the first with a bill.
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
/** One of this package's own fonts, in its `fonts` directory, which stands beside `dist` as beside `src`. */
const own = (file: string): string =>
  fileURLToPath(new URL(`../fonts/${file}`, import.meta.url))
    .split(path.sep)
    .join('/')
const FONTS = {
  Roboto: {
    normal: roboto('Roboto-Regular.ttf'),
    bold: roboto('Roboto-Medium.ttf'),
    italics: roboto('Roboto-Italic.ttf'),
    bolditalics: roboto('Roboto-MediumItalic.ttf'),
  },
  [LIBERATION_SANS]: { normal: own('LiberationSans-Regular.ttf'), bold: own('LiberationSans-Bold.ttf') },
}
const FONT_FILES: ReadonlySet<string> = new Set([...Object.values(FONTS.Roboto), ...Object.values(FONTS[LIBERATION_SANS])])

/** pdfmake's virtual file system in Node, where a host face's bytes go for a render; the Roboto and Liberation files are paths, read from disk, so nothing of theirs is here. */
const virtualfs = (pdfmake as unknown as { readonly virtualfs: VirtualFs }).virtualfs

async function run(definition: TDocumentDefinitions, host: HostFontFiles, finish?: Finish): Promise<Uint8Array> {
  const cleanup = registerHostFonts(virtualfs, host)
  try {
    pdfmake.setFonts({ ...FONTS, ...host.families })
    pdfmake.setUrlAccessPolicy(() => false)
    pdfmake.setLocalAccessPolicy((file) => FONT_FILES.has(file))
    return await written(pdfmake.createPdf(definition).getStream(), finish)
  } finally {
    cleanup()
  }
}

/** pdfmake in Node, and the glyphs of the very font files it embeds. */
const engine: Engine = {
  run,
  glyphs: glyphsOnce(FACES, async (face) => new Uint8Array(await readFile(FONTS.Roboto[face]))),
  billGlyphs: glyphsOnce(BILL_FACES, async (face) => new Uint8Array(await readFile(FONTS[LIBERATION_SANS][face]))),
}

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
