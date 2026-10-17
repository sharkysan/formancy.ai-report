# 0010 — The runtime resolves a report into a renderer-neutral document, exactly, or refuses it

- **Status:** accepted; extended by [0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), which resolves a QR-bill and refuses one SIX's rules refuse, in a preview too, by [0025](0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md), which writes an EPC QR code's payload and refuses one the EPC's rules refuse, and by [0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md), which computes an e-invoice's totals once for the page and its XML, writes the XML, and refuses one EN 16931's rules refuse
- **Date:** 2026-10-15
- **Deciders:** Daniel Bacher
- **Verified by:** the tests of `@formancy/report-runtime`, run by its
  `test:coverage` job in CI, one file per stage:
  - **The data contract.** `values.test.ts` holds each type's rule: a
    decimal sent as a JavaScript number refused (`decimal-as-number`), a
    decimal with more places than its field's scale refused, an integer
    past 2^53 sent as a number refused, dates on the calendar from the
    year 0001, instants converted to UTC. `data.test.ts` holds an
    undeclared field refused, missing told apart from null, a final render
    refusing incomplete data and a captured count that disagrees, and the
    bounds. `input.test.ts` holds that nothing of the host's objects is
    run: a getter, a throwing proxy, a length that is not a whole number.
    `parameters.test.ts` holds the same rules for parameters.
  - **Exact totals.** `decimal.test.ts` holds the sums, averages and both
    rounding modes against a BigInt reference and upstream's
    `roundDecimal`; `totals.test.ts` holds each aggregate exact, rounded
    once, per group and for the report, and a rounding on a total with no
    places refused.
  - **Formatting.** `format.test.ts` holds every digit of an exact decimal
    printed, display rounding half away from zero, a date printed as its own
    day in every zone, a locale or zone the engine lacks refused, and a
    number Intl would print as infinity refused.
  - **Order, expressions and the document.** `sort-group.test.ts`,
    `evaluate.test.ts`, `resolve.test.ts`, `lower.test.ts` and
    `lower-table.test.ts`.
  - **The editor refuses what the runtime would**, in report-core's
    `diagnostics/diagnose.test.ts` and `expressions/exactness.test.ts`: a
    double, a division, `matches()`, a rounding on an integer, a format
    that rounds a total again.
  - **End to end**, `@formancy/report-render-pdf`'s `starters.test.ts`
    resolves the starters and proves the PDFs they print, totals
    recomputed apart from the runtime in plain BigInt.

  On 15 October 2026 each rule added after review -- the year 0000, the
  proxy's length, one copy of an asset, the asset limit, the bound on
  printed digits, a number that is not a safe integer, the four new
  diagnostics -- was reverted on its own, and its tests failed; the files
  were byte-identical afterwards.

## Context

Plan section 23.4 puts `@formancy/report-runtime` in the first release:
typed datasets, restricted expressions, one grouping level, exact aggregates
with declared rounding, and a document no engine has decided anything
about. Decision [0007](0007-a-report-definition-is-its-own-versioned-document.md)
fixed what a report declares; [0009](0009-an-expression-is-checked-and-bound-member-by-member.md)
how its expressions are compiled and bound; [0005](0005-pdfmake-renders-reports-behind-one-adapter.md)
that pdfmake draws what the runtime hands it. The forces:

- **Exact values** travel as strings with their type and never through a
  JavaScript number (formancy.ai-data 0008). Plan 15: a total formatted
  as currency from a float is still wrong, and calculation precision is not
  display precision.
- **Data is untrusted**, even from the host's own provider, and a report
  must not carry what it does not print (plan 18).
- **Never silently drop or truncate** (0003). A missing binding must not
  become an empty string in a production report (plan 15).
- **A preview runs on samples** and must never be mistaken for the report
  (plan 13.2).
- **One decision, one place** (CLAUDE.md): grouping, aggregates, rounding
  and formatting are decided once, here, never again in a renderer, a
  builder or the server.

## Decision

`resolveReport(report, data, options)` returns a `ResolvedDocument`, a
manifest of what it was resolved from and the warnings of a preview; or
every reason it was refused, from whichever stage found it. Never part of a
document.

- **The report.** Validated again (it arrives as untrusted input), its
  expressions compiled once by report-core, and refused for any error the
  editor's diagnostics give.
- **The data contract** (`checkData`). One header record and one detail
  list, each value held to its field's type before anything reads it:
  - integers as strings of digits, or JavaScript numbers that are safe
    integers; decimals only as canonical strings within the field's scale,
    never as numbers; dates as calendar days from 0001 to 9999; date-times
    as written; instants converted to UTC; an image as an approved
    asset's id and digest, never an address;
  - **a field the report does not declare is refused**: data minimisation,
    so nothing the report was not written to read rides into a render, a
    cache or a log;
  - **missing is not null.** Null prints as nothing. A field the data lacks
    is an error in a final render, and in a preview one warning per field;
  - a final render refuses data the provider calls incomplete, and a
    captured count that differs from the rows given;
  - bounded before it is read: 100,000 detail rows, a string's length,
    a list's length that must be a whole number, the error list.
- **Expressions** evaluate with fixed capabilities, within 20,000 steps
  each and 5,000,000 a render, and a failure names the component, the
  column or the aggregate, and the row, never a value.
- **Exact totals.** Integers as BigInt, decimals as upstream's `Decimal`.
  A declared rounding is applied once, to the exact total: to each group's
  and to the report's apart, so rounded subtotals need not add up to the
  rounded total. The editor refuses a rounding on a total that has no
  places, and a number format that shows a rounded total at fewer places
  than its rounding keeps, which would round it twice.
- **Formatting** (`createFormatter`). Intl is handed the exact digits,
  already rounded half away from zero to the places shown, and never a
  double. A locale or time zone the engine lacks is refused, not replaced.
  A date, and a date and time without a zone, print their own fields in
  UTC, so a date is the same day wherever the report renders; only an
  instant is shown in the zone the host names. A number of more than 308
  integer digits, which Intl would print as '∞', is refused.
- **Order.** Rows by the group key, then the sort keys, each compared as
  its type: decimals by value, text by the report locale's collation,
  nulls last, ties in the provider's order.
- **Final and preview.** A preview prints nothing for what the data lacks,
  says so once per field, labels every page header as a preview of
  incomplete data, and records `completeness.complete: false` in its
  manifest. A final render refuses all of it.
- **Images** come through the host's lookup, by id and digest, once per
  render: every image that draws an asset shares one copy, which the
  renderer embeds once. An answer past 20 MB (`MAX_ASSET_BYTES`, which the
  renderer reads too) is refused before it is copied.
- **The document** names no engine: every value is the string that prints,
  every length a point, every style resolved.

## Consequences

**What it buys.**
- **A renderer that decides nothing about values.** pdfmake draws strings
  it is handed; a total cannot be rounded or formatted twice in two
  places, because there is one place.
- **Errors the editor can show before a render.** What the runtime refuses
  for a report alone -- a double, a division, a rounding with no places --
  the diagnostics refuse while the author edits.
- **A preview that cannot pass for the report**, on every page and in the
  manifest.

**What it costs.**
- **CEL as authors write it elsewhere.** `x / 2`, a double literal and
  `double()` are errors, because a JavaScript number cannot be told from an
  exact integer once upstream hands it back: `int(double("4.35") * 100.0)`
  printed 434 as though it were exact, and `3 / 2` printed 1. An author
  writes `divide(dec(a), dec(b), places)` and `dec("…")`. A remainder,
  `%`, stays: it is exact. `matches()` is refused until upstream offers a
  pattern engine whose time a budget bounds; one pattern took 39 seconds
  in one resolve.
- **Each expression compiled twice per render**: `diagnose` does not hand
  back its compilation.
- **ICU decides the characters.** Grouping marks, currency symbols and
  month names are the engine's ICU's; the same report can print
  differently on two engines. Node 24.21's ICU 78.3 groups de-CH with an
  ASCII apostrophe, and fr-FR with a narrow no-break space, which the
  renderer's font has no glyph for, so it refuses such an amount (0011).
- **The budget is one machine's.** Five million steps were measured
  through `condition()`, binding included, at 1.00 to 1.30 microseconds a
  step on an Intel i9-10900K under Node 24.21 on 15 October 2026: about
  5 to 6.5 seconds. An earlier figure, from upstream's `evaluate` alone,
  missed the binding and put ten million at 8.5 seconds.
- **Digests are trusted.** The runtime has no hash function under ES2023
  without Node or the DOM, so it does not check an image's bytes against
  their digest; the host's lookup is trusted to return what the digest
  pins.
- **An expression cannot read an image field**, not even to ask whether it
  is null (0009). A report that shows a heading only above a photo needs a
  field that says whether one was taken, as the inspection starter has.
- **The preview label is English**, whatever the report's locale.

**What it forecloses.**
- **Floats anywhere in a printed value**, and a renderer that formats,
  rounds or totals.
- **Truncating to fit**: a capped capture is a preview, never a final
  report.

**Added 2026-10-17: a QR-bill.** The document gains `paymentPart`, a
`QrBill` beside the body and never a block of it, as [0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md) decides: the
Swiss QR Code's payload and every text the slip prints, its headings in
the slip's language and its values grouped as SIX prints them, so that the
renderer formats nothing. Its texts are read as a paragraph's in the
report's scope, then held to report-spec's QR-bill rules, as
`invalid-qr-bill`. Two of this record's rules have an exception there:
- **Null.** A null run in a bill's text refuses a final render, as in a
  QR code's content
  ([0020](0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)).
- **Preview.** A value a preview lacks prints as nothing there too, but a
  preview whose bill then breaks one of SIX's rules is refused, saying it
  lacked the value: the code would scan as a bill no bank pays.

Its amount is a decimal or null, written from its own digits and never
rounded: one with a third decimal is refused, so the rounding stays where
the total is computed, once. `lower-payment-part.test.ts` and
`qr-bill.test.ts` hold it.

**Added 2026-10-17: an EPC QR code.** The document gains an `epcQrCode`
block, as [0025](0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)
decides: the code's id, its square, its caption when asked for, and the
payload the EPC defines, written by the runtime from the code's texts, so
that the renderer formats nothing. Each text is read as a paragraph's,
then held to report-spec's EPC rules, as `invalid-epc-qr-code`. Its amount
is a decimal or null, written from its own digits as short as it can be,
and never rounded. The QR-bill's two exceptions to this record's rules
hold for it: a null run that cuts a text short refuses a final render,
and a preview whose code then lacks a text the EPC requires is refused.
And one of its own: an optional text the data gives empty, blank or null
leaves its element unused, in a final render as in a preview, where a
blank literal one is refused by the validator.
`lower-epc-qr-code.test.ts` holds it.

**Added 2026-10-17: an e-invoice.** The document gains `eInvoice`, the
file a PDF embeds, as [0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)
decides: the CII XML of a Factur-X invoice, which the runtime writes, and
the name, the relationship and the conformance level report-spec gives it,
so that the renderer decides none of them. Two of this record's rules
gain a stage between them. **The totals are computed once**: after the
table's named columns are read, once a row, and before anything that
reads a total is lowered, `e-invoice-totals.ts` computes EN 16931's
totals and VAT breakdown in `Decimal`, each category's VAT rounded once,
half away from zero, and binds them as `invoice`, `vatBasis` and
`vatAmount`; the table prints the very value read for the XML, and the
XML is written from the very totals the page reads. **A preview is
labelled always**: a preview of an e-invoice writes no XML and warns
`e-invoice-preview`, so every page carries a label, complete data or not,
`E_INVOICE_PREVIEW_LABEL` where nothing else is lacking and
`PREVIEW_LABEL` where data is. Each text, date and line term is held to
report-spec's EN 16931 rules once the data has resolved it, as
`invalid-e-invoice`, never quoting the value; a table of no rows is
refused in a final render, and a QR-bill or an EPC QR code printed with
it asks for the amount due and the e-invoice's account. A line's net
amount and a paid amount are whole cents, never rounded. The XML has no
bound of its own: `MAX_DETAIL_ROWS` bounds it, and 0027 records what that
costs. `e-invoice-totals.test.ts`, `e-invoice-lines.test.ts`,
`e-invoice-terms.test.ts`, `lower-e-invoice.test.ts` and `cii.test.ts`
hold it.

## Alternatives considered

**Convert decimals through `Number` where they are small.** Rejected:
formancy.ai-data 0008, and plan 15. A value that happens to fit a double
today is one digit away from one that does not.

**Ignore undeclared fields.** Rejected: the host would send data the report
never prints, and it would reach every log and cache a render touches.

**Let the formatter round, and drop declared rounding.** Rejected: plan 15
separates calculation precision from display precision, and Swiss cash
rounding to 0.05 is a calculation, not a display.

**Allow integer division and document that it truncates.** Rejected: a
rounding nobody declared, printed as an exact value. The rule that a total
is rounded once, by its declared rule, would have an exception in every
cell.

**Bind integers past 2^53 as refused.** Rejected for 0009's reason:
comparisons past 2^53 work, and only a result too large to hand back fails,
naming the row.
