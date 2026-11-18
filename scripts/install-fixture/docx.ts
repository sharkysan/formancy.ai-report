/*
 * A Word file (0068), from the packed packages under Node: the quotation
 * resolved in a final render and written by report-render-docx, and the
 * file read here by Node alone -- its zip's directory walked and each
 * entry inflated by node:zlib, with no reader of this repository's -- for
 * the parts a Word file is known by, the title and the instant in its
 * core properties, the report's title among the document's text and the
 * firm's mark as the very bytes the host approved; written twice, the
 * same bytes; and the quotation as a bill, which consume.ts resolved,
 * refused whole as `unsupported`, naming its payment part, through the
 * class and the codes the package hands on. consume.ts runs it and prints
 * what it returns.
 *
 * What only this gate sees is the fflate a clean npm install gives the
 * writer, and the writer's own declarations with skipLibCheck off. What
 * it cannot see is the file in a browser, or in Word.
 */
import { resolveReport } from '@formancy/report-runtime'
import type { ImageResolver, ResolvedDocument } from '@formancy/report-runtime'
import { renderDocx, RenderRefusal } from '@formancy/report-render-docx'
import { MAX_DOCX_CHARACTERS, MAX_DOCX_MEDIA_BYTES, MAX_DOCX_PARAGRAPHS, MAX_DOCX_PICTURES, MAX_DOCX_RUNS, REFUSAL_CODES } from '@formancy/report-render-docx'
import type { RefusalCode } from '@formancy/report-render-docx'
import { inflateRawSync } from 'node:zlib'
import { logo, quotation, quotationData } from './quotation.js'

const images: ImageResolver = (ref) => (ref.asset === 'logo' && ref.digest === logo.digest ? { mediaType: 'image/svg+xml', bytes: logo.bytes } : undefined)

const CREATED = '2026-10-15T08:00:00Z'

/** The code the writer refuses what belongs to a report's PDF with, by the type the package exports. */
const UNSUPPORTED: RefusalCode = 'unsupported'

/** A zip's entries by name, each as it was before it was packed: the directory walked from where the end record says it is. */
function entriesOf(zip: Uint8Array): Map<string, Buffer> {
  const bytes = Buffer.from(zip.buffer, zip.byteOffset, zip.byteLength)
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (end < 0) throw new Error('the Word file has no zip directory')
  const found = new Map<string, Buffer>()
  let at = bytes.readUInt32LE(end + 16)
  for (let entry = 0; entry < bytes.readUInt16LE(end + 10); entry += 1) {
    if (bytes.readUInt32LE(at) !== 0x02014b50) throw new Error('the zip directory is not where its end record says')
    const name = bytes.toString('utf8', at + 46, at + 46 + bytes.readUInt16LE(at + 28))
    const local = bytes.readUInt32LE(at + 42)
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28)
    const packed = bytes.subarray(start, start + bytes.readUInt32LE(at + 20))
    // Stored, or deflated: the two a .docx is packed with.
    found.set(name, bytes.readUInt16LE(at + 10) === 0 ? packed : inflateRawSync(packed))
    at += 46 + bytes.readUInt16LE(at + 28) + bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32)
  }
  return found
}

export function wordWritten(billed: ResolvedDocument): string {
  if (!REFUSAL_CODES.includes(UNSUPPORTED)) throw new Error('the refusal codes the writer hands on do not hold unsupported')
  if (
    ![MAX_DOCX_PARAGRAPHS, MAX_DOCX_CHARACTERS, MAX_DOCX_RUNS, MAX_DOCX_PICTURES, MAX_DOCX_MEDIA_BYTES].every(
      (bound) => Number.isSafeInteger(bound) && bound > 0,
    )
  )
    throw new Error("the writer's bounds are not counts")
  const resolution = resolveReport(quotation, quotationData, { mode: 'final', images, creationDate: CREATED })
  if (!resolution.ok) throw new Error(resolution.errors.map((error) => `${error.code} at ${error.path}`).join('; '))
  const file: Uint8Array = renderDocx(resolution.document)
  const parts = entriesOf(file)
  const text = (name: string): string => parts.get(name)?.toString('utf8') ?? ''
  const marks = [...parts].filter(([name]) => name.endsWith('.svg')).map(([, part]) => part)
  const held: Readonly<Record<string, boolean>> = {
    'a zip by its first bytes': new TextDecoder('latin1').decode(file.subarray(0, 4)) === 'PK\u0003\u0004',
    'the main document part named in [Content_Types].xml': text('[Content_Types].xml').includes(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
    ),
    "the package's relationships": parts.has('_rels/.rels'),
    'the title in docProps/core.xml': text('docProps/core.xml').includes(`<dc:title>${quotation.title}</dc:title>`),
    'the instant it was made, there': text('docProps/core.xml').includes(`>${CREATED}</dcterms:created>`),
    "the title among word/document.xml's text": text('word/document.xml').includes(`>${quotation.title}</w:t>`),
    "the firm's mark, the bytes the host approved": marks.length === 1 && marks.every((mark) => mark.equals(logo.bytes)),
    'the same bytes written again': Buffer.from(renderDocx(resolution.document)).equals(file),
  }
  const missed = Object.keys(held).filter((check) => held[check] !== true)
  if (missed.length > 0) throw new Error(`the quotation's Word file lacks ${missed.join('; ')}: its parts are ${[...parts.keys()].join(', ')}`)

  let refusal: unknown
  try {
    renderDocx(billed)
  } catch (error) {
    refusal = error
  }
  if (!(refusal instanceof RenderRefusal) || refusal.code !== UNSUPPORTED || refusal.subject !== 'paymentPart')
    throw new Error(`the quotation with a QR-bill was not refused as a Word file for its payment part: ${String(refusal)}`)
  return `the quotation written as a ${file.length}-byte Word file of ${parts.size} parts that Node's zlib reads, its title and its instant in its core properties and the firm's mark the approved bytes, the same bytes twice, and with a QR-bill refused whole for its payment part`
}
