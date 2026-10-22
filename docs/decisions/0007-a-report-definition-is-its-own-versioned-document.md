# 0007 — A report definition is its own versioned document, with a flowing body, one detail table, declared aggregates and print styles as tokens

- **Status:** accepted; extended by [0020](0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md), which adds the QR code, by [0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), which adds a payment part, by [0025](0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md), which adds the EPC QR code, by [0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md), which adds an e-invoice and the names its totals are read by, by [0030](0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md), which adds an SVG asset in the one form report-spec's `cleanSvg` writes, and by [0042](0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md), whose dataset contract says where a formancy form's submission holds each field
- **Date:** 2026-10-15
- **Deciders:** Daniel Bacher
- **Verified by:** the `@formancy/report-spec` tests that fail when it is
  violated. On 15 October 2026 each rule that structural validation enforces
  was reverted on its own, one suite run per revert, and each revert failed
  at least one test. The sources were compared with a copy afterwards and
  were identical. The tests are:
  - `validate.test.ts` holds one refusal per error code, each beside the
    nearest edit that stays valid. The table is typed over
    `REPORT_ERROR_CODES`, so a code without a case does not compile.
  - `validate-placement.test.ts` holds where things stand. It places each
    flow-only component in every region and each page counter in every
    region and table row. It covers:
    - a table or page break inside columns, keep-together blocks and
      sections;
    - detail fields and group aggregates in every scope;
    - every fixed size against the printable area;
    - the names an expression reads.
  - `validate-bindings.test.ts` holds types meeting:
    - each format over every field type;
    - each aggregate function over every field type;
    - currencies and images taken from the data;
    - sort and group keys.
  - `validate-declarations.test.ts` holds ids, keys, defaults, list bounds,
    provenance and the 0.01 pt grid.
  - `validate-input.test.ts` holds hostile input. It refuses getters without
    running them, proxies that throw, a length that answers differently
    when asked again, array holes, `__proto__` keys, property names past
    their bound and values JSON cannot hold. It also puts odd values at
    every position of a valid report and checks that no message or path
    echoes them, and validates a string at V8's maximum length.
  - `hash.test.ts` pins the hash of a fixed report that holds non-ASCII
    text, booleans and arrays of objects, computed with `@formancy/spec`'s
    `schemaHash` outside this package. It also refuses to hash a report the
    validator refuses.
  - `version.test.ts` holds the version check.

  That the body has no absolute coordinates is held by the strict shapes:
  no component has a position property, and an unknown property is refused.
  That the format is not a renderer's input format is held by review;
  nothing mechanical could tell.

  What the format defines for the runtime is held by nothing here yet:
  - that null prints as nothing;
  - what each aggregate is over no values;
  - that rows with equal keys keep the provider's order;
  - that an expression reads exactly the names `EXPRESSION_NAMES` lists.

  The names are pinned by a test, so changing them fails here. The runtime's
  tests are what will hold the rest.

## Context

A report needs things a form does not model: a page size and margins,
regions that repeat on every page, a table that flows across pages with its
header repeated, one level of grouping with subtotals, totals computed
exactly with a declared rounding, print styles and approved images.

The formancy form spec models data entry: fields, logic and layouts. Its
pages are navigation, not physical pages (plan 12.2). It is at `specVersion`
1 to 4, and Formancy Data 0.1.0 emits 3.
[0002](0002-depend-on-upstream-never-copy-it.md) already forecloses widening
it to hold report pages, and plan 12.1 says why: a report is a separate
document with its own `reportSpecVersion`, page settings, print styles,
versioned asset references, dataset contracts, typed parameters, components
with stable ids, typed expressions, declared rounding and provenance.

Other forces when this was decided:

- **Layout (plan 9).** The plan asks for a hybrid: a flowing body, so a
  growing table pushes what follows down, and positioned elements only
  inside bounded header and footer regions. It warns against making the
  first version an unrestricted set of overlapping absolute coordinates, and
  asks for an actionable error when content exceeds the printable area.
- **Scope (plan 10).** Version 1 has one primary detail dataset plus header
  metadata, one grouping level per detail table, and conditions: visibility
  and basic style rules.
- **The three starters (plan 7).** Each has to be expressible:
  - a service or inspection report, with photographs and a signature taken
    on the visit and a section that shows only when there are defects;
  - a quotation, with a subtotal, a tax line and a total in a currency;
  - a grouped list, in a stable order.
- **Printed design (plan 11.4).** Typography, colours and spacing in the PDF
  are explicit, serialisable report tokens. CSS from the editor or the host
  never changes a customer's printed output.
- **Assets (plan 17).** Rendering a published version never follows a
  mutable "latest logo"; updating an asset is a new template release.
- **Forms and expressions upstream.** A formancy field key is letters,
  digits and underscores (`fieldKey` in `formancy.schema.json`), and it is
  the variable name a CEL expression reads. Form fields can hold files and
  signatures, and a parameter form is a formancy form (plan 12.4).
- **No engine yet.** The renderer experiment (R02) has not chosen an engine.
  The format must not depend on its result.
- **Untrusted templates.** Templates are untrusted even when an
  administrator wrote them, and fail closed
  ([formancy.ai 0022](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0022-fail-open-fail-closed.md)).
  A template names things -- datasets, assets, parameters -- and never gives
  an address
  ([formancy.ai 0077](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0077-options-may-come-from-a-named-source.md)).
- **Exact values.** Decimals and large integers travel as strings with their
  type, never through a JavaScript number (formancy.ai-data 0008).

## Decision

`@formancy/report-spec` defines `ReportDefinition` at `reportSpecVersion`
`'0'`, the draft. Nothing written under it is promised to be read by a later
release.

**Four conventions hold throughout,** so that one editor command, one
binding picker and one walk serve the whole format:
- every shape that comes in kinds says which with `kind`;
- every declaration is a list of objects with an `id` unique in its list:
  styles, dataset fields, parameters, assets, aggregates;
- every reference to a dataset field is a `FieldRef`, `{ dataset, field }`;
- a name an expression reads -- a field, a parameter, an aggregate -- is a
  field key exactly as formancy writes one. Every other id -- a component,
  style, dataset, asset or table column -- is lower-case letters, digits
  and hyphens, as formancy writes a named source.

**The document.**
- **Identity.** An id, a title and a BCP 47 locale (language, optional
  script, optional region).
- **Page.** A4 or Letter, portrait or landscape, and margins in PDF points
  that leave at least an inch either way. Every length and font size is on
  the hundredth of a point; a finer one is refused, not rounded, so one
  layout has one stored value and one hash. Millimetres are converted once,
  in `units.ts`.
- **Five regions:** report header, page header, body, page footer and
  summary, each an ordered list of components. **Version 0 is flow only**:
  there are no absolute coordinates anywhere. Positioned elements in the
  page header and footer, which plan 9 allows, are deferred.
- **Components:** text, image, line, rectangle, spacer, columns (two to
  four), section, table, page break and keep-together.
  - A **section** groups components and adds no layout: one condition shows
    or hides them all, and a border, a fill and padding can frame them.
  - Tables, page breaks and keep-together blocks stand only in the body and
    the summary. A table or a page break is part of the flow: it may stand
    in a section, never inside columns or a keep-together block.
  - Page counters stand only in the page header and footer. Containers nest
    at most four deep.
  - A fixed size larger than the printable area -- an image, a rectangle, a
    spacer, the fixed widths of a table or a columns block -- is refused.
    What fits inside a container is the layout's question.

**Data.**
- **One detail dataset, one table over it, one grouping level.** A report
  declares at most a header dataset and a detail dataset, each a contract of
  typed fields that records the revision of the contract the template was
  written against.
- **Where a value has one.** A detail field has a value only in the table's
  cells. In a group header or footer the one detail field with a single
  value is the field grouped by. Everywhere else is report scope.
- **The expression environment is part of the format.** An expression reads
  `params`, `header` and `totals` everywhere, `row` in a cell and `group`
  in a group's header and footer (`EXPRESSION_NAMES`). Whether it reads
  only those is checked when the runtime compiles it.
- **Null prints as nothing.** A field the data lacks altogether is the
  runtime's error, never an empty string.
- **Images from the data.** An image shows either an asset the template
  pins by digest, or an `image` field of the header dataset. That field's
  value is an approved asset id and digest the host resolves, never an
  address. An image field is drawn, and never printed, sorted or grouped by.
- **Currencies from the data.** A currency format takes its code from the
  template, or from a string field or parameter.

**Tables.**
- **Order.** Rows are ordered by the group's key first, in its declared
  direction, then by the sort keys. Rows whose keys are all equal keep the
  provider's order. A field sorted by twice, or sorted by and grouped by, is
  refused.
- **Totals.** The group footer and the totals are lists of rows, so a
  quotation can show a subtotal, a tax line and a total.
- **Aggregates are declared once and printed by id.**
  - Each is computed exactly, once, in the runtime, over the current group
    in a group's rows and over every detail row anywhere else. Expressions
    read them as `group.<id>` and `totals.<id>`.
  - `count` counts rows, or the non-null values of what it reads. `sum` and
    `avg` take integers and decimals. `min` and `max` take those and the
    three temporal types.
  - Over no values, `count` and `sum` are 0, and the rest are null.
  - An average declares its rounding. Rounding has a scale, a mode and an
    optional increment such as 0.05.

**Styles, assets, expressions.**
- **Print styles are tokens, not CSS:** font family, size, bold, italic, a
  lower-case `#rrggbb` colour and alignment.
  - A component or a table column can add style rules, each a condition and
    a style, applied in order.
  - A table's header row, a group's header and each footer row can have a
    style, and a column can be hidden by a condition.
- **Assets by id and digest.** Bytes never live in the definition.
- **Expressions are carried, not compiled.** An expression is a CEL string,
  bounded in length. The runtime compiles it and enforces its budget.
- **Provenance** names a blank start, a form by its id and the
  `schemaHash` of its exact version, or a dataset.

**Validation and hashing.**
- **Structural validation** collects every error, up to a bound. Each error
  has a JSON Pointer, a stable code and the component it is inside.
  - It never throws.
  - It reads each value once into the report it returns.
  - No message or path grows with what the document holds.
  - Every array, string and number is bounded by a constant in `limits.ts`,
    with its reason.
- **The hash** is `@formancy/spec`'s `schemaHash` over
  `{ format: 'formancy-report', reportSpecVersion, report }`, taken only of
  a report the validator reads. So a form and a report with equal bodies
  never share a hash, key order never changes one, and an invalid report
  has none.

## Consequences

**What it buys.**
- **One definition.** The core's commands, the builders and the runtime
  read a `ReportDefinition`, and none of them redefines what a valid one is.
  The renderer does not: it takes the runtime's resolved, renderer-neutral
  document.
- **Engine independence.** The format does not depend on the engine R02
  chooses. Changing engines is an adapter, not a migration of every
  customer's templates.
- **The three starters can be written.** The inspection report has its
  photos, signature and conditional section. The quotation has its totals
  block and its currency. The grouped list has a defined order.
- **A form's key is the report's key.** A form field or a Data column with
  a key like `unit_price` or `unitPrice` binds unrenamed, and CEL reads it
  with a dot.
- **Fail closed.** A component, property or version this package does not
  know is refused whole, never partly rendered.
- **A printed page the host cannot restyle.** Nothing the browser cascades
  reaches the PDF.
- **A reproducible render.** A published template pins the bytes of every
  image it names, and a form-generated one pins its form's version.

**What it costs.**
- **No positioned elements yet.** A letterhead with a logo at exact
  coordinates in the page header cannot be drawn in version 0; columns
  approximate it. Adding positioned elements is a format change, and so is
  every rule below that a customer outgrows.
- **One detail table, and no images per row.** A report with two lists --
  order lines and payments -- cannot be expressed. An image is drawn once,
  from the header, so a photo per row, or a gallery, cannot be either. One
  grouping level means no subtotals by site within a region.
- **Two id syntaxes.** Names an expression reads follow formancy's field
  keys; every other id is lower case with hyphens. An author meets both.
- **Expressions are only carried.** An expression that does not compile,
  or names something its scope does not bind, passes structural validation
  and fails at the next level (plan 15), where the runtime compiles it.
- **Null has one rendering.** A null prints as nothing; a placeholder
  ("--", "n/a") is an expression or a later format change.
- **Sizes are measured against the page only.** An image wider than the
  column it stands in is the layout's to report, not this package's.
- **No style import.** Print styles are a deliberate, small vocabulary. A
  host's theme does not carry over, and mapping one is work with a preview,
  not an import.
- **Strictness has a price for editors.** A document with one typo, a
  length typed to a thousandth, or a document from a later version, is
  refused whole. An editor has to keep the document valid at every step;
  that is `report-core`'s job.
- **The renderer-neutral document has to catch up.** The renderer
  experiment's document (`report-corpus` on that branch) has no columns, no
  sections, no rule thickness or colour, no font or colour in a paragraph
  style, no image fit and no group header spanning the table. Until it has,
  the runtime has nothing to lower those to.
- **The bounds are chosen, not measured.** Lowering one later refuses
  reports that were valid.
- **Validation is not free.** Its cost grows with the report, and the core
  is planned to validate on every command (R04). No benchmark is committed
  yet; R04 brings the one that holds it.
- **The hash depends on upstream.** It rests on `@formancy/spec`'s
  canonicalisation. A change there changes every stored hash, which the
  pinned hash test catches before a release does. That canonicalisation
  builds objects by assignment, so an own `__proto__` key would vanish from
  a hash. Hashing only what the validator reads keeps such a key out.

**What it forecloses.**
- Saving an engine's document, CSS, an asset URL or asset bytes in a
  template.
- A second detail dataset or nested groups without a new format version.

**Added 2026-10-15: a group reads its own key.** report-core's review found
that a group header could print the field it is grouped by but never compute
with it: an expression in the group scope read only aggregates. So `group`
also holds `key` (`GROUP_KEY`), the value the current group is keyed by, of
the type of the field grouped by and null for the group of rows without one.
An aggregate may not be called `key` (`reserved-id`), so `group.key` never
means two things. It is a draft-format addition: `EXPRESSION_NAMES` is
unchanged, and so is every report that was valid and had no aggregate of
that name. `validate.test.ts` holds the refusal beside the nearest name that
is allowed.

**Added 2026-10-17: a QR code.** A component of kind `qrCode` prints its
content as a QR code, as [0020](0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)
decides. `content` is runs, one at least, that read what a paragraph in
its place reads.
`size` is the side of a square in points, its quiet zone inside it.
`errorCorrection` is one of ISO/IEC 18004's levels L, M, Q and H. It
stands wherever an image may, and its size is held to the shorter side of
the printable area. A page number or count is refused anywhere in it
(`misplaced-page-counter`), because its content is resolved once, before
pages are counted. It is a draft-format addition: `reportSpecVersion` is
unchanged, and so is every report that was valid. A release that predates
the kind, 0.1.0 among them, refuses a report that holds one as
`unknown-kind`, and never skips it. `validate-qr-code.test.ts` holds the
shape, the placement and the refusals.

**Added 2026-10-17: a payment part.** A report may carry one Swiss
QR-bill, `paymentPart`, at its own level and in no region, as [0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)
decides: the slip SIX fixes at the foot of the paper, across its width,
which no region inside the margins can hold. Its texts are runs, read as
a paragraph's in the report's scope, and a page number or count is
refused in every one. Its amount is an expression. A report that carries
one is on an A4 page in portrait, and any other page is refused once, as
`payment-part-page`. The format still has no coordinates: where the slip
stands is SIX's, and the renderer's to draw. SIX's rules for what a bill
holds are applied to a text of literal runs here, as `invalid-qr-bill`,
by the functions the runtime applies to data. It is a draft-format
addition: `reportSpecVersion` is unchanged, and so is every report that
was valid. A release that predates it, 0.1.0 among them, refuses a report
with a payment part as `unknown-property`. `validate-payment-part.test.ts`
and `qr-bill.test.ts` hold the shape, the page and the rules.

**Added 2026-10-17: an EPC QR code.** A component of kind `epcQrCode`
prints the code a SEPA credit transfer is initiated from, as
[0025](0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)
decides. Its beneficiary, IBAN, BIC, reference, text and information are
runs, read as a paragraph's in its place; its amount is an expression,
its purpose a literal, its size a square held as a QR code's is, and its
caption Austria's frame or none. It stands wherever a QR code may, and a
page number or count is refused in every text. Unlike a QR-bill it is a
component: the EPC prescribes no slip and no place. The EPC's rules for
what it holds are applied to a text of literal runs here, as
`invalid-epc-qr-code`, by the functions the runtime applies to data. It is
a draft-format addition: `reportSpecVersion` is unchanged, and so is every
report that was valid. A release that predates the kind, 0.1.0 among them,
refuses a report that holds one as `unknown-kind`.
`validate-epc-qr-code.test.ts` and `epc-payload.test.ts` hold the shape,
the placement and the rules.

**Added 2026-10-17: an e-invoice, and three names.** A report may carry
one EN 16931 invoice, `eInvoice`, at its own level and in no region, as
[0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)
decides: the runtime writes it as Factur-X CII from the values the page
prints. Its texts are runs, read as a paragraph's in the report's scope,
and a page number or count is refused in every one; its dates and its
paid amount are expressions. Its lines are the rows of the table over
the detail dataset, and four of its columns, which no condition may hide,
print each line's name, quantity, net price and net amount; the line's
identifier, unit and VAT category are read from each row. EN 16931's rules
are applied to a text of literal runs here, as `invalid-e-invoice`, by
the functions the runtime applies to data, and its codes come from closed
lists. The expression environment gains three names, and only in a
report that carries one: `invoice`, `vatBasis` and `vatAmount`
(`E_INVOICE_NAMES`), the totals the runtime computes once for the page and
the XML. So an expression no longer reads exactly the names
`EXPRESSION_NAMES` lists: `EXPRESSION_NAMES` is unchanged, and in a report
that is an e-invoice an expression reads `E_INVOICE_NAMES` beside them;
in any other, one of the three is unknown, as before. A report that
carries an e-invoice has a title without `&`, `<` or `>`. It is a
draft-format addition: `reportSpecVersion` is unchanged, and so is every
report that was valid and had no `eInvoice`. A release that predates it,
0.1.0 among them, refuses a report with one as `unknown-property`.
`validate-e-invoice.test.ts` and `en16931.test.ts` hold the shape, the
lists and the rules, and `en16931.test.ts` holds the two name lists apart.

**Added 2026-10-18: an SVG asset.** An asset's media type may be
`image/svg+xml`, as
[0030](0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)
decides; any other type than a PNG's, a JPEG's or that is still refused,
as `not-one-of`. The definition still holds no bytes: an SVG asset is named by
its id and the digest of the bytes report-spec's `cleanSvg` wrote when the
asset was approved, the one form the renderer draws. That form's rules are
report-spec's (`svg.ts` and the modules beside it), and its bounds the
`MAX_SVG_*` constants in `limits.ts`, the first of its bounds that were
measured rather than chosen, all but `MAX_SVG_REMOVED_NAMES`, each saying
how. It is a draft-format
addition: `reportSpecVersion` is unchanged, and so is every report that
was valid. A release that predates it, 0.1.0 among them, refuses a report
that declares an SVG asset as `not-one-of`.
`validate-declarations.test.ts` holds the media type, and `svg.test.ts`
and its siblings the form.

**Added 2026-10-22: a dataset read from a form.** A dataset contract may
say what of a formancy form's submissions it reads, `form`, as
[0042](0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md) decides: the header `{ kind: 'submission' }`, one
submission's answers; the detail `{ kind: 'repeater', repeater }`, the
rows of the repeater at that data path, or `{ kind: 'submissions' }`, one
row per submission. Each field of such a dataset says where its answer
is, `form: { path, member?, read? }`: its data path in the dataset's
scope, field keys joined by dots (`isFormPath`, at most
`MAX_FORM_PATH_KEYS`), a matrix row's or an option's value of 1 to
`MAX_FORM_MEMBER_LENGTH` characters, and whether a choice prints its
label, the default, or its `value`, on a string field alone. A dataset is
read whole and both datasets or neither (`incomplete-form-binding`), the
header reads no rows and the detail no one record, and a report of one
row per submission has no header (`misplaced-form-binding`); a path that
is not field keys and dots is `invalid-form-path`. The binding names no
form, and is part of what the report hashes: whether a version of a form
holds a field at a path is report-forms' to say, per render. It is a
draft-format addition: `reportSpecVersion` is unchanged, and so is every
report that was valid. A release that predates it, 0.2.0 among them,
refuses a report that carries one as `unknown-property`.
`validate-form-binding.test.ts` holds the shape and the refusals.

## Alternatives considered

**Extend the formancy form spec with pages and tables.** Refused by 0002 and
plan 12.1. A form's pages are navigation, its layouts are for data entry,
and its version line belongs to formancy. Widening it would make every
formancy release a question for Report, and every report feature a question
for formancy.

**A renderer's document format as the public format** -- pdfmake's
`docDefinition`, say. Rejected, for three reasons:
- **Coupling.** It ties every saved template to one engine, before R02
  chose one; changing engines would mean migrating every customer's
  templates.
- **Callbacks.** Its documents carry functions for headers, footers and
  table layouts, which cannot be serialised, hashed or trusted. Plan 12.1
  keeps engine callbacks private to the adapter.
- **No data semantics.** It has no notion of datasets, groups or declared
  rounding, so those would live in a second document anyway.

**An absolute-coordinate canvas**, every element at x and y on a page, as in
template designers. Rejected for version 0, as plan 9 advises:
- **Overlap.** Structure cannot prevent overlapping elements, so every
  overlap becomes a renderer diagnostic.
- **Growth.** A table that grows does not push what follows down.
- **Flow.** A multi-page flow needs a rule for every element on what happens
  when the content above it moves.

Bounded positioning inside the page header and footer remains the plan, for
a later version.

**JSON Schema with a schema validator** (`@formancy/spec` ships ajv).
Rejected. The rules that matter most are cross-references, placement and
scope:
- a field that must exist on the dataset the table reads;
- a page counter that must stand in a page region;
- a detail field that has a value only where there is a row;
- one detail table per report.

JSON Schema expresses these badly or not at all. Hand-written readers also
give each error a stable code, a JSON Pointer and the component it is in,
and they refuse a getter without running it.

**Totals as aggregates written into each footer cell**, the first draft of
this record. Rejected: a tax line computed from a subtotal needs the
subtotal by name, and a summary that prints the total needs the same
aggregate the table's last row prints. Named once, an aggregate is computed
once and cannot be written two ways that disagree.

**Lower-case hyphenated ids for dataset fields too**, one id syntax for the
whole format. Rejected: formancy's field keys are letters, digits and
underscores, so every key with a capital or an underscore would be renamed
on the way in from a form or from Data. Plan 12.3 says never to rebind by
similarity of names. CEL also reads `row.unit-price` as a subtraction.

**Records keyed by id for styles and fields**, as the first draft had.
Rejected: two collection shapes need two of every editor command. A record
also has no order, which a parameter form and a field picker need, and its
keys meet `__proto__` and `constructor`.

**A token check of the names an expression reads**, refusing `row` outside
a cell here. Rejected: telling an identifier from a string literal or a
comprehension variable is parsing CEL. A second, partial parser would be a
second place to disagree with the one the runtime compiles with.
