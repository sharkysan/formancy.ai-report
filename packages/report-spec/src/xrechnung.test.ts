import { describe, expect, test } from 'vitest'
import { checkEInvoiceText } from './en16931-texts.js'
import { MAX_INLINES, MAX_TEXT_LENGTH } from './limits.js'
import { emailBreak, normalizeSpace, telephoneBreak, XRECHNUNG_PATTERNS, XRECHNUNG_RULES, xpathRegExp } from './xrechnung.js'

/**
 * XRechnung's two shapes of a seller's contact, BR-DE-27 and BR-DE-28
 * (0037): each the pinned schematron's own expression, as its variable
 * writes it, which the e-invoice gate holds to that file; the expression
 * read as XPath 2.0 reads it; and the checks report-spec runs, held to that
 * reading.
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
    expect(XRECHNUNG_RULES).toEqual(['BR-DE-27', 'BR-DE-28'])
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
