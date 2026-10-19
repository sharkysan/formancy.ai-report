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
  `&`, `<` or `>`.

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

## An e-invoice

A report may carry one e-invoice, `eInvoice`: an EN 16931 invoice, which the
runtime writes as Factur-X 1.09.2 / ZUGFeRD 2.5.2 CII in the EN 16931 profile
([0027](../../docs/decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)). It is of kind `facturX`, type 380, in euro, its VAT categories
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

```ts
import { checkCountryCode, checkEInvoiceDecimal, checkEInvoiceText, checkVatIdentifier, checkVatRate, FACTUR_X, FACTUR_X_PROFILES, sellerIdentificationBreaks, vatCategoryBreaks } from '@formancy/report-spec'

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
vatCategoryBreaks([{ code: 'S', rate: '19' }, { code: 'S', rate: '19.00' }]) // [{ index: 1, field: 'rate', rule: '... (BR-S-08)' }]
sellerIdentificationBreaks({ vatId: false, taxNumber: true, legalId: false }, ['S']) // ['the seller has neither a VAT identifier (BT-31) nor a legal registration identifier (BT-30), ... (BR-CO-26)']
FACTUR_X_PROFILES.en16931.guideline // 'urn:cen.eu:en16931:2017': BT-24
FACTUR_X.fileName // 'factur-x.xml'
```

`en16931.ts` holds EN 16931's rules as functions over text, each answering
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
the EPC QR code's rules. The totals and the VAT breakdown are not here: the
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
and `SCHEME_IDS`, SIREN, SIRET, D-U-N-S and GLN. A rate is a percentage
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
- France's rules (BR-FR), and XRechnung's.

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
