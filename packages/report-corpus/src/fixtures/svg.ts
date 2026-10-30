import type { Block, Image, Paragraph } from '../document.js'
import { expectation, plainText, type Fixture } from '../fixture.js'
import { documentOf, heading, paragraph } from './build.js'

/**
 * SVG images (0030), each as an approved asset holds one: the bytes
 * report-spec's `cleanSvg` writes, given here as they are so that a
 * reviewer reads what prints, and held to being exactly what it writes by
 * `fixtures.test.ts`. Each drawing stands in the body to `contain` and to
 * `cover`, and in the page header of each of three pages, with white paper
 * around it, so that the page's pixels can show nothing of it past its box
 * (`check-ink.ts`). And bytes declared an SVG that are not clean, which an
 * engine refuses as an invalid asset naming it, never a page with the file
 * drawn as it came.
 *
 * Not in `ALL_FIXTURES`, which is the corpus the renderer trial chose an
 * engine on (0005): neither trial adapter draws an SVG, and both refuse one
 * (`trial/undrawn.ts`). The renderer answers to these as it answers to
 * those.
 */

const encode = (text: string): Uint8Array => new TextEncoder().encode(text)

/** An invented mark, 120 units square: a deep-blue disc, a white gable stroked over a white drop. */
export const SVG_MARK = encode(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' +
    '<circle cx="60" cy="60" r="56" fill="#1f4e79"/>' +
    '<path d="M28 62 L60 32 L92 62" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M60 54 C70 68 74 76 74 82 A14 14 0 0 1 46 82 C46 76 50 68 60 54 Z" fill="#ffffff"/>' +
    '</svg>',
)

/**
 * A window, twice as wide as tall: a sky in a gradient, seen through a
 * round clip path, over a bar of ground. A clip path is painted into a
 * soft mask, in white, which a reader that did not skip masks would count
 * as a white shape of the drawing (`operators.ts`).
 */
export const SVG_WINDOW = encode(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">' +
    '<defs>' +
    '<linearGradient id="g1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1f4e79"/><stop offset="1" stop-color="#9ccbe8"/></linearGradient>' +
    '<clipPath id="c1"><circle cx="100" cy="50" r="45"/></clipPath>' +
    '</defs>' +
    '<rect width="200" height="100" fill="url(#g1)" clip-path="url(#c1)"/>' +
    '<rect x="10" y="80" width="180" height="10" fill="#e9c46a"/>' +
    '</svg>',
)

/**
 * A drawing at each bound an e-invoice holds an SVG to (0030): a clipped
 * square painted with a translucent gradient, inside a group at an
 * opacity, both shrunk a millionfold by two groups of a thousandth, so
 * that the boxes of the page-sized groups they make grow as the image's box
 * shrinks; beside it in that group a square grown a millionfold, painted
 * with a gradient whose matrix in the group's own coordinates reaches
 * 2,000,000,000; and a white square at the foot of 25 nested groups, which
 * svg-to-pdfkit draws 28 graphics states deep. The renderer draws it in an
 * e-invoice on A4 in a square box of `SVG_BOUND_SIDE` and refuses it in a
 * hundredth less (its `svg-pdfa.test.ts`); the e-invoice gate has veraPDF
 * judge it there.
 */
export const SVG_BOUND = encode(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<defs><clipPath id="c1"><rect width="1" height="1"/></clipPath>' +
    '<linearGradient id="g1"><stop offset="0" stop-color="#5b4bb7"/><stop offset="1" stop-color="#e76f51"/></linearGradient>' +
    '<linearGradient id="g2"><stop offset="0" stop-color="#e9c46a"/><stop offset="1" stop-color="#e9c46a" stop-opacity="0.5"/></linearGradient></defs>' +
    '<rect width="100" height="100" fill="#264653"/>' +
    '<g transform="matrix(0.001 0 0 0.001 0 0)"><g transform="matrix(0.001 0 0 0.001 0 0)" opacity="0.5">' +
    '<rect width="2000" height="2000" transform="matrix(1000000 0 0 1000000 0 0)" fill="url(#g1)"/>' +
    '<rect width="5" height="5" fill="url(#g2)" clip-path="url(#c1)"/></g></g>' +
    '<g transform="matrix(1 0 0 1 1 1)">'.repeat(25) +
    '<rect width="4" height="4" fill="#ffffff"/>' +
    '</g>'.repeat(25) +
    '</svg>',
)

/** The smallest square box, in points to a tenth, that the renderer draws `SVG_BOUND` in on A4 in an e-invoice. */
export const SVG_BOUND_SIDE = 41.6

/** The mark as a drawing program saves it, an XML declaration and a comment before it, its path relative and its colours short: a drawing, but not the one approval writes. */
export const SVG_AS_SAVED = encode(
  '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Saved by an invented editor -->\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="#1F4E79"/>' +
    '<path d="M28 62l32-30 32 30" fill="none" stroke="#fff" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<path d="M60 54c10 14 14 22 14 28a14 14 0 0 1-28 0c0-6 4-14 14-28z" fill="white"/></svg>\n',
)

function svgImage(id: string, bytes: Uint8Array, width: number, height: number, fit: Image['fit']): Image {
  return { kind: 'image', asset: { id, mediaType: 'image/svg+xml', bytes }, width, height, fit }
}

/** Room around a drawing: more than the band `check-ink.ts` reads, so that the text beside one is never ink in it. */
const ROOM: Block = { kind: 'spacer', height: 6 }

/**
 * The drawing `bytes` in the page header of each of three pages, under its
 * title at `header`'s size, and twice in the body of the first: to
 * `contain` in a box of `contain`'s size, and to `cover` in one of
 * `cover`'s.
 */
function drawn(
  id: string,
  title: string,
  bytes: Uint8Array,
  header: readonly [number, number],
  contain: readonly [number, number],
  cover: readonly [number, number],
  caption: Paragraph,
): Fixture {
  const titled = documentOf(title, [
    heading(title),
    ROOM,
    svgImage(id, bytes, ...contain, 'contain'),
    ROOM,
    svgImage(id, bytes, ...cover, 'cover'),
    ROOM,
    caption,
    { kind: 'pageBreak' },
    paragraph('The page header draws it again on this page.'),
    { kind: 'pageBreak' },
    paragraph('And on this one, the last.'),
  ])
  const document = { ...titled, pageHeader: [...titled.pageHeader, ROOM, svgImage(id, bytes, ...header, 'contain')] }
  // Every page prints text between its page regions, so a page left empty is still a problem, spacers or not.
  const expect = expectation(document, { minPagesExpected: 3, maxPagesExpected: 3, exactText: [plainText(caption.runs) ?? ''], noEmptyPages: true })
  return { id: `svg-${id}`, title: `${title}: an SVG drawn as vectors inside its box, in the body and on every page`, document, maxPages: 5, expect }
}

export const svgMark = drawn(
  'mark',
  'SVG mark',
  SVG_MARK,
  [24, 24],
  [120, 80],
  [120, 40],
  paragraph('The mark above is contained in a wide box, then covers one.'),
)

export const svgWindow = drawn(
  'window',
  'SVG window',
  SVG_WINDOW,
  [48, 24],
  [80, 80],
  [80, 80],
  paragraph('The window above is contained in a square, then covers one.'),
)

const saved = svgImage('mark-as-saved', SVG_AS_SAVED, 60, 60, 'contain')
const savedDocument = documentOf('SVG as saved', [heading('SVG as saved'), saved])

export const svgAsSaved: Fixture = {
  id: 'svg-as-saved',
  title: 'An SVG as a drawing program saved it, never cleaned: refused, naming the asset',
  document: savedDocument,
  maxPages: 5,
  expect: expectation(savedDocument, { outcome: 'refuse', refusal: { code: 'invalid-asset', subject: saved.asset.id }, maxPagesExpected: 5 }),
}

/** The SVG fixtures, which the renderer answers to beside `ALL_FIXTURES`. */
export const SVG_FIXTURES: readonly Fixture[] = [svgMark, svgWindow, svgAsSaved]
