/**
 * Running text in which every word occurs once, so that a check can find a
 * lost or repeated word by itself: each is an accounting word of 3 to 14
 * letters, for line breaks that fall unevenly, followed by its four-digit
 * position. No word has a hyphen, so an engine may break lines only at
 * spaces.
 */
const VOCABULARY = [
  'ledger',
  'invoice',
  'account',
  'balance',
  'tax',
  'remittance',
  'settlement',
  'audit',
  'entry',
  'freight',
  'customs',
  'warehouse',
  'discount',
  'surcharge',
  'reconciliation',
  'quarter',
  'net',
  'gross',
  'payable',
  'receivable',
  'accrual',
  'depreciation',
  'vat',
  'journal',
] as const

/** `count` distinct words, the same ones every time. */
export function uniqueWords(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${VOCABULARY[index % VOCABULARY.length]}${String(index + 1).padStart(4, '0')}`)
}
