# @formancy/report-core

Formancy Report's editing core: pure commands over a `ReportDefinition`, a
session that holds one document with exact undo and redo, where a component
may be put, and the compilation of every expression that the editor's
diagnostics and the runtime both use. No framework, no PDF engine, no Node.
Why edits are commands and a refused edit changes nothing is decision
[0008](../../docs/decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md);
how an expression is checked and bound is
[0009](../../docs/decisions/0009-an-expression-is-checked-and-bound-member-by-member.md).

## A session

```ts
import { emptyReport } from '@formancy/report-spec'
import { diagnose, insertComponent, nextComponentId, openReportSession, putStyle, setTitle } from '@formancy/report-core'

const opening = openReportSession(emptyReport('site-visit', 'Site visit', 'de-CH'))
if (!opening.ok) throw new Error(opening.errors.map((error) => error.message).join('; '))
const session = opening.session

// One notification per change, synchronously. document() is the same frozen
// object until the next change, so React's useSyncExternalStore and Angular's
// signals can compare it by identity.
const unsubscribe = session.subscribe(() => console.log(session.revision()))

session.apply((report) => setTitle(report, 'Site visit, Zürich'), { label: 'Rename' })

// A command checks its own preconditions; the session validates the result.
// This text names a style the report does not declare, so the edit is refused
// with the validator's errors, and nothing changed: not the document, not the
// revision, and no listener was called.
const id = nextComponentId(session.document(), 'text')
const heading = { id, kind: 'text', style: 'strong', content: [{ kind: 'text', text: 'Findings' }] } as const
const outcome = session.apply((report) => insertComponent(report, { region: 'body', index: 0 }, heading))
// outcome: { ok: false, code: 'invalid-document', errors: [{ code: 'unknown-style', ... }] }

// Several commands as one undo step, validated once at the end.
session.transaction('Add heading', (draft) => {
  draft.apply((report) => putStyle(report, 'strong', { bold: true }))
  draft.apply((report) => insertComponent(report, { region: 'body', index: 0 }, heading))
})

session.undoLabel() // 'Add heading'
session.undo() // the very snapshot that was there before
session.redo()

diagnose(session.document()) // [] -- or the errors and warnings an editor lists
unsubscribe()
```

## Commands

Every command is a pure function `(report, ...args) => CommandOutcome`: the
next report, or a refusal with a stable code (`REFUSAL_CODES`) and a message.
A command never writes to the report it is given, and refuses rather than
clamps when what it names is not there:

- **the document:** `setTitle`, `setLocale`, `setPage`, `replaceDocument`;
- **declarations:** `putStyle`, `removeStyle`, `putDataset`, `removeDataset`,
  `putField`, `removeField`, `putParameter`, `removeParameter`,
  `moveParameter`, `addAsset`, `putAsset`, `removeAsset`, `putAggregate`,
  `removeAggregate`. A put replaces the declaration with that id where it
  stands, or appends it; it cannot rename. `addAsset` only appends, and
  refuses an id the report already declares as `already-declared`: a
  builder names an image a person adds, a host keeps its bytes under that
  id, and only then is it declared, so a put under an id the report came
  to declare meanwhile would swap another image for it, unseen.
  `nextAssetId(report, base, handed)` names it: `base`, or `base-2`,
  `base-3`, by the rule a new component's id is made by, counting asset
  ids alone and the ids in `handed`, those a builder has handed a host
  already; a base that ends in a number is numbered as it stands, since
  it is a file's name (`img-4711` taken gives `img-4711-2`);
- **components:** `insertComponent`, `removeComponent`, `moveComponent`,
  `updateComponent` (a patch typed per kind; the id and kind never change),
  `duplicateComponent` (fresh ids for the copy and all it holds), and
  `nextComponentId`, which also names a new component after its kind:
  `pageBreak` gives `page-break`, `qrCode` gives `qr-code`, `epcQrCode`
  gives `epc-qr-code`;
- **the table:** `insertColumn`, `removeColumn` (with its footer cells),
  `moveColumn`, `updateColumn`, `setGroup`, `setSort`, and the footer rows
  under the table and under each group, row by row and cell by cell;
- **the payment part**, the report's Swiss QR-bill: `putPaymentPart` (the
  bill whole, added or in place of one), `updatePaymentPart` (a patch of
  its properties, never its kind) and `removePaymentPart`, which judge
  nothing of the bill: SIX's rules are report-spec's, which the session
  asks
  ([0039](../../docs/decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md));
- **the e-invoice**, of either kind: `putEInvoice`, `updateEInvoice` (a
  patch of its terms, never its kind) and `removeEInvoice`, which judge
  nothing of it; and `setPaymentAccount(report, account)`, which writes
  the account, as typed, into the e-invoice's BT-84, its QR-bill's account
  and every EPC QR code's IBAN in one edit, since the validator holds each
  code to BT-84 and refuses a change of any one alone. It is refused as
  `not-found` without an e-invoice or an account, and as
  `read-from-data`, naming the place, where one of them reads its account
  from the data, which it would write over -- a builder's field writes its
  own account then; whether each place takes the account is the
  validator's to say, each by its own rule, and no BIC is changed
  ([0044](../../docs/decisions/0044-a-person-edits-a-reports-e-invoice-in-either-builder-one-term-a-field-in-groups.md)).
- **a field with what reads it:** `removeFieldWithReaders(report, role, id)`
  removes the field and every component, column, footer cell, sort key,
  group and aggregate that reads it, and every reader of such an
  aggregate in turn; a style rule that reads it goes alone, what it
  styled kept; a footer row left with no cell goes whole, and so does a
  table every column of which goes, and what stands in a component that
  goes goes with it, once. What reads a
  field is what the diagnostics find, from one walk, and in an
  expression what the parser the compiler asks says it reads (an
  expression that does not parse reads nothing). The outcome lists what
  went, as JSON Pointers into the report before it, in `removed`. A field
  the payment part or the e-invoice reads, directly or through an
  aggregate, is refused as `read-by-part`: their own commands change them.
  It is what a review of a form version offers where the version removed
  a field. `fieldReaders(report)` makes that walk and reads every
  expression once, for a review that asks of many fields: its
  `removal(role, id)` is the command's, and its `expressions(role, id)`
  the expressions a change of the field's type, or of whether it may be
  null, reaches -- each that reads it, each that reads an aggregate that
  does, in turn, and, for a field a table is grouped by, each that reads
  the group's key
  ([0048](../../docs/decisions/0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md));
- **several as one:** `batch(report, steps)` runs command descriptors one
  after the other as one command -- a transaction written down, so that an
  edit of several commands travels as data: one undo step, one
  notification, validated once at its end, and refused whole with the
  first refusal, word for word, nothing after it run. A step that is no
  descriptor, or a batch itself, is refused as `invalid-arguments`, and so
  is a batch of more than `MAX_BATCH_COMMANDS` (1,000) commands, before any
  of it runs; and so is a step that throws on the report the steps before
  it left, which no validator has seen (0048).

`PART_COMMANDS` names the commands that may change each part of the report's
own level -- the payment part's three, the e-invoice's three,
`setPaymentAccount` for both, and `replaceDocument` and `batch` for both,
whose document, or whose steps, may hold another part than the one it
replaces -- and every other command keeps each as it was: the very object,
through every edit. A review that looks for a change of whom a bill or an
e-invoice is paid by finds it by these names, and compares the part whole
for a replacement. An edit that would leave an e-invoice's line with no
column to print it, or with a column that may be hidden, is refused with the
validator's reason, and so is an edit of one payment code's account alone in
a report with an e-invoice, which pays BT-84: `setPaymentAccount` changes
them together.

A patch removes an optional property with `null`, and `setGroup` and `setSort`
remove theirs with `null`, never with `undefined`: a proposal carries its
operations as JSON, which has no undefined.

A location is a region, or a container and, for a columns block, a column,
and an index: where the component ends up. An index outside the list is
refused, so a keyboard move and a pointer drop agree.

`COMMANDS` holds every command by name, and a `CommandDescriptor` --
`{ command, args }` -- is one as data, for a proposal or a review's
resolution; a `StepDescriptor` is any of them but a batch, what a batch
holds. A descriptor read from
JSON was never type-checked, so `describedCommand` checks its arguments
against `ARGUMENTS` and refuses too few, too many or the wrong type with
`invalid-arguments`. A descriptor never throws, whatever it holds. A typed
call to a command can pass none of these.

## Where a component may go

- `locationOf(report, id)` is where a component stands, as the location a
  move to it takes: the start of a keyboard move, the place to put focus
  after a deletion.
- `locations(report)` is every place a component could be put, in reading
  order.
- `validLocations(report, componentOrId)` is the places the validator
  accepts it in: a page counter only in the page header and footer, a table
  never inside columns.

The validator decides what may stand where (0007), so `validLocations` asks
it, place by place, rather than copying its rules. It validates the whole
report once per place, so a builder asks it when a drag starts, not on every
pointer move.

## The session

`openReportSession` takes anything and never throws on it: a document the
validator refuses gives `{ ok: false, errors }`. The session:

- commits only what the validator accepts, and holds the validator's copy,
  deeply frozen. An edit that changes nothing commits nothing;
- keeps every component, column and declaration an edit did not change as the
  same object, matched by id within its list, so an insert, a remove or a
  move within a list leaves the others as they were. A component moved into
  another list is a new object;
- keeps `DEFAULT_HISTORY_LIMIT` (200) undo steps unless told otherwise,
  dropping the oldest, with a label for each;
- refuses an edit, a transaction or a replacement whose `expectedHash` is not
  the current document's `hash()`, so a proposal written against an older
  document cannot overwrite what was edited since;
- runs a transaction's callback synchronously. An async callback does not
  compile, and a promise returned anyway is refused with a `TypeError` before
  anything commits;
- throws when a command it is running, or a transaction's callback, edits the
  session itself;
- calls every listener even when one throws, then throws that error, or an
  `AggregateError`, from the call that made the change. The change has been
  made.

`tryEdit(report, run)` runs a transaction's commands against any report and
gives the verdict a commit would get, without committing anything: what a
proposal's review shows before Apply.

## Expressions and diagnostics

`compileReport(report)` compiles every expression where it stands, with
`@formancy/expressions`, the compiler the runtime uses; `compileReport(report,
only)` the expressions at the pointers `only` holds alone, with every
aggregate's, which what they read is computed from -- what a review asks
of a change to one field's type (0048). It gives:

- the programs, keyed by the JSON Pointer to each expression;
- what each program reads;
- the members each name holds, typed;
- the order to compute the aggregates in;
- its errors.

An expression in a QR code's content is compiled as one in a paragraph in
its place is: in the report's scope, its diagnostics naming the code. An
EPC QR code's texts are read the same way, in the order its payload holds
them, and named after the code. A payment part's texts are read the same
way too, in the report's scope, and its diagnostics name no component,
only the path: the bill stands in none. A payment code's amount, a
QR-bill's or an EPC QR code's, is compiled as a value that must give a
decimal or null, by one rule for both. One that may be null is checked as
`dyn`, which may be either, and the render checks what it holds. An integer
or a string is a type error, with `dec()` as the hint.

An e-invoice ([0027](../../docs/decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)) is read as a payment part is: its texts in the
report's scope, named by their paths alone. Its dates and its paid amount
are values there, and the codes of each line -- its identifier, its unit
and its VAT category -- are values in each row's scope, as what an
aggregate reads from a row. Each is held to the term the XML writes it as:

- a date is a text, as a date field is read;
- the paid amount is a decimal;
- an identifier is a text or an integer, and a unit or a category a text.

The four columns that print a line's name, quantity, net price and net
amount are held to their terms too, wherever they compute one: a text for
the name, an integer or a decimal for the others. Each type comes from
report-spec's tables, which the validator holds a field to.

In a report that is an e-invoice, and in no other, every place that reads
`totals` also reads the totals the runtime computes once for the page and
the XML:

- `invoice.lineTotal`, `taxBasisTotal`, `taxTotal`, `grandTotal` and
  `duePayable`, each a decimal, never null;
- `invoice.paid`, where a paid amount is declared, null where it may be;
- `vatBasis.<id>` and `vatAmount.<id>` for each declared category, null
  when no line is in it.

They are not read where they are computed from, which would be a circle
no render could close: an aggregate's expression, the e-invoice's own, and
the columns that print a line. A read there is `expression-unknown-name`,
as one in any other report is.

`diagnose(report)` lists those errors, then the warnings. The runtime refuses
a report with an error, so the editor and the runtime cannot disagree about
one.

- **Errors:** syntax, limits, types, policy (a condition that is not a
  boolean), a name or member nothing declares, `row` or `group` where there is
  none, an image field read as a value, a name read whole (`size(params)`),
  a call to `now()`, `today()` or `random()`, an aggregate whose expression
  gives what its function cannot total, and aggregates that read their own
  total. And what would make a printed number inexact or a render unbounded:
  a double -- a literal such as `100.0`, or `double()` -- and a division with
  `/`, which on integers drops the remainder (`divide(dec(a), dec(b), places)`
  is the exact one), and a call to `matches()`, whose pattern no step budget
  bounds. Each comes with the component, the table column where it is in
  one, and the position in its source. Two more are about totals: a rounding
  declared on an aggregate that computes an integer, a date or an instant,
  and a number format that prints a rounded total at fewer places than its
  rounding keeps, which would round it twice. And one is about an
  e-invoice: a total its XML holds that no text or table of the page
  prints (`e-invoice-total-unprinted`). Each of these is held: the total
  without VAT, `invoice.taxBasisTotal` or `invoice.lineTotal`; the VAT
  total; the total with VAT; and each declared category's basis and amount.
  The paid amount and the amount due are held too where a paid amount is
  declared. And one prints what the XML holds otherwise
  (`e-invoice-format-differs`): a run that reads a total, or the column of
  a line's net amount, at fewer than two places or in another currency
  than the e-invoice's, named as a code; the column of a net price in
  another currency; the column of an item's name in upper or lower case.
  A quantity's and a price's places are the data's, and the runtime holds
  them row by row.
- **Warnings:** an unused style, asset, parameter, field or aggregate, an
  empty body, a text that prints nothing, and a QR-bill that holds SIX's
  examples, written in the report: an account of report-spec's
  `QR_BILL_EXAMPLE_ACCOUNTS`, which pays no creditor, or the creditor, the
  debtor or the QR reference a builder puts in, report-spec's
  `QR_BILL_EXAMPLE` (`example-payment-part`, one warning on `/paymentPart`
  naming each term that is an example).

Every member read is checked as its type. `@formancy/expressions` 0.12.0,
as 0.5.0 to 0.7.0 and 0.11.0 before it, declares a variable only by its whole name, so each read of `row.amount` is
spliced, by upstream's own `rewritePath`, into a read of `row_amount`, a
variable declared as a decimal. An exact value is used as what it is,
`row.amount * dec("1.081")`, and `dec(row.amount)` is a type error. A member
that may be null is checked as `dyn`, since CEL has no nullable scalars.

`expressionValues(compiled, data)` is the value bag a program is evaluated
with. It takes the data as the format writes it (an integer and a decimal as
their exact strings, an instant with its zone) and makes each member what it
was compiled as. It throws a `TypeError` that names the member, and never
quotes the value, for one missing or of another type.

What this does not do:

- **Positions after an index read.** Where a read is written as an index,
  `row["amount"]`, the text checked is shorter than the author's, so a
  compiler error after it has no position. The diagnostic still names the
  expression and the component.
- **Equality on a decimal that may be null.** Upstream refuses `==` between a
  decimal and a `dyn`, so it cannot be written directly; ordering works.
- **`has()` on a member.** Every member is bound, null when it has no value,
  so `!= null` is the way to ask.
- **Layout.** Whether a keep-together block fits a page, a column its width,
  or a QR code's content its square, is the renderer's to say.
- **A payment code's values.** Whether an amount has two decimals at
  most, and whether what a field puts in a QR-bill or an EPC QR code is an
  IBAN, a reference or a name its rules allow, depends on the data. The
  runtime checks them with `@formancy/report-spec`'s rules, the ones the
  validator applies to a literal.
- **An e-invoice's values.** A date is held to be a text, not to be a
  date: `header.customer` passes where `params.copies` does not. Whether
  each text is a calendar date, an amount a whole number of cents, or a
  line's category one the e-invoice declares, the runtime checks with the
  same rules, once the data has resolved it.
- **What a page prints beside a total.** `e-invoice-total-unprinted` and
  `e-invoice-format-differs` are the template's, not the data's: a run
  behind a condition counts as printing what it reads, a run that reads a
  total counts whatever it computes from it, and every declared category
  is held, since which ones the lines use is known only at render. A
  condition, a style rule, a QR code and a payment code's amount print
  nothing.

Source-available, not open source: see [`LICENSE.md`](../../LICENSE.md).
