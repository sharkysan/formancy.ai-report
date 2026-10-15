import type { Image } from '../document.js'
import { expectation, plainText, type Fixture } from '../fixture.js'
import { documentOf, heading, paragraph } from './build.js'
import { encodePng } from './png.js'

/**
 * A small valid PNG, drawn at the size the document gives; and bytes that
 * claim to be a PNG and are not, which an engine refuses as an invalid asset
 * naming it -- never a page with a hole where the image was.
 */
const logo: Image = {
  kind: 'image',
  asset: { id: 'logo', mediaType: 'image/png', bytes: encodePng(64, 32, (x, y) => [x * 4, y * 8, 160]) },
  width: 128,
  height: 64,
  fit: 'contain',
}
const caption = paragraph('The logo above is a 64 × 32 pixel PNG drawn at 128 × 64 points.')
const document = documentOf('Images', [heading('Images'), logo, caption])

export const images: Fixture = {
  id: 'images',
  title: 'A valid PNG, drawn at its size inside the margins',
  document,
  maxPages: 5,
  expect: expectation(document, { maxPagesExpected: 1, exactText: [plainText(caption.runs) ?? ''] }),
}

const broken: Image = {
  kind: 'image',
  asset: { id: 'logo-broken', mediaType: 'image/png', bytes: new TextEncoder().encode('These bytes say they are a PNG. They are not.') },
  width: 128,
  height: 64,
  fit: 'contain',
}
const brokenDocument = documentOf('Invalid image', [heading('Invalid image'), broken])

export const imageInvalid: Fixture = {
  id: 'image-invalid',
  title: 'An image whose bytes are not an image: refused, naming the asset',
  document: brokenDocument,
  maxPages: 5,
  expect: expectation(brokenDocument, { outcome: 'refuse', refusal: { code: 'invalid-asset', subject: broken.asset.id }, maxPagesExpected: 5 }),
}
