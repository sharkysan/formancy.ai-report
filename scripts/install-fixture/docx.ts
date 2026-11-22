/*
 * A Word file (0068), from the packed packages under Node: the quotation
 * resolved in a final render and written by report-render-docx, and the
 * file read here by Node alone -- its zip's directory walked and each
 * entry inflated by node:zlib, with no reader of this repository's -- for
 * the parts a Word file is known by, the title and the instant in its
 * core properties, the report's title among the document's text and the
 * firm's mark as the very bytes the host approved; written twice, the
 * same bytes; and the quotation as a bill, which consume.ts resolved,
 * written with its slip on a page of its own (0075) -- a second section,
 * whose top margin ends where the slip's instruction begins, the bill's
 * account among the document's text, and its Swiss QR Code a picture of
 * one bit a pixel whose side is whole pixels a module of the symbol the
 * packed runtime's `swissSymbol` gives -- and, in a currency SIX does
 * not allow, refused whole as `unsupported`, naming its payment part,
 * through the class and the codes the package hands on. And the euro invoice with
 * its EPC QR code in Austria's frame (0074), which consume.ts resolved
 * too: written, its code a picture of one bit a pixel whose side is whole
 * pixels a module of the symbol the packed runtime's `epcSymbol` gives,
 * on the uqr a clean npm install gives the runtime, and its caption among
 * the document's text. And the guide's quotation with its chart (0076),
 * which chart.ts resolved and drew as a PDF: written, its chart a part
 * of the file that is a bar chart of Word's own, holding the three
 * amounts digit for digit as the runtime totalled them and the axis's
 * highest tick, with no workbook in the file and no relationships part
 * beside the chart. consume.ts runs it and prints what it returns. And
 * an e-invoice (0077), which e-invoice.ts resolved twice, as the invoice
 * and as its copy: the invoice refused whole, naming its e-invoice and
 * the option that asks for the copy, and the copy written, its page
 * header opening with the label the packed runtime gives for its kind
 * and language, bold and in the label's red, the invoice's number among
 * the document's text, and no part of the file holding the invoice's
 * XML or leading outside the package.
 *
 * What only this gate sees is the fflate and the pako a clean npm
 * install gives the writer, the uqr it gives the runtime, and the
 * writer's own declarations with skipLibCheck off. What it cannot see is
 * the file in a browser, or in Word, or what a scanner reads in the
 * picture: no decoder is in this host.
 */
import { resolveReport } from '@formancy/report-runtime'
import { E_INVOICE_COPY_LABELS, eInvoiceCopyParagraph, epcSymbol, QR_QUIET_ZONE, readCopyLabel, swissSymbol } from '@formancy/report-runtime'
import type { EpcQrCode, ImageResolver, QrSymbol, ResolvedDocument } from '@formancy/report-runtime'
import { renderDocx, RenderRefusal } from '@formancy/report-render-docx'
import {
  MAX_DOCX_CHARACTERS,
  MAX_DOCX_CHART_DIGITS,
  MAX_DOCX_CHART_POINTS,
  MAX_DOCX_CHARTS,
  MAX_DOCX_CODE_MODULES,
  MAX_DOCX_CODES,
  MAX_DOCX_FAMILY_LENGTH,
  MAX_DOCX_IMAGE_DATA,
  MAX_DOCX_MEDIA_BYTES,
  MAX_DOCX_PARAGRAPHS,
  MAX_DOCX_PICTURES,
  MAX_DOCX_RUNS,
  REFUSAL_CODES,
} from '@formancy/report-render-docx'
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

/**
 * The euro invoice with its EPC QR code in Austria's frame, written: the
 * side, in pixels, of the one picture of its file that is the code's --
 * a PNG of one bit of grey a pixel, square, as many whole pixels a module
 * as its side over the symbol's modules and their quiet zone.
 */
function codeWritten(paid: ResolvedDocument): number {
  const code = paid.body.find((block): block is EpcQrCode => block.kind === 'epcQrCode')
  if (code === undefined) throw new Error('the euro invoice holds no EPC QR code')
  const symbol: QrSymbol = epcSymbol(code, 1000)
  const across = symbol.modules.length + 2 * QR_QUIET_ZONE
  const parts = entriesOf(renderDocx(paid))
  // A PNG's header: its width and its height at bytes 16 and 20, its bit depth at 24 and its colour type at 25.
  const sides = [...parts]
    .filter(([name, part]) => /^word\/media\/image\d+\.png$/.test(name) && part.readUInt8(24) === 1 && part.readUInt8(25) === 0)
    .map(([, part]) => [part.readUInt32BE(16), part.readUInt32BE(20)] as const)
    .filter(([width, height]) => width === height && width % across === 0)
  const [side] = sides
  if (sides.length !== 1 || side === undefined)
    throw new Error(
      `the euro invoice's Word file holds ${sides.length} pictures of its code's ${across} modules: its parts are ${[...parts.keys()].join(', ')}`,
    )
  if (parts.get('word/document.xml')?.toString('utf8').includes('>Zahlen mit Code</w:t>') !== true)
    throw new Error("the euro invoice's Word file does not hold its code's caption as text")
  return side[0]
}

/**
 * The quotation as a bill, written: the side, in pixels, of the one
 * picture of its file that is its Swiss QR Code -- a PNG of one bit of
 * grey a pixel, square, as many whole pixels a module as its side over
 * the symbol's modules, with no quiet zone of its own -- in a file of two
 * sections, the second the slip's page, which holds the bill's account
 * and its instruction to separate as text.
 */
function slipWritten(billed: ResolvedDocument): number {
  const bill = billed.paymentPart
  if (bill === undefined) throw new Error('the quotation as a bill holds no payment part')
  const across = swissSymbol(bill.payload).modules.length
  const parts = entriesOf(renderDocx(billed))
  const xml = parts.get('word/document.xml')?.toString('utf8') ?? ''
  const sides = [...parts]
    .filter(([name, part]) => /^word\/media\/image\d+\.png$/.test(name) && part.readUInt8(24) === 1 && part.readUInt8(25) === 0)
    .map(([, part]) => [part.readUInt32BE(16), part.readUInt32BE(20)] as const)
    .filter(([width, height]) => width === height && width % across === 0)
  const [side] = sides
  const held: Readonly<Record<string, boolean>> = {
    'one picture of its code': sides.length === 1,
    "two sections, the report's and the slip's page": xml.split('<w:sectPr>').length === 3,
    // 192 mm down an A4 page less the instruction's line, in twentieths of a point: the slip then starts where SIX puts it.
    "the slip's page with no margin but its top's, down to the instruction": xml.includes(
      '<w:pgMar w:top="10680" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/>',
    ),
    "the bill's account as text": xml.includes(`>${bill.account}</w:t>`),
    'its instruction to separate as text': xml.includes(`>${bill.headings.separate}</w:t>`),
    'Arial with Liberation Sans as its other name': (parts.get('word/fontTable.xml')?.toString('utf8') ?? '').includes(
      '<w:font w:name="Arial"><w:altName w:val="Liberation Sans"/>',
    ),
  }
  const missed = Object.keys(held).filter((check) => held[check] !== true)
  if (missed.length > 0 || side === undefined)
    throw new Error(`the Word file of the quotation as a bill lacks ${missed.join('; ')}: its parts are ${[...parts.keys()].join(', ')}`)
  return side[0]
}

/**
 * The quotation with the guide's chart, written: the length of the one
 * part of its file that is a chart -- a bar chart of Word's own, its
 * three amounts the runtime's digits and its axis ending at the highest
 * tick -- in a file that holds no workbook and leads nowhere from it.
 */
function chartWritten(charted: ResolvedDocument): number {
  const parts = entriesOf(renderDocx(charted))
  const names = [...parts.keys()]
  const charts = names.filter((name) => name.startsWith('word/charts/'))
  const xml = parts.get('word/charts/chart1.xml')?.toString('utf8') ?? ''
  const held: Readonly<Record<string, boolean>> = {
    'one chart part and nothing beside it': charts.join() === 'word/charts/chart1.xml',
    'no workbook': !names.some((name) => /embeddings|\.xlsx$|\.bin$/.test(name)),
    "the chart's content type": (parts.get('[Content_Types].xml')?.toString('utf8') ?? '').includes(
      '<Override PartName="/word/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>',
    ),
    'the reference to it in the body': (parts.get('word/document.xml')?.toString('utf8') ?? '').includes('<c:chart xmlns:c='),
    'a bar chart': xml.includes('<c:barChart>'),
    'the three amounts, digit for digit': ['480.00', '231.00', '480.00'].every((amount) => xml.includes(`<c:v>${amount}</c:v>`)),
    'the axis to its highest tick': xml.includes('<c:max val="500"/>') && xml.includes('<c:min val="0"/>'),
    'no formula and no external data': !/<c:f>|externalData|numRef|strRef/.test(xml),
  }
  const missed = Object.keys(held).filter((check) => held[check] !== true)
  if (missed.length > 0) throw new Error(`the Word file of the quotation with a chart lacks ${missed.join('; ')}: its parts are ${names.join(', ')}`)
  return xml.length
}

/**
 * An e-invoice's Word file (0077): `invoice`, the final render that
 * carries the XML, refused whole for it, and `copy`, the same report
 * resolved with `eInvoice: 'copy'`, written -- its page header opening
 * with the runtime's label of a copy of its kind in German, `number`
 * among its text, and nothing of the invoice's XML in any part.
 */
export function copyWritten(invoice: ResolvedDocument, copy: ResolvedDocument, number: string): string {
  let refusal: unknown
  try {
    renderDocx(invoice)
  } catch (error) {
    refusal = error
  }
  if (!(refusal instanceof RenderRefusal) || refusal.code !== UNSUPPORTED || refusal.subject !== 'eInvoice' || !refusal.message.includes("eInvoice: 'copy'"))
    throw new Error(`the e-invoice itself was not refused as a Word file for its e-invoice, naming the copy to ask for: ${String(refusal)}`)
  const kind = invoice.eInvoice?.kind
  if (kind === undefined || copy.eInvoice !== undefined) throw new Error('the copy of the e-invoice carries an e-invoice, or the invoice none')
  const words = E_INVOICE_COPY_LABELS[kind].de
  const label = readCopyLabel(copy.pageHeader)
  if (label?.asWritten !== true || label.kind !== kind || label.paragraph !== eInvoiceCopyParagraph(kind, 'de-DE'))
    throw new Error("the copy of the e-invoice is not headed with the runtime's label of a copy of its kind in German")
  const file = renderDocx(copy)
  const parts = entriesOf(file)
  const header = parts.get('word/header1.xml')?.toString('utf8') ?? ''
  const held: Readonly<Record<string, boolean>> = {
    'a page header that opens with the label':
      header.indexOf(`>${words}</w:t>`) > 0 && header.indexOf('<w:t') === header.indexOf(`>${words}</w:t>`) - '<w:t xml:space="preserve"'.length,
    'the label bold, in its red, at 8 pt': /<w:b\/>.*<w:color w:val="B00020"\/>.*<w:sz w:val="16"\/>/i.test(header.slice(0, header.indexOf(words))),
    "the invoice's number as text": (parts.get('word/document.xml')?.toString('utf8') ?? '').includes(number),
    'no part that holds an invoice': ![...parts.values()].some((part) => part.includes('CrossIndustryInvoice')),
    'no relationship that leads outside the package': ![...parts].some(([name, part]) => name.endsWith('.rels') && part.includes('TargetMode')),
    "no part but a report's": [...parts.keys()].every(
      (name) => /^(\[Content_Types\]\.xml|_rels\/\.rels|docProps\/core\.xml|word\/[A-Za-z0-9_/.]+)$/.test(name) && !/factur|xrechnung|invoice/i.test(name),
    ),
  }
  const missed = Object.keys(held).filter((check) => held[check] !== true)
  if (missed.length > 0) throw new Error(`the Word file of the e-invoice's copy lacks ${missed.join('; ')}: its parts are ${[...parts.keys()].join(', ')}`)
  return `its copy written as a ${file.length}-byte Word file whose page header opens with the runtime's label of a copy and which holds nothing of the XML, the invoice itself refused as a Word file for its e-invoice`
}

export function wordWritten(billed: ResolvedDocument, paid: ResolvedDocument, charted: ResolvedDocument): string {
  if (!REFUSAL_CODES.includes(UNSUPPORTED)) throw new Error('the refusal codes the writer hands on do not hold unsupported')
  if (
    ![
      MAX_DOCX_PARAGRAPHS,
      MAX_DOCX_CHARACTERS,
      MAX_DOCX_RUNS,
      MAX_DOCX_PICTURES,
      MAX_DOCX_MEDIA_BYTES,
      MAX_DOCX_IMAGE_DATA,
      MAX_DOCX_FAMILY_LENGTH,
      MAX_DOCX_CODES,
      MAX_DOCX_CODE_MODULES,
      MAX_DOCX_CHARTS,
      MAX_DOCX_CHART_POINTS,
      MAX_DOCX_CHART_DIGITS,
    ].every((bound) => Number.isSafeInteger(bound) && bound > 0)
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

  const slip = slipWritten(billed)
  if (billed.paymentPart === undefined) throw new Error('the quotation as a bill holds no payment part')
  // A currency SIX does not allow, which no runtime resolves: the rule below both engines refuses the bill, and nothing is written of it.
  const unpayable: ResolvedDocument = { ...billed, paymentPart: { ...billed.paymentPart, currency: 'USD' as 'CHF' } }
  let refusal: unknown
  try {
    renderDocx(unpayable)
  } catch (error) {
    refusal = error
  }
  if (!(refusal instanceof RenderRefusal) || refusal.code !== UNSUPPORTED || refusal.subject !== 'paymentPart')
    throw new Error(`the quotation with a QR-bill in a currency SIX does not allow was not refused as a Word file for its payment part: ${String(refusal)}`)
  const side = codeWritten(paid)
  const chart = chartWritten(charted)
  return `the quotation written as a ${file.length}-byte Word file of ${parts.size} parts that Node's zlib reads, its title and its instant in its core properties and the firm's mark the approved bytes, the same bytes twice, and with a QR-bill written with its slip on a page of its own, its Swiss QR Code a picture ${slip} pixels a side of whole pixels a module, and refused whole for its payment part in a currency SIX does not allow; and the euro invoice written with its EPC QR code in Austria's frame, a picture ${side} pixels a side of whole pixels a module of the symbol the runtime gives; and the quotation with its chart written, the chart a part of ${chart} characters that is a bar chart of Word's own with the runtime's digits and no workbook`
}
