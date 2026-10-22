# 0022 — A report carries one Swiss QR-bill at the foot of its last page, held to SIX's rules by one set of checks and printed in the Liberation Sans the renderer ships

- **Status:** accepted; extended by [0025](0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md), which shares its IBAN check digits and creditor reference with the EPC QR code and prints that code's caption in its Liberation Sans, and by [0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md), which holds a QR-bill printed with an e-invoice to the e-invoice's currency, account and amount due; and by [0039](0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md), which lifts its "nothing edits the bill yet": the bill is selected and edited field by field in both builders through three commands of report-core's, its diagnostics are the payment part's, and a bill paying one of SIX's example accounts, the invoice starter's among them, is warned of
- **Date:** 2026-10-17
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The format.** report-spec's `src/validate-payment-part.test.ts`
    holds a payment part:
    - read back whole, and counted in the hash;
    - of a kind this version knows, an unknown one refused as
      `unknown-kind`, never skipped; a property it does not know, an
      ultimate creditor among them, refused as `unknown-property`;
    - in one of SIX's five languages and two currencies, and no other;
    - one run at least in every text it holds;
    - its texts read in the report's scope, a detail field, a group's
      aggregate and an image field refused, and a page number or count
      refused in every one;
    - on an A4 page in portrait whose top margin reaches no lower than
      the slip's top, 544.25 pt, or refused as `payment-part-page`: on
      `/page/margins/top` for the margin, and once on `/page` for a page
      of another size or orientation, whatever its margin; any page and
      any top margin for a report without one;
    - SIX's rules applied to every text of literal runs, each refusal
      naming the field and the rule and never the text; a text read from
      data left to the render.

    `src/qr-bill.test.ts` holds the rules themselves:
    - SIX's example IBANs, QR-IBANs and QR references, Liechtenstein's
      IBANs, both ends of the QR-IID range, and check digits that do not
      match;
    - creditor references from 5 to 25 characters in any case, SIX's
      fourth example refused for its check digits;
    - each field's length, its blanks trimmed, the character set at each
      of its edges, and a refused character named by its position;
    - the country, the `//` and the two characters naming its syntax that
      billing information begins with, and 140 characters for the message
      and the billing information together;
    - the account, the reference and the currency paired as SIX pairs
      them;
    - the amount with two decimals, from 0.01 to 999 999 999.99, never
      rounded;
    - the slip's size, 210 by 105 mm, and its top, 544.25 pt down the A4
      page;
    - `qrBillPageBreak`: the page A4 in portrait, its size refused before
      its margins; a top margin up to the slip's top and not a hundredth
      past it; what a render measures above the slip counted with the
      margin under the same rule; and a reach past the top by less than a
      hundredth said as the hundredth above, never as the top itself.

    `src/validate.test.ts` holds a case for each new error code.
  - **The editing core.** report-core's `src/diagnostics/parts.test.ts`
    reads every text of a bill in the report's scope, a bill with only its
    required texts too, and collects the names they read.
    `src/diagnostics/diagnose.test.ts` holds the amount to a decimal or
    null: an integer, a string, a boolean and an instant are type errors,
    and a double is refused as inexact.
    `src/commands/registry.test.ts` holds every command to keeping the very
    same `paymentPart` object.
  - **The runtime.** report-runtime's `src/lower-payment-part.test.ts`:
    - SIX's examples 1, 2, 3, 5 and 6 (IG 2.4, Tables 17 to 22): the code's
      text line by line, and what the slip prints;
    - example 4's creditor reference, read from data, refused;
    - the same bill read from data held to the same rules, with its spaces
      and blanks dropped, each text read as a paragraph with the same runs
      prints it;
    - an IBAN paid in euros, with a creditor reference and with none;
    - each rule broken refused, naming the field and the rule and never
      the value;
    - the amount: null left to the payer, a value that is not a decimal
      refused by its type, a failing expression named;
    - a null run refused in a final render, and in a preview printed as
      nothing, warned of, and refused where SIX requires the text;
    - no `paymentPart` for a report without one.

    `src/qr-bill.test.ts` holds the headings in each of the five languages,
    the grouping of amounts, IBANs and references, the address lines, and
    the longest bill the rules accept, 668 characters, within the 997; and
    what the runtime hands on to an engine, `QR_BILL_SIZE`, `QR_BILL_TOP`,
    `qrBillPageBreak`, `QR_BILL_CURRENCIES`, `checkQrBillAmount` and
    `MAX_QR_BILL_ADDITIONAL_INFORMATION`, to report-spec's own objects.
  - **The renderer, on the PDF it produced**
    ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)).
    report-render-pdf's `src/qr-bill.test.ts`:
    - SIX's examples, resolved by the real runtime, decoded with ZXing from
      the pixels PDF.js draws, byte for byte, at level M; level M kept where
      the encoder would raise it; version 25 drawn and read;
    - the code 46 mm square at its place, its modules to its edges, and the
      Swiss cross by its twelve corners in the content stream and in the
      pixels;
    - every heading and value read back at SIX's place, size and face, the
      additional information in the payment part alone, and the blocks
      after a missing one moved up;
    - the two lines it is cut along, the one down broken from 5 to 8 mm
      below the slip's top, and the instruction above the one across;
    - the scissors symbol on the line down, read from the PDF's paths in
      each of the five languages: filled in black, 3 mm tall where the
      line is broken, centred on it, inside the 5 mm left unprinted on
      either side, and its halves mirroring each other across it;
    - the corner marks of all four blank fields;
    - nothing on the slip in a font but Liberation Sans, and Liberation
      Sans mapping every character SIX allows, in both faces.

    `src/qr-bill-pages.test.ts`: the slip on the only or the last page in
    place of its footer, the footers before it counting its page; the
    body's reservation to within 0.01 pt; the page limit and the least
    height counting the slip's page; each refusal, naming no value, an
    amount of 0.00 and one of a thousand million refused by report-spec's
    range among them; a top margin past the slip's top refused in the
    editor's words before anything is laid out, and with the header and
    the instruction's 10.24 pt counted under the same rule, 534.00 pt
    drawn and 534.01 refused; and the receipt's information laid out to
    the last line its section holds, and refused with one more.
    `src/testing/drawing.ts`, the content-stream reader, keeps the point
    each curve ends at, which the symbol's rings are drawn with.
    `src/pdfmake.test.ts` pins the footer pdfmake 0.3.11 lays out last,
    with the page count, and the room it gives content placed above it.
    `src/browser.test.ts` holds the browser entry to the Node entry's
    definitions for a bill, its Liberation Sans to the package's files
    byte for byte, and its import of them to a bill: made again by the
    next bill after one that failed, and once for every bill after one
    that succeeded. `src/engine.test.ts` holds the glyphs' reads the same
    way, shared by the documents that ask while they are read.
    `src/starters.test.ts` prints the invoice starter: its lines and totals
    against a reference computed in BigInt, one page, the code decoded from
    the pixels asking for the printed total, and that amount printed on
    both parts of the slip. `src/pictures.test.ts` holds the README's
    picture of it, and fails for a starter the README shows no page of.
  - **The corpus.** report-corpus's `src/starters/starters.test.ts`
    compares the invoice's code text whole against a total computed in
    BigInt, and reads its reference from the data.
    `src/trial/undrawn.test.ts` holds both trial adapters to refusing a
    payment part.
  - **The builders.** report-builder-core's `src/payment-part.test.ts`:
    the report opened with nothing to report, every edit and its undo
    keeping the very same bill; landscape and Letter refused with the
    spec's reason on the field; the band's size and place, the sheet
    growing under a long body, no band without a bill, the zoom, and its
    name in three languages; a top margin of 192 mm taken, and one of
    195 mm refused with the spec's reason on the field. `src/css.test.ts`
    fails on a rule that dresses a region's band and not the payment
    part's. The shared scenario "a payment part is drawn at the sheet's
    foot, and edits keep it" is run by the core's driver, by React and by
    Angular, in three languages, with axe at its end.
  - **The Studio.** Its `src/preview/pipeline.test.ts` decodes the
    invoice's code through the browser entry, and its `src/notices.test.ts`
    holds the Liberation Sans notice to the fonts' own name tables, and its
    pattern to the one chunk the renderer's build writes them into. The
    browser gate (`apps/studio/scripts/browser-test.mjs`) walks the
    invoice as every starter the picker offers, in both builders, its PDF
    drawn on white with the lines `docs/images/pictures.json` says its
    page prints.
  - **The repository's scripts** (`pnpm test:repo`).
    `scripts/dependency-licences.test.mjs` reads Liberation Sans 2's
    licence sentence as OFL-1.1, and a version 1.0 or 1.10 as nothing, and
    reads the renderer's own two files as OFL-1.1 at Version 2.1.5.
    `scripts/third-party-notices.test.mjs` lists a workspace package for
    the work a file of it carries, with that notice alone, and stops the
    build once that file is no longer bundled.
  - **The install gate** (`pnpm test:e2e:install`). Its Node consumer
    validates, resolves and renders the quotation with a bill from the
    packed packages, and finds both faces of Liberation Sans in the PDF.
    It failed with the `fonts` directory left out of the tarball. It holds
    the runtime's `QR_BILL_TOP` and `qrBillPageBreak` to report-spec's
    own, and `validateReport` and `renderPdf` to refusing a top margin
    past the slip in the same words. It failed, printing the two
    messages, with the renderer's check before layout removed.
  - **Each rule reverted on its own, on 17 October 2026.** Each revert
    failed its test, or the test was written first and failed until the
    rule was there:
    - report-spec's, 74 of them. The one revert that failed nothing,
      stripping an amount's leading zeros, was unreachable behind
      `DECIMAL`, and was removed;
    - report-runtime's, 31: in the bill, its lowering, the runs it shares
      with a QR code, the evaluator's naming of the payment part and the
      resolution;
    - report-render-pdf's, 67. The encoder raising the level and the
      cross's arm width survived the first round, and the ten-byte level
      case and the twelve-corner check were added for them;
    - the builders' and the Studio's: the core's `setTitle` and
      `removeComponent` made to drop the bill, the spec's page check
      disabled, three layout rules of the band, and in the invoice its
      rounding, its debtor's street, a literal reference, the amount and
      the Studio's pipeline dropping the bill; the notice's version,
      pattern and file;
    - the slip's place, its scissors and its fonts' loads, each test
      watched failing before its fix or with the fix reverted:
      report-spec without
      `QR_BILL_TOP` and `qrBillPageBreak`, a top margin a hundredth past
      the top accepted, and the reach said by `toFixed(2)` alone; the
      builders' 195 mm margin applied until report-spec refused it; the
      runtime without its hand-on; the renderer drawing no scissors,
      which failed all five languages, blades of unequal shape, which
      failed the mirror, an amount of 0.00 drawn, and its page check
      before layout removed, which drew the page over the slip; a failed
      load kept, which failed both retries, and a load kept for no call,
      which failed both cases of reading once.
  - **Not held by anything here.** That a bank's scanner or a banking app
    on a phone reads the code and pays the bill. As in
    [0020](0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md),
    ZXing reading PDF.js's drawing is the only scanner the tests have, and
    no slip has been printed.

## Context

A Swiss invoice is paid through its QR-bill: a receipt and a payment part
at the lower edge of the invoice, or enclosed with it, the payment part
carrying a Swiss QR Code that a banking app reads (SIX's Swiss
Implementation Guidelines for the QR-bill, "IG", 3.1). Plan 19 puts the
QR-bill after the QR code. [0020](0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)
drew QR codes, borrowed the bill's 0.4 mm minimum module as a general
floor, and left the bill's own code, at 0.393 mm a module, to a later
record.

SIX's documents, read on 16 and 17 October 2026:
- **The guidelines.** Version 2.3, valid from 21 November 2025, removed
  the combined address: only the structured one remains. Version 2.4 of
  24 February 2026 is valid from 14 November 2026 and replaces 2.3, which
  stays valid until November 2027. For CHF it changes nothing technical.
  It allows a QR-IBAN and a QR reference in CHF only, and adds Romansh
  headings, in force since 1 January 2026.
- **The Style Guide**, version 1.1 ("SG"), valid from 1 January 2026.

They fix more than a code:
- **The place.** The slip is 210 by 105 mm, the receipt 62 mm of it, at the
  lower edge of the page, the length of A4's shorter side (IG 3.1, 3.3).
- **The fonts.** Arial, Frutiger, Helvetica and Liberation Sans, in black
  (IG 3.4), at sizes it gives, with headings that "must not be changed",
  in German, French, Italian, English or Romansh (IG 3.2, Annex C).
- **The code.** Level M, version 25 at most, 997 characters, 46 mm without
  its quiet zone, and a Swiss cross of 7 mm at its centre (IG 6).
- **A PDF's slip** is marked by lines, each with a scissors symbol or the
  instruction "Separate before paying in" above it (IG 3.7). The Style
  Guide's page 4 shows a PDF's slip with the line between the receipt and
  the payment part plain, bearing neither; the guidelines' text asks one
  of every line.
- **The payload.** Its elements, in order, the characters each may hold
  and how many (IG 4, Table 8).

The forces here:
- **The format flows.** Version 0's regions flow inside the page margins
  ([0007](0007-a-report-definition-is-its-own-versioned-document.md)).
  Nothing stands at the paper's foot across its width, and the page
  footer repeats on every page.
- **One font.** The renderer prints in Roboto
  ([0011](0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)),
  which is not on SIX's list.
  - Arial, Frutiger and Helvetica are commercial faces, which
    [0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)
    admits only with written redistribution rights.
  - Liberation Sans 2 is under the SIL Open Font License 1.1.
  - Liberation Sans 1, which `pdfjs-dist` ships, is under GPL-2.0 with a
    font exception, and 0006's guard refuses it.
- **Exact values.** An amount travels as a string and never through a
  JavaScript number (formancy.ai-data 0008).
- **Personal data.** A bill holds names, addresses and an account, and a
  message never quotes a value from the data.
- **The engine.** pdfmake draws a page's `background` as it adds the page,
  before it knows which page is the last. It lays the `footer` out once
  every page is, with their count.

## Decision

**A report holds at most one payment part, at its own level.**
- **Its kind.** `ReportDefinition.paymentPart` is a `PaymentPart`, today
  one kind, `swissQrBill` (`PAYMENT_PART_KINDS`). A kind this version does
  not know is refused as `unknown-kind`, never skipped.
- **Its fields.**
  - `language`, one of SIX's five, which may differ from the report's.
  - `account`, the creditor's IBAN or QR-IBAN.
  - `creditor` and an optional `debtor`, each a structured address: name,
    an optional street and building number, postal code, town and
    country.
  - `currency`, CHF or EUR.
  - An optional `amount`, an expression.
  - An optional `reference`, `message` and `billingInformation`.

  Every text is runs, as a paragraph's, read in the report's scope, one
  run at least where it is present. A page number or count is refused in
  every one, since all of them are encoded before there are pages.
- **No more than that.** An ultimate creditor, which SIX says must not be
  filled in, and alternative procedures are refused as properties the
  shape does not have; a bill "not for payment", whose amount is 0.00
  (IG 4.4), by the amount's range.
- **Its page.** A report with a payment part is on an A4 page in
  portrait, and its top margin, where the page header and the body start,
  reaches no lower than the slip's top, `QR_BILL_TOP`, 544.25 pt down the
  page. Any other page is refused once, on `/page`, as
  `payment-part-page`, and a top margin past the slip's top on
  `/page/margins/top`. One function, `qrBillPageBreak`, decides both, and
  the renderer refuses by it too, adding to the margin what only a render
  measures: the page header's room and the instruction's 10.24 pt above
  the slip. The page footer does not count: the slip stands in its place
  on the last page, and the footers before it are on other pages.
- **A draft-format addition.** `reportSpecVersion` stays `'0'`. 0.1.0,
  which does not know the property, refuses such a report as
  `unknown-property`.

**SIX's rules are one set of checks, in report-spec.** `qr-bill.ts` holds
them as functions over text, each answering the value it made of the text
or the rule the text breaks, never the text:
- **The account.** An IBAN of Switzerland or Liechtenstein, its check
  digits modulo 97, and a QR-IBAN when its institution is 30000 to 31999
  (IG 2.8).
- **The reference.** A QR reference of 27 digits, not all zeros, ending
  in its check digit (IG Annex B); or a creditor reference, RF and two
  check digits modulo 97, 5 to 25 characters in any case (ISO 11649).
- **Each text.** The characters of IG 4.1.1, its length in its field,
  without the blanks around it; a country of two capitals; billing
  information beginning with `//` and the two letters or digits that name
  its syntax (IG 4.3.3); the message and the billing information 140
  characters together.
- **The pairing.** A QR-IBAN with a QR reference and nothing else; an
  IBAN with a creditor reference or none; and, from version 2.4, a QR-IBAN
  and a QR reference in CHF only.
- **The amount.** 0.01 to 999 999 999.99, two decimals at most, written
  from its own digits and never rounded.

Beside them, over the page and not a text: `QR_BILL_SIZE`, the slip's 210
by 105 mm; `QR_BILL_TOP`, its top, the A4 page's height less the slip's,
stored to the hundredth of a point as every length is; and
`qrBillPageBreak`, the page rule above.

The validator applies them to a text of literal runs, as
`invalid-qr-bill`, so the editor refuses a mistyped IBAN where it is
written. The runtime applies the same functions to every text once the
data has resolved it. The design put them in the runtime. The runtime
stands above report-spec, so report-spec is the one place both can call.

**The runtime hands report-spec's decisions on to the renderer.** The
renderer depends on the runtime alone, so the runtime re-exports
report-spec's own `QR_BILL_SIZE`, `QR_BILL_TOP`, `qrBillPageBreak`,
`QR_BILL_CURRENCIES`, `checkQrBillAmount` and
`MAX_QR_BILL_ADDITIONAL_INFORMATION`, the very objects, and the renderer
draws the slip and refuses a page, a currency, an amount's range and a
value's length by them. What drawing decides stays the renderer's: the
lines an address and the additional information print, each section's
height, an amount's printed form, and the 997 characters and bytes of the
code.

**The editing core compiles a bill's expressions.** The amount must give
a decimal or null; one that may be null types as `dyn`, which the render
checks. An integer or a string is an `expression-type` error with `dec()`
as the hint. Every command keeps the bill, the very object, and none
edits it.

**The runtime resolves it into the document's `paymentPart`.**
- **Read as a paragraph.** Each text is read as a paragraph's in the
  report's scope and joined as a QR code's content. A final render refuses
  a run whose value is null, as `no-qr-value`.
- **Held to the rules.** A rule broken is `invalid-qr-bill` on the field,
  naming the rule and never the value.
- **A preview too.** A value the preview lacks prints as nothing, as a
  paragraph's does. Where what is left breaks a rule, the preview is
  refused, and the error says it had no value for a run there: a bill SIX
  refuses has no drawing that would not scan as a bill.
- **The amount** is a decimal, or null for the payer to fill in. Any
  other value is refused by its type.
- **What the document holds** (`QrBill`). Every text exactly as it prints:
  - the payload, in IG Table 8's order, a line feed between elements and
    none after, the ultimate creditor's seven lines empty, and the billing
    information's line only when there is one (IG 4.1.4);
  - the headings in the slip's language (IG Annex C, Table 23);
  - the IBAN in blocks of four, the QR reference as two digits and five
    blocks of five, a creditor reference in fours, the amount with a
    space between thousands;
  - each address line by line, its country only outside Switzerland, as
    "LI-9490 Vaduz";
  - the message, then the billing information, each on its line.

  The renderer formats and translates none of it, and decides none of
  SIX's rules again. It checks again, before it draws, what would
  otherwise be drawn as some other slip or not whole:
  - the kind, `swissQrBill`;
  - the page, by `qrBillPageBreak`: the top margin alone before layout,
    and with the header's room and the instruction's once they are
    measured;
  - every text it prints, headings included, a string of at most 140
    characters, report-spec's `MAX_QR_BILL_ADDITIONAL_INFORMATION`, each
    character one Liberation Sans has a glyph for in the face it prints
    in;
  - each address two or three lines, the additional information two at
    most;
  - the currency one of report-spec's `QR_BILL_CURRENCIES`;
  - the amount written as the slip prints it, its thousands apart and
    two decimals, and within `checkQrBillAmount`'s range;
  - the payload a string with no half of a surrogate pair, 997
    characters at most, and its UTF-8 within version 25 at level M;
  - each part's information within its section's height.

**The renderer draws SIX's slip.** As report-render-pdf's README
describes it, section by section:
- **Where.** It is the last page's footer, in place of the page footer;
  the page header is drawn as on every page. It is `QR_BILL_SIZE` at
  `QR_BILL_TOP`, so it spans the paper and ends at its foot, whatever the
  margins. The body keeps its room with a spacer at its end. When the
  last page has less room left, the slip takes a page of its own, which
  the footers before it count.
- **The code.**
  - The payload as UTF-8 at level M, in the smallest version that holds
    it, never past 25. More than 997 characters is refused before it is
    encoded, and UTF-8 longer than version 25 holds at M, 997 bytes,
    after.
  - It is 46 mm square without a quiet zone of its own, since the slip
    leaves 5 mm around it unprinted (IG 3.5.2, 6.4.1).
  - The cross over its centre is a white square of 7 mm, a black one of
    6 mm and a white cross whose arms are 7/6 mm wide and 35/9 mm long:
    schoero's drawing of SIX's logo, whose black square and cross
    manuelbl's draws alike.
  - It is not held to 0020's 0.4 mm floor: at version 25 a module is
    0.393 mm, at the size SIX prescribes.
- **The text** is in Liberation Sans at the recommended sizes (IG 3.4,
  SG 15), every section where SG 6 puts it. The additional information
  is in the payment part alone (IG 3.6.2). Nothing the bill does not hold
  has a heading.
- **The blank fields** for a bill without an amount or a debtor are marked
  by their corners, 3 mm arms of 0.75 pt (IG 3.5.3, 3.5.4; SG 7).
- **The lines** are drawn at half a point, across the paper at the
  slip's top and down between the receipt and the payment part, each
  bearing one of the two marks IG 3.7 asks of a PDF's line:
  - The one across has the instruction to separate above it, 8 pt and
    centred, its baseline 3 pt above the line.
  - The one down has no "above" outside the payment part, so it bears
    the scissors symbol, black, 2.5 mm wide and 3 mm tall, centred on the
    line from 5 to 8 mm below the slip's top, where the line is broken.
    It keeps inside the 5 mm left unprinted on either side of the line,
    clear of both parts' text. Its size and place are manuelbl's
    generator's (`BillLayout.drawBorder`, read on 17 October 2026). The
    drawing, two rings with their holes and two blades crossing on the
    line, points down, is this record's, and takes none of that
    generator's path. It is drawn as paths, since Liberation Sans 2.1.5
    has no glyph for U+2702, nor for any of U+2700 to U+2704, in either
    face, and is the same in every language.

  The weight, the instruction's size and its gap are this record's: SIX
  gives none.
- **Refusals.** A bill it cannot draw as SIX prints one is refused, naming
  `paymentPart` and the field and never a value, as the README's table
  lists. Information taller than its section is refused, never shrunk.

**The renderer ships Liberation Sans 2.1.5.**
- **The files.** Regular and Bold, in the package's `fonts` directory with
  the release's `LICENSE` and `AUTHORS`. They are byte for byte the files
  of `liberation-fonts-ttf-2.1.5.tar.gz`, the release on GitHub, whose
  sha256 is
  `7191c669bf38899f73a2094ed00f7b800553364f90e2637010a69c0e268f25d0`, as
  compared on 17 October 2026. The fonts' own sums:

  | File | sha256 |
  |---|---|
  | `LiberationSans-Regular.ttf` | `76d04c18ea243f426b7de1f3ad208e927008f961dc5945e5aad352d0dfde8ee8` |
  | `LiberationSans-Bold.ttf` | `788abee4c806d660e8aee46689dd8540cd4bb98da03dcc9d171ce3efd99a9173` |

- **How each entry reaches them.** The Node entry reads them from `fonts`
  beside its `dist`. The browser entry imports them as base64 from a chunk
  of their own the first time a document has a bill, never before. An
  import that fails is not kept: the bill it failed for fails, and the
  next bill imports the chunk again. Once it has imported, no later bill
  imports it again. The Node entry's reads of its font files, Roboto's
  among them, are kept the same way: once they succeed, and not when they
  fail.
- **Only the slip** prints in them. Every other text is still Roboto's.
- **The guard reads them.** Their name tables say "Licensed under the SIL
  Open Font License, Version 1.1", a sentence 0006's guard did not know.
  The guard now takes it as OFL-1.1, at version 1.1 exactly. Liberation
  Sans 1's sentence is still refused.
- **The Studio's notices carry them.** The Studio bundles the chunk from
  this repository's own package. This repository's copy of the notices
  plugin of formancy.ai-data 0046, `scripts/third-party-notices.mjs`, now
  takes a notice for a workspace package's file, named by its path or a
  pattern of it, and lists that package with the notice alone. Data's own
  plugin, as its repository stood on 17 October 2026, takes no such
  notice, and nothing compares the two copies.

**The builders show where it prints.** The design view draws a band the
slip's size, report-spec's `QR_BILL_SIZE`, across the sheet's foot, an
`img` named "Payment part", "Zahlteil" or "Section paiement". The rules
that dress a region's band dress it, so the stylesheet has no rule of its
own for it. A page edit the spec refuses, Letter, landscape or a top
margin past the slip's top, is refused with its reason on the field.
Nothing edits the bill yet.

**The starters gain an invoice**, "Rechnung mit QR-Zahlteil". Its bill's
amount is the report's own total, rounded once to the centime, and its QR
reference and debtor are read from the data. Its account and reference are
SIX's examples, which no bank books.

## Consequences

**What it buys.**
- **A bill that asks for what the invoice states.** Its amount is an
  expression over the report's own values, an aggregate computed exactly
  once
  ([0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)),
  written from its digits and never rounded on the way. The invoice
  starter's is the total its table prints.
- **One reading of SIX's rules.** What the editor refuses in a literal and
  what the runtime refuses in data are one function. Two copies could
  disagree, and nobody would find out until a bank refused a bill.
- **One size and one place for the slip.** The design view's band is
  report-spec's `QR_BILL_SIZE`; the renderer draws the slip at that size
  from `QR_BILL_TOP`, and refuses a top margin by the `qrBillPageBreak`
  the editor refuses it by, in the same words.
- **A mistyped IBAN is refused where it is written**, with the field and
  the rule, before anything renders.
- **No value of a bill in a message.** A refusal names the field, the
  rule and a character's position, never the text.
- **SIX's slip from the report alone.** No host draws a slip, merges a
  second PDF or carries a library of its own.
- **Proof on the PDF.** SIX's own examples are decoded byte for byte from
  the page, and every heading and value is read back where SIX puts it.
- **A font the guard reads.** Liberation Sans is judged from its own name
  table, at its version, as Roboto is.

**What it costs.**
- **0.1.0 refuses a report with a payment part**, whole, as
  `unknown-property`: fail closed
  ([0004](0004-three-version-lines-each-refused-when-unknown.md)).
- **One bill, at the foot of the last page, on A4 in portrait.** A report
  that prints several invoices cannot carry one each. A Letter page, a
  landscape page, a top margin past the slip's top and a bill on another
  page than the last are refused.
- **The editor sees the margin alone.** It refuses a top margin that
  reaches into the slip and nothing more: a page header, or the 10.24 pt
  line of the instruction to separate, reaching into it is refused only
  when the report renders, by the same rule, since only a render measures
  them. Report-spec deciding the instruction's room would close that
  part, at the cost the alternatives give; a header's height only a
  render can measure.
- **Nothing edits it in the builders.** The design view shows where the
  slip prints and draws nothing of it. A bill is written in the
  definition, and its diagnostics are listed as the report's, with no
  outline row to select.
- **Version 2.4's rule, applied before it is in force.** A EUR bill to a
  QR-IBAN with a QR reference, which version 2.3 allows until November
  2027, is refused.
- **What the checks do not see.**
  - A country is two capitals, not one ISO 3166-1 assigns.
  - The billing information's syntax past the `//` and the name it
    begins with.
  - A postal code written with its country's prefix, which IG Table 8
    forbids: some countries' own postal codes begin with letters and a
    hyphen, so no pattern tells the two apart.
  - Whether the account is the creditor's.
- **What the slip leaves out.** Alternative procedures, the ultimate
  creditor, and the bill "not for payment" that SIX defines for an amount
  of 0.00 (IG 4.4).
- **Choices SIX leaves open.** The cross is schoero's drawing, not SIX's
  logo file, which nothing here has read. The scissors symbol is this
  record's drawing, not SIX's, and its size and place are manuelbl's
  generator's. The lines' weight, the instruction's size and place, a
  foreign country's printed form, and 2 pt between a debtor's heading and
  its field are this record's, after manuelbl's generator where it has
  one. A line down that bears the scissors follows the guidelines' text
  where the Style Guide's page 4 draws it plain; whether a bank refuses
  a bill for either is not known.
- **The slip a hair taller than SIX's.** It is drawn from `QR_BILL_TOP`,
  544.25 pt, stored to the hundredth as every length is, so it is
  297.64 pt tall where 105 mm is 297.6378: 0.0022 pt, under a thousandth
  of a millimetre, more.
- **The billing information is always printed.** SIX requires only the
  message, and the billing information when it holds personal data. The
  runtime cannot tell, so it prints both.
- **Text is never shrunk.** SIX allows the payment part's values from 6 to
  10 pt. Information taller than its section, 56 mm on the receipt and
  85 mm in the payment part, is refused, where manuelbl's generator steps
  the size down.
- **A preview can be refused.** A sample that lacks a bill's account or
  reference refuses the preview, where any other missing value prints as
  nothing and is warned of.
- **A debtor cannot depend on the data.** A null in a debtor's text
  refuses a final render, so "no debtor" is the template's choice, never
  a row's.
- **An amount's type is checked late.** The editor types a nullable field
  as `dyn`, so a nullable integer as the amount passes the diagnostics and
  is refused at render.
- **Bytes past the characters.** SIX's rules hold a payload to 668
  characters, within the 997, and nothing before the renderer counts its
  bytes. UTF-8 longer than the 997 bytes version 25 holds at level M, a
  long bill of umlauts, is refused only by the renderer.
- **No character set marked.** As a QR code's
  ([0020](0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)),
  the Swiss QR Code writes no ECI designator. SIX's coding type 1 says
  UTF-8, and ZXing reads it so. What a banking app does, nothing here
  shows.
- **The fonts in the package, twice.** The renderer's tarball was 268,045
  bytes unpacked at 0.1.0, as npm reports it; with this record it is
  2,307,611, as `npm pack --dry-run` reported on 17 October 2026. Of
  that, the fonts are 825,168 bytes of TrueType for Node and 1,100,818 of
  base64 for the browser.
- **A browser chunk for a bill.** In the Studio's production build of
  17 October 2026, by Vite 8.3.4, the fonts' chunk was 1,100.3 kB, 518.7
  kB gzipped, loaded with the first preview of a report with a bill and
  never otherwise. A bundler that does not split a dynamic import puts it
  in every page. A chunk that did not load is asked for again by the next
  bill, but whether the browser fetches it again or answers from the
  failure it remembers is the browser's, and a chunk a deploy removed
  fails every bill until the page reloads.
- **A bundled Node entry loses them.** The Node entry finds the fonts by
  their place beside its `dist`, as it finds Roboto in pdfmake's package.
  A host that bundles the Node entry copies them where the bundle looks,
  `../fonts` from the bundle's file.
- **A render with a bill takes longer and more bytes.** Through
  `renderPdf`, the invoice starter took 263 to 300 ms and 53,730 bytes;
  the same report without its bill took 70 to 82 ms and 23,985 bytes.
  Measured on 17 October 2026, with the scissors drawn, by a script
  outside the repository, on an Intel i9-10900K under Node 24.21: each
  document resolved once, rendered once to warm up and then five times,
  in two rounds, timed from the call to the promise resolving. The bill's
  PDF is 285 bytes larger than it was measured the same day before the
  scissors. The report without a bill, which the scissors do not touch,
  took 66 to 72 ms in that earlier measurement, so the times moved with
  the machine's load, and do not show what the symbol costs in time.
- **The headings live in the runtime.** A builder that someday draws the
  slip reads them from there, or they move to report-spec.

**What it forecloses.** A bill as a component in a region, and a slip
drawn in a face SIX does not list. The format addition is a draft's.

**Added 2026-10-17: the EPC QR code.** [0025](0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md) reads two of this
record's checks. The remainder modulo 97, an IBAN's check digits by it,
and the creditor reference moved out of `qr-bill.ts` into report-spec's
`payment-reference.ts`, which both codes' rules read; `QrBillCheck` is
its `PaymentCheck`. What is the QR-bill's alone -- Switzerland's and
Liechtenstein's accounts, the QR-IBAN, the QR reference and the pairing --
stays in `qr-bill.ts`, and `qr-bill.test.ts` passes unchanged. The EPC's
rules read the QR-IBAN's range there, through `isQrIban`, which
`checkQrBillAccount` reads too, and refuse a QR-IBAN as an EPC QR code's
account. The validator's reading of a payment code's text runs moved to
`validate-payment-text.ts`, which both codes' validators call. And the
slip is no longer the one text in Liberation Sans: an EPC QR code's
caption, "Zahlen mit Code", prints in its regular face, from the same
files, which the browser entry imports from the same chunk with the first
bill or captioned code a page prints.

**Added 2026-10-17: a QR-bill printed with an e-invoice.** A report that
carries an e-invoice ([0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md))
is one invoice, its page and its XML, so its QR-bill asks for what the XML
says. The validator refuses a bill in another currency than the
e-invoice's, euro; a literal account other than the e-invoice's payment
account (BT-84), compared once each code's own rule has written it; and a
bill in a report whose e-invoice names no account. The runtime refuses a
bill whose amount, once resolved, is not the amount due (BT-115), or whose
account read from the data is not BT-84, as `invalid-e-invoice` on the
bill; a bill with no amount, left to the payer, is taken. BT-84 is held
to the EPC QR code's account rule (0025), which refuses a QR-IBAN, as
this record's pairing refuses one for a bill in euro, so the two refuse
the same bills. Nothing else of this record changes. `validate-e-invoice.test.ts` and `lower-e-invoice.test.ts`
hold it.

## Alternatives considered

**A component in a region**, a `qrBill` kind in the summary. It would
need no new place in the format. It lost on the place SIX fixes:
- **Outside the margins.** A region flows inside the margins, and the slip
  spans the paper and ends at its foot.
- **Once.** A component can be placed twice, or in a column or a frame;
  the page footer prints on every page. "One bill, on the last page"
  would be rules about where a component may not stand, for the one
  component that has no place in the flow.

**schoero's swissqrbill**, under the MIT licence, which checks a bill and
draws the slip with PDFKit, on which pdfmake builds. Read on 16 October
2026:
- **Its amount** is formatted with `Number.prototype.toFixed(2)`, which
  this repository's exact values may not pass through.
- **Its optional lines** are appended only when each is set, so an empty
  billing information followed by an alternative procedure would put the
  procedure on the billing information's line.
- **A second set of checks** beside the ones the editor needs for its
  literals anyway, which could disagree with them.
- **A drawing of its own** on a PDFKit document that pdfmake's layout does
  not know, so the body's room and the page the slip falls on would be
  decided twice.

**manuelbl's SwissQRBill**, under the MIT licence, which matches SIX's
numbers. It is Java and .NET. This record follows it where SIX is silent,
and takes none of its code.

**The line down left plain**, as the Style Guide's page 4 draws a PDF's
slip. IG 3.7's text asks a mark of every line, and the line down has no
"above" outside the payment part for the instruction, so the scissors are
the mark it leaves.

**A scissors glyph**, U+2702, in the slip's font. Liberation Sans 2.1.5
has none, and another font for one character would be another font for
the package to ship and the guard to read.

**The instruction's room as a length in report-spec**, which the renderer
draws inside, so that the editor refuses a top margin that leaves the
slip but not the instruction. It would move the instruction and the room
the body keeps, and a header reaching into the slip would still be
refused only at render. The render refuses both by the editor's rule.

**Helvetica as a PDF standard font**, not embedded: no font file in the
package. It lost three ways:
- **Encoding.** A standard font is written in WinAnsi, which lacks most of
  Latin Extended-A and Ș ș Ț ț, characters SIX allows (IG 4.1.1).
- **The viewer's face.** The viewer draws the text in a face of its own
  with Helvetica's widths, so the face the layout measured is not the one
  shown.
- **PDF/A.** It requires every font embedded, so it would be foreclosed.

**Arial, Frutiger or Helvetica embedded**: commercial faces, which 0006
admits only with written redistribution rights.

**The slip as pdfmake's page background.** The background is drawn as
each page is added, before pdfmake knows that the page is the last; the
footer is laid out once every page is, with their count.

**Rounding the amount to two places.** Refused instead: a template that
does not round is found on its first render, rather than asking for an
amount the invoice does not state. The rounding belongs where the total
is computed, once.

**The checks in the runtime alone**, as the design proposed. The editor
would accept a mistyped literal IBAN until the first render. Copied into
report-spec as well, they would be two readings of SIX that could
disagree.

**Version 2.3's rules alone.** Version 2.4 is valid from 14 November 2026,
four weeks after this record, and a bill printed now may be paid after
it. Its one new rule for a bill's content refuses only what 2.4 refuses,
so a bill these checks accept is valid under both.

**A preview that draws an invalid bill, marked as a preview.** The page
says it is a preview, but the code does not, and it would scan as a bill
that no bank pays.
