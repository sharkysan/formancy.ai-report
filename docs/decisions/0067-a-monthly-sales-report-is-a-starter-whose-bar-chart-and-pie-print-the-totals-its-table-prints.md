# 0067 — A monthly sales report is a starter whose bar chart and pie print the totals its table prints

- **Status:** accepted; numbered while 0066 was held by a branch not yet
  merged
- **Date:** 2026-11-17
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The corpus.** report-corpus's `src/starters/sales-report.test.ts`
    holds the sales report to a bar chart by product line and a pie by
    region, each one sum of the lines' amount, sorted as the one table's
    groups are, and that table to every line, grouped by the bar chart's
    category, each group and the table closed by the same sum; every chart
    value and the table's amounts to two places; its lines to arriving out
    of the order the table prints them in, in product lines of unlike
    sizes, with credit notes below zero, every product line and region
    still above zero, every line inside the month it reports, and inside
    a chart's bounds; each bar and each slice, as the runtime resolves
    them, to its total recomputed in BigInt from the data, and each
    legend entry to the region's total and its share rounded once; its
    letterhead to page 1's own header, its running header to the month and
    its page count to the page regions; and each product line's header to
    being kept with its first three lines. `src/starters/starters.test.ts`
    holds the eleven starters by id, in order, each validating, opening
    with no diagnostic and resolving its own data in a final render with
    no warning; `src/starters/logo.test.ts` holds it beside the order
    confirmation as a letter that begins page 1's own header with the
    firm's mark; `src/report-size.test.ts` holds it to `MAX_REPORT_BYTES`
    and `MAX_WORDS` and their factors.
  - **The PDF** ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)).
    report-render-pdf's `src/sales-report.test.ts`: the table line by
    line across the page break, each product line's lines picked, ordered
    and grouped from the data in the test, its count, its total and the
    month's recomputed in BigInt and formatted with Intl, and the same
    month's total and count at the head of page 1; the corpus's `verify`
    over both pages, the charts' words, bars, slices and legend among it;
    each bar measured against the gridlines the PDF draws, standing on
    zero and as tall as its product line's total, within a quarter of a
    point, under the category its group heads, labelled with the very
    digits its group's total prints in the table, and the bars' labels
    adding up to the month's total the table prints; each slice measured
    by the turn its outline sweeps from where the regions before it end,
    within a quarter of a point of arc of its region's exact share, its
    legend entry the region's total and that share rounded once, and the
    slices' totals adding up to the month's; and page 1's mark at the
    margins' corner with the firm's line first under it, no running header
    on page 1 and no mark on page 2, page 2 opening with the running
    header, each page counted of two. `src/pictures.test.ts` holds its
    page 1 to its picture's lines, places and drawings, its caption quoting
    the key figure, the heating bar's label, its group's total and a
    region's legend entry; `src/pdfa-2b.test.ts` draws it as PDF/A-2b,
    its pages and its definition the plain render's, zrender's numbered
    names of its classes and clips read by the order they first stand in,
    as `browser.test.ts` reads them; `src/languages.test.ts` prints it
    with its own locale named as with none.
  - **The builders.** The Studio's `src/parity.test.tsx` walks it in both
    builders in the editor's three languages, a chart's row selected among
    a row of each kind, and again in a language the report does not
    declare; `src/journey.test.tsx` previews and renders it final in both
    builders; `src/preview/pipeline.test.ts` prints it through the browser
    entry with its title; `src/starters/starters.test.ts` and
    `src/studio.test.tsx` hold the picker's label, "Sales report".
    report-builder-core's `src/palette.test.ts` holds the palette to
    offering no chart, which this record leaves as it is.
    The browser gate walks it in Chromium in both builders at every pass
    that walks the journey, holds its Preview's pictured page to
    `docs/images/pictures.json`, measures it with axe, contrast and target
    size among its rules, and compares the two builders' trees over it. On
    17 November 2026, on Windows 11 in Chromium as `scripts/browsers.mjs`
    launches it, the whole gate passed: twelve passes, the journey in
    eight, 5,890 checks and none failed, in 18 minutes 22 seconds by its
    own record, alone on the machine. The README's Studio pictures were
    taken again by `scripts/pictures.mjs`, the picker's options in their
    bar holding "Sales report", and `test:pictures` passed over them.
  - **The e-invoice gate.** `scripts/e-invoice/pdf-corpus.mjs` draws
    `variant-sales-report.pdf` as a PDF/A-3b, and the PDF/A-2b plan
    `pdfa-2b-sales-report.pdf`; the judges' tests,
    `scripts/e-invoice/mustang.test.mjs`, `verapdf.test.mjs` and
    `corpus.test.mjs`, read the recorded run with both. Recorded with
    `--record` on 17 November 2026 on Zulu 25.0.4.1, every PDF it drew
    before at the digest it had: 166.2 s in all, Mustang 137.5 s, as the
    gate's own summary gave them, on one Windows 11 workstation with
    nothing else running.
  - **Seen failing, on 17 November 2026**, each before the code it holds
    or with it changed and put back:
    - the corpus's `sales-report.test.ts` before the starter existed, by
      its import; `starters.test.ts` with ten ids; `logo.test.ts`, four
      cases, the sales report named in its lists and in no starter;
    - report-render-pdf's `sales-report.test.ts` before the corpus was
      built with the starter, "salesReportLines is not a function"; and,
      with the resolved document changed in a scratch copy of the test and
      the copy deleted: the heating bar given another total than its
      label, "Heizung's height: expected 18.03… to be less than or equal
      to 0.25"; the ventilation bar's label one centime off, "expected
      [ '28'492.30' ] to deeply equal [ '28'492.20' ]"; the first two
      slices' totals swapped, "where Emmental ends: expected 57.19… to be
      less than or equal to 0.25"; and every group's total taken over the
      table, which failed both the table's lines and the bars' case,
      "expected [ 'Total Heizung CHF 124'793.00' ] to deeply equal
      [ 'Total Heizung CHF 63'482.00' ]";
    - `pictures.test.ts`, "show a page of every starter", before its
      picture;
    - the Studio's labels, "expected [ 'Service inspection', …(11) ] to
      deeply equal [ 'Service inspection', …(10) ]", and the pipeline's
      titles, "(no title for sales-report)";
    - the e-invoice gate's judges' tests, 23 cases, before the recording;
    - `pdfa-2b.test.ts`, "sales-report is the plain render’s pages": the
      first starter with a chart, rendered twice in one process, handed
      pdfmake a definition whose drawing named its classes `zr7-cls-24`
      where the first render named them `zr2-cls-4`, and nothing else
      apart; the test now reads those names as the browser entry's test
      does, and the pages PDF.js reads are the same.

## Context

0052, 0055 and 0058 made a chart something a report prints: the format
holds a bar, line or pie chart of the detail rows, the runtime totals each
series by the rule every total is computed by, its anti-goal "a number on
a chart that differs from the same number in the report's table" (0055),
and the renderer draws it laid out by Apache ECharts, every number and word
on it the runtime's. Each is held by the corpus's
chart fixtures, blocks built by hand as the runtime resolves one, in
English, of no firm and no data, and by the renderer's and the runtime's
own tests.

None of it is in a report a person opens. No starter holds a chart, so the
Studio never shows one, the README pictures none, the parity walk, the
journey and the browser gate have never opened a report with a chart in
either builder, and the e-invoice gate judges charts only as the corpus's
fixtures pasted onto a page. And the claim that makes a chart worth having
in a report writer -- that the bar and the table beside it say the same
number, to the centime -- has been held of the runtime's blocks, never on
a page a person reads beside a table.

A management report is where a reader meets that claim: a month's sales,
drawn as bars and a pie and listed under them, the totals the same in
each. It is also what a person evaluating a report writer looks for first
now that charts print.

The forces:
- **Every existing starter stays as it is**, byte for byte: their JSON is
  pinned, their pictures recorded, and the e-invoice gate's corpus holds
  their PDFs.
- **One firm** (0032, 0064): the firm's letters are one invented
  "Formancy" under one mark.
- **Invented, generic content**, and data no reader could take for a
  customer's (`Starter.data`).
- **The bounds the runtime resolves a chart within**: at most
  `MAX_CHART_CATEGORIES` categories, a pie no more than its palette's
  eight colours, and a pie refused where a category totals below nothing
  (0055); and the renderer's, which refuses category labels that do not
  fit across, words that meet and a word of a table's cell wider than its
  column, rather than cut any of them.
- **The builders draw a chart and do not edit it** (0052):
  report-builder-core's palette withholds `chart` (`NOT_OFFERED`), and
  `component-fields.ts` gives a chart only the fields every component
  has. A report that holds one opens, selects, moves, undoes and prints in
  both builders, its chart a box of its size in the design view.

## Decision

**A monthly sales report, "Umsatzbericht" (`starters/sales-report.ts`),
follows the product data sheet in `STARTERS`: the firm's sales of November
2026, drawn as a bar chart by product line and a pie by region, beside one
table of the same lines grouped by the bar chart's category, every total
to the centime.**

**The lines.** 42 sales lines, each a document's number, its date, its
product line ("Sparte"), its region, what was sold, how much, its unit and
its amount in Swiss francs, the quantity times the price to the centime:
heating, ventilation, plumbing and service in 13, 9, 12 and 8 lines, sold
in five regions around the firm's town. Two are credit notes, an amount
below zero, each in a product line and a region that still sell far more
than they credit. They arrive in no order the report prints them in.

**The charts**, side by side in a columns block under the report's head:
- **"Umsatz nach Sparte"**, a bar chart 290 by 220 points, one bar for
  each product line in the order of its name, each the sum of its lines'
  amounts, labelled with it; the axis titled "CHF".
- **"Umsatz nach Region"**, a pie 180 by 220 points, a slice for each
  region in the order of its name, its legend saying the region's total
  and its share of the month, the runtime's ratio rounded once to a tenth
  of a percent (0055).
- **Every value to the centime.** Both charts print their values as a
  number of two places with grouping, so a bar's label prints the very
  digits its group's total prints in the table: "63'482.00" on the heating
  bar, "Total Heizung CHF 63'482.00" under its group. One format prints
  every value a chart prints
  (0052), so the axis's ticks print two places too, "80'000.00".

**The table**, "Belege nach Sparte", under the charts:
- **Every line, grouped by the bar chart's category.** No condition
  (0062): the charts read every detail row, and a table that picked some
  would total fewer rows than the bars. Its groups are the product lines
  in the order of their names, as the bars stand, each headed by its name
  and how many lines it holds, "Heizung (13 Belege)", its lines by date
  and number, and closed by "Total Heizung" and the sum of its amounts;
  the table is closed by "Total Umsatz", the month's.
- **Its first column is the document's number**, unique to each line;
  then its date, its region, its description, its quantity and unit, and
  its amount in francs.
- **Each group's header kept with its first three lines** (0059), as a
  report that runs onto a second page should be. At this data, page 1
  ends four lines under the ventilation group's header, so the rule is
  stated and not met at this page end; the order confirmation is the
  starter that shows it at work (0064).
- **The heading is not kept with its table**, for 0064's defect: a heading
  kept with a table that runs past its page moves, with the whole table,
  to the next page. It stands under the charts, far from page 1's foot.

**Two pages, page 1's own header** (0060). The month's lines do not fit
under the charts, and a month's report reads as its charts and its key
figure on page 1, then its lines: so it runs onto page 2. Page 1 prints the
letterhead, the firm's mark and its line, in its own header, then the
title with the month, the period, the day it was made and the key figure,
"Umsatz CHF 124'793.00 aus 42 Belegen"; page 2 prints the running header
"Umsatzbericht November 2026 · Formancy Haustechnik AG" in its place, so a
reader of page 2 alone knows the month and the firm; the page footer counts
every page, "Seite 2 von 2". Under the table, a line says the amounts are
francs without VAT and a credit note lowers its product line's and its
region's sales.

**One language, Swiss German**, the firm's letters' language. The product
data sheet already shows the language switch (0064); the sales report's
27 words written again in three languages would show nothing it does not.

**What the builders do with it**, left as 0052 has it: both open it,
select a row of each kind, a chart's among them, undo and print it; a
chart is a box of its size in the design view, its properties the fields
every component has. Its kind, its category, its series and its words
are edited in neither builder, and nothing here builds that.

**The agreement is proved on the page.** The renderer's
`sales-report.test.ts` recomputes every total in BigInt from the data,
measures each bar against the gridlines the PDF draws and each slice by
the turn it sweeps, and holds each bar's label to the total its group
prints in the table and the labels together to the month's, and each
legend entry to the region's total and its share rounded once. `Number`
carries a measured coordinate and the quotient it is held to, never a
total.

**The PDF/A-2b's definition, read as a chart's is.** report-render-pdf's
`pdfa-2b.test.ts` holds each starter's PDF/A-2b to the definition pdfmake
is handed for the plain render, string for string. A chart's drawing names
its classes and its clips by the zrender instance that laid it out and a
count of each, which zrender advances with every chart in the process, so
the sales report's second render named them otherwise, and nothing else
differed. No class draws anything, the renderer having removed the one
style sheet that read them (0058); the test now reads each such name by
the order it first stands in, as `browser.test.ts` and
`chart-draw.test.ts` already did, and still holds the pages PDF.js reads
to be the same. The renderer is unchanged.

**The walks.** The picker offers it as "Sales report"; the README pictures
its page 1, the charts above the start of the table; every walk over the
starters walks it; and the e-invoice gate draws it as a PDF/A-3b variant,
which veraPDF and Mustang judge, and as a PDF/A-2b, which veraPDF judges,
recorded with `--record`.

## Consequences

**What it buys.**
- **A chart a person opens.** The Studio shows two charts of a report's
  own data in both builders, the README pictures them, and every walk --
  the parity walk in three languages, the journey, the preview pipeline,
  the browser gate and the e-invoice gate -- opens a report with a chart in
  it, which none did.
- **The claim shown where it is made.** A bar's label and its group's
  total print the same digits on the same page, and a test holds them to
  each other and to the data on the PDF.
- **veraPDF and Mustang judge a chart resolved from data**, beside the
  corpus's charts made by hand.

**What it costs.**
- **An eleventh starter in every walk.** The parity walk in three
  languages, the journey, the preview pipeline and the browser gate's
  passes each open one starter more, and the e-invoice gate draws two
  PDFs more. Not measured apart from the rest of the run.
- **A starter whose charts no builder edits.** A person who selects a
  chart finds only the fields every component has; what it totals, by
  what, its kind and its words are changed in the report's JSON alone,
  which the Studio does not offer. The design view draws each chart as a
  box, and the Preview alone shows the bars. The starter shows what the
  builders cannot do yet as plainly as what the renderer can.
- **An axis to the centime.** The ticks print "80'000.00" where a reader
  expects "80'000": one format prints every value of a chart (0052), and
  a format of no places would round the bars' labels off the table's
  totals.
- **A layout counted to its page.** Page 1 ends inside the ventilation
  group at the renderer's row heights, margins and faces as they are; a
  change to any of them moves the page end, and the picture's lines and
  places fail `pictures.test.ts` until it is drawn again. The table's own
  test reads the lines across the break wherever it falls.
- **A keep stated and not met.** The group headers ask for three lines,
  and no header stands near page 1's foot at this data; the rule is shown
  at work by the order confirmation, not here.
- **Shares that happen to add up.** The five shares print 8.0, 24.3,
  13.9, 23.2 and 30.6 %, which add up to 100.0 %; a reader may take that
  for a rule the runtime keeps, which it does not (0055), and another
  month's need not.
- **Two choices made for the corpus's reader.** The table's first column
  is the document's number, not the date a reader might look for first,
  and a group's header says its count, not its bare name: the corpus finds
  a table's row by its first cell, and a date shared by two lines, or a
  product line's name the bar chart prints as its label on the same page,
  was found as several rows (measured on the first draft, "Heizung appears
  3 times, on pages 1, 1, 1").
- **Invented and unreviewed.** The products, quantities, prices and
  documents are invented; the regions are named after places around the
  firm's invented address, and no figure is any firm's.
- **Lists that name the starters** -- the mark's, the e-invoice gate's
  tests, the picker's labels and the preview pipeline's titles -- each
  grew by one.
- **Inside the bounds, measured.** The report is 7,060 bytes with 27
  words and 2 expressions at word places, under the order confirmation's
  10,427 bytes and 32 words, so `limits.ts`' comments hold as written
  (measured on 17 November 2026 under Node 24.21.0 on Windows 11, as
  `report-size.test.ts` measures them).

**What it forecloses.** Nothing that cannot be undone: the starter can be
taken out of `STARTERS`, its lists, its picture and its recording with it.

## Alternatives considered

**A chart added to an existing starter**, a pie of the order
confirmation's kinds or a bar chart under the equipment register. Every
existing starter stays byte for byte: its JSON's pin, its pictures and its
recorded PDFs would all move, and neither is a report a reader expects a
chart in.

**The corpus's chart fixtures as a starter.** They are blocks built by
hand, in English, of no firm and no data, each made to hold one rule of
the drawing; a starter is a report an author begins from, resolved from
its data.

**Sales by week as the bars.** The table would then group by week for its
totals to stand beside the bars, a field the provider would compute, and
a month's reader asks first which product line sells.

**One chart above the other, each the page's width.** It leaves no room
on page 1 for the table to start, and the pie in the page's width leaves
most of its box white.

**A currency format on the charts**, "CHF 63'482.00" on every bar and
tick: wider labels in a bar's slot, and the currency said a dozen times
where the axis's title says it once.

**Whole francs on the charts.** The axis would read as a reader expects,
and every bar's label would round its group's total, which the table
prints to the centime: the one claim the starter is for.

**A further table by its condition** (0062): the credit notes apart, or
the orders above a sum. Every line already prints in the grouped table, so
it would print some twice; the order confirmation shows several tables;
and the table a pie's regions would want, their totals without their
lines, is no table the format has, a table printing its rows, so the pie's
legend says each region's total.

**A report on one page**, twenty lines a month. Too few for a firm's
month, and a page that shows no second page leaves page 1's own header
showing nothing a report needs it for.

**In four languages, as the data sheet.** Its 27 words in three more
languages would show the switch the data sheet shows, and nothing else.

**Chart editing in the builders here.** Selecting a chart's kind, its
category, its series and its words in both builders, held to each other by
the scenarios, is its own change with its own record; this one adds a
report, and changes no builder.
