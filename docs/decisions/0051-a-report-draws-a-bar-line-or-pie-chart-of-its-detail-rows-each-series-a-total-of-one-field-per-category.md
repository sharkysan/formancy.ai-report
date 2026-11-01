# 0051 — A report draws a bar, line or pie chart of its detail rows, each series a total of one field per category

- **Status:** accepted; extends [0007](0007-a-report-definition-is-its-own-versioned-document.md), whose components gain the chart
- **Date:** 2026-11-01
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The format.** report-spec's `src/validate-chart.test.ts` holds each
    rule where it is written:
    - a chart read back whole, and part of what the hash names;
    - in the body and the summary, in columns and keep-together blocks,
      and refused in the report header, the page header and the page
      footer;
    - a property it does not know refused, and one it lacks;
    - a side under `MIN_CHART_SIDE`, and one past the printable area;
    - a category that is a detail field, of text, a date or a number,
      printed in a format that displays its type, and asked for the label
      of its rows without one where the field may be null, never blank;
    - one to `MAX_CHART_SERIES` series, their ids unique in the chart,
      each reading a field unless it counts, totalling numbers alone, an
      average declaring its rounding;
    - values in a number or a currency format, never in a currency read
      from a row;
    - a palette of one to `CHART_PALETTE.length` colours, none twice, and
      in a bar or a line chart a colour for each series, said by counts
      alone, where a pie's is held to no count;
    - words of at most `MAX_LABEL_LENGTH` characters, not blank where a
      reader needs them;
    - a pie of one series that sums or counts, refused with its count of
      series, with no axis title, and no value labels on a line chart of
      several series.

    `src/validate.test.ts`'s `invalid-chart` case refuses a blank series
    label beside one that is valid, and its `unknown-kind` case now names
    `gauge`, since the kind it named, `chart`, exists. `src/chart.test.ts`
    holds the palette to eight distinct colours, each written `#rrggbb` in
    lower case and each at least 3:1 against white by WCAG's relative
    luminance, which the test computes.
  - **The editing core.** report-core's `src/diagnostics/parts.test.ts`
    names the fields a chart reads, where it reads them, and the field its
    format takes a currency from; its sample report holds a chart, so the
    every-kind cases reach it. `src/commands/readers.test.ts` removes the
    series a removed field is totalled by and keeps the chart, and
    removes a chart whose category, or whose last series, the field is.
    `src/diagnostics/chart.test.ts` says that a series printed at fewer
    places than its rounding keeps is rounded again, and says nothing of
    one printed at those places or of one that declares no rounding; and
    that a count, or a sum or a greatest of integers, that declares a
    rounding has no places to round, where an average of integers and a
    sum of decimals have. `src/diagnostics/diagnose.test.ts` says both of
    a chart's series through `diagnose()`, the editor's list.
  - **A form review.** report-forms' `src/review.test.ts` blocks a version
    that removes a field a chart totals, its removal naming that series,
    and once applied the chart keeps its count. A version that removes
    the field a chart groups by, a field it proved answered, is offered
    printing nothing of it where the chart labels its rows without one,
    and the removal alone where it does not. It offers no retype
    of a field a chart sums to a type it cannot total, where the same
    report without the chart is offered one; that case is held by the
    validator, which refuses a sum of text, and not by what the core
    names. `src/generate.test.ts` holds a generated report to no chart, a
    guard nothing here could make fail today.
  - **The interim refusal.** report-runtime's `src/lower.test.ts` refuses a
    report holding a chart, in a final render and in a preview, as
    `chart-not-resolved` at the chart's path, naming it by its id, and
    prints one whose chart its condition hides.
  - **The palette.** report-builder-core's `src/palette.test.ts` offers
    every kind but a chart, and refuses a chart inserted or dragged. It
    holds the default chart to the validator: summing the first number,
    named after its function where the field's label is blank, or
    counting the rows where there is none; over a category of text that
    may be null and one that may not, each labelled for its rows without
    one in the report's language, and over a date; and it says what a
    report needs before it can hold one. React's
    `src/accessibility.test.tsx` and Angular's `src/properties.test.ts`
    hold a chart in their reports of every kind.
  - **Seen failing, on 1 November 2026.** Each case was run before the code
    it holds, or with that code disabled in the working tree and restored:
    - the format's cases failed whole before `readChart` existed. Unlike
      0007's rules, the chart's were not each reverted on its own;
    - report-core's `READERS.chart` emptied failed both of `parts.test.ts`'s
      chart cases, the currency left unnamed the second alone, a
      `chartDiagnostics` that never reports failed the case that expects
      it, a series held as the whole chart failed the series' removal, and
      a chart kept when every series goes failed the chart's;
    - the runtime's case failed before a chart had a lowerer, and the
      palette's before it had a default;
    - report-forms' blocking case failed with `READERS.chart` stubbed, and
      again with every read of a chart held as the whole chart. Its retype
      case and the generator's do not fail under either, as said above;
    - the review's fixes, on the same day: the short palette, the blank
      label of the rows without a category, the pie's count, the series
      that rounds an integer and the palette's withheld chart, its default
      labelled and named, each failed before its code; the report header's
      case with the chart's flow rule removed; `diagnose()`'s case with
      `chartDiagnostics` left out of it; the runtime's preview case with a
      preview that skipped a chart, and its hidden chart's with a hidden
      chart lowered; and the forms' category case with a nullable category
      no longer asked for its label.

## Context

A report prints numbers in tables. The reports people make with it --
invoices, statements, site visits, monthly summaries -- are often read for
a shape: which month was up, which category is most of the total. A chart
shows that at a glance, and Report could not draw one: `chart` was the
example of an unknown component kind the validator's tests refused.

What is wanted is an author who adds a chart to a report in either
builder and binds it to the data, and a PDF that draws it as vectors, in
the report's fonts, every number it prints exact, proved on that PDF
([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)), and
refused before rendering where it cannot be drawn whole. That runs through
every package. This record decides the model -- what a chart is in the
format, what it reads and what the editing core knows of it; how the
runtime resolves it and how the renderer draws it are later records'.

What the format already had to build a chart from
([0007](0007-a-report-definition-is-its-own-versioned-document.md)):
- **One detail dataset.** Version 0 declares a header record and one
  detail list (`DATASET_ROLES`), and a table over the detail rows.
- **Totals decided once.** An aggregate is a function -- a sum, a count, an
  average, a minimum, a maximum -- over a field of the detail rows,
  computed exactly and rounded once, as declared, by the runtime
  ([0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).
- **Formats.** A number or a currency format, printed from the exact
  digits in the report's locale.
- **No aggregate in the builders.** Neither builder declares one: an
  aggregate is written in the JSON, by a host or a proposal.

And one rule the work had to keep while it arrives a stage at a time,
each stage merging on its own: a release that does not handle something
refuses it whole, never skips it
([0004](0004-three-version-lines-each-refused-when-unknown.md),
[formancy.ai 0022](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0022-fail-open-fail-closed.md)).

## Decision

**A report may hold a `chart` component: a bar, line or pie chart of the
detail rows, its categories the values of one detail field, and each of its
series a total of one detail field per category, by the functions an
aggregate is totalled with.** Its rules are report-spec's `chart.ts`, which
holds the types and the lists, and `validate-chart.ts`, which holds a chart
to them where it is written.

**Its shape.**
- **The kind of chart is a property.** `chart` is `bar`, `line` or `pie`
  (`CHART_KINDS`), so a bar chart becomes a line chart by an edit of that
  property, its id, its series and its words kept.
- **The detail rows, named as a table names them.** `dataset` is
  `'detail'`, the one detail dataset version 0 has.
- **A box of its own.** `width` and `height` are points, each at least
  `MIN_CHART_SIDE`, an inch, and each within the printable area, as an
  image's box is (`out-of-range`, `exceeds-printable-area`). Whatever the
  data holds, the chart is that box.
- **Where it stands.** In the body and the summary, where content flows,
  and inside a section, a columns block or a keep-together block there. The
  report header, the page header and the page footer refuse it as
  `misplaced-flow-component`, as they refuse a table; a table's cell holds
  runs, and never a component.

**Its category.**
- **A detail field of text, a date or a number.** `category.field` is a
  field of the detail dataset whose type is `string`, `date`, `integer` or
  `decimal` (`CHART_CATEGORY_TYPES`). A `boolean`, a `datetime`, an
  `instant` and an `image` name no group a reader would look for, and are
  refused as `binding-type-mismatch`.
- **In the data's order, or sorted.** `category.order` is `data`, the order
  the rows first give each category in, or `asc` or `desc`, sorted by the
  category (`CHART_ORDERS`). Nothing re-orders or merges categories
  otherwise.
- **Printed in a format that displays it.** `category.format`, optional,
  is held to the field's type (`format-type-mismatch`).
- **Rows without a category are a category.** A field that may be null
  asks for `category.nullLabel` (`missing-property`), never blank
  (`invalid-chart`), and its rows are one category under that label,
  never dropped.

**Its series.**
- **One to `MAX_CHART_SERIES`**, each with an id unique in the chart
  (`too-few`, `too-many`, `invalid-id`, `duplicate-id`).
- **A function and a field of its own.** A series is `{ id, label, fn, of?,
  rounding? }`. `fn` is one of the aggregates' functions; `of` is a detail
  field, absent only for a count, which then counts rows, and with one
  counts the rows where it is not null, as an aggregate's count does. A
  sum, an average, a minimum and a maximum take an `integer` or a
  `decimal` field (`aggregate-type-mismatch`). An average declares its
  rounding (`missing-property`), as an aggregate's must, since it is rarely
  exact.
- **Not a declared aggregate.** A series names its function and its field
  rather than an aggregate the report declares, since the builders
  declare no aggregates, and a series that named one could not be made in
  either. Totals are still decided once: the runtime is to total a series
  with the very function an aggregate is totalled with, and the core
  diagnoses its rounding as an aggregate's (below).

**How it prints.**
- **One format for every value.** `valueFormat` is a number or a currency
  format (`format-type-mismatch`), read in the report's scope: its currency
  is a literal or a header field, never a detail field
  (`misplaced-detail-field`), since a chart has no current row.
- **Its words.** `emptyText`, required, is what a chart with nothing to
  draw prints, in the report's words; `title`, `categoryTitle` and
  `valueTitle` are optional, and `valueLabels` asks for each value printed
  at its mark. Each text is at most `MAX_LABEL_LENGTH` characters
  (`too-long`), and a series' label, its legend entry, `emptyText` and
  `category.nullLabel` are never blank (`invalid-chart`).
- **Colours by place.** A series is drawn in the colour at its place in
  `CHART_PALETTE`, and a pie's slice in the colour at its category's
  place. The palette is eight colours, each at least 3:1 against white
  paper (WCAG 2.2, 1.4.11), the least `#1b9e77` at 3.39 by WCAG's
  relative luminance. A chart's own `palette`, one to eight colours
  written `#rrggbb` in lower case, none twice (`invalid-color`,
  `invalid-chart`), replaces it and is read the same way. The colours of
  the grid and the axes are the renderer's, as a table's rules are.

**What each kind refuses**, as `invalid-chart`:
- **A pie is the shares of one total.** It has one series, whose function
  is a sum or a count (`PIE_FUNCTIONS`): a share of an average, a minimum
  or a maximum is no share of a whole. It has no axis, so no
  `categoryTitle` or `valueTitle`.
- **A line chart of several series has no value labels.** Two series'
  labels at one category could only be printed over one another.
- **A bar or a line chart has a colour for each series.** Its own
  palette has at least as many colours as it has series: a series past
  its end would be drawn in a colour nobody chose. A pie's colours go to
  its categories, which only the data counts, so its palette is held to
  them where the data is.

**What the editing core knows of it.**
- **What it reads.** A chart holds no expression. report-core's
  `READERS.chart`, in `diagnostics/parts.ts`, names its category's field,
  each series' field and the currency its formats read from a field, each
  owned by the chart, so a field only a chart reads is not unused, and
  `fieldReaders`, `removeFieldWithReaders` and a form review
  ([0048](0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md))
  find it. A field's type is the validator's to check, statically; nothing
  of a chart is compiled but its `visibleWhen` and `styleWhen`, as of every
  component.
- **A removed field takes its series.** `removeFieldWithReaders` takes the
  series a removed field is totalled by, alone, in one `updateComponent`
  that keeps the rest (`commands/readers.ts`); a chart whose category the
  field is, or whose every series goes, goes whole, as a table whose every
  column goes.
- **Its rounding is an aggregate's.** A series that declares a rounding
  and totals an integer -- a count, or a sum, a least or a greatest of
  integers, typed by the table the compiler types an aggregate by -- has
  no places to round, `rounding-not-decimal`; and one whose rounding keeps
  more places than `valueFormat` prints is rounded twice,
  `format-rounds-again`, as an aggregate's is (`diagnostics/chart.ts`).
  `diagnose()` lists both.
- **No command of its own.** A chart, its series included, changes through
  `updateComponent`, its id and its kind never.

**Until the runtime resolves charts, it refuses them.** A stage that does
not handle a chart yet refuses one rather than drop it: the runtime refuses
a report holding a chart as `chart-not-resolved`, at the chart's path,
naming it by its id. It is an error, so a preview is refused as a final
render is. A chart its condition hides prints nothing, as any component,
so a report whose every chart is hidden prints. The code goes when the
runtime resolves charts. What a chart prints -- its categories in their
order, its rows without a category under their label, each series' totals
-- is decided here and resolved there.

**The builders do not offer one yet.** Neither palette has Chart until the
builders edit a chart's own properties: one inserted now would be a box
whose kind, category and series no builder edits, in a report the runtime
refuses to render. builder-core's palette withholds it (`NOT_OFFERED`, in
`palette.ts`), so an insert or a drag of one is refused as `unavailable`,
as of a kind the palette does not have. The default those builders will
insert is builder-core's already, held to the validator: a bar chart of
the detail rows, its category the first detail field of text, a date or a
number, in the data's order, labelled for its rows without one whether or
not the field may be null, so that a form version that removes it can be
reviewed into printing nothing of it (0048); its series the first other
number summed, named after its function where the field's label is blank,
or the rows counted where there is none; held to the printable area.
Where the detail dataset has no such field, it says what to declare first.
A chart a report already holds is drawn in the design view as a box of
its size, moved and removed as any component, and its properties are
those every component has.
`generateReport` draws no chart: a first draft would guess a total the
form never asked for
([0045](0045-a-report-generated-from-a-formancy-form-is-a-deterministic-first-draft-and-what-it-left-out-is-listed.md)).

**A draft-format addition.** `reportSpecVersion` is unchanged, and so is
every report that was valid. A release that predates the kind, 0.2.0 among
them, refuses a report that holds one as `unknown-kind`, never skipping it.

## Consequences

**What it buys.**
- **One model for three drawings.** Bar to line is an edit of one
  property, one undo step, its id kept, and so is either to a pie once
  the chart has one series of a sum or a count: a diagnostic, a review or
  a proposal that named the chart still names it.
- **Nothing a reader could not use gets past the editor.** A legend entry
  of nothing, a palette that names a colour twice or is shorter than its
  series, a pie of averages, a line's value labels printed over each
  other: each is refused where it is written, by the validator every
  layer asks.
- **One rule for every total.** A series is totalled by an aggregate's
  function and its rounding diagnosed by an aggregate's rule, so a chart
  and a table that print the same total are held to one decision.
- **A form's changes reach it.** A form version that removes a field a
  chart totals blocks the report's submissions of it until reviewed, and
  the review's removal takes that series and nothing else (0048).
- **Fail closed, a stage at a time.** A report that would print a chart is
  refused by the runtime that cannot resolve it, and one that holds a
  chart by a release that does not know the kind, never printed without
  it.

**What it costs.**
- **No expression.** A chart reads fields as the data gives them. A
  category computed from fields, a series of a computed amount -- a
  quantity times a price -- a filtered subset or a ratio of two totals
  cannot be charted: the data must carry the field. A date category groups
  by the day, so a chart by month needs a field that holds the month.
- **The detail rows alone.** A chart of the header, of a parameter or of a
  dataset of its own is not drawn, and since version 0 has one detail
  dataset, a report charts one list. Only its currency may come from the
  header.
- **Eight series**, because the palette has eight colours. The bound is
  derived from the palette, not measured: nothing here shows that eight
  series are legible in a chart's box, which is the renderer's to say.
- **A pie of one sum or one count.** Narrower than the functions a bar or
  a line takes; no pie of averages and no rings of several series.
- **Colours follow places, not series.** Removing a series from the middle
  shifts the colour of every series after it, so the series that remain
  print in other colours than before, and a reader who compares two
  prints by colour can be misled. A series cannot keep a colour of its
  own. A pie's slices follow its categories the same way, so where the
  data gives other categories, one category may print in another colour.
- **A pie's palette is not held to its slices.** How many slices a pie
  has is the data's, so the validator holds a pie's own palette to one to
  eight distinct colours and to nothing else, and what a slice past its
  end is drawn in is undecided until the runtime resolves charts. A bar
  or a line chart's palette has a colour for each series.
- **No rotated label is promised.** Nothing here decides how a category's
  label that does not fit its room is drawn. The renderer's record does,
  under 0003's rule: refused rather than cut or drawn over another.
- **A report that would print a chart is refused, for now.** Until the
  runtime resolves charts, such a report is refused, a preview as a final
  render, naming the chart; one whose chart its condition hides prints.
  The runtime's cases hold both.
- **Written as JSON, for now.** Until the builders offer a chart and edit
  its own properties, a chart is written into the report by a host or a
  proposal; a builder shows one a report holds, moves it and removes it.
- **The README's pictures are retaken when the builders offer one.** The
  palette those pictures record, and the browser gate reads, is the one
  without Chart; the change that offers it retakes them with
  `node scripts/pictures.mjs`, as a change to what a picture shows is.
- **A hand-written chart without `nullLabel` keeps no category a form
  version removes.** Printing nothing of a removed field declares it
  nullable, and a category that may be null needs its label, so a review
  offers to print nothing of a chart's category only where the chart
  labels its rows without one; a chart written without that label, over
  a field that may not be null, is offered the removal alone, which takes
  the chart. The builders' default always writes the label.
- **0.2.0 refuses a report with a chart.** It refuses the whole report as
  `unknown-kind`: a report saved with one opens only in a release that has
  the kind.

**What it forecloses.** Nothing that cannot be undone: the format is a
draft's. A chart of an expression, a colour on a series and a component
kind for each kind of chart would each be another record's.

## Alternatives considered

**A series naming a declared aggregate.** The report already decides a
total once, as an aggregate, and a series that named one would have reused
its function, its field and its rounding by reference. Neither builder
declares an aggregate, so a person could not make such a series in either,
and a chart would be a component no builder could ever make whole. A series
of its own function and field keeps "decided once" by the function the
runtime totals it with, not by the reference.

**Three component kinds, `barChart`, `lineChart` and `pieChart`.** Each
kind's fields would be its own, and a pie's single series a type rather
than a rule. But a component's kind never changes in place --
`updateComponent` keeps its id and its kind -- so a bar chart turned into a
line chart would be a deletion and an insertion: a new id, which a
diagnostic, a review and a proposal no longer find. And every table typed
over the component kinds would hold three entries for what is one model
drawn three ways.

**A colour on each series.** It would let a series keep its colour when
another is removed. But a pie's slices are its categories, which the data
gives and no series lists, so a colour per series could not colour them;
one list read by place serves both. And a colour per series would be one
more thing to hold distinct from its neighbours, where a palette is held
once.

**A pie of any function a bar takes.** The functions are one list, and a
pie of minima would draw. It would draw shares of nothing: an average, a
minimum or a maximum is not a part of a whole.

**A category of any type.** A boolean would make two categories labelled as
a boolean prints, and a datetime or an instant a category for nearly
every row; neither is a group a reader looks for, and an image has no
label at all.

**Rows without a category dropped, or labelled by the renderer.** Dropped,
their totals would be missing without a word; a word the renderer chose
would not be in the report's language. The author names them.

**Value labels on a line of several series, placed apart.** A layout rule
that moved one series' labels off another's could not promise room at
every category, and a label it could not place would be refused at
render, for data the editor had no way to foresee.
