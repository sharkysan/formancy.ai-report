/**
 * A line's terms: which term each column of the lines' table prints, which
 * codes are read from a line's row, and the types of field that can give
 * each. The rules that hold them are the texts' and the decimals'.
 */
import type { FieldType } from './data.js'
import { E_INVOICE_DECIMALS } from './en16931-decimals.js'
import type { EInvoiceDecimalTerm } from './en16931-decimals.js'
import { E_INVOICE_TEXTS } from './en16931-texts.js'
import type { EInvoiceTextTerm } from './en16931-texts.js'

/** What a line's term is read from: its business term, whose rule holds it, what a refusal calls it, and the types of field that can give it. */
export interface EInvoiceLineTerm {
  readonly term: EInvoiceTextTerm | EInvoiceDecimalTerm
  readonly what: string
  readonly types: readonly FieldType[]
}

export type EInvoiceLineColumn = 'name' | 'quantity' | 'netPrice' | 'netAmount'
export type EInvoiceLineCode = 'id' | 'unit' | 'vat'

/**
 * Each term a column of the lines' table prints, in the order the XML
 * holds a line's. A column prints a detail field of one of these types, or
 * an expression the editing core holds to what it reads them as: one
 * table, so the validator and the core cannot take a column for two
 * things.
 */
export const E_INVOICE_LINE_COLUMNS: { readonly [K in EInvoiceLineColumn]: EInvoiceLineTerm } = {
  name: { term: 'BT-153', what: E_INVOICE_TEXTS['BT-153'].what, types: ['string'] },
  quantity: { term: 'BT-129', what: E_INVOICE_DECIMALS['BT-129'].what, types: ['integer', 'decimal'] },
  netPrice: { term: 'BT-146', what: E_INVOICE_DECIMALS['BT-146'].what, types: ['integer', 'decimal'] },
  netAmount: { term: 'BT-131', what: E_INVOICE_DECIMALS['BT-131'].what, types: ['integer', 'decimal'] },
}

/** Each code read from a line's row, a detail field of one of these types or an expression held to them in the same way. */
export const E_INVOICE_LINE_CODES: { readonly [K in EInvoiceLineCode]: EInvoiceLineTerm } = {
  id: { term: 'BT-126', what: E_INVOICE_TEXTS['BT-126'].what, types: ['string', 'integer'] },
  unit: { term: 'BT-130', what: E_INVOICE_TEXTS['BT-130'].what, types: ['string'] },
  vat: { term: 'BT-151', what: E_INVOICE_TEXTS['BT-151'].what, types: ['string'] },
}
