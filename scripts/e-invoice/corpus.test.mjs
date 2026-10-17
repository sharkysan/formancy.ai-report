import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { CONTROL_BASE, CONTROLS, corpus, corpusProblems, plusOneCent, strayAccepted, taxAt } from './corpus.mjs'

/**
 * What the e-invoice gate judges (0027): the XML the runtime writes of
 * each corpus sample, and controls the gate makes by breaking the first
 * sample's XML in one named way each, which every judge must refuse for
 * exactly that. Read here from the corpus a gate run recorded
 * (scripts/e-invoice/recorded/), so the controls these cases make are the
 * very files whose tools' outputs the judges' tests read.
 */
const here = dirname(fileURLToPath(import.meta.url))
const recorded = (file) => readFileSync(join(here, 'recorded', 'corpus', file), 'utf8')
const SAMPLES = ['e-invoice', 'e-invoice-reverse-charge', 'e-invoice-exempt-paid'].map((id) => ({ id }))
const entries = corpus({ samples: SAMPLES, xmlOf: (sample) => recorded(`${sample.id}.xml`) })

describe('the corpus', () => {
  // Every sample is judged as the runtime wrote it, and each must be
  // accepted by both tools: a sample that one refuses is a bill nobody's
  // system takes.
  test('is every sample, accepted by both tools, then the controls', () => {
    expect(entries.map((entry) => [entry.file, entry.expect.mustang === 'accepted', entry.expect.kosit === 'accepted'])).toEqual([
      ['e-invoice.xml', true, true],
      ['e-invoice-reverse-charge.xml', true, true],
      ['e-invoice-exempt-paid.xml', true, true],
      ...CONTROLS.map((control) => [control.file, false, false]),
    ])
    expect(corpusProblems(entries)).toEqual([])
  })

  // The judges' tests read what the tools said of the recorded corpus. A
  // control made otherwise than the one recorded would leave those tests
  // judging a file the gate no longer makes.
  test('makes each control byte for byte as the recorded run made it', () => {
    for (const entry of entries.filter((each) => each.from !== undefined)) expect(entry.xml, entry.file).toBe(recorded(entry.file))
  })

  // A control is the sample broken one way: the lines it changes are the
  // ones its reason names, and no other, so a refusal for anything else is
  // a judge seeing what is not there.
  test('breaks the sample in the one place each control names', () => {
    const base = recorded(`${CONTROL_BASE}.xml`).split('\n')
    const changed = (file) => {
      const lines = entries.find((entry) => entry.file === file).xml.split('\n')
      return lines.filter((line, index) => line !== base[index]).map((line) => line.trim())
    }
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
    expect(() => corpus({ samples: SAMPLES.slice(1), xmlOf: (sample) => recorded(`${sample.id}.xml`) })).toThrow('the corpus has no e-invoice sample to make its controls from')
    expect(() => corpus({ samples: SAMPLES, xmlOf: (sample) => recorded(`${sample.id}.xml`).replace('<ram:TaxTotalAmount', '<ram:TaxSum') })).toThrow('control-br-co-14.xml: BT-110 is written 0 times in e-invoice.xml, where the control changes it once')
    // A total written twice -- a second currency's BT-111 one day -- would leave the control changing one of two, which neither tool may then read as BR-CO-14 alone.
    const twice = (sample) => recorded(`${sample.id}.xml`).replace(/(<ram:TaxTotalAmount [^\n]*\n)/, '$1$1')
    expect(() => corpus({ samples: SAMPLES, xmlOf: twice })).toThrow('control-br-co-14.xml: BT-110 is written 2 times in e-invoice.xml, where the control changes it once')
  })
})

describe('what the corpus refuses', () => {
  // The judges compare a file's refusals with what it expects; an entry
  // that expects neither acceptance nor a list, or a control that does not
  // say what it breaks, has nothing to be compared with.
  test('a name twice, an expectation that is none, a control without a reason, and no control a tool refuses', () => {
    const one = (change) => {
      const copy = structuredClone(entries)
      change(copy)
      return corpusProblems(copy)
    }
    expect(one((copy) => copy.push(structuredClone(copy[0])))).toEqual(['e-invoice.xml is in the corpus twice'])
    expect(one((copy) => (copy[0].file = 'E-Invoice.xml'))).toEqual(['E-Invoice.xml is not a lowercase .xml file name'])
    expect(one((copy) => (copy[0].expect.kosit = []))).toEqual(['e-invoice.xml expects of kosit neither acceptance nor any refusal'])
    expect(one((copy) => (copy.at(-1).why = ''))).toEqual(['control-malformed.xml is broken and does not say for what'])
    expect(one((copy) => (copy.at(-1).xml = copy[0].xml))).toEqual(['control-malformed.xml is the sample it is made from, unbroken'])
    expect(one((copy) => copy.splice(3))).toEqual(['the corpus has no control mustang must refuse', 'the corpus has no control kosit must refuse'])
    expect(one((copy) => copy.splice(0, 3))).toEqual(['the corpus has no sample both tools must accept'])
  })
})

describe('the accepted messages against the corpus', () => {
  // An entry accepted in a file the corpus does not have accepts nothing
  // anywhere: a sample renamed, its warning left registered under the old
  // name. One place says so for both judges.
  test('name files of the corpus, and nothing else', () => {
    const { accepted } = JSON.parse(readFileSync(join(here, 'accepted.json'), 'utf8'))
    expect(strayAccepted(accepted, entries)).toEqual([])
    expect(strayAccepted([...accepted, { tool: 'kosit', message: 'warning val-sch.1 CII-SR-005', files: ['invoice.xml'], reason: 'r' }], entries)).toEqual(['the accepted message kosit warning val-sch.1 CII-SR-005 names invoice.xml, which is no file of the corpus'])
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
