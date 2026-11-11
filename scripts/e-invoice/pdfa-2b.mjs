// The PDF/A-2b the e-invoice gate judges (0057): every starter of
// report-corpus that is no e-invoice, drawn by the renderer as built with
// `pdfa: '2b'` in a final render; five variants, three drawn on the
// quotation's page as scripts/e-invoice/pdf-corpus.mjs's are on the
// e-invoice sample's and two of the corpus's fixtures, as its are; and
// two controls. veraPDF judges them alone, in a run of their own with
// `--flavour 2b` (scripts/e-invoice/verapdf.mjs): Mustang validates an
// e-invoice, and a 2b embeds no XML for it to read.
//
// - **The samples** are derived, not listed: each starter whose report
//   holds no e-invoice, so that a starter added later is judged as a 2b
//   with no entry written here. The one that holds an e-invoice the
//   renderer refuses as a 2b, and it is no sample.
// - **The variants** are what a template may draw beyond the starters'
//   pages -- an image of every kind PDFKit embeds, an SVG in every way the
//   converter paints one and one at every bound the renderer holds an SVG
//   to in a PDF/A, text outside ASCII in the corpus's faces and a host's --
//   each of which veraPDF must accept as a sample.
// - **The controls**: the quotation drawn without `pdfa`, which the
//   renderer draws as a plain PDF; and the 3b corpus's e-invoice.pdf,
//   unchanged, judged by the 2b profile. The second shows the flavour is
//   named and never detected: veraPDF 1.30.3 run on it without
//   `--flavour`, or with `--flavour 0`, validated it against its PDF/A-3b
//   profile and found it compliant (measured on 11 November 2026 on Zulu
//   22.0.1, as it took a 2b sample for PDF/A-2b and the plain control for
//   PDF/A-1b). Each must be refused for exactly what it expects.
//
// What veraPDF does not read, the gate reads itself: what each sample's and
// variant's XMP says it is (`identificationProblems`), and what each embeds
// (pdf-corpus.mjs's `embeddingProblems`), a 2b nothing.

import { PDF_BASE } from './pdf-corpus.mjs'
import { JUDGES, PDF_FORMATS } from './registers.mjs'

/** The format of the PDF/A-2b corpus, which JUDGES gives veraPDF alone. */
export const PDF_A_2B_FORMAT = 'pdfa-2b'

/** The starter the variants and the plain control are drawn on: one page of regions, a table and its totals, and the firm's mark, as the e-invoice sample prints them. */
export const PDF_A_2B_BASE = 'quotation'

/**
 * Each variant: its file, what it draws, and how -- `blocks`, `svg` and
 * `bound`, the quotation's page followed by what pdf-corpus.mjs's
 * `blocksDocument`, `svgDocument` and `boundDocument` add to the e-invoice
 * sample's; `fixture`, a document of report-corpus's `ALL_FIXTURES` -- each
 * with no e-invoice.
 */
export const PDF_A_2B_VARIANTS = [
  {
    file: 'pdfa-2b-blocks.pdf',
    why: 'the quotation’s page, a page break, and an image of each kind report-corpus’s IMAGE_KINDS holds -- every way PDFKit embeds an image but CMYK, which a PDF/A-2b refuses -- a QR code, a rectangle and a rule, with its RGBA PNG in the page header of each page, as a logo stands: drawn on the quotation’s page as variant-blocks.pdf is on the e-invoice sample’s',
    draws: { blocks: true },
  },
  {
    file: 'pdfa-2b-svg.pdf',
    why: 'the quotation’s page, a page break, and SVG images in every way svg-to-pdfkit paints one -- report-corpus’s mark and window, the window’s clip path a soft mask and its sky a gradient, and a drawing of a gradient with a translucent stop, a group at an opacity, a translucent fill and stroke and a dash -- with the mark in the page header of each page: the transparency PDF/A-2 admits beside its output intent, drawn on the quotation’s page as variant-svg.pdf is on the e-invoice sample’s',
    draws: { svg: true },
  },
  {
    file: 'pdfa-2b-svg-bound.pdf',
    why: 'the quotation’s page, a page break, and report-corpus’s SVG_BOUND in the smallest box the renderer draws it in a PDF/A, SVG_BOUND_SIDE square: its numbers come within the renderer’s margin of the largest integer a PDF/A-2 holds, and it nests the graphics state as deep as one may: drawn on the quotation’s page as variant-svg-bound.pdf is on the e-invoice sample’s',
    draws: { bound: true },
  },
  {
    file: 'pdfa-2b-fonts.pdf',
    why: 'the corpus’s fonts fixture: German, French, Swiss, euro and Polish text, in the regular and the bold face, in paragraphs and a table, drawn as variant-fonts.pdf is without the e-invoice sample’s e-invoice',
    draws: { fixture: 'fonts' },
  },
  {
    file: 'pdfa-2b-host-fonts.pdf',
    why: 'the corpus’s host-fonts fixture: Latin, Greek and Cyrillic in fonts a host supplied -- Liberation Serif and Mono -- embedded beside Roboto (0043), drawn as variant-host-fonts.pdf is without the e-invoice sample’s e-invoice',
    draws: { fixture: 'host-fonts' },
  },
]

/**
 * Each control: its file, how it is made -- `plain`, the quotation drawn
 * without `pdfa`; `3b`, the 3b corpus's PDF of the e-invoice sample as it
 * was drawn -- the file it is made from, what it embeds (`base`, the
 * e-invoice sample's XML, or nothing), what it breaks, and what veraPDF
 * says of it.
 */
export const PDF_A_2B_CONTROLS = [
  {
    file: 'pdfa-2b-control-plain.pdf',
    make: 'plain',
    embeds: null,
    from: `pdfa-2b-${PDF_A_2B_BASE}.pdf`,
    why: 'the quotation drawn without pdfa, which the renderer draws as a plain PDF: no XMP and no output intent',
    // The 2b profile finds DeviceRGB with no output intent and no metadata,
    // as the 3b profile does control-plain.pdf: measured on 11 November
    // 2026 with veraPDF 1.30.3 on Zulu 22.0.1.
    expect: { verapdf: ['6.2.4.3-2', '6.6.2.1-1'] },
  },
  {
    file: 'pdfa-2b-control-3b.pdf',
    make: '3b',
    embeds: 'base',
    from: `${PDF_BASE}.pdf`,
    why: 'the e-invoice sample’s PDF/A-3b, unchanged, judged by veraPDF’s PDF/A-2b profile: a gate that let veraPDF detect the flavour would accept it as 3b',
    // The 2b profile finds pdfaid:part 3 where a PDF/A-2 says 2 (6.6.4-2),
    // and an embedded file, the XML, that is no PDF/A-1 or -2 (6.8-5):
    // measured on 11 November 2026 with veraPDF 1.30.3 on Zulu 22.0.1.
    expect: { verapdf: ['6.6.4-2', '6.8-5'] },
  },
]

/**
 * The PDF/A-2b corpus as planned, before anything is drawn: one sample per
 * starter of `starters` that is no e-invoice, in their order, `{ file,
 * format, starter, embeds, expect }`; then one entry per variant, `{ file,
 * format, variant, why, embeds, expect }`; then one per control, `{ file,
 * format, from, make, why, embeds, expect }`. `starters` is report-corpus's
 * STARTERS as `{ id, eInvoice }`, `eInvoice` whether its report holds one;
 * `base3bXml` is the XML the e-invoice sample's PDF/A-3b embeds, which its
 * control embeds unchanged. A plan without the quotation, or whose
 * quotation is an e-invoice, is refused.
 */
export function pdfa2bPlan(starters, { base3bXml }) {
  const base = starters.find((starter) => starter.id === PDF_A_2B_BASE)
  if (base === undefined) throw new Error(`report-corpus has no ${PDF_A_2B_BASE} starter, which the PDF/A-2b variants and the plain control are drawn on`)
  if (base.eInvoice)
    throw new Error(
      `the ${PDF_A_2B_BASE} starter is an e-invoice, which the renderer draws as no PDF/A-2b: the variants and the plain control need one that is not`,
    )
  const accepted = () => Object.fromEntries(JUDGES[PDF_A_2B_FORMAT].map((tool) => [tool, 'accepted']))
  return [
    ...starters
      .filter((starter) => !starter.eInvoice)
      .map((starter) => ({ file: `pdfa-2b-${starter.id}.pdf`, format: PDF_A_2B_FORMAT, starter: starter.id, embeds: null, expect: accepted() })),
    ...PDF_A_2B_VARIANTS.map((variant) => ({
      file: variant.file,
      format: PDF_A_2B_FORMAT,
      variant: structuredClone(variant.draws),
      why: variant.why,
      embeds: null,
      expect: accepted(),
    })),
    ...PDF_A_2B_CONTROLS.map((control) => ({
      file: control.file,
      format: PDF_A_2B_FORMAT,
      from: control.from,
      make: control.make,
      why: control.why,
      embeds: control.embeds === 'base' ? base3bXml : null,
      expect: structuredClone(control.expect),
    })),
  ]
}

/**
 * The PDF/A-2b corpus: `plan`, each entry with its `pdf`, the bytes drawn.
 * `drawStarter(id)` draws a starter as a PDF/A-2b, `drawVariant(draws)` what
 * a variant says it draws as one, `drawPlain()` the quotation without
 * `pdfa`; `sample3b` is the 3b corpus's PDF of the e-invoice sample, the
 * 3b control's bytes. A control made any other way is refused.
 */
export async function pdfa2bCorpus({ plan, drawStarter, drawVariant, drawPlain, sample3b }) {
  const made = []
  for (const entry of plan) {
    let pdf
    if (entry.variant !== undefined) pdf = await drawVariant(entry.variant)
    else if (entry.from === undefined) pdf = await drawStarter(entry.starter)
    else if (entry.make === 'plain') pdf = await drawPlain()
    // The 3b corpus's own bytes: drawn again, it would be a copy of the file the 3b profile accepted, not that file.
    else if (entry.make === '3b') pdf = sample3b
    else
      throw new Error(
        `${entry.file} is made by ${String(entry.make)}, which the PDF/A-2b corpus does not make: a control is the quotation drawn plain, or the 3b corpus’s own PDF`,
      )
    made.push({ ...entry, pdf: Buffer.from(pdf) })
  }
  return made
}

/** What the XMP of a PDF/A the gate draws must say it is, by format: pdfaid:part and pdfaid:conformance, each once. */
const IDENTIFICATION = {
  pdf: { name: 'PDF/A-3b', part: '3', conformance: 'B' },
  'pdfa-2b': { name: 'PDF/A-2b', part: '2', conformance: 'B' },
}

/** `values`, the texts of a property, as a sentence says them. */
const said = (values) => (values.length === 0 ? 'none' : values.map((value) => `'${value}'`).join(' and '))

/**
 * What is wrong with what each sample's and variant's XMP says it is, read
 * back by pdf-lib through `readObjects` (report-corpus's `readPdfObjects`),
 * as sentences: a PDF of a PDF format without XMP, or with one that cannot
 * be read, and a pdfaid:part or pdfaid:conformance that is not the
 * format's, or not once. veraPDF's profile refuses a wrong part as well
 * (6.6.4-2 of the 2b profile, as pdfa-2b-control-3b.pdf shows); this is a
 * second reader of what the PDF says it is, as `embeddingProblems` is of
 * the file it embeds, and it runs before any Java does, so that a PDF
 * drawn without `pdfa` stops the run, named file by file. `pdfaid(xmp)`
 * reads the two properties' texts out of the packet, `{ part,
 * conformance }`, and throws where it cannot. A control is broken on
 * purpose, and the 3b one says part 3 because it is a 3b: neither is held.
 */
export async function identificationProblems(entries, { readObjects, pdfaid }) {
  const problems = []
  for (const entry of entries.filter((each) => PDF_FORMATS.includes(each.format) && each.from === undefined)) {
    const wanted = IDENTIFICATION[entry.format]
    const { metadata } = await readObjects(new Uint8Array(entry.pdf))
    if (metadata === undefined) {
      problems.push(`${entry.file} has no XMP to say which PDF/A it is`)
      continue
    }
    let stated
    try {
      stated = pdfaid(metadata.xmp)
    } catch (error) {
      problems.push(`${entry.file}’s XMP cannot be read: ${error.message}`)
      continue
    }
    for (const property of ['part', 'conformance'])
      if (stated[property].length !== 1 || stated[property][0] !== wanted[property])
        problems.push(`${entry.file}’s XMP states pdfaid:${property} ${said(stated[property])}, where a ${wanted.name}’s is '${wanted[property]}'`)
  }
  return problems
}
