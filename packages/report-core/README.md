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
  `moveParameter`, `putAsset`, `removeAsset`, `putAggregate`,
  `removeAggregate`. A put replaces the declaration with that id where it
  stands, or appends it; it cannot rename;
- **components:** `insertComponent`, `removeComponent`, `moveComponent`,
  `updateComponent` (a patch typed per kind; the id and kind never change),
  `duplicateComponent` (fresh ids for the copy and all it holds), and
  `nextComponentId`, which also names a new component after its kind:
  `pageBreak` gives `page-break`;
- **the table:** `insertColumn`, `removeColumn` (with its footer cells),
  `moveColumn`, `updateColumn`, `setGroup`, `setSort`, and the footer rows
  under the table and under each group, row by row and cell by cell.

A patch removes an optional property with `null`, and `setGroup` and `setSort`
remove theirs with `null`, never with `undefined`: a proposal carries its
operations as JSON, which has no undefined.

A location is a region, or a container and, for a columns block, a column,
and an index: where the component ends up. An index outside the list is
refused, so a keyboard move and a pointer drop agree.

`COMMANDS` holds every command by name, and a `CommandDescriptor` --
`{ command, args }` -- is one as data, for a proposal. A descriptor read from
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
`@formancy/expressions`, the compiler the runtime uses. It gives:

- the programs, keyed by the JSON Pointer to each expression;
- what each program reads;
- the members each name holds, typed;
- the order to compute the aggregates in;
- its errors.

`diagnose(report)` lists those errors, then the warnings. The runtime refuses
a report with an error, so the editor and the runtime cannot disagree about
one.

- **Errors:** syntax, limits, types, policy (a condition that is not a
  boolean), a name or member nothing declares, `row` or `group` where there is
  none, an image field read as a value, a name read whole (`size(params)`),
  a call to `now()`, `today()` or `random()`, an aggregate whose expression
  gives what its function cannot total, and aggregates that read their own
  total. Each comes with the component, the table column where it is in one,
  and the position in its source.
- **Warnings:** an unused style, asset, parameter, field or aggregate, an
  empty body, a text that prints nothing.

Every member read is checked as its type. `@formancy/expressions` 0.5.0
declares a variable only by its whole name, so each read of `row.amount` is
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
- **Layout.** Whether a keep-together block fits a page, or a column its
  width, is the renderer's to say.

Source-available, not open source: see [`LICENSE.md`](../../LICENSE.md).
