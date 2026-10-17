# 1. Introduction and goals

## What Formancy Report is

A module that designs and renders paginated PDF reports inside an Angular or
React application built on [formancy](https://github.com/sharkysan/formancy.ai).
An author lays a report out in a native builder; the report is saved in a
versioned format of its own; a host resolves it against the data it is
allowed to show and gets a PDF back, or every reason there is none.

The pieces, each a package:

- a **report format**, validated whole and hashed
  ([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)),
  with the rules of the two payment codes a report can print: SIX's for a
  Swiss QR-bill, and the EPC's for an EPC QR code, which a banking app
  initiates a SEPA credit transfer from
  ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md),
  [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md));
- an **editing core**: commands, a session with exact undo, and one
  compilation of every expression
  ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md),
  [0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md));
- a **runtime** that resolves a report against its data into a document no
  engine has decided anything about
  ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md));
- a **renderer** that draws that document with pdfmake, in Node and in a
  browser, and refuses what it cannot draw whole
  ([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md),
  [0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md));
- a **provider** that reads a report's data from Formancy Data 0.1.0,
  best-effort
  ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md));
- an **editor model** with a **React builder** and an **Angular builder** over
  it, native in each framework, over one session
  ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)).

Around them: the Studio, a playground with both builders and the real PDF
on one page, online at formancy.ai/report/; the product's pages beside it;
and a private corpus of adversarial reports, with the checks that prove a
rendered PDF against them. [Building blocks](05-building-blocks.md) has each.

## What it is not

- **Not open source.** It is source-available: free to read, evaluate,
  develop and test, paid to run in production, and a separate agreement to
  redistribute ([0001](../decisions/0001-a-paid-module-in-its-own-repository.md)).
  The Apache-2.0 packages it builds on stay Apache-2.0, and none of their
  code is here ([0002](../decisions/0002-depend-on-upstream-never-copy-it.md)).
- **Not a form.** A report has pages, regions repeated on every page, a
  table that flows across pages, groups and declared totals, none of which a
  formancy form models. It is its own document with its own version line,
  and the form spec is never widened to hold it
  ([0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md),
  [0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md)).
- **Not a server.** Nothing here stores a report, schedules a job, or
  decides who may see what. A host does all three, and hands the packages
  the data and the asset bytes it has already authorised.

## What this describes

`main`, which can be ahead of the latest release. What is released and what
is only on `main` is the README's *Status* paragraph, which is dated; what
each release held is [the changelog](../../CHANGELOG.md).

Planned and not built, as the README says: the server and its jobs,
reviewed AI changes, a published PDF viewer, and a consistent read from
Formancy Data. Each later release gate is open in
[`gates.json`](../release/gates.json) with the reason. Nothing below
describes them as though they existed.

## Quality goals

| Goal | What it means concretely |
|---|---|
| **Whole and exact, or refused** | A PDF holds every row once, in order, with nothing cut; a total is computed exactly and rounded once, as declared; a value never passes through a JavaScript number. What cannot be drawn whole is refused with a reason, never returned in part ([0003](../decisions/0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md), [0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md), [0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)) |
| **The editor and the runtime read a report alike** | One validator, one compilation of each expression, one reading of SIX's rules and one of the EPC's, each called from both sides, so the two cannot disagree about an expression or a literal ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md), [0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md), [0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)). What only a render measures — a glyph, a word's width, the pages, a page header reaching into a QR-bill's slip — an EPC QR code whose data makes its payload too long, and a nullable integer as a payment code's amount are refused at render, not in the editor (0022, 0025) |
| **Fail closed** | A version, a kind or a property a reader does not know is refused whole, never skipped ([0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md), [formancy.ai 0022](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0022-fail-open-fail-closed.md)) |
| **Untrusted input stays input** | Templates, expressions, data, fonts and images are read without running anything, bounded, and never followed to an address ([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md), [0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| **Native in both frameworks, reachable by keyboard and by name** | Two builders written natively over one model, held to each other by shared scenarios and by their accessible trees ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) |
| **Licensable** | Every production dependency and every font file a published package ships allows public source and licensed production use, as its licence identifier and the font's name table say; what the guard cannot see, and what holds it instead, is [§8.7](08-crosscutting-concepts.md#87-licences) ([0006](../decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)) |

**These are not ranked.** No record orders them, and this document does not
invent an order. Where two have met, the record that met them says which
gave way. [0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)
draws a QR code's dark modules as one path, because a rectangle per run
left light lines across the code, though the path costs more: drawn by
pdfmake alone, a version 40 code at each of the four levels added 72.2 to
73.6 kB as a path and 34.2 to 35.2 kB as rectangles, and took 101 to 147 ms
against 36 to 58 ms, on 17 October 2026 on one machine.
[0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)
refuses a word too wide for its table cell rather than break a number in
two. [0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)
refuses a whole report over one lookup label the person may not see, rather
than print the report without it.

## Stakeholders

| Stakeholder | What they need from the architecture |
|---|---|
| **Report author** | An error where it is typed, not at render time; a builder in their framework, in English, German or French |
| **Integrator** (a host's developer) | Packages that install into a plain project and resolve there; a session the host owns; nothing in a package that fetches, reads configuration or decides identity |
| **Operator** | A production licence, and a Formancy Data licence too when the provider runs ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)); known costs before they are met ([`limitations.json`](../release/limitations.json)) |
| **The reader of a PDF** | Every row, a correct total, a QR-bill a bank will pay, and an EPC QR code that asks a banking app for the account and the amount the page prints |
| **Customer or evaluator** | The reasoning and what the module refuses to do with their data and documents: the [decision records](../decisions/README.md) and the release report |
| **Contributor** | Why the obvious simpler thing was not done, and the bar a change meets: the records and [`CLAUDE.md`](../../CLAUDE.md) |
