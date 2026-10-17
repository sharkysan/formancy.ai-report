# 0025 — A report prints an EPC QR code for a SEPA credit transfer, held to the EPC's rules by one set of checks beside the QR-bill's, and framed as Austria's PSA frames one where the author asks

- **Status:** accepted; extended by [0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md),
  which holds an e-invoice's payment account to its account rule, and an
  EPC QR code printed with an e-invoice to the e-invoice's account and
  amount due, and by [0028](0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md),
  its euro invoice's samples from six more countries and a page for the
  code, whose wording check refuses the name this record keeps off
  everything here
- **Date:** 2026-10-17
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The format.** report-spec's `src/validate-epc-qr-code.test.ts`
    holds an EPC QR code:
    - read back whole, and counted in the hash;
    - with a size, a beneficiary and an IBAN, and no property it does not
      know;
    - one run at least in each text it has, and an optional literal text
      that is empty or blank refused as the text left out;
    - wherever a QR code stands, in every region and every container, and
      never in a table's cell; its square held to `squareRoom`;
    - its texts read as a paragraph's in its place, and a page number or
      count refused in every one;
    - a literal text that breaks the EPC's rules refused as
      `invalid-epc-qr-code` on its field, naming the field and the rule and
      never the text, whether written as runs or as a string; a text read
      from data left to the render;
    - a creditor reference and a text never both; the BIC paired with the
      IBAN where both are literal; literal texts alone past 331 bytes
      refused;
    - the purpose four capital letters, the amount an expression, the
      caption Austria's or none, and a size in which no version prints
      with the caption refused.

    `src/epc-payload.test.ts` holds the rules themselves:
    - the IBAN: the registry's example account of every one of the 42
      countries, the EPC's and the PSA's samples with their spaces dropped
      and capitals made, each country's length exactly, and a country
      outside SEPA, a text that is no IBAN, check digits that do not
      match and a QR-IBAN, SIX's example among them, refused;
    - the BIC: eight or eleven characters, another length, lower case,
      spaces, a country of digits and a bank outside SEPA refused; a BIC
      for an account outside the EEA, of the account's country as EPC409-09
      pairs them, and nothing said of what is not known;
    - the reference a creditor reference, made capitals, and any other
      refused;
    - each text's length in characters, any character UTF-8 writes taken,
      and a control character, a line break and half of a surrogate pair
      refused by their position;
    - the six texts in the payload's order, in the one table the validator
      and the runtime read, each refused blank: the name and the IBAN as
      needed, an optional one as the text left out;
    - the purpose four capital letters;
    - the amount: the PSA's valid spellings, the trailing zeros a scale
      gives dropped, 0.01 to 999999999.99, more than two decimals refused
      rather than rounded, and what is not a decimal refused;
    - the payload: the EPC's first example byte for byte, its second in
      UTF-8, every element up to the last it holds and nothing after it,
      and at most 331 bytes counted in UTF-8.

    `src/sepa.test.ts` holds the table: the 30 countries of the EEA, the
    11 non-EEA countries and Gibraltar, every territory's BICs paired with
    its IBANs as EPC409-09 section 5 pairs them, and no other country.
    `src/payment-reference.test.ts` holds the checks the QR-bill and the
    EPC QR code share, the IBAN's check digits and the creditor reference;
    `src/qr-bill.test.ts` passes on them unchanged, and on the QR-IBAN's
    range, which the EPC's rules read from `qr-bill.ts`.
    `src/epc-print.test.ts` holds the print: a module's side with and
    without the caption, the PSA's frame and modules' widths, the symbol at
    least as tall as the caption, every size from 30 to 130 pt to the
    hundredth refused exactly where no version prints, the version a render
    encodes refused where its modules are outside the PSA's, and the least
    version a captioned code is drawn at. `src/validate.test.ts` holds a
    case for `invalid-epc-qr-code`.
  - **The editing core.** report-core's `src/diagnostics/parts.test.ts`
    reads an EPC QR code's texts and its amount in the report's scope, in
    the order its payload holds them, named after the code, and collects
    the names they read. `src/diagnostics/diagnose.test.ts` holds its
    amount to a decimal or null, and refuses an integer in words that name
    the EPC QR code, on the code. `src/commands/components.test.ts`: a new
    one is named `epc-qr-code`, edited field by field, copied with every
    field it holds, and holds no component.
  - **The runtime.** report-runtime's `src/lower-epc-qr-code.test.ts`:
    - the EPC's first example written byte for byte, from literals and with
      every text read from data; its second written in UTF-8;
    - each shape of payload, an optional element left unused where the data
      gives it empty, blank or null, in a final render as in a preview, and
      331 bytes taken and 332 refused on the code;
    - each text read as a paragraph with the same runs prints it, and the
      block holding the caption only when asked for;
    - a code whose condition does not hold neither drawn nor checked;
    - the amount as short as it can be written, null left to the payer, a
      value that is not a decimal refused by its type, and a failing
      expression named;
    - every rule the data breaks said, in the payload's order, on its field
      with the code's id and never the value; an account outside the EEA
      without a BIC refused in exact words, a BIC the data gives null
      among them; a Guernsey BIC taken with a British IBAN, as version 001;
    - a null run refused in a final render, an optional text's where
      another of its runs prints, and in a preview printed as nothing, and
      refused where the EPC requires the text;
    - report-spec's print decisions handed on as report-spec's own objects.
  - **The renderer, on the PDF it produced**
    ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)).
    report-render-pdf's `src/epc-qr-code.test.ts` decodes each page with
    ZXing from the pixels PDF.js draws, reads the caption back as text with
    PDF.js, and reads the square, the frame and the modules from the PDF's
    content stream:
    - the EPC's examples read back byte for byte at level M, in version 6;
      331 bytes in version 13, with and without the caption, and so from a
      32 mm square either way, which a 30 mm square refuses;
    - without the caption, a code drawn exactly as a `qrCode` of its
      payload at level M is, and a page of it alone a page that prints to
      the checks a document implies;
    - the frame: its line half a module wide, its corners rounded by two,
      four modules from the symbol on the left, above and below, its
      outer edge on the square's left and right, and on the right along
      the caption's baseline, broken around it;
    - "Zahlen mit Code" turned a quarter turn, at 7 pt, in Liberation Sans,
      as long as `EPC_CAPTION` says, its baseline on the frame's line and
      centred on the symbol;
    - in the pixels, the quiet zone white but where the PSA's corners round
      into it, the frame's line and the caption dark, and nothing outside
      the square;
    - the least version the PSA's modules allow, read back to the same
      payload, and a longer payload in the larger version it needs;
    - the symbol 78.2 % of a 30 mm square;
    - a captioned code in the page footer on every page, encoded once; a
      heading kept with a code; a code's side counted in a body's least
      height;
    - each refusal, naming the code and never its payload; the caption's
      face unreadable failing the render, rather than drawn in another
      face; and an encoder error passed on.

    `src/starters.test.ts` prints the euro invoice: its lines and totals
    against a reference computed in BigInt, one page, its code decoded from
    the pixels at level M and version 13 at most, asking for the total the
    page prints, and the beneficiary, the IBAN, the BIC, the amount and the
    reference printed beside it, the code in the page's left half below
    the totals. `src/browser.test.ts` holds the browser entry to the Node
    entry's definitions for a captioned code, and its Liberation Sans to
    loading with the first captioned code when no bill asks, and never
    for a page of text or a code without its caption.
  - **The corpus.** report-corpus's `src/read-pdf.test.ts` reads which way
    each run reads and boxes a turned run where it stands, and
    `src/lines.test.ts` reads a run that does not read across the page as a
    line of its own. `src/fixture.test.ts` finds every EPC code in columns,
    sections and keep-together blocks. `src/starters/starters.test.ts`
    compares the euro invoice's payload, element by element, with a total
    recomputed in BigInt, reads its reference from the data, holds its
    account and BIC to staying fictional, and its code's square to one
    every payload the EPC allows prints in. `src/trial/undrawn.test.ts`
    holds both trial adapters to refusing an EPC code: pdfmake's had drawn
    a PDF without it.
  - **The builders.** report-builder-core's `src/epc-qr-code.test.ts`: the
    new code's default, and its square one in which version 13 prints with
    the frame and without; its name, in the outline and the palette, in
    three languages; its fields in the order it encodes them, and what an
    empty BIC means, in three languages; a wrong IBAN refused on its
    field, unquoted; an optional text added by typing it and removed by
    emptying it; a reference beside a text and a BIC of another country
    refused; the frame's options and the squares each prints in; an
    amount's error on its field; and what is not text refused before the
    report is touched. The shared scenario "insert an
    EPC payment code, and type its account" is run by the core's driver,
    by React and by Angular, in three languages, with axe at its end.
    React's `src/accessibility.test.tsx` and Angular's
    `src/properties.test.ts` fail when their report lacks a kind of
    `COMPONENT_KINDS`, and the Studio's `src/parity.test.tsx` places every
    kind the palette offers in both builders.
  - **The Studio.** Its `src/preview/pipeline.test.ts` decodes the euro
    invoice's code, drawn by the browser entry, to the payload the runtime
    resolved, and `src/starters/starters.test.ts` and `src/studio.test.tsx`
    hold the picker's starters. The browser gate walks every starter the
    picker offers.
  - **The install gate** (`pnpm test:e2e:install`). Its Node consumer
    validates, resolves and renders a captioned EPC QR code from the packed
    packages, on a report of its own whose lines are euros, reads its
    payload's elements, and finds Liberation Sans in the PDF. It holds the
    runtime's hand-on of `EPC_MAX_BYTES`, `EPC_CAPTION`, `epcLeastVersion`
    and `epcCaptionBreak` to report-spec's own, and `validateReport` and
    `renderPdf` to refusing a captioned square too small in the same
    words. It failed with the
    runtime's `epcCaptionBreak` replaced by a function of its own.
  - **Each rule reverted on its own, on 17 October 2026.** Each revert
    failed a test, or the test was written first and failed until the rule
    was there:
    - report-spec's, 59 of them, over the payload's rules, the shared
      checks, the print and the validator. Two survived the first round,
      and their tests were strengthened: upper-casing before the shape
      check, now met by a dotless ı, and a float compared where hundredths
      are, now met by version 8 at 69.1 pt;
    - report-core's, 10. One survived, `epcqrcode` for a new code's id,
      now met by a check of each kind's id. The amount's naming of its
      code, and its component, were reverted once each for the
      diagnostics test written last;
    - report-runtime's, 29;
    - the print rules', once the renderer raised the version: report-spec's
      12, report-render-pdf's 34, the corpus reader's 6;
    - the builders', the starter's and the details it prints:
      report-builder-core's 36, one of which survived until its test was
      strengthened, the corpus's 10, and the renderer's 6;
    - what review found, each test written first and watched failing: the
      QR-IBAN, the reference's capitals, the texts' table and a blank
      literal, a null optional text in a final render, the 32 mm squares,
      the empty BIC's words, and a page of a code alone. Two mutations of
      the renderer had survived its whole suite -- every code taken as
      captioned, and the fonts' chunk loaded for every document -- and
      each now fails `browser.test.ts`.
  - **Not held by anything here.** That a banking app reads the code and
    initiates the transfer it holds. As in
    [0020](0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md),
    ZXing reading PDF.js's drawing is the only scanner the tests have, and
    no code has been printed.

## Context

A euro invoice can be paid by a SEPA credit transfer that a banking app
fills in from a code printed on the invoice: the European Payments
Council's "Quick Response Code -- Guidelines to Enable the Data Capture
for the Initiation of a SEPA Credit Transfer", EPC069-12, version 3.1 of
19 March 2024 ("EPC" below, by its section). Until now a report could
print one only as a `qrCode` whose content the template wrote element by
element, which nothing checked
([0020](0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)),
or as an image the host made.

The documents, read on 16 and 17 October 2026:
- **The EPC.** Version 3.1 renames the attributes of version 3.0 and
  changes no rule of the payload, as a diff of the two texts showed. It
  fixes what the code holds and how it is encoded, and nothing of where it
  stands or how large it is printed:
  - Level M, version 13 at most, and 331 bytes: "the number of
    characters may be less than the numbers of bytes with UTF-8" (2.1,
    2.2).
  - Twelve elements, in order: the service tag `BCD`; the version, `001`
    or `002`; the character set, 1 for UTF-8 to 8; `SCT`; the BIC,
    mandatory in `001`, and in `002` "mandatory for SEPA payment
    transactions involving SCT scheme participants from non-EEA
    countries"; the beneficiary's name, 70 characters; the IBAN, "Only
    IBAN is allowed"; the amount in euro, from 0.01 to 999999999.99; a
    purpose of up to four characters; a structured reference, for which
    an "ISO 11649 RF Creditor Reference may be used", 35, or a text, 140,
    and "only one of the elements may be populated"; and information for
    the payer, 70 (2.2).
  - "The last populated element is not followed by any character or
    element separator" (2.2).
  - Two examples, V1 and V2 (2.3).
  - It suits "use cases whereby the SCT transaction data stored in the QR
    code is also shown at the same time in plain text to the Originator";
    it "is of an informative nature only", and implementing it is
    optional for a bank (1).
- **Austria's PSA**, "Application of QR-Code for initiating of credit
  transfers", version 3.0 of 1 May 2021, the English edition of the "QR-Code
  und BCD Definition" ("PSA" below). Where the EPC leaves room it is
  stricter, and it adds what the EPC leaves out:
  - An amount "as short as possible", with "leading zeros ... not
    permitted", and a table of spellings: `EUR45` and `EUR184.6`, not
    `EUR45.00` or `EUR184.60` (3, note 5).
  - "Smaller QR-Code Versions are permitted" (4).
  - Modules from 15 to 20 mil, 0.381 to 0.508 mm, and a code "at the right
    most or left most lower edge of the page" (5).
  - "A surrounding frame and the words "Zahlen mit Code" (to the right from
    bottom to top)", with a figure: "Distance = 4 * m" and "Distance min.
    3 * m", "r=2*m", "Line width max. 0,8 * m", "Font size min. 7pt",
    "Font family Arial o.s. non-serifs" (5).
- **EPC409-09**, the EPC's list of the countries in the SEPA schemes'
  geographical scope, version 8.0 of 24 December 2025: the countries and
  territories a transfer reaches with the codes their BICs and IBANs
  carry (5), and which are in the EU or the EEA (2).
- **SWIFT's IBAN Registry**, release 101, for each country's length.
  swift.com refused the download (HTTP 403, "SWIFT site off-line"), so the
  lengths were read from python-stdnum's `iban.dat`, which says it was
  generated from that release, and agree with php-iban's registry for
  every country of SEPA.

The forces:
- **No slip and no place.** SIX fixes the QR-bill's slip at the foot of
  the paper
  ([0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)).
  The EPC prescribes no slip and no place, and the PSA's place is either
  lower corner of a page. A code stands where the template puts it,
  beside the payment details it repeats.
- **Half of the rules are the QR-bill's.** An IBAN's check digits and a
  creditor reference are checked as a QR-bill's are, modulo 97 (ISO 13616,
  ISO 11649), and those checks were in `qr-bill.ts`.
- **Exact values.** An amount travels as a string and never through a
  JavaScript number (formancy.ai-data 0008).
- **Personal data.** A code holds a name, an account and a reference, and
  a message never quotes a value from the data.
- **The faces.** Roboto prints every text but the QR-bill's slip, which
  prints in Liberation Sans 2.1.5, the face the renderer ships (0022). The
  PSA asks for Arial or a sans-serif like it.

## Decision

**The format has an `epcQrCode` component.**
- **Its fields.** `size`, the side of its square in points, with all the
  code draws inside it; `beneficiary` and `iban`, runs, required; `bic`,
  `reference`, `text` and `information`, runs, optional, a reference and a
  text never both; `amount`, an expression; `purpose`, a literal; and
  `caption`, `'zahlenMitCode'` or absent.
- **Where it stands.** Wherever a QR code may: in every region and every
  container an image stands in, never in a table's cells. Its square is
  held to `squareRoom`, as a QR code's is.
- **What its texts read.** What a paragraph in its place reads, in the
  report's scope. No page number or count: every text is encoded before
  there are pages (`misplaced-page-counter`).
- **One spelling.** An optional text that is absent is its element left
  empty, never an empty list of runs or a blank literal, and a text is one
  run at least.
- **A draft-format addition.** `reportSpecVersion` stays `'0'`. 0.1.0,
  which does not know the kind, refuses a report that holds one as
  `unknown-kind`.

**The EPC's rules are one set of checks, in report-spec**, as functions
over text, each answering the value it made of the text or the rule the
text breaks, never the text:
- **Shared with the QR-bill** (`payment-reference.ts`). The remainder
  modulo 97, digit by digit; an IBAN's check digits by it; and the creditor
  reference, RF, two check digits and up to 21 letters or digits, in any
  case. They moved there out of `qr-bill.ts`, which reads them now. What is
  the QR-bill's alone stays in `qr-bill.ts`: Switzerland's and
  Liechtenstein's accounts, the QR-IBAN, the QR reference and the pairing.
  The EPC's rules read the QR-IBAN's range from there (`isQrIban`), so
  that SIX's range is written once. `QrBillCheck` is the shared
  `PaymentCheck`.
- **The countries** (`sepa.ts`). One table of the 42 codes an IBAN of SEPA
  begins with, each with its length and whether it is in the EEA, and the
  BIC country each territory's banks carry, from EPC409-09 version 8.0 and
  the registry's release 101: a Guernsey bank's `GG` with a `GB` IBAN.
  Gibraltar, in neither of section 2's lists, is outside the EEA.
- **Each field** (`epc-payload.ts`).
  - The IBAN: its spaces dropped, and its letters made capitals once they
    are known to be A to Z; of a country of the table, of its length, its
    check digits right; and no QR-IBAN, which SIX keeps for QR-bills in
    francs paid with a QR reference (SIX's QR-bill guidelines, version
    2.4, 2.8 and 2.10) -- SIX's rule, not the EPC's, since a transfer in
    euro to one is not credited.
  - The BIC: four letters or digits, two capitals for a country of the
    table, two letters or digits, and three for a branch or none. It is
    given for an account outside the EEA, and is of the account's country
    by the codes EPC409-09 gives each territory's BICs and IBANs
    (`epcPairing`): this record's inference, so that a BIC typed for
    another country is refused, which neither EPC document states.
  - The reference: a creditor reference, and no other, its spaces dropped
    and its letters made capitals, as the IBAN's are. The EPC marks it as
    one the payer should not change (2.2, "Fixed") and says nothing of
    case, so it is written in one case rather than left to each banking
    app.
  - The name, the text and the information: at most their lengths in
    characters, and no control character, line or paragraph separator, or
    half of a surrogate pair, any of which would end its element early or
    has no UTF-8. A text is not trimmed.
  - None blank (`checkEpcField`). An element the code holds has one
    character at least (2.2, "1..70an", "1..140an"): a blank name or IBAN
    is refused as needed, and a blank optional text as the text left out,
    a second spelling of an absent one. Each text's name in a refusal, and
    whether it is optional, is one table, `EPC_TEXT_FIELDS`, which the
    validator and the runtime both read.
  - The purpose: four capital letters.
  - The amount: a decimal from 0.01 to 999999999.99 with two decimals at
    most, written from its own digits as short as it can be, `12.30` as
    `12.3` and `45.00` as `45`, and never rounded.
  - The payload (`epcPayload`): the twelve elements in the EPC's order, a
    line feed between them, every element up to the last the code holds a
    line, empty when unused, and nothing after the last. At most 331 bytes
    in UTF-8 (`checkEpcPayload`).
- **The print** (`epc-print.ts`). A module's side in a square, for a
  version, with or without the caption; the PSA's frame, caption and
  modules' widths; the least version a captioned code is drawn at
  (`epcLeastVersion`); and the rule a captioned code breaks
  (`epcCaptionBreak`), for every version when the validator asks and for
  the one encoded when the renderer does.

The validator applies them to every text of literal runs, as
`invalid-epc-qr-code`, with what literal texts can say only together: a
BIC its IBAN does not go with, or none where one is needed, and literal
texts already past 331 bytes. The runtime applies the same functions to
every text once the data has resolved it.

**What the code is.**
- **SCT in euro, in UTF-8.** Identification `SCT`, character set `1`, and
  nothing else.
- **Version `001` with a BIC, `002` without.** `002` is the version that
  lets the BIC be left empty. A code with one is written as `001`, as the
  EPC's first example is, which then is written byte for byte. Version 3.1
  keeps both.
- **Line feeds.** Never a carriage return.

**The editing core compiles it.** Each text is read as a paragraph's in
the report's scope, in the order the payload holds them, named after the
code. Its amount is compiled by the one rule a QR-bill's is: a decimal, or
null for the payer to fill in, a value that may be null checked as `dyn`.
An integer or a string is an `expression-type` error that names the EPC
QR code, on the code, with `dec()` as the hint. A new one is named
`epc-qr-code`.

**The runtime writes the payload.** An `epcQrCode` component resolves to
an `EpcQrCode` block: its id, its square, its caption when asked for, and
the payload.
- **Read as a paragraph.** Each text is read as a paragraph with the same
  runs prints it, then held to report-spec's rules, as
  `invalid-epc-qr-code` on its field, naming the code, the field and the
  rule and never the value. Every rule broken is said, in the payload's
  order.
- **Nothing is unused.** An optional text the data gives nothing a payer
  reads -- empty, blank, or null, the way a nullable field says "none" --
  is its element unused, in a final render as in a preview, and an empty
  BIC is no BIC: a customer with no BIC on record, an invoice with no
  reference, prints a code without one.
- **The amount** is a decimal, or null for the payer to fill in. Any other
  value is refused by its type.
- **Null, and a preview.** A final render refuses a null run that cuts a
  text short, as `no-qr-value`: a required text's, and an optional one's
  whose other runs print, "Rechnung " without its number. A preview prints
  it as nothing, and is refused where the EPC then lacks a text it
  requires, saying the preview had no value for it, as for a QR-bill.
- **Hidden is not checked.** A code whose condition does not hold is not
  drawn, and its values are not held to the rules: a credit note can hide
  its code rather than ask for 0.00.
- **The hand-on.** The renderer depends on the runtime alone, so the
  runtime re-exports report-spec's own `EPC_MAX_BYTES`, `EPC_MAX_VERSION`,
  `qrSymbolModules`, `epcModule`, `EPC_FRAME`, `EPC_CAPTION`,
  `EPC_CAPTION_MODULE`, `epcLeastVersion` and `epcCaptionBreak`, and the
  type `EpcCaption`.

**The renderer draws it** as 0020 draws a QR code: encoded once by uqr, as
UTF-8 at level M, its level never raised (`boostEcc: false`), at version 13
at most, its dark modules one path filled once in an SVG exactly its size.
- **Without a caption** it is a `qrCode` of its payload at level M: its
  quiet zone of four modules inside its square, the smallest version that
  holds it, and 0020's 0.4 mm floor.
- **With `caption: 'zahlenMitCode'`**, the PSA's rules:
  - Modules from 15 to 20 mil, compared in the hundredths of a point every
    length is stored in.
  - A frame half a module wide, its corners rounded by two modules, its
    inner edge four modules from the symbol on the left, above and below,
    its outer edge on the square's left and right, standing in the middle
    of the square's height. On the right it runs along the caption's
    baseline, at the outer edge of the caption's 7 pt band, so that its
    inner edge there is three and a half modules and the band from the
    symbol.
  - "Zahlen mit Code" in Liberation Sans at 7 pt, from bottom to top up the
    right side, centred on the symbol and no longer than it is tall, its
    baseline on the frame's line, which is broken a module beyond each end
    of it. The caption is text, which a reader finds.
  - **The version** is the least whose modules are at most 20 mil and whose
    symbol is as tall as the caption, or the payload's own when that is
    larger. A larger version of the same payload at the same level scans
    to the same bytes. In a 30 mm square the EPC's first example, version
    6, would have modules of 0.556 mm; it is drawn in version 8, at 0.479
    mm.
  - **The squares a captioned code prints in**, 68.06 to 118.6 pt. In a
    smaller one, no symbol with modules of 15 mil is as tall as the
    caption; in a larger one, even version 13's modules are over 20.
- **Refused**, naming the code by its id and never its payload:
  - as `content-too-large`: a payload past 331 bytes, before it is encoded
    when its characters alone are past them; without the caption, modules
    under 0.4 mm, naming the square the payload needs; with it, a square
    outside 68.06 to 118.6 pt, before encoding, and a payload whose version
    has modules under 15 mil, after; and a code wider than where it stands
    or taller than the body;
  - as `unsupported`: a size that is not a positive finite number, a
    caption it does not know, and a payload that is not text or holds half
    of a surrogate pair.
- **The caption's face or nothing.** pdfmake's SVG converter, when it
  cannot open a face, warns and draws the text in the last face it used.
  The renderer fails the render instead, as an engine's failure.
- **Liberation Sans reaches the caption as it reaches the slip.** The Node
  entry reads the package's `fonts`; the browser entry imports their chunk
  with the first document that has a bill or a captioned code.

**The corpus reads a turned run.** `readPdf` gives every run its angle,
and a turned run the box its letters' box turns into; `lines` makes a run
that does not read across the page a line of its own, so that the caption
is never joined to the IBAN printed beside the code.

**The builders offer it** as "EPC payment code", "EPC-Zahlcode" or "Code
de paiement EPC".
- **The palette's default.** A 32 mm square paying the report's language's
  "Name of the beneficiary" to `DE36 0000 0000 0000 0000 00`: its bank code
  is 00000000, and every bank code in the Bundesbank's register starts with
  a digit from 1 to 8 (read on 17 October 2026), so a code inserted and
  never edited pays nobody. No amount, which the payer fills in, and no
  frame. 32 mm is the least whole millimetre in which every payload the
  EPC allows prints, up to version 13's 331 bytes, with the frame and
  without: version 13's modules are 0.416 mm without it and 0.381 mm, 15
  mil, with it. A QR code's 30 mm would refuse a payload past 287 bytes
  without the frame and past 251 with it, so that a template made from the
  default would print one invoice and refuse the next by the length of its
  data alone. The euro invoice's code is 32 mm for the same reason.
- **Its fields**, in the order the code holds its elements, then its
  square and its caption: each text one line, since a line break would end
  its element. An optional text that is absent, or one literal run, is one
  field: typed into, it is the run; emptied, it is removed. An empty BIC
  says what it means: none, which a payer's bank outside the EEA may need.
- **Its name** in the outline is its kind and whom it pays: "EPC payment
  code: Franz Mustermänn".
- **The design view** draws its square, with no modules, frame or caption.

**The starters gain a euro invoice**, "Rechnung mit SEPA-Zahlcode", a
German heating firm's invoice to a private customer, with what UStG
section 14 (4) asks of one, as gesetze-im-internet.de gave the section on
16 and 17 October 2026; no test holds it. Its code pays the report's own
total by a creditor reference read from the data, and its page prints the
beneficiary, the IBAN, the BIC, the amount and the reference beside the
code, as the EPC means a code to be printed. Its account,
`DE83 0123 4567 0012 3456 78`, is of a bank code no bank has, its check
digits computed in BigInt; its BIC, `FMNCDEF0XXX`, is marked a test BIC by
the 0 in its location, as Wikipedia's article on ISO 9362 gives that rule,
and no bank in the Bundesbank's register has its four letters. The Studio
offers it as "Euro invoice", its id `euro-invoice`.

## Consequences

**What it buys.**
- **A code that asks for what the invoice states.** Its amount is an
  expression over the report's own values, written from its digits and
  never rounded on the way: the euro invoice's code asks for the total its
  table prints.
- **One reading of the EPC, and of modulo 97.** What the editor refuses in
  a literal and what the runtime refuses in data are one function, and the
  IBAN's check digits and the creditor reference are the QR-bill's own.
  Two copies could disagree, and nobody would find out until a banking app
  refused a code, or filled in another account.
- **A mistyped IBAN is refused where it is written**, on its field, with
  the rule, before anything renders, and the builders show it there.
- **No value in a message.** A refusal names the code, the field, the rule
  and a character's position, never the text.
- **A short payload is drawn larger, not refused.** With the caption, a
  template's square prints every payload whose version keeps modules of 15
  mil in it. Refusing what is too short for the square would refuse one
  invoice and print the next by the length of its data alone: in a 30 mm
  square, version 6's modules are 0.556 mm, over 20 mil, and version 11's
  0.396 mm, so that a fixed version would print the long payload and
  refuse the short one.
- **Proof on the PDF.** The EPC's own examples are decoded byte for byte
  from the page, and the caption, the frame and the quiet zone are read
  from the PDF's text, its drawing and its pixels.
- **No dependency.** uqr encodes it, as every code; nothing is added to a
  package.

**What it costs.**
- **0.1.0 refuses a report with one**, whole, as `unknown-kind`: fail
  closed ([0004](0004-three-version-lines-each-refused-when-unknown.md)).
  The format stays at the draft version.
- **SCT in euro, and nothing else.** No instant transfer: `INST` is in
  neither version 3.0 nor 3.1 of the guidelines. No other currency.
- **The amount has no currency.** It is a decimal, and nothing checks that
  the value a template binds to it is in euro: a total the report prints
  in francs is asked for as so many euros. The QR-bill has a currency;
  this code, which pays euro alone, does not.
- **UTF-8, and no other character set.** The EPC's second example, in ISO
  8859-1, is written in UTF-8: character set `1` where it has `2`, and 104
  bytes for its 103 characters. An umlaut takes two of the 331 bytes, a
  euro sign three. The symbol writes no ECI designator, as no QR code here
  does (0020); the payload's own third element says UTF-8.
- **A creditor reference, and no other structured reference.** A Belgian
  structured communication, or any national reference, is refused as a
  reference and goes in the text, which a bank does not read as one.
- **The purpose is four capital letters**, where the EPC types it as one
  to four letters or digits (2.2, "1..4an"); it is not checked against
  ISO 20022's purpose codes, which nothing here read.
- **The BIC's first four may be digits** on the EPC's data type alone,
  "8/11an" (2.2): Wikipedia's article on ISO 9362 gives four letters, and
  SWIFT's own text, which would decide it, could not be read.
- **Lower case, read three ways.** A lower-case IBAN or creditor
  reference is made capitals here; the QR-bill refuses a lower-case IBAN
  and keeps a reference's case, as SIX says banks draw no distinction; a
  lower-case BIC is refused here. Each is its own code's rule, and a
  person who types both codes meets both.
- **The countries are a table**, recorded on 17 October 2026. A country
  joining SEPA, or a length a registry release changes, reaches an
  installation only through a release of this module. The lengths are
  python-stdnum's copy of release 101, not SWIFT's file, which was not
  compared.
- **An account's territory is its IBAN's country.** Saint Pierre and
  Miquelon is outside the EEA and its accounts have French IBANs, so a
  code paying one is taken as inside it, and no BIC is asked for. New
  Caledonia, French Polynesia and Wallis and Futuna, which EPC409-09 does
  not list, have French IBANs too, as php-iban's registry gives them, so
  a code paying one is taken as a transfer within SEPA and the EEA. None
  can be told from a French account by the IBAN alone. Gibraltar is taken
  as outside the EEA, from EPC409-09's lists.
- **The BIC is asked for on the account's side alone.** The EPC keeps it
  mandatory where "SCT scheme participants from non-EEA countries" take
  part (2.2), and the payer's bank is one: a code without a BIC, paying
  an account in the EEA, may be refused by a payer's bank in Switzerland
  or Britain. No template knows its payer, so nothing refuses it; the
  builders' empty BIC field says so.
- **The BIC's country is an inference.** A BIC of another country than its
  IBAN's is refused, by the codes EPC409-09 gives each territory's BICs
  and IBANs. Neither EPC document says an account's bank has a BIC of the
  account's country, so an account whose bank's BIC is another country's,
  a head office's, is refused, where the transfer might have been made.
- **A QR-IBAN is refused**, by SIX's rule rather than the EPC's: a Swiss
  or Liechtenstein account whose institution is 30000 to 31999 is for
  QR-bills in francs paid with a QR reference (SIX's QR-bill guidelines,
  version 2.4, 2.8 and 2.10). Were SIX to open one to euro transfers, it
  would be refused here until a release of this module.
- **Nothing from the data is left out.** An optional text the data gives
  empty, blank or null leaves its element unused rather than refusing the
  render, so a missing BIC for an account outside the EEA is refused on
  the BIC, and a missing reference prints a code without one -- unlike a
  QR-bill, whose optional texts refuse a null in a final render (0022). A
  null among runs that print something is still refused, as a text cut
  short. A blank literal is refused, as a second spelling of an absent
  element.
- **The bytes are known when the data is.** The validator counts only what
  literal texts write, so its refusal is certain and late: a code whose data
  passes 331 bytes is refused by the runtime.
- **Version `001` with a BIC is a reading.** That every reader takes
  `001`, and that one built before `002` existed takes `001` alone, is this
  record's reasoning, not something a test shows.
- **The PSA's note 7, read one way.** The PSA says a reference and a text
  "always exist concurrently, although only one may carry content" (3,
  note 7), and that no line ending follows the last populated element. A
  code whose last element is its reference ends there, with no line for
  the text after it, as both documents' last-element rule says. Where the
  text or the information follows, the reference's line is there, empty.
- **Where the PSA puts a code, the format cannot.** The PSA asks for the
  lower edge of the page; nothing in version 0 pins a component to the
  foot of its last page. A code in the page footer prints on every page,
  and one in the summary where the body ends. The euro invoice's stands at
  the left of its payment details, below its totals.
- **Austria's frame is an option, not a default.** A code without it is
  held to 0020's 0.4 mm floor and to no largest module, where the PSA asks
  15 to 20 mil of every code printed on an invoice. The PSA's widths come
  with its frame, the one choice that marks a code as Austria's.
- **A captioned code's modules may be finer than 0.4 mm**, down to the
  PSA's 0.381, below the floor 0020 holds every other code to.
- **A captioned code is 68.06 to 118.6 pt** (24.0 to 41.8 mm), and refused
  in any other square. In a square larger than its payload needs, it is
  drawn at a larger version than the payload needs.
- **The corners reach into the quiet zone.** With the PSA's four modules
  and corners rounded by two, the frame's inner edge comes within 3.49
  modules of both of the symbol's edges at each corner -- 4.93 from the
  corner, straight -- and so half a module into the square of four
  modules ISO/IEC 18004 keeps quiet, as the PSA's own figure draws it.
  ZXing read every code drawn; a phone's reader was not tried.
- **Choices the PSA leaves open are this record's.** The line half a
  module wide, within its 0.8; the frame's outer edge on the square's
  sides and the frame in the middle of its height; the right line along
  the caption's baseline, broken a module beyond each end of it; the
  caption no longer than the symbol; and 7 pt, the least size it allows.
- **The caption rests on one face's metrics.** Its length, 51.36 pt, is
  report-spec's constant: its advance in Liberation Sans 2.1.5, 15026 of
  2048 units an em, measured with fontkit on 17 October 2026. A test holds
  it to the PDF the renderer draws, so another face or version fails there
  before it prints.
- **What the frame and the caption take.** In a 30 mm square, measured on
  the PDF on 17 October 2026: across, 8.5 modules and the caption's 7 pt
  band, 18.54 pt, so that the symbol is 78.2 % of the side; down, nine
  modules, and 3.16 pt of white above the frame and below it.
- **A render with a code takes longer and more bytes.** Through
  `renderPdf`, the euro invoice took 86 to 116 ms and 31,487 bytes; with
  Austria's caption, 114 to 135 ms and 38,207 bytes; with a spacer of the
  code's height in its place, 74 to 81 ms and 26,348 bytes. Measured on 17
  October 2026 by a script outside the repository, on an Intel i9-10900K
  under Node 24.21: each document resolved once, rendered once to warm up
  and then five times, in two rounds. The same day the same script found
  Liberation Sans embedded once in a PDF holding both a bill and a
  captioned code, through the Node entry and the browser entry alike, both
  run under Node.
- **A browser chunk for a caption.** The first captioned code in a page
  imports the fonts' chunk, as a bill does (0022): 1.1 MB, 519 kB gzipped,
  in the Studio's build.
- **The proof stops at the payload.** That a banking app takes the code,
  fills in the transfer as the EPC means, shows the information and does
  not send it on (PSA 3, note 8), nothing here shows. The guidelines are
  informative, and a bank need not read a code at all (EPC 1). Nothing
  checks that a template prints the code's details beside it, as the EPC
  means; the euro invoice does, and its test reads them.
- **No GiroCode.** The name some banks give the code, and its logo, are
  nowhere here: who owns the name, and what rules come with it, nothing
  here found. A person reads "EPC payment code".
- **The builders.**
  - A square too small for the frame is refused in report-spec's words, in
    points, in a field edited in millimetres.
  - A text of several runs, or a bound one, cannot be removed from the
    panel, and no run can be added: only an optional text that is absent
    or one literal run is typed in and emptied out.
  - The German and French words for its fields are this record's, and no
    native speaker's: "Purpose-Code", "RF-Gläubigerreferenz", "Hinweis für
    den Zahler", "Code motif" and "Note pour le payeur", and what an empty
    BIC field says.
  - In the design view a container's label sits at its top end and a
    component's at its top start, so a code at the top of a narrow column
    at a container's right end has its label printed over the
    container's. The euro invoice's code stood so at first, its label
    over its columns' and its keep-together block's, and the browser gate
    found the three unreadable, axe unable to tell the colour behind
    them; the starter now puts its heading above the columns and its code
    at their left. Nothing keeps an author from the layout it left.

**What it forecloses.** An EPC QR code as a report's payment part, and its
caption in a face the renderer does not ship. The format addition is a
draft's.

**Added 2026-10-17: an e-invoice's account, and a code printed with one.**
[0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)
holds an e-invoice's payment account (BT-84) to this record's IBAN rule,
`checkEpcIban`, for a SEPA credit transfer (58) and a credit transfer
(30) alike: an invoice that prints an EPC QR code beside its XML names
one account, held by one rule. So the rule's refusal of a QR-IBAN no
longer speaks of the code alone: "a SEPA credit transfer in euro carries
none". An EPC QR code printed with an e-invoice asks to be paid to that
account, refused by the validator where both are literal and by the
runtime where either is read from the data, and is refused where the
e-invoice names no account; and it asks for the amount due (BT-115), or
leaves the amount to the payer, which the runtime compares once both have
resolved, as `invalid-e-invoice` on the code. The cost this record states
of the amount, a decimal with no currency, holds less there: an e-invoice
is in euro, and its code's amount is held to the e-invoice's. Every other
rule of this record is as it was. `epc-payload.test.ts` passes on the new
words, and `validate-e-invoice.test.ts` and `lower-e-invoice.test.ts`
hold the rest.

## Alternatives considered

**A `qrCode` with a payload written into its content.** It works today,
with no new kind. Nothing would check what it holds: the IBAN, the BIC,
the order of the elements, the bytes and the reference would be the
author's, the level the author's choice of four, and the amount a value
formatted for the report's locale -- `1.132,44 €` in de-DE -- where the
code wants `1132.44`.

**A payment part, as the QR-bill is** (0022). The QR-bill is one because
SIX fixes a slip across the paper's foot, which no region inside the
margins holds. The EPC prescribes no slip, and the PSA's place is either
lower corner of a page, which a payment part would not reach any better
than a component: it would be a second place in the format for a code that
needs none.

**A library**, read on 17 October 2026 from the tarballs the npm registry
serves, each package's latest version:
- **sepa-payment-qr-code 2.0.2**, ISC, depending on `iban` 0.0.14, MIT. Its
  amount is a JavaScript number written with `toFixed(2)`, `EUR45.00`,
  which the PSA lists as invalid. It joins every element, so a code
  without information ends in separators after its last populated
  element, which the EPC forbids. Its lengths count UTF-16 units, it holds
  no byte limit, and its structured reference is unchecked, a "todo".
- **girocode 1.0.0**, MIT, depending on `iban` ^0.0.14. Its amount is a
  number written with `toFixed(2)`, and a code without one is written as
  `EUR0.00`, below the EPC's least amount. Its texts are cut to their
  lengths without a word, a reference to 25 characters, and its
  information is never written.
- **sepa-qr-code 1.1.0**, MIT, depending on `qrcode` ^1.5.4. Its amount is
  a string matched by a pattern, and never a number; but a code without
  one is written as `EUR1`, any three capitals pass as the currency, an
  IBAN is checked by its shape alone, and it writes eleven elements, its
  remittance in the structured reference's place and its information in
  the text's.
- **epc-qr-code 1.1.0**, MIT, its licence Bitfertig's, whose
  `@dipser/epc-qr-code.js` its README installs. It checks nothing, its
  default amount is `EUR0.00`, and by default it marks character set 2,
  ISO 8859-1, while its own encoder writes UTF-8.
- **eu-payment-qr 1.0.0**, MIT by its manifest, with no licence file in
  its tarball. Its amount is a number written with `toFixed(2)`, and 0 is
  accepted. A reference beginning with RF goes in the structured element
  with its check digits unchecked. Its `message`, held to 140 characters,
  is written as the information, which the EPC holds to 70. It has no
  byte limit, and its 36 countries leave out Albania, Gibraltar, Moldova,
  Montenegro, North Macedonia and Serbia.
- **sepa-payment-code 1.0.3**, MIT, depending on `iban` 0.0.11. Its amount
  is a number written by string conversion, `"EUR" + amount`, so 12.345 is
  written `EUR12.345`, and 0.1 + 0.2 `EUR0.30000000000000004`.
- **@euvena/qr 0.2.0**, Apache-2.0, with no dependency, published on 26
  September 2026, as the registry says: the nearest. It checks the IBAN's
  check digits and length, the BIC's shape, the BIC outside the EEA, a
  creditor reference's check digits, control characters and the 331
  bytes. But an amount given as a string is written as given, so
  `EUR45.00` and `EUR00045` pass, which the PSA lists as invalid, and its
  range is compared through `Number`; an IBAN of any registry country is
  taken, Brazil's or Saudi Arabia's, outside SEPA; a structured reference
  not beginning with RF passes unchecked; and its errors quote the value,
  `invalid IBAN "…"`, which a message here never does.
- **iban-qr-code 1.0.0**, GPL-3.0-or-later, which
  [0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)
  refuses. It was not read further.

Each writes a payload for some encoder, or encodes it its own way, and
none draws the PSA's frame. Each would be a second reading of the EPC
beside the one the validator needs for its literals anyway, as schoero's
swissqrbill would have been for the bill (0022).

**Version `002` always**, as first proposed. The EPC's first example,
which has a BIC, would not be written byte for byte, and `001` is the
version that asks for the BIC a code with one holds.

**The BIC optional for every account**, as first proposed. The EPC
keeps it "mandatory for SEPA payment transactions involving SCT scheme
participants from non-EEA countries" (2.2).

**ISO 8859-1 where a code's text allows it**, as the EPC's second example
is written: a byte for each umlaut. uqr writes text as UTF-8 (0020), and a
code whose third element says `2` over UTF-8 bytes is the mismatch
epc-qr-code ships. One character set, which every name has, is one path.

**The PSA's widths for every code.** The PSA is Austria's, the EPC gives no
size, and the PSA itself lets a screen's modules be larger. Its rules come
together, with the frame that marks a code as Austria's, and a code
without it keeps 0020's floor.

**Refusing a captioned square that is too large for a short payload**,
rather than raising the version. One template would refuse some invoices
and print others, by the length of their data alone.

**A frame three modules from the symbol**, the figure's other label. Four
meets both "Distance min. 3 * m" and "Distance = 4 * m", and keeps
ISO/IEC 18004's quiet zone clear of the caption along the sides.

**Rounding the amount to two places.** Refused instead, as for the bill
(0022): a template that does not round is found on its first render, and
the rounding belongs where the total is computed, once.

**A 30 mm square for a new code, as a QR code's.** The longest payloads
the EPC allows would be refused in it, past 287 bytes without the frame
and past 251 with it, by the length of their data alone. 32 mm prints
all of them, with the frame and without.

**A null in an optional text refused in a final render**, as a QR-bill's
is (0022). A nullable field is how data says "none": a customer with no
BIC on record, an invoice with no reference, would be refused at the
final render after its preview printed the code.

**A second check modulo 97 beside the EPC's rules.** The QR-bill's was
there, and copying it would have been the shortest way. Two copies could
disagree about which IBAN is typed right, and nobody would find out until
a bank refused one.

**"GiroCode" in the palette.** The name many German readers know, but its
owner and its rules are unknown here, and the EPC calls it a QR code for
SEPA credit transfers.
