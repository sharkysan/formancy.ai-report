import type { Party } from './invoice-words.js'

/**
 * What the euro invoice bills, whom, at what rate and to which account, in
 * each country it is a sample of: the starter's Germany, and Austria,
 * France, Italy, Spain, the Netherlands and Ireland. The words each prints
 * are `euro-invoice-words.ts`'s; this file changes when a rate, a register
 * or an invented party does.
 *
 * **What they bill.** The German starter maintains a private home's gas
 * boiler. The samples sell that boiler's parts to a private customer and
 * install nothing: a home's maintenance is taxed at a reduced rate in
 * France and Ireland, by the French administration's and Revenue's own
 * pages, and in Italy by secondary sources; Spain's reduced rate for it
 * asks that materials be at most 40 % of the base, which the starter's
 * parts, about 54 % of its net amount, are not, by secondary sources too.
 * A sale of parts without installation takes the standard rate, by this
 * repository's reading and not a tax adviser's (0028). They share one list
 * of quantities and prices, `PARTS`, so that the six differ in nothing but
 * country.
 *
 * **The rates** are each country's standard rate as the EU's Your Europe
 * table, "List of VAT rates applied in EU member countries", gave it on 17
 * October 2026, the page saying "Last checked: 13/07/2026":
 * https://europa.eu/youreurope/business/taxation/vat/vat-rules-rates/index_en.htm
 * -- Germany 19, Austria 20, France 20, Italy 22, Spain 21, the Netherlands
 * 21, Ireland 23. Nothing here reads them again; a change reaches the
 * samples by a commit.
 *
 * **The accounts** are IBANs of a bank code that country's register gives
 * no bank, where the register could be read, and otherwise IBANs of a bank
 * code chosen, of which nothing more is claimed. Each was made the
 * starter's way: the bank code, an account of `...12345678`, every
 * national check digit the country's IBAN carries computed first (France's
 * RIB key, Italy's CIN, Spain's two DC digits, each rule checked against
 * the example SWIFT's IBAN Registry gives), then ISO 13616's in BigInt.
 * The samples' tests compute each national digit again, and report-spec's
 * own `checkEpcIban` and `epcPairing` hold each IBAN, refusing each with a
 * typo. Read on 17 October 2026:
 * - **Germany** (the starter's): bank code 01234567. The Bundesbank's
 *   Bankleitzahlendatei "gültig vom 07.09.2026 bis 06.12.2026",
 *   https://www.bundesbank.de/de/aufgaben/unbarer-zahlungsverkehr/serviceangebot/bankleitzahlen/download-bankleitzahlen-602592,
 *   its text file, holds 13,760 records, every bank code starting with a
 *   digit from 1 to 8, and no BIC starting FMNC.
 * - **Austria**: bank code 80123. The OeNB's SEPA directory,
 *   "SEPA-Verzeichnis-Abfrage vom 16.10.2026",
 *   https://www.oenb.at/docroot/downloads_observ/sepa-zv-vz_gesamt.csv,
 *   holds 874 bank codes, none starting with 8, and no BIC starting FMNC.
 * - **France**: bank code 01234, branch 00012, RIB key 80. The ACPR's
 *   register REGAFI, dataset prd-banque-entites of 16 October 2026,
 *   https://www.regafi.fr/api/explore/v2.1/catalog/datasets/prd-banque-entites/exports/json,
 *   holds 840 codes interbancaires, the Banque de France's 30001 among
 *   them, and none from 00011 to 09812: those starting with 0 are 00006,
 *   00010, and 09813 to 09999.
 * - **Italy**: ABI 00000, CAB 00012, CIN N. The Banca d'Italia's register,
 *   https://infostat.bancaditalia.it/GIAVAInquiry-public/ng/, answered
 *   its API with "Risorsa Protetta" and could not be read: this IBAN's
 *   check digits are right and it was made with that ABI, and nothing
 *   more is claimed of it.
 * - **Spain**: entity 0000, office 0012, DC 70. The Banco de España's
 *   Registro de entidades, "FECHA: 15/10/2026",
 *   https://www.bde.es/f/webbe/SGE/regis/ficheros/es/Registro_Entidades.xlsx,
 *   gives entities since struck off as well as those registered: 2,215
 *   distinct codes of four digits, from 0001 to 9891, beside codes of a
 *   letter and digits for other kinds of entity, and none 0000 (the Banco
 *   de España's own 9000 is not among them).
 * - **The Netherlands**: bank identifier FMNC. The Betaalvereniging's BIC
 *   list, "Laatste update 02-09-2026",
 *   https://www.betaalvereniging.nl/wp-content/uploads/2025/11/BIC-lijst-NL.xlsx,
 *   holds 98 identifiers, none FMNC; the account, 0123456789, also passes
 *   the old Dutch eleven test.
 * - **Ireland**: bank code FMNC, sort code 000000. No public file of
 *   IPSO's sort codes was found, and SWIFT's directory of BICs was not
 *   read: this IBAN's check digits are right and it was made with that
 *   code, and nothing more is claimed of it.
 *
 * **The BICs** are test BICs, a 0 as their location's second character, as
 * the starter's (ISO 9362, as Wikipedia's article on it gives it), each of
 * its IBAN's country; no BIC in the Dutch list has a 0 there.
 *
 * **The VAT numbers** are each format's familiar sample, and each fails its
 * country's check: DE123456789's last digit is not the check digit ISO
 * 7064's MOD 11,10 gives the eight before it; ATU12345678's check digit is
 * 5; FR32123456789's key is right and its SIREN, 123456789, which the
 * French sample prints too, fails the Luhn check every SIREN passes; the
 * partita IVA 12345678901's check digit is 3; B12345678's control digit is
 * 4; NL123456789B01 fails both the eleven test and the mod-97 test;
 * IE1234567X's check letter is T, and X is never one -- IE1234567T, the
 * familiar sample, would be valid, so it is not used. No test holds these;
 * they were computed on 17 October 2026.
 *
 * **What a company's invoice says of it.** France's administration asks
 * for its legal form and share capital and its SIREN (service-public.fr,
 * F31808, "Vérifié le 11 août 2026", read on 17 October 2026), which the
 * French sample prints. What the other countries ask -- an Italian private
 * customer's codice fiscale and an S.r.l.'s REA number and capital, a
 * Spanish full invoice's customer NIF, a Dutch firm's KvK number, an
 * Austrian one's Firmenbuch number -- is 0028's, and the samples do not
 * print it.
 *
 * **The firms and customers** are invented, each customer the name its
 * country uses for nobody in particular. Nobody checked that no business
 * is at these addresses; Ireland's customer has no Eircode, which would
 * name one real address.
 */

export type EuroCountry = 'DE' | 'AT' | 'FR' | 'IT' | 'ES' | 'NL' | 'IE'

/** A standard rate in whole percent, from 10 to 29: every rate the table read gives these countries, and one the arithmetic writes as `0.RR` and `1.RR` exactly. */
export type WholeRate = `${1 | 2}${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`

/** A part of the customer's address, by the field of the data that holds it. */
export type AddressPart = 'street' | 'buildingNumber' | 'postcode' | 'city'

/** One country's invoice: whom it is from and to, what it bills, at what rate, paid to which account. */
export interface EuroBilling {
  readonly id: string
  readonly locale: 'de-DE' | 'de-AT' | 'fr-FR' | 'it-IT' | 'es-ES' | 'nl-NL' | 'en-IE'
  readonly rate: WholeRate
  /**
   * The firm the invoice is from and the code pays: one spelling of its
   * name, for the code and for what is printed beside it; its address
   * lines; its VAT number; and what else its country asks a company's
   * invoice to say of it, after the VAT number.
   */
  readonly firm: { readonly name: string; readonly address: readonly string[]; readonly vatNumber: string; readonly legal?: readonly string[] }
  /** The account, as the details beside the code print it: in groups of four. */
  readonly iban: string
  readonly bic: string
  /** Austria's frame and caption, where its sample wears them. */
  readonly caption?: 'zahlenMitCode'
  /** The customer's two address lines, in the order the country writes their parts, and whether a comma parts the street's name from its number, as Spain and Italy write "Calle Mayor, 12". */
  readonly address: { readonly street: readonly AddressPart[]; readonly town: readonly AddressPart[]; readonly comma?: true }
  readonly customer: Party
  readonly number: string
  /** An ISO 11649 creditor reference of the invoice's number, its check digits computed as the IBAN's are. */
  readonly reference: string
  readonly issuedOn: string
  readonly servedOn: string
  readonly dueOn: string
  /** What the article numbers begin with, and the first. */
  readonly articles: { readonly prefix: string; readonly first: number }
  /** Each line's quantity and unit price, exact to the cent, in the order the words give their descriptions. */
  readonly work: readonly (readonly [quantity: string, unitPrice: string])[]
}

/** The German starter's work: the boiler's maintenance, the technician's time, the parts and the call-out. */
const MAINTENANCE = [
  ['1.00', '189.00'],
  ['2.75', '76.00'],
  ['1.00', '312.00'],
  ['1.00', '148.00'],
  ['1.00', '31.50'],
  ['12.50', '1.85'],
  ['1.00', '39.00'],
] as const

/** The samples' order: the circulation pump, the expansion vessel, the ignition electrode, the inhibitor and the shipping, at the starter's prices for the parts. */
const PARTS = [
  ['1.00', '312.00'],
  ['1.00', '148.00'],
  ['1.00', '31.50'],
  ['12.50', '1.85'],
  ['1.00', '9.90'],
] as const

/** The order most of the countries write an address in: the street and then the number, the postcode and then the town. */
const STREET_FIRST = { street: ['street', 'buildingNumber'], town: ['postcode', 'city'] } as const

/** The same order, a comma after the street's name. */
const STREET_COMMA = { ...STREET_FIRST, comma: true } as const

/** The dates every sample bears: issued and delivered in the same week, due a fortnight after its issue. */
const SAMPLE_DATES = { issuedOn: '2026-10-15', servedOn: '2026-10-13', dueOn: '2026-10-29' } as const

/** The articles every sample bills, the parts' numbers. */
const SAMPLE_ARTICLES = { prefix: 'P', first: 4001 } as const

export const EURO_COUNTRIES: Readonly<Record<EuroCountry, EuroBilling>> = {
  DE: {
    id: 'euro-invoice',
    locale: 'de-DE',
    rate: '19',
    firm: { name: 'Formancy Haustechnik GmbH', address: ['Industriestraße 7', '50735 Köln'], vatNumber: 'DE123456789' },
    iban: 'DE83 0123 4567 0012 3456 78',
    bic: 'FMNCDEF0XXX',
    address: STREET_FIRST,
    // The name and address the German identity card's specimen bears.
    customer: { name: 'Erika Mustermann', street: 'Heidestraße', buildingNumber: '17', postalCode: '51147', town: 'Köln' },
    number: 'RE-2026-0815',
    reference: 'RF72 2026 0815',
    issuedOn: '2026-10-15',
    servedOn: '2026-10-08',
    dueOn: '2026-10-29',
    articles: { prefix: 'H', first: 3001 },
    work: MAINTENANCE,
  },
  AT: {
    id: 'euro-invoice-at',
    locale: 'de-AT',
    rate: '20',
    firm: { name: 'Formancy Haustechnik GmbH', address: ['Gewerbestraße 7', '4020 Linz'], vatNumber: 'ATU12345678' },
    iban: 'AT93 8012 3000 1234 5678',
    bic: 'FMNCATW0XXX',
    caption: 'zahlenMitCode',
    address: STREET_FIRST,
    customer: { name: 'Max Mustermann', street: 'Hauptstraße', buildingNumber: '12', postalCode: '4600', town: 'Wels' },
    number: 'RE-2026-0904',
    reference: 'RF94 2026 0904',
    ...SAMPLE_DATES,
    articles: SAMPLE_ARTICLES,
    work: PARTS,
  },
  FR: {
    id: 'euro-invoice-fr',
    locale: 'fr-FR',
    rate: '20',
    // The legal form, its share capital and its SIREN, which a company's
    // invoice states in France (service-public.fr, F31808), the capital
    // under a thousand so that no grouping mark prints.
    firm: {
      name: 'Formancy Chauffage SAS',
      address: ['7 rue de l’Industrie', '31200 Toulouse'],
      vatNumber: 'FR32123456789',
      legal: ['SAS au capital de 500 €', 'SIREN 123 456 789'],
    },
    iban: 'FR76 0123 4000 1200 0123 4567 880',
    bic: 'FMNCFRP0XXX',
    address: { street: ['buildingNumber', 'street'], town: ['postcode', 'city'] },
    customer: { name: 'Jean Dupont', street: 'rue de la République', buildingNumber: '12', postalCode: '69002', town: 'Lyon' },
    number: 'FA-2026-0517',
    reference: 'RF67 2026 0517',
    ...SAMPLE_DATES,
    articles: SAMPLE_ARTICLES,
    work: PARTS,
  },
  IT: {
    id: 'euro-invoice-it',
    locale: 'it-IT',
    rate: '22',
    // The partita IVA as Italy writes it at home, without the IT a VAT number carries abroad.
    firm: { name: 'Formancy Termotecnica S.r.l.', address: ['Via dell’Industria, 7', '20141 Milano'], vatNumber: '12345678901' },
    iban: 'IT53 N000 0000 0120 0001 2345 678',
    bic: 'FMNCITM0XXX',
    address: STREET_COMMA,
    customer: { name: 'Mario Rossi', street: 'Via Roma', buildingNumber: '15', postalCode: '10121', town: 'Torino' },
    number: 'FT-2026-0623',
    reference: 'RF18 2026 0623',
    ...SAMPLE_DATES,
    articles: SAMPLE_ARTICLES,
    work: PARTS,
  },
  ES: {
    id: 'euro-invoice-es',
    locale: 'es-ES',
    rate: '21',
    firm: { name: 'Formancy Calefacción S.L.', address: ['Calle de la Industria, 7', '28045 Madrid'], vatNumber: 'B12345678' },
    iban: 'ES25 0000 0012 7000 1234 5678',
    bic: 'FMNCESM0XXX',
    address: STREET_COMMA,
    // The name the Spanish identity card's specimen bears.
    customer: { name: 'Carmen Española Española', street: 'Calle Mayor', buildingNumber: '12', postalCode: '46001', town: 'Valencia' },
    number: 'F2026-0318',
    reference: 'RF08 2026 0318',
    ...SAMPLE_DATES,
    articles: SAMPLE_ARTICLES,
    work: PARTS,
  },
  NL: {
    id: 'euro-invoice-nl',
    locale: 'nl-NL',
    rate: '21',
    firm: { name: 'Formancy Installatietechniek B.V.', address: ['Industrieweg 7', '3044 AS Rotterdam'], vatNumber: 'NL123456789B01' },
    iban: 'NL17 FMNC 0123 4567 89',
    bic: 'FMNCNL20XXX',
    address: STREET_FIRST,
    customer: { name: 'Jan Jansen', street: 'Kerkstraat', buildingNumber: '12', postalCode: '3511 LX', town: 'Utrecht' },
    number: 'F-2026-0729',
    reference: 'RF66 2026 0729',
    ...SAMPLE_DATES,
    articles: SAMPLE_ARTICLES,
    work: PARTS,
  },
  IE: {
    id: 'euro-invoice-ie',
    locale: 'en-IE',
    rate: '23',
    firm: { name: 'Formancy Heating Supplies Ltd', address: ['7 Industry Road', 'Cork'], vatNumber: 'IE1234567X' },
    iban: 'IE30 FMNC 0000 0012 3456 78',
    bic: 'FMNCIE20XXX',
    // The number before the street, and a town line without a postcode: neither its dataset nor its data has one.
    address: { street: ['buildingNumber', 'street'], town: ['city'] },
    customer: { name: 'Joe Bloggs', street: 'Main Street', buildingNumber: '14', postalCode: '', town: 'Ennis, Co. Clare' },
    number: 'INV-2026-0442',
    reference: 'RF55 2026 0442',
    ...SAMPLE_DATES,
    articles: SAMPLE_ARTICLES,
    work: PARTS,
  },
}
