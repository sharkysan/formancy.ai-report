import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assetDigest, readFont, type FontAsset, type Paragraph, type ResolvedDocument, type ResolvedFonts, type TextStyle } from '@formancy/report-runtime'
import { expectation, type Fixture } from '../fixture.js'
import { documentOf } from './build.js'
import { BODY_SIZE } from './geometry.js'

/**
 * A report printing its text in fonts a host approved (0043): Liberation
 * Serif and Liberation Mono 2.1.5, OFL-1.1, private test data under their
 * licence (`host-fonts/LICENSE`, `host-fonts/AUTHORS`), mapped to the
 * `serif` and `mono` tokens. It prints Latin, Greek and Cyrillic -- which
 * both faces map and neither needs shaping for -- so the renderer embeds
 * each face, draws every character, and the PDF holds the text verbatim and
 * each run in its own face.
 *
 * The checks prove it on the PDF (0003): the text comes back exactly
 * (`exactText`), each run is drawn in the face's PostScript name
 * (`fontNames`), and every font the pages use travels inside the file
 * (`fontsEmbedded`). What a face's glyph covers that the text's box, whose
 * descent the reader holds to a fifth of the size, cannot see is bounded by
 * the faces chosen: Liberation's descenders reach about a fifth of the em,
 * as Roboto's and Helvetica's do (`read-pdf.ts`), so the boxes hold.
 *
 * The bytes are read from the font files beside this fixture, which the
 * build copies next to the built corpus (`tsdown.config.ts`), so a consumer
 * of either reads the same files; a test reads them to a `FontAsset` as the
 * runtime would hand one to the renderer.
 */

/**
 * The directory beside this module, as a path. Not `new URL('./…',
 * import.meta.url)`: Vite's client transform rewrites that form into a
 * `/@fs/` address, and the Studio's jsdom suite, which imports the built
 * corpus through it, then fails at import on a file named `C:\@fs\C:\…`.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url))

/** A face as the runtime resolves one: its id, the digest the report would pin it by, and its bytes, read from the file beside this fixture. */
function face(id: string, file: string): FontAsset {
  const bytes = new Uint8Array(readFileSync(path.join(HERE, 'host-fonts', file)))
  return { id, digest: assetDigest(bytes), bytes }
}

const SERIF = {
  normal: face('serif', 'LiberationSerif-Regular.ttf'),
  bold: face('serif-bold', 'LiberationSerif-Bold.ttf'),
  italic: face('serif-italic', 'LiberationSerif-Italic.ttf'),
  boldItalic: face('serif-bold-italic', 'LiberationSerif-BoldItalic.ttf'),
}
const MONO = { normal: face('mono', 'LiberationMono-Regular.ttf'), bold: face('mono-bold', 'LiberationMono-Bold.ttf') }

const fonts: ResolvedFonts = { serif: SERIF, mono: MONO }

/** The PostScript name a face draws text in, read as the renderer reads it; a wrong map would send a run to another face, which the fontNames check catches. */
function postScriptName(asset: FontAsset): string {
  const read = readFont(asset.bytes)
  if (!read.ok) throw new Error(`the host-fonts fixture's ${asset.id} is not a font: ${read.message}`)
  return read.names.postScriptName
}

/** Latin, Greek and Cyrillic, which Liberation Serif and Mono both map. */
const SAMPLES = { latin: 'Zürich Genève Łódź', greek: 'Ελληνικά κείμενο', cyrillic: 'Кириллица текст' } as const

/**
 * A paragraph that opens with a distinctive marker word -- plain ASCII, so
 * the PDF keeps it in one item drawn in the paragraph's face -- then prints
 * Latin, Greek and Cyrillic. No marker is a substring of another, so the
 * fontNames check tells the faces apart.
 */
function line(marker: string, style: TextStyle): Paragraph {
  return { kind: 'paragraph', runs: [{ text: `${marker} ${SAMPLES.latin} · ${SAMPLES.greek} · ${SAMPLES.cyrillic}` }], style: { size: BODY_SIZE, ...style } }
}

/** Each printed run, the marker the fontNames check finds it by, and the face it must print in, derived from the map, never typed twice. */
const RUNS: readonly { readonly marker: string; readonly paragraph: Paragraph; readonly asset: FontAsset }[] = [
  { marker: 'SERIFREG', paragraph: line('SERIFREG', { font: 'serif' }), asset: SERIF.normal },
  { marker: 'SERIFBLD', paragraph: line('SERIFBLD', { font: 'serif', bold: true }), asset: SERIF.bold },
  { marker: 'SERIFITA', paragraph: line('SERIFITA', { font: 'serif', italic: true }), asset: SERIF.italic },
  { marker: 'SERIFBIT', paragraph: line('SERIFBIT', { font: 'serif', bold: true, italic: true }), asset: SERIF.boldItalic },
  { marker: 'MONOREG', paragraph: line('MONOREG', { font: 'mono' }), asset: MONO.normal },
  { marker: 'MONOBLD', paragraph: line('MONOBLD', { font: 'mono', bold: true }), asset: MONO.bold },
]

// The corpus page, header and footer (Roboto, since the report maps sans to no host font), and the serif and mono body.
const document: ResolvedDocument = {
  ...documentOf(
    'Host fonts',
    RUNS.map((run) => run.paragraph),
  ),
  fonts,
}

export const hostFonts: Fixture = {
  id: 'host-fonts',
  title: 'Host fonts: Latin, Greek and Cyrillic printed in Liberation Serif and Mono, embedded and held to each face',
  document,
  maxPages: 1,
  expect: expectation(document, {
    maxPagesExpected: 1,
    exactText: RUNS.map((run) => (run.paragraph.runs[0] as { text: string }).text),
    fontNames: RUNS.map((run) => ({ text: run.marker, postScriptName: postScriptName(run.asset) })),
  }),
}
