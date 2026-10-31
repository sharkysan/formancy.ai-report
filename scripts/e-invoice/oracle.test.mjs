import { describe, expect, test } from 'vitest'
import {
  CODE_LISTS,
  codeList,
  codeListAt,
  oracleProblems,
  readCodedb,
  readSchematron,
  readVariables,
  scenarioSchematrons,
  XRECHNUNG_HELD_RULES,
  XRECHNUNG_PLACES,
  XRECHNUNG_SKONTO,
} from './oracle.mjs'

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
const test_ = (list, select = '@unitCode') =>
  `((not(contains(normalize-space(${select}), ' ')) and contains(' ${list} ', concat(' ', normalize-space(${select}), ' '))))`

/** A SchXslt-compiled rule as CEN's is: id and flag on the assert, its test in an attribute instruction. */
const cenRule = (id, flag, test, match = 'ram:X') =>
  `<xsl:template match="${match}" mode="d1"><schxslt:rule pattern="p"><xsl:if test="not(${test.replaceAll("'", '&apos;')})"><svrl:failed-assert location="{schxslt:location(.)}" flag="${flag}" id="${id}"><xsl:attribute name="test">${test}</xsl:attribute><svrl:text>[${id}]</svrl:text></svrl:failed-assert></xsl:if></schxslt:rule></xsl:template>`
const cen = (...rules) => `<xsl:transform ${NS} version="2.0">${rules.join('')}</xsl:transform>`

/** A ph-schematron rule as FeRD's is: the context in the template's match, the value in a variable, the id and flag as attribute instructions. */
const ferdRule = ({ match, variable, select, id, flag, test }) =>
  `<xsl:template match="${match}" mode="M70" priority="1"><svrl:fired-rule context="${match}"/>${variable === undefined ? '' : `<xsl:variable name="${variable}" select="${select}"/>`}<xsl:choose><xsl:when test="${test}"/><xsl:otherwise><svrl:failed-assert test="${test}"><xsl:attribute name="id">${id}</xsl:attribute>${flag === undefined ? '' : `<xsl:attribute name="flag">${flag}</xsl:attribute>`}<svrl:text>t</svrl:text></svrl:failed-assert></xsl:otherwise></xsl:choose></xsl:template>`
const ferd = (...rules) => `<xsl:stylesheet ${NS} version="2.0">${rules.join('')}</xsl:stylesheet>`
const LINE = '/rsm:CrossIndustryInvoice/rsm:SupplyChainTradeTransaction/ram:IncludedSupplyChainTradeLineItem/ram:SpecifiedLineTradeDelivery/ram:BilledQuantity'
const fromCodedb = (variable, id) =>
  `string-length($${variable})=0 or document('FACTUR-X_EN16931_codedb.xml')/codedb/cl[@id=${id}]/enumeration[@value=$${variable}]`

describe('reading a schematron', () => {
  // Both compilations, read one way: an assert's id, flag and test, wherever
  // the compiler put them, and the rule's context and variables.
  test('reads each assert’s id, flag and test in either compiled shape, with its rule’s context and variables', () => {
    expect(readSchematron(cen(cenRule('BR-CL-23', 'fatal', test_('C62 H87'))))).toEqual([
      { id: 'BR-CL-23', flag: 'fatal', test: test_('C62 H87'), context: 'ram:X', variables: {} },
    ])
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
    expect(
      readCodedb('<codedb><cl id="8"><enumeration value="C62"/><enumeration value="H87"/></cl><cl id="2"><enumeration value="380"/></cl></codedb>'),
    ).toEqual(
      new Map([
        ['8', ['C62', 'H87']],
        ['2', ['380']],
      ]),
    )
  })

  // FeRD checks a code where the runtime writes it, against a list of its
  // database: the rule is found by its context and the variable it reads.
  test('finds FeRD’s list for a path and a value, by the rule that checks it', () => {
    const asserts = readSchematron(
      ferd(ferdRule({ match: LINE, variable: 'codeValue8', select: '@unitCode', id: 'FX-SCH-A-000613', test: fromCodedb('codeValue8', 8) })),
    )
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
/** BR-DE-18's test as the pinned schematron begins it, the lines it reads, and what it asks of each, here cut short. */
const SKONTO_TEST = `${XRECHNUNG_SKONTO.lines} matches ( normalize-space ($line), $XR-SKONTO-REGEX )`
/** The rules of an XRechnung that need a term, hold one by the format, or read its payment terms: each fatal at the context and with the test the pinned schematron gives it. */
const KIND_RULES = {
  'BR-DE-15': { context: XRECHNUNG_PLACES.buyerReference.context, test: XRECHNUNG_PLACES.buyerReference.test },
  'BR-DE-14': {
    context: '/rsm:CrossIndustryInvoice/rsm:SupplyChainTradeTransaction/ram:ApplicableHeaderTradeSettlement/ram:ApplicableTradeTax',
    test: 'ram:RateApplicablePercent[boolean(normalize-space(.))]',
  },
  'BR-DE-18': { context: XRECHNUNG_SKONTO.context, test: SKONTO_TEST },
}
/** The XRechnung version the schematron is of, and how it builds its CIUS identifier from it, as `XR-CIUS-ID` does. */
const CIUS = 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0'
const VERSIONED = `<xsl:variable name="XR-MAJOR-MINOR-VERSION" select="'3.0'"/><xsl:variable name="XR-CIUS-ID" select="concat('urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_', $XR-MAJOR-MINOR-VERSION )"/>`
/** XRechnung's schematron as SchXslt compiles it: its variables at the top, each shape's rule a warning at the seller's contact reading one, its test as `tests` writes it, and the rules of `kind`, each as `KIND_RULES` gives it. */
const xrechnungSchematron = ({
  telephone = TELEPHONE,
  email = EMAIL,
  rules = ['BR-DE-27', 'BR-DE-28'],
  tests = TESTS,
  context = CONTACT,
  kind = KIND_RULES,
  versioned = VERSIONED,
} = {}) =>
  `<xsl:transform ${NS} version="2.0"><xsl:variable name="XR-TELEPHONE-REGEX" select="'${telephone}'"/><xsl:variable name="XR-EMAIL-REGEX" select="'${email}'"/>${versioned}${rules
    .map((id) => cenRule(id, 'warning', tests[id], context))
    .join('')}${Object.entries(kind)
    .map(([id, rule]) => cenRule(id, rule.flag ?? 'fatal', rule.test, rule.context))
    .join('')}</xsl:transform>`
/** XRechnung's schematron as the gate reads it, with the release of XRechnung the register pins the configuration that carries it to. */
const xrechnungOf = (text) => ({ name: 'XRechnung’s schematron', asserts: readSchematron(text), variables: readVariables(text), release: '3.0.2' })

/** What report-spec needs of an XRechnung, holds by the format and names its version, as the oracle reads it: none, for a case that holds something else. */
const NO_KIND = { XRECHNUNG_NEEDS: {}, XRECHNUNG_TEXT_NEEDS: {}, XRECHNUNG_HELD: {}, XRECHNUNG: {}, XRECHNUNG_VERSIONS: [] }
/** report-spec's lists and rules, as the oracle reads them, cut down to one list, two rules of CEN's and four of XRechnung's for these cases. */
const SPEC = {
  UNIT_CODES: ['C62', 'H87'],
  EN16931_RULES: ['BR-27', 'BR-CL-23'],
  XRECHNUNG_RULES: ['BR-DE-15', 'BR-DE-18', 'BR-DE-27', 'BR-DE-28'],
  XRECHNUNG_PATTERNS: PATTERNS,
  XRECHNUNG_NEEDS: { buyerReference: { rule: 'BR-DE-15', said: 's' } },
  XRECHNUNG_TEXT_NEEDS: { 'BT-10': 'BR-DE-15' },
  XRECHNUNG_HELD: { 'BR-DE-14': 'the rate' },
  XRECHNUNG: { '3.0': { guideline: CIUS, release: '3.0.2', syntax: 'cii' } },
  XRECHNUNG_VERSIONS: ['3.0'],
}
const LISTS = CODE_LISTS.filter((entry) => entry.list === 'UNIT_CODES')
const CEN = {
  name: 'CEN’s schematron',
  asserts: readSchematron(cen(cenRule('BR-CL-23', 'fatal', test_('C62 H87 KGM')), cenRule('BR-27', 'fatal', '. &gt;= 0'))),
}
const FERD = {
  name: 'FeRD’s schematron',
  asserts: readSchematron(
    ferd(
      ferdRule({ match: LINE, variable: 'codeValue8', select: '@unitCode', id: 'FX-SCH-A-000613', test: fromCodedb('codeValue8', 8) }),
      ferdRule({ match: '/x', id: 'BR-27', test: 'true()' }),
    ),
  ),
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
    expect(problems((given) => given.spec.UNIT_CODES.push('Stk'))).toEqual([
      'UNIT_CODES (BT-130): CEN’s schematron’s BR-CL-23 does not hold Stk',
      'UNIT_CODES (BT-130): FeRD’s schematron’s code list 8 does not hold Stk',
    ])
  })

  // The seller's country and the buyer's are checked against one list of
  // FeRD's; a code that list lacks is one problem, not one per place.
  test('says a code a list lacks once, however many places check against it', () => {
    const party = (role) =>
      `/rsm:CrossIndustryInvoice/rsm:SupplyChainTradeTransaction/ram:ApplicableHeaderTradeAgreement/ram:${role}/ram:PostalTradeAddress/ram:CountryID`
    const countries = ['SellerTradeParty', 'BuyerTradeParty'].map((role) =>
      ferdRule({ match: party(role), variable: 'codeValue7', select: '.', id: 'FX-SCH-A-0', test: fromCodedb('codeValue7', 7) }),
    )
    const given = {
      spec: { COUNTRY_CODES: ['DE', 'UK'], EN16931_RULES: [], XRECHNUNG_RULES: [], XRECHNUNG_PATTERNS: {}, ...NO_KIND },
      lists: CODE_LISTS.filter((entry) => entry.list === 'COUNTRY_CODES'),
      cen: { name: 'CEN’s schematron', asserts: readSchematron(cen(cenRule('BR-CL-14', 'fatal', test_('AT DE', '.')))) },
      ferd: { name: 'FeRD’s schematron', asserts: readSchematron(ferd(...countries)), codedb: new Map([['7', ['AT', 'DE']]]) },
      xrechnung: XRECHNUNG,
    }
    expect(oracleProblems(given).problems).toEqual([
      'COUNTRY_CODES (BT-40, BT-55): CEN’s schematron’s BR-CL-14 does not hold UK',
      'COUNTRY_CODES (BT-40, BT-55): FeRD’s schematron’s code list 7 does not hold UK',
    ])
  })

  // A rule renamed or a list rewritten in another shape is a check the gate
  // can no longer make; it says so rather than passing it.
  test('refuses a rule it cannot find, a list it cannot read, and a value FeRD checks against no list or two', () => {
    expect(problems((given) => (given.cen.asserts = given.cen.asserts.filter((each) => each.id !== 'BR-CL-23')))).toEqual([
      'UNIT_CODES (BT-130): CEN’s schematron has no rule BR-CL-23',
      'BR-CL-23 is no fatal rule of CEN’s schematron',
    ])
    expect(problems((given) => (given.cen.asserts.find((each) => each.id === 'BR-CL-23').test = '@unitCode = &apos;C62&apos;'))).toEqual([
      'UNIT_CODES (BT-130): CEN’s schematron’s BR-CL-23 has no code list the gate can read',
    ])
    expect(problems((given) => (given.ferd.asserts = given.ferd.asserts.filter((each) => each.id === 'BR-27')))).toEqual([
      `UNIT_CODES (BT-130): FeRD’s schematron checks @unitCode at ${LINE} against no code list`,
    ])
    expect(problems((given) => given.ferd.codedb.delete('8'))).toEqual(['UNIT_CODES (BT-130): FeRD’s schematron’s code database has no list 8'])
  })

  // Every id a refusal names must be a rule a validator refuses a file
  // for: ids move between releases (BR-CO-27 became CII-SR-470), and a
  // message naming one that is gone, or one that only warns, sends the
  // reader to the wrong rule. FeRD writes CEN's code lists as its own rules
  // over its database, so a BR-CL id is held to CEN's alone.
  test('refuses a rule id that is missing or not fatal in either schematron, and holds a BR-CL id to CEN’s alone', () => {
    expect(problems((given) => (given.cen.asserts.find((each) => each.id === 'BR-27').flag = 'warning'))).toEqual([
      'BR-27 is no fatal rule of CEN’s schematron',
    ])
    expect(problems((given) => (given.ferd.asserts.find((each) => each.id === 'BR-27').flag = 'warning'))).toEqual([
      'BR-27 is no fatal rule of FeRD’s schematron',
    ])
    expect(problems((given) => given.spec.EN16931_RULES.push('BR-CO-27'))).toEqual([
      'BR-CO-27 is no fatal rule of CEN’s schematron',
      'BR-CO-27 is no fatal rule of FeRD’s schematron',
    ])
    expect(oracleProblems({ spec: SPEC, lists: LISTS, cen: CEN, ferd: FERD, xrechnung: XRECHNUNG }).checked).toEqual({
      lists: [{ list: 'UNIT_CODES', term: 'BT-130', codes: 2, cen: ['BR-CL-23'], ferd: ['8'] }],
      rules: { cen: ['BR-27', 'BR-CL-23'], ferd: ['BR-27'], xrechnung: ['BR-DE-15', 'BR-DE-18', 'BR-DE-27', 'BR-DE-28'], held: ['BR-DE-14'] },
      patterns: [
        { shape: 'telephone', rule: 'BR-DE-27', variable: 'XR-TELEPHONE-REGEX', context: CONTACT, test: TESTS['BR-DE-27'] },
        { shape: 'email', rule: 'BR-DE-28', variable: 'XR-EMAIL-REGEX', context: CONTACT, test: TESTS['BR-DE-28'] },
      ],
      needs: [
        { at: 'buyerReference', rule: 'BR-DE-15', ...XRECHNUNG_PLACES.buyerReference },
        { at: 'BT-10', rule: 'BR-DE-15', ...XRECHNUNG_PLACES['BT-10'] },
      ],
      versions: ['3.0'],
    })
  })

  // Every list the runtime writes a code from is checked, each where the
  // runtime writes it; a list added to report-spec without a row here is a
  // list nothing holds to a validator.
  test('checks every code list report-spec writes', () => {
    expect(CODE_LISTS.map((entry) => entry.list)).toEqual([
      'UNIT_CODES',
      'COUNTRY_CODES',
      'VAT_PREFIXES',
      'SCHEME_IDS',
      'ADDRESS_SCHEMES',
      'VAT_CATEGORY_CODES',
      'PAYMENT_MEANS_CODES',
      'E_INVOICE_CURRENCIES',
      'INVOICE_TYPE_CODES',
    ])
  })

  // An electronic address's scheme outside the CEF's EAS list fails
  // BR-CL-25, whose context is the URIID with a scheme wherever it stands,
  // and FeRD's own rule at each party's URIID, against its list 17: a
  // scheme report-spec took that either list dropped would write a file
  // every validator refuses, which no sample, using two schemes of five,
  // would show (0037).
  test('holds the address schemes to BR-CL-25 and to FeRD’s list at both parties’ electronic addresses', () => {
    const party = (role) =>
      `/rsm:CrossIndustryInvoice/rsm:SupplyChainTradeTransaction/ram:ApplicableHeaderTradeAgreement/ram:${role}/ram:URIUniversalCommunication/ram:URIID`
    const rules = ['SellerTradeParty', 'BuyerTradeParty'].map((role) =>
      ferdRule({ match: party(role), variable: 'codeValue17', select: '@schemeID', id: 'FX-SCH-A-0', test: fromCodedb('codeValue17', 17) }),
    )
    const given = {
      spec: { ADDRESS_SCHEMES: ['EM', '0204', '9930'], EN16931_RULES: [], XRECHNUNG_RULES: [], XRECHNUNG_PATTERNS: {}, ...NO_KIND },
      lists: CODE_LISTS.filter((entry) => entry.list === 'ADDRESS_SCHEMES'),
      cen: { name: 'CEN’s schematron', asserts: readSchematron(cen(cenRule('BR-CL-25', 'fatal', test_('0088 0204 EM', '@schemeID')))) },
      ferd: { name: 'FeRD’s schematron', asserts: readSchematron(ferd(...rules)), codedb: new Map([['17', ['EM', '0204']]]) },
      xrechnung: xrechnungOf(xrechnungSchematron({ rules: [] })),
    }
    expect(oracleProblems(given).problems).toEqual([
      'ADDRESS_SCHEMES (BT-34-1, BT-49-1): CEN’s schematron’s BR-CL-25 does not hold 9930',
      'ADDRESS_SCHEMES (BT-34-1, BT-49-1): FeRD’s schematron’s code list 17 does not hold 9930',
    ])
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
    expect(problems((given) => (given.xrechnung = xrechnungOf(xrechnungSchematron({ rules: ['BR-DE-28'] }))))).toEqual([
      'BR-DE-27 is no rule of XRechnung’s schematron',
    ])
    expect(problems((given) => (given.xrechnung.asserts.find((each) => each.id === 'BR-DE-27').test = 'string-length(ram:X) &gt; 2'))).toEqual([
      'XRechnung’s schematron’s BR-DE-27 reads no one variable, where report-spec holds its telephone shape to one',
    ])
    expect(problems((given) => given.xrechnung.variables.delete('XR-TELEPHONE-REGEX'))).toEqual([
      'XRechnung’s schematron’s BR-DE-27 reads $XR-TELEPHONE-REGEX, which it does not declare as a string',
    ])
    const both = `${TESTS['BR-DE-28']} or matches(ram:Y, $XR-TELEPHONE-REGEX)`
    expect(problems((given) => (given.xrechnung = xrechnungOf(xrechnungSchematron({ tests: { ...TESTS, 'BR-DE-28': both } }))))).toEqual([
      'XRechnung’s schematron’s BR-DE-28 reads no one variable, where report-spec holds its email shape to one',
    ])
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
    expect(problems((given) => (given.spec.XRECHNUNG_PATTERNS = { ...PATTERNS, fax: { rule: 'BR-DE-27', pattern: TELEPHONE } }))).toEqual([
      'report-spec holds a fax shape whose place in the XML the gate does not know',
    ])
  })

  // A variable's select is an XPath string literal, a quote written twice
  // within it; and a scenario's schematrons are read out of KoSIT's
  // scenarios.xml by the scenario's name, in its namespace.
  test('reads a variable as the string its select writes, and a scenario’s schematrons by its name', () => {
    expect(
      readVariables(
        `<xsl:transform ${NS}><xsl:variable name="A" select="'it''s'"/><xsl:variable name="B" select="concat('a, ', $A )"/><xsl:variable name="D" select="concat('a', $NOPE)"/><xsl:variable name="E" select="string($A)"/><xsl:template match="x"><xsl:variable name="C" select="'inner'"/></xsl:template></xsl:transform>`,
      ),
    ).toEqual(
      new Map([
        ['A', "it's"],
        ['B', "a, it's"],
        ['D', undefined],
        ['E', undefined],
      ]),
    )
    const scenarios = `<scenarios xmlns="http://www.xoev.de/de/validator/framework/1/scenarios"><scenario><name>EN16931 XRechnung (CII)</name><validateWithSchematron><resource><name>a</name><location>resources/cii.xsl</location></resource></validateWithSchematron><validateWithSchematron><resource><name>b</name><location>resources/xr.xsl</location></resource></validateWithSchematron></scenario><scenario><name>EN16931 (CII)</name><validateWithSchematron><resource><name>a</name><location>resources/cii.xsl</location></resource></validateWithSchematron></scenario></scenarios>`
    expect(scenarioSchematrons(scenarios, 'EN16931 XRechnung (CII)')).toEqual(['resources/cii.xsl', 'resources/xr.xsl'])
    expect(scenarioSchematrons(scenarios, 'EN16931 (CII)')).toEqual(['resources/cii.xsl'])
    expect(scenarioSchematrons(scenarios, 'XRechnung 4.0')).toEqual([])
  })
})

describe('what report-spec needs of an XRechnung, against XRechnung’s schematron', () => {
  // report-spec refuses an XRechnung without a term XRechnung needs, by
  // the rule that needs it (0038); that rule must be a fatal one of the
  // pinned schematron, and test that very term's element, at the place
  // the runtime writes it, as present. A rule KoSIT made a warning, moved
  // or rewrote would leave report-spec refusing for a rule that no longer
  // asks what it says, or another term needed than the one refused.
  test('holds each need to a fatal rule testing its element where the runtime writes it', () => {
    expect(problems()).toEqual([])
    const changed = (change) => (given) => {
      const kind = structuredClone(KIND_RULES)
      change(kind)
      given.xrechnung = xrechnungOf(xrechnungSchematron({ kind }))
    }
    expect(problems(changed((kind) => (kind['BR-DE-15'].flag = 'warning')))).toEqual([
      'XRechnung’s schematron’s BR-DE-15 is warning, where report-spec needs buyerReference by it as by a fatal rule',
      'XRechnung’s schematron’s BR-DE-15 is warning, where report-spec needs BT-10 by it as by a fatal rule',
    ])
    expect(problems(changed((kind) => (kind['BR-DE-15'].context = '/rsm:CrossIndustryInvoice/rsm:ExchangedDocument')))).toEqual([
      `XRechnung’s schematron’s BR-DE-15 holds /rsm:CrossIndustryInvoice/rsm:ExchangedDocument, where report-spec needs buyerReference at /rsm:CrossIndustryInvoice`,
      `XRechnung’s schematron’s BR-DE-15 holds /rsm:CrossIndustryInvoice/rsm:ExchangedDocument, where report-spec needs BT-10 at /rsm:CrossIndustryInvoice`,
    ])
    const other = 'rsm:SupplyChainTradeTransaction/ram:ApplicableHeaderTradeAgreement/ram:BuyerOrderReferencedDocument'
    expect(problems(changed((kind) => (kind['BR-DE-15'].test = other)))).toEqual([
      `XRechnung’s schematron’s BR-DE-15 tests '${other}', where report-spec needs buyerReference as '${XRECHNUNG_PLACES.buyerReference.test}'`,
      `XRechnung’s schematron’s BR-DE-15 tests '${other}', where report-spec needs BT-10 as '${XRECHNUNG_PLACES['BT-10'].test}'`,
    ])
    // White space the compiler wraps a test or a context in, as it wraps BR-DE-16's, is no difference.
    expect(
      problems(changed((kind) => (kind['BR-DE-15'] = { context: `\n  ${kind['BR-DE-15'].context} `, test: `\n          ${kind['BR-DE-15'].test}\n   ` }))),
    ).toEqual([])
    expect(problems((given) => (given.spec.XRECHNUNG_TEXT_NEEDS = { ...given.spec.XRECHNUNG_TEXT_NEEDS, 'BT-99': 'BR-DE-15' }))).toEqual([
      'report-spec needs BT-99 in an XRechnung, whose place in the XML the gate does not know',
    ])
    expect(problems(changed((kind) => delete kind['BR-DE-15']))).toEqual(['BR-DE-15 is no rule of XRechnung’s schematron'])
  })

  // The rules report-spec holds by the format name no refusal, so nothing
  // else would see one KoSIT renamed or dropped: each must be a rule of
  // the pinned schematron.
  test('holds each rule report-spec holds by the format to a rule of the schematron', () => {
    expect(problems((given) => (given.spec.XRECHNUNG_HELD = { ...given.spec.XRECHNUNG_HELD, 'BR-DE-99': 'nothing' }))).toEqual([
      'BR-DE-99, which report-spec holds by the format, is no rule of XRechnung’s schematron',
    ])
  })

  // A rule is held by the format for what it tests: BR-DE-16 takes a VAT
  // identifier or a tax number, BR-DE-23-b refuses a card or a mandate the
  // writer never writes. KoSIT rewriting a test -- BR-DE-16 taking the VAT
  // identifier alone, BR-DE-23-b refusing an element the writer does
  // write -- or moving a rule would leave the reason XRECHNUNG_HELD gives
  // read against a rule that is gone, the id still there, and the one
  // XRechnung sample need not break it. So each held rule's context and
  // test are pinned, white space aside, and a held id whose rule the gate
  // has not pinned is refused too. Its flag is none of what holds it.
  test('holds each rule report-spec holds by the format to the context and test its reason was read against', () => {
    const rate = XRECHNUNG_HELD_RULES['BR-DE-14']
    const held = (change) => (given) => {
      const kind = structuredClone(KIND_RULES)
      change(kind['BR-DE-14'])
      given.xrechnung = xrechnungOf(xrechnungSchematron({ kind }))
    }
    expect(problems(held((rule) => (rule.test = 'ram:CategoryCode')))).toEqual([
      `XRechnung’s schematron’s BR-DE-14 tests 'ram:CategoryCode', where report-spec holds it by the format as testing '${rate.test}'`,
    ])
    expect(problems(held((rule) => (rule.context = '/rsm:CrossIndustryInvoice')))).toEqual([
      `XRechnung’s schematron’s BR-DE-14 holds /rsm:CrossIndustryInvoice, where report-spec holds it by the format at ${rate.context}`,
    ])
    expect(
      problems(
        held((rule) => {
          rule.test = `\n      ${rule.test}\n   `
          rule.flag = 'warning'
        }),
      ),
    ).toEqual([])
    expect(problems((given) => (given.spec.XRECHNUNG_HELD = { ...given.spec.XRECHNUNG_HELD, 'BR-DE-15': 'the reference' }))).toEqual([
      'report-spec holds BR-DE-15 by the format, where the gate has pinned no test of it',
    ])
  })

  // report-spec refuses every line of the payment terms led by #, the
  // lines BR-DE-18 holds to XRechnung's Skonto syntax: a rule that read
  // another description, split the terms otherwise or read lines led by
  // something else would hold lines report-spec lets through.
  test('holds BR-DE-18 to reading the lines report-spec refuses a Skonto line in', () => {
    const reading =
      (test, context = XRECHNUNG_SKONTO.context) =>
      (given) =>
        (given.xrechnung = xrechnungOf(xrechnungSchematron({ kind: { ...KIND_RULES, 'BR-DE-18': { context, test } } })))
    const said = `XRechnung’s schematron’s BR-DE-18 reads other lines of the payment terms than report-spec refuses a Skonto line in: '${XRECHNUNG_SKONTO.lines} …' at ${XRECHNUNG_SKONTO.context}`
    expect(problems(reading(SKONTO_TEST.replace('Description[1]', 'Description[2]')))).toEqual([said])
    expect(problems(reading(SKONTO_TEST.replace("'#')", "'#SKONTO')")))).toEqual([said])
    expect(problems(reading(SKONTO_TEST.replace(String.raw`(\r?\n)`, ';')))).toEqual([said])
    expect(problems(reading(SKONTO_TEST, '/rsm:CrossIndustryInvoice/rsm:SupplyChainTradeTransaction'))).toEqual([said])
  })

  // The version report-spec writes is the schematron's, and its BT-24 the
  // schematron's XR-CIUS-ID as it builds it: an XRechnung of another
  // version, or a guideline KoSIT writes otherwise, is one KoSIT's
  // XRechnung scenario matches to nothing, or to another release's rules.
  test('holds each version report-spec writes, and its guideline, to the schematron’s', () => {
    expect(problems((given) => (given.spec.XRECHNUNG_VERSIONS = ['3.0', '4.0']))).toEqual([
      'report-spec writes XRechnung 4.0, where XRechnung’s schematron is of 3.0',
    ])
    expect(problems((given) => (given.spec.XRECHNUNG['3.0'].guideline = 'urn:cen.eu:en16931:2017'))).toEqual([
      `report-spec names XRechnung 3.0 'urn:cen.eu:en16931:2017', where XRechnung’s schematron’s XR-CIUS-ID is '${CIUS}'`,
    ])
    expect(problems((given) => (given.xrechnung = xrechnungOf(xrechnungSchematron({ versioned: VERSIONED.replace("'3.0'", "'3.1'") }))))).toEqual([
      'report-spec writes XRechnung 3.0, where XRechnung’s schematron is of 3.1',
    ])
  })

  // `XRECHNUNG` names the release each version was read from, which a host
  // may print or log. A configuration of 3.0.3 keeps BT-24 at
  // xrechnung_3.0, so the version and the guideline would pass it while
  // the release went on saying 3.0.2: it is held to the release the
  // register pins the configuration to.
  test('holds the release report-spec names each version by to the one the register pins', () => {
    expect(problems((given) => (given.xrechnung.release = '3.0.3'))).toEqual([
      'report-spec names XRechnung 3.0 by release 3.0.2, where the gate’s configuration is of XRechnung 3.0.3',
    ])
    expect(problems((given) => delete given.spec.XRECHNUNG['3.0'].release)).toEqual([
      'report-spec names XRechnung 3.0 by release undefined, where the gate’s configuration is of XRechnung 3.0.2',
    ])
  })
})
