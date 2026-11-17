/**
 * The payment reminder in each language it is written in (0066): every
 * word it prints but the slip's headings, which are the runtime's, in
 * SIX's (IG Annex C). The German is the reminder's own language; the
 * French, the Italian and the English are its translations (0063), word
 * for word in the places the German stands, since a text's runs keep
 * their order in every language.
 *
 * What a payment and a credit note are called is printed by an
 * expression over the item's kind, so the two words are written in each
 * language as that expression's (`kinds`), never as data, which no
 * language translates.
 *
 * The firm, the customer and their dealings are invented. No native
 * speaker has reviewed the French, the Italian or the English. A no-break
 * space stands before a French colon, so that it never starts a line.
 */

/** The reminder in one language: its locale, the slip's language, and every word it prints there. */
export interface ReminderWords {
  readonly locale: 'de-CH' | 'fr-CH' | 'it-CH' | 'en-CH'
  /** The language the slip is printed in (IG Annex C), which a render in `locale` gives it (0063). */
  readonly language: 'de' | 'fr' | 'it' | 'en'
  /** The report's title, which its heading prints too. */
  readonly title: string
  /** What the firm's UID is followed by, as the VAT number it is. */
  readonly vatNumber: string
  /** What the reminder's number follows in the running header and in the slip's message. */
  readonly reminderIs: string
  readonly numberIs: string
  readonly issuedOnIs: string
  /** The sentence over the tables, before and after the date of the earlier reminder. */
  readonly intro: readonly [string, string]
  readonly overdue: string
  /** The overdue invoices' column headers, in the table's order; what was received heads its date, its invoice and its amount with the same words. */
  readonly columns: readonly [invoice: string, date: string, dueOn: string, days: string, amount: string]
  readonly noOverdue: string
  readonly overdueTotal: string
  readonly received: string
  /** The header of the column that says what each item received is. */
  readonly kind: string
  /** What that column prints for a credit note, and for a payment. */
  readonly kinds: readonly [credit: string, payment: string]
  readonly noReceived: string
  readonly receivedTotal: string
  readonly fee: string
  readonly due: string
  /** The sentence under what is due, before and after the date it is to be paid by. */
  readonly terms: readonly [string, string]
}

const NBSP = ' '

export const GERMAN_REMINDER: ReminderWords = {
  locale: 'de-CH',
  language: 'de',
  title: 'Mahnung',
  vatNumber: 'MWST',
  reminderIs: 'Mahnung ',
  numberIs: 'Nummer: ',
  issuedOnIs: 'Datum: ',
  intro: ['Trotz unserer Zahlungserinnerung vom ', ' sind die folgenden Rechnungen noch nicht bezahlt.'],
  overdue: 'Überfällige Rechnungen',
  columns: ['Rechnung', 'Datum', 'Fällig am', 'Tage', 'Betrag'],
  noOverdue: 'Keine überfälligen Rechnungen.',
  overdueTotal: 'Total überfällige Rechnungen',
  received: 'Zahlungen und Gutschriften',
  kind: 'Art',
  kinds: ['Gutschrift', 'Zahlung'],
  noReceived: 'Keine Zahlungen oder Gutschriften.',
  receivedTotal: 'Total Zahlungen und Gutschriften',
  fee: 'Mahngebühr ',
  due: 'Zu bezahlen ',
  terms: [
    'Bitte bezahlen Sie den offenen Betrag bis ',
    ' mit dem QR-Zahlteil unten. Hat sich Ihre Zahlung mit diesem Schreiben gekreuzt, betrachten Sie es als gegenstandslos.',
  ],
}

export const FRENCH_REMINDER: ReminderWords = {
  locale: 'fr-CH',
  language: 'fr',
  title: 'Rappel',
  vatNumber: 'TVA',
  reminderIs: 'Rappel ',
  numberIs: `Numéro${NBSP}: `,
  issuedOnIs: `Date${NBSP}: `,
  intro: ['Malgré notre rappel de paiement du ', ', les factures suivantes restent impayées.'],
  overdue: 'Factures échues',
  columns: ['Facture', 'Date', 'Échéance', 'Jours', 'Montant'],
  noOverdue: 'Aucune facture échue.',
  overdueTotal: 'Total des factures échues',
  received: 'Paiements et notes de crédit',
  kind: 'Type',
  kinds: ['Note de crédit', 'Paiement'],
  noReceived: 'Aucun paiement ni note de crédit.',
  receivedTotal: 'Total des paiements et notes de crédit',
  fee: 'Frais de rappel ',
  due: 'Montant dû ',
  terms: [
    'Merci de régler le montant dû d’ici au ',
    ' au moyen de la section paiement ci-dessous. Si votre paiement a croisé ce courrier, veuillez ne pas en tenir compte.',
  ],
}

export const ITALIAN_REMINDER: ReminderWords = {
  locale: 'it-CH',
  language: 'it',
  title: 'Sollecito',
  vatNumber: 'IVA',
  reminderIs: 'Sollecito ',
  numberIs: 'Numero: ',
  issuedOnIs: 'Data: ',
  intro: ['Nonostante il nostro promemoria del ', ', le seguenti fatture non sono ancora state pagate.'],
  overdue: 'Fatture scadute',
  columns: ['Fattura', 'Data', 'Scadenza', 'Giorni', 'Importo'],
  noOverdue: 'Nessuna fattura scaduta.',
  overdueTotal: 'Totale fatture scadute',
  received: 'Pagamenti e note di credito',
  kind: 'Tipo',
  kinds: ['Nota di credito', 'Pagamento'],
  noReceived: 'Nessun pagamento né nota di credito.',
  receivedTotal: 'Totale pagamenti e note di credito',
  fee: 'Spese di sollecito ',
  due: 'Importo dovuto ',
  terms: [
    'Vi preghiamo di versare l’importo dovuto entro il ',
    ' tramite la sezione pagamento qui sotto. Se il vostro pagamento si è incrociato con questa lettera, non tenetene conto.',
  ],
}

export const ENGLISH_REMINDER: ReminderWords = {
  locale: 'en-CH',
  language: 'en',
  title: 'Payment reminder',
  vatNumber: 'VAT',
  reminderIs: 'Payment reminder ',
  numberIs: 'Number: ',
  issuedOnIs: 'Date: ',
  intro: ['Despite our reminder of ', ', the following invoices are still unpaid.'],
  overdue: 'Overdue invoices',
  columns: ['Invoice', 'Date', 'Due date', 'Days', 'Amount'],
  noOverdue: 'No overdue invoices.',
  overdueTotal: 'Total overdue invoices',
  received: 'Payments and credit notes',
  kind: 'Type',
  kinds: ['Credit note', 'Payment'],
  noReceived: 'No payments or credit notes.',
  receivedTotal: 'Total payments and credit notes',
  fee: 'Reminder fee ',
  due: 'Amount due ',
  terms: ['Please pay the amount due by ', ' using the payment part below. If your payment has crossed with this letter, please disregard it.'],
}
