/**
 * The e-invoice a report may carry: one EN 16931 invoice, written by the
 * runtime as CII from the very values the page prints (0027), of one of two
 * kinds: Factur-X 1.09.2 / ZUGFeRD 2.5.2 in the EN 16931 profile, the
 * hybrid a PDF/A-3b embeds (0031); or XRechnung 3.0, KoSIT's CIUS of EN
 * 16931 a German public buyer asks for, whose XML is the invoice and whose
 * PDF a copy (0038).
 *
 * It belongs to the report, not to a region, as a payment part does (0022):
 * one invoice per PDF. Its texts are runs, read as a paragraph's in the
 * report's scope and resolved whole before there are pages, since the XML
 * holds every one of them: none holds a page number or count. Its lines are
 * the rows of the report's table over the detail dataset: four of the
 * table's columns print each line's name, quantity, net price and net
 * amount, and the XML is written from what they resolved to, so the page and
 * the file read one evaluation of each line. The line's identifier, its unit
 * and its VAT category are codes a page need not print, read from each row.
 *
 * What each text may hold, and which of EN 16931's rules a value breaks,
 * `en16931.ts` says; the validator applies those rules to a text no data can
 * change, the runtime to every text once the data has resolved it.
 *
 * "BT" and "BG" are EN 16931's business terms and groups, "BR" its business
 * rules, as CEN/TC 434's CII artefacts 1.3.17 name them. Where a value
 * below is marked [S], it rests on phax/kaltblut's transcription of the
 * Factur-X 1.09.2 specification, which was not itself read: it is behind a
 * registration that has not been made.
 */
import type { RowValue } from './aggregates.js'
import type { Expression, Inline } from './values.js'

/** The kinds of e-invoice. A kind this version does not know is refused, never skipped. */
export const E_INVOICE_KINDS = ['facturX', 'xrechnung'] as const
export type EInvoiceKind = (typeof E_INVOICE_KINDS)[number]

/** The XRechnung versions this version writes: 3.0, the major and minor version its BT-24 names, of which KoSIT's 3.0.2 is the release the e-invoice gate's configuration pins. 4.0 is not backward compatible, and waits. */
export const XRECHNUNG_VERSIONS = ['3.0'] as const
export type XRechnungVersion = (typeof XRECHNUNG_VERSIONS)[number]

/** What names each XRechnung version: its specification identifier (BT-24), the release of KoSIT's it is read from, and the syntax it is written in. */
export interface XRechnungTerms {
  /** BT-24: `XR-CIUS-ID` of KoSIT's XRechnung schematron, which its scenario `EN16931 XRechnung (CII)` matches the XML by. */
  readonly guideline: string
  /** The release of KoSIT's XRechnung the gate's configuration pins (`docs/release/e-invoice-tools.json`), which the e-invoice gate holds it to on every run. */
  readonly release: string
  /** CII, the one syntax the runtime writes: UBL, which KoSIT takes too, would be a second writer of one invoice (0027, 0038). */
  readonly syntax: 'cii'
}

/**
 * Each version's names. A table over every version, so a version added to
 * `XRECHNUNG_VERSIONS` without them does not compile. BT-24 is
 * `XR-CIUS-ID` as `resources/xrechnung/3.0.2/xsl/XRechnung-CII-validation.xsl`
 * of KoSIT's configuration of 2026-08-31 builds it, read on 21 October
 * 2026; the e-invoice gate holds it to that file on every run, and KoSIT
 * matches the XRechnung sample to its scenario by it.
 */
export const XRECHNUNG: { readonly [V in XRechnungVersion]: XRechnungTerms } = {
  '3.0': { guideline: 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0', release: '3.0.2', syntax: 'cii' },
}

/** The Factur-X profiles this version writes: EN 16931 alone, which Germany counts as an e-invoice and FeRD recommends. */
export const E_INVOICE_PROFILES = ['en16931'] as const
export type EInvoiceProfile = (typeof E_INVOICE_PROFILES)[number]

/** The invoice type codes (BT-3, UNTDID 1001) this version writes: 380, a commercial invoice. No credit note yet. */
export const INVOICE_TYPE_CODES = ['380'] as const
export type InvoiceTypeCode = (typeof INVOICE_TYPE_CODES)[number]

/** The currencies (BT-5, ISO 4217) this version writes: EUR. A second would bring BT-6 and BT-111 with it. */
export const E_INVOICE_CURRENCIES = ['EUR'] as const
export type EInvoiceCurrency = (typeof E_INVOICE_CURRENCIES)[number]

/**
 * The VAT categories (BT-118, BT-151; UNCL 5305) this version writes:
 * standard rated, exempt from VAT, and reverse charge. CEN's BR-CL-17 and
 * BR-CL-18 take seven more, Z, K, G, O, L, M and B, which wait.
 */
export const VAT_CATEGORY_CODES = ['S', 'E', 'AE'] as const
export type VatCategoryCode = (typeof VAT_CATEGORY_CODES)[number]

/** The payment means (BT-81, UNTDID 4461) this version writes: 58, a SEPA credit transfer, and 30, a credit transfer. */
export const PAYMENT_MEANS_CODES = ['58', '30'] as const
export type PaymentMeansCode = (typeof PAYMENT_MEANS_CODES)[number]

/*
 * The closed lists. CEN's code-list rules are fatal, so a code outside its
 * list makes a file every validator refuses. Each list here is chosen and
 * narrower than CEN's: only a code someone chose is written. Every code was
 * found, on 17 October 2026, in the list of CEN/TC 434's CII artefacts
 * 1.3.17 (`schematron/codelist/EN16931-CII-codes.sch` in its
 * `en16931-cii-1.3.17.zip`)
 * and in that of the 1.3.16 artefacts KoSIT's XRechnung configuration of
 * 2026-08-31 runs; the e-invoice gate holds each list to its pinned
 * schematron's on every run. The meanings are UN/ECE's and ISO's, as
 * Peppol BIS Billing 3.0's code lists (May 2026 release) print them, read
 * the same day. Which codes to take, and whether copying them out of CEN's
 * artefact, which is EUPL-1.2, is acceptable under 0006, are the owner's
 * questions (0027).
 */

/**
 * The units of measure (BT-130; UN/ECE Recommendation 20, revision 11e) a
 * line's quantity may be in, and no other (BR-CL-23): the counted, time,
 * mass, length, area, volume and energy units a German invoice is written
 * in. CEN takes 2,162; the packaging codes of Recommendation 21 among them
 * wait.
 */
export const UNIT_CODES = [
  'C62', // one (synonym: unit)
  'H87', // piece
  'SET', // set
  'PR', // pair
  'LS', // lump sum
  'MIN', // minute
  'HUR', // hour
  'DAY', // day
  'WEE', // week
  'MON', // month
  'ANN', // year
  'GRM', // gram
  'KGM', // kilogram
  'TNE', // tonne (metric ton)
  'MTR', // metre
  'KMT', // kilometre
  'MTK', // square metre
  'MTQ', // cubic metre
  'MLT', // millilitre
  'LTR', // litre
  'KWH', // kilowatt hour
] as const
export type UnitCode = (typeof UNIT_CODES)[number]

/**
 * The countries (BT-40, BT-55; ISO 3166-1 alpha-2) a seller or a buyer may
 * be in, and no other (BR-CL-14): the 27 member states of the EU, the EEA's
 * Iceland, Liechtenstein and Norway, Switzerland, and the United Kingdom.
 * CEN takes 251. Greece is GR here, and EL only as a VAT prefix.
 */
export const COUNTRY_CODES = [
  'AT', // Austria
  'BE', // Belgium
  'BG', // Bulgaria
  'CY', // Cyprus
  'CZ', // Czechia
  'DE', // Germany
  'DK', // Denmark
  'EE', // Estonia
  'ES', // Spain
  'FI', // Finland
  'FR', // France
  'GR', // Greece
  'HR', // Croatia
  'HU', // Hungary
  'IE', // Ireland
  'IT', // Italy
  'LT', // Lithuania
  'LU', // Luxembourg
  'LV', // Latvia
  'MT', // Malta
  'NL', // Netherlands
  'PL', // Poland
  'PT', // Portugal
  'RO', // Romania
  'SE', // Sweden
  'SI', // Slovenia
  'SK', // Slovakia
  'IS', // Iceland
  'LI', // Liechtenstein
  'NO', // Norway
  'CH', // Switzerland
  'GB', // United Kingdom
] as const
export type CountryCode = (typeof COUNTRY_CODES)[number]

/**
 * The prefixes a VAT identifier (BT-31, BT-48) may begin with (BR-CO-09):
 * a country of `COUNTRY_CODES`, or EL, which Greece writes its VAT
 * identifiers with. BR-CO-09's message allows EL in both releases, but only
 * 1.3.16's test, which the pinned validators run, holds it; 1.3.17's does
 * not. EL is taken while the pinned oracle takes it, and the gate fails on
 * the release that does not.
 */
export const VAT_PREFIXES: readonly string[] = [...COUNTRY_CODES, 'EL']

/**
 * The schemes (BT-30-1, BT-47-1; ISO 6523 ICD) a legal registration
 * identifier may be given in, and no other (BR-CL-11). An identifier may be
 * given without one, as a German commercial register number is. France's
 * SIREN and SIRET, since a French buyer's SIREN is the one detail of
 * France's the XML holds; and the two that name a company anywhere. CEN
 * takes 246. The Leitweg-ID, 0204, which routes an invoice to a German
 * public buyer, is no legal registration: an XRechnung names it as the
 * buyer's reference (BT-10) and as an electronic address
 * (`ADDRESS_SCHEMES`, 0038).
 */
export const SCHEME_IDS = [
  '0002', // System Information et Repertoire des Entreprise et des Etablissements: SIRENE
  '0009', // SIRET-CODE
  '0060', // Data Universal Numbering System (D-U-N-S Number)
  '0088', // EAN Location Code (GS1's Global Location Number)
] as const
export type SchemeId = (typeof SCHEME_IDS)[number]

/**
 * The schemes (BT-34-1, BT-49-1; the CEF's Electronic Address Scheme code
 * list) an electronic address may be given in, and no other (BR-CL-25),
 * each code found on 20 October 2026 in BR-CL-25's list of the CEN 1.3.16
 * schematron KoSIT's configuration of 2026-08-31 runs and in list 17 of
 * FeRD's code database in Mustang 2.26.0, which the e-invoice gate holds
 * them to on every run (0037). CEN's list holds 104 codes and FeRD's 102,
 * counted that day; these are the five a German or a French invoice is
 * addressed by, their meanings as Peppol's EAS code list gives them:
 */
export const ADDRESS_SCHEMES = [
  'EM', // an email address
  '0204', // the Leitweg-ID, which a German public buyer is reached by
  '0225', // France's electronic addressing scheme (FRCTC ELECTRONIC ADDRESS)
  '9930', // a German VAT identifier
  '0088', // EAN Location Code (GS1's Global Location Number)
] as const
export type AddressScheme = (typeof ADDRESS_SCHEMES)[number]

/** What names each profile, in the XML and in the PDF that carries it. */
export interface FacturXProfileTerms {
  /** The specification identifier (BT-24), which the XML opens with. */
  readonly guideline: string
  /** The XMP's `fx:ConformanceLevel` [S]. */
  readonly conformanceLevel: string
  /** The embedded file's `/AFRelationship` [S]. */
  readonly relationship: 'Alternative'
}

/**
 * Each profile's names. A table over every profile, so a profile added to
 * `E_INVOICE_PROFILES` without them does not compile.
 * - BT-24 is the EN 16931 profile's identifier as the Factur-X 1.09.2
 *   schematron's code list 1 gives it (`FACTUR-X_EN16931_codedb.xml`, read
 *   in akretion's copy). Mustang refuses the old `urn:factur-x.eu:1p0:en16931`.
 * - `Alternative` is Germany's relationship for EN 16931, and one of the
 *   three France allows [S].
 */
export const FACTUR_X_PROFILES: { readonly [P in EInvoiceProfile]: FacturXProfileTerms } = {
  en16931: { guideline: 'urn:cen.eu:en16931:2017', conformanceLevel: 'EN 16931', relationship: 'Alternative' },
}

/**
 * The file a Factur-X PDF embeds, and the XMP that describes it [S]: the
 * name, the media type, the fx extension's namespace (its trailing `#`
 * required) and prefix, and the document type and the version it states.
 * The namespace is the transcription's section 6.3.1; its BR-HYBRID-04
 * gives it without `:invoice`, an inconsistency the transcription resolves
 * for section 6.3.1, as akretion's generator and PDFlib's sample do (0031).
 * No validator checks the namespace: Mustang reads the four properties by
 * local name, and veraPDF checks only that the extension schema describes
 * them. The renderer embeds what these say (0031), and its test holds the
 * PDF to the transcription's values, written there and not read from here;
 * the official package's XMP example, which would hold them to more, waits
 * for a registration with FeRD nobody here has made.
 */
export const FACTUR_X = {
  fileName: 'factur-x.xml',
  mediaType: 'text/xml',
  xmpNamespace: 'urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#',
  xmpPrefix: 'fx',
  documentType: 'INVOICE',
  version: '1.0',
} as const

/**
 * The names an expression reads in a report that is an e-invoice, beside
 * `EXPRESSION_NAMES`'s, and in no other report (0027, an addition to
 * 0007's names): `invoice` holds the document's totals (BG-22), and
 * `vatBasis` and `vatAmount` each declared VAT category's taxable and tax
 * amount (BG-23) by the category's id, null when no line is in it. The
 * runtime computes each once, from the lines, for the page and the XML
 * alike. They are read wherever `totals` is, except where they are
 * computed from: an aggregate's expression, the e-invoice's own, and the
 * columns that print a line's terms. The editing core refuses a read
 * there, and in any other report.
 */
export const E_INVOICE_NAMES = ['invoice', 'vatBasis', 'vatAmount'] as const
export type EInvoiceName = (typeof E_INVOICE_NAMES)[number]

/**
 * The members of `invoice`, each one of the document's totals (BG-22), as a
 * refusal names it: every one a decimal of two places in the invoice's
 * currency. With no allowances and no charges, the total without VAT is
 * the sum of the lines. `paid` is a member only of an invoice that
 * declares a paid amount, and is what that gives; with none, the amount
 * due is the total with VAT.
 */
export const INVOICE_TOTALS = {
  lineTotal: 'the sum of the invoice line net amounts (BT-106)',
  taxBasisTotal: 'the invoice total amount without VAT (BT-109)',
  taxTotal: 'the invoice total VAT amount (BT-110)',
  grandTotal: 'the invoice total amount with VAT (BT-112)',
  paid: 'the paid amount (BT-113)',
  duePayable: 'the amount due for payment (BT-115)',
} as const
export type InvoiceTotal = keyof typeof INVOICE_TOTALS

/** What `vatBasis` and `vatAmount` hold of each declared category, as a refusal names it. */
export const VAT_BREAKDOWN: { readonly [N in Exclude<EInvoiceName, 'invoice'>]: string } = {
  vatBasis: 'the VAT category taxable amount (BT-116)',
  vatAmount: 'the VAT category tax amount (BT-117)',
}

/**
 * A postal address (BG-5, BG-8): the first line, the post code, the city
 * and the country are needed, the second line may be left out. Each is
 * runs; the country is a code of `COUNTRY_CODES`.
 */
export interface EInvoiceAddress {
  readonly line1: readonly Inline[]
  readonly line2?: readonly Inline[]
  readonly postalCode: readonly Inline[]
  readonly city: readonly Inline[]
  readonly country: readonly Inline[]
}

/** A legal registration identifier (BT-30, BT-47), and the scheme it is given in, if one. */
export interface LegalIdentifier {
  readonly id: readonly Inline[]
  readonly scheme?: SchemeId
}

/**
 * An electronic address (BT-34, BT-49), where the party is sent the
 * invoice, and the scheme it is given in (BT-34-1, BT-49-1), which EN
 * 16931 needs with it (BR-62, BR-63): a code of `ADDRESS_SCHEMES`.
 */
export interface ElectronicAddress {
  readonly id: readonly Inline[]
  readonly scheme: AddressScheme
}

/**
 * The seller's contact (BG-6): its contact point (BT-41), a person or a
 * department, its telephone number (BT-42) and its email address (BT-43).
 * EN 16931 lets each be left out; a contact here gives all three, as
 * XRechnung asks (BR-DE-5, -6, -7), so that one contact serves either.
 */
export interface SellerContact {
  readonly name: readonly Inline[]
  readonly telephone: readonly Inline[]
  readonly email: readonly Inline[]
}

/** The seller (BG-4): its name (BT-27), its VAT identifier (BT-31), its tax number (BT-32), its legal registration (BT-30), its electronic address (BT-34), its contact (BG-6) and its address (BG-5). */
export interface EInvoiceSeller {
  readonly name: readonly Inline[]
  readonly vatId?: readonly Inline[]
  readonly taxNumber?: readonly Inline[]
  readonly legalId?: LegalIdentifier
  readonly electronicAddress?: ElectronicAddress
  readonly contact?: SellerContact
  readonly address: EInvoiceAddress
}

/** The buyer (BG-7): its name (BT-44), its VAT identifier (BT-48), its legal registration (BT-47), its electronic address (BT-49) and its address (BG-8). A buyer has no BT-32, and its contact (BG-9) is not written. */
export interface EInvoiceBuyer {
  readonly name: readonly Inline[]
  readonly vatId?: readonly Inline[]
  readonly legalId?: LegalIdentifier
  readonly electronicAddress?: ElectronicAddress
  readonly address: EInvoiceAddress
}

/**
 * A VAT category the invoice's lines are in, one VAT breakdown (BG-23) each
 * when a line uses it.
 */
export interface VatCategory {
  /** A field key: what the page reads its basis and its amount as, `vatBasis.<id>` and `vatAmount.<id>`, and what a line names it by. */
  readonly id: string
  readonly code: VatCategoryCode
  /** The rate in per cent (BT-119, BT-152), an exact decimal: more than 0 when standard rated, 0 otherwise. */
  readonly rate: string
  /** The exemption reason (BT-120): needed for E and AE, never for S. */
  readonly reason?: readonly Inline[]
}

/** The invoicing period (BG-14): its start (BT-73), its end (BT-74), or both. */
export interface InvoicingPeriod {
  readonly start?: Expression
  readonly end?: Expression
}

/**
 * The lines (BG-25), one per row of the table over the detail dataset. The
 * name, the quantity, the net price and the net amount are column ids of
 * that table: what each column prints, once per row, is what the line
 * holds. The identifier, the unit and the VAT category are read from each
 * row, as an aggregate reads it.
 */
export interface EInvoiceLines {
  /** The id of the table over the detail dataset. */
  readonly table: string
  /** The column that prints the item name (BT-153). */
  readonly name: string
  /** The column that prints the invoiced quantity (BT-129). */
  readonly quantity: string
  /** The column that prints the item net price (BT-146). */
  readonly netPrice: string
  /** The column that prints the line net amount (BT-131), a whole number of cents. */
  readonly netAmount: string
  /** The line identifier (BT-126). */
  readonly id: RowValue
  /** The unit of measure (BT-130), a code of `UNIT_CODES`. */
  readonly unit: RowValue
  /** The id of the line's VAT category (BT-151, BT-152): one the invoice declares. */
  readonly vat: RowValue
}

/** The payment instructions (BG-16): how the invoice is paid, and to which account. */
export interface PaymentInstructions {
  /** BT-81. */
  readonly means: PaymentMeansCode
  /** The payment account (BT-84): an IBAN. Spaces are for reading, and are dropped. */
  readonly iban: readonly Inline[]
  /** The BIC of the account's bank (BT-86). */
  readonly bic?: readonly Inline[]
  /** The account's name (BT-85). */
  readonly accountName?: readonly Inline[]
  /** The remittance information (BT-83): what a payer writes on the transfer. */
  readonly remittance?: readonly Inline[]
}

/**
 * What an invoice of either kind holds: EN 16931's terms, as 0027 and 0037
 * give them. Each text is runs, one at least where it is present; an
 * optional one absent is a term the XML leaves out, never an empty list of
 * runs, so that one invoice has one spelling and one hash. Each expression
 * is compiled and typed by the editing core: the dates are dates, the paid
 * amount a decimal.
 */
export interface EInvoiceTerms {
  /** BT-3. */
  readonly type: InvoiceTypeCode
  /** BT-5. */
  readonly currency: EInvoiceCurrency
  /** The invoice number (BT-1). */
  readonly number: readonly Inline[]
  /** The issue date (BT-2). */
  readonly issued: Expression
  /** The business process (BT-23): the context the buyer's system routes the invoice in, an identifier such as Peppol's `urn:fdc:peppol.eu:2017:poacc:billing:01:1.0`. */
  readonly businessProcess?: readonly Inline[]
  readonly seller: EInvoiceSeller
  readonly buyer: EInvoiceBuyer
  /** The buyer's reference (BT-10). */
  readonly buyerReference?: readonly Inline[]
  /** The actual delivery date (BT-72). A delivery date, a period or both: a German invoice says when it was supplied. */
  readonly delivered?: Expression
  readonly period?: InvoicingPeriod
  /** The VAT categories its lines may be in, one at least. */
  readonly vat: readonly VatCategory[]
  readonly lines: EInvoiceLines
  readonly payment?: PaymentInstructions
  /** The payment due date (BT-9). */
  readonly due?: Expression
  /** The payment terms (BT-20), where a Skonto is written. */
  readonly terms?: readonly Inline[]
  /** The amount already paid (BT-113), a whole number of cents. */
  readonly paid?: Expression
}

/** A Factur-X invoice in the EN 16931 profile: the hybrid whose XML a PDF/A-3b embeds (0031). */
export interface FacturXInvoice extends EInvoiceTerms {
  readonly kind: 'facturX'
  readonly profile: EInvoiceProfile
}

/**
 * An XRechnung (0038): EN 16931's terms in KoSIT's CIUS, written as CII,
 * with what its schematron needs past EN 16931 -- the business process
 * (PEPPOL-EN16931-R001), the buyer's reference (BR-DE-15), the payment
 * instructions (BR-DE-1), the seller's contact (BR-DE-2) and both
 * electronic addresses (PEPPOL-EN16931-R020, -R010) -- each needed here.
 * Its XML is the invoice; a PDF of it is a copy, and says so on every page.
 */
export interface XRechnungInvoice extends EInvoiceTerms {
  readonly kind: 'xrechnung'
  readonly version: XRechnungVersion
  readonly businessProcess: readonly Inline[]
  readonly seller: EInvoiceSeller & { readonly electronicAddress: ElectronicAddress; readonly contact: SellerContact }
  readonly buyer: EInvoiceBuyer & { readonly electronicAddress: ElectronicAddress }
  /** A public buyer's Leitweg-ID, or the reference a business buyer asks for. */
  readonly buyerReference: readonly Inline[]
  readonly payment: PaymentInstructions
}

export type EInvoice = FacturXInvoice | XRechnungInvoice
