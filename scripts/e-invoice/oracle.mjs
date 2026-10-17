// report-spec's closed code lists and the EN 16931 rule ids its refusals
// name, held to the schematrons the pinned tools run (0027): what makes the
// tools an oracle for more than the samples.
//
// - **CEN's**, CEN/TC 434's EN 16931 CII schematron as KoSIT's XRechnung
//   configuration carries it, compiled by SchXslt: each rule an assert with
//   its `id` and `flag`, a code-list rule's codes one string in its test,
//   `contains(' C62 H87 ... ', concat(' ', normalize-space(@unitCode), ' '))`.
//   Read at the location KoSIT's own reports name for the scenario the
//   samples matched.
// - **FeRD's**, the Factur-X 1.09.2 EN 16931 schematron Mustang runs,
//   compiled by ph-schematron, read at the path Mustang's log says it
//   compiled: CEN's rules under CEN's ids, but its code lists rules of its
//   own (`FX-SCH-A-…`), one per element, each checking a variable against a
//   list of its code database, `FACTUR-X_EN16931_codedb.xml`, beside it.
//
// What is held:
//
// - every code of every list report-spec writes is in the list of each
//   rule CEN names for it, and in the database list FeRD checks it against
//   at each place the runtime writes it (`CODE_LISTS`), so a code
//   report-spec takes and a validator refuses fails here, though no sample
//   uses it;
// - every id of report-spec's EN16931_RULES is a fatal rule of CEN's, and,
//   but for the BR-CL ids FeRD writes as its own, of FeRD's, so no refusal
//   names a rule that is gone or only warns.
//
// Pure over the schematrons' text; the command reads them out of the
// verified downloads.

import { attribute, childrenOf, descendants, descendantsWithAncestors, readXml, textOf } from './xml.mjs'

const XSL = 'http://www.w3.org/1999/XSL/Transform'
const SVRL = 'http://purl.oclc.org/dsdl/svrl'

const INVOICE = '/rsm:CrossIndustryInvoice'
const TRANSACTION = `${INVOICE}/rsm:SupplyChainTradeTransaction`
const AGREEMENT = `${TRANSACTION}/ram:ApplicableHeaderTradeAgreement`
const SETTLEMENT = `${TRANSACTION}/ram:ApplicableHeaderTradeSettlement`
const LINE = `${TRANSACTION}/ram:IncludedSupplyChainTradeLineItem`
const PARTIES = ['ram:SellerTradeParty', 'ram:BuyerTradeParty']

/**
 * Every code list report-spec writes a code from, by its export's name and
 * the business term it codes: the rules CEN names for it, and the places
 * the runtime writes it (packages/report-runtime/src/cii.ts and
 * cii-parties.ts), where FeRD checks each against a list of its own -- or,
 * for the VAT prefix, the rule FeRD keeps under CEN's id.
 */
export const CODE_LISTS = [
  { list: 'UNIT_CODES', term: 'BT-130', cen: ['BR-CL-23'], ferd: [{ path: `${LINE}/ram:SpecifiedLineTradeDelivery/ram:BilledQuantity`, select: '@unitCode' }] },
  { list: 'COUNTRY_CODES', term: 'BT-40, BT-55', cen: ['BR-CL-14'], ferd: PARTIES.map((party) => ({ path: `${AGREEMENT}/${party}/ram:PostalTradeAddress/ram:CountryID`, select: '.' })) },
  { list: 'VAT_PREFIXES', term: 'BT-31, BT-48', cen: ['BR-CO-09'], ferd: [{ rule: 'BR-CO-09' }] },
  { list: 'SCHEME_IDS', term: 'BT-30-1, BT-47-1', cen: ['BR-CL-11'], ferd: PARTIES.map((party) => ({ path: `${AGREEMENT}/${party}/ram:SpecifiedLegalOrganization/ram:ID`, select: '@schemeID' })) },
  {
    list: 'VAT_CATEGORY_CODES',
    term: 'BT-118, BT-151',
    cen: ['BR-CL-18'],
    ferd: [
      { path: `${SETTLEMENT}/ram:ApplicableTradeTax/ram:CategoryCode`, select: '.' },
      { path: `${LINE}/ram:SpecifiedLineTradeSettlement/ram:ApplicableTradeTax/ram:CategoryCode`, select: '.' },
    ],
  },
  { list: 'PAYMENT_MEANS_CODES', term: 'BT-81', cen: ['BR-CL-16'], ferd: [{ path: `${SETTLEMENT}/ram:SpecifiedTradeSettlementPaymentMeans/ram:TypeCode`, select: '.' }] },
  {
    list: 'E_INVOICE_CURRENCIES',
    term: 'BT-5',
    cen: ['BR-CL-04', 'BR-CL-03'],
    ferd: [
      { path: `${SETTLEMENT}/ram:InvoiceCurrencyCode`, select: '.' },
      { path: `${SETTLEMENT}/ram:SpecifiedTradeSettlementHeaderMonetarySummation/ram:TaxTotalAmount[@currencyID=../../ram:InvoiceCurrencyCode]`, select: '@currencyID' },
    ],
  },
  { list: 'INVOICE_TYPE_CODES', term: 'BT-3', cen: ['BR-CL-01'], ferd: [{ path: `${INVOICE}/rsm:ExchangedDocument/ram:TypeCode`, select: '.' }] },
]

/** An assert's property, as an attribute of it (SchXslt's id and flag, ph-schematron's test) or an `xsl:attribute` child (the others). */
function property(assert, name) {
  return attribute(assert, name) ?? textOf(childrenOf(assert, XSL, 'attribute').find((child) => attribute(child, 'name') === name))
}

/**
 * Every assert of a compiled schematron: `{ id, flag, test, context,
 * variables }`, `context` the match of the template it is in, and
 * `variables` that template's, by name to their `select`.
 */
export function readSchematron(text) {
  return descendantsWithAncestors(readXml(text), SVRL, 'failed-assert').map(({ element, ancestors }) => {
    const template = ancestors.findLast((above) => above.uri === XSL && above.local === 'template')
    const variables = Object.fromEntries((template === undefined ? [] : descendants(template, XSL, 'variable')).map((variable) => [attribute(variable, 'name'), attribute(variable, 'select')]))
    return { id: property(element, 'id'), flag: property(element, 'flag'), test: property(element, 'test'), context: attribute(template, 'match'), variables }
  })
}

/** The codes of a code-list test: the space-separated list CEN's generator writes as one string, or undefined. */
export function codeList(test) {
  const found = /contains\(\s*'( [^']* )'\s*,\s*concat\(\s*' '/.exec(String(test))?.[1]
  return found === undefined ? undefined : found.trim().split(/\s+/)
}

/** FeRD's code database: list id to its codes. */
export function readCodedb(text) {
  return new Map(childrenOf(readXml(text), '', 'cl').map((list) => [attribute(list, 'id'), childrenOf(list, '', 'enumeration').map((entry) => attribute(entry, 'value'))]))
}

/** The ids of the database lists FeRD checks `select` against where its context is `path`. */
export function codeListAt(asserts, { path, select }) {
  const ids = new Set()
  for (const assert of asserts) {
    if (assert.context !== path) continue
    for (const [name, selected] of Object.entries(assert.variables)) {
      if (selected !== select) continue
      for (const [, id] of String(assert.test).matchAll(new RegExp(String.raw`cl\[@id=(\d+)\]/enumeration\[@value=\$${name}\]`, 'g'))) ids.add(id)
    }
  }
  return [...ids]
}

/** What is wrong with one list against the rules of `schematron` named `ids`, as phrases. */
function ruleListProblems(codes, ids, schematron) {
  return ids.flatMap((id) => {
    const asserts = schematron.asserts.filter((assert) => assert.id === id)
    if (asserts.length === 0) return [`${schematron.name} has no rule ${id}`]
    return asserts.flatMap((assert) => {
      const held = codeList(assert.test)
      if (held === undefined) return [`${schematron.name}’s ${id} has no code list the gate can read`]
      const missing = codes.filter((code) => !held.includes(code))
      return missing.length === 0 ? [] : [`${schematron.name}’s ${id} does not hold ${missing.join(', ')}`]
    })
  })
}

/** What is wrong with one list against FeRD's database at each place, as phrases, and the lists it was checked against. */
function ferdListProblems(codes, places, ferd) {
  const problems = []
  const checked = []
  for (const place of places) {
    if (place.rule !== undefined) {
      problems.push(...ruleListProblems(codes, [place.rule], ferd))
      checked.push(place.rule)
      continue
    }
    const ids = codeListAt(ferd.asserts, place)
    if (ids.length !== 1) {
      problems.push(`${ferd.name} checks ${place.select} at ${place.path} against ${ids.length === 0 ? 'no code list' : `code lists ${ids.join(' and ')}, where it is one`}`)
      continue
    }
    const held = ferd.codedb.get(ids[0])
    if (held === undefined) problems.push(`${ferd.name}’s code database has no list ${ids[0]}`)
    else {
      const missing = codes.filter((code) => !held.includes(code))
      if (missing.length > 0) problems.push(`${ferd.name}’s code list ${ids[0]} does not hold ${missing.join(', ')}`)
    }
    checked.push(ids[0])
  }
  // Two places checked against one list lack the same codes: said once.
  return { problems: [...new Set(problems)], checked: [...new Set(checked)] }
}

/** Whether `id` is a rule of `asserts` that refuses a file: SchXslt flags CEN's fatal; Mustang reads any flag but warning and information as an error. */
const fatalIn = (asserts, id, kind) => asserts.some((assert) => assert.id === id && (kind === 'cen' ? assert.flag === 'fatal' : !['warning', 'information'].includes(assert.flag)))

/**
 * The verdict: `{ checked, problems }`.
 *
 * - `spec`: report-spec as built, its lists by their export's name and EN16931_RULES;
 * - `lists`: the rows of CODE_LISTS to check;
 * - `cen`: `{ name, asserts }` of CEN's schematron;
 * - `ferd`: `{ name, asserts, codedb }` of FeRD's.
 */
export function oracleProblems({ spec, lists, cen, ferd }) {
  const problems = []
  const checkedLists = []
  for (const row of lists) {
    const codes = spec[row.list]
    const say = (problem) => `${row.list} (${row.term}): ${problem}`
    if (!Array.isArray(codes) || codes.length === 0) {
      problems.push(say('report-spec exports no such list'))
      continue
    }
    problems.push(...ruleListProblems(codes, row.cen, cen).map(say))
    const atFerd = ferdListProblems(codes, row.ferd, ferd)
    problems.push(...atFerd.problems.map(say))
    checkedLists.push({ list: row.list, term: row.term, codes: codes.length, cen: [...row.cen], ferd: atFerd.checked })
  }
  const ferdRules = spec.EN16931_RULES.filter((id) => !id.startsWith('BR-CL-'))
  for (const id of spec.EN16931_RULES) if (!fatalIn(cen.asserts, id, 'cen')) problems.push(`${id} is no fatal rule of ${cen.name}`)
  for (const id of ferdRules) if (!fatalIn(ferd.asserts, id, 'ferd')) problems.push(`${id} is no fatal rule of ${ferd.name}`)
  return { checked: { lists: checkedLists, rules: { cen: [...spec.EN16931_RULES], ferd: ferdRules } }, problems }
}
