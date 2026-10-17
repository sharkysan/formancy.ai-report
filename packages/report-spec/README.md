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
  symbol as tall as the caption beside it.

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
with a `paymentPart` as `unknown-property`.

Source-available, not open source: see [`LICENSE.md`](../../LICENSE.md).
