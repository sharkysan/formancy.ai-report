/**
 * Each decimal term the runtime reads from data -- a line's quantity, net
 * price and net amount, and the paid amount -- held to EN 16931, and
 * written as the XML writes it: an amount with two decimals, never
 * rounded here.
 */
import { en16931Rule } from './en16931.js'
import type { En16931Rule } from './en16931.js'
import { no, ok } from './payment-reference.js'
import type { PaymentCheck } from './payment-reference.js'
import { DECIMAL } from './syntax.js'

/** How a decimal term of the e-invoice is held: what a refusal calls it, the rule a null breaks, and what it may be. */
export interface EInvoiceDecimalRule {
  readonly what: string
  /** The rule a final render's null breaks; absent, the term may be left out. */
  readonly required?: En16931Rule
  /** The rule more than two decimals break, for a term the XML writes as an amount with two. */
  readonly cents?: En16931Rule
  /** The rule a negative value breaks, for a term that may not be one. */
  readonly least?: En16931Rule
}

/**
 * Each decimal term the runtime reads from data, by its business term:
 * the line's quantity, net price and net amount, and the paid amount. The
 * totals and the breakdown are not here: the runtime computes them.
 */
export type EInvoiceDecimalTerm = 'BT-129' | 'BT-146' | 'BT-131' | 'BT-113'

export const E_INVOICE_DECIMALS: { readonly [T in EInvoiceDecimalTerm]: EInvoiceDecimalRule } = {
  'BT-129': { what: 'the invoiced quantity (BT-129)', required: 'BR-22' },
  'BT-146': { what: 'the item net price (BT-146)', required: 'BR-26', least: 'BR-27' },
  'BT-131': { what: 'the line net amount (BT-131)', required: 'BR-24', cents: 'BR-DEC-23' },
  'BT-113': { what: 'the paid amount (BT-113)', cents: 'BR-DEC-16' },
}

/**
 * The decimal of `term`, an exact decimal as a string, as the XML writes
 * it: an amount with exactly two decimals, from its own digits; a quantity
 * or a price as written. Never rounded, and never read through a
 * JavaScript number: an amount of 10.505 is refused, so that a template
 * that does not round where it computes a line is refused on its first
 * render, rather than writing another amount than its page prints. 10.500
 * is the same number of cents, and is written 10.50.
 */
export function checkEInvoiceDecimal(term: EInvoiceDecimalTerm, decimal: string): PaymentCheck<string> {
  if (!DECIMAL.test(decimal)) return no('is not a decimal')
  const rule = E_INVOICE_DECIMALS[term]
  const negative = decimal.startsWith('-')
  if (negative && rule.least !== undefined) return no(en16931Rule(rule.least, 'is negative, and a net price never is: a discount is a line of negative quantity at a positive price'))
  if (rule.cents === undefined) return ok(decimal)
  const [whole = '', fraction = ''] = decimal.replace(/^-/, '').split('.')
  if (/[1-9]/.test(fraction.slice(2))) {
    return no(en16931Rule(rule.cents, 'is not a whole number of cents, and the XML writes it with two decimals at most: it is rounded where the template computes it'))
  }
  return ok(`${negative ? '-' : ''}${whole}.${fraction.slice(0, 2).padEnd(2, '0')}`)
}
