import { describe, expect, test } from 'vitest'
import { checkEInvoiceText } from './en16931-texts.js'
import { MAX_INLINES, MAX_TEXT_LENGTH } from './limits.js'
import { emailBreak, leitwegIdBreak, normalizeSpace, skontoBreak, telephoneBreak, XRECHNUNG_HELD, XRECHNUNG_NEEDS, XRECHNUNG_PATTERNS, XRECHNUNG_RULES, XRECHNUNG_TEXT_NEEDS, xpathRegExp } from './xrechnung.js'

/**
 * What report-spec holds of XRechnung past EN 16931 (0037, 0038): the two
 * shapes of a seller's contact, BR-DE-27 and BR-DE-28, each the pinned
 * schematron's own expression, as its variable writes it, which the
 * e-invoice gate holds to that file, read as XPath 2.0 reads it, and the
 * checks report-spec runs held to that reading; the rule ids a refusal
 * names and those held by the format; the lines of the payment terms
 * BR-DE-18 reads as Skonto lines; and a Leitweg-ID's shape and check
 * digits, held to KoSIT's own test values. Each long text is checked in
 * time that does not grow with the square of its length.
 */

/** Every text over `alphabet` of `length` characters or fewer, the empty one first. */
function textsOf(alphabet: readonly string[], length: number): string[] {
  let all = ['']
  let level = ['']
  for (let size = 1; size <= length; size += 1) {
    level = level.flatMap((text) => alphabet.map((character) => text + character))
    all = all.concat(level)
  }
  return all
}

describe("XRechnung's expressions, read as XPath reads them", () => {
  // The shapes are the pinned schematron's own expressions, as its
  // variables write them; the e-invoice gate holds these strings to that
  // file. What runs here is each read as XPath 2.0 reads it: \s is a
  // space, a tab, a line feed or a carriage return, never the other white
  // space JavaScript's is, and . is any character but a line feed or a
  // carriage return, U+2028 among them, which JavaScript's . is not.
  test('are the schematron’s, each read as XPath reads it', () => {
    expect(XRECHNUNG_PATTERNS).toEqual({ telephone: { rule: 'BR-DE-27', pattern: '.*([0-9].*){3,}.*' }, email: { rule: 'BR-DE-28', pattern: String.raw`^[^@\s]+@([^@.\s]+\.)+[^@.\s]+$` } })
    expect(xpathRegExp(XRECHNUNG_PATTERNS.email.pattern).source).toBe(String.raw`^[^@ \t\n\r]+@([^@. \t\n\r]+\.)+[^@. \t\n\r]+$`)
    expect(xpathRegExp(XRECHNUNG_PATTERNS.telephone.pattern).source).toBe(String.raw`[^\n\r]*([0-9][^\n\r]*){3,}[^\n\r]*`)
    expect(xpathRegExp(XRECHNUNG_PATTERNS.telephone.pattern).test('1 2 3')).toBe(true)
    // A no-break space is no white space to XPath's \s, and so a character an address may hold.
    expect(xpathRegExp(XRECHNUNG_PATTERNS.email.pattern).test('a b@c.d')).toBe(true)
    expect(xpathRegExp(String.raw`\s`).source).toBe(String.raw`[ \t\n\r]`)
    // A hyphen escaped in a class is the hyphen, as in both languages.
    expect(xpathRegExp(String.raw`[a\-z]`).test('-')).toBe(true)
  })

  // An escape whose meaning XPath and JavaScript part on -- \d and \w,
  // which XPath reads over all of Unicode, a category, XPath's own \i and
  // \c -- and a class subtracted, which JavaScript has not, would run as
  // another expression than the schematron's: refused, not translated. So
  // is what JavaScript reads and XPath 2.0 refuses: a group that begins
  // (?, a lookahead or a named or non-capturing group to JavaScript, an
  // escaped slash, and a [ inside a class.
  test('refuse what they would read otherwise than XPath', () => {
    // A hyphen escaped outside a class, and a backslash that ends the expression, are no escape JavaScript reads as XPath does.
    const otherwise = [String.raw`\d{3}`, String.raw`\w+`, String.raw`\p{L}`, String.raw`\i\c*`, '[a-z-[aeiou]]', String.raw`\S`, String.raw`a\-b`, 'a\\']
    const javascriptAlone = ['a(?=b)', 'a(?!b)', '(?:a)', '(?<n>a)', String.raw`a\/b`, '[a[b]']
    for (const pattern of [...otherwise, ...javascriptAlone]) expect(() => xpathRegExp(pattern), pattern).toThrow(/is read otherwise by XPath than by JavaScript/)
    // The same characters where both read them as themselves.
    for (const [pattern, text] of [['[(?]', '?'], [String.raw`\(\?`, '(?'], ['a/b', 'a/b'], [String.raw`[\[]`, '[']] as const) expect(xpathRegExp(pattern).test(text), pattern).toBe(true)
  })
})

describe("XRechnung's shapes, as report-spec checks them", () => {
  // BR-DE-27's expression, run as written by V8's backtracking engine,
  // takes time that grows with the square of a text's length: a text of
  // 64,000 characters with two digits at its middle took 20.9 s, four
  // times what 32,000 did, measured on 20 October 2026 from the built
  // package on Node 24.21.0 and an Intel i9-10900K. A template may hold
  // 640,000 in a text's literal runs, and its data more, and the validator
  // runs on every edit. So report-spec counts the digits instead, which is
  // what the expression asks of what normalize-space leaves -- no line
  // feed and no carriage return, the two characters XPath's . does not
  // match -- and holds the count to the expression on every text of a few
  // characters drawn from those that could part them: either end of [0-9]
  // and its neighbours, every white space normalize-space and \s read,
  // U+2028, and digits of other scripts, one beyond the Basic Plane.
  test('count a telephone number’s digits as the expression reads them, on every short text', () => {
    const expression = xpathRegExp(XRECHNUNG_PATTERNS.telephone.pattern)
    const parted = textsOf(['0', '9', '/', ':', ' ', '\t', '\n', '\r', ' ', '٣', '\u{1D7D1}'], 5).filter((text) => (telephoneBreak(text) === undefined) !== expression.test(normalizeSpace(text)))
    expect(parted).toEqual([])
    expect(telephoneBreak('1\n2\n3')).toBeUndefined()
    expect(telephoneBreak('1\u{1D7D1}2')).toBe("has fewer than three digits, which a telephone number has at least (XRechnung's BR-DE-27)")
  })

  // BR-DE-28 reads normalize-space of the address, as BR-DE-27 does the
  // number: white space at either end, which the XML's token never holds,
  // is no part of what the rule reads; white space inside it is.
  test('read an email address after normalize-space, as the rule reads it', () => {
    for (const text of [' a@b.c', 'a@b.c\n', '\t a@b.c \r']) expect(emailBreak(text), JSON.stringify(text)).toBeUndefined()
    for (const text of ['a @b.c', 'a@b\n.c']) expect(emailBreak(text), JSON.stringify(text)).toMatch(/\(XRechnung's BR-DE-28\)$/)
    expect(normalizeSpace(' \t a \n\r b  ')).toBe('a b')
  })

  // The longest text a template's literal runs may hold, MAX_INLINES runs
  // of MAX_TEXT_LENGTH characters, checked in time in proportion to its
  // length: a telephone number with two digits at its middle, which took
  // the expression run as written longest, and the email addresses that
  // make its expression try every split it can. The six took 73 to 76 ms
  // in three runs, measured as above; with the expression run as written,
  // a tenth of the length took 20.9 s and failed the bound.
  test('check the longest text a template may hold in time in proportion to its length', () => {
    const length = MAX_INLINES * MAX_TEXT_LENGTH
    const half = 'a'.repeat(length / 2 - 1)
    const started = Date.now()
    expect(checkEInvoiceText('BT-42', `${half}12${half}`)).toEqual({ ok: false, rule: "has fewer than three digits, which a telephone number has at least (XRechnung's BR-DE-27)" })
    for (const text of ['a'.repeat(length), `a@${'b'.repeat(length - 2)}`, `a@${'b.'.repeat(length / 2 - 1)}`, '@'.repeat(length), `a@b.c${'x'.repeat(length - 6)}@`]) {
      expect(checkEInvoiceText('BT-43', text).ok, `${text.slice(0, 8)}…`).toBe(false)
    }
    expect(Date.now() - started).toBeLessThan(2_000)
  })
})

describe("XRechnung's rules, as report-spec names them", () => {
  // Every rule of XRechnung's a refusal of report-spec names, which the
  // gate holds to a rule of the pinned XRechnung schematron (0037, 0038):
  // the terms it needs past EN 16931, the Skonto line BT-20 may not hold,
  // and the contact's two shapes. Pinned whole, so that one added or
  // dropped is a decision someone wrote down.
  test('are those a refusal names, each with what it needs', () => {
    expect(XRECHNUNG_RULES).toEqual(['BR-DE-1', 'BR-DE-2', 'BR-DE-5', 'BR-DE-6', 'BR-DE-7', 'BR-DE-15', 'BR-DE-18', 'BR-DE-27', 'BR-DE-28', 'PEPPOL-EN16931-R001', 'PEPPOL-EN16931-R010', 'PEPPOL-EN16931-R020'])
    expect(Object.fromEntries(Object.entries(XRECHNUNG_NEEDS).map(([at, need]) => [at, need.rule]))).toEqual({
      businessProcess: 'PEPPOL-EN16931-R001',
      buyerReference: 'BR-DE-15',
      payment: 'BR-DE-1',
      'seller/contact': 'BR-DE-2',
      'seller/electronicAddress': 'PEPPOL-EN16931-R020',
      'buyer/electronicAddress': 'PEPPOL-EN16931-R010',
    })
    expect(XRECHNUNG_TEXT_NEEDS).toEqual({ 'BT-10': 'BR-DE-15', 'BT-23': 'PEPPOL-EN16931-R001', 'BT-34': 'PEPPOL-EN16931-R020', 'BT-41': 'BR-DE-5', 'BT-42': 'BR-DE-6', 'BT-43': 'BR-DE-7', 'BT-49': 'PEPPOL-EN16931-R010' })
    const named = new Set<string>([...Object.values(XRECHNUNG_NEEDS).map((need) => need.rule), ...Object.values(XRECHNUNG_TEXT_NEEDS), 'BR-DE-18', XRECHNUNG_PATTERNS.telephone.rule, XRECHNUNG_PATTERNS.email.rule])
    expect([...named].sort()).toEqual([...XRECHNUNG_RULES].sort())
  })

  // The rules of XRechnung's the plan names that no refusal of report-spec
  // can name, since nothing the format can say breaks them: each is held
  // by another rule or by what the format and the writer leave out, and
  // the gate holds each id to a rule of the schematron too, and its
  // context and test to the ones the reason was read against, so that one
  // KoSIT renames, drops or rewrites is seen. A rule in both lists would
  // be held twice, and said by a refusal it is not in.
  test('held by the format, each with what holds it, and none of them refused', () => {
    expect(Object.keys(XRECHNUNG_HELD)).toEqual(['BR-DE-3', 'BR-DE-4', 'BR-DE-8', 'BR-DE-9', 'BR-DE-14', 'BR-DE-16', 'BR-DE-17', 'BR-DE-19', 'BR-DE-21', 'BR-DE-23-a', 'BR-DE-23-b'])
    for (const [id, held] of Object.entries(XRECHNUNG_HELD)) {
      expect(XRECHNUNG_RULES as readonly string[], id).not.toContain(id)
      expect(held.length, id).toBeGreaterThan(20)
    }
  })
})

describe('a Skonto line in the payment terms', () => {
  // BR-DE-18 reads the lines of BT-20 that `tokenize(. , '(\r?\n)')`
  // splits it into and whose normalize-space begins with #, each held to
  // XRechnung's Skonto syntax. This release writes no Skonto (0038, Q4),
  // so every such line is refused, a well-formed one too: what BR-DE-18
  // refuses is a part of it. The reading -- a line ends at a line feed, a
  // carriage return before it goes with it, and white space XPath's
  // normalize-space drops may stand before the # -- is held to a reading
  // of the expression on every short text over characters that part
  // them, a no-break space and a lone carriage return among them.
  test('is any line that begins with #, as BR-DE-18 reads lines', () => {
    const read = (text: string): boolean => text.split(/\r?\n/).some((line) => normalizeSpace(line).startsWith('#'))
    const parted = textsOf(['#', 'a', ' ', '\t', '\r', '\n', ' '], 5).filter((text) => (skontoBreak(text) !== undefined) !== read(text))
    expect(parted).toEqual([])
    expect(skontoBreak('a\r#b')).toBeUndefined()
    expect(skontoBreak('a\n\r#b')).toBe("hold a line that begins with #, which XRechnung reads as a Skonto line of its own syntax, and this release writes none: a discount is said in words (XRechnung's BR-DE-18)")
  })

  // The terms are a text a template may hold 640,000 characters of: the
  // lines are found in one pass, never by an expression that backtracks.
  test('is found in time in proportion to the text’s length', () => {
    const length = MAX_INLINES * MAX_TEXT_LENGTH
    const started = Date.now()
    for (const text of [' '.repeat(length), `${' \t'.repeat(length / 2 - 1)}#`, '\n'.repeat(length), `${'a\n'.repeat(length / 2 - 1)} #`]) expect(skontoBreak(text) === undefined, `${JSON.stringify(text.slice(0, 6))}…`).toBe(!text.includes('#'))
    expect(Date.now() - started).toBeLessThan(2_000)
  })
})

describe('a Leitweg-ID', () => {
  // An address under 0204 of wrong check digits routes an invoice nowhere,
  // and neither validator the gate runs refuses it. Held here to KoSIT's
  // own test values, the XRechnung 3.0.2 test suite of 2026-08-31
  // (`instances/` of `xrechnung-3.0.2-testsuite-2026-08-31.zip`, SHA-256
  // 1e81ef75…3d7, read on 21 October 2026): every Leitweg-ID its CII and
  // UBL instances give as a buyer's reference or an address under 0204, the
  // word `Leitweg-ID`, which 04.05a gives as its buyer's reference, aside.
  // All but three have the check digits ISO/IEC 7064 MOD 97-10 gives; the
  // three -- 99000000-01944-98 and 99000000-05676-98 (01.06a and 01.07a,
  // in both syntaxes) and 04011000-12345-34 (05.01a, in UBL) -- are refused,
  // where KoSIT's validator takes them, since BR-DE-15 asks only that BT-10
  // be there; a portal that checks the digits would refuse them too. The
  // lower-case 991-33333test-33, and the last two refused, are this test's
  // own: letters in either case, and a digit changed.
  test('has the check digits ISO/IEC 7064 MOD 97-10 gives, as KoSIT’s test values do', () => {
    const suite = ['04011000-12345-03', '04011000-12346-97', '04011000-12347-94', '04011000-12348-91', '04011000-12349-88', '04011000-12350-85', '04011000-12352-79', '04011000-12353-76', '04011000-12354-73', '11002002-98765-14', '12345678-12345-83', '1234567890-54321-40', '90000000-03083-72', '99000000-18188-18', '991-33333TEST-33', '992-90009-96']
    for (const id of [...suite, '991-33333test-33']) expect(leitwegIdBreak(id), id).toBeUndefined()
    for (const id of ['99000000-01944-98', '99000000-05676-98', '04011000-12345-34', '991-33333TEST-34', '04011000-12345-02']) {
      expect(leitwegIdBreak(id), id).toBe("is under 0204, a Leitweg-ID, and has check digits that do not match the rest of it (the Leitweg-ID's check digits, ISO/IEC 7064 MOD 97-10)")
    }
    // MOD 97-10 writes 02 to 98: 00 for 97, which leaves the same remainder, is the check digits written otherwise, and refused.
    expect(checkDigits('0401100012346')).toBe('97')
    expect(leitwegIdBreak('04011000-12346-00')).toMatch(/check digits that do not match/)
  })

  // An address under 0204 that is not shaped as a Leitweg-ID is none, and
  // would route an invoice nowhere: a coarse address of 2 to 12 digits, a
  // fine address of 1 to 30 letters and digits if any, and two check
  // digits, joined by hyphens, as the format specification is described
  // where it could not be read (0038). Each text below breaks one part --
  // a coarse address too short or too long, a fine address empty, too long
  // or of another character, one check digit, another separator or none, a
  // hyphen at either end, a digit or a letter outside ASCII, nothing --
  // and the longest of each part is taken.
  test('is shaped as a coarse address, a fine address if any, and two check digits', () => {
    const shape = 'is under 0204, a Leitweg-ID, and is not shaped as one: a coarse address of 2 to 12 digits, a fine address of up to 30 letters and digits where it has one, and two check digits, joined by hyphens'
    for (const id of ['9-12345-73', '1234567890123-12345-40', `991-${'A'.repeat(31)}-00`, '991-3333_TEST-33', '991-33333TEST-3', '991 33333TEST 33', '99133333TEST33', '991--33', '-991-33', '991-33333TEST-33-', 'Ⅸ91-33333TEST-33', '991-33333TÉST-33', '']) {
      expect(leitwegIdBreak(id), id).toBe(shape)
    }
    // A fine address of 30 and a coarse address of 12 are each the most it has.
    expect(leitwegIdBreak(`991-${'A'.repeat(30)}-${checkDigits(`991${'A'.repeat(30)}`)}`)).toBeUndefined()
    expect(leitwegIdBreak(`123456789012-${checkDigits('123456789012')}`)).toBeUndefined()
  })

  // An address a template's runs may hold is long, and the validator runs
  // on every edit: an expression that backtracked over its length would
  // stall it. The longest text a template's literal runs may hold, of
  // digits, of one fine address and of hyphens, is refused within 2 s.
  test('is checked in time that does not grow with the text’s length', () => {
    const length = MAX_INLINES * MAX_TEXT_LENGTH
    const started = Date.now()
    for (const text of ['9'.repeat(length), `991-${'A'.repeat(length - 7)}-33`, '-'.repeat(length)]) expect(leitwegIdBreak(text)).toMatch(/is not shaped as one/)
    expect(Date.now() - started).toBeLessThan(2_000)
  })
})

/** The check digits ISO/IEC 7064 MOD 97-10 gives `body`, computed in the test from its definition, by BigInt: 98 less the remainder of the body, each letter its two digits, times 100. */
function checkDigits(body: string): string {
  const digits = [...body.toUpperCase()].map((character) => (/[0-9]/.test(character) ? character : String(character.charCodeAt(0) - 55))).join('')
  return String(98n - ((BigInt(digits) * 100n) % 97n)).padStart(2, '0')
}
