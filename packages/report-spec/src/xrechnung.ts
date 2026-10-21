/**
 * What KoSIT's XRechnung 3.0.2 asks of an e-invoice past EN 16931, as
 * report-spec holds it: of either kind, the shapes of the seller's contact
 * telephone number (BT-42) and email address (BT-43), each a warning of
 * KoSIT's XRechnung scenario, BR-DE-27 and BR-DE-28, which a file of either
 * kind is held to so that none earns it (0037); of an XRechnung (0038), the
 * terms its schematron needs that EN 16931 lets an invoice leave out
 * (`XRECHNUNG_NEEDS`, `XRECHNUNG_TEXT_NEEDS`) and the payment terms that
 * hold no Skonto line (`skontoBreak`, BR-DE-18); and of an electronic
 * address under 0204 in either, the Leitweg-ID's shape and check digits
 * (`leitwegIdBreak`), which no rule of XRechnung's checks. The rules the
 * plan names that nothing the format can say breaks are listed apart, with
 * what holds each (`XRECHNUNG_HELD`).
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

import type { EInvoiceTextTerm } from './en16931-texts.js'
import { mod97 } from './payment-reference.js'

/**
 * Every rule of XRechnung's a refusal of report-spec names, and no other:
 * Peppol's three that KoSIT's XRechnung schematron runs among them. The
 * gate reads this list and holds each id to a rule of the pinned XRechnung
 * schematron; `en16931.test.ts` and `xrechnung.test.ts` hold it to the ids
 * the rules say.
 */
export const XRECHNUNG_RULES = [
  'BR-DE-1',
  'BR-DE-2',
  'BR-DE-5',
  'BR-DE-6',
  'BR-DE-7',
  'BR-DE-15',
  'BR-DE-18',
  'BR-DE-27',
  'BR-DE-28',
  'PEPPOL-EN16931-R001',
  'PEPPOL-EN16931-R010',
  'PEPPOL-EN16931-R020',
] as const
export type XRechnungRule = (typeof XRECHNUNG_RULES)[number]

/** A rule of XRechnung's that needs a term, and what a refusal says of the term when it is not given. */
export interface XRechnungNeed {
  readonly rule: XRechnungRule
  readonly said: string
}

/**
 * What an XRechnung needs that EN 16931 lets an invoice leave out, by the
 * place it stands in under the e-invoice, each fatal in the pinned
 * XRechnung schematron: the validator refuses an XRechnung without it,
 * where it is missing. The gate holds each rule's test to the element the
 * runtime writes the term as.
 */
export const XRECHNUNG_NEEDS = {
  businessProcess: { rule: 'PEPPOL-EN16931-R001', said: 'the business process (BT-23) is not given, and an XRechnung needs it' },
  buyerReference: { rule: 'BR-DE-15', said: "the buyer's reference (BT-10), a public buyer's Leitweg-ID, is not given, and an XRechnung needs it" },
  payment: { rule: 'BR-DE-1', said: 'the payment instructions (BG-16) are not given, and an XRechnung needs them' },
  'seller/contact': { rule: 'BR-DE-2', said: "the seller's contact (BG-6) is not given, and an XRechnung needs it" },
  'seller/electronicAddress': { rule: 'PEPPOL-EN16931-R020', said: "the seller's electronic address (BT-34) is not given, and an XRechnung needs it" },
  'buyer/electronicAddress': { rule: 'PEPPOL-EN16931-R010', said: "the buyer's electronic address (BT-49) is not given, and an XRechnung needs it" },
} as const satisfies { readonly [at: string]: XRechnungNeed }

/**
 * The texts an XRechnung needs to say something, by business term, and the
 * rule of XRechnung's that needs each: those of `XRECHNUNG_NEEDS`, and the
 * contact's three, which BR-DE-5 to -7 read through normalize-space. An
 * XRechnung's texts are EN 16931's with these needed
 * (`E_INVOICE_KIND_TEXTS`), so that a blank one is refused by its rule, a
 * literal where it is written and one from data at the render.
 */
export const XRECHNUNG_TEXT_NEEDS = {
  'BT-10': 'BR-DE-15',
  'BT-23': 'PEPPOL-EN16931-R001',
  'BT-34': 'PEPPOL-EN16931-R020',
  'BT-41': 'BR-DE-5',
  'BT-42': 'BR-DE-6',
  'BT-43': 'BR-DE-7',
  'BT-49': 'PEPPOL-EN16931-R010',
} as const satisfies { readonly [T in EInvoiceTextTerm]?: XRechnungRule }

/**
 * The rules of XRechnung's the plan for 0.3.0 names, or that hold the terms
 * it does, that nothing the format can say breaks, so that no refusal of
 * report-spec names them: each is held by another rule or by what the
 * format and the writer leave out, as said. The gate holds each id to a
 * rule of the pinned XRechnung schematron, and the rule's context and test,
 * white space aside, to the ones the reason was read against
 * (`XRECHNUNG_HELD_RULES` in `scripts/e-invoice/oracle.mjs`), so that a
 * rule KoSIT renames, drops or rewrites is seen; that each holds of a file
 * is the XRechnung sample's, which KoSIT's XRechnung scenario judges.
 */
export const XRECHNUNG_HELD: { readonly [id: string]: string } = {
  'BR-DE-3': "the seller's city: the UStG's full address needs it in every e-invoice (`FULL_ADDRESS`)",
  'BR-DE-4': "the seller's post code: the UStG's full address needs it in every e-invoice (`FULL_ADDRESS`)",
  'BR-DE-8': "the buyer's city: the UStG's full address needs it in every e-invoice (`FULL_ADDRESS`)",
  'BR-DE-9': "the buyer's post code: the UStG's full address needs it in every e-invoice (`FULL_ADDRESS`)",
  'BR-DE-14': 'the VAT category rate: every category declares its rate, and the writer writes it, by value, in each breakdown',
  'BR-DE-16': "the seller's VAT identifier or tax number where a line is in S, E or AE: BR-S-02, BR-E-02 and BR-AE-02 ask the same of the three categories this release writes, and it writes no tax representative",
  'BR-DE-17': 'the invoice type: 380, the one code `INVOICE_TYPE_CODES` holds, is of the codes it lists',
  'BR-DE-19': "the IBAN of a SEPA credit transfer: the payment account is the EPC QR code's account rule, check digits and all (`checkEpcIban`)",
  'BR-DE-21': "BT-24: the writer writes the version's `XRECHNUNG` guideline, KoSIT's `XR-CIUS-ID`",
  'BR-DE-23-a': "the payee's account (BG-17) of a credit transfer, 58 or 30: payment instructions need the account (BR-61), and the writer writes it",
  'BR-DE-23-b': 'no card (BG-18) and no direct debit (BG-19) beside a credit transfer: the format writes neither',
}

/** What a rule of XRechnung's says, with its id: the one way a message names one, so that every id is a listed one. */
export function xrechnungRule(id: XRechnungRule, said: string): string {
  return `${said} (XRechnung's ${id})`
}

/** Whether a rule id is one of XRechnung's, rather than CEN's or the UStG's. */
export function isXRechnungRule(id: string): id is XRechnungRule {
  return (XRECHNUNG_RULES as readonly string[]).includes(id)
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

/** What BR-DE-18 says of a line led by #, as a refusal says it. */
const SKONTO = xrechnungRule('BR-DE-18', 'hold a line that begins with #, which XRechnung reads as a Skonto line of its own syntax, and this release writes none: a discount is said in words')

/**
 * The rule an XRechnung's payment terms (BT-20) break, or undefined: no
 * line led by # (0038, Q4). BR-DE-18 reads every line of the terms --
 * `tokenize(. , '(\r?\n)')`, so a line ends at a line feed, a carriage
 * return before it going with it -- whose `normalize-space` begins with #,
 * as a Skonto line of XRechnung's own syntax, fatal where it is not one;
 * this release writes no Skonto, and refuses every such line, a
 * well-formed one too. The white space normalize-space drops before the #
 * is XPath's four characters. Found in one pass over the text.
 */
export function skontoBreak(text: string): string | undefined {
  let lineStart = true
  for (let at = 0; at < text.length; at += 1) {
    const character = text[at]
    if (character === '\n') lineStart = true
    else if (lineStart && character === '#') return SKONTO
    else if (character !== ' ' && character !== '\t' && character !== '\r') lineStart = false
  }
  return undefined
}

/**
 * A Leitweg-ID's parts: a coarse address of 2 to 12 digits, a fine address
 * of 1 to 30 letters and digits where it has one, and two check digits,
 * joined by hyphens. Anchored at both ends, every repeat bounded, it
 * matches no text past the longest Leitweg-ID's 46 characters, and decides
 * a text of any length within its first 46: no backtracking grows with an
 * address's length.
 */
const LEITWEG_ID = /^([0-9]{2,12})(?:-([0-9A-Za-z]{1,30}))?-([0-9]{2})$/

/** What an address under 0204 breaks by its shape, as a refusal says it. */
const LEITWEG_SHAPE = 'is under 0204, a Leitweg-ID, and is not shaped as one: a coarse address of 2 to 12 digits, a fine address of up to 30 letters and digits where it has one, and two check digits, joined by hyphens'

/**
 * The rule an electronic address under scheme 0204 breaks as a Leitweg-ID,
 * or undefined (0038, Q3): its shape, and check digits that are 98 less
 * the remainder modulo 97 of its coarse and fine addresses with 00 after
 * them, each letter, in either case, the two digits ISO/IEC 7064 gives it
 * (MOD 97-10, as an IBAN's). The format specification itself, KoSIT's
 * Leitweg-ID-Formatspezifikation 2.0.2, could not be read here; the shape
 * and the computation are as FeRD's data sheet describes them, and every
 * Leitweg-ID of KoSIT's XRechnung 3.0.2 test suite with right digits
 * passes it, and every one with wrong digits is refused
 * (`xrechnung.test.ts`). No rule of XRechnung's or CEN's checks one, so
 * this names none.
 */
export function leitwegIdBreak(text: string): string | undefined {
  const parts = LEITWEG_ID.exec(text)
  if (parts === null) return LEITWEG_SHAPE
  const [, coarse = '', fine = '', check] = parts
  const digits = String(98 - mod97(`${coarse}${fine}00`)).padStart(2, '0')
  return digits === check ? undefined : "is under 0204, a Leitweg-ID, and has check digits that do not match the rest of it (the Leitweg-ID's check digits, ISO/IEC 7064 MOD 97-10)"
}
