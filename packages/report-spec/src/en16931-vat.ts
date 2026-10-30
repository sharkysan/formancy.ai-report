/**
 * VAT: the identifiers a category's lines need of the seller and the
 * buyer, the rate and the exemption reason each category takes, the
 * breakdowns a list of categories makes, and the category a line names.
 */
import type { VatCategory, VatCategoryCode } from './e-invoice.js'
import { en16931Rule } from './en16931.js'
import type { En16931Rule } from './en16931.js'
import { no, ok } from './payment-reference.js'
import type { PaymentCheck } from './payment-reference.js'

/** The rules of the seller's identifiers each VAT category's lines need, in the order the categories are listed. */
const SELLER_VAT_RULES: { readonly [C in VatCategoryCode]: En16931Rule } = { S: 'BR-S-02', E: 'BR-E-02', AE: 'BR-AE-02' }

/**
 * The rules the seller's identifiers break, `has` saying which it holds,
 * for an invoice whose lines are in categories of `codes`:
 * - BR-CO-26: a buyer identifies a seller by its VAT identifier or its
 *   legal registration (BT-29, the third way, this version does not write);
 * - BR-S-02, BR-E-02, BR-AE-02: a line in any of the three categories needs
 *   the seller's VAT identifier or its tax number.
 *
 * The validator passes what the template declares: every line is in a
 * category the invoice declares, and every invoice has a line, so a rule
 * of a declared category is one some render breaks. The runtime passes
 * the categories its lines use and the identifiers that print.
 */
export function sellerIdentificationBreaks(
  has: { readonly vatId: boolean; readonly taxNumber: boolean; readonly legalId: boolean },
  codes: readonly VatCategoryCode[],
): readonly string[] {
  const breaks: string[] = []
  if (!has.vatId && !has.legalId) {
    breaks.push(
      en16931Rule(
        'BR-CO-26',
        'the seller has neither a VAT identifier (BT-31) nor a legal registration identifier (BT-30), one of which a buyer identifies a seller by',
      ),
    )
  }
  const rules = (Object.keys(SELLER_VAT_RULES) as VatCategoryCode[]).filter((code) => codes.includes(code)).map((code) => SELLER_VAT_RULES[code])
  if (!has.vatId && !has.taxNumber && rules.length > 0) {
    breaks.push(
      en16931Rule(
        rules,
        'the seller has neither a VAT identifier (BT-31) nor a tax registration identifier (BT-32), one of which a line of these VAT categories needs',
      ),
    )
  }
  return breaks
}

/**
 * The rule the buyer's identifiers break, or undefined: a reverse-charged
 * line moves the tax to the buyer, and needs it named by its VAT identifier
 * or its legal registration (BR-AE-02).
 */
export function buyerIdentificationBreak(has: { readonly vatId: boolean; readonly legalId: boolean }, codes: readonly VatCategoryCode[]): string | undefined {
  if (!codes.includes('AE') || has.vatId || has.legalId) return undefined
  return en16931Rule(
    'BR-AE-02',
    "a reverse-charged line needs the buyer's VAT identifier (BT-48) or its legal registration identifier (BT-47), and the buyer has neither",
  )
}

/**
 * A rate in per cent (BT-119, BT-152), as this version takes one: from 0 to
 * below 100, an exact decimal with two places at most. Chosen, not
 * measured, as `limits.ts`'s bounds are: Germany's 19 and 7 need none, and
 * a rate past the bound is a typo, or a rate in hundredths.
 */
const RATE = /^(?:0|[1-9]\d?)(?:\.\d{1,2})?$/

/** A rate without the trailing zeros that do not change its value: 19.00 is 19, 5.50 is 5.5. */
function byValue(rate: string): string {
  return rate.includes('.') ? rate.replace(/\.?0+$/, '') : rate
}

/** A rate below 0.5 by value: XPath's `round` makes it 0, which BR-CO-17 reads as a breakdown whose tax rounds to 0. */
const BELOW_HALF = /^0\.[0-4]/

/** What a rate must be for each code, and the rule a rate that is not breaks. */
const RATE_RULES: { readonly [C in VatCategoryCode]: { readonly zero: boolean; readonly rule: string } } = {
  S: { zero: false, rule: en16931Rule('BR-S-05', "is 0, and a standard rated category's rate is more than 0") },
  E: { zero: true, rule: en16931Rule('BR-E-05', "is not 0, and an exempt category's rate is 0") },
  AE: { zero: true, rule: en16931Rule('BR-AE-05', "is not 0, and a reverse-charged category's rate is 0") },
}

/**
 * The rate of a category of `code`, by value, without the trailing zeros
 * that do not change it: more than 0 when standard rated (BR-S-05), 0 when
 * exempt or reverse-charged (BR-E-05, BR-AE-05). Compared as text, never
 * as a JavaScript number: report-spec has no decimal, and needs none.
 *
 * And a standard rate of 0.5 or more (BR-CO-17). CEN's rule rounds the
 * rate first, and XPath's round(0.4) is 0: a breakdown whose rate rounds
 * to 0 must then hold a tax that rounds to 0, which a standard rated
 * category's tax does not past a small basis -- at 0.4, one of 125 or
 * more. No rate of the EU's is that low.
 */
export function checkVatRate(code: VatCategoryCode, rate: string): PaymentCheck<string> {
  if (!RATE.test(rate)) return no('is not a rate this release takes: a percentage from 0 to below 100, an exact decimal of two places at most')
  const value = byValue(rate)
  if ((value === '0') !== RATE_RULES[code].zero) return no(RATE_RULES[code].rule)
  if (code === 'S' && BELOW_HALF.test(value)) {
    return no(
      en16931Rule(
        'BR-CO-17',
        "is below 0.5, which BR-CO-17 rounds to 0, and a breakdown whose rate rounds to 0 holds a tax that rounds to 0 too: a standard rated category's tax would not, past a small basis",
      ),
    )
  }
  return ok(value)
}

/**
 * The rule a category's exemption reason (BT-120) breaks, or undefined:
 * exempt and reverse-charged categories say why (BR-E-10, BR-AE-10), and a
 * standard rated one has no reason to give (BR-S-10).
 */
export function vatReasonBreak(code: VatCategoryCode, hasReason: boolean): string | undefined {
  if (code === 'S') return hasReason ? en16931Rule('BR-S-10', 'a standard rated category gives no exemption reason') : undefined
  if (hasReason) return undefined
  return code === 'E'
    ? en16931Rule('BR-E-10', 'an exempt category gives its exemption reason')
    : en16931Rule('BR-AE-10', 'a reverse-charged category gives its reason, "Reverse charge" or its words in the invoice\'s language')
}

/** A rule a list of categories breaks, and the category and field it is said of. */
export interface VatCategoryBreak {
  readonly index: number
  readonly field: 'code' | 'rate'
  readonly rule: string
}

/** For each code but S, the rule a second category of it breaks: an invoice with a line of the code holds exactly one breakdown of it. */
const ONE_BREAKDOWN: { readonly [C in Exclude<VatCategoryCode, 'S'>]: string } = {
  E: en16931Rule('BR-E-01', 'is a second exempt category, and the exempt lines have exactly one breakdown'),
  AE: en16931Rule('BR-AE-01', 'is a second reverse-charged category, and the reverse-charged lines have exactly one breakdown'),
}

/**
 * The rules a list of categories, each with a rate `checkVatRate` took,
 * breaks together: each is one VAT breakdown (BG-23), so standard rated
 * categories have distinct rates by value (BR-S-08), and there is one
 * exempt and one reverse-charged category at most (BR-E-01, BR-AE-01). Two
 * that would be one breakdown would each claim every one of its lines, and
 * the XML would fail. The later of the two is refused.
 */
export function vatCategoryBreaks(categories: readonly { readonly code: VatCategoryCode; readonly rate: string }[]): readonly VatCategoryBreak[] {
  const seen = new Set<string>()
  const breaks: VatCategoryBreak[] = []
  for (const [index, { code, rate }] of categories.entries()) {
    const breakdown = code === 'S' ? `S ${byValue(rate)}` : code
    if (!seen.has(breakdown)) seen.add(breakdown)
    else if (code === 'S')
      breaks.push({
        index,
        field: 'rate',
        rule: en16931Rule('BR-S-08', 'is the rate of an earlier standard rated category, and the standard rated lines have one breakdown for each rate'),
      })
    else breaks.push({ index, field: 'code', rule: ONE_BREAKDOWN[code] })
  }
  return breaks
}

/** The category a line names by `id`, a category the invoice declares (BR-CO-04). */
export function checkLineCategory(id: string, categories: readonly VatCategory[]): PaymentCheck<VatCategory> {
  const category = categories.find((declared) => declared.id === id)
  return category === undefined ? no(en16931Rule('BR-CO-04', 'is not the id of a VAT category this invoice declares, and every line is in one')) : ok(category)
}
