// What the e-invoice gate judges of the XML (0027): the CII XML the runtime
// writes of each of the corpus's e-invoice samples, and the controls made
// from it; and what is wrong with the whole corpus, the PDFs
// scripts/e-invoice/pdf-corpus.mjs makes (0031) among it.
//
// - **The samples** are report-corpus's `E_INVOICE_SAMPLES`, resolved by
//   the runtime as built, in a final render; their XML is judged exactly as
//   written, and each must be accepted by every tool.
// - **The controls** are the first sample's XML broken one named way each,
//   by the gate and never through an option of a published package: a
//   schema break, a total that breaks BR-CO-14, a standard rate below 0.5
//   that breaks BR-CO-17, a negative net price (BR-27), a unit outside
//   BR-CL-23, and a document that is not well formed. Each must be refused
//   by every tool for exactly what it expects of that tool, measured on 17
//   October 2026 with Mustang 2.26.0 and KoSIT 1.6.3 on Java 17 and 25,
//   which said the same. A control the gate
//   accepted would mean nothing is watching what it breaks; one refused for
//   something else as well is not the file its name says.
//
// An expectation is a list of message keys, as each judge keys them:
// Mustang's `<severity> <type> <rule id>` (scripts/e-invoice/mustang.mjs),
// KoSIT's `<level> <step> <code>` (scripts/e-invoice/kosit.mjs), veraPDF's
// `<clause>-<test>` (scripts/e-invoice/verapdf.mjs).

import { JUDGES } from './registers.mjs'

/** The sample every control is made from: the de-DE e-invoice, at 19 % and 7 % with a delivery date. */
export const CONTROL_BASE = 'e-invoice'

/** `amount`, an amount of exactly two places, as a whole number of cents, without a Number in between. */
function centsOf(amount) {
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(String(amount))
  if (match === null) throw new Error(`${String(amount)} is not an amount of two places`)
  return BigInt(`${match[1]}${match[2]}${match[3]}`)
}

/** `cents` written as the runtime writes an amount: exactly two places, a minus where negative. */
function amountOf(cents) {
  const digits = (cents < 0n ? -cents : cents).toString().padStart(3, '0')
  return `${cents < 0n ? '-' : ''}${digits.slice(0, -2)}.${digits.slice(-2)}`
}

/** `amount`, an amount of exactly two places, one cent more, without a Number in between. */
export function plusOneCent(amount) {
  return amountOf(centsOf(amount) + 1n)
}

/**
 * The tax over `basis`, an amount of two places not below zero, at `rate`,
 * a percentage of two places at most: their product over 100, rounded half
 * away from zero to the cent, as the runtime computes a category's tax.
 */
export function taxAt(basis, rate) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(rate))
  const cents = centsOf(basis)
  if (match === null || cents < 0n) throw new Error(`${String(basis)} at ${String(rate)} is not a basis and a rate this computes`)
  const hundredths = BigInt(`${match[1]}${(match[2] ?? '').padEnd(2, '0')}`)
  return amountOf((2n * cents * hundredths + 10000n) / 20000n)
}

/** The rate the BR-CO-17 control gives the sample's 7 % category: below 0.5, which XPath's round makes 0. */
const LOW_RATE = '0.49'

/**
 * The BR-CO-17 control: the sample's 7 % category at 0.49 %, its breakdown
 * and each of its lines, its tax computed again at that rate and the totals
 * moved by what the tax lost, so that every other rule still holds. Its
 * edits share what the tax lost, set by the first, which every corpus made
 * runs before the others.
 */
function lowRateControl() {
  let lost = 0n
  const less = (amount) => amountOf(centsOf(amount) - lost)
  return {
    file: 'control-br-co-17.xml',
    why: 'the 7 % category’s rate (BT-119, BT-152) made 0.49 in its breakdown and on each of its lines, its tax (BT-117) computed again at it and the totals moved with it, so that of EN 16931’s rules BR-CO-17 alone is broken: XPath rounds 0.49 to 0, and a breakdown whose rate rounds to 0 holds a tax that rounds to 0, which 0.53 does not',
    edits: [
      {
        term: 'BT-117',
        pattern: /(<ram:CalculatedAmount>)([^<]*)(<\/ram:CalculatedAmount>\s*<ram:TypeCode>VAT<\/ram:TypeCode>\s*<ram:BasisAmount>)([^<]*)(<\/ram:BasisAmount>\s*<ram:CategoryCode>S<\/ram:CategoryCode>\s*<ram:RateApplicablePercent>7<\/ram:RateApplicablePercent>)/g,
        at: 'once',
        replace: (_, open, tax, middle, basis, close) => {
          const lowered = taxAt(basis, LOW_RATE)
          lost = centsOf(tax) - centsOf(lowered)
          return `${open}${lowered}${middle}${basis}${close}`
        },
      },
      { term: 'BT-119 and BT-152', pattern: /(<ram:RateApplicablePercent>)7(<\/ram:RateApplicablePercent>)/g, at: 'all', replace: (_, open, close) => `${open}${LOW_RATE}${close}` },
      { term: 'BT-110', pattern: /(<ram:TaxTotalAmount currencyID="EUR">)([^<]*)(<\/ram:TaxTotalAmount>)/g, at: 'once', replace: (_, open, amount, close) => `${open}${less(amount)}${close}` },
      { term: 'BT-112', pattern: /(<ram:GrandTotalAmount>)([^<]*)(<\/ram:GrandTotalAmount>)/g, at: 'once', replace: (_, open, amount, close) => `${open}${less(amount)}${close}` },
      { term: 'BT-115', pattern: /(<ram:DuePayableAmount>)([^<]*)(<\/ram:DuePayableAmount>)/g, at: 'once', replace: (_, open, amount, close) => `${open}${less(amount)}${close}` },
    ],
    expect: { mustang: ['error 4 BR-CO-17'], kosit: ['error val-sch.1 BR-CO-17'] },
  }
}

/**
 * Each control: its file, what it breaks, the edits that break it -- each
 * the term it changes, where it is written, and whether the sample writes
 * it once or the control changes its first -- and what each tool says.
 */
export const CONTROLS = [
  {
    file: 'control-schema.xml',
    why: 'an element the Factur-X EN 16931 XSD does not have, in the first line’s document reference',
    edits: [{ term: 'BG-25', pattern: /<\/ram:LineID>/g, at: 'first', replace: (found) => `${found}\n        <ram:Unknown>a term no schema has</ram:Unknown>` }],
    expect: { mustang: ['error 18'], kosit: ['error val-xsd cvc-complex-type.2.4.a'] },
  },
  {
    file: 'control-br-co-14.xml',
    why: 'BT-110 one cent above the sum of every BT-117, with BT-112 and BT-115 raised with it, so that of EN 16931’s rules BR-CO-14 alone is broken; Mustang’s own sums disagree as well',
    edits: [
      { term: 'BT-110', pattern: /(<ram:TaxTotalAmount currencyID="EUR">)([^<]*)(<\/ram:TaxTotalAmount>)/g, at: 'once', replace: (_, open, amount, close) => `${open}${plusOneCent(amount)}${close}` },
      { term: 'BT-112', pattern: /(<ram:GrandTotalAmount>)([^<]*)(<\/ram:GrandTotalAmount>)/g, at: 'once', replace: (_, open, amount, close) => `${open}${plusOneCent(amount)}${close}` },
      { term: 'BT-115', pattern: /(<ram:DuePayableAmount>)([^<]*)(<\/ram:DuePayableAmount>)/g, at: 'once', replace: (_, open, amount, close) => `${open}${plusOneCent(amount)}${close}` },
    ],
    expect: { mustang: ['error 4 BR-CO-14', 'warning 10'], kosit: ['error val-sch.1 BR-CO-14'] },
  },
  lowRateControl(),
  {
    file: 'control-br-27.xml',
    why: 'the first line’s net price (BT-146) made negative, which BR-27 refuses; Mustang’s own sums, which multiply each quantity by its price, disagree as well',
    edits: [{ term: 'BT-146', pattern: /(<ram:ChargeAmount>)([^<]*)(<\/ram:ChargeAmount>)/g, at: 'first', replace: (_, open, amount, close) => `${open}-${amount}${close}` }],
    expect: { mustang: ['error 4 BR-27', 'warning 10'], kosit: ['error val-sch.1 BR-27'] },
  },
  {
    file: 'control-br-cl-23.xml',
    why: 'the first line’s unit (BT-130) a code of neither UN/ECE Recommendation 20 nor 21, which BR-CL-23 refuses and FeRD’s code list 8 does not hold',
    edits: [{ term: 'BT-130', pattern: /unitCode="[^"]*"/g, at: 'first', replace: () => 'unitCode="Stk"' }],
    expect: { mustang: ['error 4 FX-SCH-A-000613'], kosit: ['error val-sch.1 BR-CL-23'] },
  },
  {
    file: 'control-malformed.xml',
    why: 'the root element’s end tag removed, so the file is not well formed XML',
    edits: [{ term: 'the root', pattern: /<\/rsm:CrossIndustryInvoice>\n/g, at: 'once', replace: () => '' }],
    expect: { mustang: ['exception 8', 'log [Fatal Error]'], kosit: ['error val-xml generic-error'] },
  },
]

/** What a control changes of a term the sample writes, by how the edit says it is written: once, the first of several, or every one. */
const CHANGES = { once: 'it once', first: 'the first', all: 'every one' }

/** `xml` with `edit` made, refused where the sample does not write the term as the edit expects. */
function edited(xml, edit, control) {
  const found = xml.match(edit.pattern)?.length ?? 0
  if (edit.at === 'once' ? found !== 1 : found === 0) {
    throw new Error(`${control.file}: ${edit.term} is written ${String(found)} times in ${CONTROL_BASE}.xml, where the control changes ${CHANGES[edit.at]}`)
  }
  let done = false
  return xml.replace(edit.pattern, (...match) => {
    if (done && edit.at !== 'all') return match[0]
    done = true
    return edit.replace(...match)
  })
}

/**
 * The XML corpus: one entry per sample of `samples`, `{ file, format, sample,
 * xml, expect }`, its XML as `xmlOf(sample)` gives it, then one per control,
 * `{ file, format, from, why, xml, expect }`, made from the base sample's XML.
 */
export function corpus({ samples, xmlOf }) {
  const entries = samples.map((sample) => ({ file: `${sample.id}.xml`, format: 'xml', sample: sample.id, xml: xmlOf(sample), expect: Object.fromEntries(JUDGES.xml.map((tool) => [tool, 'accepted'])) }))
  const base = entries.find((entry) => entry.sample === CONTROL_BASE)
  if (base === undefined) throw new Error(`the corpus has no ${CONTROL_BASE} sample to make its controls from`)
  for (const control of CONTROLS) {
    const xml = control.edits.reduce((text, edit) => edited(text, edit, control), base.xml)
    entries.push({ file: control.file, format: 'xml', from: base.file, why: control.why, xml, expect: structuredClone(control.expect) })
  }
  return entries
}

/** Every file an accepted message names that is no file of the corpus, as sentences: the one place either judge's register is held to the corpus. */
export function strayAccepted(accepted, entries) {
  const files = new Set(entries.map((entry) => entry.file))
  return accepted.flatMap((entry) => entry.files.filter((file) => !files.has(file)).map((file) => `the accepted message ${entry.tool} ${entry.message} names ${file}, which is no file of the corpus`))
}

/** Each format as a sentence names a file of it. */
const AS = { xml: 'an XML file', pdf: 'a PDF' }

/** Whether two entries' files hold the same bytes: the XML's text, or a PDF's bytes where they were drawn. */
function sameFile(entry, other) {
  if (entry.format === 'pdf') return entry.pdf !== undefined && other?.pdf !== undefined && Buffer.compare(Buffer.from(entry.pdf), Buffer.from(other.pdf)) === 0
  return entry.xml === other?.xml
}

/**
 * What is wrong with the corpus itself, before anything runs: a file named
 * twice, not a lowercase .xml or .pdf name or of another format than its
 * name says, an expectation of a tool that does not judge its format or
 * none of one that does, an expectation that is neither acceptance nor a
 * list of keys, a control that does not say what it breaks, is its sample
 * unbroken or that every tool accepts, and, of each format, a corpus
 * without a sample every judge accepts or without a control each judge
 * refuses: the gate judges the XML and the PDF, and a corpus that lost
 * either judges one of them no more.
 */
export function corpusProblems(entries) {
  const problems = []
  const seen = new Set()
  for (const entry of entries) {
    const judges = JUDGES[entry.format] ?? []
    if (typeof entry.file !== 'string' || !/^[a-z0-9-]+\.(xml|pdf)$/.test(entry.file)) problems.push(`${String(entry.file)} is not a lowercase .xml or .pdf file name`)
    else if (!entry.file.endsWith(`.${String(entry.format)}`)) problems.push(`${entry.file} is ${AS[entry.format] ?? `of the format ${String(entry.format)}`}, which its name does not say`)
    if (seen.has(entry.file)) problems.push(`${entry.file} is in the corpus twice`)
    seen.add(entry.file)
    for (const tool of judges) {
      const expected = entry.expect?.[tool]
      if (expected !== 'accepted' && (!Array.isArray(expected) || expected.length === 0 || expected.some((key) => typeof key !== 'string'))) problems.push(`${entry.file} expects of ${tool} neither acceptance nor any refusal`)
    }
    for (const tool of Object.keys(entry.expect ?? {})) if (!judges.includes(tool)) problems.push(`${entry.file} expects something of ${tool}, which does not judge ${AS[entry.format] ?? 'its format'}`)
    if (entry.from === undefined) continue
    if (typeof entry.why !== 'string' || entry.why === '') problems.push(`${entry.file} is broken and does not say for what`)
    if (sameFile(entry, entries.find((other) => other.file === entry.from))) problems.push(`${entry.file} is the sample it is made from, unbroken`)
    if (judges.length > 0 && judges.every((tool) => entry.expect?.[tool] === 'accepted')) problems.push(`${entry.file} is broken for ${entry.why}, and no tool is to refuse it`)
  }
  for (const [format, judges] of Object.entries(JUDGES)) {
    const ofFormat = entries.filter((entry) => entry.format === format)
    if (!ofFormat.some((entry) => entry.from === undefined && judges.every((tool) => entry.expect?.[tool] === 'accepted'))) problems.push(`the corpus has no ${format} sample both tools must accept`)
    for (const tool of judges) if (!ofFormat.some((entry) => Array.isArray(entry.expect?.[tool]))) problems.push(`the corpus has no ${format} control ${tool} must refuse`)
  }
  return problems
}
