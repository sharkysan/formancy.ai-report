/**
 * What KoSIT's XRechnung 3.0.2 asks of an e-invoice that report-spec holds
 * already, before XRechnung is a kind of its own (0037): the shapes of the
 * seller's contact telephone number (BT-42) and email address (BT-43),
 * each a warning of KoSIT's XRechnung scenario, BR-DE-27 and BR-DE-28,
 * which a file of either kind is held to so that none earns it.
 *
 * Each shape is the pinned schematron's own expression, written here as
 * its variable writes it -- `XR-TELEPHONE-REGEX` and `XR-EMAIL-REGEX` in
 * `resources/xrechnung/3.0.2/xsl/XRechnung-CII-validation.xsl` of KoSIT's
 * configuration of 2026-08-31, read on 20 October 2026 -- and read as
 * XPath 2.0 reads it (`xpathRegExp`), after `normalize-space`, as the
 * rule's test reads it. The e-invoice gate holds each string, and the test
 * that reads it, to that file, and each id of `XRECHNUNG_RULES` to a rule
 * of it, on every run. The telephone number's expression is not run as
 * written: its digits are counted, which is what it asks, in time in
 * proportion to the text's length (`telephoneBreak`).
 */

/**
 * Every rule of XRechnung's a refusal of report-spec names, and no other.
 * The gate reads this list; `en16931.test.ts` holds it to the ids the
 * rules say.
 */
export const XRECHNUNG_RULES = ['BR-DE-27', 'BR-DE-28'] as const
export type XRechnungRule = (typeof XRECHNUNG_RULES)[number]

/** What a rule of XRechnung's says, with its id: the one way a message names one, so that every id is a listed one. */
export function xrechnungRule(id: XRechnungRule, said: string): string {
  return `${said} (XRechnung's ${id})`
}

/** A shape XRechnung holds a term to: the rule that holds it, and its XPath regular expression as the pinned schematron writes it. */
export interface XRechnungPattern {
  readonly rule: XRechnungRule
  readonly pattern: string
}

/** The shapes, by what they shape. */
export const XRECHNUNG_PATTERNS: { readonly telephone: XRechnungPattern; readonly email: XRechnungPattern } = {
  telephone: { rule: 'BR-DE-27', pattern: '.*([0-9].*){3,}.*' },
  email: { rule: 'BR-DE-28', pattern: String.raw`^[^@\s]+@([^@.\s]+\.)+[^@.\s]+$` },
}

/** XPath's \s: a space, a tab, a line feed, a carriage return (XML Schema Part 2, F.1.1), and no other white space. */
const SPACE = String.raw` \t\n\r`

/** The escapes XPath and JavaScript read alike: a tab, a line feed, a carriage return, or a character XPath's syntax would otherwise read, written as itself; and in a class, a hyphen. */
const LITERAL = /^[nrt.\\?*+{}()[\]^$|]$/

/**
 * `pattern`, an XPath 2.0 regular expression, as a JavaScript one that
 * matches the very strings it matches, `matches()` being unanchored as
 * `test` is: `\s` as XPath's four characters, `.` outside a class as any
 * character but a line feed and a carriage return, and the rest as
 * written. An escape the two read otherwise -- `\d`, `\w`, a category,
 * XPath's own `\i` and `\c`, `\S` -- and a class subtracted, which
 * JavaScript has not, are refused rather than translated; so is what
 * JavaScript reads and XPath 2.0 refuses: a group that begins `(?`, an
 * escape XPath has not, `\/` among them, and a `[` inside a class. The
 * package does not export it: the two expressions here are what it reads.
 */
export function xpathRegExp(pattern: string): RegExp {
  const refused = (what: string): never => {
    throw new RangeError(`${what} is read otherwise by XPath than by JavaScript, and is not translated`)
  }
  let source = ''
  let inClass = false
  for (let at = 0; at < pattern.length; at += 1) {
    const character = pattern[at] as string
    if (character === '\\') {
      const escaped = pattern[at + 1] ?? ''
      at += 1
      if (escaped === 's') source += inClass ? SPACE : `[${SPACE}]`
      else if (LITERAL.test(escaped) || (inClass && escaped === '-')) source += `\\${escaped}`
      else refused(`the escape \\${escaped}`)
    } else if (inClass && character === '-' && pattern[at + 1] === '[') refused('a class subtracted')
    else if (character === '[') {
      if (inClass) refused('a [ inside a class')
      inClass = true
      source += character
    } else if (character === ']') {
      inClass = false
      source += character
    } else if (character === '(' && !inClass && pattern[at + 1] === '?') refused('a group that begins (?')
    else if (character === '.' && !inClass) source += String.raw`[^\n\r]`
    else source += character
  }
  return new RegExp(source, 'u')
}

/** `text` as XPath's `normalize-space` gives it: its runs of XPath's white space one space each, and none at either end. */
export function normalizeSpace(text: string): string {
  return text.replace(/[ \t\n\r]+/g, ' ').replace(/^ | $/g, '')
}

const EMAIL = xpathRegExp(XRECHNUNG_PATTERNS.email.pattern)

/**
 * The rule a contact's telephone number (BT-42) breaks, or undefined:
 * three ASCII digits at least, as BR-DE-27 reads one. Its expression,
 * `.*([0-9].*){3,}.*`, matches what `normalize-space` leaves of a text --
 * no line feed and no carriage return, the two characters XPath's `.`
 * does not match -- exactly where three of `[0-9]` stand in it, so the
 * digits are counted. Run as written by a backtracking engine it takes
 * time that grows with the square of the text's length, and a text may be
 * long; `xrechnung.test.ts` holds the count to the expression.
 */
export function telephoneBreak(text: string): string | undefined {
  let digits = 0
  for (let at = 0; at < text.length; at += 1) {
    const code = text.charCodeAt(at)
    if (code >= 0x30 && code <= 0x39 && (digits += 1) === 3) return undefined
  }
  return xrechnungRule('BR-DE-27', 'has fewer than three digits, which a telephone number has at least')
}

/** The rule a contact's email address (BT-43) breaks, or undefined: the shape BR-DE-28 reads an address in. */
export function emailBreak(text: string): string | undefined {
  return EMAIL.test(normalizeSpace(text))
    ? undefined
    : xrechnungRule('BR-DE-28', 'is not an email address of the shape XRechnung reads one in: no white space, one @ with something before it, and after it two names at least, each joined to the next by one dot')
}
