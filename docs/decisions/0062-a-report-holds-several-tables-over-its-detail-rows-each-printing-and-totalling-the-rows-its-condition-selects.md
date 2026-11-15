# 0062 — A report holds several tables over its detail rows, each printing and totalling the rows its condition selects

- **Status:** accepted; numbered while 0053 to 0061 were held by branches
  not yet merged; extends
  [0007](0007-a-report-definition-is-its-own-versioned-document.md), whose
  one table over the detail dataset becomes several, each with a condition
  of its own, and whose expression names gain `table`;
  [0009](0009-an-expression-is-checked-and-bound-member-by-member.md),
  which binds `table` member by member and types `group.key` by the table
  a group stands in;
  [0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md),
  whose runtime selects, orders, groups and totals each table's rows; and
  [0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md),
  whose e-invoice holds its report to one table, which selects every row
- **Date:** 2026-11-15
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The format.** report-spec's `src/validate-tables.test.ts` holds each
    rule where it is written:
    - two tables over the detail rows, each with its own columns, sort
      keys, group and total rows, read back whole and part of what the
      hash names, and a third in a section of the summary;
    - `rowsWhen` read back and hashed, and an empty one refused as
      `empty-expression`;
    - `MAX_TABLES` tables accepted, and one more refused as `too-many` at
      its own path;
    - a total taken `over: 'table'` accepted in a table's total rows and
      in its group's header and footer, and refused in a paragraph and in
      a cell as `misplaced-table-aggregate`; a detail field in a total row
      still refused as `misplaced-detail-field`.

    `src/validate.test.ts`'s `second-detail-table` case now refuses a
    second table in a report that is an e-invoice, beside the same report
    without its e-invoice, which is valid; its `misplaced-table-aggregate`
    case refuses a table's total in a paragraph beside the same total in
    the table's total row. `src/validate-e-invoice.test.ts` refuses the
    lines' table that selects its rows, as `invalid-e-invoice` at
    `/eInvoice/lines/table`. `src/validate-placement.test.ts` pins
    `EXPRESSION_NAMES` with the `table` scope and `group` reading `table`.
  - **The editing core.** report-core's `src/diagnostics/parts.test.ts`
    names a table's condition as an expression of the row's scope, a
    condition owned by the table, and its total rows as of the table's
    scope. `src/expressions/compile-report.test.ts` compiles a condition
    that reads the row, a parameter, the header and the totals, refuses one
    that reads `group` or `table` as `expression-out-of-scope` and one that
    gives no boolean, compiles `table.<id>` in a total row and a group's
    footer and refuses it in a cell, and types `group.key` in each of two
    tables by the field that table groups by. `src/commands/readers.test.ts`
    removes a table whose condition reads a removed field, whole, and keeps
    the other table, and `fieldReaders` names the condition among the
    expressions a change of the field's type reaches.
    `src/diagnostics/tables.test.ts` warns of a total row, in a table that
    selects its rows, that prints a total over every detail row, and says
    nothing of the same row in a table that selects none, or of an
    expression that reads the table's total beside the report's.
    `src/commands/components.test.ts` duplicates a table into a second one
    the validator accepts.
  - **The runtime.** report-runtime's `src/lower-table.test.ts`: a table
    prints the rows its condition selects, in its own order and its own
    groups, its total rows totalling them as `table` and every row as
    `totals`; a table without a condition binds `table` to the report's
    totals, the very values; a table whose condition selects no row prints
    its empty text and the totals of nothing; a condition that gives null
    is refused as `not-a-condition`, naming the row by its index in the
    data; a preview whose data lacks a field the condition reads leaves
    those rows out, warned once. `src/sort-group.test.ts` orders the
    selected rows, each keeping its index in the data.
  - **On the PDF.** report-render-pdf's `src/several-tables.test.ts`
    resolves a report of three tables over one detail dataset, renders it,
    and proves on the PDF read back with PDF.js
    ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)):
    each table prints its own rows and no other under its header, in its
    order and its groups; each subtotal and total is the sum of the rows
    printed above it; the summary's total is every row's; and the table
    that selects no row prints its empty text and a total of 0.
  - **A form review.** report-forms' `src/review.test.ts` blocks a version
    that removes a field a table's condition reads, and the removal it
    offers takes that table and keeps the other.
  - **The builders.** report-builder-core's `src/palette.test.ts` offers
    Table where a report already holds one, and finds it no place in a
    report that is an e-invoice; `src/properties.test.ts` gives a table
    its condition's field; and `BUILDER_SCENARIOS`
    (`src/scenario-tables.ts`) inserts a second table from the keyboard,
    gives it a condition and undoes both, which React's
    `src/scenarios.test.tsx` and Angular's `src/scenarios.test.ts` run,
    with axe over the end of it.
  - **The install gate.** `scripts/install-fixture/consume.ts` holds the
    packed validator to refusing a table past `MAX_TABLES`, where it held
    it to refusing a second.

## Context

A report prints one list of rows. The reports people make with it often
print the same rows twice or in parts: an order's goods and its services,
each under its own heading, with its own columns and its own subtotal; a
statement's open items apart from its settled ones; a summary of the
larger lines before the full list. Version 0 could not say any of it.
What it had ([0007](0007-a-report-definition-is-its-own-versioned-document.md)):

- **One table.** A table is "the table over the report's one detail
  dataset", `dataset: 'detail'` (`table.ts`), with one level of grouping,
  and a second is refused as `second-detail-table` (`validate-table.ts`).
  The format knows two dataset roles, `header` and `detail`
  (`DATASET_ROLES`), and the runtime's data is one header record and one
  detail list.
- **Every row.** The table prints every detail row it is given, ordered
  and grouped by `sort-group.ts`, which orders and groups and never
  filters. A component's condition, and a column's, is read once per
  report, so it shows or hides a whole table or a whole column, never a
  row.
- **Totals over every row, or over a group.** An aggregate is declared
  once and printed by id, over the current group in a group's header and
  footer (`group.<id>`, `over: 'group'`) and over every detail row
  everywhere else (`totals.<id>`, `over: 'report'`), the table's total
  rows included, which are read in the report's scope.
- **An e-invoice's lines are that table's rows.** The XML holds one line
  per detail row, in the table's order, read from the columns the table
  prints (0027), and the validator finds the lines' table as the report's
  first, since there was one.
- **Charts read every detail row**
  ([0052](0052-a-report-draws-a-bar-line-or-pie-chart-of-its-detail-rows-each-series-a-total-of-one-field-per-category.md)),
  and so do a QR-bill's and an EPC QR code's amounts, through `totals`.

The roadmap's third item asks for more than one dataset: a second detail
dataset, a subreport and a detail nested in a detail. This record takes
the part of it that the one detail dataset can already answer -- several
tables over its rows, each selecting them by a condition -- and leaves the
datasets to a record of their own. What a report's totals read once it
holds several tables, and which table an e-invoice's lines are held to,
had to be decided first: two tables that print parts of the same rows,
each with a total, are two places a total can disagree with the rows above
it.

## Decision

**A report may hold more than one table over its detail dataset, each
printing the detail rows its own condition selects, ordered, grouped and
totalled as its own; `totals` stays every detail row's.**

**Where a table stands.** Every table stands where a table may stand
now: in the body and the summary, and in a section there, never in a
columns or a keep-together block (`nested-flow-component`). A report holds
at most `MAX_TABLES` tables, eight, counted in every region and every
container; the ninth is refused as `too-many` at its own path. The bound
is chosen, not measured: each table orders the rows it selects, which no
step budget counts, and reads its condition once per detail row, which
the render's budget does; a report of more lists than eight is several
reports. What eight tables cost at `MAX_DETAIL_ROWS` is measured where
the runtime selects the rows, and written beside the constant.

**The condition.** A table's `rowsWhen`, optional, is an expression:
- **read once per detail row, in the row's scope**, the scope a column's
  value and its style rules are read in: it reads `params`, `header`,
  `totals` and `row`, so `row.kind == "service"` and
  `row.due < params.asOf` each select rows, and a row may be compared
  with a total of every row. It reads neither `group`, since groups are
  made of the rows it selects, nor `table`, which is totalled from them:
  report-core refuses either as `expression-out-of-scope`;
- **a condition**, compiled as `visibleWhen` is, which gives a boolean: one
  that gives null in a render is refused as `not-a-condition`, naming the
  row, as every condition is;
- **read before the table orders its rows**, in the provider's order, so
  what a row is selected by never depends on where it prints;
- **absent, every row.** A table without one prints every detail row, as
  every table does now.

Its name follows the format's conditions, `visibleWhen` and `styleWhen`:
it says when a row is the table's.

**What a table does with its rows.** Its sort keys order the rows it
selected, its group groups them, and its empty text prints where it
selected none, its total rows still printed beneath, a count and a sum of
nothing 0 and the rest nothing (0007). A group is made of the table's rows
alone, so a group's `group.<id>` is already over the rows that table
prints, and `group.key` is the key of the table the group stands in,
typed by the field that table groups by. Each table keeps its own
columns, header, styles and footers; nothing is shared between two tables
but the rows they read.

**A table's totals are its own, read as `table`.**
- **A scope of its own.** A table's total rows are read in the `table`
  scope (`VALUE_SCOPES`), which binds what the report's scope binds and
  `table`: each aggregate, by id, over the rows the table prints. A
  group's header and footer read `table` too, so a group's share of its
  table is `divide(group.net * dec("100"), table.net, 1)`. An aggregate
  run takes `over: 'table'` (`AGGREGATE_SCOPES`) in those rows alone, and
  is refused anywhere else as `misplaced-table-aggregate`, as one over a
  group is outside a group's rows.
- **The aggregates, not new ones.** `table.<id>` is the report's declared
  aggregate `<id>`, computed by the very function, over the table's rows'
  values, read once per render (`Totals.over`), and rounded once, as a
  group's is. A table without a condition is over every detail row, and
  its `table` is the report's totals themselves, not a second computation
  of them, so `table.net` and `totals.net` are one value there and an
  existing table's totals print exactly as they did.
- **`totals` is every detail row's, everywhere**, under a table that
  selects its rows as anywhere else: the summary's grand total, a
  QR-bill's amount, an EPC QR code's, an e-invoice's and a chart's series
  read every row whatever the tables select.
- **A total of every row under a table of some rows is said.** report-core
  warns, as `total-of-every-row`, of a total row in a table that selects
  its rows that prints a total over every detail row -- an aggregate run
  `over: 'report'`, or an expression that reads `totals` and not `table`
  -- since printed under those rows it reads as theirs. A warning renders
  as written: a grand total under a part of the rows, labelled as one, is
  a line an author may mean.

**A report that is an e-invoice holds one table, which selects every
row.** Its lines are every detail row, in the table's order, and the XML,
its totals and the page's `totals` are computed from them (0027). So in
such a report a second table is refused as `second-detail-table`, at the
second table's path, and a condition on the lines' table as
`invalid-e-invoice`, at `/eInvoice/lines/table`, as a lines' table that
may be hidden is: every line the XML holds is printed, once. The code is
kept,
its rule narrowed: a host that read `second-detail-table` reads it now
only of an e-invoice, and a report with two tables that 0.2.0 refused is
valid.

**What the editing core knows of it.**
- **The condition is an expression of the table's.** `READERS.table`
  (`diagnostics/parts.ts`) names `rowsWhen` in the row's scope as a
  condition owned by the table, and the table's total rows in the `table`
  scope, so the diagnostics compile it, `unusedDiagnostics` counts what
  it reads, and `fieldReaders`, `removeFieldWithReaders` and a form review
  ([0048](0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md))
  find it.
- **A removed field takes the table its condition reads it in, whole**, as
  a component goes whose condition reads it: a table that printed every
  row once its condition went would be a table nobody wrote, its totals
  every row's.
- **`table` is read where `totals` and `group` are.** An aggregate read as
  `table.<id>` is used, and goes with a removed field that it totals; the
  names an aggregate is read under are one list in the core
  (`AGGREGATE_NAMES`, `expressions/reads.ts`), read by `unused.ts` and
  `readers.ts` both.
- **A group's key is its table's.** `compileReport`'s `members.group`
  holds the aggregates alone, and `members.groupKeys` the key of each
  table that groups, by the table's id; a group's header and footer are
  compiled with their own table's (`groupOf`, `members.ts`). A field a
  table groups by reaches, in `fieldReaders`, the reads of that table's
  key and no other table's.
- **One message understates.** `row` read where there is no row is
  refused as having "a value only in a table's cells and what an aggregate
  reads from each row", the words of before: a table's condition reads it
  too, and the message does not say so, since a README picture's caption
  quotes it and is retaken only with the Studio's pictures.
- **No command of its own.** A table's condition changes through
  `updateComponent`, as its empty text does; a further table comes in by
  `insertComponent` or `duplicateComponent`, and the session's validation
  refuses either in a report that is an e-invoice.

**How both builders add a further table and edit its condition.** Each
adds one as it adds any component, from the palette by pointer or by the
place chooser, and as a duplicate of a table it holds: the palette's Table
is offered wherever the validator accepts one, which is now wherever a
table may stand but in a report that is an e-invoice, where the chooser
finds no place. A table's properties gain one field, the condition, an
expression edited as a component's condition is (builder-core's
`KIND_FIELDS.table`), named "Print rows only when" in English and in the
editor's other languages, so neither builder holds a line of its own for
it. A scenario of `BUILDER_SCENARIOS` holds both builders to it.

**What does not change.** One detail dataset, one level of grouping per
table, and the renderer, which already draws any number of tables, each
from the rows the runtime gives it. `generateReport` writes one table, as
it did ([0045](0045-a-report-generated-from-a-formancy-form-is-a-deterministic-first-draft-and-what-it-left-out-is-listed.md)).

**A draft-format addition.** `reportSpecVersion` is unchanged, and so is
every report that was valid and every PDF one prints. A release that
predates it, 0.2.0 among them, refuses a report with a second table as
`second-detail-table`, a table with a condition as `unknown-property`,
and a total over a table as `not-one-of`.

## Consequences

**What it buys.**
- **Several lists from one dataset.** Goods and services, open and settled
  items, the largest lines and all of them: each a table with its own
  columns, order, groups and totals, from the rows the provider gave once.
- **A total agrees with the rows above it.** A table's subtotals and
  totals are over the rows it prints, by the function and the rounding
  every total has, so two tables over parts of one dataset never print a
  total of rows neither shows, and a total of every row printed under one
  of them is said where it is written.
- **Nothing that printed prints otherwise.** A report without a condition
  holds tables over every row, whose `table` is the report's totals, and
  every name an expression read is read as it was.
- **One decision, one place.** The condition is read in the runtime's
  table lowering, the order and the groups decided by `sort-group.ts`, the
  totals by `Totals.over`; the e-invoice's lines still read every row,
  because its table may not select.

**What it costs.**
- **One dataset still.** Two lists from two sources -- an order's lines
  and its payments -- a subreport and a detail nested in a detail cannot
  be printed; they are the rest of the roadmap's item and another record's.
- **A table's own total prints inside it alone.** `table` is bound in its
  total rows and its group's header and footer. A paragraph or the
  summary cannot print one table's total; an aggregate whose expression is
  null outside the selection can, writing the condition a second time,
  and nothing holds the two to each other.
- **No share of the table in a cell.** A cell reads `totals`, every row's;
  `table` is not bound in the row's scope, because the condition and every
  aggregate's row value are read there and `table` is totalled from them.
  A row's share of its table cannot be printed, its share of every row
  can.
- **A table that selects nothing still prints.** It prints its empty text
  and its totals. Its own condition, `visibleWhen`, is read in the report's
  scope, where `table` is not bound, so it cannot hide itself by its own
  count without an aggregate that repeats its condition.
- **`totals` under a table of some rows is every row's.** The warning says
  so of a total row; nothing says it of a group's header or footer, where
  a group's share of every row is a line an author means more often.
- **More work per table.** Each table orders the rows it selects and reads
  its condition once per detail row. The conditions count against the
  render's step budget, so a report of several conditioned tables over many
  rows may be refused at the budget where one table would have printed;
  the ordering counts against nothing but `MAX_TABLES`, which is chosen.
- **A preview may print fewer rows.** Where a preview's data lacks a field
  a condition reads, the condition does not hold, as a component's does
  not, and those rows are left out of that table, said once in a warning.
- **A chart reads every row.** Beside a table that selects its rows, a
  chart shows totals the table does not; a chart of one table's rows is
  not decided here, and the chart's runtime is not changed by this record.
- **An e-invoice holds one table, of every row.** An invoice cannot print
  a breakdown of its lines in a second table, nor leave lines off its
  page: what the page prints of the lines is what the XML holds, once.
- **A narrowed code.** `second-detail-table` refuses less than it did. A
  host that offered "a report holds one table" from that code now meets
  it only for an e-invoice, and a report with two tables that it stored
  as refused is valid.
- **A new scope.** A table's total rows are read in `table`, not in the
  report's scope. They read everything they read before, but a tool that
  walked a report's expressions by scope finds one more.
- **0.2.0 refuses such a report whole**, as `second-detail-table`,
  `unknown-property` or `not-one-of`: a report saved with a second table,
  a condition or a table's total opens only in a release that has them.

**What it forecloses.** Nothing that cannot be undone: the format is a
draft's. A selection declared once and named by several tables and
aggregates could stand beside `rowsWhen` or replace it; `table` read in a
cell would need a scope of its own for cells.

## Alternatives considered

**Aggregates that carry their own condition.** An aggregate with a
`rowsWhen` of its own would total the service rows anywhere, the summary
included. But the table's condition and its total's would be written
twice, and the day they part, the table prints rows that its total is not
of, and nothing finds out. A scope of the table's rows writes the
condition once.

**A selection declared once, named by tables and aggregates.** A report
declares `services` as a condition, a table prints the rows of `services`
and an aggregate totals them, printable anywhere. It keeps one condition and
lifts the cost that a table's total prints inside it alone. It is a new
kind of declaration, a reference from two places, and a question this
record need not answer yet -- what a group's total over another table's
selection is. It can come later beside `rowsWhen`, which a builder edits
as it edits every condition now.

**`totals` read as the table's rows in its total rows.** One name, and an
existing table's totals unchanged. But `totals.net` would be two values in
one report by where it stands, the summary's and the table's, and a total
row moved, copied or reviewed would change what it prints without a word.

**A table's condition as a field's value, `{ field, equals }`.** A
builder could offer a picker, and the validator check the field's type.
But an amount above a threshold, a date before a parameter and two fields
together would each need a vocabulary of their own; an expression is
what every other condition here is, compiled by the one compiler (0009).

**A second table in an e-invoice, naming its lines' table.** `lines.table`
names a table already. But a second table would print a subtotal of some
lines, or the lines again, that the XML does not hold, and a page that
shows the invoice otherwise than its XML is what 0027 keeps out, under
§ 14c UStG. Refusing it keeps the lines' table the report's one, and
lets the validator go on finding it as the first.

**The lines' table selecting its rows, the XML holding those.** An
invoice of some of the rows given. But the page's `totals`, the QR-bill's
amount and the e-invoice's totals would then be of different rows, or the
e-invoice's would need a scope of their own; the data is the invoice's.

**No bound but the region's components.** `MAX_REGION_COMPONENTS` bounds
tables at five hundred a region, and each orders every detail row again,
work the step budget does not count. Eight is a bound a report reaches by
meaning to.

**`where` or `filter` for the condition's name.** Both say it, and
neither is how this format names a condition, which ends in `When`
(`visibleWhen`, `styleWhen`).
