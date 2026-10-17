import { describe, expect, test } from 'vitest'
import { CODE_LISTS, codeList, codeListAt, oracleProblems, readCodedb, readSchematron } from './oracle.mjs'

/**
 * report-spec's closed lists and the rule ids its refusals name, held to
 * the schematrons the pinned tools run (0027). The schematrons here are
 * written for these cases in the two shapes the pinned ones are compiled
 * in -- CEN's, by SchXslt, as KoSIT's configuration carries it, and FeRD's,
 * by ph-schematron, as Mustang carries it, with its code database -- with
 * lists made up for the case: the real ones are CEN's EUPL-1.2 artefacts,
 * which the repository does not copy.
 */
const NS = 'xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:svrl="http://purl.oclc.org/dsdl/svrl" xmlns:schxslt="https://doi.org/10.5281/zenodo.1495494"'
const test_ = (list, select = '@unitCode') => `((not(contains(normalize-space(${select}), ' ')) and contains(' ${list} ', concat(' ', normalize-space(${select}), ' '))))`

/** A SchXslt-compiled rule as CEN's is: id and flag on the assert, its test in an attribute instruction. */
const cenRule = (id, flag, test) => `<xsl:template match="ram:X" mode="d1"><schxslt:rule pattern="p"><xsl:if test="not(${test.replaceAll("'", '&apos;')})"><svrl:failed-assert location="{schxslt:location(.)}" flag="${flag}" id="${id}"><xsl:attribute name="test">${test}</xsl:attribute><svrl:text>[${id}]</svrl:text></svrl:failed-assert></xsl:if></schxslt:rule></xsl:template>`
const cen = (...rules) => `<xsl:transform ${NS} version="2.0">${rules.join('')}</xsl:transform>`

/** A ph-schematron rule as FeRD's is: the context in the template's match, the value in a variable, the id and flag as attribute instructions. */
const ferdRule = ({ match, variable, select, id, flag, test }) =>
  `<xsl:template match="${match}" mode="M70" priority="1"><svrl:fired-rule context="${match}"/>${variable === undefined ? '' : `<xsl:variable name="${variable}" select="${select}"/>`}<xsl:choose><xsl:when test="${test}"/><xsl:otherwise><svrl:failed-assert test="${test}"><xsl:attribute name="id">${id}</xsl:attribute>${flag === undefined ? '' : `<xsl:attribute name="flag">${flag}</xsl:attribute>`}<svrl:text>t</svrl:text></svrl:failed-assert></xsl:otherwise></xsl:choose></xsl:template>`
const ferd = (...rules) => `<xsl:stylesheet ${NS} version="2.0">${rules.join('')}</xsl:stylesheet>`
const LINE = '/rsm:CrossIndustryInvoice/rsm:SupplyChainTradeTransaction/ram:IncludedSupplyChainTradeLineItem/ram:SpecifiedLineTradeDelivery/ram:BilledQuantity'
const fromCodedb = (variable, id) => `string-length($${variable})=0 or document('FACTUR-X_EN16931_codedb.xml')/codedb/cl[@id=${id}]/enumeration[@value=$${variable}]`

describe('reading a schematron', () => {
  // Both compilations, read one way: an assert's id, flag and test, wherever
  // the compiler put them, and the rule's context and variables.
  test('reads each assert’s id, flag and test in either compiled shape, with its rule’s context and variables', () => {
    expect(readSchematron(cen(cenRule('BR-CL-23', 'fatal', test_('C62 H87'))))).toEqual([{ id: 'BR-CL-23', flag: 'fatal', test: test_('C62 H87'), context: 'ram:X', variables: {} }])
    const rule = { match: LINE, variable: 'codeValue8', select: '@unitCode', id: 'FX-SCH-A-000613', test: fromCodedb('codeValue8', 8) }
    expect(readSchematron(ferd(ferdRule(rule), ferdRule({ ...rule, id: 'BR-CO-09', flag: 'warning', variable: undefined })))).toEqual([
      { id: 'FX-SCH-A-000613', flag: undefined, test: fromCodedb('codeValue8', 8), context: LINE, variables: { codeValue8: '@unitCode' } },
      { id: 'BR-CO-09', flag: 'warning', test: fromCodedb('codeValue8', 8), context: LINE, variables: {} },
    ])
  })

  // CEN writes a list as one string, spaces at both ends, which the value
  // is looked up in; anything else is a list the gate cannot read, and
  // says so rather than reading it as empty.
  test('reads a code list out of a test, and nothing out of a test without one', () => {
    expect(codeList(test_('C62 H87 KGM'))).toEqual(['C62', 'H87', 'KGM'])
    expect(codeList("contains(' 1A AD EL ', concat(' ', substring(.,1,2), ' '))")).toEqual(['1A', 'AD', 'EL'])
    expect(codeList('(@mimeCode = &apos;application/pdf&apos;)')).toBeUndefined()
    expect(readCodedb('<codedb><cl id="8"><enumeration value="C62"/><enumeration value="H87"/></cl><cl id="2"><enumeration value="380"/></cl></codedb>')).toEqual(new Map([['8', ['C62', 'H87']], ['2', ['380']]]))
  })

  // FeRD checks a code where the runtime writes it, against a list of its
  // database: the rule is found by its context and the variable it reads.
  test('finds FeRD’s list for a path and a value, by the rule that checks it', () => {
    const asserts = readSchematron(ferd(ferdRule({ match: LINE, variable: 'codeValue8', select: '@unitCode', id: 'FX-SCH-A-000613', test: fromCodedb('codeValue8', 8) })))
    expect(codeListAt(asserts, { path: LINE, select: '@unitCode' })).toEqual(['8'])
    expect(codeListAt(asserts, { path: LINE, select: '.' })).toEqual([])
  })
})

/** report-spec's lists and rules, as the oracle reads them, cut down to one list and two rules for these cases. */
const SPEC = { UNIT_CODES: ['C62', 'H87'], EN16931_RULES: ['BR-27', 'BR-CL-23'] }
const LISTS = CODE_LISTS.filter((entry) => entry.list === 'UNIT_CODES')
const CEN = { name: 'CEN’s schematron', asserts: readSchematron(cen(cenRule('BR-CL-23', 'fatal', test_('C62 H87 KGM')), cenRule('BR-27', 'fatal', '. &gt;= 0'))) }
const FERD = {
  name: 'FeRD’s schematron',
  asserts: readSchematron(ferd(ferdRule({ match: LINE, variable: 'codeValue8', select: '@unitCode', id: 'FX-SCH-A-000613', test: fromCodedb('codeValue8', 8) }), ferdRule({ match: '/x', id: 'BR-27', test: 'true()' }))),
  codedb: new Map([['8', ['C62', 'H87', 'KGM']]]),
}
const problems = (change = () => {}) => {
  const given = { spec: structuredClone(SPEC), lists: LISTS, cen: structuredClone(CEN), ferd: structuredClone(FERD) }
  change(given)
  return oracleProblems(given).problems
}

describe('the oracle’s verdict', () => {
  test('holds when every code is in both schematrons’ lists and every rule fatal in both', () => {
    expect(problems()).toEqual([])
  })

  // The failure this exists for: a code report-spec takes and a pinned
  // schematron refuses would print an invoice every validator rejects, and
  // the samples, which use a few codes, would never show it. EL as a VAT
  // prefix is the case that happened: CEN 1.3.16 takes it, 1.3.17 does not.
  test('refuses a code a pinned schematron’s list does not hold', () => {
    expect(problems((given) => given.spec.UNIT_CODES.push('Stk'))).toEqual(['UNIT_CODES (BT-130): CEN’s schematron’s BR-CL-23 does not hold Stk', 'UNIT_CODES (BT-130): FeRD’s schematron’s code list 8 does not hold Stk'])
  })

  // The seller's country and the buyer's are checked against one list of
  // FeRD's; a code that list lacks is one problem, not one per place.
  test('says a code a list lacks once, however many places check against it', () => {
    const party = (role) => `/rsm:CrossIndustryInvoice/rsm:SupplyChainTradeTransaction/ram:ApplicableHeaderTradeAgreement/ram:${role}/ram:PostalTradeAddress/ram:CountryID`
    const countries = ['SellerTradeParty', 'BuyerTradeParty'].map((role) => ferdRule({ match: party(role), variable: 'codeValue7', select: '.', id: 'FX-SCH-A-0', test: fromCodedb('codeValue7', 7) }))
    const given = {
      spec: { COUNTRY_CODES: ['DE', 'UK'], EN16931_RULES: [] },
      lists: CODE_LISTS.filter((entry) => entry.list === 'COUNTRY_CODES'),
      cen: { name: 'CEN’s schematron', asserts: readSchematron(cen(cenRule('BR-CL-14', 'fatal', test_('AT DE', '.')))) },
      ferd: { name: 'FeRD’s schematron', asserts: readSchematron(ferd(...countries)), codedb: new Map([['7', ['AT', 'DE']]]) },
    }
    expect(oracleProblems(given).problems).toEqual(['COUNTRY_CODES (BT-40, BT-55): CEN’s schematron’s BR-CL-14 does not hold UK', 'COUNTRY_CODES (BT-40, BT-55): FeRD’s schematron’s code list 7 does not hold UK'])
  })

  // A rule renamed or a list rewritten in another shape is a check the gate
  // can no longer make; it says so rather than passing it.
  test('refuses a rule it cannot find, a list it cannot read, and a value FeRD checks against no list or two', () => {
    expect(problems((given) => (given.cen.asserts = given.cen.asserts.filter((each) => each.id !== 'BR-CL-23')))).toEqual(['UNIT_CODES (BT-130): CEN’s schematron has no rule BR-CL-23', 'BR-CL-23 is no fatal rule of CEN’s schematron'])
    expect(problems((given) => (given.cen.asserts.find((each) => each.id === 'BR-CL-23').test = '@unitCode = &apos;C62&apos;'))).toEqual(['UNIT_CODES (BT-130): CEN’s schematron’s BR-CL-23 has no code list the gate can read'])
    expect(problems((given) => (given.ferd.asserts = given.ferd.asserts.filter((each) => each.id === 'BR-27')))).toEqual([`UNIT_CODES (BT-130): FeRD’s schematron checks @unitCode at ${LINE} against no code list`])
    expect(problems((given) => given.ferd.codedb.delete('8'))).toEqual(['UNIT_CODES (BT-130): FeRD’s schematron’s code database has no list 8'])
  })

  // Every id a refusal names must be a rule a validator refuses a file
  // for: ids move between releases (BR-CO-27 became CII-SR-470), and a
  // message naming one that is gone, or one that only warns, sends the
  // reader to the wrong rule. FeRD writes CEN's code lists as its own rules
  // over its database, so a BR-CL id is held to CEN's alone.
  test('refuses a rule id that is missing or not fatal in either schematron, and holds a BR-CL id to CEN’s alone', () => {
    expect(problems((given) => (given.cen.asserts.find((each) => each.id === 'BR-27').flag = 'warning'))).toEqual(['BR-27 is no fatal rule of CEN’s schematron'])
    expect(problems((given) => (given.ferd.asserts.find((each) => each.id === 'BR-27').flag = 'warning'))).toEqual(['BR-27 is no fatal rule of FeRD’s schematron'])
    expect(problems((given) => given.spec.EN16931_RULES.push('BR-CO-27'))).toEqual(['BR-CO-27 is no fatal rule of CEN’s schematron', 'BR-CO-27 is no fatal rule of FeRD’s schematron'])
    expect(oracleProblems({ spec: SPEC, lists: LISTS, cen: CEN, ferd: FERD }).checked).toEqual({ lists: [{ list: 'UNIT_CODES', term: 'BT-130', codes: 2, cen: ['BR-CL-23'], ferd: ['8'] }], rules: { cen: ['BR-27', 'BR-CL-23'], ferd: ['BR-27'] } })
  })

  // Every list the runtime writes a code from is checked, each where the
  // runtime writes it; a list added to report-spec without a row here is a
  // list nothing holds to a validator.
  test('checks every code list report-spec writes', () => {
    expect(CODE_LISTS.map((entry) => entry.list)).toEqual(['UNIT_CODES', 'COUNTRY_CODES', 'VAT_PREFIXES', 'SCHEME_IDS', 'VAT_CATEGORY_CODES', 'PAYMENT_MEANS_CODES', 'E_INVOICE_CURRENCIES', 'INVOICE_TYPE_CODES'])
  })
})
