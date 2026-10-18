import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { corpus } from './corpus.mjs'
import { blocksDocument, boundDocument, embeddingProblems, patched, PDF_BASE, PDF_CONTROLS, PDF_VARIANTS, pdfCorpus, pdfPlan, svgDocument, variantProblems } from './pdf-corpus.mjs'

/**
 * The PDFs the e-invoice gate judges (0031): each sample's, drawn from the
 * document whose XML the XML corpus holds, variants that carry the first
 * sample's e-invoice on other pages, and controls broken one named way
 * each. Planned here from the corpus a gate run recorded
 * (scripts/e-invoice/recorded/), drawn by a stand-in for the renderer, and
 * read back by a stand-in for pdf-lib and the XMP reader: what the
 * renderer draws, the gate's run judges, and every patch is refused there
 * where the PDF does not hold what it changes.
 */
const here = dirname(fileURLToPath(import.meta.url))
const recorded = (file) => readFileSync(join(here, 'recorded', 'corpus', file), 'utf8')
const SAMPLES = ['e-invoice', 'e-invoice-reverse-charge', 'e-invoice-exempt-paid'].map((id) => ({ id }))
const xml = corpus({ samples: SAMPLES, xmlOf: (sample) => recorded(`${sample.id}.xml`) })
const xmlOf = (file) => xml.find((entry) => entry.file === file).xml

/**
 * A PDF as far as the patches read one: the places they change, as pdfkit
 * 0.19.1 writes them in a sample (its catalog, its XMP, its file
 * specification and its file's /Params, its trailer), between bytes that
 * are no text, one a byte of a deflated stream that is no character of
 * UTF-8.
 */
const PAGE = [
  '%PDF-1.7\n%\xFF\xFF\xFF\xFF\n',
  '/Type /Catalog\n/OutputIntents [29 0 R]\n/Metadata 30 0 R\n',
  '<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">\n<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>\n',
  '/Type /Filespec\n/AFRelationship /Alternative\n',
  '/Params <<\n/CreationDate (D:20261017080000Z)\n/ModDate (D:20261017080000Z)\n/CheckSum (e14c33d9ffa5fab96b0478be239b56f3)\n/Size 12668\n>>\n',
  'stream\nx\xED[Ko\xDB8\nendstream\n',
  'trailer\n<<\n/Size 31\n/Root 3 0 R\n>>\n%%EOF\n',
]
const fakePdf = (...extra) => Buffer.from([...PAGE, ...extra].join(''), 'latin1')
const control = (file) => PDF_CONTROLS.find((each) => each.file === file)

describe('the PDF corpus as planned', () => {
  // Every sample is drawn and judged as a PDF too, embedding the XML the
  // XML corpus judged; each variant embeds the base sample's; each control
  // embeds what its making leaves in it, which veraPDF's feature report and
  // pdf-lib are held to.
  test('is every sample’s PDF, embedding its XML, then the variants and the controls, each embedding what it is made with', () => {
    const plan = pdfPlan(xml)
    expect(plan.map((entry) => [entry.file, entry.format, entry.sample ?? entry.variant ?? entry.from])).toEqual([
      ['e-invoice.pdf', 'pdf', 'e-invoice'],
      ['e-invoice-reverse-charge.pdf', 'pdf', 'e-invoice-reverse-charge'],
      ['e-invoice-exempt-paid.pdf', 'pdf', 'e-invoice-exempt-paid'],
      ...PDF_VARIANTS.map((each) => [each.file, 'pdf', each.draws]),
      ...PDF_CONTROLS.map((each) => [each.file, 'pdf', 'e-invoice.pdf']),
    ])
    for (const id of SAMPLES.map((sample) => sample.id)) expect(plan.find((entry) => entry.file === `${id}.pdf`).embeds).toBe(xmlOf(`${id}.xml`))
    expect(plan.filter((entry) => entry.variant !== undefined).every((entry) => entry.embeds === xmlOf('e-invoice.xml') && entry.why.length > 0)).toBe(true)
    expect(plan.filter((entry) => entry.from !== undefined).map((entry) => [entry.file, entry.embeds === null ? null : xml.find((each) => each.xml === entry.embeds)?.file])).toEqual([
      ['control-plain.pdf', null],
      ['control-pdfa.pdf', 'e-invoice.xml'],
      ['control-xmp.pdf', 'e-invoice.xml'],
      ['control-checksum.pdf', 'e-invoice.xml'],
      ['control-size.pdf', 'e-invoice.xml'],
      ['control-relationship.pdf', 'e-invoice.xml'],
      ['control-xml.pdf', 'control-br-co-14.xml'],
    ])
    expect(plan.filter((entry) => entry.from === undefined).every((entry) => entry.expect.verapdf === 'accepted' && entry.expect.mustang === 'accepted')).toBe(true)
  })

  // A control made from a sample the corpus no longer has, or embedding an
  // XML control that is gone, would be a file of nothing the gate judges.
  test('refuses a corpus without the sample its controls are made from, or without the XML a control embeds', () => {
    expect(() => pdfPlan(xml.filter((entry) => entry.sample !== PDF_BASE))).toThrow('the corpus has no e-invoice sample to draw its PDF controls from')
    expect(() => pdfPlan(xml.filter((entry) => entry.file !== 'control-br-co-14.xml'))).toThrow('a PDF control embeds control-br-co-14.xml, which is no XML file of the corpus')
  })
})

describe('the variants', () => {
  // A starter added to the corpus is a template a customer may start an
  // e-invoice from, and one no variant draws is one no validator judges; a
  // variant of a starter gone would stop the gate with a reason nobody
  // reads in the corpus.
  test('draw every starter of the corpus, and no other', () => {
    const starters = PDF_VARIANTS.flatMap((variant) => (variant.draws.starter === undefined ? [] : [variant.draws.starter]))
    expect(variantProblems(starters)).toEqual([])
    expect(variantProblems([...starters, 'delivery-note'])).toEqual(['report-corpus’s starter delivery-note has no PDF variant, so no validator judges it as an e-invoice'])
    expect(variantProblems(starters.filter((id) => id !== 'invoice'))).toEqual(['a PDF variant draws the starter invoice, which report-corpus does not have'])
  })

  // The blocks a sample's page does not draw, after it on a page of their
  // own -- every image kind once, a QR code, a rectangle, a rule -- and the
  // logo in the header of every page: a variant that lost one of them would
  // leave the way PDFKit draws it unjudged.
  test('add every image kind, a QR code, a rectangle and a rule after a page break, and the logo in the page header', () => {
    const base = { info: { title: 'Rechnung' }, pageHeader: [{ kind: 'paragraph' }], pageFooter: [], body: [{ kind: 'paragraph' }], eInvoice: { xml: '<x/>' } }
    const kinds = ['png-rgb', 'png-rgba', 'jpeg-grey'].map((id) => ({ id, mediaType: id.startsWith('png') ? 'image/png' : 'image/jpeg', bytes: new Uint8Array([1]) }))
    const drawn = blocksDocument(base, kinds)
    expect(drawn.body.map((block) => (block.kind === 'image' ? block.asset.id : block.kind))).toEqual(['paragraph', 'pageBreak', 'png-rgb', 'png-rgba', 'jpeg-grey', 'qrCode', 'rectangle', 'rule'])
    expect(drawn.pageHeader.map((block) => (block.kind === 'image' ? block.asset.id : block.kind))).toEqual(['paragraph', 'png-rgba'])
    expect([drawn.info, drawn.eInvoice, drawn.pageFooter]).toEqual([base.info, base.eInvoice, base.pageFooter])
    expect(() => blocksDocument(base, kinds.filter((kind) => kind.id !== 'png-rgba'))).toThrow('report-corpus’s IMAGE_KINDS has no png-rgba, which variant-blocks.pdf puts in its page header')
  })

  // The SVGs after the sample's page on a page of their own -- the mark, the
  // window drawn cover, the translucent drawing -- each once, and the mark
  // in the header of every page: a variant that lost one would leave a way
  // svg-to-pdfkit paints into a PDF/A unjudged, and one that drew a drawing
  // twice would pass a page's group units and be refused (0030).
  test('add each SVG once after a page break, the window drawn cover, and the mark in the page header', () => {
    const base = { info: { title: 'Rechnung' }, pageHeader: [{ kind: 'paragraph' }], pageFooter: [], body: [{ kind: 'paragraph' }], eInvoice: { xml: '<x/>' } }
    const assets = ['svg-mark', 'svg-window', 'svg-translucent'].map((id) => ({ id, mediaType: 'image/svg+xml', bytes: new Uint8Array([60]) }))
    const drawn = svgDocument(base, assets)
    expect(drawn.body.map((block) => (block.kind === 'image' ? `${block.asset.id} ${block.fit}` : block.kind))).toEqual(['paragraph', 'pageBreak', 'svg-mark contain', 'svg-window cover', 'svg-translucent contain'])
    expect(drawn.pageHeader.map((block) => (block.kind === 'image' ? block.asset.id : block.kind))).toEqual(['paragraph', 'svg-mark'])
    expect(drawn.body.filter((block) => block.kind === 'image').every((block) => block.asset.mediaType === 'image/svg+xml')).toBe(true)
    expect([drawn.info, drawn.eInvoice, drawn.pageFooter]).toEqual([base.info, base.eInvoice, base.pageFooter])
    expect(() => svgDocument(base, assets.filter((asset) => asset.id !== 'svg-window'))).toThrow('variant-svg.pdf draws the SVG svg-window, which it was not given')
  })

  // The drawing at the bound after the sample's page, alone and contained
  // in the square it is given: in any other box it would be drawn short of
  // the bound, or refused, and veraPDF would judge an SVG at no bound; and
  // beside another SVG the page's group units would refuse it (0030).
  test('add the drawing at the bound alone after a page break, contained in a square of its side', () => {
    const base = { info: { title: 'Rechnung' }, pageHeader: [{ kind: 'paragraph' }], pageFooter: [], body: [{ kind: 'paragraph' }], eInvoice: { xml: '<x/>' } }
    const asset = { id: 'svg-bound', mediaType: 'image/svg+xml', bytes: new Uint8Array([60]) }
    const drawn = boundDocument(base, asset, 41.6)
    expect(drawn.body).toEqual([{ kind: 'paragraph' }, { kind: 'pageBreak' }, { kind: 'image', asset, width: 41.6, height: 41.6, fit: 'contain' }])
    expect([drawn.info, drawn.eInvoice, drawn.pageHeader, drawn.pageFooter]).toEqual([base.info, base.eInvoice, base.pageHeader, base.pageFooter])
  })
})

describe('a patched PDF', () => {
  // A patch changes characters for as many, so that the cross-reference
  // table's offsets hold and the PDF is still one -- broken where its
  // name says and nowhere else.
  test('changes what each control names, byte for byte as long, and nothing else', () => {
    const base = fakePdf()
    const changes = (file) => {
      const after = patched(base, control(file).patch, file)
      expect(after.length, file).toBe(base.length)
      const at = [...after].findIndex((byte, index) => byte !== base[index])
      const last = after.length - 1 - [...after].reverse().findIndex((byte, index) => byte !== base[base.length - 1 - index])
      return [base.subarray(at, last + 1).toString('latin1'), after.subarray(at, last + 1).toString('latin1')]
    }
    expect(changes('control-pdfa.pdf')).toEqual(['s', 'X'])
    expect(changes('control-xmp.pdf')).toEqual([' ', '-'])
    expect(changes('control-checksum.pdf')).toEqual(['e', '0'])
    // The file's /Size, not the trailer's.
    expect(changes('control-size.pdf')).toEqual(['8', '9'])
    expect(changes('control-relationship.pdf')).toEqual(['Alternative', 'Unspecified'])
    // A checksum that starts with 0 is changed to 1, and a size that ends in 9 to one that ends in 0, never left as it was.
    expect(patched(Buffer.from('/CheckSum (0123456789abcdef0123456789abcdef)', 'latin1'), control('control-checksum.pdf').patch, 'control-checksum.pdf').toString('latin1')).toBe('/CheckSum (1123456789abcdef0123456789abcdef)')
    expect(patched(Buffer.from('/Size 12669\n>>', 'latin1'), control('control-size.pdf').patch, 'control-size.pdf').toString('latin1')).toBe('/Size 12660\n>>')
  })

  // A place the renderer no longer writes, or writes twice, leaves the
  // control the sample itself or broken twice; a change of another length
  // would move every object after it.
  test('refuses a place written other than once, and a change of another length', () => {
    expect(() => patched(Buffer.from('%PDF-1.7\n', 'latin1'), control('control-pdfa.pdf').patch, 'control-pdfa.pdf')).toThrow('control-pdfa.pdf: the catalog’s output intents is written 0 times in e-invoice.pdf, where the control changes it once')
    expect(() => patched(fakePdf('<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>\n'), control('control-xmp.pdf').patch, 'control-xmp.pdf')).toThrow('control-xmp.pdf: fx:ConformanceLevel is written 2 times in e-invoice.pdf, where the control changes it once')
    expect(() => patched(fakePdf('/Size 12\n>>\n'), control('control-size.pdf').patch, 'control-size.pdf')).toThrow('control-size.pdf: the embedded file’s /Size is written 2 times in e-invoice.pdf, where the control changes it once')
    expect(() => patched(fakePdf(), { term: 'the output intents', pattern: /\/OutputIntents/g, replace: () => '/OI' }, 'control-x.pdf')).toThrow('control-x.pdf: the change of the output intents is not as long as what it replaces, so every offset after it would be wrong')
  })
})

describe('the PDF corpus as drawn', () => {
  // The samples are drawn from the documents the XML corpus resolved, with
  // their own e-invoice; each variant as it says; a drawn control from the
  // base sample's, without one or with another XML; a patched one from the
  // base sample's own PDF, drawn once.
  test('draws each sample and each variant, draws or patches each control from the base sample, and draws the base once', async () => {
    const calls = []
    const draw = async (id, eInvoice) => {
      calls.push([id, eInvoice === undefined ? 'own' : eInvoice === null ? 'none' : xml.find((each) => each.xml === eInvoice.xml)?.file])
      return new Uint8Array(fakePdf(`% ${id} ${calls.at(-1)[1]}\n`))
    }
    const drawVariant = async (draws) => {
      calls.push(['variant', draws])
      return new Uint8Array(fakePdf(`% variant ${JSON.stringify(draws)}\n`))
    }
    const drawn = await pdfCorpus({ entries: xml, draw, drawVariant })
    expect(calls).toEqual([
      ['e-invoice', 'own'],
      ['e-invoice-reverse-charge', 'own'],
      ['e-invoice-exempt-paid', 'own'],
      ...PDF_VARIANTS.map((variant) => ['variant', variant.draws]),
      ['e-invoice', 'none'],
      ['e-invoice', 'control-br-co-14.xml'],
    ])
    const text = (file) => drawn.find((entry) => entry.file === file).pdf.toString('latin1')
    expect(text('e-invoice.pdf')).toContain('% e-invoice own')
    expect(text('variant-invoice.pdf')).toContain('% variant {"starter":"invoice"}')
    expect(text('control-plain.pdf')).toContain('% e-invoice none')
    expect(text('control-xml.pdf')).toContain('% e-invoice control-br-co-14.xml')
    const patches = PDF_CONTROLS.filter((each) => each.patch !== undefined).map((each) => text(each.file))
    expect(patches.every((each) => each.includes('% e-invoice own'))).toBe(true)
    expect(text('control-pdfa.pdf')).toContain('/OutputIntentX [29 0 R]')
    expect(drawn.every((entry) => Buffer.isBuffer(entry.pdf))).toBe(true)
  })
})

describe('what a PDF embeds, read back', () => {
  const plan = pdfPlan(xml).map((entry) => ({ ...entry, pdf: Buffer.from(entry.file) }))
  /** What report-spec's FACTUR_X_PROFILES says, copied: the level and the relationship of an EN 16931 XML. */
  const PROFILES = { en16931: { guideline: 'urn:cen.eu:en16931:2017', conformanceLevel: 'EN 16931', relationship: 'Alternative' } }
  /** The XMP as the stand-in writes it: the fx properties' texts, as the gate's reader of the packet hands them over. */
  const xmp = ({ documentFileName = ['factur-x.xml'], conformanceLevel = ['EN 16931'] } = {}) => ({ type: 'Metadata', subtype: 'XML', xmp: JSON.stringify({ documentFileName, conformanceLevel }) })
  /** pdf-lib's reading of a PDF that embeds `bytes`, as `factur-x.xml`, the one file of its /AF and its tree, with an XMP that states it. */
  const embedding = (bytes, change = {}) => {
    const specification = { f: 'factur-x.xml', uf: 'factur-x.xml', embedded: { bytes: new Uint8Array(Buffer.from(bytes, 'utf8')) } }
    return { metadata: xmp(), associatedFiles: [specification], embeddedFiles: [{ name: 'factur-x.xml', associated: 0, specification }], ...change }
  }
  const readObjects = (pdfs) => async (bytes) => pdfs[Buffer.from(bytes).toString()]
  const own = () => Object.fromEntries(plan.map((entry) => [entry.file, entry.embeds === null ? { metadata: undefined, associatedFiles: [], embeddedFiles: [] } : embedding(entry.embeds)]))
  const options = (pdfs) => ({
    readObjects: readObjects(pdfs),
    fileName: 'factur-x.xml',
    fx: (packet) => JSON.parse(packet),
    guidelineOf: (text) => /<ram:GuidelineSpecifiedDocumentContextParameter>\s*<ram:ID>([^<]*)<\/ram:ID>/.exec(text)?.[1],
    profiles: PROFILES,
  })

  // The XML the other tools judged is the one inside the PDF only where a
  // second reader finds those bytes there, once, under the profile's name,
  // in /F, /UF and the name tree alike, and as the one file of /AF.
  test('holds each PDF to the one file of the XML the corpus says it embeds, or to none', async () => {
    expect(await embeddingProblems(plan, options(own()))).toEqual([])
    const read = own()
    const renamed = (change) => {
      const reading = embedding(xmlOf('e-invoice.xml'))
      Object.assign(reading.associatedFiles[0], change)
      return reading
    }
    read['e-invoice.pdf'] = embedding(xmlOf('e-invoice-exempt-paid.xml'))
    read['control-plain.pdf'] = embedding(xmlOf('e-invoice.xml'))
    read['control-xmp.pdf'] = embedding(xmlOf('e-invoice.xml'), { embeddedFiles: [{ name: 'zugferd-invoice.xml', associated: 0 }] })
    read['control-pdfa.pdf'] = renamed({ uf: 'zugferd-invoice.xml' })
    read['control-checksum.pdf'] = renamed({ f: 'ZUGFeRD-invoice.xml' })
    read['control-size.pdf'] = embedding(xmlOf('e-invoice.xml'), { embeddedFiles: [{ name: 'factur-x.xml', associated: -1 }] })
    read['control-xml.pdf'] = { ...embedding(xmlOf('control-br-co-14.xml')), associatedFiles: [] }
    expect(await embeddingProblems(plan, options(read))).toEqual([
      'e-invoice.pdf embeds other bytes than the XML the corpus says it embeds',
      'control-plain.pdf associates 1 files with the document and names 1, where the corpus says it embeds 0',
      'control-pdfa.pdf embeds its file under another name than factur-x.xml, or not as the one file of its /AF',
      'control-xmp.pdf embeds its file under another name than factur-x.xml, or not as the one file of its /AF',
      'control-checksum.pdf embeds its file under another name than factur-x.xml, or not as the one file of its /AF',
      'control-size.pdf embeds its file under another name than factur-x.xml, or not as the one file of its /AF',
      'control-xml.pdf associates 0 files with the document and names 1, where the corpus says it embeds 1',
    ])
  })

  // Mustang 2.26.0 holds the XMP's conformance level to a fixed list, and
  // veraPDF reads no fx value: a renderer that wrote BASIC WL, a level of
  // the list, over an EN 16931 XML would pass both, and one that named
  // another file than it embeds would pass veraPDF. So the gate holds what
  // a sample's and a variant's XMP states to the file it embeds; a
  // control's XMP is broken on purpose, and is not held.
  test('holds what a sample’s or a variant’s XMP states to the XML it embeds, and leaves a control’s', async () => {
    const read = own()
    read['e-invoice.pdf'] = embedding(xmlOf('e-invoice.xml'), { metadata: xmp({ conformanceLevel: ['BASIC WL'] }) })
    read['e-invoice-reverse-charge.pdf'] = embedding(xmlOf('e-invoice-reverse-charge.xml'), { metadata: xmp({ documentFileName: ['zugferd-invoice.xml'] }) })
    read['e-invoice-exempt-paid.pdf'] = embedding(xmlOf('e-invoice-exempt-paid.xml'), { metadata: xmp({ conformanceLevel: ['EN 16931', 'EN 16931'], documentFileName: [] }) })
    read['variant-blocks.pdf'] = embedding(xmlOf('e-invoice.xml'), { metadata: undefined })
    read['variant-fonts.pdf'] = embedding(xmlOf('e-invoice.xml'), { metadata: { xmp: 'not JSON, as a packet the reader refuses' } })
    read['control-xmp.pdf'] = embedding(xmlOf('e-invoice.xml'), { metadata: xmp({ conformanceLevel: ['EN-16931'] }) })
    expect(await embeddingProblems(plan, options(read))).toEqual([
      'e-invoice.pdf’s XMP states the conformance level \'BASIC WL\', where the XML it embeds is of EN 16931',
      'e-invoice-reverse-charge.pdf’s XMP states the file name \'zugferd-invoice.xml\', where it embeds factur-x.xml',
      'e-invoice-exempt-paid.pdf’s XMP states the file name none, where it embeds factur-x.xml',
      'e-invoice-exempt-paid.pdf’s XMP states the conformance level \'EN 16931\' and \'EN 16931\', where the XML it embeds is of EN 16931',
      'variant-blocks.pdf has no XMP to state what it embeds',
      expect.stringMatching(/^variant-fonts\.pdf’s XMP cannot be read: /),
    ])
  })

  // A level is the profile's for the XML's guideline: an XML of a
  // guideline no profile names has no level to hold the XMP to, and is
  // said so rather than passed.
  test('refuses a sample whose XML is of a guideline no profile names', async () => {
    const other = xmlOf('e-invoice.xml').replace('urn:cen.eu:en16931:2017', 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0')
    const entries = plan.filter((entry) => entry.file === 'e-invoice.pdf').map((entry) => ({ ...entry, embeds: other }))
    expect(await embeddingProblems(entries, options({ 'e-invoice.pdf': embedding(other) }))).toEqual([
      'e-invoice.pdf embeds an XML of the guideline urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0, which no profile of report-spec’s names',
    ])
  })
})
