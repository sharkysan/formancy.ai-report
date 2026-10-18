// The PDFs the e-invoice gate judges (0031): each e-invoice sample drawn by
// the renderer as built, from the very document whose XML the XML corpus
// holds, as the PDF/A-3b that embeds that XML; variants, other pages that
// carry the first sample's e-invoice; and controls made from the first
// sample's.
//
// - **The samples** must each be accepted by veraPDF, as PDF/A-3b, the file
//   its feature report names being the XML the corpus holds, and by
//   Mustang, its PDF part and its XML part alike.
// - **The variants** are what a customer's e-invoice may draw beyond the
//   samples' one page -- an image of every kind PDFKit embeds, a QR code, a
//   rectangle, a page region, a second page, every starter, text outside
//   ASCII in both faces -- each drawn by the renderer with the first
//   sample's e-invoice, and each must be accepted as a sample is. Without
//   them every PDF a validator judged would be one template's one page.
// - **The controls** are made by the gate and never through an option of a
//   published package, each broken one named way: drawn by the renderer
//   from the sample's document with its e-invoice taken away, which the
//   renderer draws as a plain PDF, or with another file's XML in place of
//   the sample's; or the sample's PDF with bytes changed in place, as many
//   as were there, so that every offset its cross-reference table gives
//   still holds. Each must be refused for exactly what it expects of each
//   tool -- a control one tool accepts says so -- measured on 18 October
//   2026 with veraPDF 1.30.3 and Mustang 2.26.0 on Java 25 and Java 17,
//   which said the same.
//
// What each control shows, measured that day: veraPDF reads no value of the
// XMP's fx extension and no byte of the embedded file, and Mustang 2.26.0
// compares neither a file's declared /CheckSum and /Size with its bytes,
// nor its /AFRelationship with the profile's, nor the XMP's
// ConformanceLevel with the XML's profile, and exits 0 on a file whose XML
// part is valid whatever its PDF part says (its issue #1293). So the gate
// reads what each PDF embeds itself, and what a sample's and a variant's
// XMP states of it (`embeddingProblems`).

/** The sample every control is made from, as the XML corpus's controls are. */
export const PDF_BASE = 'e-invoice'

/** The latin1 text of `bytes`: a PDF's bytes one character each, so that a change of characters is a change of as many bytes. */
const latin1 = (bytes) => Buffer.from(bytes).toString('latin1')

/** The hexadecimal digit a checksum's first is changed to: another one, so that the checksum stays 32 digits long. */
const otherDigit = (digit) => (digit === '0' ? '1' : '0')

/** `digits`, a decimal number, with its last digit the next one round, so that it stays as long: 12668 is 12669, and 9 is 0. */
const nextLast = (digits) => `${digits.slice(0, -1)}${String((Number(digits.at(-1)) + 1) % 10)}`

/**
 * Each control: its file, what it breaks, how it is made -- `draw`, the
 * base sample's document drawn with `eInvoice: null` (none) or the XML of
 * the corpus file `xml`; or `patch`, the base sample's PDF with what
 * `pattern` finds once replaced by `replace`'s characters, as many -- what
 * it embeds (`embeds`: the base's XML, none, or a corpus file's) and what
 * each tool says.
 */
export const PDF_CONTROLS = [
  {
    file: 'control-plain.pdf',
    why: 'the sample’s document drawn without its e-invoice, which the renderer draws as a plain PDF: no XMP, no output intent and no embedded file',
    draw: { eInvoice: null },
    embeds: null,
    // veraPDF's 3b profile finds no metadata and DeviceRGB with no output
    // intent. Mustang finds no XMP and no XML, and, reading no part from the
    // file, validates it as PDF/A-1b, the flavour veraPDF falls back to,
    // which it fails on seven more rules.
    expect: {
      verapdf: ['6.2.4.3-2', '6.6.2.1-1'],
      mustang: ['pdf error 17', 'pdf error 23', 'pdfa 1b 6.2.3.3-1', 'pdfa 1b 6.3.5-3', 'pdfa 1b 6.7.2-1', 'pdfa 1b 6.7.3-1', 'pdfa 1b 6.7.3-2', 'pdfa 1b 6.7.3-6', 'pdfa 1b 6.7.3-7', 'exception 17'],
    },
  },
  {
    file: 'control-pdfa.pdf',
    why: 'the catalog’s /OutputIntents renamed /OutputIntentX, so that the page paints in DeviceRGB with no output intent, which PDF/A-3 refuses (6.2.4.3-2), and the XML is the sample’s, untouched: the PDF Mustang 2.26.0 exits 0 on (its issue #1293)',
    patch: { term: 'the catalog’s output intents', pattern: /\/OutputIntents \[/g, replace: () => '/OutputIntentX [' },
    embeds: 'base',
    expect: { verapdf: ['6.2.4.3-2'], mustang: ['pdfa 3b 6.2.4.3-2'] },
  },
  {
    file: 'control-xmp.pdf',
    why: 'the XMP’s fx:ConformanceLevel written EN-16931, which is no conformance level of Factur-X: veraPDF holds the extension schema to its form and reads no value of it',
    patch: { term: 'fx:ConformanceLevel', pattern: /<fx:ConformanceLevel>EN 16931<\/fx:ConformanceLevel>/g, replace: () => '<fx:ConformanceLevel>EN-16931</fx:ConformanceLevel>' },
    embeds: 'base',
    expect: { verapdf: 'accepted', mustang: ['pdf error 12'] },
  },
  {
    file: 'control-checksum.pdf',
    why: 'the embedded file’s /Params /CheckSum one hexadecimal digit off its bytes’ MD5, which neither veraPDF nor Mustang compares with the bytes: veraPDF’s feature report gives the checksum as the file declares it, and the gate holds it to the XML',
    patch: { term: 'the embedded file’s /CheckSum', pattern: /\/CheckSum \(([0-9a-f])([0-9a-f]{31})\)/g, replace: (_, first, rest) => `/CheckSum (${otherDigit(first)}${rest})` },
    embeds: 'base',
    expect: { verapdf: ['embedded checkSum'], mustang: 'accepted' },
  },
  {
    file: 'control-size.pdf',
    why: 'the embedded file’s /Params /Size one byte off its bytes’ length, which neither tool compares with the bytes: veraPDF’s feature report gives the size as the file declares it, and the gate holds it to the XML',
    // The trailer's /Size, the count of its objects, is followed by its /Root, and the file's by the end of its /Params.
    patch: { term: 'the embedded file’s /Size', pattern: /(\/Size )(\d+)(\n>>)/g, replace: (_, open, digits, close) => `${open}${nextLast(digits)}${close}` },
    embeds: 'base',
    expect: { verapdf: ['embedded size'], mustang: 'accepted' },
  },
  {
    file: 'control-relationship.pdf',
    why: 'the file specification’s /AFRelationship written /Unspecified, a relationship PDF/A-3 allows and EN 16931’s German hybrid does not, where it is /Alternative [S]: veraPDF’s feature report gives the relationship, and the gate holds it to the profile’s',
    patch: { term: 'the file’s /AFRelationship', pattern: /\/AFRelationship \/Alternative/g, replace: () => '/AFRelationship /Unspecified' },
    embeds: 'base',
    expect: { verapdf: ['embedded afRelationship'], mustang: 'accepted' },
  },
  {
    file: 'control-xml.pdf',
    why: 'the XML of control-br-co-14.xml embedded in place of the sample’s, in a PDF/A that is otherwise the sample’s: what Mustang says of an XML it must say of that XML inside a PDF',
    draw: { xml: 'control-br-co-14.xml' },
    embeds: 'control-br-co-14.xml',
    expect: { verapdf: 'accepted', mustang: ['error 4 BR-CO-14', 'warning 10'] },
  },
]

/**
 * Each variant: its file, what it draws, and how -- `blocks`, the base
 * sample's page followed by `blocksDocument`'s; `fixture`, a document of
 * report-corpus's `ALL_FIXTURES`; or `starter`, a starter of its `STARTERS`
 * resolved as a host resolves it, with `STARTER_IMAGES` -- each carrying the
 * base sample's e-invoice. `variantProblems` holds the list to every
 * starter, so that a starter added is one the gate judges.
 */
export const PDF_VARIANTS = [
  {
    file: 'variant-blocks.pdf',
    why: 'the sample’s page, a page break, and an image of each kind report-corpus’s IMAGE_KINDS holds -- every way PDFKit embeds an image but CMYK -- a QR code, a rectangle and a rule, with its RGBA PNG in the page header of each page, as a logo stands',
    draws: { blocks: true },
  },
  { file: 'variant-fonts.pdf', why: 'the corpus’s fonts fixture: German, French, Swiss, euro and Polish text, in the regular and the bold face, in paragraphs and a table', draws: { fixture: 'fonts' } },
  { file: 'variant-service-inspection.pdf', why: 'the service inspection starter: a photo from the data, a rule, and page regions over its pages', draws: { starter: 'service-inspection' } },
  { file: 'variant-quotation.pdf', why: 'the quotation starter: page regions, a table and its totals', draws: { starter: 'quotation' } },
  { file: 'variant-grouped-equipment.pdf', why: 'the grouped equipment starter: groups with their subtotals, under a running head, over its pages', draws: { starter: 'grouped-equipment' } },
  { file: 'variant-invoice.pdf', why: 'the invoice starter: a Swiss QR-bill, drawn in Liberation Sans', draws: { starter: 'invoice' } },
  { file: 'variant-euro-invoice.pdf', why: 'the euro invoice starter: an EPC QR code with Austria’s caption, drawn in Liberation Sans', draws: { starter: 'euro-invoice' } },
]

/** The image of `IMAGE_KINDS` that `blocksDocument` puts in the page header: the one with an alpha channel, as a logo comes. */
const LOGO = 'png-rgba'

/**
 * The base sample's resolved document `base` with, after its page, a page
 * break and then an image of each of `imageKinds` (report-corpus's
 * `IMAGE_KINDS`), a QR code, a rectangle and a rule, and `LOGO` in its page
 * header: what `variant-blocks.pdf` draws, every block kind the samples'
 * page does not.
 */
export function blocksDocument(base, imageKinds) {
  const image = (asset, side) => ({ kind: 'image', asset, width: side, height: side, fit: 'contain' })
  const logo = imageKinds.find((asset) => asset.id === LOGO)
  if (logo === undefined) throw new Error(`report-corpus’s IMAGE_KINDS has no ${LOGO}, which variant-blocks.pdf puts in its page header`)
  const blocks = [
    { kind: 'pageBreak' },
    ...imageKinds.map((asset) => image(asset, 32)),
    { kind: 'qrCode', id: 'variant-code', text: 'https://formancy.ai/report/', size: 85, errorCorrection: 'M' },
    { kind: 'rectangle', width: 120, height: 24, fill: '#e8e4f8', stroke: '#5b4bb7' },
    { kind: 'rule', thickness: 1, color: '#5b4bb7' },
  ]
  return { ...base, pageHeader: [...base.pageHeader, image(logo, 24)], body: [...base.body, ...blocks] }
}

/** What is wrong with the variants against the corpus's starters, by id, as sentences: a starter no variant draws, or a variant of a starter the corpus does not have. */
export function variantProblems(starters) {
  const drawn = PDF_VARIANTS.flatMap((variant) => (variant.draws.starter === undefined ? [] : [variant.draws.starter]))
  return [
    ...starters.filter((id) => !drawn.includes(id)).map((id) => `report-corpus’s starter ${id} has no PDF variant, so no validator judges it as an e-invoice`),
    ...drawn.filter((id) => !starters.includes(id)).map((id) => `a PDF variant draws the starter ${id}, which report-corpus does not have`),
  ]
}

/**
 * The PDF corpus as planned, before anything is drawn: one entry per sample
 * of the XML corpus `entries`, `{ file, format, sample, embeds, expect }`,
 * then one per variant, `{ file, format, variant, why, embeds, expect }`,
 * `variant` what it draws, then one per control, `{ file, format, from,
 * why, embeds, expect }`. `embeds` is the XML the PDF embeds, as the XML
 * corpus holds it, or null. What the judges' tests build the corpus from,
 * with no renderer.
 */
export function pdfPlan(entries) {
  const samples = entries.filter((entry) => entry.format === 'xml' && entry.sample !== undefined)
  const base = samples.find((entry) => entry.sample === PDF_BASE)
  if (base === undefined) throw new Error(`the corpus has no ${PDF_BASE} sample to draw its PDF controls from`)
  const xmlOf = (file) => {
    const found = entries.find((entry) => entry.file === file && entry.format === 'xml')
    if (found === undefined) throw new Error(`a PDF control embeds ${file}, which is no XML file of the corpus`)
    return found.xml
  }
  return [
    ...samples.map((entry) => ({ file: `${entry.sample}.pdf`, format: 'pdf', sample: entry.sample, embeds: entry.xml, expect: { verapdf: 'accepted', mustang: 'accepted' } })),
    ...PDF_VARIANTS.map((variant) => ({ file: variant.file, format: 'pdf', variant: structuredClone(variant.draws), why: variant.why, embeds: base.xml, expect: { verapdf: 'accepted', mustang: 'accepted' } })),
    ...PDF_CONTROLS.map((control) => ({
      file: control.file,
      format: 'pdf',
      from: `${PDF_BASE}.pdf`,
      why: control.why,
      embeds: control.embeds === null ? null : control.embeds === 'base' ? base.xml : xmlOf(control.embeds),
      expect: structuredClone(control.expect),
    })),
  ]
}

/** `bytes` with `patch` made, refused where the PDF does not hold what it changes exactly once, or where it would change the PDF's length. */
export function patched(bytes, patch, file) {
  const text = latin1(bytes)
  const found = text.match(patch.pattern)?.length ?? 0
  if (found !== 1) throw new Error(`${file}: ${patch.term} is written ${String(found)} times in ${PDF_BASE}.pdf, where the control changes it once`)
  const changed = text.replace(patch.pattern, patch.replace)
  if (changed.length !== text.length) throw new Error(`${file}: the change of ${patch.term} is not as long as what it replaces, so every offset after it would be wrong`)
  return Buffer.from(changed, 'latin1')
}

/**
 * The PDF corpus: `pdfPlan(entries)`, each entry with its `pdf`, the bytes
 * drawn. `draw(sample, eInvoice)` draws the sample's document, resolved
 * once for the XML corpus, with its own e-invoice (`undefined`), none
 * (`null`) or its own with `{ xml }` in place of its XML; `drawVariant(draws)`
 * draws what a variant says it draws, with the base sample's e-invoice.
 */
export async function pdfCorpus({ entries, draw, drawVariant }) {
  const plan = pdfPlan(entries)
  const base = await draw(PDF_BASE, undefined)
  const made = []
  for (const entry of plan) {
    const control = PDF_CONTROLS.find((each) => each.file === entry.file)
    let pdf
    if (entry.variant !== undefined) pdf = await drawVariant(entry.variant)
    else if (control === undefined) pdf = entry.sample === PDF_BASE ? base : await draw(entry.sample, undefined)
    else if (control.patch !== undefined) pdf = patched(base, control.patch, control.file)
    else pdf = await draw(PDF_BASE, control.draw.eInvoice === null ? null : { xml: entry.embeds })
    made.push({ ...entry, pdf: Buffer.from(pdf) })
  }
  return made
}

/** `values`, the texts of a property, as a sentence says them. */
const said = (values) => (values.length === 0 ? 'none' : values.map((value) => `'${value}'`).join(' and '))

/**
 * What is wrong with what each PDF embeds, read back by pdf-lib through
 * `readObjects` (report-corpus's `readPdfObjects`), as sentences: a file
 * associated with the document or named in its tree other than the one
 * the corpus says it embeds, with the name `fileName`, or bytes that are not
 * that XML's. The XML the other tools judged is then the one inside the
 * PDF, byte for byte, as a second reader than veraPDF reads it; veraPDF's
 * feature report gives the file's /Params as the PDF declares them.
 *
 * And, of a sample's PDF and a variant's -- what the renderer draws as it
 * is, where a control is broken on purpose -- an XMP whose
 * fx:DocumentFileName is `fileName` and whose fx:ConformanceLevel is the
 * level `profiles` (report-spec's `FACTUR_X_PROFILES`) gives the guideline
 * of the XML it embeds, each written once: Mustang 2.26.0 holds the level
 * to a fixed list and veraPDF reads no fx value, so a renderer that wrote
 * `BASIC WL` over an EN 16931 XML would pass both. `fx(xmp)` reads the two
 * properties' texts out of the packet, `{ documentFileName,
 * conformanceLevel }`, and throws where it cannot; `guidelineOf(xml)` reads
 * the XML's BT-24.
 */
export async function embeddingProblems(entries, { readObjects, fileName, fx, guidelineOf, profiles }) {
  const problems = []
  for (const entry of entries.filter((each) => each.format === 'pdf')) {
    const objects = await readObjects(new Uint8Array(entry.pdf))
    const wanted = entry.embeds === null ? 0 : 1
    if (objects.associatedFiles.length !== wanted || objects.embeddedFiles.length !== wanted) {
      problems.push(`${entry.file} associates ${String(objects.associatedFiles.length)} files with the document and names ${String(objects.embeddedFiles.length)}, where the corpus says it embeds ${String(wanted)}`)
      continue
    }
    if (wanted === 0) continue
    const [associated] = objects.associatedFiles
    const [named] = objects.embeddedFiles
    if (named.name !== fileName || associated.uf !== fileName || associated.f !== fileName || named.associated !== 0) problems.push(`${entry.file} embeds its file under another name than ${fileName}, or not as the one file of its /AF`)
    const bytes = associated.embedded?.bytes
    if (bytes === undefined || Buffer.compare(Buffer.from(bytes), Buffer.from(entry.embeds, 'utf8')) !== 0) problems.push(`${entry.file} embeds other bytes than the XML the corpus says it embeds`)
    if (entry.from === undefined) problems.push(...statedProblems(entry, objects, { fileName, fx, guidelineOf, profiles }))
  }
  return problems
}

/** What is wrong with what a sample's or a variant's XMP states of the file it embeds, as sentences. */
function statedProblems(entry, objects, { fileName, fx, guidelineOf, profiles }) {
  if (objects.metadata === undefined) return [`${entry.file} has no XMP to state what it embeds`]
  let stated
  try {
    stated = fx(objects.metadata.xmp)
  } catch (error) {
    return [`${entry.file}’s XMP cannot be read: ${error.message}`]
  }
  const problems = []
  if (stated.documentFileName.length !== 1 || stated.documentFileName[0] !== fileName) problems.push(`${entry.file}’s XMP states the file name ${said(stated.documentFileName)}, where it embeds ${fileName}`)
  const guideline = guidelineOf(entry.embeds)
  const levels = Object.values(profiles).filter((profile) => profile.guideline === guideline)
  if (levels.length !== 1) problems.push(`${entry.file} embeds an XML of the guideline ${String(guideline)}, which ${levels.length === 0 ? 'no profile' : 'more than one profile'} of report-spec’s names`)
  else if (stated.conformanceLevel.length !== 1 || stated.conformanceLevel[0] !== levels[0].conformanceLevel) problems.push(`${entry.file}’s XMP states the conformance level ${said(stated.conformanceLevel)}, where the XML it embeds is of ${levels[0].conformanceLevel}`)
  return problems
}
