import type { EuroCountry } from './euro-invoice-countries.js'

/**
 * The euro invoice in each language it is a sample in: every word it
 * prints but Austria's caption, which is the PSA's and the renderer's,
 * and the words of the lines it bills. What each country's sample bills
 * whom, at what rate and to which account is `euro-invoice-countries.ts`.
 *
 * - **German (Germany)** is the Studio's starter, "Rechnung mit
 *   SEPA-Zahlcode", word for word as it was before the samples were made
 *   from it: the maintenance of a private home's gas boiler.
 * - **The six samples** sell that boiler's parts to a private customer --
 *   the circulation pump, the expansion vessel, the ignition electrode,
 *   the heating-water inhibitor and the shipping -- in German for Austria,
 *   French, Italian, Spanish, Dutch and English for Ireland.
 *
 * **No translation here has been reviewed by a native speaker** (0028):
 * the German for Austria, the French, the Italian, the Spanish, the Dutch
 * and the English are this repository's, and each edition below says so
 * again beside its words. Spanish and Dutch have no page of the site, and
 * are seen only as pictures.
 *
 * A space before a French colon or percent sign is a no-break space, as
 * French sets it, so neither is ever left at the start of a line; Spanish
 * sets one before the percent sign, as the RAE writes it.
 */

/** The labels of the data's fields, as the editor shows them. */
export interface EuroLabels {
  readonly number: string
  readonly issuedOn: string
  /** The date of the service, or of the delivery where the sample sells goods. */
  readonly servedOn: string
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

/** The euro invoice in one language: what it is called, the words it prints, and the words of each line it bills. */
export interface EuroWords {
  readonly title: string
  /** What the sample shows that the others do not. */
  readonly proves: string
  readonly labels: EuroLabels
  /** The heading over the number and dates, and the words before each. */
  readonly heading: string
  readonly numberIs: string
  readonly issuedOnIs: string
  readonly servedOnIs: string
  readonly dueOnIs: string
  /** The column headers, in the table's order. */
  readonly columns: readonly [article: string, description: string, quantity: string, unit: string, unitPrice: string, amount: string]
  readonly net: string
  /** The tax line's label, given the rate in whole percent as the countries file states it. */
  readonly vat: (rate: string) => string
  readonly total: string
  readonly empty: string
  /** The sentence under the totals, before and after the date the invoice is due. */
  readonly terms: readonly [string, string]
  /** A sentence the invoice's law asks for under the terms, with the component's id: none for most. */
  readonly notice?: { readonly id: string; readonly text: string }
  /** The payment details printed beside the code: their heading, the words before each, and the sentence under them. */
  readonly bank: { readonly heading: string; readonly paidTo: string; readonly iban: string; readonly bic: string; readonly amount: string; readonly reference: string; readonly scan: string }
  /** The code's text, before the invoice's number. */
  readonly information: string
  /** What the firm's VAT number is printed after. */
  readonly vatNumber: string
  /** Each line's description and unit, in the order of the country's work. */
  readonly items: readonly (readonly [description: string, unit: string])[]
}

const NBSP = ' '

/** Germany: the starter's own words. */
const GERMAN: EuroWords = {
  title: 'Rechnung mit SEPA-Zahlcode',
  proves: 'an EPC QR code: a SEPA credit transfer of the invoice’s exact total in euro, by a creditor reference read from the data, beside the payment details it holds, printed in plain text',
  labels: {
    number: 'Rechnungsnummer',
    issuedOn: 'Rechnungsdatum',
    servedOn: 'Leistungsdatum',
    dueOn: 'Zahlbar bis',
    customer: 'Kunde',
    street: 'Straße',
    buildingNumber: 'Hausnummer',
    postcode: 'PLZ',
    city: 'Ort',
    reference: 'Referenz',
    article: 'Artikel',
    description: 'Beschreibung',
    quantity: 'Menge',
    unit: 'Einheit',
    unitPrice: 'Einzelpreis',
    amount: 'Betrag',
  },
  heading: 'Rechnung',
  numberIs: 'Rechnungsnummer: ',
  issuedOnIs: 'Rechnungsdatum: ',
  servedOnIs: 'Leistungsdatum: ',
  dueOnIs: 'Zahlbar bis: ',
  columns: ['Artikel', 'Beschreibung', 'Menge', 'Einheit', 'Einzelpreis', 'Betrag'],
  net: 'Nettobetrag',
  vat: (rate) => `Umsatzsteuer ${rate} %`,
  total: 'Rechnungsbetrag',
  empty: 'Keine Positionen.',
  terms: ['Bitte überweisen Sie den Rechnungsbetrag bis zum ', ' auf das unten genannte Konto und geben Sie dabei die Referenz an.'],
  notice: { id: 'retention', text: 'Sie sind gesetzlich verpflichtet, diese Rechnung, einen Zahlungsbeleg oder eine andere beweiskräftige Unterlage zwei Jahre lang aufzubewahren (§ 14b Abs. 1 Satz 5 UStG).' },
  bank: { heading: 'Bankverbindung', paidTo: 'Empfänger: ', iban: 'IBAN: ', bic: 'BIC: ', amount: 'Betrag: ', reference: 'Referenz: ', scan: 'Oder scannen Sie den Code links mit Ihrer Banking-App.' },
  information: 'Rechnung ',
  vatNumber: 'USt-IdNr.',
  items: [
    ['Wartung Gastherme', 'Pausch.'],
    ['Arbeitszeit Techniker', 'h'],
    ['Umwälzpumpe getauscht', 'Stk'],
    ['Ausdehnungsgefäß 25 l', 'Stk'],
    ['Zündelektrode mit Dichtung', 'Stk'],
    ['Heizungswasser nachgefüllt', 'l'],
    ['Anfahrt Köln', 'Pausch.'],
  ],
}

/** Austria: German as Austria writes an invoice for goods -- "Lieferdatum", "UID-Nr.", "USt". Not reviewed by a native speaker. */
const AUSTRIAN: EuroWords = {
  title: 'Rechnung mit EPC-QR-Code',
  proves: 'the euro invoice from Austria: parts sold at Austria’s standard rate, amounts and dates as de-AT prints them, and its EPC QR code in the frame and with the caption Austria’s PSA gives it',
  labels: {
    number: 'Rechnungsnummer',
    issuedOn: 'Rechnungsdatum',
    servedOn: 'Lieferdatum',
    dueOn: 'Zahlbar bis',
    customer: 'Kunde',
    street: 'Straße',
    buildingNumber: 'Hausnummer',
    postcode: 'PLZ',
    city: 'Ort',
    reference: 'Zahlungsreferenz',
    article: 'Artikel',
    description: 'Bezeichnung',
    quantity: 'Menge',
    unit: 'Einheit',
    unitPrice: 'Einzelpreis',
    amount: 'Betrag',
  },
  heading: 'Rechnung',
  numberIs: 'Rechnungsnummer: ',
  issuedOnIs: 'Rechnungsdatum: ',
  servedOnIs: 'Lieferdatum: ',
  dueOnIs: 'Zahlbar bis: ',
  columns: ['Artikel', 'Bezeichnung', 'Menge', 'Einheit', 'Einzelpreis', 'Betrag'],
  net: 'Nettobetrag',
  vat: (rate) => `USt ${rate} %`,
  total: 'Gesamtbetrag',
  empty: 'Keine Positionen.',
  terms: ['Bitte überweisen Sie den Gesamtbetrag bis ', ' auf das unten angeführte Konto und geben Sie dabei die Zahlungsreferenz an.'],
  bank: { heading: 'Bankverbindung', paidTo: 'Empfänger: ', iban: 'IBAN: ', bic: 'BIC: ', amount: 'Betrag: ', reference: 'Zahlungsreferenz: ', scan: 'Oder scannen Sie den Code links mit Ihrer Banking-App.' },
  information: 'Rechnung ',
  vatNumber: 'UID-Nr.',
  items: [
    ['Hocheffizienz-Umwälzpumpe', 'Stk'],
    ['Ausdehnungsgefäß 25 l', 'Stk'],
    ['Zündelektrode mit Dichtung', 'Stk'],
    ['Inhibitor für Heizungswasser', 'l'],
    ['Versandkosten', 'Pausch.'],
  ],
}

/** France. Not reviewed by a native speaker. */
const FRENCH: EuroWords = {
  title: 'Facture avec QR code SEPA',
  proves: 'the euro invoice from France: parts sold at France’s standard rate, its own words, and its amounts and dates as fr-FR prints them, every amount under a thousand so that no narrow no-break space groups its digits',
  labels: {
    number: 'Numéro de facture',
    issuedOn: 'Date de facture',
    servedOn: 'Date de livraison',
    dueOn: 'Échéance',
    customer: 'Client',
    street: 'Rue',
    buildingNumber: 'Numéro',
    postcode: 'Code postal',
    city: 'Ville',
    reference: 'Référence',
    article: 'Article',
    description: 'Désignation',
    quantity: 'Quantité',
    unit: 'Unité',
    unitPrice: 'Prix unitaire HT',
    amount: 'Montant HT',
  },
  heading: 'Facture',
  numberIs: `Facture n°${NBSP}: `,
  issuedOnIs: `Date${NBSP}: `,
  servedOnIs: `Livraison${NBSP}: `,
  dueOnIs: `Échéance${NBSP}: `,
  columns: ['Article', 'Désignation', 'Qté', 'Unité', 'Prix unit. HT', 'Montant HT'],
  net: 'Total HT',
  vat: (rate) => `TVA ${rate}${NBSP}%`,
  total: 'Total TTC',
  empty: 'Aucun article.',
  terms: ['Merci de régler le montant TTC au plus tard le ', ' par virement sur le compte ci-dessous, en indiquant la référence.'],
  bank: {
    heading: 'Coordonnées bancaires',
    paidTo: `Bénéficiaire${NBSP}: `,
    iban: `IBAN${NBSP}: `,
    bic: `BIC${NBSP}: `,
    amount: `Montant${NBSP}: `,
    reference: `Référence${NBSP}: `,
    scan: 'Ou scannez le code à gauche avec votre application bancaire.',
  },
  information: 'Facture ',
  vatNumber: 'TVA',
  items: [
    ['Circulateur haute efficacité', 'pce'],
    ['Vase d’expansion 25 l', 'pce'],
    ['Électrode d’allumage avec joint', 'pce'],
    ['Inhibiteur pour eau de chauffage', 'l'],
    ['Frais de port', 'forfait'],
  ],
}

/**
 * Italy. Italy has invoices between its residents made as electronic ones
 * and sent through the Sistema di Interscambio (as remembered, not re-read
 * for this sample: D.Lgs. 127/2015 art. 1 c. 3, as L. 205/2017 amended it,
 * which Normattiva, read on 17 October 2026, shows repealed by D.Lgs. 19
 * gennaio 2026, n. 10, the consolidated VAT code, in its text in force from
 * 1 January 2027), so a PDF is at most the courtesy copy a customer is
 * given, and this one says so, and where the original is: the copy given a
 * consumer says the original is in the customer's reserved area of the
 * Agenzia delle Entrate's site, as secondary sources read Provvedimento
 * 89757 of 30 April 2018, whose own text was not read. Not reviewed by a
 * native speaker.
 */
const ITALIAN: EuroWords = {
  title: 'Fattura con QR code SEPA',
  proves: 'the euro invoice from Italy: parts sold at Italy’s standard rate, its own words, its amounts and dates as it-IT prints them, and a courtesy copy’s notice',
  labels: {
    number: 'Numero fattura',
    issuedOn: 'Data fattura',
    servedOn: 'Data di consegna',
    dueOn: 'Scadenza',
    customer: 'Cliente',
    street: 'Via',
    buildingNumber: 'Numero civico',
    postcode: 'CAP',
    city: 'Città',
    reference: 'Riferimento',
    article: 'Articolo',
    description: 'Descrizione',
    quantity: 'Quantità',
    unit: 'Unità',
    unitPrice: 'Prezzo unitario',
    amount: 'Importo',
  },
  heading: 'Fattura',
  numberIs: 'Fattura n. ',
  issuedOnIs: 'Data: ',
  servedOnIs: 'Consegna: ',
  dueOnIs: 'Scadenza: ',
  columns: ['Articolo', 'Descrizione', 'Q.tà', 'Unità', 'Prezzo unit.', 'Importo'],
  net: 'Imponibile',
  vat: (rate) => `IVA ${rate}%`,
  total: 'Totale fattura',
  empty: 'Nessuna riga.',
  terms: ['Vi preghiamo di effettuare il bonifico entro il ', ' sul conto riportato qui sotto, indicando il riferimento.'],
  notice: { id: 'courtesy-copy', text: 'Copia di cortesia: l’originale della fattura elettronica, trasmessa tramite il Sistema di Interscambio, è a vostra disposizione nell’area riservata del sito dell’Agenzia delle Entrate.' },
  bank: { heading: 'Coordinate bancarie', paidTo: 'Beneficiario: ', iban: 'IBAN: ', bic: 'BIC: ', amount: 'Importo: ', reference: 'Riferimento: ', scan: 'Oppure inquadrate il codice a sinistra con la vostra app bancaria.' },
  information: 'Fattura ',
  vatNumber: 'P.IVA',
  items: [
    ['Circolatore ad alta efficienza', 'pz.'],
    ['Vaso di espansione 25 l', 'pz.'],
    ['Elettrodo di accensione con guarnizione', 'pz.'],
    ['Inibitore per acqua di riscaldamento', 'l'],
    ['Spese di spedizione', 'forfait'],
  ],
}

/** Spain. Not reviewed by a native speaker. */
const SPANISH: EuroWords = {
  title: 'Factura con código QR SEPA',
  proves: 'the euro invoice from Spain: parts sold at Spain’s standard rate, its own words, and its amounts and dates as es-ES prints them',
  labels: {
    number: 'Número de factura',
    issuedOn: 'Fecha de factura',
    servedOn: 'Fecha de entrega',
    dueOn: 'Vencimiento',
    customer: 'Cliente',
    street: 'Calle',
    buildingNumber: 'Número',
    postcode: 'Código postal',
    city: 'Población',
    reference: 'Referencia',
    article: 'Artículo',
    description: 'Descripción',
    quantity: 'Cantidad',
    unit: 'Unidad',
    unitPrice: 'Precio unitario',
    amount: 'Importe',
  },
  heading: 'Factura',
  numberIs: 'Factura n.º ',
  issuedOnIs: 'Fecha: ',
  servedOnIs: 'Entrega: ',
  dueOnIs: 'Vencimiento: ',
  columns: ['Artículo', 'Descripción', 'Cant.', 'Unidad', 'Precio unit.', 'Importe'],
  net: 'Base imponible',
  vat: (rate) => `IVA ${rate}${NBSP}%`,
  total: 'Total factura',
  empty: 'Ninguna línea.',
  terms: ['Le rogamos que transfiera el importe a más tardar el ', ' a la cuenta que figura abajo, indicando la referencia.'],
  bank: { heading: 'Datos bancarios', paidTo: 'Beneficiario: ', iban: 'IBAN: ', bic: 'BIC: ', amount: 'Importe: ', reference: 'Referencia: ', scan: 'O escanee el código de la izquierda con su app bancaria.' },
  information: 'Factura ',
  vatNumber: 'NIF',
  items: [
    ['Bomba circuladora de alta eficiencia', 'ud.'],
    ['Vaso de expansión 25 l', 'ud.'],
    ['Electrodo de encendido con junta', 'ud.'],
    ['Inhibidor para agua de calefacción', 'l'],
    ['Gastos de envío', 'ud.'],
  ],
}

/** The Netherlands. Not reviewed by a native speaker. */
const DUTCH: EuroWords = {
  title: 'Factuur met SEPA-QR-code',
  proves: 'the euro invoice from the Netherlands: parts sold at the Dutch standard rate, its own words, and its amounts and dates as nl-NL prints them',
  labels: {
    number: 'Factuurnummer',
    issuedOn: 'Factuurdatum',
    servedOn: 'Leverdatum',
    dueOn: 'Vervaldatum',
    customer: 'Klant',
    street: 'Straat',
    buildingNumber: 'Huisnummer',
    postcode: 'Postcode',
    city: 'Plaats',
    reference: 'Betalingskenmerk',
    article: 'Artikel',
    description: 'Omschrijving',
    quantity: 'Aantal',
    unit: 'Eenheid',
    unitPrice: 'Stukprijs',
    amount: 'Bedrag',
  },
  heading: 'Factuur',
  numberIs: 'Factuurnummer: ',
  issuedOnIs: 'Factuurdatum: ',
  servedOnIs: 'Leverdatum: ',
  dueOnIs: 'Vervaldatum: ',
  columns: ['Artikel', 'Omschrijving', 'Aantal', 'Eenheid', 'Stukprijs', 'Bedrag'],
  net: 'Totaal excl. btw',
  vat: (rate) => `Btw ${rate}%`,
  total: 'Totaal incl. btw',
  empty: 'Geen regels.',
  terms: ['Wij verzoeken u het factuurbedrag uiterlijk ', ' over te maken op de onderstaande rekening, onder vermelding van het betalingskenmerk.'],
  bank: { heading: 'Bankgegevens', paidTo: 'Begunstigde: ', iban: 'IBAN: ', bic: 'BIC: ', amount: 'Bedrag: ', reference: 'Betalingskenmerk: ', scan: 'Of scan de code links met uw bankapp.' },
  information: 'Factuur ',
  vatNumber: 'btw-id',
  items: [
    ['HR-circulatiepomp', 'st.'],
    ['Expansievat 25 l', 'st.'],
    ['Ontstekingselektrode met pakking', 'st.'],
    ['Inhibitor voor cv-water', 'l'],
    ['Verzendkosten', 'st.'],
  ],
}

/** Ireland. Not reviewed by a native speaker. */
const IRISH: EuroWords = {
  title: 'Invoice with an EPC QR code',
  proves: 'the euro invoice from Ireland: parts sold at Ireland’s standard rate, its own words, an address in Ireland’s order, and its amounts and dates as en-IE prints them',
  labels: {
    number: 'Invoice number',
    issuedOn: 'Invoice date',
    servedOn: 'Delivery date',
    dueOn: 'Due date',
    customer: 'Customer',
    street: 'Street',
    buildingNumber: 'Number',
    // The label of a field the Irish sample does not have, as its customer has no Eircode: an invoice made from it that prints one has its word.
    postcode: 'Eircode',
    city: 'Town',
    reference: 'Reference',
    article: 'Item no.',
    description: 'Description',
    quantity: 'Quantity',
    unit: 'Unit',
    unitPrice: 'Unit price',
    amount: 'Amount',
  },
  heading: 'Invoice',
  numberIs: 'Invoice number: ',
  issuedOnIs: 'Invoice date: ',
  servedOnIs: 'Delivery date: ',
  dueOnIs: 'Due date: ',
  columns: ['Item no.', 'Description', 'Qty', 'Unit', 'Unit price', 'Amount'],
  net: 'Subtotal',
  vat: (rate) => `VAT ${rate}%`,
  total: 'Total due',
  empty: 'No items.',
  terms: ['Please pay the total due by ', ' to the account below, quoting the reference.'],
  bank: { heading: 'Bank details', paidTo: 'Payee: ', iban: 'IBAN: ', bic: 'BIC: ', amount: 'Amount: ', reference: 'Reference: ', scan: 'Or scan the code on the left with your banking app.' },
  information: 'Invoice ',
  vatNumber: 'VAT No.',
  items: [
    ['High-efficiency circulation pump', 'pcs'],
    ['Expansion vessel 25 l', 'pcs'],
    ['Ignition electrode with seal', 'pcs'],
    ['Heating system inhibitor', 'l'],
    ['Shipping', 'flat rate'],
  ],
}

export const EURO_WORDS: Readonly<Record<EuroCountry, EuroWords>> = { DE: GERMAN, AT: AUSTRIAN, FR: FRENCH, IT: ITALIAN, ES: SPANISH, NL: DUTCH, IE: IRISH }
