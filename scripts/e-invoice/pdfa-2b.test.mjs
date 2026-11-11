import { describe, expect, test } from 'vitest'
import { identificationProblems, PDF_A_2B_CONTROLS, PDF_A_2B_VARIANTS, pdfa2bCorpus, pdfa2bPlan } from './pdfa-2b.mjs'

/**
 * The PDF/A-2b the e-invoice gate judges (0056): every starter that is no
 * e-invoice, drawn as a 2b, variants on the quotation's page, and two
 * controls. Planned here from stand-ins for report-corpus's starters, drawn
 * by a stand-in for the renderer and read back by stand-ins for pdf-lib and
 * the XMP reader, as pdf-corpus.test.mjs reads the PDF/A-3b: what veraPDF
 * says of them is the gate's run, and the judges' tests over its record.
 */
const BASE_XML = '<rsm:CrossIndustryInvoice>the e-invoice sample</rsm:CrossIndustryInvoice>'
/** Starters as the gate hands them over, one added after this plan was written, and the one that is an e-invoice among them. */
const STARTERS = [
  { id: 'service-inspection', eInvoice: false },
  { id: 'quotation', eInvoice: false },
  { id: 'e-invoice', eInvoice: true },
  { id: 'delivery-note', eInvoice: false },
]
const plan = pdfa2bPlan(STARTERS, { base3bXml: BASE_XML })

describe('the PDF/A-2b corpus as planned', () => {
  // The samples are derived, not listed: a starter added to report-corpus
  // is a template a host may draw as a 2b, and one judged only once
  // somebody wrote its entry is one nobody judges until then. The starter
  // that is an e-invoice is refused as a 2b by the renderer, and is no
  // sample of it.
  test('plans every starter that is no e-invoice as a PDF/A-2b sample, in order, and none of the one that is', () => {
    expect(plan.filter((entry) => entry.starter !== undefined)).toEqual([
      { file: 'pdfa-2b-service-inspection.pdf', format: 'pdfa-2b', starter: 'service-inspection', embeds: null, expect: { verapdf: 'accepted' } },
      { file: 'pdfa-2b-quotation.pdf', format: 'pdfa-2b', starter: 'quotation', embeds: null, expect: { verapdf: 'accepted' } },
      { file: 'pdfa-2b-delivery-note.pdf', format: 'pdfa-2b', starter: 'delivery-note', embeds: null, expect: { verapdf: 'accepted' } },
    ])
  })

  // What a template may draw beyond a starter's page is drawn on the
  // quotation's, each way the 3b corpus draws it on the e-invoice
  // sample's, and accepted as a sample is; the controls come last, as the
  // 3b corpus's do, the plain one embedding nothing and the 3b one the
  // e-invoice sample's XML, which the e-invoice sample's PDF embeds.
  test('plans the variants after the samples and the controls after them, each named pdfa-2b-…pdf', () => {
    expect(plan.map((entry) => [entry.file, entry.starter ?? entry.variant ?? entry.from])).toEqual([
      ['pdfa-2b-service-inspection.pdf', 'service-inspection'],
      ['pdfa-2b-quotation.pdf', 'quotation'],
      ['pdfa-2b-delivery-note.pdf', 'delivery-note'],
      ['pdfa-2b-blocks.pdf', { blocks: true }],
      ['pdfa-2b-svg.pdf', { svg: true }],
      ['pdfa-2b-svg-bound.pdf', { bound: true }],
      ['pdfa-2b-fonts.pdf', { fixture: 'fonts' }],
      ['pdfa-2b-host-fonts.pdf', { fixture: 'host-fonts' }],
      ['pdfa-2b-control-plain.pdf', 'pdfa-2b-quotation.pdf'],
      ['pdfa-2b-control-3b.pdf', 'e-invoice.pdf'],
    ])
    expect(plan.every((entry) => entry.format === 'pdfa-2b' && /^pdfa-2b-[a-z0-9-]+\.pdf$/.test(entry.file))).toBe(true)
    const variants = plan.filter((entry) => entry.variant !== undefined)
    expect(variants.every((entry) => entry.embeds === null && entry.expect.verapdf === 'accepted' && entry.why.length > 0)).toBe(true)
    expect(variants.map((entry) => entry.why)).toEqual(PDF_A_2B_VARIANTS.map((variant) => variant.why))
    // What veraPDF 1.30.3's 2b profile refused each for, measured on 11 November 2026.
    const controls = plan.filter((entry) => entry.from !== undefined)
    expect(controls.map((entry) => [entry.file, entry.embeds, entry.expect])).toEqual([
      ['pdfa-2b-control-plain.pdf', null, { verapdf: ['6.2.4.3-2', '6.6.2.1-1'] }],
      ['pdfa-2b-control-3b.pdf', BASE_XML, { verapdf: ['6.6.4-2', '6.8-5'] }],
    ])
    expect(controls.map((entry) => entry.why)).toEqual(PDF_A_2B_CONTROLS.map((control) => control.why))
    expect(controls.every((entry) => entry.why.length > 0)).toBe(true)
  })

  // The variants and the plain control are drawn on the quotation's page:
  // without it they would stop the gate halfway through drawing, and an
  // e-invoice's page would be refused as a 2b, so neither is planned.
  test('refuses a plan whose base starter is missing or is an e-invoice', () => {
    expect(() =>
      pdfa2bPlan(
        STARTERS.filter((starter) => starter.id !== 'quotation'),
        { base3bXml: BASE_XML },
      ),
    ).toThrow('report-corpus has no quotation starter, which the PDF/A-2b variants and the plain control are drawn on')
    expect(() =>
      pdfa2bPlan(
        STARTERS.map((starter) => (starter.id === 'quotation' ? { ...starter, eInvoice: true } : starter)),
        { base3bXml: BASE_XML },
      ),
    ).toThrow('the quotation starter is an e-invoice, which the renderer draws as no PDF/A-2b: the variants and the plain control need one that is not')
  })
})

describe('the PDF/A-2b corpus as drawn', () => {
  // A sample drawn without pdfa would be judged as a 2b while it is a
  // plain PDF, and refused for the renderer's want of nothing; the plain
  // control drawn with it would be accepted, and watch nothing. The 3b
  // control is the very bytes the 3b corpus judged, so that the 2b profile
  // refuses the file veraPDF's 3b profile accepted, and not a copy of it.
  test('draws each sample and variant as PDF/A-2b, the plain control without it, and takes the 3b control’s bytes as the 3b corpus drew them', async () => {
    const calls = []
    const drawStarter = async (id) => {
      calls.push(['starter', id])
      return new Uint8Array(Buffer.from(`%PDF 2b ${id}`))
    }
    const drawVariant = async (draws) => {
      calls.push(['variant', draws])
      return new Uint8Array(Buffer.from(`%PDF 2b ${JSON.stringify(draws)}`))
    }
    const drawPlain = async () => {
      calls.push(['plain'])
      return new Uint8Array(Buffer.from('%PDF plain quotation'))
    }
    const sample3b = new Uint8Array(Buffer.from('%PDF 3b e-invoice'))
    const drawn = await pdfa2bCorpus({ plan, drawStarter, drawVariant, drawPlain, sample3b })
    expect(calls).toEqual([
      ['starter', 'service-inspection'],
      ['starter', 'quotation'],
      ['starter', 'delivery-note'],
      ['variant', { blocks: true }],
      ['variant', { svg: true }],
      ['variant', { bound: true }],
      ['variant', { fixture: 'fonts' }],
      ['variant', { fixture: 'host-fonts' }],
      ['plain'],
    ])
    const text = (file) => drawn.find((entry) => entry.file === file).pdf.toString()
    expect(text('pdfa-2b-quotation.pdf')).toBe('%PDF 2b quotation')
    expect(text('pdfa-2b-svg.pdf')).toBe('%PDF 2b {"svg":true}')
    expect(text('pdfa-2b-control-plain.pdf')).toBe('%PDF plain quotation')
    expect(text('pdfa-2b-control-3b.pdf')).toBe('%PDF 3b e-invoice')
    expect(drawn.map((entry) => entry.file)).toEqual(plan.map((entry) => entry.file))
    expect(drawn.every((entry) => Buffer.isBuffer(entry.pdf))).toBe(true)
  })
})

describe('what a PDF/A says it is, read back', () => {
  /** A 3b sample and control, as the 3b corpus plans them, beside the 2b corpus: the XMP of each PDF/A the gate draws is read. */
  const entries = [
    { file: 'e-invoice.pdf', format: 'pdf', sample: 'e-invoice', embeds: BASE_XML, expect: { verapdf: 'accepted', mustang: 'accepted' } },
    { file: 'control-pdfa.pdf', format: 'pdf', from: 'e-invoice.pdf', why: 'no output intent', embeds: BASE_XML, expect: { verapdf: ['6.2.4.3-2'] } },
    ...plan,
  ].map((entry) => ({ ...entry, pdf: Buffer.from(entry.file) }))
  /** The XMP as the stand-in writes it: pdfaid's part and conformance, as the gate's reader of the packet hands them over. */
  const xmp = (part, conformance = ['B']) => ({ xmp: JSON.stringify({ part, conformance }) })
  const said = (file) => (file.startsWith('pdfa-2b-') ? xmp(['2']) : xmp(['3']))
  const objects = (change = {}) => Object.fromEntries(entries.map((entry) => [entry.file, { metadata: change[entry.file] ?? said(entry.file) }]))
  const options = (read) => ({ readObjects: async (bytes) => read[Buffer.from(bytes).toString()], pdfaid: (packet) => JSON.parse(packet) })

  // veraPDF reads the part and the conformance the XMP states, and judges
  // the file by the flavour it is told: a renderer that wrote part 3 into
  // a 2b, or 2 into a 3b, would be judged by the profile the gate names
  // and pass on every rule both parts share. So the gate reads what each
  // sample and variant says it is, each property once; a control is broken
  // on purpose, and the 3b one says part 3 because it is a 3b.
  test('holds each sample’s and variant’s XMP to its part and conformance, once each, and leaves a control’s', async () => {
    expect(await identificationProblems(entries, options(objects()))).toEqual([])
    const read = objects({
      'pdfa-2b-quotation.pdf': xmp(['3']),
      'e-invoice.pdf': xmp(['2']),
      'pdfa-2b-blocks.pdf': xmp(['2', '2'], ['B', 'U']),
      'pdfa-2b-svg.pdf': xmp([], ['A']),
      'pdfa-2b-control-3b.pdf': xmp(['3']),
      'pdfa-2b-control-plain.pdf': { xmp: 'not JSON, as a packet the reader refuses' },
      'control-pdfa.pdf': xmp(['1']),
    })
    read['pdfa-2b-fonts.pdf'] = { metadata: undefined }
    read['pdfa-2b-host-fonts.pdf'] = { metadata: { xmp: 'not JSON, as a packet the reader refuses' } }
    expect(await identificationProblems(entries, options(read))).toEqual([
      "e-invoice.pdf’s XMP states pdfaid:part '2', where a PDF/A-3b’s is '3'",
      "pdfa-2b-quotation.pdf’s XMP states pdfaid:part '3', where a PDF/A-2b’s is '2'",
      "pdfa-2b-blocks.pdf’s XMP states pdfaid:part '2' and '2', where a PDF/A-2b’s is '2'",
      "pdfa-2b-blocks.pdf’s XMP states pdfaid:conformance 'B' and 'U', where a PDF/A-2b’s is 'B'",
      "pdfa-2b-svg.pdf’s XMP states pdfaid:part none, where a PDF/A-2b’s is '2'",
      "pdfa-2b-svg.pdf’s XMP states pdfaid:conformance 'A', where a PDF/A-2b’s is 'B'",
      'pdfa-2b-fonts.pdf has no XMP to say which PDF/A it is',
      expect.stringMatching(/^pdfa-2b-host-fonts\.pdf’s XMP cannot be read: /),
    ])
  })
})
