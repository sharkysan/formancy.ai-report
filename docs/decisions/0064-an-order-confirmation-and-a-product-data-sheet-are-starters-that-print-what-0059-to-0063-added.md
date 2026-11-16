# 0064 — An order confirmation and a product data sheet are starters that print what 0059 to 0063 added

- **Status:** accepted; lifts [0060](0060-a-reports-first-page-may-print-a-header-of-its-own-or-none-in-place-of-the-page-header.md)'s limitation that no e-invoice variant draws a header of page 1's own
- **Date:** 2026-11-16
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The corpus.** report-corpus's `src/starters/starters.test.ts`
    holds the nine starters by id, in order, each validating, opening with
    no diagnostic and resolving its own data in a final render with no
    warning. `src/starters/order-confirmation.test.ts` holds the order
    confirmation's three tables to the three kinds its lines have and no
    other, each table's last column to a header no other column of the
    report has, its lines to arriving out of the order the tables print them
    and its deliveries to being of unlike sizes, its goods' group to
    keeping three lines, its letterhead to page 1's own header and its
    running header and page count to the page regions.
    `src/starters/product-data-sheet.test.ts` holds the data sheet to the
    German sheet with a translation for French, Italian and English,
    valid and whole in every language it declares; written in each
    language, to the sheet written in it alone; its nine runs set off the
    line to the same runs in every language, and the report and its data
    to holding no character of Unicode's super- and subscripts; and its
    data to numbers, a date and three names. `src/starters/logo.test.ts`
    holds the data sheet among the letters that begin their report header
    with the mark, and the order confirmation as the one that begins page
    1's own header with it, with no image in its report header or its
    page header. `src/report-size.test.ts` holds both to
    `MAX_REPORT_BYTES` and `MAX_WORDS` and their factors. `src/lines.test.ts`
    holds `offLine` to the runs `pageLines` reads into another run's line,
    each with that run.
  - **The PDFs** ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)).
    report-render-pdf's `src/order-confirmation.test.ts`: each table's
    lines, line by line across the page break, its lines picked, ordered
    and grouped from the data in the test and every subtotal and total
    recomputed in BigInt and formatted with Intl, and the order's net, VAT
    and total under them; the corpus's `verify` over its two pages; page
    1's mark at the margins' corner with nothing beside it and the
    firm's line first under it, no running header on page 1 and no mark on
    page 2, page 2 opening with the running header, and each page counted
    of two; and the third delivery's header and its first three lines on
    page 2, where the same document with the count taken out prints the
    header on page 1 with two of its lines under it.
    `src/product-data-sheet.test.ts`, in each of the four languages: the
    corpus's `verify`, `shiftedRuns` among it, over the document resolved
    in that language, the expectation's nine runs stated as a guard;
    every line of the page, each value as Intl writes it in that locale
    and the U-value recomputed in BigInt from R; the PDF's title; no
    German word that differs from the language's own; and the PDF equal by
    `inflatedDigest` to the sheet written in that language alone.
    `src/pictures.test.ts` holds a picture of every starter, and each of
    the two new ones to its page's lines, places and drawings;
    `src/pdfa-2b.test.ts` draws both as PDF/A-2b; `src/languages.test.ts`
    prints both with their own locale named as with none.
  - **The builders.** The Studio's `src/parity.test.tsx` walks both
    starters in both builders in the editor's three languages, adding a
    language the report does not declare; `src/journey.test.tsx` previews
    and renders both final in both builders; `src/preview/pipeline.test.ts`
    prints each through the browser entry with its title;
    `src/starters/starters.test.ts` holds the picker's labels. The
    browser gate walks both in Chromium in both builders at every pass and
    holds each Preview's pictured page to `docs/images/pictures.json`, its
    text layer read with runs set off the line read into their line.
  - **The e-invoice gate.** `scripts/e-invoice/pdf-corpus.mjs` draws
    `variant-order-confirmation.pdf` and `variant-product-data-sheet.pdf`
    as PDF/A-3b, and `variantProblems` holds the variants to every
    starter; the PDF/A-2b plan draws both as `pdfa-2b-*.pdf`. The
    judges' tests, `scripts/e-invoice/mustang.test.mjs`,
    `verapdf.test.mjs` and `corpus.test.mjs`, read the recorded run with
    both. Run with `--record` on 16 November 2026 on Zulu's Java 25.
  - **Seen failing, on 16 November 2026**, each before the code it holds
    or with it taken out and put back:
    - the corpus's new cases before the starters existed, by their
      imports; `starters.test.ts` with seven ids; `logo.test.ts`'s new
      lists, naming starters the corpus did not have yet; the data sheet
      resolving its own data refused as `completeness-mismatch`, its data
      saying one row captured where it has none, which the case found;
      `lines.test.ts` without `offLine`;
    - `order-confirmation.test.ts`'s kept delivery with 27 goods lines,
      every one of them on page 1, the third delivery's header and its
      lines among them;
    - `product-data-sheet.test.ts`'s lines in every language with the
      renderer's line reader reading each run set off the line as a line
      of its own;
    - the parity walk on the data sheet adding French, which the sheet
      declares, as the walk did: "fr-CH was not added";
    - the e-invoice gate's judges' tests, 23 cases, before the recording;
    - the browser gate, four checks, at the two widths where the design
      view stands beside the Preview, in both builders: "the contrast of
      every text in view decided", undecided for "Betrag (goods/amount)"
      and "Betrag (services/amount)" (`bgOverlap`), with both amounts
      headed "Betrag"; and `order-confirmation.test.ts`'s case of the
      last columns' headers, written then, the same way.

    Not watched failing: the browser gate's reading of the text layer
    without the join, which a run of the whole gate would take. It read
    the data sheet's page in Chromium as `pictures.json` records it, in
    both builders, on 17 November 2026.

## Context

0059 to 0063 each added something a report prints: a group header kept
with its first rows (`keepWithRows`), a first page's own header
(`regions.firstPageHeader`), a run set below or above the line
(`baseline`), several tables over the detail rows (`rowsWhen`), and a
report's words in several languages (`translations`). Each is held by
fixtures and by the renderer's tests, and none by a report a person opens:
0060 says no starter uses its region, 0061 that no starter sets a
baseline, the order of three tables 0062 proves is the renderer's test
document and never offered by the Studio, and the invoice in four
languages 0063 proves is the corpus's, beside the starters.

A person meets the format through the starters: the Studio opens them,
the README pictures them, both builders are compared over them, and the
e-invoice gate draws each as a PDF/A-3b variant and as a PDF/A-2b
([0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md),
[0057](0057-a-report-that-is-no-e-invoice-is-drawn-as-a-pdf-a-2b-where-the-host-asks-for-one.md)).
So veraPDF and Mustang had judged no PDF whose page 1 prints its own
header, which 0060 states as a limitation, and nothing a person opens
showed a formula, a translated report, a kept group or three tables.

The forces:
- **Every existing starter stays as it is.** Their JSON is pinned, their
  pictures recorded, and the e-invoice gate's corpus holds their PDFs; a
  starter changed to show a feature moves all of them.
- **One firm.** The firm's letters are one invented "Formancy" of a trade,
  under one mark
  ([0032](0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md)):
  a second identity would be one more to review.
- **Invented, generic content**, and data no reader could take for a
  customer's (`Starter.data`).
- **The bounds `limits.ts` states.** `MAX_REPORT_BYTES` and `MAX_WORDS`
  each leave sixteen times the largest report the corpus holds, named and
  measured in their comments: a starter past either would leave a comment
  stating a margin nobody has.

## Decision

**Two starters follow the site visit in `STARTERS`, each a letter of the
firm's, under its mark: an order confirmation, which prints 0059, 0060 and
0062, and a product data sheet, which prints 0061 and 0063.**

**The order confirmation** (`starters/order-confirmation.ts`), in Swiss
German, "Auftragsbestätigung":
- **One list, three tables.** Its 43 lines are goods, services and
  returns, by their `kind`, given out of every order the tables print
  them in. Three tables pick theirs by `rowsWhen` -- `row.kind ==
  "goods"`, `"service"`, `"return"` -- each with its own columns (the
  services have no article column, the returns no price and a credit
  column), its own order and its own total row, `over: 'table'`. Each
  table's last column is headed as no other column of the report is --
  the goods' amount "Betrag", the services' "Total", the returns'
  "Gutschrift" -- since the builders label two columns of one header by
  their ids, and at a table's right end that longer label stands over the
  table's own in the design view, whose contrast axe cannot decide (the
  debt 0032 names). A
  return is credited, its amount negative. Under the tables, outside
  them, the order's net amount over every line (`totals`), its VAT
  rounded to the centime and its total, the invoice's arithmetic.
- **Deliveries kept with three lines.** The goods are grouped by the day
  of their delivery, a date, headed "Lieferung vom" and the day as the
  locale writes it, closed by the delivery's subtotal, and each header is
  kept with its first three lines (`keepWithRows: 3`). Its deliveries hold
  15, 14 and 6 lines, so many that the third delivery's header falls two
  lines' room above page 1's foot: kept with one line, as before 0059, it
  would print there with two of its lines; kept with three, it starts
  page 2.
- **Page 1's own header.** Page 1 prints the letterhead in its own header,
  `LETTERHEAD` and the firm's line (`sender`), and page 2 a slim running
  header in its place, the order's number and the customer; the page
  footer counts every page, "Seite 2 von 2".
- **The goods heading is not kept with its table.** A heading kept with a
  table that runs past its page moves, with the whole table, to the next
  page, leaving its own page without either (below); the goods heading
  stands where page 1's body starts, so no page ends under it. The
  services' and the returns' headings are kept with their tables, which
  fit their page.

**The product data sheet** (`starters/product-data-sheet.ts`, its words
in `starters/product-data-sheet-words.ts`), for an invented insulation
board for underfloor heating, "Produktdatenblatt":
- **Values off the line.** The cube of kg/m³, the squares of m²·K/W, of
  W/(m²·K) and of "pro m²", CO₂'s index and two footnotes' marks are nine
  runs set below or above the line, each beside a run on the line, a
  footnote's mark a no-break space from its text; none is one of
  Unicode's super- or subscript characters.
- **A row of two columns for each value.** A table's cell refuses a
  baseline (0061), so each value is a paragraph beside its label's, in a
  row of its own.
- **Its U-value is the report's.** 1/R, rounded to the hundredth, an
  expression that prints a number and so no word in any language; the
  footnote says so.
- **In Swiss German, with French, Italian and English.** One report, its
  own words German, its translations those of the other three, keyed by
  the German, as the four-language invoice is made (0063). The words of
  each language are a table of their own; `productDataSheetAlone` writes
  the sheet in one language alone, which a render of the starter in that
  language is held to. The units, the same in every language, are words
  all the same, and are written again in each. The firm's line under the
  mark calls its UID the VAT number in each language's word.
- **Data no language translates.** Numbers, the date it was issued, and
  the board's name, its article number and its fire class.

**Both carry the firm's mark** (0032): the data sheet at the head of its
report header, as the firm's other letters; the order confirmation at the
head of page 1's own header. `logo.test.ts` states which.

**What reads them reads a formula as one line.** The README's pictures
are read with the renderer's tests' copy of the corpus's line reader,
which read a run set off the line as a line of its own; the Studio's
browser gate reads the Preview's text layer by the bottoms of its boxes,
where a lowered run's box, by Roboto's ascent, ends just inside the
gate's tolerance of its line's -- worked out from the geometry 0061
states, not measured -- so that the two read the subscript of CO₂ two
ways. Both now read such a run into
its line, as the corpus does (0061): the corpus exports its rule,
`offLine`, which the renderer's copy reads with; and the gate reads a box
`SHIFTED_SIZE` of a box beside it, within the corpus's `JOIN_GAP` of it
and over it, into that box's line, the text layer drawing each box as
tall as its run's size.

**The walks.** The parity walk adds a language the report is not written
in, French or else Romansh, where it added French to every starter; the
e-invoice gate draws both as variants and as PDF/A-2b, recorded with
`--record`; the picker offers both, "Order confirmation" and "Product data
sheet". The README pictures the order confirmation's page 2 -- the
running header, the kept delivery, the services and the returns and the
totals -- and the data sheet's page.

**Not decided here: the renderer's heading kept with a long table.** A
paragraph kept with the next block (`keepWithNext`) breaks before itself
when that block does not start on its page, and a table's start is read
from its first cell, its column header's. A table that runs past its
page repeats that header, and the rule then finds the table starting on
the next page: a paragraph, a heading and an 80-row table printed page 1
with the paragraph alone, measured on 16 November 2026 in the renderer's
own documents. Reading the table's start from its first row under the
header printed the heading and the table's first rows on page 1. That is
a change to what the renderer prints, and its own record's or fix's, not
this one's.

## Consequences

**What it buys.**
- **Each of 0059 to 0063 printed by a report a person opens**, in the
  Studio and in the README, in both builders in every walk, and judged
  by veraPDF and Mustang as a PDF/A-3b variant and by veraPDF as a
  PDF/A-2b: the first PDF/A-3b they judge whose page 1 prints its own
  header, and the first of a run set off the line.
- **A translated report in the Studio.** The bar's language switch shows
  on a starter, and each of its four languages prints whole.
- **A defect found.** The order confirmation showed the renderer moving a
  heading and a long table to the next page; nothing before held a
  heading over a table that runs past its page.
- **One reading of a formula.** The corpus's checks, the renderer's
  tests, the README's pictures and the browser gate read "CO2-Äq." on the
  line it stands on.

**What it costs.**
- **Two more starters in every walk.** The parity walk, in three
  languages, the journey, the preview pipeline and the browser gate's
  passes each open nine starters where they opened seven, and the
  e-invoice gate draws four PDFs more.
- **A layout counted to its page.** The third delivery meets page 1's
  foot because of how many lines stand above it, at the renderer's row
  heights, margins and faces as they are; a change to any of them moves
  the page end, and `order-confirmation.test.ts` fails until the lines
  are counted again. The test says which page each line printed on.
- **A heading not kept, for a defect.** The goods heading is the only
  heading of the firm's letters that is not kept with what it heads; an
  author who copies the starter and moves the goods table down a page may
  find the heading at a page's foot, and one who keeps it with the table
  meets the defect until it is fixed.
- **Units written four times.** "mm", "kg/m", "W/(m·K)" and the others
  print the same in every language, and each translation writes them
  again (0063's cost of a literal that holds a letter).
- **Invented and unreviewed.** The board, its values and its class are
  invented and claim no test of any board; EN 13501-1 and EN 15804 are
  named as a data sheet names them, and the board meets neither. No
  native speaker has reviewed the French, the Italian or the English.
- **English as `en` writes it.** The sheet's English is `en`, so its date
  prints as "November 2, 2026", ICU's English, not as a Swiss firm writing
  English might date it.
- **The gate reads sizes, not moves.** The browser gate's text layer
  says no baseline, so it reads a box at `SHIFTED_SIZE` of one beside it
  into its line wherever it stands over it, where the corpus reads only
  a run moved by `SHIFTED_RISE`. A run drawn at that size and moved
  otherwise would be one line in Chromium and two in Node, and the
  pictured page's check fails there rather than passing it.
- **A picture reads "kg/m3".** Text extraction says nothing of a run's
  place, so the picture's lines and the gate read a power as a digit
  after its unit; its caption describes the page in Unicode's characters,
  which no line holds, and quotes the headings alone.
- **Lists that name the starters.** The mark's lists, the e-invoice
  gate's tests, the picker's labels and the preview pipeline's titles
  name each starter, as they are written to, and each grew by two.
- **Inside the bounds, measured.** The order confirmation's report is
  10,426 bytes with 33 words and 2 expressions at word places, the data
  sheet's, translations and all, 12,828 bytes with 28 and 1, between the
  smallest report the corpus holds and the next to the XRechnung sample,
  and under its 49 words and expressions, so `limits.ts`'s comments hold
  as written (measured on 16 November 2026 under Node 24.21.0 on Windows
  11, as `report-size.test.ts` measures them).

**What it forecloses.** Nothing that cannot be undone: a starter can be
taken out of `STARTERS`, its lists and its pictures with it.

## Alternatives considered

**Changing the existing starters to show the features**: the quotation's
mark in page 1's own header, the invoice in four languages as the Studio's
invoice. Every existing starter would move: its JSON's pin, its pictures,
its recorded PDFs; and the invoice in four languages is the German
starter's report with its translations, which 0063 keeps beside the
starters so that the four samples stay four reports.

**One starter for all five.** An order confirmation in four languages with
formulas in it. A unit's power has no place in an order's lines, whose
cells refuse a baseline; and one report holding both documents' words
and expressions, 35 and 29, would hold more than the XRechnung sample,
which `limits.ts` names as the report with the most, and exactly
`MAX_WORDS`' sixteenth, the factor the bound is to leave. Two documents
each print what they would print anyway.

**The renderer's test documents as starters.** The order of three tables,
the first page fixtures and the shifted fixtures are English documents of
no firm, built to hold one rule each; a starter is a letter an author
begins from.

**Unicode's superscript digits.** "m²" typed would print in the face's
own small glyph, or be refused where the face lacks it, and is no run a
person sets or a check finds: it is what a data sheet does without 0061.

**A table of values.** A table's cell is one string at one size and
refuses a baseline (0061).

**Translations for the order confirmation too.** One starter in several
languages shows the switch; a second would add its words in three
languages for no proof the first lacks.

**Fixing the renderer's defect here.** It is one line of `content.ts`, and
a change to what the renderer prints for every report that keeps a
heading with a table that runs past its page; it belongs to a change of
its own, with its test, where it is reviewed as one.

**Leaving the readers as they were.** The data sheet's picture would hold
its lowered digit as a line of its own in Node and, by the geometry
worked out above, on its line in Chromium, a hair inside the gate's
tolerance, so that the gate's check of the picture would rest on a hair
either way; and the picture's lines would read "CO", "2" and "-Äq."
apart.

**Page 1 of the order confirmation as its picture.** It shows the
letterhead and two deliveries; page 2 shows the running header, the kept
delivery and all three tables' totals, and page 1's letterhead is held
on the PDF.
