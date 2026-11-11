# 0055 — The runtime resolves a chart exactly: its categories in the data's order or sorted, its totals as every total, its ticks one, two or five times a power of ten, and every word it prints

- **Status:** accepted; numbered while 0053 and 0054 were held by branches not yet merged; extends [0052](0052-a-report-draws-a-bar-line-or-pie-chart-of-its-detail-rows-each-series-a-total-of-one-field-per-category.md), whose chart it resolves and whose interim refusal it ends, and [0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md), whose document gains the chart's block
- **Date:** 2026-11-11
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The block.** report-runtime's `src/lower-chart.test.ts`:
    - a bar chart's values are the very text the table's group footer
      prints over the same rows, and a series that declares a rounding is
      rounded as the aggregate of its definition is: 24.20 half to even,
      where half away from zero would print 24.30;
    - a count, or a sum of integers, that declares a rounding is refused
      by report-core before anything renders, and past that check by the
      runtime, once for the series and in an aggregate's words;
    - a bar chart resolves whole: its categories in order, its exact
      values, its ticks and a legend of its two series. It has no legend
      for one series. Its axis covers every series, not its first alone.
      A series with no value at a category holds null there. Its own
      palette colours its series and its legend;
    - the rows without a category print under its null label, once, last
      when sorted and at their first row in the data's order, in a
      preview that lacks the field too; and a chart that names no null
      label, over a field that may not be null, prints an empty label in a
      preview that lacks the field;
    - a decimal category with no format prints as its first row in the
      data's order spells it, 0.5 or 0.50, and with a format of two places
      as 0.50 either way;
    - a pie's shares are exact, rounded once, and list every category, a
      zero among them; and each is rounded on its own, so three equal
      slices print 33.3 % each;
    - a pie's legend entry is `label: value (share)` in de-CH and in fr-CH
      as in English, around each locale's own figures;
    - a pie of more categories than its palette has colours is refused,
      naming both counts, its own palette's included;
    - a pie with a negative value is refused, naming the chart and
      quoting no digit or category, and so is one of +5.00 and -5.00;
    - the empty text prints for no rows, for a series with no value, and
      for a pie of zeros, with nothing else;
    - more than `MAX_CHART_CATEGORIES` is refused before anything is
      totalled;
    - a 40-digit total, a single category and every value equal resolve;
    - every word the block holds is a string the formatter wrote, a
      currency's symbol among them;
    - a value or a category its format cannot print is refused at
      `valueFormat` or at `category`, naming the chart, and a currency is
      read where the report is; and a pie is refused so though it labels
      none of its values;
    - the runtime exports `MAX_CHART_CATEGORIES`, `MAX_TICK_INTERVALS` and
      `SHARE_PLACES`.
  - **The axis.** `src/chart-ticks.test.ts` ticks a table of axes: a bar
    from zero, negatives below it, all zero, a flat line from zero, a line
    that does not start at zero, a count never cut into fractions, values
    finer than the format, and a line of 10,000 and 12,000 beside bars of
    the same values. It ticks a 40-digit total exactly, and
    covers each of 1,000 seeded ranges from 10^-20 to 10^30 in at most six
    ticks no finer than the format.
  - **The categories.** `src/sort-group.test.ts`'s `categoryGroups` keeps
    the order the data gives its categories, each once, and every row
    under its own. It holds decimals of one value as one category at every
    scale, keeps the first row's spelling, and puts the rows without a
    category in one group. Over 100,000 distinct decimals it counts the
    decimal comparisons it makes and the reads of their units, at most two
    a row. Its `canonicalKey` case holds the key equal for two values
    exactly when `sameKey` says they are one.
  - **The totals.** `src/totals.test.ts`'s `totalOf` totals a series and a
    group's aggregate of one definition to one value, on data where
    rounding each group differs from rounding the whole. It rounds a sum
    of decimals once, and refuses a rounding declared on a sum of integers
    and on a count. It orders text only by the collator it is handed.
    `src/decimal.test.ts`'s `ratioRounded` rounds an exact ratio once:
    0.29 / 2 is 0.15, where a double's `toFixed(2)` gives 0.14.
    `src/format.test.ts`'s `percent` prints a share as the locale writes a
    percentage, and refuses one Intl would round again.
  - **The editor and the runtime alike.** report-core's
    `src/diagnostics/chart.test.ts` says only `rounding-not-decimal` of a
    count rounded to two places and printed at none. It types a series as
    the compiler types an aggregate of the same function over the same
    field, for each function over each of the sample's fields.
  - **Where it stands.** `src/lower.test.ts` prints a chart where it
    stands, in its own style laid over its section's, and nothing where
    its condition hides it.
  - **The renderer's refusal.** report-render-pdf's `src/refusals.test.ts`
    refuses a chart as `unsupported`, naming it, in Node in the body, in a
    column and kept together, and in the browser entry in the body.
    report-corpus's `src/trial/undrawn.test.ts` refuses one through both
    trial adapters.
  - **Seen failing, on 11 November 2026.** Each case was run before its
    code existed, or with its code broken alone and restored: by the
    implementer of each change, in the working tree, or by its reviewer,
    in a scratch copy of the package. By suite:
    - `sort-group.test.ts` failed with adjacent keys alone grouped, with
      decimals compared as written, with the sorted path taken for one
      direction alone, and with nulls not last; its counts with each key
      compared with every category, by `sameKey` or by `canonicalKey`; and
      its `canonicalKey`
      case with trailing zeros kept and with null keyed as the text
      "null";
    - `totals.test.ts` failed with a declared rounding ignored, in a
      series and in a group, with a decimal's rounding skipped, with an
      integer's rounding let through, a count's among it, with a total of
      unknown kind left in integers where it declares a rounding, and
      with text ordered by code unit where no collator was handed;
    - `decimal.test.ts` failed with `ratioRounded`'s scales ignored and
      with a zero denominator let through; `format.test.ts` with either of
      `percent`'s two guards removed, and with its message saying "1
      places";
    - report-core's `diagnostics/chart.test.ts` failed with the series'
      diagnostics going on past `rounding-not-decimal`, with the
      compiler's field typed `dyn`, and with `seriesType` typing a series
      apart from the compiler;
    - `chart-ticks.test.ts` was written with its code and first failed
      against a stub that threw. It failed with a bar not from zero, a
      flat line not from zero, every line from zero, no floor at the
      format's places, the floor at the values' places instead, one
      interval more, the ceiling rounded down, and a floor that rounds a
      negative towards zero;
    - `lower-chart.test.ts` failed whole before `chartBlock` existed. It
      failed with each of these broken alone: a series rounded half away;
      a value printed as its digits; the rounding dropped; a series always
      totalled in decimals; its refusal recorded once a category; the
      categories' bound checked after totalling or off by one; the
      palette's bound removed or off by one; a chart with no value, or a
      pie of zeros, not empty; an empty chart that kept an axis title; a
      negative share let through, or one hidden by checking the zero
      total first; a category printed outside its format, or from its
      last row's spelling; a pie's unlabelled values left unformatted; a
      legend joined otherwise outside English; ticks printed as
      their digits, or from the first series alone; a series in the
      default palette; the null label not read; a share rounded twice, or
      the last one nudged so that the shares add up; a format's refusal
      printed as nothing; a currency not read where the report is; and a
      series' null printed as zero. `lower.test.ts` failed with a chart's
      style dropped;
    - render-pdf's `refusals.test.ts` and the corpus's
      `trial/undrawn.test.ts` failed with `chart` left out of their
      switches.

## Context

[0052](0052-a-report-draws-a-bar-line-or-pie-chart-of-its-detail-rows-each-series-a-total-of-one-field-per-category.md)
decided what a chart is in the format and in the editing core. Until the
runtime resolved one, the runtime refused a report that would print one,
as `chart-not-resolved`. This record decides how the runtime resolves a
chart: which categories it has, what each series totals at each of them,
which ticks its value axis has, and which words it prints.

The anti-goal is a number on a chart that differs from the same number in
the report's table. Report already decides every printed number once, in
the runtime
([0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)):
- **Rows are grouped in one place.** `sort-group.ts` orders a table's rows
  and groups them by a key, a decimal by its value.
- **Totals are exact and rounded once.** `totals.ts` totals each aggregate
  exactly and rounds it once, as it declares, over the report's rows and
  over each group's.
- **Values are printed in one place.** `format.ts` prints a value from its
  digits, through Intl.

A chart that grouped, totalled or printed by rules of its own would print
another number than the table beside it, and nobody would find out from
either.

And four questions were open:
- **0052 parked two.** It left a pie's palette unheld to its slices, since
  only the data counts them. It also said the runtime would refuse a
  rounding declared on an integer series, which nothing had built.
- **The renderer will draw a chart with a charting library.** That
  library's ticks and labels are its own, computed in doubles. Whichever
  stage chooses the axis decides what the chart prints.
- **A pie prints shares.** No total Report prints is a share.

## Decision

**A chart resolves to a block of its own, `Chart` (`chart-document.ts`).
Every number and every word it prints is decided by the runtime, once, by
the rules a table's are decided by (`lower-chart.ts`, `chart-ticks.ts`).**
In order:

1. **Its categories** are grouped where a table's rows are
   (`categoryGroups`, `sort-group.ts`):
   - **Sorted** (`asc`, `desc`), by the table's own `orderRows` and
     `groupRows`, the rows without a category last.
   - **In the data's order**, each key once, at its first row, holding
     every row with that key in the order the provider gave them. A key
     is found through a `Map` by `canonicalKey`, which holds two values
     one exactly when `sameKey`, a table's rule, does. So 1.0 and 1.00
     are one category, and grouping is linear in the rows.
   - **The rows without a category** are one category under
     `category.nullLabel`, never dropped.
   - **Each label** is the group's key, read once, printed in
     `category.format`. The key is the first row's value in the data's
     order, so a decimal category the data spells at two scales, 7.7 and
     7.70, prints with no format as that row spells it, and with a format
     of a scale as the format does. In a preview, a field the data lacks
     reads as null, and its rows print under `nullLabel`. A chart with no
     `nullLabel` -- possible only over a field that may not be null, and
     never the builders' default, which always writes one -- prints an
     empty label in a preview that lacks the field, the data check having
     warned; a chart with a label prints its label.
2. **Two bounds are held before anything is totalled.** A chart of more
   than `MAX_CHART_CATEGORIES`, 200, is refused as
   `chart-too-many-categories` at its `category`, naming the count and the
   bound. 200 is chosen, not measured, as a bound on the runtime's work.
   How many categories a box draws legibly is the renderer's to say. A
   pie of more categories than its palette has colours, eight unless it
   names its own, is refused with the same code, naming both counts. The
   runtime assigns the colours, so it refuses a pie its palette cannot
   colour apart, rather than cycle the palette or leave it to the
   renderer.
3. **Each series' value at each category is a total, by the one function
   every total is computed by.** `totalOf` (`totals.ts`) totals every
   aggregate of the report and every group's. A series is handed to it as
   the aggregate of its definition: the same function, over the same
   field, rounded as it declares. Its decimals are those
   `totalsInDecimals` gives an aggregate of the series' type.
   `seriesType` gives that type, which is report-core's `fieldTotalType`,
   the function the compiler types an aggregate by. So:
   - **A declared rounding is an aggregate's.** A sum's, an average's, a
     least's or a greatest's rounding is applied once, to the exact
     total, as an aggregate's is.
   - **An integer's rounding is refused.** A rounding declared on an
     integer total -- a count, or a sum, a least or a greatest of
     integers -- is refused as `rounding-not-decimal`. report-core
     refuses it before anything renders. Past that check the runtime
     refuses it, once for the series, at `series/<i>`, naming the series
     and the chart. A count's rounding goes through `totalOf` as every
     total's does, so it is refused as theirs is, never ignored.
   - **A missing value is null.** A series with no value at a category
     -- a least, a greatest or an average over rows that lack it -- holds
     null there, never zero.
   - **One formatter prints it.** Each value prints in `valueFormat`,
     read in the report's scope, by the formatter a footer is printed
     by.
   - **No collator is passed.** A series takes no least or greatest of
     text, which the validator refuses, and a count orders nothing.
     `totalOf` throws a defect where it meets text without a collator,
     rather than order it by code unit.
4. **Nothing to draw** -- no rows, a bar or a line chart with no value, a
   pie whose values are all zero -- is the chart's box, its style, its
   title and its empty text, and nothing else. Its categories, series,
   ticks, slices and legend are empty, and it has no axis title, since it
   has no axis.
5. **A bar or a line chart's value axis** is chosen by one rule
   (`chartTicks`), exactly, over every value of every series, at the
   value format's places (`scale`):
   ```text
   lo = min(values), hi = max(values)
   if chart = bar, or lo = hi:   lo = min(lo, 0), hi = max(hi, 0)        -- a bar starts at zero; a flat line is measured from zero
   if lo = hi (both 0):          hi = 1
   span = hi - lo;  e = digits(span.units) - 1 - span.scale               -- floor(log10(span)), exactly
   for k from max(-scale, e - 1) upward, for m in (1, 2, 5):              -- no step below one unit of the format's last place;
     s = m * 10^k                                                         -- below e - 1 every step gives at least 20 intervals
     n = ceil(hi / s) - floor(lo / s)
     if n <= MAX_TICK_INTERVALS: return [floor(lo / s) * s + i * s for i in 0..n]
   ```
   Everything in it is BigInt division on a decimal's units. The loop
   ends at the latest at `k = max(-scale, e + 1)`: there a step is at
   least the span, which gives at most two intervals. Zero is a tick
   wherever the axis holds it. A bar's axis holds zero, a flat line's
   too, and any other line's need not.
   - **Six labels at most.** `MAX_TICK_INTERVALS` is 5, chosen, not
     measured, as what a reader takes in at a glance.
   - **Each tick in the value format.** A tick is written without its
     trailing zeros, and the formatter pads it back.
   - **A legend of two series or more.** The legend lists the series,
     each with its label and colour, only where the chart has more than
     one.
6. **A pie** has one series, a sum or a count:
   - **A negative value refuses it**, as `chart-negative-share` at
     `series/0`. This is checked before its total, so values that cancel,
     +5 and -5, are refused rather than printed as a pie with nothing to
     draw.
   - **Its whole is the sum of its slices as they are totalled.** Each
     slice is rounded where its series declares a rounding, so each share
     is of what is drawn, not of a total over every row.
   - **Each share is rounded once.** It is
     `ratioRounded(value, whole, { scale: SHARE_PLACES + 2, mode: 'half-away-from-zero' })`,
     the exact ratio rounded once. `SHARE_PLACES` is 1, chosen: 12.5 %.
   - **`Formatter.percent` prints it** as the locale writes a percentage.
     It refuses a fraction at more places than it keeps as
     `percent-rounds-again`, never rounded again by Intl, and one of more
     integer digits than Intl prints as `number-too-large`. A pie's share
     meets neither, at exactly `SHARE_PLACES + 2` places and at most 1;
     they hold `percent` to its contract for any caller.
   - **Its legend** lists its categories. Where the chart labels its
     values, an entry reads `label: value (share)`; otherwise it is the
     label alone.
7. **Colours by place**, from the chart's own `palette` or
   `CHART_PALETTE`: a series' at its index, a slice's at its category's
   index. The grid's and the axis's colours are the renderer's.

**The block is a renderer's contract** (`chart-document.ts`):
- **Every word.** The block holds every word the chart prints: its title,
  its axis titles, each category, each tick, each value and each legend
  entry, and its empty text. Each is the formatter's output or the
  author's own words, but for the colon and the parentheses of a pie's
  legend entry. A renderer prints these and no other word, and formats,
  rounds or converts no number. A pie's slice prints its value only inside
  its legend entry, where the chart labels its values: a renderer draws no
  label on a slice.
- **Every value twice.** `exact` is the value's digits
  (`decimalToString`), which a renderer may make a coordinate of with
  `Number`. `text` is what it prints, and all a renderer prints of it.
- **The axis fixed.** The ticks are lowest first, the first and the last
  the axis's range, and each a gridline. A renderer draws these and no
  other.
- **Every colour but two.** It holds every colour the chart paints but
  the grid's and the axis's.

**A refusal names the chart and says counts.**
`chart-too-many-categories`, `chart-negative-share`, a series' refusal in
`totalOf`'s words, and a format's refusal at `valueFormat` or at
`category`, as `chart <id>: …`. None quotes a value, a label or a
category, each of which may be the customer's.

**Until the renderer draws charts, it refuses them.** report-render-pdf's
`check.ts` refuses a chart block as `unsupported`, "the chart <id> is not
drawn by this release of the renderer". It does so wherever the block
stands, in the body, a column or a kept block, before pdfmake is handed
the document, in either entry. The corpus's trial adapters refuse one too.
The renderer's record replaces that refusal. `chart-not-resolved` is gone,
and 0052's interim refusal with it.

## Consequences

**What it buys.**
- **One number in two places.** A chart and a table over the same rows
  print the same text for the same total, read by `fieldValue`, grouped
  by `sort-group.ts`, totalled by `totalOf`, typed by `fieldTotalType`
  and printed by the one formatter. The first case of
  `lower-chart.test.ts` holds the two to each other, over a table grouped
  as the chart is.
- **Exact at any size.** Totals, ticks and shares are BigInt and `Decimal`
  throughout. A 40-digit total is ticked to its last digit.
- **A renderer that decides nothing a reader reads.** It is handed the
  strings to print and the digits of each coordinate, and has no number
  to format, round or tick.
- **Fail closed.** A chart past its bounds, a pie past its palette, and a
  pie of a negative value are each refused, naming the chart, never drawn
  wrong.

**What it costs.**
- **An author cannot set the axis's range or its step.** One rule ticks
  every chart, and a chart has no property for either. A bar's axis always
  holds zero, so two bars of 10,000 and 12,000 differ in height by a sixth
  of the taller.
- **Shares need not add to 100.0 %.** Each share is rounded once, on its
  own, so three equal slices print 33.3 % each, 99.9 % in all, as
  `lower-chart.test.ts` holds. Nothing rounds the shares to a sum.
- **ICU decides how a percentage is written.** `Formatter.percent` hands
  Intl the share's digits, so the separator, the sign and any space before
  it are the engine's ICU's. `format.test.ts` holds 0.125 at one place as
  `12.5%` in English and `12,5 %` in German. Under Node 22.23.3's ICU
  78.3, it is `12.5%` in de-CH and `12,5%` in fr-CH, measured on
  11 November 2026. Another engine may write another.
- **A pie of more categories than its palette's colours is refused for
  data the editor cannot foresee.** The validator cannot count a pie's
  categories, so a report valid in the editor is refused at print once
  its data gives a ninth. The same holds for a chart of more than 200.
- **The legend's punctuation is the runtime's own.** A pie entry that
  labels its value reads `label: value (share)` in every language. The
  words are the author's and the formatter's, but the colon and the
  parentheses are not, and nothing translates them. French sets a space
  before a colon, and a pie in fr-CH prints the locale's figures around
  the runtime's colon, `North: 66'649 (66,6%)` under Node 22.23.3's ICU
  78.3, measured on 11 November 2026; `lower-chart.test.ts` holds the
  join in de-CH and fr-CH.
- **A pie's whole is the sum of its slices as drawn.** Where its series
  declares a rounding, each slice is rounded first, and its share is of
  the rounded slices, not of the exact total of every row. For a count,
  or a sum that declares no rounding, the two are the same.
- **A negative value refuses a pie**, even where the values cancel. A pie
  of +5 and -5 is refused, not printed as a pie with nothing to draw.
- **One series' label prints nowhere.** A chart of one series has no
  legend, so it is named by its title and its value axis's title, where
  it has them.
- **A decimal category with no format is spelled as its first row
  spells it.** The chart reads it from the first row in the data's order,
  and a table's group header from the first row in the table's order,
  which its own sort keys set: where the data spells one value 7.7 and
  7.70, the chart and the table beside it can print it differently. A
  category `format` with a scale prints both alike.
- **A pie whose values its format cannot print is refused, labelled or
  not.** Every slice's value is formatted, since the block holds it, so a
  pie without value labels is refused for a value it would never print:
  its currency read from a header field with no value, for one.
- **A preview's missing category prints as nothing where the chart
  names no label.** A chart with no `nullLabel`, over a category field
  that may not be null, prints that category under an empty label in a
  preview whose data lacks the field, and the renderer is handed an empty
  string; a chart with a label prints its label.
- **Totalled again, by the same function.** A series is totalled from the
  rows at each category, beside any aggregate that totals the same. The
  two agree because they are one function, not one computation.
- **The bounds are chosen, not measured.** `MAX_CHART_CATEGORIES` bounds
  the runtime's work: grouping costs what a table's does, and totalling
  is the rows once for each series. Nothing measured what 200 categories
  cost, or that 201 is too many. `MAX_TICK_INTERVALS` and `SHARE_PLACES`
  are chosen too.
- **Nothing prints a chart yet.** The renderer refuses a report that would
  print one, a preview as a final render, until it draws charts.

**What it forecloses.** Nothing that cannot be undone: the format is a
draft's. An axis an author sets, shares rounded to add up and a colour
cycle would each be another record's.

## Alternatives considered

**Ticks from a double's `Math.log10`.** That is the usual way to find a
step, and it is not exact. Under Node 22.23.3,
`Math.log10(999999999999999999)` is 18, where the span's exponent is 17,
since the double nearest that integer is 10^18. And `10^30 + 1` is the
double `1e30`. A total past 2^53 would be ticked by a value it is not,
and its ticks need not be multiples of a step the format prints. The
digits of a span's units give its exponent exactly.

**An axis always from zero, for lines too.** One rule for both kinds. But
a line of 10,000 to 12,000 would then be ticked 0 to 15,000 and drawn in a
band of less than a seventh of its box, nearly flat. Ticked from its own
range, 10,000 to 12,000 by 500, its rise is the chart. A bar starts at
zero, because a bar's length is its value. `chart-ticks.test.ts` holds
both axes of those values.

**Refusing a null category instead of a label.** No row would be printed
under a word nobody chose. But a formancy form's optional answer is null
wherever it was not given, and a chart grouped by one would refuse every
report over its submissions. 0052 asks for the label, and the runtime
prints the rows under it.

**A pie's colours cycled past its palette.** A pie of any number of
categories would print. Two slices of one colour are told apart by
nothing, and a legend that names both would name one colour twice.

**The ticks left to the renderer's library.** A charting library chooses
its own axis, and labels it. But its ticks are a double's, and its labels
its own formatting, so a chart could print a number the table does not,
in a format the report did not ask for. The runtime chooses the axis and
prints every tick, and the library is handed them.

**Shares rounded to add up to 100 %, by the largest remainder.** The
legend would sum. But one slice's share would then depend on its
neighbours, so a share would change when another category's value did,
and a reader who divides a value by the whole would get another share
than the one printed.

**A pie of all zeros checked before a negative value.** It is the order
the steps are written in. But values that cancel, +5 and -5, would print
as a pie with nothing to draw and hide the negative one.
