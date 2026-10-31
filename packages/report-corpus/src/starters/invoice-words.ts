/**
 * The invoice in each language it is a sample in: every word it prints
 * but the slip's, which are the runtime's, in SIX's (IG Annex C), and the
 * firm, the customer and the work it bills.
 *
 * - **German** is the Studio's starter, "Rechnung mit QR-Zahlteil", word
 *   for word as it was before the samples were made from it.
 * - **French, Italian and English** are the same work billed by a firm of
 *   Romandy, of Ticino and of Basel writing in English, at the same
 *   quantities and prices, so that the four print one total, each as its
 *   locale writes it.
 *
 * The firms, the customers, their addresses and the invoice numbers are
 * invented. The account is SIX's example QR-IBAN (IG 2.4, Annex A), which
 * no bank books. The German reference is SIX's example QR reference; the
 * others are made from the invoice's number, with the check digit IG Annex
 * B computes, which report-spec checks when the report resolves. The UID,
 * CHE-123.456.789, is the corpus's invented one, as the quotation's is.
 *
 * A space before a French colon or percent sign is a no-break space, as
 * French sets it, so neither is ever left at the start of a line.
 */

/** Where an invoice's firm, or its customer, is: the parts of a structured address SIX prints, in Switzerland. */
export interface Party {
  readonly name: string
  readonly street: string
  readonly buildingNumber: string
  readonly postalCode: string
  readonly town: string
}

/** One line of the work billed: its description, unit, quantity and unit price, each quantity and price exact to the centime. */
export type Item = readonly [description: string, unit: string, quantity: string, unitPrice: string]

/** The labels of the data's fields, as the editor shows them. */
export interface Labels {
  readonly number: string
  readonly issuedOn: string
  readonly dueOn: string
  readonly customer: string
  readonly street: string
  readonly buildingNumber: string
  readonly postcode: string
  readonly city: string
  readonly reference: string
  readonly article: string
  readonly description: string
  readonly quantity: string
  readonly unit: string
  readonly unitPrice: string
  readonly amount: string
}

/** The invoice in one language: its words, its locale and the slip's language, and what it bills whom. */
export interface Edition {
  readonly id: string
  readonly locale: 'de-CH' | 'fr-CH' | 'it-CH' | 'en-CH'
  /** The language the slip is printed in (IG Annex C). */
  readonly language: 'de' | 'fr' | 'it' | 'en'
  readonly title: string
  /** What the sample shows that the others do not. */
  readonly proves: string
  readonly labels: Labels
  /** The heading over the number and dates, and the words before each. */
  readonly heading: string
  readonly numberIs: string
  readonly issuedOnIs: string
  readonly dueOnIs: string
  /** The column headers, in the table's order. */
  readonly columns: readonly [article: string, description: string, quantity: string, unit: string, unitPrice: string, amount: string]
  readonly subtotal: string
  readonly vat: string
  readonly total: string
  readonly empty: string
  /** The sentence under the totals, before and after the date the invoice is due. */
  readonly terms: readonly [string, string]
  /** The message on the slip, before the invoice's number. */
  readonly message: string
  /** What the firm's UID is followed by, as the VAT number it is. */
  readonly vatNumber: string
  readonly creditor: Party
  readonly customer: Party
  readonly number: string
  /** A QR reference of 27 digits, its check digit last. */
  readonly reference: string
  /** What the firm's article numbers begin with. */
  readonly articles: string
  readonly items: readonly Item[]
}

/** The quantities and prices every edition bills: what changes from one to the next is the words. */
const WORK = [
  ['1.00', '480.00'],
  ['6.00', '38.50'],
  ['3.75', '128.00'],
  ['12.50', '4.35'],
  ['1.00', '65.00'],
] as const

/** The edition's lines: each description and unit with the quantity and price of the same line of the work. */
const billed = (lines: readonly (readonly [description: string, unit: string])[]): Item[] =>
  lines.map(([description, unit], index) => [description, unit, ...(WORK[index] as readonly [string, string])])

const NBSP = '\u00a0'

export const GERMAN: Edition = {
  id: 'invoice',
  locale: 'de-CH',
  language: 'de',
  title: 'Rechnung mit QR-Zahlteil',
  proves:
    'a Swiss QR-bill: the receipt and the payment part at the foot of the last page, paying the invoice’s exact total by a QR reference read from the data',
  labels: {
    number: 'Nummer',
    issuedOn: 'Datum',
    dueOn: 'Zahlbar bis',
    customer: 'Kunde',
    street: 'Strasse',
    buildingNumber: 'Hausnummer',
    postcode: 'PLZ',
    city: 'Ort',
    reference: 'QR-Referenz',
    article: 'Artikel',
    description: 'Beschreibung',
    quantity: 'Menge',
    unit: 'Einheit',
    unitPrice: 'Einzelpreis',
    amount: 'Betrag',
  },
  heading: 'Rechnung',
  numberIs: 'Nummer: ',
  issuedOnIs: 'Datum: ',
  dueOnIs: 'Zahlbar bis: ',
  columns: ['Artikel', 'Beschreibung', 'Menge', 'Einheit', 'Preis', 'Betrag'],
  subtotal: 'Zwischensumme',
  vat: 'MWST 8.1 %',
  total: 'Total',
  empty: 'Keine Positionen.',
  terms: ['Bitte bezahlen Sie bis ', ' mit dem QR-Zahlteil unten.'],
  message: 'Rechnung ',
  vatNumber: 'MWST',
  creditor: { name: 'Formancy Haustechnik AG', street: 'Industriestrasse', buildingNumber: '7', postalCode: '3052', town: 'Zollikofen' },
  customer: { name: 'Bäckerei Müller AG', street: 'Hauptstrasse', buildingNumber: '12', postalCode: '3011', town: 'Bern' },
  number: 'R-2026-0731',
  reference: '210000000003139471430009017',
  articles: 'R',
  items: billed([
    ['Wartung Lüftungsanlage, Grundpauschale', 'Pausch.'],
    ['Ersatzfilter F7 für Monoblock', 'Stk'],
    ['Arbeitszeit Servicetechniker', 'h'],
    ['Dichtungsband EPDM', 'm'],
    ['Fahrzeugpauschale Region Bern', 'Pausch.'],
  ]),
}

export const FRENCH: Edition = {
  id: 'invoice-fr',
  locale: 'fr-CH',
  language: 'fr',
  title: 'Facture avec section paiement QR',
  proves: 'the invoice in French for Romandy: its own words, its amounts and dates as fr-CH prints them, and its slip’s headings in SIX’s French',
  labels: {
    number: 'Numéro',
    issuedOn: 'Date',
    dueOn: 'Payable jusqu’au',
    customer: 'Client',
    street: 'Rue',
    buildingNumber: 'Numéro de maison',
    postcode: 'NPA',
    city: 'Localité',
    reference: 'Référence QR',
    article: 'Article',
    description: 'Désignation',
    quantity: 'Quantité',
    unit: 'Unité',
    unitPrice: 'Prix unitaire',
    amount: 'Montant',
  },
  heading: 'Facture',
  numberIs: `Numéro${NBSP}: `,
  issuedOnIs: `Date${NBSP}: `,
  dueOnIs: `Payable jusqu’au${NBSP}: `,
  columns: ['Article', 'Désignation', 'Quantité', 'Unité', 'Prix', 'Montant'],
  subtotal: 'Sous-total',
  vat: `TVA 8,1${NBSP}%`,
  total: 'Total',
  empty: 'Aucune position.',
  terms: ['Merci de régler cette facture d’ici au ', ' au moyen de la section paiement ci-dessous.'],
  message: 'Facture ',
  vatNumber: 'TVA',
  creditor: { name: 'Formancy Technique du Bâtiment SA', street: 'Chemin des Artisans', buildingNumber: '7', postalCode: '1004', town: 'Lausanne' },
  customer: { name: 'Boulangerie Favre SA', street: 'Rue du Marché', buildingNumber: '18', postalCode: '1204', town: 'Genève' },
  number: 'F-2026-0412',
  reference: '000000000000000000202604127',
  articles: 'A',
  items: billed([
    ['Entretien de l’installation de ventilation, forfait de base', 'forfait'],
    ['Filtre de rechange F7 pour monobloc', 'pce'],
    ['Main-d’œuvre technicien de service', 'h'],
    ['Bande d’étanchéité EPDM', 'm'],
    ['Forfait de déplacement région Genève', 'forfait'],
  ]),
}

export const ITALIAN: Edition = {
  id: 'invoice-it',
  locale: 'it-CH',
  language: 'it',
  title: 'Fattura con sezione pagamento QR',
  proves: 'the invoice in Italian for Ticino: its own words, its amounts and dates as it-CH prints them, and its slip’s headings in SIX’s Italian',
  labels: {
    number: 'Numero',
    issuedOn: 'Data',
    dueOn: 'Pagabile entro',
    customer: 'Cliente',
    street: 'Via',
    buildingNumber: 'Numero civico',
    postcode: 'NPA',
    city: 'Località',
    reference: 'Riferimento QR',
    article: 'Articolo',
    description: 'Descrizione',
    quantity: 'Quantità',
    unit: 'Unità',
    unitPrice: 'Prezzo unitario',
    amount: 'Importo',
  },
  heading: 'Fattura',
  numberIs: 'Numero: ',
  issuedOnIs: 'Data: ',
  dueOnIs: 'Pagabile entro: ',
  columns: ['Articolo', 'Descrizione', 'Quantità', 'Unità', 'Prezzo', 'Importo'],
  subtotal: 'Subtotale',
  vat: 'IVA 8,1 %',
  total: 'Totale',
  empty: 'Nessuna posizione.',
  terms: ['Vi preghiamo di effettuare il pagamento entro il ', ' tramite la sezione pagamento qui sotto.'],
  message: 'Fattura ',
  vatNumber: 'IVA',
  creditor: { name: 'Formancy Impianti Tecnici SA', street: 'Via Industria', buildingNumber: '7', postalCode: '6500', town: 'Bellinzona' },
  customer: { name: 'Panetteria Bernasconi SA', street: 'Via Cantonale', buildingNumber: '12', postalCode: '6900', town: 'Lugano' },
  number: 'F-2026-0587',
  reference: '000000000000000000202605875',
  articles: 'A',
  items: billed([
    ['Manutenzione impianto di ventilazione, forfait di base', 'forfait'],
    ['Filtro di ricambio F7 per monoblocco', 'pz.'],
    ['Ore di lavoro tecnico di servizio', 'h'],
    ['Nastro di tenuta EPDM', 'm'],
    ['Forfait trasferta regione Lugano', 'forfait'],
  ]),
}

export const ENGLISH: Edition = {
  id: 'invoice-en',
  locale: 'en-CH',
  language: 'en',
  title: 'Invoice with a QR payment part',
  proves: 'the invoice in English from a Swiss firm: its own words, its amounts and dates as en-CH prints them, and its slip’s headings in SIX’s English',
  labels: {
    number: 'Number',
    issuedOn: 'Date',
    dueOn: 'Due date',
    customer: 'Customer',
    street: 'Street',
    buildingNumber: 'Building number',
    postcode: 'Postal code',
    city: 'Town',
    reference: 'QR reference',
    article: 'Item',
    description: 'Description',
    quantity: 'Quantity',
    unit: 'Unit',
    unitPrice: 'Unit price',
    amount: 'Amount',
  },
  heading: 'Invoice',
  numberIs: 'Number: ',
  issuedOnIs: 'Date: ',
  dueOnIs: 'Due date: ',
  columns: ['Item', 'Description', 'Quantity', 'Unit', 'Price', 'Amount'],
  subtotal: 'Subtotal',
  vat: 'VAT 8.1%',
  total: 'Total',
  empty: 'No items.',
  terms: ['Please pay by ', ' using the payment part below.'],
  message: 'Invoice ',
  vatNumber: 'VAT',
  creditor: { name: 'Formancy Building Services AG', street: 'Gewerbestrasse', buildingNumber: '14', postalCode: '4053', town: 'Basel' },
  customer: { name: 'Riverside Coffee Roasters AG', street: 'Rheingasse', buildingNumber: '21', postalCode: '4058', town: 'Basel' },
  number: 'INV-2026-0318',
  reference: '000000000000000000202603184',
  articles: 'A',
  items: billed([
    ['Ventilation system service, base charge', 'flat rate'],
    ['F7 replacement filter for air handling unit', 'pcs'],
    ['Service technician, labour', 'h'],
    ['EPDM sealing tape', 'm'],
    ['Call-out charge, Basel area', 'flat rate'],
  ]),
}
