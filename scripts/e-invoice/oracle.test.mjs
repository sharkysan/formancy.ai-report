import { describe, expect, test } from 'vitest'
import { CODE_LISTS, codeList, codeListAt, oracleProblems, readCodedb, readSchematron, readVariables, scenarioSchematrons } from './oracle.mjs'

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
const cenRule = (id, flag, test, match = 'ram:X') => `<xsl:template match="${match}" mode="d1"><schxslt:rule pattern="p"><xsl:if test="not(${test.replaceAll("'", '&apos;')})"><svrl:failed-assert location="{schxslt:location(.)}" flag="${flag}" id="${id}"><xsl:attribute name="test">${test}</xsl:attribute><svrl:text>[${id}]</svrl:text></svrl:failed-assert></xsl:if></schxslt:rule></xsl:template>`
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

/** XRechnung's two shapes, as report-spec states them and the pinned schematron's variables write them. */
const EMAIL = String.raw`^[^@\s]+@([^@.\s]+\.)+[^@.\s]+$`
const TELEPHONE = '.*([0-9].*){3,}.*'
const PATTERNS = { telephone: { rule: 'BR-DE-27', pattern: TELEPHONE }, email: { rule: 'BR-DE-28', pattern: EMAIL } }
/** Where the pinned schematron reads each shape: the seller's contact, and the element its test reads, as XRECHNUNG_SHAPES gives them. */
const CONTACT = '/rsm:CrossIndustryInvoice/rsm:SupplyChainTradeTransaction/ram:ApplicableHeaderTradeAgreement/ram:SellerTradeParty/ram:DefinedTradeContact'
const TESTS = {
  'BR-DE-27': 'matches(normalize-space(ram:TelephoneUniversalCommunication/ram:CompleteNumber), $XR-TELEPHONE-REGEX)',
  'BR-DE-28': 'matches(normalize-space(ram:EmailURIUniversalCommunication/ram:URIID), $XR-EMAIL-REGEX)',
}
/** XRechnung's schematron as SchXslt compiles it: its variables at the top, each shape's rule a warning at the seller's contact reading one, its test as `tests` writes it. */
const xrechnungSchematron = ({ telephone = TELEPHONE, email = EMAIL, rules = ['BR-DE-27', 'BR-DE-28'], tests = TESTS, context = CONTACT } = {}) =>
  `<xsl:transform ${NS} version="2.0"><xsl:variable name="XR-TELEPHONE-REGEX" select="'${telephone}'"/><xsl:variable name="XR-EMAIL-REGEX" select="'${email}'"/>${rules
    .map((id) => cenRule(id, 'warning', tests[id], context))
    .join('')}</xsl:transform>`
const xrechnungOf = (text) => ({ name: 'XRechnung’s schematron', asserts: readSchematron(text), variables: readVariables(text) })

/** report-spec's lists and rules, as the oracle reads them, cut down to one list and two rules for these cases. */
const SPEC = { UNIT_CODES: ['C62', 'H87'], EN16931_RULES: ['BR-27', 'BR-CL-23'], XRECHNUNG_RULES: ['BR-DE-27', 'BR-DE-28'], XRECHNUNG_PATTERNS: PATTERNS }
const LISTS = CODE_LISTS.filter((entry) => entry.list === 'UNIT_CODES')
const CEN = { name: 'CEN’s schematron', asserts: readSchematron(cen(cenRule('BR-CL-23', 'fatal', test_('C62 H87 KGM')), cenRule('BR-27', 'fatal', '. &gt;= 0'))) }
const FERD = {
  name: 'FeRD’s schematron',
  asserts: readSchematron(ferd(ferdRule({ match: LINE, variable: 'codeValue8', select: '@unitCode', id: 'FX-SCH-A-000613', test: fromCodedb('codeValue8', 8) }), ferdRule({ match: '/x', id: 'BR-27', test: 'true()' }))),
  codedb: new Map([['8', ['C62', 'H87', 'KGM']]]),
}
const XRECHNUNG = xrechnungOf(xrechnungSchematron())
const problems = (change = () => {}) => {
  const given = { spec: structuredClone(SPEC), lists: LISTS, cen: structuredClone(CEN), ferd: structuredClone(FERD), xrechnung: structuredClone(XRECHNUNG) }
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
      spec: { COUNTRY_CODES: ['DE', 'UK'], EN16931_RULES: [], XRECHNUNG_RULES: [], XRECHNUNG_PATTERNS: {} },
      lists: CODE_LISTS.filter((entry) => entry.list === 'COUNTRY_CODES'),
      cen: { name: 'CEN’s schematron', asserts: readSchematron(cen(cenRule('BR-CL-14', 'fatal', test_('AT DE', '.')))) },
      ferd: { name: 'FeRD’s schematron', asserts: readSchematron(ferd(...countries)), codedb: new Map([['7', ['AT', 'DE']]]) },
      xrechnung: XRECHNUNG,
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
    expect(oracleProblems({ spec: SPEC, lists: LISTS, cen: CEN, ferd: FERD, xrechnung: XRECHNUNG }).checked).toEqual({
      lists: [{ list: 'UNIT_CODES', term: 'BT-130', codes: 2, cen: ['BR-CL-23'], ferd: ['8'] }],
      rules: { cen: ['BR-27', 'BR-CL-23'], ferd: ['BR-27'], xrechnung: ['BR-DE-27', 'BR-DE-28'] },
      patterns: [
        { shape: 'telephone', rule: 'BR-DE-27', variable: 'XR-TELEPHONE-REGEX', context: CONTACT, test: TESTS['BR-DE-27'] },
        { shape: 'email', rule: 'BR-DE-28', variable: 'XR-EMAIL-REGEX', context: CONTACT, test: TESTS['BR-DE-28'] },
      ],
    })
  })

  // Every list the runtime writes a code from is checked, each where the
  // runtime writes it; a list added to report-spec without a row here is a
  // list nothing holds to a validator.
  test('checks every code list report-spec writes', () => {
    expect(CODE_LISTS.map((entry) => entry.list)).toEqual(['UNIT_CODES', 'COUNTRY_CODES', 'VAT_PREFIXES', 'SCHEME_IDS', 'ADDRESS_SCHEMES', 'VAT_CATEGORY_CODES', 'PAYMENT_MEANS_CODES', 'E_INVOICE_CURRENCIES', 'INVOICE_TYPE_CODES'])
  })

  // An electronic address's scheme outside the CEF's EAS list fails
  // BR-CL-25, whose context is the URIID with a scheme wherever it stands,
  // and FeRD's own rule at each party's URIID, against its list 17: a
  // scheme report-spec took that either list dropped would write a file
  // every validator refuses, which no sample, using two schemes of five,
  // would show (0037).
  test('holds the address schemes to BR-CL-25 and to FeRD’s list at both parties’ electronic addresses', () => {
    const party = (role) => `/rsm:CrossIndustryInvoice/rsm:SupplyChainTradeTransaction/ram:ApplicableHeaderTradeAgreement/ram:${role}/ram:URIUniversalCommunication/ram:URIID`
    const rules = ['SellerTradeParty', 'BuyerTradeParty'].map((role) => ferdRule({ match: party(role), variable: 'codeValue17', select: '@schemeID', id: 'FX-SCH-A-0', test: fromCodedb('codeValue17', 17) }))
    const given = {
      spec: { ADDRESS_SCHEMES: ['EM', '0204', '9930'], EN16931_RULES: [], XRECHNUNG_RULES: [], XRECHNUNG_PATTERNS: {} },
      lists: CODE_LISTS.filter((entry) => entry.list === 'ADDRESS_SCHEMES'),
      cen: { name: 'CEN’s schematron', asserts: readSchematron(cen(cenRule('BR-CL-25', 'fatal', test_('0088 0204 EM', '@schemeID')))) },
      ferd: { name: 'FeRD’s schematron', asserts: readSchematron(ferd(...rules)), codedb: new Map([['17', ['EM', '0204']]]) },
      xrechnung: xrechnungOf(xrechnungSchematron({ rules: [] })),
    }
    expect(oracleProblems(given).problems).toEqual(['ADDRESS_SCHEMES (BT-34-1, BT-49-1): CEN’s schematron’s BR-CL-25 does not hold 9930', 'ADDRESS_SCHEMES (BT-34-1, BT-49-1): FeRD’s schematron’s code list 17 does not hold 9930'])
  })
})

describe('XRechnung’s rules and shapes', () => {
  // What report-spec holds a telephone number and an email address to is
  // XRechnung's own expression, so that no file it writes earns KoSIT's
  // warning: a pattern KoSIT rewrote in a later configuration, or a rule
  // it renamed, would leave report-spec's check holding another shape than
  // the one KoSIT warns of, and nothing else would see it (0037).
  test('holds when each rule is XRechnung’s and reads, by its one variable, the very pattern report-spec does', () => {
    expect(problems()).toEqual([])
  })

  // Each way the string could stop being what the rule reads: KoSIT
  // writing the pattern otherwise, renaming the rule, or testing no one
  // variable -- none, or two -- of which the gate would compare the
  // wrong one or none.
  test('refuses a pattern the schematron writes otherwise, a rule it does not have, and a rule that reads no one variable', () => {
    expect(problems((given) => (given.xrechnung = xrechnungOf(xrechnungSchematron({ email: '^[^@]+@[^@]+$' }))))).toEqual([
      `XRechnung’s schematron’s BR-DE-28 reads $XR-EMAIL-REGEX as '^[^@]+@[^@]+$', where report-spec holds its email shape to '${EMAIL}'`,
    ])
    expect(problems((given) => (given.xrechnung = xrechnungOf(xrechnungSchematron({ rules: ['BR-DE-28'] }))))).toEqual(['BR-DE-27 is no rule of XRechnung’s schematron'])
    expect(problems((given) => given.xrechnung.asserts.find((each) => each.id === 'BR-DE-27').test = 'string-length(ram:X) &gt; 2')).toEqual(['XRechnung’s schematron’s BR-DE-27 reads no one variable, where report-spec holds its telephone shape to one'])
    expect(problems((given) => given.xrechnung.variables.delete('XR-TELEPHONE-REGEX'))).toEqual(['XRechnung’s schematron’s BR-DE-27 reads $XR-TELEPHONE-REGEX, which it does not declare as a string'])
    const both = `${TESTS['BR-DE-28']} or matches(ram:Y, $XR-TELEPHONE-REGEX)`
    expect(problems((given) => (given.xrechnung = xrechnungOf(xrechnungSchematron({ tests: { ...TESTS, 'BR-DE-28': both } }))))).toEqual(['XRechnung’s schematron’s BR-DE-28 reads no one variable, where report-spec holds its email shape to one'])
  })

  // The pattern is all a rule reads only where its test is that pattern
  // matched against normalize-space of the one element, at the seller's
  // contact: a flag added to matches() ('i', 'x'), normalize-space
  // dropped, another element read or the rule moved to another context
  // would have KoSIT warn of another shape than report-spec refuses, with
  // the string still the same. Each is a problem, as is a shape of
  // report-spec's whose place the gate does not know.
  test('refuses a rule that tests its pattern otherwise than matched against normalize-space of its element, or at another context', () => {
    const tested = (test) => (given) => (given.xrechnung = xrechnungOf(xrechnungSchematron({ tests: { ...TESTS, 'BR-DE-28': test } })))
    const otherwise = (test) => `XRechnung’s schematron’s BR-DE-28 tests '${test}', where report-spec reads its email shape as '${TESTS['BR-DE-28']}'`
    for (const test of [
      "matches(normalize-space(ram:EmailURIUniversalCommunication/ram:URIID), $XR-EMAIL-REGEX, 'i')",
      'matches(ram:EmailURIUniversalCommunication/ram:URIID, $XR-EMAIL-REGEX)',
      'matches(normalize-space(ram:URIUniversalCommunication/ram:URIID), $XR-EMAIL-REGEX)',
      'not(matches(normalize-space(ram:EmailURIUniversalCommunication/ram:URIID), $XR-EMAIL-REGEX))',
    ]) {
      expect(problems(tested(test)), test).toEqual([otherwise(test)])
    }
    const buyer = CONTACT.replace('SellerTradeParty', 'BuyerTradeParty')
    expect(problems((given) => (given.xrechnung = xrechnungOf(xrechnungSchematron({ context: buyer }))))).toEqual([
      `XRechnung’s schematron’s BR-DE-27 holds ${buyer}, where the runtime writes the seller’s contact at ${CONTACT}`,
      `XRechnung’s schematron’s BR-DE-28 holds ${buyer}, where the runtime writes the seller’s contact at ${CONTACT}`,
    ])
    expect(problems((given) => (given.spec.XRECHNUNG_PATTERNS = { ...PATTERNS, fax: { rule: 'BR-DE-27', pattern: TELEPHONE } }))).toEqual(['report-spec holds a fax shape whose place in the XML the gate does not know'])
  })

  // A variable's select is an XPath string literal, a quote written twice
  // within it; and a scenario's schematrons are read out of KoSIT's
  // scenarios.xml by the scenario's name, in its namespace.
  test('reads a variable as the string its select writes, and a scenario’s schematrons by its name', () => {
    expect(readVariables(`<xsl:transform ${NS}><xsl:variable name="A" select="'it''s'"/><xsl:variable name="B" select="concat('a', 'b')"/><xsl:template match="x"><xsl:variable name="C" select="'inner'"/></xsl:template></xsl:transform>`)).toEqual(new Map([['A', "it's"], ['B', undefined]]))
    const scenarios = `<scenarios xmlns="http://www.xoev.de/de/validator/framework/1/scenarios"><scenario><name>EN16931 XRechnung (CII)</name><validateWithSchematron><resource><name>a</name><location>resources/cii.xsl</location></resource></validateWithSchematron><validateWithSchematron><resource><name>b</name><location>resources/xr.xsl</location></resource></validateWithSchematron></scenario><scenario><name>EN16931 (CII)</name><validateWithSchematron><resource><name>a</name><location>resources/cii.xsl</location></resource></validateWithSchematron></scenario></scenarios>`
    expect(scenarioSchematrons(scenarios, 'EN16931 XRechnung (CII)')).toEqual(['resources/cii.xsl', 'resources/xr.xsl'])
    expect(scenarioSchematrons(scenarios, 'EN16931 (CII)')).toEqual(['resources/cii.xsl'])
    expect(scenarioSchematrons(scenarios, 'XRechnung 4.0')).toEqual([])
  })
})
