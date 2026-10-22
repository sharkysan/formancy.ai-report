# @formancy/report-spec

The Formancy Report definition: what a report template is, whether a document
is a valid one, and the hash that names it. No framework, no PDF engine, no
Node. Why a report is a document of its own, and what it holds, is decision
[0007](../../docs/decisions/0007-a-report-definition-is-its-own-versioned-document.md).

## Validate

```ts
import { validateReport } from '@formancy/report-spec'

const outcome = validateReport(JSON.parse(text))
if (!outcome.valid) {
  for (const error of outcome.errors) {
    // error.code is stable ('unknown-field', 'misplaced-detail-field', ...),
    // error.path a JSON Pointer, error.componentId the component it is in.
    console.warn(`${error.path}: ${error.message}`)
  }
} else {
  render(outcome.report) // a ReportDefinition, read once, sharing nothing with the input
}
```

`validateReport` takes anything and never throws. It refuses:

- a formancy form, named as one, and a report of another version;
- anything a shape does not have, and every reference to something the
  report does not declare;
- a value standing where it has none: a detail field outside the table's
  cells, a page number outside the page header and footer or anywhere in a
  QR code, an EPC QR code or a QR-bill, whose content is resolved before
  there are pages;
- a QR code of no runs, which would encode nothing;
- a fixed size the page cannot hold, a QR code's and an EPC QR code's
  square measured against `squareRoom`;
- a payment part on a page other than A4 in portrait, or whose top margin
  reaches past the slip's top (`QR_BILL_TOP`, 544.25 pt), refused as
  `payment-part-page` on `/page` or `/page/margins/top`; and a text of its
  QR-bill, written in literal runs, that SIX's rules refuse
  (`invalid-qr-bill`);
- an EPC QR code that the EPC's rules refuse where it is written
  (`invalid-epc-qr-code`): a literal text that breaks its rule, a reference
  and a text together, a BIC its IBAN does not go with or none where one is
  needed, literal texts already past 331 bytes, or, with Austria's caption,
  a size in which no version prints the modules the PSA allows with a
  symbol as tall as the caption beside it;
- an e-invoice that EN 16931's rules, or this version's narrower ones,
  refuse where it is written (`invalid-e-invoice`), each refusal naming the
  business term and the rule: a literal text, code or rate that breaks its
  rule; parties, a time of supply, a period or VAT categories that cannot
  make a valid invoice; lines that are not what the table over the detail
  dataset prints; a QR-bill or an EPC QR code that asks to be paid to
  another account, or a QR-bill in another currency; or a title holding
  `&`, `<` or `>`;
- a dataset read from a formancy form's submissions
  ([0042](../../docs/decisions/0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md))
  that is not read whole -- a field of it that says nowhere it is read, or
  one dataset read from a form beside one that is not
  (`incomplete-form-binding`) -- or that reads what it is not: the header
  rows, the detail one record, or a header beside a detail of one row per
  submission (`misplaced-form-binding`); a data path or a repeater that is
  not field keys joined by dots, at most `MAX_FORM_PATH_KEYS` of them, or
  an empty member (`invalid-form-path`); and a field that says how a
  choice prints but is no string (`binding-type-mismatch`).

**Read from a form.** A dataset contract may say what of a formancy
form's submissions it reads, and each of its fields where:

```ts
{ id: 'visit', form: { kind: 'submission' }, fields: [{ id: 'inspector', type: 'string', label: 'Inspector', nullable: true, form: { path: 'inspector.name' } }] }
{ id: 'findings', form: { kind: 'repeater', repeater: 'findings' }, fields: [{ id: 'severity', type: 'string', label: 'Severity', nullable: true, form: { path: 'severity', read: 'value' } }] }
```

A path is in the dataset's scope, the submission's or a repeater row's; a
`member` names a matrix row or an option of ticked boxes; a choice prints
its label, or its stored value with `read: 'value'`. The label has no
spelling of its own, and `read: 'label'` is refused, so that one binding
has one hash. The binding names no form, and is part of the report's hash. Whether a version of a
form holds a field there is `@formancy/report-forms`' to say, per render;
`isFormPath` is the syntax a path is held to.

A message names the field and the rule, and never quotes a payment code's
text. It reports up to `MAX_ERRORS` errors and says when there were more.
It checks structure, and what a payment code's literal texts say: whether
an expression compiles, what a code's data resolves to, and whether the
rendered output fits, are the runtime's and the renderer's questions.

## A QR-bill

A report may carry one payment part, `paymentPart`: a Swiss QR-bill, printed
at the foot of its last page
([0022](../../docs/decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)).
Its texts are runs, as a paragraph's: the account, both parties' structured
addresses, the reference, the message and the billing information. Its
amount is an expression; its language is one of SIX's five, its currency
CHF or EUR.

```ts
import { checkQrBillAccount, checkQrBillAmount, checkQrBillReference, checkQrBillText, emptyReport, QR_BILL_ADDRESS_RULES, QR_BILL_SIZE, QR_BILL_TOP, qrBillPageBreak, qrBillPairing } from '@formancy/report-spec'

checkQrBillAccount('CH44 3199 9123 0008 8901 2') // { ok: true, value: { iban: 'CH4431999123000889012', qrIban: true } }
checkQrBillReference('RF18 5390 0754 7034') // { ok: true, value: { type: 'SCOR', reference: 'RF18539007547034' } }
checkQrBillText('Seldwyla ', QR_BILL_ADDRESS_RULES.town) // { ok: true, value: 'Seldwyla' }
checkQrBillAmount('1191.005') // { ok: false, rule: 'has more than two decimals; ...' }
qrBillPairing('qrIban', 'SCOR', 'CHF') // [{ field: 'reference', rule: 'a QR-IBAN is paid to with a QR reference, ...' }]
QR_BILL_SIZE // { width: 595.28, height: 297.64 }: 210 by 105 mm
QR_BILL_TOP // 544.25: the slip's top, in points down the A4 page
const { page } = emptyReport('invoice', 'Rechnung', 'de-CH') // A4 portrait, 20 mm margins
qrBillPageBreak(page) // undefined: the slip has its room
qrBillPageBreak({ ...page, margins: { ...page.margins, top: 544.26 } }) // { field: 'topMargin', rule: "the top margin reaches 544.26 pt down the page, past the top of the QR-bill's slip at 544.25 pt, ..." }
qrBillPageBreak(page, 500) // the same rule, 500 pt a render measured above the slip counted with the margin: 'the top margin, with the page header ..., reaches 556.69 pt ...'
```

These are the rules of SIX's Swiss Implementation Guidelines for the
QR-bill, version 2.3, and version 2.4's QR-IBAN and QR reference for CHF
only. The validator applies them to a text no data can change; the runtime
applies the same functions to what the data resolves a text to. A rule
broken is said without the value. `qrBillPageBreak` is the page's rule:
the validator passes the page alone, and the renderer, which reaches it
through the runtime, adds the page header's height and the instruction to
separate above the slip, so a header that reaches into the slip is
refused only by a render, in the same words. What they do not check:

- that a country code is one ISO 3166-1 assigns, beyond two capitals;
- the syntax of the billing information past its leading `//` and the
  two characters that name it;
- a postal code written with its country's prefix, which SIX forbids and
  no pattern tells from a country whose codes begin with letters;
- the code's 997 characters, which only the whole bill has.

`QR_BILL_EXAMPLE_ACCOUNTS` lists the accounts of SIX's examples (IG 2.4,
Annex A), as the code holds them: accounts to test with, which pay no
creditor. `QR_BILL_EXAMPLE` is what a builder starts a bill from, as SIX
prints it: example 3's account and creditor, example 1's debtor, and
example 1's QR reference, which a bill whose account is made a QR-IBAN is
given. report-core warns of a bill that holds any of them, written in the
report
([0039](../../docs/decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)).

## An EPC QR code

A component, `epcQrCode`, prints the code a SEPA credit transfer is
initiated from: the European Payments Council's EPC069-12, version 3.1
([0025](../../docs/decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).
It stands wherever a QR code may; Austria's PSA asks for the lower edge of
the page, where the author puts it. Its beneficiary, IBAN, BIC, reference,
text and information are runs, as a paragraph's; its amount is an
expression; its purpose is four capital letters; and its `caption`,
`'zahlenMitCode'`, draws Austria's frame and "Zahlen mit Code" inside its
square. A reference and a text are never both given.

```ts
import { checkEpcAmount, checkEpcField, checkEpcIban, checkEpcReference, epcCaptionBreak, epcLeastVersion, epcPairing, epcPayload } from '@formancy/report-spec'

checkEpcIban('de71 1102 2033 0123 4567 89') // { ok: true, value: 'DE71110220330123456789' }
checkEpcIban('FO2000400440116243') // { ok: false, rule: 'is not the IBAN of an account in SEPA: ...' }
checkEpcIban('CH44 3199 9123 0008 8901 2') // { ok: false, rule: 'is a QR-IBAN, which SIX keeps for QR-bills in francs ...' }
checkEpcReference('rf18 5390 0754 7034') // { ok: true, value: 'RF18539007547034' }: the QR-bill's own check, then capitals
checkEpcField('information', ' ') // { ok: false, rule: 'is blank, and an element the code holds has one character at least ...' }
checkEpcAmount('184.60') // { ok: true, value: '184.6' }: as short as it can be written
epcPairing('CH9300762011623852957', null) // [{ field: 'bic', rule: "an account outside the EEA is paid to with its bank's BIC: ..." }]
epcPayload({ bic: 'BHBLDEHHXXX', beneficiary: 'Franz Mustermänn', iban: 'DE71110220330123456789', amount: '12.3', purpose: 'GDDS', reference: 'RF18539007547034' })
// 'BCD\n001\n1\nSCT\nBHBLDEHHXXX\nFranz Mustermänn\n...\nRF18539007547034': the EPC's first sample, byte for byte
epcCaptionBreak(68.05) // 'with the caption, a code needs a square of at least 68.06 pt, and this one is 68.05 pt: ...'
epcLeastVersion(85.04, 'zahlenMitCode') // 8: version 7's modules would be 0.515 mm
```

What the code holds is SCT in euro, in UTF-8, at most 331 bytes, version
002 without a BIC and 001 with one. An IBAN is of a country of SEPA, of
its length and with its check digits right, and no QR-IBAN, which SIX
keeps for QR-bills in francs; a BIC is of a bank in SEPA, of the IBAN's
country -- this module's inference from EPC409-09's territory codes --
and given for an account outside the EEA. Which countries those are, and
each IBAN's length, is one table, recorded from EPC409-09 version 8.0 and,
for the lengths, python-stdnum's copy of release 101 of SWIFT's IBAN
Registry; SWIFT's own file was not read. The IBAN's check digits and the
creditor reference are checked by the QR-bill's own functions, and the
QR-IBAN's range is the QR-bill's; the IBAN and the reference are written
in capitals. An amount is from 0.01 to 999999999.99, never rounded, and
written as the PSA writes one: `EUR45`, `EUR184.6`. A free text holds no
control character or line break, which would end its line of the code.
No text is blank: `checkEpcField` refuses a blank name or IBAN as needed,
and a blank optional text as the text left out, by `EPC_TEXT_FIELDS`, the
one table of the code's texts the validator and the runtime read.
With the caption, `epcModule` and `epcCaptionBreak` hold the modules to
15 to 20 mil and the symbol to at least the caption's length, 51.36 pt in
Liberation Sans at 7 pt, since the caption stands beside it: the validator
refuses a size in which no version does both, which leaves squares of
68.06 to 118.6 pt, and the renderer the version it encodes. A payload too
short for its square is drawn in a larger version of itself, from
`epcLeastVersion`, rather than refused.

What they do not check:

- a purpose code against ISO 20022's list, beyond four capitals;
- that the amount a template binds is in euro: it is a decimal, and has no
  currency;
- that a payer's bank is in the EEA, where a code without a BIC may be
  refused outside it;
- a structured reference other than a creditor reference: a Belgian
  structured communication is refused, and goes in the text;
- the payload's bytes before a render, beyond what the literal texts
  write alone;
- that a bank's app accepts the code, which nothing here can show.

## An e-invoice

A report may carry one e-invoice, `eInvoice`: an EN 16931 invoice, which the
runtime writes as Factur-X 1.09.2 / ZUGFeRD 2.5.2 CII in the EN 16931 profile
([0027](../../docs/decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)). It is of kind `facturX`, or of kind `xrechnung` (below), type 380, in euro, its VAT categories
standard rated, exempt or reverse-charged, with no allowances or charges: a
discount is a line of negative quantity at a positive price. Its seller, its
buyer, their addresses and its payment instructions are runs, as a
paragraph's, read in the report's scope and written into the XML, so none
holds a page number or count; its dates and its paid amount are
expressions. Its lines are the rows of the table over the detail dataset:
`lines` names that table and the four columns that print each line's name,
quantity, net price and net amount, so the page and the XML read one
evaluation of each line, and reads the line's identifier, unit and VAT
category from each row.

It may name four things a German B2B invoice does not need, and XRechnung
does ([0037](../../docs/decisions/0037-an-e-invoice-may-name-electronic-addresses-the-sellers-contact-and-its-business-process-none-needed-for-german-b2b.md)): its business process (`businessProcess`, BT-23), the
seller's and the buyer's electronic addresses (`electronicAddress`, BT-34
and BT-49, each an identifier and a scheme of `ADDRESS_SCHEMES`), and the
seller's contact (`contact`, BG-6: its name, telephone number and email
address, all three or none). The types are `ElectronicAddress`,
`AddressScheme` and `SellerContact`. An invoice that names none is written
as before, byte for byte.

```ts
import { checkAddressScheme, checkCountryCode, checkEInvoiceDecimal, checkEInvoiceText, checkVatIdentifier, checkVatRate, FACTUR_X, FACTUR_X_PROFILES, sellerIdentificationBreaks, vatCategoryBreaks } from '@formancy/report-spec'

checkCountryCode('UK') // { ok: false, rule: "is not a country code of those this release takes, a list narrower than ISO 3166-1's (BR-CL-14)" }
checkVatIdentifier('DE 123 456 789') // { ok: true, value: 'DE123456789' }
checkEInvoiceText('BT-1', ' ') // { ok: false, rule: 'is empty, and an e-invoice needs it (BR-02)' }
checkEInvoiceText('BT-84', 'DE83 0123 4567 0012 3456 78') // { ok: true, value: 'DE83012345670012345678' }: the EPC QR code's account rule
checkEInvoiceDecimal('BT-131', '10.500') // { ok: true, value: '10.50' }
checkEInvoiceDecimal('BT-131', '10.505') // { ok: false, rule: 'is not a whole number of cents, ... (BR-DEC-23)' }: never rounded
checkEInvoiceDecimal('BT-146', '-1') // { ok: false, rule: 'is negative, and a net price never is: ... (BR-27)' }
checkVatRate('S', '19.00') // { ok: true, value: '19' }: compared by value
checkVatRate('S', '0.4') // { ok: false, rule: 'is below 0.5, which BR-CO-17 rounds to 0, ... (BR-CO-17)' }
checkEInvoiceText('BT-37', ' ') // { ok: false, rule: 'is empty, and a German invoice gives the full address ... (§ 14 Abs. 4 Satz 1 Nr. 1 UStG)' }
checkEInvoiceText('BT-1', 'RE-2026  0820') // { ok: false, rule: 'holds white space the XML would not keep: ...' }: a token
checkAddressScheme('0060') // { ok: false, rule: "is not an electronic address scheme of those this release takes, ... (BR-CL-25)" }
checkEInvoiceText('BT-42', 'Zentrale') // { ok: false, rule: "has fewer than three digits, which a telephone number has at least (XRechnung's BR-DE-27)" }
vatCategoryBreaks([{ code: 'S', rate: '19' }, { code: 'S', rate: '19.00' }]) // [{ index: 1, field: 'rate', rule: '... (BR-S-08)' }]
sellerIdentificationBreaks({ vatId: false, taxNumber: true, legalId: false }, ['S']) // ['the seller has neither a VAT identifier (BT-31) nor a legal registration identifier (BT-30), ... (BR-CO-26)']
FACTUR_X_PROFILES.en16931.guideline // 'urn:cen.eu:en16931:2017': BT-24
FACTUR_X.fileName // 'factur-x.xml'
```

`en16931.ts` and the `en16931-*.ts` beside it, one for each kind of term,
hold EN 16931's rules as functions over text, each answering
the value the XML is written with or the rule broken, named by its business
term and its business rule and never by the value. The validator applies
them to a literal; the runtime applies the same functions to what the data
resolves a text to, and names its refusals by the same tables,
`E_INVOICE_TEXTS`, `E_INVOICE_DECIMALS` and `E_INVOICE_DATES`, and
reads which term each text is by where it stands from one table,
`E_INVOICE_TEXT_TERMS`, as each line term names its own; a date
the data resolved is held to a day on the calendar by `checkEInvoiceDate`,
since the editing core types a date term as any text.
`EN16931_RULES` is every rule they name, and the e-invoice gate holds each
to a fatal rule of its pinned schematron. Two things they hold are not
CEN's: the seller's and the buyer's street, post code and city, which
§ 14 Abs. 4 Satz 1 Nr. 1 UStG asks for (`FULL_ADDRESS`), where CEN asks
only the country; and an identifier or a code the XSD types as a token,
which holds no tab, line break, double space or space at either end, since
a schema-aware reader collapses them. The payment account and its BIC are
the EPC QR code's rules. A contact's telephone number and email address
are held to the shapes XRechnung warns of, BR-DE-27 and BR-DE-28, in every
e-invoice: each the pinned schematron's own XPath expression, exported as
`XRECHNUNG_PATTERNS`, its rule id in `XRECHNUNG_RULES`, which the
e-invoice gate holds, with the test that reads each expression, to KoSIT's
XRechnung schematron as it holds `EN16931_RULES` to CEN's. The email
address's expression runs as XPath reads it; the telephone number's three
ASCII digits are counted, which is what its expression asks, since the
expression run as written takes time that grows with the square of a
text's length, and a test holds the count to the expression on every
short text. Both are reached through `checkEInvoiceText('BT-42', …)` and
`('BT-43', …)`. The totals and the VAT breakdown are not here: the
runtime computes them once.

A report that is an e-invoice gives its expressions three names beside
`EXPRESSION_NAMES`'s, and no other report has them (`E_INVOICE_NAMES`):
`invoice`, whose members `INVOICE_TOTALS` names by business term, and
`vatBasis` and `vatAmount`, each declared category's taxable and tax
amount by its id (`VAT_BREAKDOWN`). Whether an expression reads them
where it may is the editing core's to check, as every name is.
`E_INVOICE_LINE_COLUMNS` and `E_INVOICE_LINE_CODES` say which types of
field each term of a line is read from: the validator holds a field to
them, and the editing core an expression.

The codes come from closed lists that someone chose, narrower than CEN's,
and held to CEN's 1.3.17 and the pinned 1.3.16 lists on 17 October 2026:
`UNIT_CODES`, the units of UN/ECE Recommendation 20 a German invoice
counts, times, weighs and measures in; `COUNTRY_CODES`, the
EU's members, the EEA's, Switzerland and the United Kingdom; `VAT_PREFIXES`,
those and Greece's `EL`, which CEN's 1.3.16 takes and its 1.3.17 does not;
and `SCHEME_IDS`, SIREN, SIRET, D-U-N-S and GLN; and, since 0037,
`ADDRESS_SCHEMES`, an electronic address's: an email address, the
Leitweg-ID, France's addressing scheme, a German VAT identifier and a GLN.
A rate is a percentage
below 100 with two decimals at most, and a standard rate 0.5 or more, which
BR-CO-17 would otherwise round to 0. `FACTUR_X` and `FACTUR_X_PROFILES` are
the names the PDF carries -- the file, its relationship and the XMP's values
-- which rest on a transcription of the specification, not on the
specification itself, until the owner's copy is read.

What they do not check:

- that a VAT identifier is one its country issued, past its prefix;
- that a rate is one a country applies, or the right one for a line;
- that an exemption reason says what the law says;
- the amount a payment code asks for, which is an expression: the render
  compares it with the amount due;
- an account, a date or a total read from the data, before a render;
- that an electronic address is of its scheme's form, a GLN's check digit
  among it, but for a Leitweg-ID's under 0204 (below);
- France's rules (BR-FR).

## An XRechnung

An e-invoice of kind `xrechnung` is an XRechnung 3.0, KoSIT's CIUS of EN
16931 a German public buyer asks for, written as CII alone
([0038](../../docs/decisions/0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)). It holds
every term a Factur-X invoice does, by the same rules, with `version`, of
`XRECHNUNG_VERSIONS`, where Factur-X has its profile; `XRECHNUNG` names
each version's specification identifier (BT-24), KoSIT's `XR-CIUS-ID`, the
release of KoSIT's it was read from, 3.0.2, and its syntax. The type is
`XRechnungInvoice`, and the terms both kinds hold `EInvoiceTerms`.

It needs what XRechnung's schematron needs past EN 16931, each refused
where it is missing by the fatal rule that needs it (`XRECHNUNG_NEEDS`):
the business process (PEPPOL-EN16931-R001), the buyer's reference, a
public buyer's Leitweg-ID (BR-DE-15), the payment instructions (BR-DE-1),
the seller's contact (BR-DE-2) and both electronic addresses
(PEPPOL-EN16931-R020, -R010); and each of those texts, and the contact's
three (BR-DE-5 to -7), to say something (`XRECHNUNG_TEXT_NEEDS`). Its texts
are held by `E_INVOICE_KIND_TEXTS.xrechnung`, EN 16931's table with those
needed and its payment terms held to BR-DE-18: no line of them may begin
with `#`, which XRechnung reads as a Skonto line of its own syntax, and
this release writes no Skonto (`skontoBreak`). A refusal names the rule as
XRechnung's, `(XRechnung's BR-DE-15)`. The rules no refusal names, since
nothing the format can say breaks them, are in `XRECHNUNG_HELD`, each with
what holds it; the e-invoice gate holds every id of both lists to a rule of
KoSIT's pinned XRechnung schematron, the test of each rule a need names to
the element the runtime writes the term as, and the context and test of
each held rule to the ones its reason was read against, so that one KoSIT
rewrites fails the gate; and `XRECHNUNG`'s guideline and release to the
schematron's `XR-CIUS-ID` and to the release the register pins.

```ts
import { checkEInvoiceText, checkElectronicAddress, leitwegIdBreak, skontoBreak, XRECHNUNG } from '@formancy/report-spec'

XRECHNUNG['3.0'].guideline // 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0'
checkEInvoiceText('BT-10', ' ', 'xrechnung') // { ok: false, rule: "is empty, and an XRechnung needs it (XRechnung's BR-DE-15)" }
checkEInvoiceText('BT-10', ' ') // { ok: false, rule: 'is blank: a term the e-invoice does not hold is left out of it' }: a Factur-X invoice may leave it out
skontoBreak('Zahlbar binnen 14 Tagen\n#SKONTO#TAGE=14#PROZENT=2.00#\n') // "hold a line that begins with #, ... (XRechnung's BR-DE-18)"
checkElectronicAddress('BT-49', '0204', '991-33333TEST-34') // { ok: false, rule: "is under 0204, a Leitweg-ID, and has check digits that do not match the rest of it (the Leitweg-ID's check digits, ISO/IEC 7064 MOD 97-10)" }
leitwegIdBreak('991-33333TEST-33') // undefined: KoSIT's own test value
```

**A Leitweg-ID** is checked where scheme `0204` says an electronic address
is one, in an e-invoice of either kind: a coarse address of 2 to 12
digits, a fine address of up to 30 letters and digits where it has one,
and two check digits by ISO/IEC 7064 MOD 97-10, joined by hyphens
(`leitwegIdBreak`). The buyer's reference is not: a business buyer's
XRechnung carries an order number there, and BR-DE-15 asks only that it be
given. Neither validator the gate runs checks a Leitweg-ID's digits; the
format specification could not be read when this was written, so its
shape rests on FeRD's description of it and on KoSIT's test suite, whose
every Leitweg-ID with right digits it takes, and whose three with wrong
digits, which KoSIT's validator takes, it refuses. The expression is
anchored at both ends and its repeats bounded, so a text of any length is
decided within its first 46 characters.

What it does not do:

- **UBL.** CII alone: KoSIT's configuration has UBL scenarios, which a
  second writer of one invoice would need.
- **A Skonto.** XRechnung 3.0's `#SKONTO#` lines are refused, not written;
  a structured discount waits for XRechnung 4.0.
- **XRechnung 4.0**, the extension and CVD scenarios, credit notes, and
  anything EN 16931's terms here do not hold.
- That a Leitweg-ID belongs to a buyer, or that a portal takes the file.

## An SVG asset

An image asset may be `image/svg+xml`, held to one form: what `cleanSvg`
writes ([0030](../../docs/decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)).
A host approves a customer's SVG by cleaning it and keeping the bytes
`cleanSvg` returns, whose digest the asset carries; the renderer draws an
SVG only when `checkSvg` finds it already in that form, and refuses it
otherwise, so nothing is cleaned, dropped or rewritten at print.

```ts
import { checkSvg, cleanSvg } from '@formancy/report-spec'

const approved = cleanSvg(file) // the file's bytes; there is no TextDecoder in this package's world, and none is needed
// { ok: true, bytes: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#1f4e79"/></svg>,
//   viewBox: { x: 0, y: 0, width: 40, height: 40 }, segments: 20, groups: 0, drawn: { lines: 2, curves: 6, elements: 2, stops: 0 },
//   extent: { groups: { inverse: 0, origin: 0 }, patterns: { linear: 0, offset: 0 }, local: 0, own: 39.11426010499247, nesting: 3 },
//   removed: [declaration, attribute width, attribute height, element title], removedMore: 0 }
checkSvg(approved.bytes) // { ok: true, … }: what cleanSvg wrote, unchanged
checkSvg(file) // { ok: false, code: 'unsupported', message: 'the drawing holds a declaration, which cleaning removes; clean it with cleanSvg first' }
cleanSvg(lettered) // { ok: false, code: 'text', message: 'svg/text is text; convert the text to outlines' }
```

What a cleaned SVG holds, in `svg-allow.ts`'s tables:

- **Drawing elements alone**, `SVG_ELEMENTS`: `g`, `defs`, the seven
  shapes, linear and radial gradients and their stops, clip paths of
  shapes. Text, embedded pictures, `use`, `symbol`, patterns, masks,
  markers, filters, `foreignObject`, `switch` and a nested `svg` are
  refused. Every refusal says what to do after what it found -- convert
  the text to outlines, add the picture as an asset of its own, save it
  without Illustrator's editing capabilities -- or, where it knows nothing
  more particular, its code's own advice.
- **What never draws is removed and listed** -- comments, the declaration,
  a plain DOCTYPE, titles, metadata, scripts, animations, an editor's
  elements and attributes in their own namespaces, event handlers, data and
  accessibility attributes, rendering hints, text and vendor-prefixed
  properties, what draws nowhere on the element it is written on (paint
  and clips on a gradient, a stop or `defs`, a stop's colour anywhere
  else), hidden elements, shapes of no size, what nothing that draws
  refers to, ids nothing refers to --
  by name and count, never by value, the first `MAX_SVG_REMOVED_NAMES`
  names and a count of the rest. A link is the group it draws as, its
  address removed.
- **CSS flattened into attributes**: a `style` attribute and `<style>`
  rules of types, classes, ids and their compounds, in CSS's cascade. A
  combinator, an at-rule, `!important` or an escape is refused.
- **Colours as `#rrggbb`**, from `#rgb`, `#rrggbb`, `rgb()` and CSS
  Color 4's names; one with an alpha, `hsl()`, `transparent` and the system
  colours are refused. `currentColor` is written as the colour it stands
  for.
- **References inside the file alone**: a fill or a stroke may name a
  gradient, a clip path a clip path; a gradient's `href` chain is flattened
  into it. Anything else that names anything is refused, so nothing outside
  the file is ever read. A clip rule a clip path would inherit from what
  holds it is written on it, so that its clip never rests on `defs`.
- **Absolute numbers in one written form**: path data in absolute commands
  whose relative steps sum exactly, transforms composed into one matrix,
  units converted, nothing below a millionth, and nothing past
  `MAX_SVG_COORDINATE`: no number, no transform composed from the root and
  no inverse of one, which the converter computes for every clip, and no
  matrix a gradient is drawn under in any box inside its shape's, which
  the converter's box of a curve is. The root keeps its namespace and its
  viewBox alone; its paint and transform move onto a group inside it, so a
  transform can never move the drawing off the report's box.
- **Bounded**: `MAX_SVG_BYTES` in and out, `MAX_SVG_DEPTH`,
  `MAX_SVG_ELEMENTS`, `MAX_SVG_STOPS`, `MAX_SVG_DASHES`, `MAX_SVG_RULES`,
  the cascade's work (`MAX_SVG_CASCADE`), and what a reader will paint:
  `MAX_SVG_SEGMENTS` weighted segments, a clip path counted for every
  element it clips and a gradient's stops for every shape painted with it,
  and `MAX_SVG_GROUPS` units of page-sized transparency groups. Each bound
  but `MAX_SVG_REMOVED_NAMES` says in `limits.ts` how it was measured, and
  the reader's time is linear in the bytes: a mebibyte of each shape of
  value a pattern could have made quadratic is cleaned in a test's
  ceiling.
- **Its extent measured, `SvgExtent`** (`svg-extent.ts`): how far the
  numbers svg-to-pdfkit writes for the drawing reach wherever it is
  placed -- the inverses of the matrices its page-sized groups are drawn
  under and where they take the viewBox's origin, the matrices its
  gradients are drawn under outside a group and inside one, and the box
  a clip in objectBoundingBox units clips to, each over every box inside
  a shape's, and the points the converter draws its outlines with, an
  arc's grown to reach its ends among them -- and how deep it nests the
  graphics state. Nothing is refused by it here; the renderer holds an
  image in an e-invoice to it, whose PDF/A-3 holds an integer to
  2,147,483,647 and the nesting to 28.

Cleaning is a fixed point: `cleanSvg` of what it wrote gives the same bytes
with nothing removed, which is what `checkSvg` tests for.

**A host shows the approver the cleaned drawing, or the PDF, never the
file as uploaded.** A browser draws the file as it came, with what
cleaning removes: an animation runs to its end, where the PDF shows the
drawing before it starts, and a script may change what is drawn. The
cleaned bytes are what prints, and what an approver says yes to.

What it does not do: draw text, inline `use`, convert
a colour with an alpha into an opacity, or follow a reference out of the
file; and that a browser draws the cleaned drawing as the PDF does is held
by the tables and review, not by comparing the two.

## An image's bytes

What an image a person adds is, and the digest a report pins it by, are
read here, so that a builder refuses at the door what the renderer would
refuse at every print, and names the image as the validator reads a name
(0033):

```ts
import { assetDigest, imageHeader, sniffImage } from '@formancy/report-spec'

sniffImage(bytes) // 'image/png', 'image/jpeg' or 'image/svg+xml', by the first bytes alone; undefined for anything else
imageHeader(png) // { ok: true, mediaType: 'image/png', width: 120, height: 40, bitsPerPixel: 32, interlaced: false, data: every IDAT chunk's bytes, joined }
imageHeader(jpeg) // { ok: true, mediaType: 'image/jpeg', width: 40, height: 120, components: 3 }: as it is shown, after its Exif turn
imageHeader(wide) // { ok: false, code: 'too-large', message: 'is 5000 × 300 pixels; the limit is 4096 pixels a side', width: 5000, height: 300 }
assetDigest(bytes) // 'sha256:' and 64 lower-case hex digits, what an asset's digest is
```

- **`sniffImage`** judges by a PNG's signature, a JPEG's start of image,
  and `<` after an optional UTF-8 byte order mark and white space, never by
  a file's name or a type a browser guessed. A UTF-16 or UTF-32 byte order
  mark is an SVG too, so that `cleanSvg` can tell the person to save it as
  UTF-8. A sniff is no check: the bytes are read whole next.
- **`imageHeader`** reads a PNG's chunks, each with its length and CRC,
  the header, the palette it needs and the end chunk with nothing after
  it; and a JPEG's segments up to its scan, the frame header where PDFKit
  reads it, the first Exif block's orientation and the end marker. Its
  refusals, `IMAGE_REFUSAL_CODES`, are in the words the renderer says them
  in after an asset's name, and one of a picture's size carries the size.
  A picture is held to `MAX_ASSET_SIDE` pixels a side, and every reader of
  an asset's bytes to `MAX_ASSET_BYTES`. A PNG's image data comes back in
  one array, copied once however many chunks it was split over, and
  nothing of a chunk is kept but its length: a person's 20 MiB file can
  hold 1,747,622 empty ones, which a view kept of each held in 237 MB of
  heap, and which are now read in 38 ms keeping nothing (Node 24.21.0 on
  an Intel i9-10900K, 19 October 2026).
- **`assetDigest`** is `@noble/hashes`' SHA-256, synchronous, on the
  caller's thread: Web Crypto's is asynchronous and no part of this
  package's library. A TypeError for anything that is not a `Uint8Array`.

What it does not do: inflate a PNG's image data, which needs a
decompressor ES2023 does not have. The renderer does at print, so a PNG
whose data does not inflate to the scanlines its header promises passes
here and is refused there. Nothing decodes a JPEG's scan.

## A font's bytes

What a font is, whether its licence bits allow it to be embedded, and
which characters it draws, are read here, once: today for the renderer,
which reads its own faces' character maps here, and for a builder where a
person adds a font and a host where it approves one once they take fonts
([0040](../../docs/decisions/0040-a-font-is-read-by-report-specs-own-reader-which-says-what-it-may-be-embedded-as-and-which-characters-it-draws.md)):

```ts
import { characterMap, readFont } from '@formancy/report-spec'

readFont(ttf)
// { ok: true,
//   names: { family: 'Liberation Sans', subfamily: 'Regular', postScriptName: 'LiberationSans', postScriptNames: ['LiberationSans'], version: 'Version 2.1.5', licence: '...', ... },
//   embedding: 'installable', fsType: 0,
//   metrics: { unitsPerEm: 2048, ascender: 1854, descender: -434, lineGap: 67 },
//   style: { weight: 400, italic: false, bold: false, regular: true },
//   glyphs: 2620, characters: Set(2327) { 0x20, 0x21, ... } }
readFont(otf) // { ok: false, code: 'cff', message: 'is an OpenType font with CFF outlines; use the TrueType edition of the font (.ttf), ...' }
readFont(restricted) // { ok: false, code: 'embedding', embedding: 'restricted', message: 'allows Restricted License embedding alone (fsType 0x0002), ...' }
characterMap(ttf) // { ok: true, characters: Set(2327) { ... } }: the character map alone, of any sfnt
```

- **Accepted:** one static TrueType font, an sfnt of 0x00010000 or Apple's
  `true`, with TrueType outlines, the eight tables every OpenType font
  needs, a Unicode character map in format 4 or 12, and an OS/2 fsType
  that allows embedding a subset of its outlines: Installable, Preview &
  Print, since a PDF is opened read-only, or Editable.
- **Refused**, each with one of `FONT_REFUSAL_CODES` and what to do: a
  collection, WOFF, WOFF2, EOT and Type 1 (`format`, naming which of
  `FONT_FORMATS`); CFF and CFF2 outlines (`cff`); a variable font; a
  colour font, whose glyphs PDFKit would print as their outlines alone; a
  font of bitmaps alone; Restricted License, No subsetting and Bitmap only,
  and an fsType the specification does not define for its OS/2 version
  (`embedding`, naming which of `FONT_EMBEDDING_REFUSALS`), with no
  override; no Unicode map, or one fontkit takes in another format
  (`character-map`); what is malformed; and a font past `MAX_FONT_BYTES`,
  mapping more than `MAX_FONT_CHARACTERS` characters, with a glyph of more
  than `MAX_FONT_GLYPH_WORK` points times contours, or whose glyphs hold
  more than `MAX_FONT_POINTS` points, `MAX_FONT_OUTLINE_WORK` points times
  contours or `MAX_FONT_COMPONENTS` composite components together, which
  is what a subset of them can cost PDFKit (`too-large`, 0043).
- **A line pdfmake can lay out**: the horizontal header's ascender above
  the baseline, its descender at it or below, and the line they make
  `MIN_FONT_LINE` to `MAX_FONT_LINE` ems tall, a range that holds every one
  of the 425 fonts measured on one machine on 22 October 2026 with a
  margin, since pdfmake lays every line of
  a face out by it and a line of nothing let a report far past its page
  limit print on one page (`malformed`, 0040).
- **The characters are fontkit's**, which PDFKit lays text out with: the
  subtable it takes, (3, 10) first and (0, 0) last, whatever the order of
  the records, its segments or groups sorted and apart so that a walk finds
  what its binary search finds, and a code point mapped where its glyph is
  not glyph 0. `readFont` holds every glyph a character maps to to the
  glyph count, and the variation sequences fontkit reads beside the map to
  the file; `characterMap` reads the map alone, whatever length the
  directory records for it, holds no glyph to a count it does not read,
  and is what the renderer reads its own faces with: a font a host brings
  is held to `readFont`'s characters.
- **The names are handed back as the font states them, never judged**,
  each the best record's, Windows English first, and the typographic family
  before the family. The licence description and its address are the
  customer's to read. The PostScript name, which PDFKit writes into the PDF
  as it stands, is held in every record to printable ASCII with none of
  `[ ] ( ) { } < > / % #`, a space admitted, since PDFKit writes it as an
  underscore, and every record to an encoding fontkit decodes as this does;
  a record fontkit could not decode the naming table with is refused. Every
  name the records hold is handed back too, once each, as
  `postScriptNames`, since fontkit names a font by its last English record
  and PDFKit keeps a document's faces by that name (0043).
- **A font is untrusted bytes**: every table's offset and length is held
  to them and every read checked against them, a count against the bytes
  it counts before anything is read by it, every loop bounded by them,
  nothing recursing on what a font holds, and nothing the font chose
  repeated in a refusal but a number the reader decoded. A table is read
  where its record says, as fontkit reads it: refused where its recorded
  length is 0, since fontkit then sees no table, and an index to location
  held to the offsets its recorded length holds, since fontkit reads them
  to there. The bounds were measured, as `limits.ts` says: the costliest
  font they admit read in 15 ms in Node, and the costliest subset found
  under them took PDFKit 1.3 to 1.4 s to embed.

What it does not do: read the layout tables fontkit runs at print, GSUB,
GPOS, kern and morx, a crafted one of which can make a render throw or
never end -- the renderer strips them from a host face before it embeds it
(0043); judge what an outline draws; read a font's licence, which may
forbid what its fsType allows.

A report **maps** its font tokens to the fonts a host approved (0043): the
definition's `fonts` is `{ sans?, serif?, mono? }`, each `{ normal, bold?,
italic?, boldItalic? }` of asset ids, the assets `font/ttf` and pinned by
digest like an image. `validateReport` refuses a face mapped to an image
(`asset-not-a-font`), an image that draws a font (`asset-not-an-image`) and
a print style that sets bold or italic in a mapped family without that face
(`missing-face`); `reportHash` covers the map. `PRINTED_BLOCKS`,
`BIDI_CONTROLS` and `refusedCharacter` are the characters a report prints,
by code point, which the renderer applies in every face: the Latin, Greek
and Cyrillic blocks and the punctuation, symbols and marks written with
them, from Unicode's `Blocks.txt` 18.0.0, but for the bidirectional
controls of its `PropList.txt`; every other character is refused, its
script being one nothing here has proved.

## Hash

```ts
import { reportHash } from '@formancy/report-spec'

const hash = reportHash(outcome.report) // 64 lower-case hex digits
```

`reportHash` is `@formancy/spec`'s `schemaHash` over an envelope that names
the format, so key order never changes it and a form never shares one with a
report. It validates first, and throws a `RangeError` for a report the
validator refuses: only a valid report has a hash.

## Start, find and measure

```ts
import { componentAt, emptyReport, mmToPt, printableArea, squareRoom, walkComponents } from '@formancy/report-spec'

const blank = emptyReport('site-visit', 'Site visit', 'de-CH') // A4 portrait, 20 mm margins
const margin = mmToPt(15) // 42.52: lengths are points, stored to the hundredth
const { width } = printableArea(blank.page) // what the margins leave
const { side, length } = squareRoom(printableArea(blank.page)) // the largest square, a QR code's room
for (const { component, path, depth } of walkComponents(blank)) console.log(depth, path, component.id)
componentAt(blank, 'title') // where a component is, by id: the path its errors use
```

`REPORT_SPEC_VERSION` is `0`, the draft: nothing written under it is promised
to be read by a later release. Nor by an earlier one: a kind the draft gains
is refused as `unknown-kind` by a release that predates it, never skipped. A
report with a `qrCode` or an `epcQrCode` is refused so by 0.1.0, and one
with a `paymentPart` or an `eInvoice` as `unknown-property`.

Source-available, not open source: see [`LICENSE.md`](../../LICENSE.md).
