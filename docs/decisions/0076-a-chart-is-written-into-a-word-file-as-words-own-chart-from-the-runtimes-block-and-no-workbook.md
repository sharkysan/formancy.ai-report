# 0076 — A chart is written into a Word file as Word's own chart, from the runtime's block alone, its data in the part itself and no workbook; one with nothing to draw as its words in its box

- **Status:** accepted; numbered while 0069 was held for a workbook's export, 0070 to 0073 by a branch not yet merged, 0075 for a QR-bill's slip in a Word file, which was not begun, and while [0074](0074-a-qr-code-and-an-epc-qr-code-are-written-into-a-word-file-and-what-refuses-a-code-stands-below-both-engines.md), whose writer it builds on, was not yet merged; extends [0068](0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md), whose writer refused a chart as what ECharts lays out for the PDF renderer alone: it writes one, with no ECharts, and a payment part and an e-invoice are refused as they were; [0058](0058-the-renderer-lays-a-chart-out-with-apache-echarts-and-prints-its-marks-and-its-words-where-echarts-placed-them.md), whose layout and whose refusals of what does not fit a chart's box are the PDF's still, and not a Word file's; [0055](0055-the-runtime-resolves-a-chart-exactly-its-totals-as-every-total-and-every-word-it-prints.md), whose block is all the writer reads; and [0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md), as 0068 extends it: a chart in a Word file is proved on the part the file holds, read back by a reader that is not its writer
- **Date:** 2026-11-19
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The corpus's reader.** report-corpus's
    `src/check-docx-charts.test.ts` proves `readDocx` on a file written by
    hand (`src/docx/testing/hand-charts.ts`), a bar, a line and a pie
    chart and one with nothing to draw, each part typed out there and
    none made by the writer: each chart in the document's order and none
    for the one that draws nothing; each value as the digits the part
    writes and a point it states none for as none; every word with what
    it is set in; the value axis's ends, step and format, where the
    category axis stands, the bars' gaps; a pie's slices, colours and
    names. And on that file with one thing written otherwise, a case
    each, refused: a relationship from the chart to an address, a
    workbook inside the file, `c:externalData`, a formula's cache
    (`c:numRef`), another content type, a chart's relationship in a page
    header, a drawing that says picture and holds a chart, rounded
    corners, a smoothed line, a bar below zero in another paint, a title
    of Word's own, a missing value drawn as zero, slices painted alike, a
    first slice elsewhere than at the top, bars that lie, stacked bars, a
    line without markers, markers of another colour than their line, a
    title over the plot, a word turned, a background left to Word, a
    line around the chart, a value that is no decimal, a point past its
    count, a format on the values, an axis's format taken from a
    workbook, an axis taken away, tick marks, category labels beside the
    axis, points on the gridlines, a line on the value axis, a series
    that labels its values itself, a label that is a share Word works
    out, words that name three families, other axes than the chart's
    two, and a cell whose words stand at its foot; and bars with a line
    around them, a colour that is no six hex digits, more categories
    than values, a count that is no number, a slice painted twice and
    one left to Word, a chart without its value axis, a title of no
    text, a word that states no size or its weight in a word, a line
    with a fill and one not drawn, a series numbered otherwise than by
    its place or holding no values, a category axis with a range or at
    the top, an outline both drawn and not, and a choice stated without
    its value; and, after this record's review, a plot that holds a line
    chart beside its bars, a pie of two series and one with an axis, a
    label out of its order and one past its count, a filled category
    axis, bars and a plot that leave their outline to Word, a category
    left for Word to name, a part two drawings draw, a legend that
    states nothing of what it is set in, and each thing the vocabulary
    lets stand empty or unsaid -- an axis's line, the gridlines, a
    format, a line's weight, a point's index and its value, a series'
    name, a title's text, a word's colour. A pie without a legend is read
    with its slices unnamed. Measured on 19 November 2026, every branch
    of the reader's four modules, `docx/chart.ts`, `chart-parts.ts`,
    `chart-series.ts` and `chart-axes.ts`, is reached by a case. The
    record said before that twelve in a hundred were not and that each
    was the refusal of an element the vocabulary lets stand empty, which
    was wrong: a plot of two kinds, a pie of two series, a label out of
    its order and a filled axis were among them, each a form the
    vocabulary admits.
  - **The corpus's check.** The same suite holds `verifyDocx` to passing
    that file, and to failing on it with one thing of a chart taken out
    or written otherwise, a case each: another size, room around it,
    another kind, another title, a title the chart has not, no title, a
    title not bold, a value in other digits (10.250 for 10.25), a value
    where the chart has none, another category, another series' name,
    another colour, another label, labels where the chart labels none, a
    value left unlabelled, an axis that starts elsewhere than at its
    lowest tick, one that ends at a number written otherwise (1.50 for
    1.5), gridlines at another step, a format of fewer places than the
    ticks need, every other category labelled, a bar chart's category
    axis at the axis's foot, another category title, another value
    title, no legend, a legend the chart has not, a legend at the side,
    another slice's value, colour and name, words of another size and
    another colour than the style says, upright where it slants them, a
    pie that names slices where the chart has no legend; and of a chart
    with nothing to draw, a box of an exact height, of another width,
    filled, its words at its top, another empty text, a title the chart
    has not, a title not centred and not bold, a chart of Word's in its
    place, and words where it prints none. A group of lines kept on one
    page with a chart is held by the heading's mark, and still fails
    where a line of it is nowhere in the file.
    A chart that shares its paragraph, one with a series fewer than the
    document's, a box that may split across two pages, and a category
    or a series' name that prints nothing and is not stated as nothing
    fail too; and a kept group whose chart's title a paragraph above
    also says is found at the chart. Of the check's own branches, nine
    in a hundred are reached by no case, measured the same day: those
    no file the reader takes can reach -- a pie of other than one
    series, a chart without its axes, a value that is no decimal --
    with a box that is no table of one cell, and what a run's or a
    paragraph's properties are read as where the file states none.
    `src/check-docx.test.ts` holds `wordRefusal` to deriving no refusal
    for a chart, in a framed section too.
  - **The writer, on the file it wrote.** report-render-docx's
    `src/charts.test.ts` reads each chart back with the corpus's
    `docxCharts`: a part of its own that the body draws inline in
    exactly its box; no workbook in the file, no relationships part
    beside a chart, and no `c:externalData`, formula or reference in its
    XML; each chart numbered as the body meets it, through columns, and
    a block drawn twice a part each time; the
    same document the same bytes; a value of forty-two digits and one
    written `0.10` as those digits; the value axis from its lowest tick
    to its highest in their step for whole numbers, quarters, tenths,
    ticks written with zeros they do not need and ticks below zero
    alone; no point for a value the chart has none for; the bars' gaps
    for one, two and eight series; a line's weight, its markers, the
    gridlines and the category axis's line; where each kind's category
    axis stands; each value's label as the runtime's own text, above a
    bar's end and above a line's point; every word at 8 pt in the sans
    face where the style says nothing, and as the style says, in the
    family its token maps; each word trimmed and none for one that
    prints nothing; a pie's slices named by its legend's entries; a
    legend where the chart has one and no title of Word's where it has
    none; a chart kept with the heading over it and with the lines of
    its block; one in a framed section. A chart with nothing to draw as
    its box and its words, never of an exact height, and its box where
    it prints neither word. The writer's own refusals: a chart in a page
    region, one taller than the printable area, a tick's label no report
    prints, and a sentence that quotes none of the chart's words. And
    its bounds, at each and one past it: 64 charts, 25,600 points, a
    slice and a missing value each a point, both counted before a
    chart's words and numbers are read; a chart's words counted with the
    file's characters, a category once for each series, and its numbers'
    digits; a number of 331 characters refused before it is read as one;
    a chart a paragraph, and one with nothing to draw its cell and its
    lines. `src/corpus.test.ts` writes every chart fixture and holds it
    by `verifyDocx`, names the four the PDF refuses for what ECharts
    laid out as written, and the one in a script no report prints as
    refused; `src/starters.test.ts` names the sales report as written, a
    final render and a preview; `src/refusals.test.ts` holds a chart of a
    kind no report knows to being refused where the walk meets it.
  - **Against the PDF.** `src/against-pdf.test.ts`: for every chart
    fixture the PDF draws and for the sales report, every word a chart's
    part states is a word the PDF draws, at that size in a face of that
    weight and slant, and every word the PDF draws of a chart is one the
    part states or a tick's text; each engine's file is the chart the
    one derived expectation says; the Word file's axis runs from the
    block's lowest tick to its highest with as many gridlines as the
    block has ticks, and the lowest tick's text is on the PDF's page;
    the four fixtures the PDF refuses for its layout are refused by it
    and written by the writer; a word in a script no report prints, and
    a chart taller than a page, are refused by both by the same code and
    the chart's id; each engine holds a document's charts to a bound of
    its own, three of the largest line chart past the PDF's and within
    the writer's, sixty-five small ones the other way round. And every
    chart of the corpus's `MALFORMED` list
    (`fixtures/malformed-charts.ts`) is refused by both engines by the
    same code and subject.
  - **The Studio.** `src/preview/pipeline.test.ts` names the sales
    report's Word file as written, a preview and a final render, and
    holds it by `verifyDocx`; `src/journey.test.tsx` holds its Download
    Word to the pipeline's bytes; and the browser gate's
    `scripts/gate-word.mjs` holds the file a person downloads of it in
    Chromium, in each builder, to the document the gate resolves under
    Node and, byte for byte, to the file the writer writes of it there.
  - **The packed packages.** The install gate's
    `scripts/install-fixture/docx.ts` writes the guide's quotation with
    its chart from the packed writer: one chart part and nothing beside
    it, its content type, the reference in the body, a bar chart, the
    three amounts digit for digit, the axis to its highest tick, and no
    workbook, formula or external data. No reader of a chart's part is in
    that host, so the part is held there by its text.
  - **Seen failing, on 19 November 2026.** Before any of it: with the
    writer as 0074 left it, 58 cases of `charts.test.ts`,
    `corpus.test.ts` and `starters.test.ts` failed, each on "the chart
    … is laid out by the PDF renderer alone", and three of the
    thirty-nine malformed charts there then were, the ones refused as
    `content-too-large`, which that writer refused as `unsupported`; the
    corpus's `check-docx.test.ts` failed twice, on a chart that
    `wordRefusal` no longer refuses; and the writer's `corpus.test.ts`
    on the fixture of charts at a page's foot, whose kept group names a
    chart's title, until such a group was held by the block walk. Then,
    each with the thing it guards taken out of the source, the suites
    that hold it run, and it put back, one at a time, 132 of them. Of
    the corpus's check, each failing a case of
    `check-docx-charts.test.ts`: a chart of any extent, with room around
    it, of any kind, title, values, categories, series' name, colour and
    labels, an axis of any ends, step and format, categories skipped,
    the category axis anywhere, a legend where there is none and
    anywhere, a pie of any slices, names and colours, a word and the
    defaults in any face; a box of an exact height, of any width,
    filled, its words at its top, not centred, in any face, of any
    text, and of any number of paragraphs; and a group kept with a
    chart sought among the paragraphs. Of its reader: a part that leads
    on, of any content type, `c:externalData` and a reference let into
    the vocabulary, and each thing a report's chart states left
    unheld -- rounded corners, `c:invertIfNegative`, `c:smooth`,
    `c:autoTitleDeleted`, `c:dispBlanksAs`, a pie's `c:varyColors` and
    its first slice, `c:barDir`, the grouping, a line chart's markers
    and their colour, a title's overlay, a word's direction, the
    chart's fill and its line, a value that is no decimal, a point past
    its count, a format on the values, `sourceLinked`, `c:delete`, the
    tick marks, where the category labels stand, `c:crossBetween`, the
    value axis's line, a series' own `showVal`, a label's
    `showPercent`, three typefaces, the axes' ids -- with a drawing
    that says otherwise than it holds, a cell's words at its foot and a
    chart's relationship in a header. Of the writer's part, each
    failing a case of `charts.test.ts`, `corpus.test.ts` or
    `against-pdf.test.ts`: a value and the step written through a
    double, each of `c:autoTitleDeleted`, `c:invertIfNegative`,
    `c:smooth`, `c:majorUnit`, `c:tickLblSkip` and the axis's ends left
    out, a missing value as zero, a label of Word's own, a title
    untrimmed, a bar chart's axis at the foot, a pie's slices unnamed,
    another gap, rounded corners, a format of no places and one linked
    to a source, the background left to Word, words that may turn, the
    legend at the side, slices painted alike, an extent of another
    size, every chart one part, a part of no content type, and a
    heading not kept with a chart; of a chart with nothing to draw, an
    exact box, a title not bold, words at the top and untrimmed; and
    another default size. Of what it refuses and counts: a chart in a
    region, of any kind, size, style, colour and width, each of the
    runtime's four bounds, each of the five ways its parts do not
    match, a word that is no text, a control character, words
    unchecked, each of the seven checks of its numbers, a number of any
    length, a chart of any height, the count with `>` and the points
    with `>=`, charts and points uncounted, a category counted once, a
    number's digits uncounted, and a chart counted as no paragraph. One
    survived at first: with a chart's colours unchecked no case failed,
    since both malformed charts with a colour that is none were refused
    for a legend in another colour than what it names; they were
    written again, one with no legend and one with a legend in the same
    colour, and the colours' check then failed a case. And the
    architecture's guard, `scripts/architecture.test.mjs`, failed on a
    chart part's name written as code in the building blocks, which is
    no path of the checkout, until it was said in words. Last, three
    things the writer's coverage showed no case reached: a pie whose
    legend names one slice of two, which became a malformed chart; a
    block the body draws twice, which was one part for both drawings,
    and whose case failed on that until each drawing was a part of its
    own; and `decimal`'s own refusal of what is no decimal, whose case
    failed with the refusal taken out. And a case of the bounds, which
    writes four million characters four times, timed out at vitest's
    five seconds under coverage beside another job, 6.1 seconds where it
    takes 1.0 alone, until the bounds' cases were given a minute.
  - **Validated against the schema, once, by hand, on 19 November
    2026**, and by no gate, as 0068 validated its files: against
    ISO/IEC 29500-4:2016's transitional schemas, as Ecma publishes them
    with ECMA-376's fifth edition, Part 4, with libxml2 2.13.9. Every
    chart part the writer writes of the files named under *Not yet
    opened in Word* -- every chart fixture it writes, the sales report
    as a final render and as a preview, and a chart of words that print
    nothing -- 22 parts, and the three parts of the file written by
    hand, against `dml-chart.xsd` and what it imports: none invalid.
    And the `document.xml` of each of those files, 18, against `wml.xsd`
    and `dml-chart.xsd` together, so that the reference to a chart in a
    drawing is judged, with the cell whose words stand in its middle and
    the row that is at least so tall and does not split: none invalid.
    The schema found nothing to fix. As controls, a part with
    `c:overlap` before `c:gapWidth`, an element the schema does not
    know, a point without its value, `c:crosses` and `c:dLblPos` of a
    value the schema does not list, and a gap past 500 were each
    refused, as were a chart's reference holding an element and a
    cell aligned `middle`; a point whose value is empty, which is how a
    word that prints nothing is stated, was accepted; and so was a chart
    with no `c:autoTitleDeleted`, which the schema lets be left out and
    the reader does not. The schemas are another body's files and are
    not in the repository; no gate runs this.
  - **Seen failing in the review's fixes, on 19 November 2026.** With
    the hand-written file's plot given its outline stated as none, the
    reader refused every chart, "the plot has a line around it", until
    it asked for that line; and with the reader asking, 40 cases of the
    writer's `charts.test.ts` and `corpus.test.ts` failed on "the plot
    states no line", until the writer wrote it. With the writer as it
    was, the cases of a category and a series' name that print nothing,
    of a pie's blank legend entry, and of the box's row that does not
    split failed; in the corpus, with the check and the reader as they
    were, those of a category left for Word to name, a part two
    drawings draw, a word stated as nothing, a box that may split, a
    kept group held by its heading's mark, and a group whose chart's
    title a paragraph above also says.
  - **Not yet opened in Word.** The files this change writes -- every
    chart fixture's and the sales report's, each beside its PDF, with a
    list of what each chart should show -- were written for the person
    who decides to open in Word before this change merges, as 0068 asks
    of a change to what the writer writes. When this record was written
    nobody had opened one. That Word draws a chart whose data are
    literals and which has no workbook; that it draws it in its box,
    with the bars, the line and the slices where the numbers put them;
    where it puts each word, whether two meet, and whether it wraps or
    hides a category's label that does not fit; that a bar below zero
    hangs from zero with its label under its end; what it writes on the
    value axis, in which separators; what "Edit Data" says; and that the
    words of a chart with nothing to draw stand in the middle of its
    box: all of it is held by no test and was seen by nobody.

## Context

0068 wrote a report as a Word file and refused, whole, what belongs to
its PDF. Of a chart it said: "A chart is laid out by ECharts, which no
package but the PDF renderer may depend on (0058), and a second layout in
the writer would be a second chart." It was then asked that a Word file
hold all five of what was refused -- a QR-bill, an EPC QR code, an
e-invoice, a chart and a QR code -- before any other feature, and, asked
how a chart should stand in one, the person who decides chose Word's own
chart: a chart Word draws, not a picture of the PDF's. 0074 wrote the two
codes. This is the chart. The slip (0075) and the e-invoice (0077) are
their own decisions, and nothing of them is built here.

The forces:
- **The block holds everything.** The runtime resolves a chart into every
  word it prints and each value's exact digits beside its text, its
  ticks, its colours (0055). Nothing a chart says is decided in the PDF
  renderer; what is decided there is where things stand.
- **A layout is the engine's.** ECharts lays the PDF's chart out and
  pdfmake prints it (0058). Word lays its own chart out. A writer cannot
  ask Word where it will put a word, and the writer measures nothing
  (0068).
- **Word's chart wants a workbook.** The chart Word makes keeps its data
  in a workbook embedded in the file, and its part's values are a cache
  of cells that part names by formula. `SECURITY.md` names "an embedded
  object" and "an external relationship" in a written file as in scope.
- **Word formats numbers itself.** A chart's value axis, and a value's
  label left to Word, print the number in the reader's own separators,
  by a format code; a pie's percentage is Word's own rounding. The
  runtime formatted every one of them once, in the render's locale
  (0010, 0055).
- **Exact values never pass through a double** in this repository
  (formancy.ai-data 0008). Word reads a chart's numbers as doubles all
  the same: that is the reader's engine, not the file.
- **DrawingML decides much by what is not said.** A chart without
  `c:autoTitleDeleted` is titled by its one series' name; a line without
  `c:smooth` set off may be smoothed; a bar below zero may be painted in
  another colour; a missing value may be drawn as zero; category labels
  may be skipped or turned.
- **What no engine prints of a chart's block** -- a kind no report knows,
  ticks that are no axis, a legend that names a series in another's
  colour -- is stated in the PDF renderer's `check-chart.ts`, and no
  package below both engines holds it, as none holds any other block's
  contract (0068).
- **Nobody opens Word here.** No runner has Word, and 0068 asks that a
  person open what the writer newly writes before it reaches the public.

## Decision

**`@formancy/report-render-docx` writes a chart with something to draw as
Word's own chart: a part of the file, `word/charts/chartN.xml`,
DrawingML's `c:chartSpace`, which the body draws inline in exactly the
chart's box. The part is stated from the runtime's block alone, with no
ECharts and no new dependency. Its data are literals in the part itself:
the file holds no workbook, and a chart's part has no relationship. A
chart with nothing to draw is its title and its empty text in its box,
and no chart of Word's.**

**Data without a workbook.** Each series' categories are `c:strLit` and
its values `c:numLit`, DrawingML's literal data, which name no cell. The
part holds no `c:externalData`, no `c:strRef` or `c:numRef` and so no
formula, and has no relationships part: nothing in the file is an
embedded object, and nothing leads to an address. The form a chart of
Word's own making takes without its workbook is the cached values of
references (`c:strCache`, `c:numCache`); a cache stands inside a
reference, and a reference must state a formula (`c:f`) that names cells
of a workbook the file would not hold. Literals say what is true of the
file: its numbers are here, and come from nowhere.

**What the block is written as:**

| The block | The part |
|---|---|
| `title` | `c:title`, the chart's own words, bold, never over the plot; where the chart has none, `c:autoTitleDeleted`, so that Word titles nothing itself. |
| `categories` | Each series' `c:cat`, a literal for each label that prints. |
| `series[].values[].exact` | Each series' `c:val`, the digits as the block holds them; a value the block has none for is a point the part does not state, and `c:dispBlanksAs` is `gap`. |
| `series[].values[].text`, where `valueLabels` | A `c:dLbl` of the point's own, whose rich text is the runtime's text: above a bar's end (`outEnd`), above a line's point (`t`). Of itself a series labels nothing. |
| `series[].color` | A bar's fill, with no line around it and `c:invertIfNegative` off; a line's stroke, 1.5 pt, never smoothed, and its circular markers' fill. |
| `legend` | Each series' name (`c:tx`) and a `c:legend` at the foot; none where the block has none. |
| `ticks` | The value axis's `c:min` and `c:max`, the lowest and the highest tick's digits, and `c:majorUnit`, their step, with a gridline at each; `c:numFmt`, digits at as many places as the tick that needs the most. |
| `categoryTitle`, `valueTitle` | Each axis's `c:title`, held across. |
| A pie's `slices` | One series, each slice a `c:dPt` in its colour, from the top, clockwise, as the PDF draws it; its values the slices' digits. |
| A pie's `legend` | Its categories, each entry the runtime's own words -- its label and, where it labels its values, its value and its share. No label stands on a slice. |
| `style` | Every word's size, weight, slant and colour, in the family its font token maps, stated on every word and on every default; 8 pt where it states no size, as the PDF prints a chart's words. |
| `width`, `height` | The inline drawing's extent, exactly. |

**Numbers.** A value is written as the block's `exact`, digit for digit,
and never read as a JavaScript number: `1234567890123456789012345678901234567890.25`
is those digits in the file. The axis's step is the second tick less the
first, worked out in BigInt on their digits. The axis's ends and its step
are all said, so nothing of the axis is Word's automatic scaling.

**Words.** Every word the block gives is one the part states, but the
value axis's labels. A value's label is a point's own text and not a
number Word formats; a pie's shares stand in its legend's entries, which
the runtime wrote, and Word's `showPercent` is off. Each word is trimmed
of the whitespace at its ends, as the PDF prints them. A title, an
axis's title and a value's label that print nothing are not written. A
category's label and a series' name that print nothing name a slot that
stays -- the category's place on the axis, the series' swatch in the
legend, a pie's slice's -- and are stated all the same, as nothing: a
category the part leaves out is one Word numbers itself, and a series it
does not name is one Word calls "Series2". A category of nothing is no
oddity of a document made by hand: a text key of spaces, or a preview's
missing field with no label for it, resolves to one.

**The value axis's labels are Word's.** DrawingML has no place for a
tick's own text: Word writes each label from the number, by the axis's
format code. The part states that code as digits alone, at as many places
as the tick that needs the most -- `0`, `0.0`, `0.00` -- with no
grouping, no currency and no unit, none of which the block states apart
from the text it printed them in. So where the PDF's axis says
`CHF 1'000.00`, Word's says `1000`, in the reader's own decimal
separator. The currency or the unit stands in the axis's title where the
report gives it one, and in every value's label where the chart labels
them.

**Look.** What DrawingML lets a file pin is pinned: every colour the
block's; every word's face; no fill and no line around the chart or its
plot; the gridlines and the category axis's line in the PDF renderer's
colours and weights; bars side by side with the PDF's two gaps, in whole
hundredths of a bar's width, which is Word's unit for them; no tick
marks; the category labels at the plot's foot, every one, held across;
the legend at the foot; no rounded corners. A bar stands on where the
category axis crosses the value axis, so a bar chart's crosses at zero,
and a line chart's at the axis's lowest value, the plot's foot, where
the PDF draws it. The rest is Word's layout, as lines and pages are
(0068): where each word stands, how wide the plot is, whether a
category's label wraps, and what it does with labels that meet.

**A chart with nothing to draw** -- no rows, no value, a pie of nothing
-- is written as a table of one cell, as wide as the chart's box and at
least as tall, with no line, no fill and no padding, holding the chart's
title, bold, and its empty text, each a centred paragraph, in the middle
of the cell (`w:vAlign`). At least as tall and never exactly: a row of an
exact height cuts what does not fit it. And the row does not split
(`w:cantSplit`), since the PDF reserves the box whole, on one page. It is
no part of the file and no chart of Word's.

**What refuses a chart.** The writer decides nothing of a chart, so what
it refuses is what any engine refuses of the block, stated again in its
`chart-check.ts` by the PDF renderer's codes and with the chart's id as
the subject -- where it stands, its kind, its size, the runtime's bounds,
its style and colours, its parts, its words, a tick's among them, and
its numbers -- and held to the renderer by the malformed charts of the
corpus's `MALFORMED` list, each refused by both. And its own: a
chart taller than the printable area, and its bounds. What the PDF
renderer refuses of what ECharts laid out -- words that would meet,
labels too wide for their slots, bars under 3.5 pt, a plot too short --
is not refused: a Word file of such a chart is written, and Word lays it
out.

**Bounds**, in `limits.ts`, each counted before the work it bounds:
`MAX_DOCX_CHARTS`, 64 charts that are parts of the file, counted where
the walk meets one; `MAX_DOCX_CHART_POINTS`, 25,600 points between them,
what sixteen of the largest chart the runtime resolves hold, a series at
a category or a pie's slice each one, counted before a word or a number
of the chart that crosses is read; and `MAX_DOCX_CHART_DIGITS`, 330
characters to a number, derived as the longest the runtime resolves,
held before a number is read as one. A chart's words, as often as its
part states them, and its numbers' digits are counted with the file's
characters, and a chart with the paragraphs. Measured on 19 November
2026 on an Intel Core i9-10900K shared with other work, under Node
24.21.0 with fflate 0.8.3, a process a measurement, four each: a
document of charts alone at both bounds was written in 0.45 to 0.53
seconds and 180 to 240 MB, and one whose charts hold 3,840,000 of the
file's characters besides in 1.00 to 1.10 seconds and 227 to 377 MB,
where a document of one paragraph took 0.01 seconds and 68 to 69 MB.
Without the two bounds, 160 labelled bar charts of eight series over two
hundred categories held the thread 4.40 to 4.61 seconds at 542 to 545
MB.

**The proof** is 0003's as 0068 and 0074 extend it. The corpus's
`readDocx` reads a chart's part by a closed vocabulary of its own
(`docx/chart-vocabulary.ts`, transcribed from the transitional
`dml-chart.xsd`) and holds it to the one form a report's chart is
written in (`docx/chart.ts`): a part that leads anywhere, names where
its data comes from, or leaves to Word what a report's chart states, is
refused. `verifyDocx` holds each chart to its block
(`check-docx-charts.ts`), and both are proved on a file typed out by
hand.

## Consequences

**What it buys.** A report with a chart is written as a Word file: the
sales report, and every chart fixture the corpus holds but the one no
engine prints. The chart in the file is a chart: a person selects it,
restyles it, and changes its title, where a picture of the PDF's would
be pixels. Its numbers are the report's digits and its words the
runtime's, in a file that holds no object and leads nowhere. Charts the
PDF refuses because their words do not fit ECharts' layout are written,
since Word lays them out. The writer depends on nothing new.

**What it costs.**

- **"Edit Data" does not work.** The file has no workbook, so Word has
  nothing to open. A person who wants to change a chart's numbers
  rebuilds it. Nobody here has seen what Word says when it is asked.
- **The value axis's labels are not the report's.** They are digits in
  the reader's own separators, with no grouping, currency or unit, where
  the PDF's are the runtime's text in the render's locale. A German
  reader of an English report sees `1,5` on the axis and `1.50` on the
  labels beside the bars.
- **Word reads the numbers as doubles.** The file states forty digits;
  Word draws a bar from the double nearest them, and prints an axis
  label from that. Two ticks that share seventeen digits are one to
  Word, where the PDF's axis stands each at its place.
- **The layout is Word's, and nothing here has seen it.** Where a word
  stands, whether two meet, whether a category's label wraps or is cut,
  how much of the box the plot takes: none of it is stated or tested.
  The PDF refuses a chart whose words would meet; the Word file of the
  same chart is written, and may print words over each other.
- **A bar chart's category axis stands at zero**, where the PDF draws
  its line at the plot's foot: under an axis that starts below zero the
  line is drawn through the plot in the Word file. Its labels are at the
  foot in both.
- **The bars' gaps are rounded** to whole hundredths of a bar's width:
  two series' categories stand 56 hundredths apart where the PDF's
  number is 56.25.
- **A chart with nothing to draw prints its title beside its empty
  text**, both in the middle of its box, where the PDF prints the title
  at the top of the box and the empty text in its middle; and its box
  grows where its words need more than its height.
- **A word is trimmed and a line break in one refused**, as the PDF
  does; and a tick's label that no report prints refuses the Word file
  too, though the file does not state it, so that the two engines refuse
  the same documents for their words.
- **The two engines refuse other documents for their charts.** The PDF
  bounds a render's charts by what ECharts' layouts cost
  (`MAX_CHART_DRAWING`), the writer by parts and points: three of the
  largest line chart print as a Word file and not as a PDF, and
  sixty-five small charts the other way round. A number of more than
  330 characters, which no runtime resolves, is refused by the writer
  alone.
- **What no engine prints of a chart is stated twice**, in the renderer
  and in the writer, with BigInt arithmetic on a number's digits in
  both. The list of malformed charts holds them to the same code and
  subject, never to the same sentence, and a kind of wrong that list
  lacks could be refused by one and not the other.
- **The runtime hands on one name more**, report-spec's `MAX_SCALE`,
  beside `MAX_FORMATTED_DIGITS`, so that the writer derives its bound on
  a number's digits.
- **The corpus's reader knows one form of chart**, the writer's. It
  transcribes the schema a second time, as it does for a paragraph: a
  mistake made in both transcriptions passes, no schema judges the file
  in CI, and no gate opens one in Word.
- **Search and a screen reader** find a chart's words in its part only as
  far as Word exposes a chart's text; the chart carries no description
  of its own, as the PDF's carries none.

**What it forecloses.** A chart in a page header or footer of a Word
file, which the PDF refuses too. A chart whose data a person edits in
Word, until a workbook's export exists (0069 is held for it) and a later
record weighs embedding one. The runtime's own text on the value axis,
until DrawingML or the block gives a way to state it.

## Alternatives considered

- **A picture of the PDF's chart.** One layout, and every word where the
  PDF has it, the axis's labels among them. It lost to what was asked
  for: a chart a person can go on working with. It would also need the
  PDF renderer's layout in the writer, so ECharts and zrender as its
  dependencies, which 0058 confines to the renderer, or a rasteriser.
- **Cached values in references, with a formula and no workbook**
  (`c:strRef` and `c:numRef` holding `c:strCache` and `c:numCache`). It
  is what a file made by removing a workbook from Word's own chart looks
  like, and is known to draw. It lost because a reference must state a
  formula, and the formula would name cells of a workbook that is not
  there: the part would say its data come from somewhere, and they do
  not. Should Word turn out not to draw a chart of literals, this is the
  change to make, in `chart-xml.ts`'s `categories` and `values` and the
  reader's vocabulary, and the record is corrected then.
- **An embedded workbook**, so that "Edit Data" works. It needs a
  workbook's writer, which 0069 is held for, and puts an embedded object
  in every file with a chart, which `SECURITY.md` treats as a finding;
  and the workbook's numbers would be doubles or text, a second statement
  of the report's values in one file.
- **Word's own labels and percentages** (`showVal`, `showPercent`, with a
  format code). Less XML, by some 470 characters a label. Word would
  format each number again, in the reader's locale and by its own
  rounding, beside a table whose cells the runtime formatted: the chart
  and the table of one report could disagree in one file.
- **The runtime's text on the value axis by a helper series**: the axis's
  own labels taken away, and a hidden scatter series on a second pair of
  axes with a point at each tick, labelled with the tick's text. It is a
  known way to put text on an axis. It lost to what it would add: a
  series that is no data, a second pair of axes held to the first by
  nothing but their stated ranges, a plot whose room for those labels is
  Word's to give, and no way here to see whether they stand where the
  ticks do. The cost is the second under *What it costs*.
- **A format code for the axis that carries the currency**, read back out
  of a tick's text. The block states a tick's digits and its text, and
  not the format between them; a format guessed from one text is right
  for the locales it was tried with.
- **A chart of Word's with no points, for a chart with nothing to draw.**
  Word draws an empty plot with axes, and DrawingML has no place for the
  empty text, which is the one thing the PDF prints of such a chart. A
  refusal would be worse: the sales report of a month with no sales would
  print as a PDF and not as a Word file.
- **A box of exactly the chart's height for those words**, as a
  rectangle's is written. A row of an exact height cuts a line that does
  not fit it, and how tall a line of the chart's words is, is Word's:
  words could be lost with nothing saying so.
- **Moving what refuses a chart's block into the runtime**, as 0074 moved
  what refuses a code. A code's symbol is a decision -- which version,
  which level -- and decided twice it could pay another account. Of a
  chart nothing is decided outside the runtime already; what both
  engines state is the contract of a block made by hand, which each
  states for every block, held together by the corpus's list. Moving it
  would move the renderer's `exactOf`, `placesOf` and `sharesOf`, which
  its option reads to place every mark, and change files 0058 names, for
  refusals no document the runtime resolved meets.
- **Refusing in the writer what the PDF refuses of its layout**, so that
  the two engines write the same reports. The writer would need the
  layout to know, which is ECharts'; and Word may well lay out what
  ECharts could not.
- **A floor under the writer's bounds from the PDF's `MAX_CHART_DRAWING`**,
  so that one number bounds both. The PDF's unit is what one more point
  costs ECharts' layout and a reader's paint; the writer's cost is the
  characters of a part. One number would be wrong for one of them.

## What follows

- 0075, the QR-bill's slip on a page of its own at the end of the file,
  and 0077, the e-invoice as a labelled copy: each its own record.
- Once a person has opened the files: what Word draws is written into
  this record's *Not yet opened in Word*, and whatever it draws
  otherwise than this record says is a change to the writer or a cost
  here.
- A chart's data in a workbook a person can edit, when a workbook's
  export exists.
