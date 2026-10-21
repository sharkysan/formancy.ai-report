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
 *   its installable embedding, its metrics, its characters -- and its
 *   character map alone gives the same characters;
 * - the same bytes with Restricted License embedding in its fsType, and a
 *   collection's header, are refused, each with its code, and neither
 *   message holds a byte of the font.
 */
import { characterMap, FONT_REFUSAL_CODES, MAX_FONT_BYTES, readFont } from '@formancy/report-spec'
import type { Font, FontRefusal } from '@formancy/report-spec'
import { characterMap as runtimeCharacterMap, FONT_REFUSAL_CODES as RUNTIME_FONT_REFUSAL_CODES, MAX_FONT_BYTES as RUNTIME_MAX_FONT_BYTES, readFont as runtimeReadFont } from '@formancy/report-runtime'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** The bytes of one of the packed renderer's own fonts, from the directory beside its dist. */
const shipped = (file: string): Uint8Array => new Uint8Array(readFileSync(fileURLToPath(new URL(`../fonts/${file}`, import.meta.resolve('@formancy/report-render-pdf')))))

/** Where `bytes`' OS/2 table starts, read from its directory. */
function os2At(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let index = 0; index < view.getUint16(4); index++) {
    const record = 12 + 16 * index
    if (String.fromCharCode(...bytes.subarray(record, record + 4)) === 'OS/2') return view.getUint32(record + 8)
  }
  throw new Error('the font has no OS/2 table')
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
  if (names.family !== 'Liberation Sans' || names.postScriptName !== 'LiberationSans' || names.version !== 'Version 2.1.5' || embedding !== 'installable') {
    throw new Error(`Liberation Sans was read as ${names.family}, ${names.postScriptName}, ${String(names.version)}, ${embedding}`)
  }
  if (metrics.unitsPerEm !== 2048 || metrics.ascender !== 1854 || metrics.descender !== -434 || metrics.lineGap !== 67 || characters.size !== 2327) {
    throw new Error(`Liberation Sans was read with the metrics ${JSON.stringify(metrics)} and ${characters.size} characters`)
  }
  const map = characterMap(bytes)
  if (!map.ok || map.characters.size !== characters.size || ![...characters].every((point) => map.characters.has(point))) throw new Error('the character map alone did not give the characters the whole font did')

  const restricted = Uint8Array.from(bytes)
  new DataView(restricted.buffer).setUint16(os2At(restricted) + 8, 0x0002)
  const refusal = readFont(restricted)
  if (refusal.ok || refusal.code !== 'embedding' || refusal.embedding !== 'restricted' || refusal.message.includes('Liberation')) throw new Error(`Restricted License embedding was not refused as such: ${refusal.ok ? 'read' : refusal.message}`)
  const collection = readFont(Uint8Array.from([0x74, 0x74, 0x63, 0x66, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 16]))
  if (collection.ok || collection.code !== 'format' || collection.format !== 'collection') throw new Error('a collection was not refused as one')
  return `the runtime's font reader was report-spec's own; the packed renderer's Liberation Sans was read as ${names.family}, ${names.version}, installable, ${metrics.ascender} over ${metrics.descender} of ${metrics.unitsPerEm} units, mapping ${characters.size} characters, which its character map alone gave too, and the same font with Restricted License embedding and a collection's header were refused, each by its code`
}
