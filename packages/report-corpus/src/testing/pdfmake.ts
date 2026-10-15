import { createRequire } from 'node:module'
import path from 'node:path'
import pdfmake from 'pdfmake'
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'

/**
 * Real PDFs for the reader's and the checks' own tests, made by pdfmake from
 * plain document definitions. Not an engine adapter: a test writes the exact
 * PDF it needs -- a missing row, a footer left off a page -- and proves a
 * check sees it on the bytes, never on a mocked page.
 *
 * pdfmake is one configuration per process, so this sets it once: Roboto from
 * pdfmake's own package (Roboto 3, SIL Open Font License 1.1, which allows
 * embedding), Helvetica as an unembedded standard font for the one test that
 * needs a font missing from the file, no URL access, and local access to those
 * files only.
 */
const pdfmakeDirectory = path.dirname(createRequire(import.meta.url).resolve('pdfmake/package.json'))
const roboto = (file: string): string => path.join(pdfmakeDirectory, 'fonts', 'Roboto', file).split(path.sep).join('/')

const fonts = {
  Roboto: {
    normal: roboto('Roboto-Regular.ttf'),
    bold: roboto('Roboto-Medium.ttf'),
    italics: roboto('Roboto-Italic.ttf'),
    bolditalics: roboto('Roboto-MediumItalic.ttf'),
  },
  Helvetica: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' },
}
const allowed = new Set<string>(Object.values(fonts).flatMap((family) => Object.values(family)))

pdfmake.setFonts(fonts)
pdfmake.setUrlAccessPolicy(() => false)
pdfmake.setLocalAccessPolicy((file) => allowed.has(file.split(path.sep).join('/')))

/** The PDF pdfmake makes of `definition`, with a fixed creation date. */
export async function pdfmakePdf(definition: TDocumentDefinitions): Promise<Uint8Array> {
  const buffer = await pdfmake.createPdf({ ...definition, info: { title: 'corpus test', creationDate: new Date('2026-01-01T00:00:00Z'), ...definition.info } }).getBuffer()
  return new Uint8Array(buffer)
}
