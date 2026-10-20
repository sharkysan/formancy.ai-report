/**
 * EN 16931's rules for what an e-invoice holds, as checks over text: each
 * answers the value the XML is written with, or the rule the text breaks,
 * named by its business term (BT) and its business rule (BR) and never by
 * the value, which may be a person's name, account or VAT identifier.
 *
 * One set of rules, read twice, as the QR-bill's are (0022): the validator
 * applies them to a text no data can change, so that the editor refuses a
 * country written UK where it is written; the runtime applies the same
 * functions to every text once the data has resolved it. Two copies could
 * disagree about which invoices are valid, and nobody would find out until
 * a buyer's system refused one. The arithmetic -- the totals and the VAT
 * breakdown -- is not here: the runtime computes it once
 * (`e-invoice-totals.ts`), so it is right by construction and not checked.
 *
 * The rules are CEN/TC 434's CII artefacts 1.3.17, each fatal there and in
 * the 1.3.16 the pinned validators run; the e-invoice gate holds every id
 * `EN16931_RULES` lists to a fatal rule of its pinned schematron. The one
 * that is not CEN's, the time of supply, is the UStG's, and says so. Which
 * release each check follows where they differ, 0027 says: EL as a VAT
 * prefix only.
 *
 * This module holds the rules' ids and how a refusal names one; the
 * checks stand beside it, by the kind of term each holds: the texts
 * (`en16931-texts.ts`), the decimals (`en16931-decimals.ts`), the dates
 * (`en16931-dates.ts`), the terms of a line (`en16931-lines.ts`) and the
 * VAT categories (`en16931-vat.ts`).
 */

/**
 * Every rule of EN 16931 a refusal of these checks names, and no other.
 * The gate reads this list; `en16931.test.ts` holds it to the ids the
 * rules say.
 */
export const EN16931_RULES = [
  'BR-02',
  'BR-03',
  'BR-06',
  'BR-07',
  'BR-09',
  'BR-11',
  'BR-16',
  'BR-21',
  'BR-22',
  'BR-23',
  'BR-24',
  'BR-25',
  'BR-26',
  'BR-27',
  'BR-29',
  'BR-61',
  'BR-CL-11',
  'BR-CL-14',
  'BR-CL-23',
  'BR-CO-04',
  'BR-CO-09',
  'BR-CO-17',
  'BR-CO-18',
  'BR-CO-19',
  'BR-CO-26',
  'BR-DEC-16',
  'BR-DEC-23',
  'BR-S-02',
  'BR-S-05',
  'BR-S-08',
  'BR-S-10',
  'BR-E-01',
  'BR-E-02',
  'BR-E-05',
  'BR-E-10',
  'BR-AE-01',
  'BR-AE-02',
  'BR-AE-05',
  'BR-AE-10',
] as const
export type En16931Rule = (typeof EN16931_RULES)[number]

/** What a rule says, with the ids of the rules it is: the one way a message of these checks names one, so that every id is a listed one. */
export function en16931Rule(id: En16931Rule | readonly En16931Rule[], said: string): string {
  return `${said} (${typeof id === 'string' ? id : id.join(', ')})`
}

/**
 * The section of the UStG that asks a German invoice for "die vollständige
 * Anschrift" of the seller and of the buyer (§ 14 Abs. 4 Satz 1 Nr. 1,
 * read on gesetze-im-internet.de on 17 October 2026): their street, post
 * code and city, which no rule of CEN's asks for. BR-08 and BR-10 need
 * only that each party has a postal address (BG-5, BG-8), and BR-09 and
 * BR-11 its country. It is the law's, not one of CEN's rules, and so not
 * in `EN16931_RULES`.
 */
export const FULL_ADDRESS = '§ 14 Abs. 4 Satz 1 Nr. 1 UStG'

/** What asks for a term an e-invoice cannot leave out: one of EN 16931's rules, or the UStG's full address. */
export type EInvoiceNeed = En16931Rule | typeof FULL_ADDRESS

/** What a refusal says of a term `need` asks for that is `said` -- empty, or without a value -- and what asks for it: a rule of CEN's by its id, the UStG by its section and what it asks. */
export function neededBy(need: EInvoiceNeed, said: string): string {
  return need === FULL_ADDRESS ? `${said}, and a German invoice gives the full address of the seller and the buyer (${FULL_ADDRESS})` : en16931Rule(need, `${said}, and an e-invoice needs it`)
}
