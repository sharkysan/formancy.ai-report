# 0009 — An expression is checked and bound member by member, by one compilation the editor and the runtime share

- **Status:** accepted; extended by [0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md), which binds an e-invoice's totals member by member, in a report that is one and in no other
- **Date:** 2026-10-15
- **Deciders:** Daniel Bacher
- **Verified by:** the tests of `@formancy/report-core`, run by its
  `test:coverage` job in CI:
  - `expressions/compile-report.test.ts` evaluates every expression of a
    report that holds every expression site, through upstream's `evaluate`,
    with the values `expressionValues` binds from data written as the format
    writes it. It also checks five of the results. It holds the aggregate
    order, and the circles left out of it.
  - `expressions/members.test.ts` holds the type each member is checked and
    bound as, and that every name `EXPRESSION_NAMES` binds has its members.
  - `expressions/values.test.ts` holds each conversion, and the refusal of a
    value missing or of another type, never quoting it.
  - `diagnostics/diagnose.test.ts` holds one case per diagnostic code, typed
    over the codes, each breaking one thing in a report that diagnoses
    clean. It holds what typing every member decides: a decimal against a
    decimal, an integer against a decimal, `dec()` of a decimal, a boolean
    that may be null as a condition. It also holds the positions.
  - `expressions/spans.test.ts` and `expressions/reproducible.test.ts` hold
    where a read is, and which calls are the clock's.

  On 15 October 2026 each rule below was reverted on its own, with one suite
  run per revert. Each revert failed at least one test, and each file was
  byte-identical afterwards:
  - checking members as their types rather than as `dyn`;
  - refusing the clock;
  - refusing an image field read as a value;
  - refusing a name read whole;
  - dropping a position past an index read;
  - ordering aggregates by what they read;
  - checking what an aggregate's function takes;
  - converting a value to its member's type;
  - one span per read.

## Context

0007 makes the expression environment part of the format: an expression
reads `params`, `header` and `totals` everywhere, `row` in a cell and in what
an aggregate reads from each row, and `group` in a group's header and footer.
It leaves whether an expression reads only those to "when the runtime
compiles it", and the runtime is not built yet. The editor reports the same
errors as the runtime earlier, while the author types (plan 15's first two
levels). Several things shaped how:

- **The compiler is upstream's.** `@formancy/expressions` 0.5.0 (formancy.ai)
  parses, type-checks, compiles and evaluates CEL, with exact decimals and
  budgets. 0002 forbids a copy, and 0007 refuses a second parser.
- **It declares a variable only by its whole name.** A declaration of
  `row.amount` is a variable with a dot in its name, which an expression
  reading `row.amount` never finds ("Unknown variable: row"). The first
  version declared each scope name as a `map`, as formancy declares a group.
  To the checker every member was then `dyn`:
  - `params.copies + "x"` passed, an integer added to a string;
  - `row.amount < dec("0")` passed and `row.amount == dec("1")` did not,
    though both compare a decimal with a decimal;
  - a boolean parameter alone was refused as a condition.
- **The binding was undefined.** Upstream converts a value only for a
  variable declared at the top level and never null: an int from a number, a
  decimal from a string, a timestamp from a zoned string. A member of a map
  is passed through as it is. So `dec(row.amount)` needed the amount bound as
  a string, `row.amount < dec("0")` needed it bound as a decimal, and the
  editor passed both.
- **Exact values travel as strings with their type** (0007;
  formancy.ai-data 0008): an integer and a decimal as their exact digits.
- **A report renders the same from the same data** (plan 15). Upstream
  allows `now()` and `today()` in every kind of expression and `random()` in
  a computed one, because a form captures them with its submission. A
  report has nothing to capture them in.
- **Aggregates can read totals.** The row scope binds `totals`, so an
  aggregate's expression can read another aggregate -- a share of the whole
  -- or itself.

## Decision

`compileReport(report)` compiles every expression where it stands, and both
the editor's diagnostics and the runtime use it. The runtime:
- refuses a report it gives an error for;
- evaluates the programs it gives;
- binds each program's values with `expressionValues`;
- computes the aggregates in the order it gives.

**Every member read is checked as its type.**
- Each read of a member -- `row.amount` -- is spliced by upstream's own
  `rewritePath`, which verifies each splice by parsing the result again, into
  a read of one variable, `row_amount`. That variable is declared with the
  member's type, or as `dyn` when the member may be null: CEL has no
  nullable scalars.
- The flat name is as long as the read written plainly, so a position the
  compiler gives is a position in what the author wrote. Where a read is
  written longer -- `row["amount"]`, `row . amount` -- a position past it is
  left out rather than given wrong.
- Each expression is compiled with only the members it reads, so the runtime
  binds those and no others.

**The types.**
- An integer is `int`, a decimal `decimal`, a boolean `bool` and a string a
  `string`.
- A date and a date-time are their ISO strings: neither has a zone, and
  upstream refuses to guess one.
- An instant is a `timestamp`.
- An image field is not readable: it is drawn, never computed with (0007).
- A count is an `int` and an average a `decimal`. A sum, a minimum or a
  maximum is the type it totals: a field's, or what its expression gives.
- An aggregate's expression must give what its function takes:
  - a sum or an average, integers or decimals;
  - a minimum or a maximum, those, instants, or dates as strings;
  - a count, anything.

**What an expression may read.**
- A name its scope binds, and each member by its id: a name read whole --
  `size(params)`, `row[key]` -- is an error, since nothing can say which
  member it reads, and nothing binds the whole.
- A member that exists: one nothing declares, or a member of a member, is an
  error. Every member is a single value.
- Nothing that differs between renders: a call to `now()`, `today()` or
  `random()` is an error. Upstream offers no way to ask which functions an
  expression calls. So each place one of those names stands as a whole word
  is renamed, at the same length, to a function that does not exist. Where
  the compiler then refuses an unknown function (`no_matching_overload`) at
  exactly that place, the expression called the clock there.

**One binding.** `expressionValues` takes the data as the format writes it
and makes each member what it was compiled as:
- an integer from its exact digits to a `bigint`;
- a decimal from its exact digits to upstream's `Decimal`;
- an instant from an ISO 8601 date-time with its zone to a `Date`;
- the rest as they are.

A value missing, null where the member never is, or of another type throws.
The message names the member and never quotes the value: the runtime
validates a dataset first, so such a value is a defect, and the data is the
customer's.

**Aggregates in order.** Aggregates are computed so that each comes after
every aggregate its expression reads. One that reads itself, directly or
through others, or reads such an aggregate, has no place in the order and
is an error at the read that closes the circle.

## Consequences

**What it buys.**
- **The editor refuses what the runtime would.** One compilation, one set of
  declarations and one binding, so the two cannot disagree about an
  expression; `now()`, a member nobody declared and a sum of strings are
  refused in both, from the same code.
- **Real type checking of members.** `params.copies + "x"` is an error where
  the author types it, `row.amount < dec("0")` and `dec("0") > row.amount`
  are both fine, and a boolean parameter is a condition.
- **A value of the type it was checked as.** An amount is a decimal when the
  expression runs, wherever it is read, and an integer is never a double.
- **Errors where they are.** Each read of an unknown member is underlined on
  its own, with the component and, in a table, the column.
- **A defined aggregate order**, the runtime's to follow rather than to work
  out again.

**What it costs.**
- **An expression is written against types.** `dec(row.amount)` is now a
  type error: 0.5.0 has no `dec(decimal)`, and the amount already is one.
  Expressions written for the map declarations need rewriting, and
  report-spec's own fixture is one such text. It is carried there and never
  compiled.
- **Nullable decimals lose `==`.** Upstream refuses `==` between a decimal
  and a `dyn` (`decimal_equality_mismatch`), and a decimal that may be null
  is checked as `dyn`. Ordering against a decimal works; equality has to be
  written as two orderings.
- **`has()` on a member is refused.** Every member is bound, null when empty,
  so `!= null` asks the question instead.
- **Positions after an index read are lost**, as above.
- **The splice and the clock probe are workarounds.** Both rest on upstream's
  behaviour, and tests pin each:
  - the error code it gives an unknown function;
  - `rewritePath`'s exact splice and its refusal when a comprehension's
    variable would capture a read.

  A typed member declaration, or a way to ask which functions an expression
  calls, belongs upstream (0002); with either, the matching workaround goes.
- **Every keystroke compiles every expression**, each with a splice and a
  parse per member it reads. Not measured; R04 brings the benchmark.
- **The binding is in the core**, not the runtime that will call it, because
  it is half of the contract the diagnostics check.

**What it forecloses.** Reading a whole name. A future "every parameter"
needs its own declaration, not `params` read whole.

**Added 2026-10-15: `group.key`.** 0007 now gives a group its key, and this
record's rules take it as they take any member. `compileReport` declares
`group.key` with the type the field grouped by is read as -- `dyn` where that
field may be null -- and only when the report's table groups; `expressionValues`
binds it like a field of that type. So `" " + group.key` passes in a group
header over a string field and `group.key + 1` is an `expression-type` error
there. `members.test.ts` holds the declaration, for a group and for a table
without one; `diagnose.test.ts` holds the check; `compile-report.test.ts`
evaluates a group header that reads it.

**Added 2026-10-15: what an expression may not compute with.** The runtime's
review found two ways a printed number could be inexact with no diagnostic,
and one call whose time no budget bounds. Upstream hands an integer and a
double back alike, as a JavaScript number, so `int(double("4.35") * 100.0)`
printed 434 as an exact integer, and `3 / 2` printed 1, a rounding nobody
declared; `"aaa…b".matches("^(a+)+$")` took 39 seconds inside one step of
the budget. So the compiled source is now asked, as the clock is
(`expressions/exactness.ts`), for every double literal, every `double()`,
every `/` and every `matches()`, each an error where it is written:
`expression-inexact`, with `dec("…")` or `divide(dec(a), dec(b), places)`
as the hint, and `expression-unbounded`. A remainder, `%`, is exact and
allowed. `exactness.test.ts` holds what is found and what only looks like
it -- a string, a comment, the type named `double`; `diagnose.test.ts`
holds the diagnostics. Two more diagnostics come with the runtime's
rounding rules (0010): `rounding-not-decimal` for a rounding declared on an
integer, date or instant total, which every render refused while the
editor said nothing, and `format-rounds-again` for a number format that
prints a rounded total at fewer places than its rounding keeps.

**Added 2026-10-17: an e-invoice's totals.** In a report that carries an
e-invoice ([0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)),
`compileReport` declares `invoice`, `vatBasis` and `vatAmount` member by
member, as it declares `totals`: each document total a decimal, never
null; `invoice.paid` only where a paid amount is declared, read as the
paid amount's expression gives it, and as `dyn` where that expression does
not compile, so that its fault is said once; and `vatBasis.<id>` and
`vatAmount.<id>` for each declared category, which may be null. In any
other report the three hold nothing, and a read of one is
`expression-unknown-name`. Nor are they read where they are computed from
-- an aggregate's expression, the e-invoice's own, the columns that print
a line -- which would be a circle no render closes. The e-invoice's dates,
its paid amount, its line codes and the named columns are each held to
the type their business term is written as, by report-spec's tables, as
`expression-type`. And `e-invoice-total-unprinted`, an error, says when a
total the XML holds is printed by no text or table, and
`e-invoice-format-differs`, an error, when a run that reads one, or a
column that prints a line, shows it otherwise than the XML holds it: at
fewer than two places, in another currency, a name in another case. The
runtime binds the very totals it writes into the XML (0010).
`expressions/e-invoice.test.ts` holds the members and where they are
refused, and `diagnostics/e-invoice.test.ts` the totals a page must print
and how.

## Alternatives considered

**Declare each name as a `map`**, the first version. Rejected: every member
is `dyn` to the checker, so the diagnostics miss the type errors that matter
in a report -- money against an integer, a string against a number -- and
refuse correct ones. A map's members are also passed to the expression
unconverted, so no single binding makes every expression the editor passes
run.

**Declare a member that may be null with its type.** Rejected: upstream
refuses null for a variable declared as a scalar when it binds it, so a
nullable field could not be bound at all.

**A second parser or checker here**, typing member reads itself. Rejected by
0007's reasoning: a second place to disagree with the compiler the runtime
uses.

**Patch upstream's environment here** to declare dotted names. Rejected by
0002: a generic improvement goes upstream through its own rules, and is used
once released.

**Leave the clock to a kind's policy.** No kind of 0.5.0 forbids `now()`,
and `computed` allows `random()`. Rejected until upstream has such a kind.

**Let the runtime work out the aggregate order.** Rejected: the editor would
then not know whether a report it passes can be computed, and the two would
order it separately.
