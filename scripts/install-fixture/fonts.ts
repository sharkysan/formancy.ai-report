/*
 * A font read by report-spec's reader (0040), from the packed packages under
 * Node: the entry points a host approving a font calls, on a real font's
 * bytes. consume.ts runs it and prints what it returns; it lives apart
 * because consume.ts stands near its size budget.
 *
 * - the runtime hands on report-spec's own reader, its refusal codes and
 *   its bounds, not copies, so that what a host approves by one is what
 *   an engine reads by the other;
 * - the packed renderer's Liberation Sans, from the `fonts` directory its
 *   tarball ships, is read whole to the values its file holds -- its names,
 *   every PostScript name among them, its installable embedding, its
 *   metrics, its characters -- and its character map alone gives the same
 *   characters;
 * - the same bytes with Restricted License embedding in its fsType, and a
 *   collection's header, are refused, each with its code, and neither
 *   message holds a byte of the font.
 */
import { assetDigest, characterMap, FONT_REFUSAL_CODES, MAX_FONT_BYTES, readFont } from '@formancy/report-spec'
import type { Font, FontRefusal, ReportDefinition } from '@formancy/report-spec'
import { characterMap as runtimeCharacterMap, FONT_REFUSAL_CODES as RUNTIME_FONT_REFUSAL_CODES, MAX_FONT_BYTES as RUNTIME_MAX_FONT_BYTES, readFont as runtimeReadFont } from '@formancy/report-runtime'
import { resolveReport } from '@formancy/report-runtime'
import type { AssetResolver, ReportData } from '@formancy/report-runtime'
import { renderPdf, RenderRefusal } from '@formancy/report-render-pdf'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** The bytes of one of the packed renderer's own fonts, from the directory beside its dist. */
const shipped = (file: string): Uint8Array => new Uint8Array(readFileSync(fileURLToPath(new URL(`../fonts/${file}`, import.meta.resolve('@formancy/report-render-pdf')))))

/** Where `bytes`' table tagged `tag` starts, read from its directory. */
function tableAt(bytes: Uint8Array, tag: string): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let index = 0; index < view.getUint16(4); index++) {
    const record = 12 + 16 * index
    if (String.fromCharCode(...bytes.subarray(record, record + 4)) === tag) return view.getUint32(record + 8)
  }
  throw new Error(`the font has no ${tag} table`)
}

/** Checks a font read from the packed packages; throws on the first wrong, and says what held. */
export function fontsRead(): string {
  if (runtimeReadFont !== readFont || runtimeCharacterMap !== characterMap || RUNTIME_FONT_REFUSAL_CODES !== FONT_REFUSAL_CODES || RUNTIME_MAX_FONT_BYTES !== MAX_FONT_BYTES) {
    throw new Error("the runtime's font reader is not report-spec's own")
  }
  const bytes = shipped('LiberationSans-Regular.ttf')
  const read: Font | FontRefusal = readFont(bytes)
  if (!read.ok) throw new Error(`the packed renderer's Liberation Sans was refused: ${read.message}`)
  const { names, embedding, metrics, characters } = read
  if (names.family !== 'Liberation Sans' || names.postScriptName !== 'LiberationSans' || names.postScriptNames.join() !== 'LiberationSans' || names.version !== 'Version 2.1.5' || embedding !== 'installable') {
    throw new Error(`Liberation Sans was read as ${names.family}, ${names.postScriptNames.join(' and ')}, ${String(names.version)}, ${embedding}`)
  }
  if (metrics.unitsPerEm !== 2048 || metrics.ascender !== 1854 || metrics.descender !== -434 || metrics.lineGap !== 67 || characters.size !== 2327) {
    throw new Error(`Liberation Sans was read with the metrics ${JSON.stringify(metrics)} and ${characters.size} characters`)
  }
  const map = characterMap(bytes)
  if (!map.ok || map.characters.size !== characters.size || ![...characters].every((point) => map.characters.has(point))) throw new Error('the character map alone did not give the characters the whole font did')

  const restricted = Uint8Array.from(bytes)
  new DataView(restricted.buffer).setUint16(tableAt(restricted, 'OS/2') + 8, 0x0002)
  const refusal = readFont(restricted)
  if (refusal.ok || refusal.code !== 'embedding' || refusal.embedding !== 'restricted' || refusal.message.includes('Liberation')) throw new Error(`Restricted License embedding was not refused as such: ${refusal.ok ? 'read' : refusal.message}`)
  const collection = readFont(Uint8Array.from([0x74, 0x74, 0x63, 0x66, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 16]))
  if (collection.ok || collection.code !== 'format' || collection.format !== 'collection') throw new Error('a collection was not refused as one')
  return `the runtime's font reader was report-spec's own; the packed renderer's Liberation Sans was read as ${names.family}, ${names.version}, installable, ${metrics.ascender} over ${metrics.descender} of ${metrics.unitsPerEm} units, mapping ${characters.size} characters, which its character map alone gave too, and the same font with Restricted License embedding and a collection's header were refused, each by its code`
}

/**
 * A report mapping its `serif` token to the packed Liberation Sans, from the
 * packed packages (0043): the runtime hands the font's bytes over through
 * the asset resolver, and the renderer embeds them. A host of its own, so
 * that the packaged packages print in a font a host supplied, not only read
 * one.
 */
export async function hostFontRendered(): Promise<string> {
  const bytes = shipped('LiberationSans-Regular.ttf')
  const digest = assetDigest(bytes)
  const report: ReportDefinition = {
    reportSpecVersion: '0',
    id: 'host-font',
    title: 'Host font',
    locale: 'en',
    page: { size: 'A4', orientation: 'portrait', margins: { top: 40, right: 40, bottom: 40, left: 40 } },
    styles: [{ id: 'serif', font: 'serif', size: 12 }],
    datasets: {},
    parameters: [],
    assets: [{ id: 'brand', mediaType: 'font/ttf', digest }],
    aggregates: [],
    fonts: { serif: { normal: 'brand' } },
    regions: { reportHeader: [{ id: 'heading', kind: 'text', style: 'serif', content: [{ kind: 'text', text: 'Zürich Genève Ελληνικά Кириллица' }] }], pageHeader: [], body: [], pageFooter: [], summary: [] },
  }
  const images: AssetResolver = (ref) => (ref.asset === 'brand' && ref.digest === digest ? { mediaType: 'font/ttf', bytes } : undefined)
  const data: ReportData = { completeness: { complete: true, captured: 0 }, consistency: 'host-captured' }
  const resolution = resolveReport(report, data, { mode: 'final', parameters: {}, images, creationDate: '2026-10-15T08:00:00Z' })
  if (!resolution.ok) throw new Error(`the host-font report was refused: ${resolution.errors.map((error) => `${error.code} at ${error.path}`).join('; ')}`)
  if (resolution.document.fonts?.serif?.normal.id !== 'brand') throw new Error('the host font did not reach the resolved document')
  const pdf = await renderPdf(resolution.document, { maxPages: 5 })
  if (new TextDecoder().decode(pdf.subarray(0, 5)) !== '%PDF-') throw new Error('the host-font report did not render to a PDF')
  // The one run is serif, so the one font the PDF embeds is the host's, subset: Roboto, or none, would mean the map never reached the page.
  const faces = new Set([...new TextDecoder('latin1').decode(pdf).matchAll(/\/BaseFont \/([A-Z]{6})\+([A-Za-z0-9-]+)/g)].map((match) => match[2]))
  if (faces.size !== 1 || !faces.has('LiberationSans')) throw new Error(`the host-font report did not embed the host's face alone: ${[...faces].join(', ') || 'no subset font'}`)
  // The same face with its line gap one unit more keeps its PostScript name, under which PDFKit would draw it and the renderer's own Liberation Sans as one: refused, naming the asset, where the packed renderer's own bytes printed.
  const altered = Uint8Array.from(bytes)
  const view = new DataView(altered.buffer)
  view.setInt16(tableAt(altered, 'hhea') + 8, view.getInt16(tableAt(altered, 'hhea') + 8) + 1)
  const refusal = await renderPdf({ ...resolution.document, fonts: { serif: { normal: { id: 'brand', digest: assetDigest(altered), bytes: altered } } } }, { maxPages: 5 }).then(
    () => undefined,
    (error: unknown) => error,
  )
  if (!(refusal instanceof RenderRefusal) || refusal.code !== 'invalid-asset' || refusal.subject !== 'brand') throw new Error(`a face of the renderer's own PostScript name and other bytes was not refused as an invalid asset: ${String(refusal)}`)
  return `a report mapping serif to the packed Liberation Sans resolved and rendered to a ${pdf.length}-byte PDF that embeds a subset of it and no other font, its Latin, Greek and Cyrillic in a font the host supplied, and a copy of it with one metric changed was refused, PDFKit drawing two faces of one name as one`
}
