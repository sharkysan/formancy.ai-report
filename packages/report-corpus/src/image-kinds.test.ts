import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef } from '@pdfme/pdf-lib'
import { describe, expect, test } from 'vitest'
import { IMAGE_KINDS } from './image-kinds.js'
import { readPdf } from './read-pdf.js'
import { pdfmakePdf } from './testing/pdfmake.js'

/**
 * The images the e-invoice gate draws into an e-invoice (0031), drawn here
 * by pdfmake as the renderer hands it an image, as a data URL, and each
 * image object read back with pdf-lib: what PDFKit made of it.
 */

/** Every image object of `bytes` that is no other's soft mask, in the order PDFKit wrote them, as what it says of itself. */
async function imagesIn(bytes: Uint8Array): Promise<string[]> {
  const { context } = await PDFDocument.load(bytes, { updateMetadata: false })
  const images = context.enumerateIndirectObjects().filter(([, object]) => object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'))
  const masks = new Set(images.map(([, object]) => (object as PDFRawStream).dict.get(PDFName.of('SMask'))).filter((ref) => ref instanceof PDFRef))
  return images
    .filter(([ref]) => !masks.has(ref))
    .sort(([a], [b]) => a.objectNumber - b.objectNumber)
    .map(([, object]) => {
      const dict = (object as PDFRawStream).dict
      const space = dict.lookup(PDFName.of('ColorSpace'))
      const colours = space instanceof PDFArray ? `${space.lookup(0, PDFName).decodeText()} over ${space.lookup(1, PDFName).decodeText()}` : (space as PDFName).decodeText()
      const predictor = dict.lookupMaybe(PDFName.of('DecodeParms'), PDFDict)?.lookupMaybe(PDFName.of('Predictor'), PDFNumber)?.asNumber()
      const key = dict.lookupMaybe(PDFName.of('Mask'), PDFArray)
      return [
        `${colours}, ${String(dict.lookup(PDFName.of('BitsPerComponent'), PDFNumber).asNumber())} bits`,
        dict.lookup(PDFName.of('Filter'), PDFName).decodeText(),
        ...(predictor === undefined ? [] : [`predictor ${String(predictor)}`]),
        ...(dict.has(PDFName.of('SMask')) ? ['a soft mask'] : []),
        ...(key === undefined ? [] : [`a colour key ${key.asArray().map((entry) => String((entry as PDFNumber).asNumber())).join(' ')}`]),
      ].join(', ')
    })
}

describe('IMAGE_KINDS', () => {
  // The gate's claim is that an e-invoice holds a logo of any kind a
  // customer may hand over. That rests on these being every way PDFKit
  // embeds an image but CMYK: two that PDFKit embedded alike would leave a
  // way unjudged, and a kind PDFKit drew otherwise than its id says -- a
  // transparency it dropped, a depth it changed -- would be judged under
  // another name. Read from the objects PDFKit wrote, one image object a
  // kind, each unlike every other.
  test('are each a way of its own that PDFKit embeds an image in', async () => {
    const images = Object.fromEntries(IMAGE_KINDS.map((asset) => [asset.id, `data:${asset.mediaType};base64,${Buffer.from(asset.bytes).toString('base64')}`]))
    const bytes = await pdfmakePdf({ content: IMAGE_KINDS.map((asset) => ({ image: asset.id, width: 32 })), images })
    const read = await imagesIn(bytes)
    expect(Object.fromEntries(IMAGE_KINDS.map((asset, at) => [asset.id, read[at]]))).toEqual({
      'png-rgb': 'DeviceRGB, 8 bits, FlateDecode, predictor 15',
      'png-rgba': 'DeviceRGB, 8 bits, FlateDecode, a soft mask',
      'png-grey': 'DeviceGray, 8 bits, FlateDecode, predictor 15',
      'png-grey-alpha': 'DeviceGray, 8 bits, FlateDecode, a soft mask',
      'png-grey-16': 'DeviceGray, 16 bits, FlateDecode, predictor 15',
      'png-bilevel': 'DeviceGray, 1 bits, FlateDecode, predictor 15',
      // PDFKit's PNG reader, png-js 1.1.0, reads a colour key's bytes as
      // its samples (png.js 159-167): a grey key of 128 as its high byte,
      // 0, and an RGB key of 0, 0, 128 as six samples, which PDFKit writes
      // as twelve numbers where ISO 32000-1 asks two a component. Pinned as
      // PDFKit writes them, in every report, since 0.1.0.
      'png-grey-keyed': 'DeviceGray, 8 bits, FlateDecode, predictor 15, a colour key 0 0',
      'png-rgb-keyed': 'DeviceRGB, 8 bits, FlateDecode, predictor 15, a colour key 0 0 0 0 0 0 0 0 0 0 128 128',
      'png-paletted': 'Indexed over DeviceRGB, 8 bits, FlateDecode, predictor 15',
      'png-paletted-transparent': 'Indexed over DeviceRGB, 8 bits, FlateDecode, predictor 15, a soft mask',
      'png-interlaced': 'DeviceRGB, 8 bits, FlateDecode, predictor 1',
      'jpeg-grey': 'DeviceGray, 8 bits, DCTDecode',
      'jpeg-colour': 'DeviceRGB, 8 bits, DCTDecode',
    })
    expect(read).toHaveLength(IMAGE_KINDS.length)
    expect(new Set(read).size).toBe(IMAGE_KINDS.length)
    // And each is drawn, where PDF.js finds it on the page.
    expect((await readPdf(bytes)).pages.flatMap((page) => page.images)).toHaveLength(IMAGE_KINDS.length)
  })

  // An asset is drawn by its id, so two of one id would draw one image twice and judge the other never.
  test('are named each once', () => {
    expect(new Set(IMAGE_KINDS.map((asset) => asset.id)).size).toBe(IMAGE_KINDS.length)
  })
})
