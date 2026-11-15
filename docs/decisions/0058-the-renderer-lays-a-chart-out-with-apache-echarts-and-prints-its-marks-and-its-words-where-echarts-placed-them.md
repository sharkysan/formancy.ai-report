# 0058 — The renderer lays a chart out with Apache ECharts, handed the runtime's axis and words and measuring in the report's faces, draws its marks through pdfmake's SVG converter and its words as pdfmake's text where ECharts placed them, and refuses what would meet, leave its box or be too thin to read

- **Status:** accepted; numbered while 0053, 0054, 0055, 0056 and 0057 were held by branches not yet merged; extends [0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md), which admits ECharts and zrender for the renderer alone, by the digests of the licence files a review read, as 0016 and 0047 admitted Formancy Data's packages; [0005](0005-pdfmake-renders-reports-behind-one-adapter.md), under whose one adapter a second library now runs, ECharts laying a chart out and pdfmake drawing it; [0011](0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md), whose renderer draws a chart and refuses one it cannot draw whole; [0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md), whose proof reads a chart by its clip, its paths and its words; [0052](0052-a-report-draws-a-bar-line-or-pie-chart-of-its-detail-rows-each-series-a-total-of-one-field-per-category.md), whose drawing it decides, a label that does not fit refused and never turned; and [0055](0055-the-runtime-resolves-a-chart-exactly-its-totals-as-every-total-and-every-word-it-prints.md), whose block it draws and whose interim refusal it ends
- **Date:** 2026-11-15
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The admission.** `scripts/dependency-licences.test.mjs` admits
    `echarts` 6.1.0 and `zrender` 6.1.0 for report-render-pdf alone, by the
    digests of ECharts' `LICENSE`, `NOTICE` and `licenses/LICENSE-d3` and of
    zrender's `LICENSE`. It refuses another version of either, a licence
    file of other bytes, and any other published package that depends on
    either itself, ECharts on zrender aside, one whose route the walk first
    finds through the renderer among them, the walk recording every package
    that depends on either, its second edge to it as well as its first. It
    passes a published package's
    own tslib 2.8.1 beside the tslib 2.3.0 both libraries pin, each judged
    by the policy, and the real tree. The Studio's `src/notices.test.ts`
    builds the renderer's browser entry with the Studio's notices plugin,
    and holds it to carrying d3's licence for the code ECharts copied from
    d3, and to one ECharts and one zrender, at the releases the renderer
    pins, in the chunk the entry imports dynamically and in none it imports
    statically.
  - **The measurer.** report-render-pdf's `src/engine.test.ts` measures a
    word as pdfmake measures it, in both entries, a host's face opened from
    the render's virtual files and none left behind, and pins how a word
    with whitespace at its edges or a tab is measured otherwise.
    `src/fonts.test.ts` holds Roboto's ascent and descent, which a word's
    baseline is placed by, to its file. `src/chart-faces.test.ts` takes a
    chart's style's token, size, weight, slant and colour, the title bold in
    the same token, reads no alignment, a style that aligns right getting
    the faces it gets without one, and names two faces handed under one
    digest apart, by their bytes. `src/chart-measure.test.ts` answers a word
    in the width pdfmake measures it in and 国 in its face's line; refuses a
    font it was not handed, a canvas and an image; puts zrender's platform
    back when the layout throws too; keeps nothing of a render's widths once
    the layout ends; and refuses a layout that returns a promise.
    `src/echarts.test.ts` pins what the drawing leans on in ECharts 6.1.0
    and zrender 6.1.0: the 国 probe; the width cache, keyed by the whole font
    string and kept; no single character asked for but the probes; no canvas
    or image asked for; a pie measured in the fonts handed over alone, with
    `labelLayout` null; every gridline on its tick only on a snapped plot;
    and a turned word written as a matrix.
  - **The option.** `src/chart-option.test.ts` hands ECharts the runtime's
    ticks as the axis and no other; places every tick, label and value
    exactly however close the ticks stand for their size, and to the
    digit a double holds on a plot as tall as a page; stands each bar on
    zero; sizes each slice by its share of the pie's exact total, however
    large its values; looks every printed string up by index; names every
    colour it paints; asks ECharts to wrap, cut, hide or template no word;
    labels every k-th tick from the lowest and draws every gridline; keeps
    the category axis at the plot's foot; hands each line series no clip,
    and each bar series ECharts' own; paints its marks, its lines and
    its swatches and nothing else, bordering nothing it fills; and trims
    every word as pdfmake trims it, refusing a control character.
  - **The drawing ECharts writes.** `src/chart-svg.test.ts` holds each
    kind's SVG to the elements and attributes ECharts 6.1.0 writes, each
    shape to its fill, its numbers to its box, its nesting to a PDF/A's,
    its words to the
    runtime's, told apart by the order ECharts writes them, for each kind
    and in bold, read back through the entities zrender writes, each boxed
    where pdfmake prints it; and returns the drawing with no `<text>`, no
    `<style>` and no clip. `src/chart-arcs.test.ts` draws on the pie's own circle
    the pies that printed off it, or blank, as zrender wrote them -- 9999
    and 1, 9998 and 2, a slice of 0.4938 of a pie 257.5 pt in radius, 45,
    2 and 44 -- writes every arc of a slice as two arcs or more of at most
    a quarter turn about the pie's centre, and leaves a slice the reader
    would refuse as it was written; draws a sliver zrender writes with no
    arc within half a tenth's diagonal and its own arc of its sector, and
    not within the first alone; and writes again the arcs of a pie 130.95
    pt in radius, which zrender writes as 131, half a tenth away as
    doubles count it.
  - **The layout.** `src/chart-draw.test.ts` lays a pie out twice, in the
    largest square centred between its bands, draws nothing of a slice of
    no share and prints its legend entry; draws every gridline at its
    tick; labels every k-th tick, k the least that keeps them a line and a
    quarter apart; refuses a plot too short for two tick labels, category
    labels too wide for their slots, bars narrower than `MIN_BAR_WIDTH`,
    a pie narrower than `MIN_PIE_DIAMETER`, whether its box or its words
    leave it that little, labelled bars too thin for ECharts to draw
    whole, a legend or a title
    in the plot, and words that would meet or leave the box; keeps the
    category labels at the plot's foot where a value is negative, and the
    value labels of the highest bar and the lowest negative one inside
    the box; wraps a legend of eight long entries; draws a line series
    with no value as nothing; places every word the layout prints, once;
    lays a chart out the same way twice; lays out seeded charts whose
    words never meet or leave the box; and refuses a chart laid out
    through an ECharts that measures through another zrender.
    `src/chart-held.test.ts` holds the words' rule at the box's edges.
  - **The check.** `src/charts.test.ts` refuses, before anything is laid
    out, a chart in a page region, one wider than its column or taller
    than the body, one past a bound the runtime holds it to, a pie of more
    slices than a palette has colours among them, one with a
    control character Roboto maps to an empty glyph, one of a kind, a box,
    a colour or a style the renderer does not know, and each invariant the
    option holds; and judges each word trimmed, in the face it prints in.
  - **The bound.** `src/charts.test.ts`, "a render's charts, bounded in
    all", pins `MAX_CHART_DRAWING`, `CHART_WEIGHT`, `WORD_WEIGHT` and
    `MAX_CHART_SERIES` to the numbers its comment measured; refuses, before
    any chart is laid out, a render whose charts cost one unit past the
    bound, naming the count, its first chart one the drawing would refuse;
    renders one at the bound; weighs nothing of a chart with nothing to
    draw; counts a pie by its slices and a series' missing values among
    its points; admits as many charts of one value as their weight fits,
    and refuses one more; and counts the layouts pdfmake makes, four for
    four charts behind kept headings that each move, one behind plain
    headings.
  - **The chart in the document.** `src/chart-content.test.ts` paints a
    chart's words after its marks; draws a line chart, a bar chart and a
    pie under no soft mask; draws a chart as tall as the body;
    keeps a heading kept with a chart on the chart's page; measures a
    keep-together block holding a chart as its box; hands the converter
    no `<text>` and opens no file for it in Node; holds each word to the
    advance the drawing placed it by; prints the words in the style's
    colour; prints an empty chart's title and empty text in its box with
    no mark, its title where a drawn chart's stands; moves a chart whole
    from a page's foot in the body, a column, a framed section and a
    keep-together block; renders a document of charts to the same bytes
    twice and in another process; and measures each render's charts in
    its own faces, keeping nothing of them once it ends.
    `src/pdfmake.test.ts` pins pdfmake 0.3.11's detached nodes, and
    `src/flow.test.ts` the heading left behind by a block that prints no
    text.
  - **Both entries.** `src/browser.test.ts` loads ECharts for no document
    without a chart or with an empty one alone, and once for the first,
    counted at the loader; and renders a document of charts, and every
    fixture of the corpus, its charts' among them, to the PDF the Node
    entry renders, every stream inflated.
  - **The registries.** `src/chart-registry.test.ts` draws a chart's bars
    as a host's preprocessor, registered on the ECharts the renderer lays
    out with, changed them, its words as the runtime resolved them and
    nothing refused: it pins the exposure the costs state, and fails if
    the drawing comes to hold a mark to its place.
  - **On the PDF.** `src/corpus.test.ts` renders report-corpus's
    `CHART_FIXTURES` and judges each with the corpus's checks, each
    refused one by its own message; holds the corpus's copies of the
    renderer's grid and axis colours, its share unit and its labels'
    distance to the renderer's own; and finds a bar chart drawn with no
    bar, a legend naming its marks by each other's colours, a label away
    from its mark, a chart drawn twice, and a Roboto chart's title printed
    regular. report-corpus's `src/check-charts.test.ts` holds the check,
    on real renders and on reads doctored to show each fault.
  - **As an e-invoice, and as a PDF/A-2b.** The e-invoice gate draws
    `variant-charts.pdf` (`scripts/e-invoice/pdf-corpus.mjs`), the first
    sample's page and a bar, a line, a pie and a bar in a host's serif
    face, one to a page, for veraPDF and Mustang to judge inside a
    PDF/A-3b once the gate's record holds it; `scripts/e-invoice/pdf-corpus.test.mjs`
    holds the variant to those fixtures. It draws the same charts on the
    quotation's page as `pdfa-2b-charts.pdf` (`scripts/e-invoice/pdfa-2b.mjs`),
    for veraPDF's PDF/A-2b profile to judge
    ([0057](0057-a-report-that-is-no-e-invoice-is-drawn-as-a-pdf-a-2b-where-the-host-asks-for-one.md))
    once the record holds it too; `scripts/e-invoice/pdfa-2b.test.mjs`
    holds it to drawing what `variant-charts.pdf` draws.
  - **Seen failing, from 12 to 15 November 2026.** Each case was run
    before its code existed, or with its code broken alone and restored,
    by the implementer of each change in the working tree or by its
    reviewer in a scratch copy:
    - the guard's cases failed before `CONFINED` existed, and again with
      a direct dependent hidden behind the route through the renderer and
      with ECharts' `NOTICE` and d3's licence unread; the Studio's notice
      case with d3's licence left out, and its chunk cases with every
      dynamic import inlined;
    - the pins' and the measurer's cases against a stub that replaced
      nothing, eight of eleven, and under thirteen mutations;
    - the option's cases against a value axis of doubles, six of them,
      and its precision case at a unit of 10^3;
    - the reader's cases with a relative step read as a point, with each
      two adjacent words of `WRITTEN` swapped, and with a style sheet
      matched by an expression that backtracked, at 54.1 s;
    - the layout's against a missing module and a stub of one layout,
      fourteen of nineteen, and seven of 95 against the layout before its
      first fix round, the two cases of a negative bar's label room at the
      box's foot among them;
    - the check's against a stub, 61 of 62, and eleven more with only
      line breaks refused and no bound held;
    - the document's 21 cases before the stack existed; its page-foot
      moves with the stack's `unbreakable` dropped, and with its spacer
      dropped; its anchor's rows under the rule before;
    - the browser entry's count with ECharts imported eagerly, and with
      `loadOnce` removed;
    - the zero slice's cases on the renderer that drew it as a sector of
      no sweep; the arcs' on the renderer that drew them as zrender wrote
      them, a pie of 9999 and 1 printing blank, and again with one arc to
      a quarter turn;
    - the corpus's chart check against a stub, 37 of 43; its fixtures
      with the renderer broken fourteen ways, twelve of which failed
      them, and the other two, a legend whose entries are shifted and a
      value label moved off its bar, once the legend and the labels were
      tied to their marks;
    - `MIN_BAR_WIDTH`'s gap case at a `BAR_GAP` of 0.3, the e-invoice
      variant's two cases before the variant was listed, and the PDF/A-2b
      variant's three before it was;
    - the bound's cases with each chart weighed by its points alone, four of
      seven; then with its words unweighed, five, its missing values
      uncounted, one, the title's and the legend's weights swapped, five,
      the bound let through at `>=`, four, and an empty chart weighed, one;
      and the count of kept headings' layouts with the renderer's rule for
      kept headings switched off, and the alignment case with the alignment
      read into the size, each in the working tree on 15 November 2026;
    - in the final review's fix wave, on 15 November 2026: the check's
      bound with a pie of nine slices rendered; the least pie's case before
      `squareOf` held its diameter; the clip's three cases, the option's,
      the reader's and the document's, before the option set `clip: false`
      and the reader took the clip out; the bound's pins at a line of 490;
      the registries' case with the host's preprocessor never armed; the
      radius's case at a `RADIUS_ROUNDING` of 0.05, and the sliver's with
      its bound taken as 0.0707 pt alone; the browser entry's loop held to
      the PDF of the fixture retitled; the reader's cases of a path and a
      rectangle with no fill, before it required one; and the guard's case
      with the walk recording a dependent only where it first found a
      package.

## Context

[0052](0052-a-report-draws-a-bar-line-or-pie-chart-of-its-detail-rows-each-series-a-total-of-one-field-per-category.md)
decided what a chart is, and
[0055](0055-the-runtime-resolves-a-chart-exactly-its-totals-as-every-total-and-every-word-it-prints.md)
how the runtime resolves one into a block that holds every word it
prints, each value's exact digits beside its text, its ticks and its
colours. Until the renderer drew one, it refused the block as
`unsupported`. This record decides how the renderer draws it.

What the drawing was asked to be, in 0052's words: vectors, in the
report's fonts, every number it prints exact, proved on the PDF
([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)), and
refused before rendering where it cannot be drawn whole
([0011](0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
The plan's first revision drew the marks itself. On 1 November 2026
Daniel asked for a library instead: a chart is a layout -- axes, a legend
that wraps, where each word stands and what it must not meet -- and a
charting library already does it. The one chosen was Apache ECharts
6.1.0, which lays a chart out without a DOM and writes it as SVG, which
the converter pdfmake vendors draws as vectors.

A library brings what this repository otherwise keeps out:
- **Numbers of its own.** Its ticks are a double's, and it formats its
  labels itself.
- **Widths of its own.** It measures text by a canvas, or by zrender's
  estimate where it has none, in fonts nobody chose.
- **Colours of its own**, from a theme.
- **Words dropped.** By default it hides labels that meet.
- **State of its own.** zrender, which ECharts draws through, keeps one
  platform and its caches for the whole process or page.
- **A drawing nobody here wrote.** Its SVG is untrusted input, made of the
  data's words.

A spike, on a branch never merged, answered nine questions on
11 November 2026, on an Apple Silicon Mac under Node 22.23.3, with ECharts
6.1.0, zrender 6.1.0, pdfmake 0.3.11, PDFKit 0.19.1 and pdfjs-dist
6.4.299, of hand-built blocks of a bar, a line and a pie chart:
- **Q1, no DOM: held.** Each kind laid out and written as SVG in plain
  Node, with no `document` or `window`, and in both entries; zrender's
  canvas and image loader, installed as functions that throw, were never
  called.
- **Q2, its vocabulary: held.** Eight elements, each with a short list of
  attributes. The text is escaped by zrender's `encodeHTML`, `& < > " '`
  as `&amp; &lt; &gt; &quot; &#39;`, and attribute values not at all. One
  `<style>` of `:hover` rules is always written, and the title's and the
  legend's backgrounds carry the theme's border colours.
- **Q3, measuring: held, with one fix.** zrender hands the measurer the
  font string `normal normal 8px Roboto, froboto`, the option's family
  intact, and asks it for the runtime's words alone, and for two probes,
  `国` and `a`. The widths were the same in both builds: "Umsatz nach
  Region" at 8 pt was 73.19140625 pt in Roboto and 66.6484375 in
  Liberation Serif. Asked straight, PDFKit gives `国` its .notdef width,
  3.546875 in Roboto, so the probe must be answered with the face's line.
  A pie's default label layout measures in zrender's own `12px
  sans-serif`, whatever the label's style, until `labelLayout` is null.
- **Q4, the words in the report's faces: failed in the Node entry.** In
  the browser entry the converter drew all 39 words, each one run in its
  face, its box within 0.000 pt of where the layout put it. In Node, the
  font the converter's callback names for a word is pdfmake's virtual
  file, which PDFKit's font factory reads with `fs.readFileSync` from the
  disk: a host's face was
  not found and the render refused, and where pdfmake had opened no face
  yet the converter read Roboto from disk itself, past pdfmake's access
  policy. Handing pdfmake the bytes instead of a name fails in its URL
  resolver, and pdfmake replaces the converter's font callback with its
  own.
- **Q5, a quarter turn: held.** Labels turned 90° read back at 90°, in
  their face, their boxes exact.
- **Q6, deterministic: held.** One document rendered twice in a process,
  and once in a child process from the build, to the same bytes, though
  zrender's ids advanced between them.
- **Q7, PDF/A: held, in CI.** veraPDF found the e-invoice variant that
  carried the three charts compliant with PDF/A-3b, and Mustang 2.26.0
  accepted it (run 43040837572, 11 November 2026).
- **Q8, the weight: the chart's code a chunk of its own.** Counted from a
  fresh module graph, it was loaded for no document without a chart, once
  after the first chart, and still once after a second. The Studio's
  build, on 11 November 2026, made the chart chunk 540.53 kB minified and
  184.87 kB gzipped, left the page's chunk at 891.54 kB and 287.78 kB, and
  installed echarts at 62,176 KiB and zrender at 5,168 KiB; this record's
  Cost gives the figures of the built renderer.
- **Q9, the axis: held, if the plot is snapped.** Over nine ranges, a
  40-digit total among them, ECharts drew one gridline and one label for
  each tick and no other. zrender moves a thin gridline onto a half point,
  by up to 0.700 pt in those ranges, and the option cannot stop it; with
  the plot's top on a half point and its height a whole multiple of the
  intervals, every gridline stood on its tick, 0.000 pt off. At every
  category labelled, 40 crowded labels were all drawn, over each other:
  ECharts hides none, so the renderer must refuse them.

A rule written before the spike chose between two paths: ECharts' own
words, drawn by the converter in the report's faces; or ECharts' marks,
with the renderer's words drawn by pdfmake where ECharts placed them,
which a failed Q4 was to choose if veraPDF took ECharts' marks. Q4 alone
failed, Q7 held, and the second path is the one built, in both entries;
the first was never written.

## Decision

**A chart is laid out by Apache ECharts and drawn by pdfmake: ECharts
places every mark and every word, the converter pdfmake vendors draws the
marks, and each word prints as pdfmake text where ECharts placed it, in
the report's faces. ECharts is handed nothing it could decide otherwise
than the runtime did; what it writes is held before anything of it is
used; and a chart whose words would meet, leave its box or stand in its
plot, or whose ticks, categories, bars or pie would stand too close or be
too thin or too small to read, is refused, never cut, hidden or turned; and a render's
charts are weighed together, and refused past a bound measured on the
render and on a reader.** In order:

1. **ECharts is the renderer's alone.** report-render-pdf depends on
   `echarts` and `zrender` at exactly 6.1.0, zrender directly because the
   measurer replaces its platform. `scripts/dependency-licences.mjs` admits
   them in a table of its own, `CONFINED`, in
   `dependency-licences/reviews.mjs`: each at one version, by the SHA-256 of
   the licence file a review read on 12 November 2026 -- ECharts' Apache
   License 2.0 with its section on d3.js, and beside it its `NOTICE` and
   `licenses/LICENSE-d3`, d3's BSD-3-Clause; zrender's BSD-3-Clause -- and
   for report-render-pdf alone. The policy judges them as any package. They
   are further refused at another version, with another licence file, and
   wherever any published package but the renderer depends on either itself,
   ECharts on zrender aside, every dependent judged and not the first route
   the walk finds; a package reaches them through the renderer, which loads
   them for a chart alone. The tslib 2.3.0 both pin is not confined: it is a
   helper under 0BSD, and the Angular builder and rxjs depend on a tslib of
   their own, so the policy judges it as any package. The Studio's notices
   carry d3's licence, which ECharts keeps in a directory the notices plugin
   does not read (`apps/studio/src/embedded-notices.ts`).
2. **Loaded with the first chart that has marks.** `chart-draw.ts` is the
   one module that imports ECharts' code, and `chart-measure.ts`, which
   imports zrender's platform, is imported by it alone. `render.ts`
   imports it, through `loadOnce`, the first time a document holds a
   chart with something to draw, in both entries, and keeps it; a
   bundler makes it a chunk of its own. ECharts' components are
   registered at the first draw, never at import, and the package is
   `sideEffects: false`. A chart with nothing to draw is placed without
   it (11).
3. **Checked before it is laid out** (`check-chart.ts`), each refusal
   naming the chart and the sizes or counts that do not hold, and quoting
   none of its words or values:
   - **Where it stands**: in the body, a column, a section or a
     keep-together block, never in a page region.
   - **What it is**: a kind the renderer knows, a box of a size, its
     colours and its style held as a paragraph's are, and no more than the
     runtime's bounds -- `MAX_CHART_CATEGORIES` categories,
     `MAX_TICK_INTERVALS` intervals, and `MAX_CHART_SERIES` series or
     slices of a pie, as many as a palette has colours, as the runtime
     holds a pie's categories to its palette, each read from the runtime,
     which hands on report-spec's `MAX_CHART_SERIES` for it -- so that a
     block built by hand costs no more to lay out than one the runtime
     resolves.
   - **Its parts, matched**: a value or null for each series at each
     category, a legend that names each series, or a pie's every slice,
     in its colour, or none; an empty chart its title and empty text
     alone.
   - **Its words**: every one it may print, trimmed of the whitespace
     pdfmake cuts from a run, each held to the scripts the renderer prints
     and to its face as a paragraph's is. A word holding a control
     character -- Unicode's Cc, which holds the tab and every line break
     but two, or the line and paragraph separators -- is refused, its
     empty text's among them, whatever its face maps: Roboto maps U+0000
     and U+0002 to empty glyphs, and the word would print as nothing while
     its text held the character.
   - **Its numbers**, as the runtime writes them: every value a decimal;
     the ticks two or more, ascending in equal steps, holding every value,
     and a bar chart's holding zero; a pie's slices none below zero and
     more than nothing together.
   - **Its size**: no wider than where it stands, and no taller than the
     body once the page regions are measured.
4. **Measured as pdfmake prints it** (`chart-measure.ts`,
   `chart-faces.ts`). ECharts measures every word it places through
   zrender's `platformApi.measureText`, so the renderer replaces it for
   one layout with a measurer that answers in pdfmake's widths: each
   entry's `Engine.widths`, which opens the faces the render embeds -- a
   host's stripped of its layout tables as `host-fonts.ts` strips them --
   in a document of the engine's own pdfmake, and measures a word as
   PDFKit's `widthOfString`. `国` is answered with the face's line.
   - **One layout at a time.** ECharts' layout is synchronous; the
     measurer is set for it and put back after it, whether it returned or
     threw, and a layout that returns a promise is refused once the
     platform is back. A font string it was not handed is refused, and so
     are a canvas and an image.
   - **A face known by its bytes.** The family ECharts is told is pdfmake's
     family, a comma, and `f` and the hex of the SHA-256 of the face's key:
     for a host's face the digest of the bytes the render embeds, for Roboto
     `Roboto/<face>`. zrender keeps the widths it was answered,
     process-wide, by the whole font string and the word, up to 500 words
     for each of 100 font strings (`contain/text.js`), so a width it kept is
     one of those bytes. Nothing of the measurer, or of the render's widths,
     outlives the layout; what zrender keeps outlives the render, and
     nothing zrender exports clears it.
   - **One zrender.** A chart is refused, as `unsupported`, where ECharts
     resolves another copy of zrender than the one the measurer replaces:
     ECharts would measure every word in widths nobody chose.
   - **The words' style.** A chart's words take its style's font token,
     size -- 8 pt where it names none -- weight, slant and colour, black
     where it names none; its title is bold in the same token. Its `align`
     is held to a paragraph's values and is not read: ECharts places each
     word, and an alignment means nothing for a word placed.
5. **Handed nothing to decide** (`chart-option.ts`):
   - **The value axis is the ticks' places.** Tick i stands at place i,
     from 0 at the lowest; each is a gridline, and every `tickEvery`-th
     from the lowest is labelled. A value stands at its distance from the
     lowest tick in the ticks' interval, `(v − lowest) / step`, worked out
     in BigInt on the decimals' units to `QUOTIENT_UNIT`, 10^17, and made
     a double at the end; a bar stands on zero's place. ECharts never sees
     a value, so it neither rounds nor formats one. This replaces 0055's
     "a renderer may make a coordinate of the digits with `Number`": the
     values' doubles would put ticks that share fifteen leading digits up
     to half an interval from their places, and draw two that share
     seventeen as one; and worked out to three places, a value a
     ten-thousandth of an interval below a tick would stand on it, 0.76 pt
     off on a plot as tall as an A4 page (`chart-option.test.ts`).
   - **A pie's slice is its exact share.** Its value over the sum of the
     slices, a quotient to the same `QUOTIENT_UNIT`, so that a pie past a
     double's range is drawn.
   - **A slice of no share draws nothing.** A zero, or a slice under one
     part in 10^17 of its pie, is handed to ECharts as −1. ECharts 6.1.0
     leaves a negative value out of a pie's data before it lays the pie
     out (`processor/negativeDataFilter.js`), and its legend names each
     entry the data held before (`visual/LegendVisualProvider.js`), so the
     slice draws no path and its legend entry prints. A
     share of 0 would draw a hairline from the centre to the rim, and a
     value ECharts reads as missing a path in its default black.
   - **Every word the runtime's, looked up by index.** ECharts sees
     a category as `c0` and a series as `s0`; every word comes from a
     formatter that looks it up, and one asked for an index the block does
     not have throws. Nothing wraps, cuts, hides, turns or reads a word as
     markup: no width, overflow, ellipsis, rich text, string template,
     rotation, `hideOverlap` or automatic interval, and no `showMinLabel`
     or `showMaxLabel`. A pie's label layout is null.
   - **Every colour the option's.** Each series' or slice's and each
     legend entry's is the block's; the grid's and the category axis's
     are the renderer's constants, `GRID` and `AXIS`, as a table's rules
     are; every word is coloured; and the title's and the legend's borders
     and backgrounds are transparent and no fill has a border, so that no
     colour is left to ECharts' theme.
   - **What it paints**: bars, slices and line markers filled in their
     colour; lines, gridlines and the category axis's line stroked; legend
     swatches filled and stroked; nothing else. The category axis stands
     at the plot's foot (`onZero: false`), with a slot for each category,
     a line's as a bar's.
   - **No clip of a line's.** A line series is handed `clip: false`, so
     that ECharts hides none of its markers past the plot, where no value
     the check admits stands; ECharts 6.1.0 still draws the line inside a
     clip, of the plot widened by its longer side (`LineView.js`
     `createLineClipPath`), which the drawing takes out (6). A bar series
     keeps ECharts' own: ECharts clips a bar by working out each one
     inside the plot, which writes no clip, and the same bars with `clip:
     false` were written the same.
6. **What ECharts wrote is held before it is used** (`chart-svg.ts`), and
   refused as `unsupported`, naming the chart and quoting nothing of the
   drawing, where it holds an element, an attribute or a value ECharts 6.1.0
   was not seen to write, or a shape without the fill zrender always
   writes, which SVG would paint black; a comment, a DOCTYPE or a processing instruction;
   CDATA or a `<style>` but the one style sheet of `:hover` rules, which is
   removed; an entity or a character reference but zrender's five; a number
   not finite, or past the box by more than its longer side, each point a
   path reaches as the converter takes it; groups nested deeper than a PDF/A
   nests the graphics state; a fill or a stroke the option did not name; a
   `<text>` turned or scaled; or a word the layout does not print, or a word
   it prints that no `<text>` holds. Each `<text>` is taken out and read
   back as the box pdfmake prints its word in: its advance in its face wide,
   placed by its anchor, its top half its face's line above the point
   zrender centres its line on (`dominant-baseline: central`). Two words of
   one text in one face are told apart by the order ECharts writes a chart's
   words in. An empty path, `d=""`, which ECharts writes for a line series
   with no value beside one with values, is admitted: the converter draws
   nothing for it. The converter is handed the drawing with no `<text>`, no
   `<style>` and no clip. ECharts clips every line series to its plot,
   whatever the series' `clip` says, and svg-to-pdfkit draws a clip path as
   a group the size of the page under a luminosity soft mask, which a
   reader composites for each series: a page of eight one-series line
   charts cost PDF.js at scale 1 a median of 76 ms with the clip and 11
   without it, eight of eight series 547 and 21 (the final review's probe
   and its rerun, 15 November 2026). The clip cuts nothing: every value
   stands inside the ticks, and a line's joins, bevelled, and its ends,
   butt, stand no farther from its points than half its width. So each
   clip is held as written, a path the drawing defines once in zrender's
   black, and then taken out with every `clip-path` that names it.
7. **A pie is drawn on its own circle** (`chart-arcs.ts`). zrender writes
   a slice's arc between ends rounded to a tenth of a point, and the
   converter draws an arc on the circle through its two ends. As zrender
   wrote them, on 13 November 2026, a slice of 0.4938 of a pie 257.5 pt in
   radius printed 5 pt off its circle, the larger slice of 9998 and 2 on
   a circle 57 pt from the pie's, and a pie of 9999 and 1 at 160.23 pt
   nothing at all. So the renderer writes every arc of a slice again,
   before the drawing is read, as two arcs or more of at most a quarter
   turn about the pie's exact centre and of its radius, between the
   points zrender wrote. Every point of a slice's outline then stands
   within 0.0707 pt plus 10^-4 of the radius of its share's sector, at
   most 0.0965 pt on the widest pie, 257.64 pt in radius: 0.0707 pt is
   half a tenth's diagonal, and 10^-4 of the radius bounds the cubic the
   converter draws an arc as and the arc of a sliver zrender writes as a
   line alone. Measured, read back by PDF.js with every curve sampled, at
   most 0.0718 pt over 90,428 slices of 22,955 pies of radii 0.12 to
   257.64 pt, and 0.07205 pt for a sliver written with no arc. A slice
   whose arc is shorter than a tenth's diagonal, 0.1 · √2 pt, may draw no
   curve, its ends rounded into one point, and one whose ends meet draws
   a hair of no area out to the circle and back. A slice the reader would
   refuse, or one with an arc of another radius, is left as written, for
   the reader to judge. These numbers are the renderer's own in a
   drawing that is otherwise ECharts', which `chart-svg.ts`'s header
   says.
8. **Laid out, then only snapped** (`chart-draw.ts`). A bar or a line
   chart is laid out three times, every tick labelled in the first two:
   - **The bands**: across the whole box, read for where the title and
     the legend stand. The top band is the title's line and half a line,
     `BAND_GAP`, under it, and where values are labelled a label's line
     and its distance from its mark; the foot band is the legend's rows
     and half a line above them. A bar below zero labelled under its end
     has its label's room between the plot's foot and the category
     labels, which the option stands that much lower, and not at the
     box's foot, where the label never stands.
   - **The plot**: ECharts fits the plot, and its axes' words, between
     the bands and the box's sides, and the plot is read by
     `convertToPixel` at the lowest tick's place and the highest's, and
     half a slot past the first and the last categories' middles.
   - **Drawn**: the plot's top moved down to the first half point, its
     height cut to the most that fits with every interval a whole number
     of points, so that every gridline stands on its tick; and every
     `tickEvery`-th tick labelled, the fewest that set two labels
     `TICK_CLEARANCE`, a line and a quarter, apart.

   A pie is laid out twice: the bands, then drawn in the largest square
   centred between them, refused where that square is narrower than
   `MIN_PIE_DIAMETER` (9). Every layout is ECharts' own, under the render's
   measurer, disposed once it is read.
9. **Refused, never cut, hidden or turned**, as `content-too-large`,
   naming the chart and its box and the sizes that do not fit:
   - **Category labels print across, and never turn.** A category label
     wider than its slot less half a line refuses the chart, all its
     labels across, centred under their slots. The words are pdfmake's
     text, and the renderer turns none.
   - **A plot too short** for two tick labels that far apart.
   - **Bars narrower than `MIN_BAR_WIDTH`**, 3.5 pt, refused in the
     layout that first lays them out, before its words are read. It is
     the least width, to the quarter point, at which every bar of a bar
     chart printed as a run of its colour with a white pixel before the
     next, in the page PDF.js draws at the density of the Studio's Preview
     at 100 % on a screen of device pixel ratio 2, 8/3 device pixels to the
     point:
     measured on 13 November 2026 on an Apple M2 under Node 22.23.4 over
     3,960 bar charts of 0.25 to 5 pt, of one, two and eight series, three
     tick sets and 22 left margins, 3.25 failing on 17 of 198 charts and
     3.5 on none. The white gap between bars, a quarter of a bar, is what
     sets it, and lower densities need more: 4.25 pt at 75 % on a ratio of
     2, 6.25 at 100 % on a ratio of 1, 8.25 at one pixel to the point. It
     rose from a provisional 2.
   - **A pie narrower than `MIN_PIE_DIAMETER`**, 3.25 pt, its square's
     side, whether its box or its title and its legend leave it that
     little. It is the least diameter, to the quarter point, at which a
     pie of eight equal slices, report-spec's palette, showed every slice
     along its rim -- the band one pixel wide of the outermost pixels
     wholly inside its circle -- as a run of its own colour, each inside
     its own sector, and its neighbours told apart, at the density
     `MIN_BAR_WIDTH` was measured at: measured on 15 November 2026 on the
     Apple M2 under Node 22.23.4 at a load of 2.6 to 3.1, at 22 places --
     twenty across one device pixel, its left and its top at every
     twentieth, and the starters' margins -- of pies of 0.25 to 12 pt in
     quarter points and every point to 40, 3 pt failing at 2 of the 22 and
     3.25 at none; and at 400 places, every pair of twentieths, 3 at 26
     and 3.25 to 4 at none. Lower densities need more: 4.25 pt at 75 % on
     a ratio of 2, 6.25 at 100 % on a ratio of 1, 8.5 at one pixel to the
     point. A valid pie of eight slices that a review drew 9.75 pt across
     is drawn, and one it drew 0.24 pt across is refused.
   - **Words that would meet, leave the box, or stand in the plot** but
     a value's label (`chart-held.ts`), the one rule a drawn chart's and
     an empty chart's words are held to.

   A tick, a category or a bar is never dropped, and a word never
   shortened.
10. **One unbreakable stack** (`chart-content.ts`), in every pass:
    - the drawing, handed to pdfmake's converter in the box at its top
      left, its image and warning callbacks refusing it, as an SVG
      asset's do;
    - each word as pdfmake text, `noWrap`, in its face, size and colour,
      detached at its box's top left, and held, once pdfmake has measured
      it, to the advance the drawing placed it by (`words.ts`);
    - a spacer of the box's height, the one node that takes the flow's
      room.

    pdfmake lays a detached node out from where the flow stands and takes
    none of its room, and inside an unbreakable block it fits no node,
    reading the room as `NaN`: the stack is fitted once, as a fragment as
    tall as the box, and moves to the next page whole. The words are
    painted after the marks, over them. A heading kept with the next
    block is kept with a chart's first word, whose page pdfmake corrects
    when it moves the block, as it now is with a keep-together block's
    first text wherever it stands in it; that word is given an id,
    `kept-N`, which pdfmake writes as a named destination.
11. **Nothing to draw, without ECharts** (`chart-empty.ts`). A chart with
    no rows, no value, or a pie of nothing is never handed to ECharts: its
    box is kept whole, its title centred `TITLE_PADDING` below the box's
    top, where a drawn chart's title stands, in the title's face, and its
    empty text centred in the box, each measured as pdfmake prints it and
    held by the words' rule. It draws no axis and no mark, and a document
    whose only charts are empty loads no ECharts.
12. **A render's charts are weighed together, and bounded**
    (`check-chart.ts`'s `checkChartDrawing`). ECharts lays out every chart
    of a render, three times, a pie twice, before the body is paginated, and
    a reader draws every one, and nothing else bounded how many a document
    packs onto its pages. So before any chart is laid out, a render whose
    charts together weigh more than `MAX_CHART_DRAWING`, 5,000 units, is
    refused as `content-too-large` at the chart that crossed it, naming the
    count and the bound and quoting none of its words.
    - **The unit** is what one more point of a line chart of 8 series and
      200 categories costs a render.
    - **A chart weighs** its kind's weight (`CHART_WEIGHT`: a bar 40, a
      line 60, a pie 10); a unit for each series at each category, a null
      among them, or for each of a pie's slices, one of no share among
      them; and each word it places by what the word is (`WORD_WEIGHT`: a
      title, the chart's or an axis's, 3, a legend entry 5, a tick, a
      category and a value 1). A chart with nothing to draw weighs nothing:
      ECharts never lays it out.
    - **How the weights were measured.** On 15 November 2026 on an Apple
      M2 (8 cores) under Node 22.23.4, with pdfmake 0.3.11 and pdfjs-dist
      6.4.299, in one run at a load average of 12 to 20: every document
      rendered and its page drawn by PDF.js at scale 1 in the same seven
      rounds, each difference read against its own round's unit, 0.15 to
      0.50 ms as the load fell, and the median of the seven taken; each
      weight the larger of the render's and the reader's, rounded up, a
      kind's to ten and a word's to a whole unit. A word is the difference
      between one-page documents of the same charts with and without words
      of its kind: a value label 0.85 units on a bar and 0.67 on a line, a
      category label 0.48, a legend entry 2.36 on a pie and 4.02 on an axis
      chart, a title 2.74, each the render's, and a tick 0.35, the
      reader's. A kind is its barest chart of one category, N against 2N,
      less its points and its words: a bar of 8 series 34 to the render,
      and a pie of one slice 8. A line's was measured again the same day,
      once the drawing took ECharts' clip of its series out, by the same
      run at a load of 3.0 to 3.2: a line of 8 series 59 to the render and
      to a reader no more than its points and its words, where its eight
      soft-masked groups had cost a reader 482, and a line of one series 27
      to the render. A reader's cost no longer goes by series, and the
      render's by about 4.5 units a series, which one weight, the eight
      series', holds, as a bar's does. That run put a title at 5.3 units
      and a tick at 1.6, above their weights, and a bar of 8 series at 36
      and a pie of one slice at 7, within theirs.
    - **How the bound was set**: by the slowest of seven interleaved runs
      of the costliest of the forms tried, each render timed and each page
      drawn by PDF.js at scale 1, at a load average of 3.3 to 5.6, to keep
      a render and a page under 2 s. The forms were charts of one category
      of each kind, of 1 and 8 series, bare, dressed and value-labelled;
      the largest of each kind the earlier cost run tried; bars of 120 and
      186 categories and lines of 8 × 200, every value labelled at 4 pt,
      report-spec's least size; pies of 200 slices, bare and with every
      slice in the legend; charts with legends of eight entries; and a
      page of one 8 × 200 line beside lines of 8 series and one category.
      Each was packed as many to a render as the bound holds, in the
      densest grid it draws in on A4 landscape pages without margins,
      across pages, and as many as one page holds. Once a line weighed 60
      and a pie held eight slices at most, the forms were run again at a
      load of 3.0 to 3.9, pies of eight slices in place of 200, bare and
      with every slice in the legend, and among them 53 titled line charts
      of one series and twelve months, the final review's, and three
      8 × 200 lines on one page, which the bound now admits at 4,998
      units.
    - **What the runs found.** At 5,000, in the run that set the bound, the
      slowest render of the forms tried was 263 dressed pies of one slice on
      3 pages, 878 ms at its slowest and 859 at its median, and the slowest
      page one 8 × 200 line beside five 8 × 1 lines, which cost PDF.js 1,614
      ms at its slowest and 723 at its median. A second run, a review's, at
      a load of 4.2 to 5.5, ordered them otherwise: 17 value-labelled bars
      of 120 categories took 1,258 ms at their slowest against the pies'
      1,235, and a page of nine 8 × 1 lines 1,255 against that page's 962.
      The third run, at a line of 60, found the 53 line charts slowest,
      1,202 ms in one round's spike against a median of 338, the next 18
      dressed bar charts of 8 × 19 at 551 ms; and the slowest page the
      three 8 × 200 lines, 142 ms to PDF.js. No run's slowest is the
      slowest the bound admits, which nothing measured. The 1,614 ms is one spike: the page's other six stood at
      0.66 to 1.10 times the reference render's in their rounds. At 0.332 ms
      a unit it reaches 2 s at about 6,017 units, and 6,000 would leave
      about 10 ms, so the bound is 5,000, which the same run confirmed.
    - **It holds one layout pass.** pdfmake lays the whole document out
      again for each page where a kept heading moves to the next, which no
      bound before the layout can count. Behind a keep-with-next heading
      each, 17 bar charts of 123 one-letter categories, 290 pt tall, which
      the bound admits, took a median of 1,475 ms where behind plain
      headings they took 574, at a load average of 3.2 to 3.7; and 20 of
      them, past the bound, 1,887 ms against 637 at about 4.
13. **A chart counts against no SVG budget.** An SVG asset's paths are
    held to `MAX_SVG_SEGMENTS` and `MAX_SVG_DRAWING`, as an untrusted
    file's; a chart is the renderer's drawing of a block, held to the
    block's bounds and to the render's chart bound above. The costliest of
    eight chart forms the cost run tried, three to an A4 landscape page,
    each as wide as the page and a third of its height, was a line chart
    of 8 series and 200 categories whose labels are empty, which no slot
    bounds. That page, measured on 15 November 2026 on the Apple M2 under
    Node 22.23.4, took a median of 586 ms to render (549 to 849), against
    4.6 ms without its charts, at a load average of about 5; it draws
    4,869 paths, read back by PDF.js as 43,338 segments -- 4,869 moves,
    4,869 lines and 33,600 curves, a close not counted -- which weigh
    115,572 as report-spec's `svg-cost.ts` weighs an SVG asset's for
    `MAX_SVG_SEGMENTS`, a curve three lines and a stroke twice a fill. The
    chart bound admits that page, its three charts 4,998 units once a line
    weighs 60, and refuses a fourth chart; PDF.js drew it in 142 ms at its
    slowest at a load of 3.0 to 3.9. One of them alone draws
    1,623 paths, 14,446 segments, which weigh 38,524, nearly four times
    what the body's SVG images may cost together.
14. **Proved on the PDF**, by report-corpus's `check-charts.ts` and the
    modules beside it, which 0003's addition describes.

**A refusal names the chart and says sizes.** Every refusal here names
the chart by its id and says the sizes or the counts that do not hold,
never a word, a label or a value, each of which may be a customer's. What
the renderer does not know, and what ECharts wrote that the reader does
not hold to, is `unsupported`; what does not fit, `content-too-large`. A
font the measurer was not handed, a canvas or an image asked for, and a
formatter asked for what the block does not have are the renderer's own
invariants, thrown as they are, which the check keeps any report from
reaching.

**0055's interim refusal is gone.** report-render-pdf's `check.ts` no
longer refuses a chart block as "not drawn by this release"; it holds it
to `check-chart.ts` and draws it.

## Consequences

**What it buys.**
- **A library's layout, and none of its decisions.** Axes, a legend that
  wraps into rows, labels placed by their measured widths, and three
  kinds, from ECharts; every number and word from the runtime, every
  colour from the block or the renderer, every width from the face
  pdfmake embeds.
- **Text in the report's faces.** A chart's words are pdfmake's text,
  embedded in the report's faces, read back by PDF.js as runs, and held
  to the faces and scripts a paragraph is.
- **Exact at any size.** A value's place and a slice's share are worked
  out in BigInt, so a 40-digit total and ticks that share fifteen digits
  are drawn where they stand.
- **Nothing for a page without a chart.** A document with no chart, or
  only empty ones, imports none of ECharts.
- **The same bytes.** One document of charts renders to the same bytes
  twice and in another process, though zrender's ids advance.
- **Fail closed.** A word that would meet another, a label that does not
  fit, a bar too thin to see, a pie too small to tell its slices apart, a
  drawing ECharts writes otherwise than it
  was read to write, a second zrender, and a render whose charts together
  cost past the bound are refused, naming the chart; none is drawn
  partly.

**What it costs.**
- **A second library, and its internals.** The drawing leans on ECharts
  6.1.0 and zrender 6.1.0 beyond their API: zrender's platform, replaced
  and put back around each layout; its `国` probe; its width cache,
  process-wide and keyed by the whole font string; a pie's null label
  layout; the negative-value filter a slice of no share rests on; the
  order ECharts writes a chart's words in, which tells two of one text
  apart; the SVG it writes, held element by element; and where zrender
  moves a thin gridline. `echarts.test.ts` and the reader's tests pin
  them, and the admission holds both libraries at one exact version, so
  an upgrade is a diff somebody reads, a second vendor's release notes
  with it, before the pins run on it.
- **pdfmake's detached nodes are leant on.** A word is a detached node
  inside one unbreakable stack, and pdfmake 0.3.11 fits nothing inside an
  unbreakable block; `pdfmake.test.ts` pins both. A pdfmake that fitted
  them would fit each word against the room at the stack's top, which
  keeps it on its chart's page.
- **ECharts decides where a word stands, and the renderer only refuses.**
  A chart ECharts lays out badly but without overlap prints: a legend of
  many rows over a short plot, a title close to the plot's words.
- **The renderer's look, not the report's.** The grid, the category
  axis's line, the bars' spacing, the line's weight, the markers and the
  legend's swatches are the renderer's constants; only the colours and
  the words' style are the report's. There is no value axis line, no
  tick mark and no background.
- **A chart's alignment is not read.** A report's `align` on a chart's
  style is held to a paragraph's values and changes nothing.
- **Category labels never turn.** A chart of labels too long for their
  slots, or of many categories in a narrow box, is refused, to be widened
  or given shorter labels. A quarter turn, which the spike read back
  exact, needs words the converter draws, the path not taken.
- **The least bar is a screen's.** `MIN_BAR_WIDTH` was measured at the
  density of the Studio's Preview at 100 % on a screen of device pixel
  ratio 2; at 75 %,
  or on a screen of ratio 1, the bars of the densest chart drawn may run
  together in the Preview, or in any reader that draws the PDF as
  coarsely; the PDF keeps a gap between them. And a bar chart whose bars
  would be narrower is refused, though a reader zoomed further in would
  draw them apart.
- **Installed with every renderer.** ECharts and zrender are installed
  with report-render-pdf, for a host that never draws a chart too:
  `du -sk` on their package directories under `node_modules/.pnpm`
  measured 62,176 KiB for echarts 6.1.0 and 5,168 KiB for zrender 6.1.0,
  on 15 November 2026. A browser loads them only with the first document
  that holds a chart with something to draw, in a chunk of 550.73 kB
  minified and 189.00 kB gzipped by the Studio's build (Vite 8.3.5, an
  Apple M2, Node 22.23.4, the same day), which also holds the renderer's
  drawing. The renderer's own chunk, which every preview loads, is
  1,989.15 kB and 871.06 kB gzipped, and was over the Studio's old
  warning limit before any chart; 4,269 bytes of it are the drawing's
  option, which only the chart chunk uses (`chart-option.ts`), measured
  from the build's source map and not moved out.
- **A chart's words stay in the process.** zrender keeps the widths it
  measured, by the words and the font string, up to 500 words for each
  of 100 font strings, after the render; nothing zrender exports clears
  them. A chart's categories, legend entries and title, a customer's
  words, so stay in the Node process or the page, beside the digest of
  the face they were measured in, where 0043 keeps nothing of a face for
  the next render.
- **zrender's platform is shared.** It is one for the process or the
  page, and a host's own ECharts measures through it too. The measurer
  stands for one synchronous layout and is put back, so a host's charts
  measure as they did between the renderer's; but a host whose bundle
  gives ECharts another zrender than the renderer's has every chart with
  something to draw refused.
- **ECharts' registries are shared too.** A preprocessor, a processor, a
  visual, a layout or an update a host registers on the `echarts` it
  shares with the renderer -- the one module a Node install or a bundler
  dedupes every importer of ECharts 6.1.0 to -- runs on every chart the
  renderer lays out. A review's preprocessor that halved a bar series'
  data halved every bar the renderer printed, 78 pt to 39, its ticks'
  words the runtime's and nothing refused: a chart whose marks disagree
  with its words, and a Preview that differs from the server's PDF. The
  host's code is trusted, so this is a stated limit and no defence: the
  renderer holds every word to the runtime's and every path to the box,
  not a mark to its place. `chart-registry.test.ts` pins it as it stands.
  Holding each bar's ends and each marker's centre to the place the option
  handed ECharts, as the corpus does in tests, would refuse such a chart,
  and an ECharts release that moved a mark; it is not built.
- **A render's charts are bounded by one machine's measure, confirmed at
  a quiet load.** The weights and the bound were measured on one Apple
  M2, the weights at a load of 12 to 20 and the line's again at 3.0 to
  3.2, and the 2 s the bound keeps holds at the loads it was confirmed
  at, 3.3 to 5.6 and, once a line weighed 60, 3.0 to 3.9. At a load of 10 to
  18.6 the documents it admits ran far slower at their slowest: a page of
  nine line charts of 8 series and one category 5.5 s, the page that set
  the bound 9.45 s, and a render of 53 bar charts of 8 series and one
  category, with legend entries of 100 characters, 9.1 s.
- **The bound rests on one run.** The slowest of seven runs set it, and that
  run was a spike, 1,614 ms against the page's median of 723: without it the
  same rule would have set the bound at about 9,000 to 9,600. A later run,
  once a line weighed 60, kept every form under 1.3 s at a load of 3.0 to
  3.9, and the bound stayed. And the weights are medians, not upper
  bounds: over the seven rounds a title cost 1.2 to 5.9 units, and an axis
  chart's legend entry 2.7 to 20.4; the line's run put a title at 5.3 and
  a tick at 1.6 units, above their weights of 3 and 1.
- **A document of many charts is refused.** A render whose charts weigh
  more than 5,000 units is refused, at the chart that crossed it, though
  each chart would draw: three line charts of 8 series and 200 categories
  fit, and four do not; 53 titled line charts of one series and twelve
  months fit, and 54 do not. It is the host's to split across renders.
- **A kept heading multiplies the cost the bound holds.** The bound holds
  one layout pass, and pdfmake lays the whole document out again for each
  page where it moves a kept heading to the next, the charts' share of a
  layout with it: 17 admitted bar charts behind kept headings took two and
  a half times as long as behind plain ones. `charts.test.ts` counts the
  extra layouts.
- **A line's clip is taken out of ECharts' drawing.** ECharts 6.1.0
  clips every line series to its plot whatever its `clip` says, and the
  renderer takes the clip out before the converter is handed the
  drawing, as it takes the words and the style sheet out, where a reader
  composited a soft mask for each series. The line is drawn as ECharts
  wrote it, inside the chart's box, and the clip cut nothing the check
  admits by the line's bevelled joins and butt ends, which an ECharts
  release could change, the corpus's points check with it; the reader
  still holds the clip as written.
- **A chart's paint is not bounded as an SVG's.** One line chart of 8
  series and 200 categories, as wide as an A4 landscape page and a third
  of its height, weighs 38,524 segments as report-spec weighs an SVG
  asset's, nearly four times what the body's SVG images may cost together
  (`MAX_SVG_SEGMENTS`), and the chart bound admits three of them on a
  page, which PDF.js drew in 142 ms at its slowest; what painting them
  costs another reader was not measured. Three of them, before the bound, took a median
  of 586 ms to render at a load average of about 5, and medians of 1.25
  and 1.67 s, a single run 3.0 s, at about 23.
- **The least pie is a screen's.** `MIN_PIE_DIAMETER` was measured, as
  `MIN_BAR_WIDTH` was, at the density of the Studio's Preview at 100 % on
  a screen of device pixel ratio 2, on a pie of eight equal slices: at
  75 %, or on a ratio of 1, the slices of the smallest pies drawn may run
  together in the Preview, and a slice of a small share is thin at any
  size. A pie whose square its box or its words leave narrower is
  refused, where it printed before; it refused no starter or fixture of
  the corpus. 3.25 pt tells eight slices apart, and holds no word: a pie
  that small is legible as marks, its words all in its legend.
- **A pie's arcs are within a bound, not exact.** Within 0.0707 pt plus
  10^-4 of the radius of their sectors, at most 0.0965 pt; a sliver
  shorter than 0.141 pt may draw no curve; and the renderer writes those
  numbers into a drawing that is otherwise ECharts'.
- **A kept heading can be left behind.** A chart that prints no word -- a
  pie with no title whose every legend entry is blank -- is kept with by
  its drawing, whose page pdfmake 0.3.11 never corrects when it moves the
  block, and so is a keep-together block of an image alone: where the
  block moves to the next page, a heading kept with it stays at the foot
  of the page before. `flow.test.ts` holds it as it stands.
- **The proof has holes.** An empty chart's box is proved by its words
  alone, since it draws nothing. A chart and an SVG image of one size are
  told apart by their size and their order alone. A pie's arc that bulges
  0.47 pt off its circle passes the corpus, which knows the circle only
  from the outline; `chart-arcs.test.ts` holds the renderer's arcs
  tighter. Columns that break across pages break the document order
  charts are sought in. A value label and a legend entry are held to
  their marks by a tolerance measured on three faces' metrics, which a
  face of a taller ascender fails: a review found Verdana and Tahoma at
  10 pt do. A colour a
  reader cannot tell from its neighbour, and a mark under a word, are not
  seen.

**What it forecloses.** Nothing that cannot be undone. A turned label, a
second charting library or another one in ECharts' place, and a chart
that draws its own axis would each be another record's.

## Alternatives considered

**ECharts' own words, drawn by the converter in the report's faces.** The
path the spike tried first: ECharts writes each word as a `<text>`, and
pdfmake's converter draws it in the report's face. It would have printed
a turned label exactly (Q5), and placed each word with no reading back.
It failed in the Node entry (Q4): the converter's font callback names a
virtual file, which PDFKit reads with `fs.readFileSync` from the disk, so
a host's face is not opened and the render is refused, and Roboto is read
from disk past pdfmake's access policy.

**Report drawing the marks itself.** The plan's first revision: a stated
layout rule, the marks an SVG of the renderer's own and the words
pdfmake's text, with no dependency and nothing internal to lean on but
pdfmake's `_maxWidth`. It lost to Daniel's call for a library, and to what
it would have had to write and keep: a legend that wraps, labels placed
and held apart, each kind from nothing.

**Vega-Lite.** A grammar compiled to Vega and drawn to SVG by Vega's view
in Node. It formats its own numbers with d3-format, so the runtime's
strings would travel as data and its labels be its own; it measures text
by a canvas, or estimates it without one; and its specification holds an
expression language, which the report's words would reach.

**Chart.js on a canvas.** A canvas: in Node a native `canvas` package,
and pixels in a vector PDF, its words drawn by the canvas in the canvas's
fonts rather than as text in the report's embedded faces. 0052's "as
vectors, in the report's fonts" fails twice.

**D3's scales and shapes.** d3-scale and d3-shape compute paths, not a
layout: the axes, the labels, the legend and what keeps them apart would
still be the renderer's own, the first revision's work with a dependency,
and its `ticks()` is a double's, which the runtime's exact ticks replace.
None of these three was trialled here; each lost on how it is built.

**A pie's arcs written to four places, or its slices split in the
data.** Asked through its painter for four places, which ECharts' option
cannot ask, zrender drew real pies within 0.082 pt; but the model of it
left up to 0.98 pt near a whole turn, it reached past ECharts' API into
zrender's, and written for every chart it would have broken the
argument `MIN_BAR_WIDTH` rests on, every coordinate to a tenth. Each
slice handed over as a quarter turn's pieces of one colour drew within
0.062 pt, but PDF.js drew a pale line along every edge two pieces share,
and a slice was no longer one path. Writing each arc again about the
pie's own centre, between zrender's own ends, left neither, measured by
the same investigation on 13 November 2026.

**A slice of no share handed to ECharts as 0, or as missing.** A share of
0 draws a sector of no sweep, a path from the centre to the rim that may
print as a hairline; a value ECharts reads as missing, `'-'` or null,
draws a path of no outline in zrender's default black, a colour the
reader refuses; and a slice left out of the data loses its legend entry,
its words printed nowhere.

**Labels turned at 45°.** A diagonal label fits more categories than a
label across. But the corpus's `read-pdf.ts` boxes a turned run by the
upright box on the page that holds it, exact at 0° and 90° alone, so two
diagonal labels that do not touch could not be proved apart on the PDF;
and on this path the words are pdfmake's text, which the renderer turns
at no angle.

**A chart counted against the SVG budget, as an SVG asset is.** One bound
for every drawing. But `MAX_SVG_SEGMENTS` weighs what a reader paints of
a file's segments, and nothing of the layouts ECharts makes of every
chart before the body is paginated, which the chart bound's weights
measure on the render; and one line chart of 8 series and 200 categories
weighs nearly four times that bound, so it would refuse one such chart,
where the chart bound admits two to a page, rendered in 627 ms at their
slowest.

**A chart weighed by its kind and its points alone, or one weight for every
word.** The first form of the chart bound weighed a unit a point and nothing
for a word, and under it value-labelled bars and lines cost 1.4 to 1.65
times the slowest render its own run had found, and pies of 200 slices with
every slice in the legend 2.3 to 2.44 times. One weight for every word would
have to be a legend entry's, at least 5, five times a category label's, and
would refuse a labelled 8 × 200 line on its own, at 10,120 units.

**`clip: false` alone.** The final review proposed it, reading that
ECharts writes no clip for a line series told not to clip. ECharts 6.1.0
does: `LineView.js` sets the line group's clip whatever `clip` says, and
widens it by the plot's longer side, so the soft mask stayed (a probe on
15 November 2026). The option sets it for the markers, which ECharts would
otherwise hide past the plot, and the reader takes the clip out.

**A line weighed by its series.** A base and a weight for each series, as
the final review proposed while each series' clip cost a reader a mask:
with the clip out, a reader's cost no longer goes by series, and the
render's 4.5 units a series sit inside one weight, the eight series', as
a bar's do. A line of one series is charged 60 for the 27 it cost.

**The least pie at `MIN_CHART_SIDE`.** A pie refused whose square is under
72 pt, report-spec's least side, as the ruling before the final review
proposed: it would refuse every titled pie in a box under about 91 pt
tall, and refused a readable pie of two slices 33.9 pt across in a box of
200 by 72 (the final review's probe). Measured as `MIN_BAR_WIDTH` was, the
least is a reader's, not a box's.

**Each mark held to its place.** The drawing's reader could hold each
bar's ends and each marker's centre to the place the option handed
ECharts, as the corpus's checks do in tests: a host's registration that
moved a mark, and an ECharts release that did, would be refused rather
than printed. It is not built; the registries' cost states what it would
close.
