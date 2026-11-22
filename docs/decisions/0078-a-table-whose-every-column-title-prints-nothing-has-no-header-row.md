# 0078 — A table whose every column title prints nothing has no header row: the runtime decides it once, and neither engine prints a band of nothing for it

- **Status:** accepted; numbered while 0069 was held for a workbook's export, 0070 to 0073 by a branch not yet merged, and 0077 by the e-invoice copy's Word file, which merged before this record; extends [0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md), whose resolved table may now have no header row, [0011](0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md), whose renderer draws such a table under no band and breaks it as every table, and [0068](0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md), whose writer writes no header row for it and marks none to repeat; and [0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md), under which it is proved on the PDF and on the Word file
- **Date:** 2026-11-22
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The runtime.** report-runtime's `src/lower-table.test.ts`, "a
    header that prints nothing (0078)": a table whose every column title
    is empty resolves with no `header` and no `headerStyle`, its rows as
    before; titles of a space, a no-break space, two spaces and a tab
    alike; one titled column keeps the header as the report states it,
    its blank titles with it, and its style; the only titled column
    hidden by a render leaves no header, and shown, the header; and a
    table with no header and no rows its empty text and its totals.
  - **The renderer, on the PDF.** report-render-pdf's
    `src/no-header.test.ts`, each case read back with PDF.js:
    - a grouped table of four groups over three pages held by the
      corpus's checks, its first line under its top rule on every page,
      no band, and no rule in black, the one the rule under a header is
      drawn in, where the same table with its header draws one a page;
    - swept across a page's foot by lines above it, the table's first
      group header on the page of its first row, and a one-line table's
      line on the page of its subtotal and total;
    - 400 groups laid out at most three times, and twelve groups of six
      to fourteen rows to the bytes the rules alone make;
    - a table in a keep-together block under no band, and one in the
      page footer with no rule in black;
    - a row of a 40 pt line refused in a body of 52.87 pt as needing
      51.88 of a page under the table's top rule, and printed in one of
      52.88, where under a header of its size it needs 103.25;
    - and the corpus's `titles-from-groups-report`, a report as a person
      writes it -- every column titled with nothing or a space, a group
      header naming the columns across the table -- resolved with no
      header row and drawn over three pages with no band and no rule in
      black.

    `src/pdfmake.test.ts` pins what the renderer hands pdfmake for such a
    table, in the renderer's own `UNSEEN_LAYOUT` and `TABLE_LAYOUT`: a
    header row of empty stacks, with no padding and no rule under it, lays
    every row out where a table pdfmake is handed with no header row lays
    it, page by page, with the same paths; and a header row of empty text
    is laid out a line tall, the band. `src/corpus.test.ts`
    and `src/browser.test.ts` render the corpus's `titles-from-groups`.
  - **The writer, on the Word file.** report-render-docx's
    `src/blocks.test.ts`: such a table is written with no header row, no
    row marked to repeat and no darker rule, its first group header kept
    with its first row and its last row before its total with the total,
    and, with no detail row, its empty text its first row; one whose first
    rows are plain rows keeping none of them for a header it does not
    have; and `titles-from-groups-report`, resolved by the runtime, written
    with no header row and no row marked; each read back by the corpus's
    `readDocx` and held by `verifyDocx`. `src/refusals.test.ts` refuses
    such a table in a framed section for what is not known of it, not for
    a header it does not have. `src/corpus.test.ts` writes
    `titles-from-groups` and holds it, and `src/against-pdf.test.ts` holds
    its sizes and weights to the PDF.
  - **The corpus.** report-corpus's `src/check-headerless.test.ts`, on
    PDFs pdfmake makes with the renderer's look: the right one passes,
    and the check names, on both pages, the band of an empty header row
    and the rule under it, the band of a header of white space, bands
    taller than the first row -- a blank header at 14 pt and one of a
    no-break space at 12 over rows of 9, a blank one at 9 over rows of
    7 -- and a first line 17.95 pt under the top rule where the rows stand
    3.4 under theirs; and it names no band where a table without a header
    row stands right on another's foot, two rules half a point apart.
    report-render-docx's `src/blocks.test.ts` holds `verifyDocx` to naming
    a blank header row written for a table that has none, as "table lines
    marks 1 of its rows as the row to repeat on every page, and has no
    header row" where it is marked and as one row too many where it is
    not. `src/fixtures/fixtures.test.ts`
    holds `HEADERLESS_FIXTURES` to `titles-from-groups`, its table to no
    header row in its document and its expectation, and its groups placed
    so that, for every plausible number of rows a page holds with none
    repeating over them, a group header would end a page if an engine let
    it. The trial's adapters refuse a table without a header row as
    `unsupported`, naming it, where they refuse everything the trial
    never drew (`src/trial/undrawn.ts`; `src/trial/pdfmake.test.ts`,
    `src/trial/pdfme.test.ts`).
  - **Nothing else prints otherwise.** Every corpus fixture, every
    malformed document, a page of each image kind, and every starter and
    sample in each language it declares, final, preview and an
    e-invoice's copy, written as a PDF and as a Word file with `main`'s
    build at e4256ff4 and with this one, on 22 November 2026: a script's
    comparison, made once and kept nowhere (Consequences). What holds it after that day: the cases of the
    four suites that ran before, unchanged, and the `e-invoice` gate on its
    recorded corpus without `--record`.
  - **Seen failing, on 22 November 2026**, on Windows 11 and Node 24.21.0,
    each case run before the code it holds, or with that code changed in
    the working tree and restored:
    - the runtime's: four of the five cases against the runtime as `main`
      has it, the header written as the columns' titles, blank ones and
      all; the case of one titled column passing, as it should;
    - the renderer's: all six of `no-header.test.ts`'s against `main`'s
      renderer, which read a table's header and found none
      (`TypeError`); with a header row of blank cells drawn for such a
      table, as `main` drew a header of blank titles, the first case, the
      corpus's check naming a band of 15.05 pt between two rules over the
      first line of each of its three pages; and with the header of no
      height drawn but the rows that move with it withheld from pdfmake
      (`keepWithHeaderRows`), the case swept across the page's foot, a
      first group header the last row of its page;
    - the writer's: its case against `main`'s writer (`TypeError`), and
      with a header row of blank cells written, the row marked to repeat,
      and `verifyDocx` saying "table lines marks 1 of its rows as the row
      to repeat on every page, and has no header row";
    - the trial's: both adapters' cases, each failing with a `TypeError`
      rather than a refusal;
    - the fixture's: its groups placed for a page under a header, as
      `group-boundary`'s, its placement case failing at 61 rows a page,
      which no group header would then end;
    - after a review, the corpus check's: the three bands taller than the
      first row passed by the check as it was, which held a band to the
      first row's height, and a band of 0.5 pt named between two tables
      standing one on another; the writer's case of plain first rows,
      with its rule as it was, which kept the first row of any table, and
      again with the corpus's mirror of that rule as it was, the check
      saying the first row was not kept; the check of a blank row written
      for such a table, its unmarked half against the count's words as
      they were and its marked half with the marking's check taken out;
      the framed section's refusal, which named a header row; both
      end-to-end cases against the runtime writing the blank titles as a
      header row; and the trial's two cases with the refusal taken out of
      `undrawn.ts`, each failing with a `TypeError`.

    `pdfmake.test.ts`'s pin was not seen failing: it holds pdfmake
    0.3.11's behaviour, not this change's, and its last expectation shows
    the same comparison telling a header row of empty text apart.
  - **Not yet opened in Word.** The Word files of `titles-from-groups`
    and of `titles-from-groups-report` are read back by the corpus's
    reader and by no Word: that Word prints them with no row of nothing
    over the table, and what it draws at the top of a page the table
    continues on, is not known until a person opens them, as every Word
    writer change is opened before it merges.

## Context

A template may use one table for blocks of different kinds, each block
under a group header that names its columns. The table's own titles are
then empty. The person who decides wants such a
report to print as the reports it replaces do: the groups' titles, and
nothing above them.

`main` printed a band. A column's title is `TableColumn.header`, a string,
a literal of the report's own words and never a value; the runtime wrote
the resolved table's `header` as the shown columns' titles, blank ones and
all; the renderer drew that row at the top of the table and repeated it on
every page the table reached, a line of the table's size tall with its
padding -- 15.05 pt at 9 pt Roboto, as the corpus's check measured it --
with the one black rule of the table under it; and the Word writer wrote
the row, under its darker rule, and marked it the row Word repeats
(`w:tblHeader`). The format has no way to say "no header": a table's
`repeatHeader` is `true`, version 0's only value
([0007](0007-a-report-definition-is-its-own-versioned-document.md)).

What had to stay true: a report whose header prints prints as it did; a
group header is never left at a page's foot, nor kept with fewer of its
rows than the report states where they fit
([0059](0059-a-group-header-is-kept-on-its-page-with-as-many-of-its-groups-first-rows-as-the-report-states-or-as-fit.md));
and grouping, what prints and what a row is are decided once, in the
runtime ([0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).

## Decision

**A table every column of which that a render shows is titled with
nothing, or with white space alone, has no header row. The runtime writes
its resolved table with no `header` and no `headerStyle`; both engines
draw no header row for it, repeat none and print nothing where one would
stand. No member of the format changes.**

- **What prints nothing.** A title prints nothing when `trim` leaves
  nothing of it: the rule every engine reads a cell by -- the renderer's
  `printing` (`table-rules.ts`), the writer's `inked` (`blocks.ts`) --
  and report-spec's `blank-translation` reads a translation by. A title is
  a literal, so no field, parameter or expression can resolve to nothing
  in it; the question does not arise. A character that is no white space
  is a title, though it draw no ink: a zero-width space, where a face has
  one, keeps the header row. The rule reads characters, never ink.
- **The columns a render shows.** A column hidden by its condition prints
  its title nowhere ([0007](0007-a-report-definition-is-its-own-versioned-document.md)),
  so a render that hides the only titled column has no header, and one
  that shows it has. Only the runtime knows which columns show.
- **In every language, or in none.** A word of no letter is never
  translated (`not-a-word`) and a translation of white space is refused
  (`blank-translation`), so the same columns print nothing in every
  language a report declares
  ([0063](0063-a-reports-own-words-are-written-in-each-language-it-declares-and-a-render-names-the-one-it-prints-in.md)).
- **Decided once.** `lower-table.ts`'s `headerOf`. The engines draw what
  the document states and decide nothing again: a resolved document
  written otherwise, by hand, with a header row of blank cells, prints its
  band in either.
- **`repeatHeader`** stays `true`, the format's only value, and reads: the
  header row repeats on every page the table reaches, where it has one.
- **The header's style** goes with the header. A report's `headerStyle` on
  such a table prints nowhere, and nothing refuses it.
- **A group header's keeping** is 0059's, unchanged: a group header is
  kept with as many of its group's first rows as it states, or as fit on a
  page, which for such a table is the page under the table's top rule
  alone; the table's first group header moves to the next page with its
  first rows, as under a header.
- **A table with no rows** prints its empty text in its first row's place,
  right under the top rule, and its totals under it, kept with it.
- **In the PDF.** The renderer hands pdfmake such a table under a header
  row of no height -- each cell an empty stack, with no padding and no
  rule under it -- since pdfmake keeps a table's first rows on a page with
  its header alone (`keepWithHeaderRows` counts from `headerRows`) and
  repeats with it the table's top rule: so the first rows are kept, the
  top rule stands over the rows on every page the table continues on, the
  breaks are planned as every table's, and the first row stands where a
  header's would. The body pass lays the table out without that row, which
  takes no room; the plan reads it first, of no pitch (`UNSEEN_HEADER`).
  No rule is drawn black: the black rule is the one under a header. A line
  of a row is held to the page under the top rule alone, and a refusal
  says so.
- **In the Word file.** No header row, no row marked `w:tblHeader` and no
  darker rule; the table's first row is its first, kept as rows are, with
  nothing kept with it for a header's sake. What Word draws at the top of a
  page the table continues on is Word's, as its pages are
  ([0068](0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md)).
  Such a table in a framed section is refused, as every table there is,
  for what is not known of it: whether Word breaks a table inside a cell
  across pages, its rows kept together as the PDF keeps them. The refusal
  said that what was unknown was whether Word repeats the header row, which
  such a table does not have.
- **In the builders**, nothing new, and nothing shown: a column's Heading
  is a text field either builder writes as it is typed, and no test
  empties every one of a table's and looks at what prints.
- **In the corpus.** `check-tables.ts`'s `headerless` holds a table
  without a header row to its PDF: on every page it reaches, its first
  line stands under the rule above it as a row of the table that begins on
  that page stands under its own, and no second rule stands over that one,
  however far above it, with nothing between them, two rules nearer than a
  point being one table standing on another's foot. Its Word
  checks hold such a table to no row marked to repeat. Its fixture
  `titles-from-groups`, `HEADERLESS_FIXTURES`, is a table whose column
  titles come from its group headers, placed as `group-boundary`'s are for a page
  that holds a row more, kept apart from section 20's, which the renderer
  trial ran on, and whose adapters refuse a table without a header row.

## Consequences

**What it buys.**
- **A table whose group headers name its columns prints them alone**, under
  its top rule, on every page, in the PDF and in the Word file.
- **One decision, one place.** The runtime decides, from the columns a
  render shows and the titles in its language; the engines and any engine
  a host writes over the resolved document read `header`'s absence and
  never decide it again.
- **No format change.** No member, no `reportSpecVersion`, no command, no
  builder field and no scenario: every report valid before is valid, and
  one whose header prints anything resolves to the document it did.
- **Nothing else printed otherwise.** Of 267 documents -- the 57 corpus
  fixtures of every list the engines run, the 130 malformed documents
  (`MALFORMED`), a page of each of the 15 images of `IMAGE_KINDS` and
  `UNSEEN_JPEGS`, and the 24 starters and samples in each language each
  declares, final, preview and, of an e-invoice, its copy, 65 renders --
  534 outputs were made with `main`'s build at e4256ff4 and with this
  one: the 291 refusals (144 PDFs and 147 Word files) the same in code,
  subject and words, and the 243 PDFs and Word files the same, each PDF's
  objects with every stream inflated (`inflatedDigest`) and each Word file
  byte for byte; and the `e-invoice` gate's 46 PDFs and 16 XML files,
  drawn by the gate's own code, each the one its recorded run holds, so
  nothing was recorded again. None had a header that printed nothing: of
  every fixture's tables and the 35 tables the starters and samples print
  in their languages, only the malformed `table-no-columns`, which has no
  columns and is refused, as before. The only outputs added are
  `titles-from-groups`'s two.

**What it costs.**
- **A band of nothing can no longer be asked for.** A table that wanted
  an empty row over its rows on every page, a spacer of its own, gets
  none; a title of a no-break space is white space too. A spacer block
  above the table gives room once, on its first page.
- **A title that draws nothing is still a title.** The rule reads
  characters, so a zero-width space, where a face draws one, keeps the
  header row and its band.
- **A header style can print nowhere**, and nothing says so: a report may
  state one on a table whose titles are empty.
- **Nothing says a table names no column.** A table whose groups do not
  name its columns prints its rows under no title at all, and report-core
  diagnoses nothing: the titles are the author's to give.
- **The resolved document changed shape.** `Table.header` is optional: a
  host that reads the resolved document, or an engine of its own over it,
  must take a table without one, and code that reads `table.header` no
  longer type-checks until it handles `undefined`:
  the install gate's own host had to, its `languages.ts` reading every
  table's header, and type-checked against the packed packages only once
  it took a table without one. 0.2.0's renderer, handed this release's
  document of such a table, would fail with a `TypeError`, reading a
  header it does not find, rather than refusing it -- read in its source,
  `check-table.ts`'s `table.header.length`, and not run; a document of
  headers that print resolves as before.
- **An engine detail stands in the PDF.** A header row of no height is
  what pdfmake is handed: a pdfmake that gave an empty stack room, or a
  rule of no width a line, would print a band again, and
  `pdfmake.test.ts` fails first, as the corpus's check does.
- **The trial's adapters refuse such a table**: they were the trial's,
  run on the corpus as it stood (0005).
- **What the corpus's check rests on.** A rule is a path of no height, as
  pdfmake draws one; the first line is held to the rows' lines by how far
  each stands under its rule, alike only in one size, to `UNDER_RULE`,
  0.05 pt, where 496 rows of the renderer's stood alike to 0.000004; a
  page on which no other row of the table begins is held to the band
  alone; and a rule drawn over the table's top rule with nothing but
  white between them -- a rule block standing over it, or a page header
  that ends in one -- reads as a band. No fixture draws one.
- **The comparison is kept nowhere.** It was a script's, made once on the
  day the change was made, as 0059's was; what holds it afterwards is the
  suites and the gate above.

**What it forecloses.** Nothing that cannot be undone. A table that has
titles and prints no header, or a header of nothing on purpose, would be
a property of the format, and another record's.

## Alternatives considered

**A property of the table**, a header shown or not. It would say outright
what this infers. But it is a format change with a validator rule, a
command and a field in both builders, held by scenarios in three
languages, and two ways to say one thing, one of which contradicts itself:
titles that print under a table that says it has no header, which would
have to be refused or ignored. The person's words name the inferred rule:
a table whose header prints nothing shows no empty band.

**Each engine decides**, drawing no header row whose cells print nothing.
The rule would be written twice, in the renderer and in the writer, and
again by any engine a host writes over the resolved document; and an engine
sees cells, not which columns a render hid nor that a title is a literal.
The runtime knows both, once.

**Empty titles alone**, white space a title. White space prints nothing,
and an author who typed a space would get the band back; `trim` is the
rule every engine already reads a cell by.

**An empty `header` list** in place of an absent one. It breaks the rule
both engines refuse a table by, a cell of the header for each column, and
would make "no header" and "a header of no columns" one spelling.

**`headerRows: 0` in pdfmake**, the table handed over with no header row
at all. pdfmake keeps a table's first rows on a page with its header
alone: the first group header was left at a page's foot (seen above), and
a one-line table's totals could stand alone on the next. Keeping them by a
rule would break before a row pdfmake lays out inside the table's first
unbreakable block, where a break loses the rows after it. A header of no
height keeps the mechanism every table is broken by.

**A header row of empty text of no size.** pdfmake lays an empty text out
a line tall, the band; at a size of nothing it would hand the PDF a font of
size 0 to write nothing in. An empty stack holds no text at all.
