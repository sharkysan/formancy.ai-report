import { createHash } from 'node:crypto'
import { diagnose } from '@formancy/report-core'
import { checkSvg, cleanSvg, resolveReport } from '@formancy/report-runtime'
import type { ReportDefinition } from '@formancy/report-runtime'
import { SaxesParser } from 'saxes'
import { describe, expect, test } from 'vitest'
import { SVG_AS_SAVED, SVG_MARK } from '../fixtures/svg.js'
import { E_INVOICE_SAMPLES, EURO_INVOICE_SAMPLES, INVOICE_SAMPLES, LETTERHEAD, LOGO, STARTER_IMAGES, starterImages, STARTERS } from './index.js'
import type { Starter } from './index.js'

/**
 * The firm's mark (0032): one invented, wordless drawing that the QR-bill
 * invoice, the euro invoice and the quotation, their samples and the
 * e-invoice samples print at the top left of their first page. Which
 * reports carry it is stated here, never read from the starters, and the
 * drawing is read back by saxes, a parser that is not the cleaner. That it
 * prints where it is declared is held on the PDF by report-render-pdf's
 * `starters.test.ts`, `samples.test.ts`, `euro-samples.test.ts` and
 * `e-invoice-samples.test.ts`.
 */

/** Every report of the corpus a person sees printed, once: the starters, then the samples that are not starters. */
const EVERY: readonly Starter[] = [...new Set([...STARTERS, ...INVOICE_SAMPLES, ...EURO_INVOICE_SAMPLES, ...E_INVOICE_SAMPLES])]

/** The firm's invoices and its quotation, by id: the reports that print its mark, stated rather than read. */
const MARKED = [
  'quotation',
  'invoice',
  'euro-invoice',
  'invoice-fr',
  'invoice-it',
  'invoice-en',
  'euro-invoice-at',
  'euro-invoice-fr',
  'euro-invoice-it',
  'euro-invoice-es',
  'euro-invoice-nl',
  'euro-invoice-ie',
  'e-invoice',
  'e-invoice-reverse-charge',
  'e-invoice-exempt-paid',
  'e-invoice-addressed',
]

/** The reports that are no firm's letter, and print no mark: a technician's visit, a register, and the draft generated from the site visit form. */
const UNMARKED = ['service-inspection', 'grouped-equipment', 'site-visit']

type Component = ReportDefinition['regions']['body'][number]

/** Every component of `report`, containers' children included, in document order. */
function components(report: ReportDefinition): Component[] {
  const found: Component[] = []
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(walk)
    else if (typeof value === 'object' && value !== null) {
      if (typeof (value as { kind?: unknown }).kind === 'string' && typeof (value as { id?: unknown }).id === 'string') found.push(value as Component)
      Object.values(value).forEach(walk)
    }
  }
  walk(report.regions)
  return found
}

/** The drawing's elements as saxes reads them, each with its attributes, and every text node that is not whitespace. */
function readDrawing(bytes: Uint8Array): {
  readonly elements: readonly { readonly name: string; readonly attributes: Readonly<Record<string, string>> }[]
  readonly texts: readonly string[]
} {
  const elements: { name: string; attributes: Record<string, string> }[] = []
  const texts: string[] = []
  const parser = new SaxesParser({ xmlns: true })
  parser.on('opentag', (tag) =>
    elements.push({ name: tag.local, attributes: Object.fromEntries(Object.values(tag.attributes).map((attribute) => [attribute.local, attribute.value])) }),
  )
  parser.on('text', (text) => {
    if (text.trim() !== '') texts.push(text)
  })
  parser.on('cdata', (text) => texts.push(text))
  parser.write(new TextDecoder().decode(bytes)).close()
  return { elements, texts }
}

describe("the firm's mark", () => {
  // The mark is the drawing a reviewer read in 0030's corpus, as approval
  // writes it: the mark as a drawing program saved it, cleaned by the
  // runtime's own cleanSvg, is these bytes, and cleaning them again
  // changes nothing and removes nothing. A mark that only looked clean
  // would be refused at every print of every invoice; one that was not the
  // drawing reviewed would print something nobody read.
  test('is the corpus’s mark as cleanSvg writes it, cleaning to itself with nothing removed', () => {
    expect([...LOGO.bytes]).toEqual([...SVG_MARK])
    const saved = cleanSvg(SVG_AS_SAVED)
    expect(saved.ok && [...saved.bytes]).toEqual([...LOGO.bytes])
    const again = cleanSvg(LOGO.bytes)
    expect(again.ok && { bytes: [...again.bytes], removed: again.removed, more: again.removedMore }).toEqual({ bytes: [...LOGO.bytes], removed: [], more: 0 })
    expect(checkSvg(LOGO.bytes).ok).toBe(true)
    expect([LOGO.asset, LOGO.mediaType]).toEqual(['logo', 'image/svg+xml'])
  })

  // The digest pins the bytes a host hands over (0007), and every marked
  // starter's JSON, its pinned digest and its pictures with them: a mark
  // changed -- one coordinate of it -- fails here first, at a digest
  // written as a literal, and the starters' pins and pictures move with it
  // or not at all.
  test('is named by a pinned digest, the SHA-256 of its bytes', () => {
    expect(LOGO.digest).toBe(`sha256:${createHash('sha256').update(LOGO.bytes).digest('hex')}`)
    expect(LOGO.digest).toBe('sha256:1c4cde5bb45bf4a799f0b91ade404ef1ffd986b13dcb52b200a0ac2066c56dcb')
    expect(STARTER_IMAGES).toContain(LOGO)
  })

  // The runtime never holds the bytes it is handed to the digest a report
  // declares (0007): the host's lookup is what approves them, by id and
  // digest both. A lookup that matched the id alone would hand the mark to
  // a report that declares another drawing as `logo`, approved at another
  // digest, and print there what nobody approved; it would pass every other
  // test here, since each report asks at the mark's own digest.
  test('is handed over by the starters’ lookup at its own id and digest alone', () => {
    expect(starterImages({ asset: 'logo', digest: LOGO.digest })).toBe(LOGO)
    expect(starterImages({ asset: 'logo', digest: `sha256:${'0'.repeat(64)}` })).toBeUndefined()
    expect(starterImages({ asset: 'mark', digest: LOGO.digest })).toBeUndefined()
  })

  // Lettering in a mark is no text PDF.js reads -- the cleaner refuses
  // text, and outlined lettering would be paths -- so a word in it would
  // pass every check of what a page prints and could still read as
  // somebody's name. The mark is a disc and two paths, with no text node,
  // painted in one deep colour and white: no square, which beside a QR
  // code reads as a finder pattern, and no colour of the room's (CLAUDE.md:
  // the page is the document, not the room).
  test('is a disc and two paths in one deep colour on white, with no word in it', () => {
    const { elements, texts } = readDrawing(LOGO.bytes)
    expect([elements.map((element) => element.name), texts]).toEqual([['svg', 'circle', 'path', 'path'], []])
    const paints = new Set(
      elements.flatMap((element) => [element.attributes['fill'], element.attributes['stroke']]).filter((paint) => paint !== undefined && paint !== 'none'),
    )
    expect(paints).toEqual(new Set(['#1f4e79', '#ffffff']))
  })
})

describe('the letterhead', () => {
  // The firm's invoices and its quotation print its mark, and its other
  // reports none: a sample left without it would show the firm's invoices
  // differing in more than their words, and a mark on the inspection or
  // the register would print a letterhead on what is no letter. Which is
  // which is stated above, and the list must name every report.
  test('is declared by the firm’s invoices and quotation, and by no other report', () => {
    const declaring = (report: ReportDefinition): boolean => report.assets.length > 0
    expect(
      EVERY.filter((starter) => declaring(starter.report))
        .map((starter) => starter.id)
        .sort(),
    ).toEqual([...MARKED].sort())
    expect(
      EVERY.filter((starter) => !declaring(starter.report))
        .map((starter) => starter.id)
        .sort(),
    ).toEqual([...UNMARKED].sort())
  })

  // Each declares the one asset, the mark at its digest, and begins its
  // report header with it: 15 mm square at the top left of the first page,
  // drawn whole, then a 12 pt gap before the line that says whom it is
  // from. A second asset, a mark drawn elsewhere, or a letterhead that
  // drifted on one sample would each print one firm two ways.
  test.each(MARKED)('%s declares the mark alone and begins its report header with it', (id) => {
    const { report } = EVERY.find((starter) => starter.id === id) as Starter
    expect(report.assets).toEqual([{ id: 'logo', mediaType: 'image/svg+xml', digest: LOGO.digest }])
    const fifteenMillimetres = Math.round(((15 * 72) / 25.4) * 100) / 100
    expect(report.regions.reportHeader.slice(0, 3)).toEqual([
      { id: 'logo', kind: 'image', source: { kind: 'asset', asset: 'logo' }, width: fifteenMillimetres, height: fifteenMillimetres, fit: 'contain' },
      { id: 'logo-gap', kind: 'spacer', height: 12 },
      expect.objectContaining({ id: 'sender', kind: 'text' }),
    ])
    expect(report.regions.reportHeader.slice(0, 2)).toEqual(LETTERHEAD)
    expect(report.regions.pageHeader.filter((component) => component.kind === 'image')).toEqual([])
  })

  // An asset declared and never drawn is a warning an author meets first
  // (report-core's unused-asset), and one drawn twice is a mark printed
  // twice: each marked report draws it exactly once, and warns of nothing
  // but, where it has a QR-bill, that the bill pays SIX's example, which
  // it does by design (0039).
  test.each(MARKED)('%s draws the mark exactly once, with no diagnostic but its bill’s example account', (id) => {
    const { report } = EVERY.find((starter) => starter.id === id) as Starter
    expect(
      components(report)
        .filter((component) => component.kind === 'image')
        .map((component) => component.id),
    ).toEqual(['logo'])
    expect(diagnose(report).map((diagnostic) => `${diagnostic.code} ${diagnostic.path}`)).toEqual(
      report.paymentPart === undefined ? [] : ['example-payment-part /paymentPart'],
    )
  })

  // A host that renders one of these starters hands over the mark's bytes,
  // by its id and digest, or the render is refused naming it: a mark the
  // host cannot find is never left out of the page in silence (CLAUDE.md).
  test.each(MARKED)('%s resolves with the starters’ images, and is refused missing-asset without them', (id) => {
    const starter = EVERY.find((each) => each.id === id) as Starter
    const options = { mode: 'final', parameters: starter.parameters, creationDate: '2026-10-16T08:00:00Z' } as const
    const outcome = resolveReport(starter.report, starter.data, { ...options, images: starterImages })
    expect(outcome.ok ? outcome.warnings : outcome.errors.map((error) => `${error.code} ${error.path}`)).toEqual([])
    const without = resolveReport(starter.report, starter.data, { ...options, images: () => undefined })
    expect(without.ok ? [] : without.errors.map((error) => [error.code, 'componentId' in error ? error.componentId : undefined])).toEqual([
      ['missing-asset', 'logo'],
    ])
  })
})
