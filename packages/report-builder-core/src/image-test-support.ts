/**
 * What the image tests add images with. Only test files import this; the
 * published entry never reaches it.
 *
 * The PNGs and JPEGs are built here byte by byte, their CRCs computed bit
 * by bit from PNG's definition, so that no test's picture leans on the
 * reader it checks. Their image data is a few bytes nothing inflates: an
 * add reads a picture's structure and header, and leaves its data to print.
 */
import { emptyReport, validateReport } from '@formancy/report-spec'
import type { FieldRef, Inline, ReportDefinition } from '@formancy/report-spec'
import type { AddedImage, ImageFile, ImageStore, KeptImage } from './image-store.js'

/** CRC-32 as PNG defines it (ISO/IEC 15948, annex D), one bit at a time. */
function crc(bytes: Uint8Array): number {
  let value = 0xffffffff
  for (const byte of bytes) {
    value ^= byte
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1
  }
  return (value ^ 0xffffffff) >>> 0
}

const uint32 = (value: number): number[] => [value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
const ascii = (text: string): number[] => [...text].map((char) => char.charCodeAt(0))

function chunk(type: string, data: readonly number[], wrong = false): number[] {
  const body = [...ascii(type), ...data]
  return [...uint32(data.length), ...body, ...uint32((crc(Uint8Array.from(body)) ^ (wrong ? 1 : 0)) >>> 0)]
}

/** A PNG of `width` × `height` 8-bit RGB pixels, its header chunk's CRC wrong when `wrong`. */
export function png(width: number, height: number, wrong = false): Uint8Array {
  const header = [...uint32(width), ...uint32(height), 8, 2, 0, 0, 0]
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', header, wrong), ...chunk('IDAT', [0x78, 0x9c, 0x63, 0, 0, 0, 1, 0, 1]), ...chunk('IEND', [])])
}

/** A baseline JPEG's segments for a frame of `width` × `height`, of three components (RGB) or as many as given -- four are CMYK -- and an Exif orientation when one is given. */
export function jpeg(width: number, height: number, orientation?: number, components = 3): Uint8Array {
  const segment = (marker: number, data: readonly number[]): number[] => [0xff, marker, (data.length + 2) >>> 8, (data.length + 2) & 0xff, ...data]
  // Exif's TIFF header, big-endian, and one directory of one entry: the Orientation tag, a SHORT.
  const exif = orientation === undefined ? [] : segment(0xe1, [...ascii('Exif'), 0, 0, ...ascii('MM'), 0, 42, ...uint32(8), 0, 1, 0x01, 0x12, 0, 3, ...uint32(1), 0, orientation, 0, 0, ...uint32(0)])
  const ids = Array.from({ length: components }, (_, index) => index + 1)
  const frame = segment(0xc0, [8, height >>> 8, height & 0xff, width >>> 8, width & 0xff, components, ...ids.flatMap((id) => [id, 0x11, 0])])
  const scan = segment(0xda, [components, ...ids.flatMap((id) => [id, 0x11]), 0, 63, 0])
  return Uint8Array.from([0xff, 0xd8, ...exif, ...frame, ...scan, 0x12, 0x34, 0xff, 0xd9])
}

const said = (text: string): readonly Inline[] => [{ kind: 'text', text }]
const line = (field: string): FieldRef => ({ dataset: 'detail', field })

/**
 * The smallest report the validator takes as an EN 16931 e-invoice (0027):
 * a table of lines, the totals printed, a seller and a buyer. Its PDF is a
 * PDF/A-3b whose output intent is sRGB (0031), beside which no image may be
 * CMYK.
 */
export function eInvoiceReport(): ReportDefinition {
  const base = emptyReport('invoice', 'Invoice', 'de-DE')
  const columns = ['name', 'quantity', 'price', 'amount']
  const report: ReportDefinition = {
    ...base,
    datasets: {
      detail: {
        id: 'lines',
        fields: [{ id: 'name', type: 'string', label: 'Name', nullable: false }, ...columns.slice(1).map((id) => ({ id, type: 'decimal' as const, label: id, nullable: false, scale: 2 }))],
      },
    },
    regions: {
      ...base.regions,
      body: [{ id: 'lines', kind: 'table', dataset: 'detail', columns: columns.map((id) => ({ id, header: id, width: 'fill' as const, align: 'left' as const, value: { kind: 'field' as const, field: line(id) } })), totals: [], emptyText: 'None.', repeatHeader: true }],
      summary: [{ id: 'totals', kind: 'text', content: ['invoice.taxBasisTotal', 'vatBasis.standard', 'vatAmount.standard', 'invoice.taxTotal', 'invoice.grandTotal', 'invoice.duePayable'].map((cel) => ({ kind: 'expression' as const, expression: { cel } })) }],
    },
    eInvoice: {
      kind: 'facturX',
      profile: 'en16931',
      type: '380',
      currency: 'EUR',
      number: said('RE-1'),
      issued: { cel: 'date("2026-10-19")' },
      seller: { name: said('Muster GmbH'), vatId: said('DE 123 456 789'), address: { line1: said('Industriestraße 7'), postalCode: said('50735'), city: said('Köln'), country: said('DE') } },
      buyer: { name: said('Kunde AG'), address: { line1: said('Ring 1'), postalCode: said('1010'), city: said('Wien'), country: said('AT') } },
      delivered: { cel: 'date("2026-10-19")' },
      vat: [{ id: 'standard', code: 'S', rate: '19' }],
      lines: { table: 'lines', id: { kind: 'field', field: line('name') }, name: 'name', quantity: 'quantity', netPrice: 'price', netAmount: 'amount', unit: { kind: 'expression', expression: { cel: '"H87"' } }, vat: { kind: 'expression', expression: { cel: '"standard"' } } },
    },
  }
  const outcome = validateReport(report)
  if (!outcome.valid) throw new Error(`the e-invoice is not valid: ${outcome.errors.map((error) => `${error.code} ${error.path}`).join(', ')}`)
  return report
}

/** A GIF's signature and its smallest screen: an image, and no image the format draws. */
export const GIF = Uint8Array.from([...ascii('GIF89a'), 1, 0, 1, 0, 0, 0, 0, 0x3b])

/** `text` as the UTF-8 bytes a file of it holds, encoded here: ES2023's library has no TextEncoder. */
export function utf8(text: string): Uint8Array {
  const bytes: number[] = []
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (code < 0x80) bytes.push(code)
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
  }
  return Uint8Array.from(bytes)
}

/** A file a person chose: `bytes` under `name`, its size the one it says (`size`) or its bytes' length, with how often it was read. */
export function chosen(name: string, bytes: Uint8Array, size: number = bytes.length): ImageFile & { readonly reads: () => number } {
  let reads = 0
  return {
    name,
    size,
    async arrayBuffer() {
      reads += 1
      return Uint8Array.from(bytes).buffer
    },
    reads: () => reads,
  }
}

/** A store that answers as `answer` says -- keeping everything when absent -- and lists what it was offered, and what it kept. */
export function recordingStore(answer: (image: AddedImage) => KeptImage | Promise<KeptImage> = () => ({ ok: true }), accept?: ImageStore['accept']): ImageStore & { readonly offered: AddedImage[]; readonly kept: AddedImage[] } {
  const offered: AddedImage[] = []
  const kept: AddedImage[] = []
  return {
    ...(accept === undefined ? {} : { accept }),
    offered,
    kept,
    async keep(image) {
      offered.push(image)
      const said = await answer(image)
      if (said.ok) kept.push(image)
      return said
    },
  }
}
