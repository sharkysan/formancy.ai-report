import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { CONTROL_BASE, CONTROLS, corpus, corpusProblems, KINDS, plusOneCent, strayAccepted, taxAt, XRECHNUNG_BASE } from './corpus.mjs'
import { pdfPlan } from './pdf-corpus.mjs'

/**
 * What the e-invoice gate judges (0027): the XML the runtime writes of
 * each corpus sample, and controls the gate makes by breaking a sample's
 * XML in one named way each -- the first sample's, or the addressed one's
 * for a term only it writes (0037) -- which every judge must refuse for
 * exactly that. Read here from the corpus a gate run recorded
 * (scripts/e-invoice/recorded/), so the controls these cases make are the
 * very files whose tools' outputs the judges' tests read.
 */
const here = dirname(fileURLToPath(import.meta.url))
const recorded = (file) => readFileSync(join(here, 'recorded', 'corpus', file), 'utf8')
const run = JSON.parse(readFileSync(join(here, 'recorded', 'run.json'), 'utf8'))
const SAMPLES = ['e-invoice', 'e-invoice-reverse-charge', 'e-invoice-exempt-paid', 'e-invoice-addressed', 'e-invoice-xrechnung'].map((id) => ({ id }))
/** Each recorded sample's kind and BT-24, as the run that recorded it made them. */
const KINDS_OF = { kindOf: (sample) => run.kinds[sample.id].kind, guidelineOf: (sample) => run.kinds[sample.id].guideline }
const entries = corpus({ samples: SAMPLES, xmlOf: (sample) => recorded(`${sample.id}.xml`), ...KINDS_OF })
/** The whole corpus the gate judges: the XML, then the PDFs as planned, which the judges' tests build without drawing them. */
const all = [...entries, ...pdfPlan(entries)]

describe('the corpus', () => {
  // Every sample is judged as the runtime wrote it, and each must be
  // accepted by both tools: a sample that one refuses is a bill nobody's
  // system takes.
  test('is every sample, accepted by both tools, then the controls', () => {
    expect(entries.map((entry) => [entry.file, entry.format, entry.expect.mustang === 'accepted', entry.expect.kosit === 'accepted'])).toEqual([
      ['e-invoice.xml', 'xml', true, true],
      ['e-invoice-reverse-charge.xml', 'xml', true, true],
      ['e-invoice-exempt-paid.xml', 'xml', true, true],
      ['e-invoice-addressed.xml', 'xml', true, true],
      ['e-invoice-xrechnung.xml', 'xml', true, true],
      ...CONTROLS.map((control) => [control.file, 'xml', false, false]),
    ])
    expect(corpusProblems(all)).toEqual([])
  })

  // Each kind's XML is judged in KoSIT's scenario for it, and read by
  // Mustang as its kind's guideline: Factur-X's in EN 16931's alone, an
  // XRechnung's in XRechnung's (0038), a control in its sample's. A sample
  // of a kind the gate does not know would be judged in no scenario at
  // all, and is refused.
  test('judges each kind in its scenario, as its guideline, and refuses a kind it does not know', () => {
    expect(KINDS).toEqual({ facturX: { scenario: 'EN16931 (CII)', drawn: true }, xrechnung: { scenario: 'EN16931 XRechnung (CII)', drawn: false } })
    const xrechnung = 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0'
    expect(entries.map((entry) => [entry.file, entry.kind, entry.scenario, entry.guideline])).toEqual(
      entries.map((entry) => {
        const of = entry.file === 'e-invoice-xrechnung.xml' || entry.from === 'e-invoice-xrechnung.xml' ? ['xrechnung', 'EN16931 XRechnung (CII)', xrechnung] : ['facturX', 'EN16931 (CII)', 'urn:cen.eu:en16931:2017']
        return [entry.file, ...of]
      }),
    )
    expect(() => corpus({ samples: SAMPLES, xmlOf: (sample) => recorded(`${sample.id}.xml`), ...KINDS_OF, kindOf: () => 'ubl' })).toThrow('the sample e-invoice is an e-invoice of the kind ubl, which the gate does not judge')
    // An XRechnung's copy embeds nothing: no PDF of it is planned.
    expect(all.filter((entry) => entry.format === 'pdf' && entry.sample !== undefined).map((entry) => entry.sample)).toEqual(SAMPLES.map((sample) => sample.id).filter((id) => id !== XRECHNUNG_BASE))
  })

  // The judges' tests read what the tools said of the recorded corpus. A
  // control made otherwise than the one recorded would leave those tests
  // judging a file the gate no longer makes.
  test('makes each control byte for byte as the recorded run made it', () => {
    for (const entry of entries.filter((each) => each.from !== undefined)) expect(entry.xml, entry.file).toBe(recorded(entry.file))
  })

  // A control is its sample broken one way: the lines it changes are the
  // ones its reason names, and no other, so a refusal for anything else is
  // a judge seeing what is not there. Each is made from the first sample
  // but the one whose term only the addressed sample writes.
  test('breaks the sample in the one place each control names', () => {
    const base = recorded(`${CONTROL_BASE}.xml`).split('\n')
    const changed = (file) => {
      const control = entries.find((entry) => entry.file === file)
      const from = recorded(control.from).split('\n')
      return control.xml.split('\n').filter((line, index) => line !== from[index]).map((line) => line.trim())
    }
    const XRECHNUNG_CONTROLS = ['control-br-de-15.xml', 'control-br-de-2.xml', 'control-peppol-en16931-r020.xml', 'control-br-de-18.xml']
    expect(entries.filter((entry) => entry.from !== undefined).map((entry) => [entry.file, entry.from])).toEqual(
      CONTROLS.map((control) => [control.file, control.file === 'control-br-cl-25.xml' ? 'e-invoice-addressed.xml' : XRECHNUNG_CONTROLS.includes(control.file) ? 'e-invoice-xrechnung.xml' : 'e-invoice.xml']),
    )
    // Each of the XRechnung's is the sample without the one term XRechnung needs, or with the one line BR-DE-18 refuses.
    const xrechnung = recorded('e-invoice-xrechnung.xml')
    const without = (from) => {
      expect(xrechnung.split(from).length, from).toBe(2)
      return xrechnung.replace(from, '')
    }
    const control = (file) => entries.find((entry) => entry.file === file).xml
    expect(control('control-br-de-15.xml')).toBe(without('\n      <ram:BuyerReference>991-33333TEST-33</ram:BuyerReference>'))
    expect(control('control-br-de-2.xml')).toBe(
      without(
        '\n        <ram:DefinedTradeContact>\n          <ram:PersonName>Erika Mustermann</ram:PersonName>\n          <ram:TelephoneUniversalCommunication>\n            <ram:CompleteNumber>+49 221 4710 820</ram:CompleteNumber>\n          </ram:TelephoneUniversalCommunication>\n          <ram:EmailURIUniversalCommunication>\n            <ram:URIID>e.mustermann@formancy-haustechnik.example</ram:URIID>\n          </ram:EmailURIUniversalCommunication>\n        </ram:DefinedTradeContact>',
      ),
    )
    expect(control('control-peppol-en16931-r020.xml')).toBe(without('\n        <ram:URIUniversalCommunication>\n          <ram:URIID schemeID="EM">rechnung@formancy-haustechnik.example</ram:URIID>\n        </ram:URIUniversalCommunication>'))
    expect(control('control-br-de-18.xml')).toBe(xrechnung.replace('unter Angabe der Referenz.</ram:Description>', 'unter Angabe der Referenz.\n#SKONTO#TAGE=14#PROZENT=2#\n</ram:Description>'))
    expect(changed('control-br-cl-25.xml')).toEqual(['<ram:URIID schemeID="EMAIL">rechnung@formancy-haustechnik.example</ram:URIID>'])
    expect(changed('control-br-co-14.xml')).toEqual(['<ram:TaxTotalAmount currencyID="EUR">128.34</ram:TaxTotalAmount>', '<ram:GrandTotalAmount>871.64</ram:GrandTotalAmount>', '<ram:DuePayableAmount>871.64</ram:DuePayableAmount>'])
    // The 7 % category at 0.49 %: its two lines' rate and its breakdown's, its tax 107.50 × 0.49 % = 0.53, and the totals 7.00 less.
    expect(changed('control-br-co-17.xml')).toEqual([
      '<ram:RateApplicablePercent>0.49</ram:RateApplicablePercent>',
      '<ram:RateApplicablePercent>0.49</ram:RateApplicablePercent>',
      '<ram:CalculatedAmount>0.53</ram:CalculatedAmount>',
      '<ram:RateApplicablePercent>0.49</ram:RateApplicablePercent>',
      '<ram:TaxTotalAmount currencyID="EUR">121.33</ram:TaxTotalAmount>',
      '<ram:GrandTotalAmount>864.63</ram:GrandTotalAmount>',
      '<ram:DuePayableAmount>864.63</ram:DuePayableAmount>',
    ])
    expect(changed('control-br-27.xml')).toEqual(['<ram:ChargeAmount>-245.00</ram:ChargeAmount>'])
    expect(changed('control-br-cl-23.xml')).toEqual(['<ram:BilledQuantity unitCode="Stk">1.00</ram:BilledQuantity>'])
    expect(entries.find((entry) => entry.file === 'control-malformed.xml').xml).toBe(base.filter((line) => line !== '</rsm:CrossIndustryInvoice>').join('\n'))
    expect(entries.find((entry) => entry.file === 'control-schema.xml').xml.split('\n').length).toBe(base.length + 1)
  })

  // A control made from a sample the gate no longer has, or by a change
  // whose place is gone, would be the sample itself under a control's name:
  // a file both tools accept, read as one they refused.
  test('refuses to make a control whose sample or place is gone', () => {
    expect(() => corpus({ samples: SAMPLES.slice(1), xmlOf: (sample) => recorded(`${sample.id}.xml`), ...KINDS_OF })).toThrow('the corpus has no e-invoice sample to make control-schema.xml from')
    expect(() => corpus({ samples: SAMPLES.slice(0, 3), xmlOf: (sample) => recorded(`${sample.id}.xml`), ...KINDS_OF })).toThrow('the corpus has no e-invoice-addressed sample to make control-br-cl-25.xml from')
    expect(() => corpus({ samples: SAMPLES.slice(0, 4), xmlOf: (sample) => recorded(`${sample.id}.xml`), ...KINDS_OF })).toThrow('the corpus has no e-invoice-xrechnung sample to make control-br-de-15.xml from')
    expect(() => corpus({ samples: SAMPLES, xmlOf: (sample) => recorded(`${sample.id}.xml`).replace('<ram:TaxTotalAmount', '<ram:TaxSum'), ...KINDS_OF })).toThrow('control-br-co-14.xml: BT-110 is written 0 times in e-invoice.xml, where the control changes it once')
    // A total written twice -- a second currency's BT-111 one day -- would leave the control changing one of two, which neither tool may then read as BR-CO-14 alone.
    const twice = (sample) => recorded(`${sample.id}.xml`).replace(/(<ram:TaxTotalAmount [^\n]*\n)/, '$1$1')
    expect(() => corpus({ samples: SAMPLES, xmlOf: twice, ...KINDS_OF })).toThrow('control-br-co-14.xml: BT-110 is written 2 times in e-invoice.xml, where the control changes it once')
  })
})

describe('what the corpus refuses', () => {
  // The judges compare a file's refusals with what it expects; an entry
  // that expects neither acceptance nor a list, or a control that does not
  // say what it breaks, has nothing to be compared with.
  test('a name twice, an expectation that is none, a control without a reason, and no control a tool refuses', () => {
    const one = (change) => {
      const copy = structuredClone(all)
      change(copy)
      return corpusProblems(copy)
    }
    const named = (copy, file) => copy.find((entry) => entry.file === file)
    expect(one((copy) => copy.push(structuredClone(copy[0])))).toEqual(['e-invoice.xml is in the corpus twice'])
    expect(one((copy) => (copy[0].file = 'E-Invoice.xml'))).toEqual(['E-Invoice.xml is not a lowercase .xml or .pdf file name'])
    expect(one((copy) => (copy[0].expect.kosit = []))).toEqual(['e-invoice.xml expects of kosit neither acceptance nor any refusal'])
    expect(one((copy) => (named(copy, 'control-malformed.xml').why = ''))).toEqual(['control-malformed.xml is broken and does not say for what'])
    expect(one((copy) => (named(copy, 'control-malformed.xml').xml = copy[0].xml))).toEqual(['control-malformed.xml is the sample it is made from, unbroken'])
    expect(one((copy) => copy.splice(SAMPLES.length, CONTROLS.length))).toEqual(['the corpus has no xml control mustang must refuse', 'the corpus has no xml control kosit must refuse'])
    expect(one((copy) => copy.splice(0, SAMPLES.length))).toEqual(['the corpus has no xml sample both tools must accept'])
  })

  // KoSIT reads no PDF and veraPDF no XML: an expectation of either on the
  // other's format is a verdict nobody will give, and a PDF without one of
  // veraPDF's is a PDF/A nobody judges. A file whose name says another
  // format is written where a tool reads it as that one.
  test('an expectation of a tool that does not judge the file’s format, none of one that does, and a format its name does not say', () => {
    const one = (change) => {
      const copy = structuredClone(all)
      change(copy)
      return corpusProblems(copy)
    }
    const pdf = (copy) => copy.find((entry) => entry.file === 'e-invoice.pdf')
    expect(one((copy) => (pdf(copy).expect.kosit = 'accepted'))).toEqual(['e-invoice.pdf expects something of kosit, which does not judge a PDF'])
    expect(one((copy) => delete pdf(copy).expect.verapdf)).toEqual(['e-invoice.pdf expects of verapdf neither acceptance nor any refusal'])
    expect(one((copy) => (pdf(copy).format = 'xml'))).toEqual([
      'e-invoice.pdf is an XML file, which its name does not say',
      'e-invoice.pdf expects of kosit neither acceptance nor any refusal',
      'e-invoice.pdf expects something of verapdf, which does not judge an XML file',
    ])
  })

  // A control no tool is to refuse is a broken file the gate calls fine;
  // a corpus that lost its PDFs judges the PDF/A-3b no more.
  test('a control every tool is to accept, and a corpus without PDFs', () => {
    const copy = structuredClone(all)
    copy.find((entry) => entry.file === 'control-xmp.pdf').expect.mustang = 'accepted'
    expect(corpusProblems(copy)).toEqual([`control-xmp.pdf is broken for ${copy.find((entry) => entry.file === 'control-xmp.pdf').why}, and no tool is to refuse it`])
    expect(corpusProblems(entries)).toEqual(['the corpus has no pdf sample both tools must accept', 'the corpus has no pdf control verapdf must refuse', 'the corpus has no pdf control mustang must refuse'])
  })
})

describe('the accepted messages against the corpus', () => {
  // An entry accepted in a file the corpus does not have accepts nothing
  // anywhere: a sample renamed, its warning left registered under the old
  // name. One place says so for both judges.
  test('name files of the corpus, and nothing else', () => {
    const { accepted } = JSON.parse(readFileSync(join(here, 'accepted.json'), 'utf8'))
    expect(strayAccepted(accepted, all)).toEqual([])
    expect(strayAccepted([...accepted, { tool: 'kosit', message: 'warning val-sch.1 CII-SR-005', files: ['invoice.xml'], reason: 'r' }], all)).toEqual(['the accepted message kosit warning val-sch.1 CII-SR-005 names invoice.xml, which is no file of the corpus'])
  })
})

describe('plusOneCent', () => {
  // The controls' sums are written as the runtime writes amounts, two
  // places, and changed without a Number in between.
  test('adds a cent to an amount of two places, through the sign and past a carry', () => {
    expect(['128.33', '0.99', '-0.01', '-1.00', '999.99'].map(plusOneCent)).toEqual(['128.34', '1.00', '0.00', '-0.99', '1000.00'])
    expect(() => plusOneCent('1.5')).toThrow('1.5 is not an amount of two places')
  })
})

describe('taxAt', () => {
  // The BR-CO-17 control's tax is computed as the runtime computes a
  // category's, so that only BR-CO-17 is broken: a tax off by a cent from
  // the basis at its rate would be BR-S-09's too, in a tool that rounds
  // otherwise.
  test('is the basis at the rate, rounded half away from zero to the cent, without a Number', () => {
    expect(taxAt('107.50', '0.49')).toBe('0.53')
    expect(taxAt('635.80', '19')).toBe('120.80')
    expect(taxAt('107.50', '7')).toBe('7.53')
    expect(taxAt('0.50', '1')).toBe('0.01')
    expect(taxAt('0.49', '1')).toBe('0.00')
    expect(() => taxAt('-1.00', '7')).toThrow('-1.00 at 7 is not a basis and a rate this computes')
  })
})
