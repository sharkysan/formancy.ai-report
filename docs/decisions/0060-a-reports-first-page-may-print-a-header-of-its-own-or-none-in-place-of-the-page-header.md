# 0060 — A report's first page may print a header of its own, or none, in place of the page header, which then prints from the second page on

- **Status:** accepted; numbered while the numbers before it from 0053 were held by branches not yet merged; extends [0007](0007-a-report-definition-is-its-own-versioned-document.md), whose five regions gain an optional sixth, [0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md), whose resolved document carries page 1's header and heads it with every label the page header carries, [0011](0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md), whose page header is drawn on every page but the first where a report has a first page header of its own, and whose page regions' drawings, counted on every page, are joined by that header's, counted once, and [0012](0012-the-builders-are-native-and-share-one-session.md), whose scenarios edit it in both builders
- **Date:** 2026-11-15
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The format.** report-spec's `src/validate-first-page-header.test.ts`
    holds the region where it is written:
    - absent, empty and holding components, each read back as it was
      written, and each hashing differently from the other two;
    - not an array, refused as `wrong-type`, and a region the format does
      not know beside it, `lastPageHeader`, as `unknown-property`;
    - a table, a chart, a page break and a keep-together block refused
      in it as `misplaced-flow-component`, as in the page header, and a
      page number and a page count as `misplaced-page-counter`, with a
      message that sends them to the page footer;
    - its own `MAX_REGION_COMPONENTS`, and its components' ids unique
      across it and every other region.

    `src/validate-placement.test.ts`'s every-region cases reach it
    through `REGION_NAMES`, its page counters refused there by the
    expectation the case already derives; `src/walk.test.ts` finds its
    components between the report header's and the page header's, and
    none for a report without it.
  - **The editing core.** report-core's
    `src/commands/first-page-header.test.ts`: `putFirstPageHeader` adds
    the region and replaces one the report has, `removeFirstPageHeader`
    takes it away with its components and is refused as `not-found` where
    there is none, and each is one undo step; an insert into it, or a
    move there, is refused as `not-found` while the report prints its
    page header on page 1; `validLocations` offers its places only where
    the report has it, and never to a text that prints a page field;
    `fieldReaders` and `removeFieldWithReaders` reach a field only its
    components read. `src/commands/registry.test.ts` holds both
    commands' argument shapes, as it holds every command's.
  - **The runtime.** report-runtime's `src/lower.test.ts` resolves a
    report without the region to a document without `firstPageHeader`,
    deep-equal to the one it resolved before the region existed; one with
    it to the blocks its components lower to, a component its condition
    hides left out; and one whose every component is hidden to an empty
    list, never to the page header's blocks. `src/resolve.test.ts` heads
    page 1's header, its own or none, with the preview's label, the
    e-invoice preview's and an XRechnung's copy label, as it heads the
    page header.
  - **The PDF.** report-render-pdf's `src/first-page-header.test.ts`,
    on the PDF the engine produced, read back with PDF.js through the
    corpus's checks (0003):
    - page 1 prints its own header's lines and none of the page
      header's, and every later page the page header's and none of page
      1's;
    - page 1's first body line stands below the foot of its own header
      and the gap, within `OVERLAP`, for a header taller than the page
      header and one shorter; at the top margin for none; and page 2's
      below the page header, where it stood before;
    - a one-page report prints its own header and the page header on no
      page; a one-page report with a QR-bill draws its slip under it;
    - a keep-with-next heading first on page 1 stays there;
    - an SVG in it drawn on page 1 alone, as vectors in the clip of its
      box.

    `src/pdfmake.test.ts` holds the three behaviours of pdfmake 0.3.11
    the drawing rests on: page 1's background laid out in a box as tall
    as the page, whatever its top margin; an empty node with a negative
    top margin moving the next line up by that margin; a page whose
    header function returns nothing drawn without a header.
    `src/refusals.test.ts` refuses, as `content-too-large` naming
    `firstPageHeader`, a first page header that with the page footer
    leaves page 1 no body, and a page field in a document's first page
    header as `unsupported`; `src/xrechnung.test.ts` an XRechnung's
    document whose first page header does not open with the copy label.
  - **The corpus's checks.** report-corpus's `src/checks.test.ts` fails a
    PDF whose page 1 prints the page header where the document gives it
    one of its own, whose page 2 prints page 1's, and whose page 1 body
    starts above the foot of page 1's own header.
  - **Both builders.** report-builder-core's `scenario-first-page.ts`,
    in `BUILDER_SCENARIOS`, which the core runs against the model and
    React and Angular each run with axe over the end of every scenario,
    in three languages: page 1 given a header of its own from the
    report's properties, its group in the outline and its band in the
    design view before the page header's, a text put in it from the
    keyboard, undone and redone, and page 1 given the page header back,
    the group and the text gone, and undone. `src/properties.test.ts`
    holds the choice to the region; `src/outline.test.ts` and
    `src/geometry.test.ts` show the region only where the report has
    it.
  - **Nothing else moved.** Every suite passes as it did; the corpus's
    starters and samples render as they did; the e-invoice gate judges
    its recorded corpus, which digests the PDF the renderer draws of
    every sample and variant, without `--record`; and the browser gate,
    the install gate and the Studio's parity of both builders' trees
    over every starter pass. A report without a first page header of its
    own is the report it was, resolved and printed as before.
  - **Seen failing.** Not yet: each case above is run before its code,
    or with that code disabled in the working tree and restored, and
    recorded here with its date by the change that adds it.

## Context

A report prints its page header identically on every page. The format
has five regions (`REGION_NAMES`, in report-spec's `definition.ts`):
the report header, the page header, the body, the page footer and the
summary, each required. The runtime lowers the page header once, its
conditions evaluated once before there are pages
([0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md),
`lower.ts`), and the renderer measures it once, reserves its room above
the body on every page, and draws it on each, a page number and a page
count the only things that vary
([0011](0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
No expression reads the page number (`EXPRESSION_NAMES`), so nothing a
report says can choose what a page's header holds by page.

Many documents want their first page otherwise. A letter or an invoice
opens with a letterhead and continues under a short running line -- the
number, the addressee, the page -- or under nothing at all; an order's
first page carries the addresses where its later pages carry the
order's number alone. What a report can do today is put the letterhead
in its report header, as the quotation and the invoices put their mark
([0032](0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md)).
That prints once, but as the start of the body: under the page header,
which still prints above it on page 1, and with no page number or count
in it, which only the page regions have.

One choice already depends on the page: a QR-bill's slip is the last
page's footer, in place of the page footer, chosen in the function
pdfmake calls for each page's footer (`definition.ts` in the renderer).
A first page's header is the same kind of choice at the other end, and
belongs in the same place: the renderer, which alone knows the pages.

What pdfmake 0.3.11, the release the renderer pins, does with a page's
top, read from its published source on 2026-11-15:
- **A page's header is drawn in a box as tall as that page's top
  margin** (`LayoutBuilder.addHeadersAndFooters`), and what does not fit
  the box is lost without a word, as the renderer's measuring pass
  already says of a page header taller than its margin (`measure.ts`).
- **One top margin serves every page of a flow.** A page added because
  the flow ran on keeps the margins of the document's context
  (`DocumentContext.moveToNextPage` and `addPage`); a `section` starts a
  page of margins of its own only where the page before has content
  (`LayoutBuilder.processSection`). No definition gives page 1 one top
  and page 2 another within one flow.
- **A page's background is laid out in a box as large as the page**, from
  its top left (`LayoutBuilder.addBackground`), and the function that
  returns it is given the page's number and size, not the count of
  pages, which is not known when the page is added.
- **A top margin moves the cursor by its value**, which nothing clamps
  (`DocumentContext.moveDown`, from `processNode`'s margins).

And the rule the work keeps: a report that does not use what this adds
resolves and prints as it did, and a release that does not know it
refuses it whole
([0004](0004-three-version-lines-each-refused-when-unknown.md),
[formancy.ai 0022](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0022-fail-open-fail-closed.md)).

## Decision

**A report may hold a sixth region, `firstPageHeader`, which page 1 prints
in place of the page header; the page header then prints from page 2 on.
Absent, page 1 prints the page header, as every page does today. Present
and empty, page 1 prints no header and its body starts at the top margin.
Each page's body starts below the header that page prints, its measured
height and the gap, and the page footer is every page's, as before.**

**Its shape.**
- **A region, beside the one it replaces.** `REGION_NAMES` lists
  `firstPageHeader` between `reportHeader` and `pageHeader`, so the walk,
  the outline and the design view meet it beside the header it stands in
  for; `Regions` holds it optionally, and every other region as required
  as before. A component in it is named by the pointer every component is,
  `/regions/firstPageHeader/0`.
- **None is an empty region, and has no other spelling.** A header of its
  own with nothing in it prints nothing, so it is how a report says page
  1 has no header. A setting that said `none` beside an empty region
  would be a second spelling of one print, hashing differently, as a
  length written finer than the hundredth would (0007). Absent and empty
  are not the same: absent prints the page header on page 1.
- **The choice is the report's, not the data's.** A first page header
  whose every component its condition hides prints nothing that render,
  as a page header does; it never falls back to the page header.

**What stands in it.** What the page header holds, and its rules: it is
no flow region (`FLOW_REGIONS`), so a table, a chart, a page break and a
keep-together block are refused as `misplaced-flow-component`; an image,
a QR code, an EPC QR code, a section and columns stand in it; it has a
budget of `MAX_REGION_COMPONENTS` of its own. **But no page field:** a
page number or a page count in it is refused as `misplaced-page-counter`,
saying that page 1's number and count print in the page footer.
`PAGE_REGIONS` stays the page header and footer. The reason is the
renderer's, below: page 1's own header is drawn when page 1 is added,
before the pages are counted, and a number that is always 1 is text.

**How the renderer draws it.**
- **Page 1's header in page 1's background.** Because a header's box is
  its page's top margin and one margin serves every page, a first page
  header taller than the page header could not be drawn in pdfmake's
  header box without losing lines, nor given room there without taking
  it from every later page. So the renderer draws page 1's own header in
  the background pdfmake lays out when page 1 is added, in a box as large
  as the page, at the document's own margin, where the page header would
  stand; and in such a report the function that draws the page header
  draws nothing on page 1. The background is built anew each time
  pdfmake asks for it, as a page region is for each page, and once before
  the layout, so that its images are in the dictionary before pdfmake
  reads it.
- **Page 1's body moved by the difference.** pdfmake's top margin stays
  the page header's, which every later page needs. The difference
  between the room page 1's header takes and the room the page header
  takes is laid at the head of the body, before its first block, as an
  empty node with that top margin: down where page 1's header takes more,
  up where it takes less or there is none. A positive one is the slip's
  reservation already (0022); a negative one moves the cursor up by
  pdfmake's arithmetic, which `pdfmake.test.ts` holds.
- **Measured with the page regions.** Page 1's own header is measured in
  the regions' pass beside the page header and footer, on a sheet that
  holds all three, and its room is its height and `REGION_GAP`, or
  nothing where it lowers to no block. Each page is held to having a body:
  page 1 by its own header and the footer, every later page by the page
  header and the footer, each refused as `content-too-large` naming the
  header that leaves none.
- **What must fit a page fits the later pages.** A keep-together block, a
  block of fixed height, a line, and a table's line under its repeated
  header are held to the body of the pages after the first, where
  whatever does not fit page 1 goes; one that only page 1's taller body
  could hold is refused. A table continues on later pages as before, and
  where its first row stands on page 1 is read from the layout, as it is
  now. Every rule that asks whether a node is first on its page reads page
  1's top on page 1. The least height a body may have is held to page 1's
  body and the later pages' bodies the page limit leaves.
- **A one-page report** prints its own header, or none, and the page
  header on no page. The page header is still measured and held, since
  how many pages there are is known only once they are laid out.
- **A QR-bill's slip** is held by the renderer's `refusePage`, report-spec's
  rule for what stands above the slip, to the taller of the two headers,
  since it prints on the last page, which on a one-page report is page 1.
- **Labels head it too.** Every label the runtime heads the page header
  with -- a preview's, an e-invoice preview's, an XRechnung's copy label
  (0038) -- it heads page 1's own header with, so that every page still
  says it: page 1's header that is none is the label alone. The renderer
  refuses an XRechnung's document whose first page header, where it has
  one, does not open with the copy label, as it refuses one whose page
  header does not.
- **Its drawings are counted once.** An SVG in page 1's own header is
  drawn on page 1 alone, so it counts once toward `MAX_SVG_DRAWING`, as a
  body's does, where the page regions' count on every page the limit
  allows (0030); toward one page's paint it is counted beside the
  regions'.
- **Refused if malformed.** A page field in a document's first page
  header is refused as `unsupported`, as one in the body is: pdfmake
  knows the count only in a header or footer it draws after the layout.

**The resolved document.** `firstPageHeader`, optional, is page 1's
header: present exactly when the definition's is, the blocks its
components lower to, an empty list for none. A document without it is
the document the runtime resolved before.

**The editing core.**
- **Two commands.** `putFirstPageHeader(components)` gives page 1 a header
  of its own, added where it has none and in place of the one it has
  otherwise, as `putPaymentPart` is; `removeFirstPageHeader()` gives page
  1 the page header back, its components with it, refused as `not-found`
  where there is none. Both may stand in a batch. Every component command
  works in the region once it is there; a location in it while it is not
  is refused as `not-found`.
- **The walk reaches it.** report-spec's walk visits it where present,
  so `fieldReaders`, `removeFieldWithReaders`, the readers' diagnostics, a
  form review (0048), the compiler and `locations` find its components
  with no table of their own; where a component may go there is the
  validator's to say, as everywhere (0008).
- **No diagnostic of its own.** An empty first page header is how none is
  written, not a mistake to warn of.

**The builders.**
- **The report's properties choose.** With nothing selected, after the
  page's margins, a choice says what page 1 prints at its top: the page
  header, or a header of its own. Choosing its own puts an empty one, one
  undo step; choosing the page header removes it with what it holds, one
  undo step. Its words, in each of the editor's languages, say that a
  header of its own with nothing in it prints none.
- **Shown only where it is.** The outline's group, the design view's band
  and every list the editor's state makes of the regions hold the first
  page header only where the report has one, before the page header's;
  so a report without one shows exactly what it did. Its band is drawn,
  empty, at the height an empty region is, to be seen and dropped into.
- **Edited as any region.** The palette, the place chooser and a drag put
  a component in it through report-core, which refuses what the
  validator refuses there; Delete, undo and redo are the session's.
- **`BUILDER_SCENARIOS` holds both builders to it**, and both draw it from
  the model, so neither framework has code of its own for it beyond what
  a scenario's steps already need.

**Not decided here.**
- **A first page's own footer.** The roadmap names the header. A footer
  of page 1's own would change where page 1's flow ends, not where it
  begins: pdfmake's bottom margin, like its top, is one for every page of
  a flow, and a node can end page 1 early only by breaking the flow where
  it stands, which is not known before the layout; every break the
  renderer plans assumes one foot for every page (`breaks.ts`'s
  `Geometry`); and
  the slip already takes the last page's footer, which on a one-page
  report is page 1's. It would be a record of its own.
- **Positioned elements** in the page header and footer, which 0007 still
  defers. The first page header flows as the page header does.
- **A background drawn under page 1**, which the roadmap plans apart: it
  will share page 1's background with this region, the renderer composing
  the two in one node.

**A draft-format addition.** `reportSpecVersion` is unchanged, and so is
every report that was valid. A release that predates the region, 0.2.0
among them, refuses a report that holds one as `unknown-property` at
`/regions/firstPageHeader`, since it reads the regions through `shape`
over the five it knows.

## Consequences

**What it buys.**
- **A letterhead that stands in the page header's place.** Page 1 can
  print its own header with no running header above it, or no header at
  all, and every later page keeps the running one, each page's body
  starting below the header it prints.
- **One choice, in one place.** Which header a page prints is decided by
  the renderer, which alone knows the pages, as the slip's page is;
  nothing evaluates a condition per page, and the runtime still resolves
  every value once.
- **Nothing new to learn for what stands in it.** Its rules are the page
  header's but for page fields, held by the validator every layer asks.
- **Every report that was is the same report.** A report without the
  region validates, hashes, resolves and prints as it did, and every
  builder shows it as it did.

**What it costs.**
- **No page number or count on page 1's own header.** "Page 1 of 3" on
  page 1 prints in the page footer, which prints on every page. A first
  page header copied from a page header that numbers its pages is
  refused until the number is taken out.
- **None is spelt as an empty header of its own.** A person who chooses a
  header of its own and adds nothing gets no header on page 1, which the
  choice's words say and the empty band shows; the format has no
  separate word for it.
- **Removing it removes what it holds.** Choosing the page header again
  takes the first page header's components with it, in one undo step.
- **What only page 1 could hold is refused.** Where page 1's header takes
  less room than the page header, page 1's body is taller than the
  others, and a block that fits it but not a later page's body is refused,
  even in a report that would end on page 1.
- **A page header no page prints is still held.** The page header of a
  one-page report with a first page header of its own is measured, held
  to leaving a body and held above the slip, though no page prints it.
- **It rests on pdfmake's background and its arithmetic.** Page 1's own
  header is page content drawn first, under the body, through the hook
  the renderer already uses to count pages; the page's body is moved by a
  margin pdfmake does not clamp. `pdfmake.test.ts` holds both on the
  exact release pinned; a pdfmake that changes either fails there before
  a report prints otherwise. A background drawn under page 1 will have to
  share the hook.
- **No e-invoice variant draws one.** veraPDF and Mustang have not judged
  a PDF/A-3b whose page 1 has its own header; what it adds to the page is
  content of the kinds they judge elsewhere.
- **An older renderer ignores it.** report-render-pdf 0.2.0, handed a
  document a later runtime resolved, prints the page header on page 1:
  it reads no property it does not know and refuses none. The packages
  are released together, and the renderer depends on the runtime at its
  exact version; nothing refuses the mix.
- **0.2.0 refuses a report with one.** It refuses the whole report as
  `unknown-property`: a report saved with a first page header of its own
  opens only in a release that has the region.
- **An integrator iterating the regions meets one that may be missing.**
  `REGION_NAMES` lists six names and a report may hold five of them, so
  `report.regions[name]` over the list is `undefined` for a report
  without a first page header, which TypeScript says where it is read.
- **The report's properties gain a choice.** Every report's pane shows it,
  so the README's pictures that show that pane are retaken with
  `node scripts/pictures.mjs`, as any change to what a picture shows is.
- **No starter uses it.** The quotation and the invoices keep their mark
  in the report header (0032), and their PDFs are unchanged.

**What it forecloses.** Nothing that cannot be undone: the format is a
draft's. A first page's own footer, a last page's header, headers for
odd and even pages, and a page field in page 1's own header would each be
another record's.

## Alternatives considered

**A setting beside the region: running, own or none.** It would name
none in a word. But an own header with nothing in it and none print the
same page, and would hash as two reports; and a setting of the page
header beside a region that holds components leaves components that
print nowhere, which the validator would have to refuse and a builder
switching the setting would produce. If the setting and the region ever
disagreed, the PDF would say which won, and nobody else. One region whose
presence is the choice cannot disagree with itself.

**A flag on each component of the page header: first page, later pages
or every page.** One region would print differently by page, its room
then a question of which of its components each page draws; the design
view could not show page 1's header and page 2's as the bands they are;
and every component kind would gain a property that means something in
one region.

**The page number in expressions, so that a condition reads `page ==
1`.** The runtime resolves every condition once, before there are pages
(0010), and the renderer formats and decides nothing. A condition that
read the page would move evaluation into the renderer, for every
component of every page region, to make one choice the renderer can make
by itself.

**Page 1's own header drawn in pdfmake's page header.** Its box is the
page's top margin, which is one for every page of a flow: a first page
header taller than the page header would lose lines in it, and a top
margin as tall as the taller header would take that room from every later
page's body, which is the room this record exists to give back.

**The page count on page 1 from a second layout.** The renderer could lay
the document out once to count its pages and again to draw page 1's
header with the count. That is a whole layout more for every report that
asks, to print a number the page footer prints already.

**A report header without the page header above it.** A flag on the
report header that suppressed page 1's page header would leave the
letterhead in the body's flow, measured with the body and breaking with
it, and give page 1 a header no page region's rule describes; the first
page header is a page region, measured and drawn as one.

**A first page's own footer beside it.** The same need meets page 1's
foot, but a different engine problem: where page 1's flow ends, which
every break the renderer plans and the slip's place depend on. Deciding
it here would have tied a header pdfmake can draw to a footer it cannot
yet, so it waits for a record of its own.

**Headers by page selector: first, last, odd, even.** A general list of
headers each for a set of pages would hold this case and others nobody
asked for, each needing its own rule for the room it takes and the slip
beside it. The first page is the case documents have; a selector can
replace this region if another case arrives, the format being a draft.
