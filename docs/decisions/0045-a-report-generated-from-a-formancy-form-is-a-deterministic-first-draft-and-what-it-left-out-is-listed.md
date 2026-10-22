# 0045 — A report generated from a formancy form is a deterministic first draft, and what it left out is listed: `generateReport` in `@formancy/report-forms` walks a version in model order into a line of label and value for each answer, a section for each group, a matrix and ticked boxes, nothing for a page, one table over the repeater asked for or one row per submission, a box for a yes or a no and the pages counted, names the version by the hash computed of it and writes the binding its submissions are read by, declares a field never null only where the version proves it answered, and lists by stable codes what it left out and assumed; what the format cannot hold refused; the Studio opens one as a starter; a named layout, page breaks for pages, a stored base, words for yes and no, ids renamed by likeness and a draft cut to fit lost

- **Status:** accepted; numbered while 0043 and 0044 were other branches'; extends [0042](0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md), whose binding it writes and whose mapping it reads a kind by, and [0013](0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md), whose Studio opens a starter generated from a form
- **Date:** 2026-10-22
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The draft.** `packages/report-forms/src/generate.test.ts`: the
    corpus's site visit, version 2, laid out in model order -- five
    lines, the inspector, the ticked boxes and the matrix a section each,
    the findings' heading and table, the summary's line after it, the
    page counted in the footer -- every field declared with its type,
    nullability and binding, the provenance naming the form by the
    version's own id under a report of another and the version by the
    hash computed of it, and the notes in model order, none quoting a
    message of the form's catalogues in any of three languages; the same
    version and options twice, and every key of the form and the options
    in another order, the same report to its `reportHash`; versions 1
    and 2, which differ in a label the draft does not hold, the same
    report but for the version each names; labels in the locale asked
    for, and the form's default language's where it has none, said, the
    default locale never quoted; a field unlabelled or labelled blank
    labelled by its key, said; a blank title titled by the form's id,
    said, and one no font draws refused; a layout not followed, said;
    options the format does not take, a hash among them, refused; a
    detail at a path the version holds no repeater at refused as a read
    would refuse it; a form that is no version refused as a read does;
    and every code `NOTE_CODES` lists given to two forms, what is said of
    the whole form first, and no note of theirs quoting a word of a label.
  - **Each part of a form.** `packages/report-forms/src/generate-kinds.test.ts`:
    each kind formancy's own `FIELD_TYPES` lists either read by a
    declared field, the table's rows, or listed as left out, so that a
    kind added upstream fails until it is placed or listed, and ticked
    boxes that offer nothing listed rather than said to print as boxes; a
    hidden field printed and said; a group a section, nested to
    `MAX_NESTING_DEPTH` and flattened past it, said; pages looked through
    and never a page break; the repeater asked for the table where it
    stands, in a group's section, its rows' groups looked through and its
    matrix a column a row, the others listed; a grid's columns in
    formancy's order under its headings, or the field's own label where
    a heading resolves nowhere, and the generator's own order of a grid
    held equal to formancy's `datagridColumns` over grids of every shape;
    one row per submission with no header; no table and every repeater
    listed without a detail; a field not nullable only when required and
    hidden by no visible rule on it, its group or its repeater, and no
    skip rule on its page -- a group in a hidden group, a group on a
    skipped page and a skipped page read one row per submission among
    them -- a requirement by rule proving nothing; a required matrix's
    rows and required ticked boxes' options not nullable; a number an
    integer by whole steps from a whole least value, otherwise a decimal
    of its step's and least value's places, or of its digits where the
    format holds no such scale; a choice's label, the host's label of a
    resolved one and the value of one offering nothing; a box `[x]` or
    `[ ]` read in brackets, so keys called `in`, `true` and `constructor`
    compile; a row that resolves nowhere labelled by its value, or by its
    id where its value is white space, said at its place; a label the
    report's catalogue lacks read in the default locale's words, said; a
    label's white space one space; a label holding a control character
    or half of a surrogate pair refused by its place; a label longer than
    a field's printed whole on its line, its field labelled shorter,
    said, and a column's refused; a member's id by its value only where
    every member's value is a field key, two options of one value one,
    and two fields of one id refused, naming paths and places and never a
    value; the header's ids and the table's apart; and more fields than a
    dataset holds, a heading longer than a text, a column's label longer
    than a field's, a path past `MAX_FORM_PATH_KEYS`, a member whose
    field's key leaves no room for its id, more components than a region
    and nothing to print, each refused, and each bound at exactly its
    value a draft. The member's case was found by review after the rest:
    its draft reached the validator and was refused as the generator's
    defect, `invalid-report`, until the generator refused it by its place
    in the form.
  - **The page it prints on, on the PDF (0003).**
    `packages/report-forms/src/generate-print.test.ts`: a table headed
    by `Massnahmenplan`, a word of 71.7 pt in the header's Roboto Medium
    at 9 pt, printed whole at six columns on a portrait A4 page and at
    seven and nine on a landscape one, said, read back with PDF.js; the
    same drafts with one column more refused by the renderer at a word
    of the header; ten columns, and the site visit read one row per
    submission, thirteen, refused as `too-many-columns`.
  - **Its submissions read into it, on the PDF (0003).**
    `packages/report-forms/src/generate-read.test.ts`: the corpus's
    version-2 visit read into the draft made from version 2, resolved and
    rendered, read back with PDF.js and the corpus's `verify`: each answer
    on its line, an unanswered one its label alone, the boxes, every
    finding a row with version 2's labels and the hours to two places,
    `1 / 1`, and the manifest naming version 2's hash. And, by fast-check,
    400 models of every leaf the generator reads differently, required or
    not, in groups, pages and repeaters, the table any of their repeaters,
    one row per submission or none: every draft the runtime's
    `checkReport` compiles (`test-support.ts` holds every generation to
    it), generated twice alike, no note quoting a word of its labels; a
    submission of that version that answered nothing and one that
    answered every field read into it by `readSubmission` or
    `readSubmissions`, the second resolved in a final render, and one
    draft in twenty rendered and read back; most of them drafts, and a
    refusal only for what the format or the page cannot hold.
  - **Untrusted.** `packages/report-forms/src/generate-untrusted.test.ts`:
    a form of `MAX_DETAIL_ROWS` fields refused as `too-many-fields` in
    time linear in it; a grid of `MAX_DETAIL_ROWS` columns, each naming
    its field out of order, refused as `too-many-columns` in time linear
    in it -- 35.7 s before its order was the generator's own, past the
    test's bound, and 1.1 s after; 10,000 repeaters each listed; groups
    nested past `MAX_DOCUMENT_DEPTH` refused before they are walked, and
    nested as deep as it reads refused by their path; a megabyte of label
    refused by the field's place, no word of it in a message; a getter in
    the form or the options never run; errors bounded by
    `MAX_FORMS_ERRORS`. `read.test.ts`: formancy's validator's pointer
    cut before a catalogue's locale or a message's id, which may be a
    name, for a read and a generation alike.
  - **The starter.** `packages/report-forms/src/starter.test.ts`: the
    corpus's `SITE_VISIT_STARTER` is what `generateReport` writes of
    `SITE_VISIT_V2` with `SITE_VISIT_STARTER_OPTIONS`, to its
    `reportHash`, and its data what the bridge reads of
    `SITE_VISIT_SUBMISSION_V2` into it; the corpus cannot import the
    bridge, whose tests import the corpus, so the guard stands here.
    Watched failing with a heading's `keepWithNext` taken out of the
    corpus's copy and one finding's hours written `0.250`.
    `packages/report-corpus/src/forms/site-visit.test.ts`: the starter
    names version 2 twice, in its provenance and its data's source, and
    prints a version-2 visit. `packages/report-corpus/src/starters/starters.test.ts`:
    six starters, each validating, opening with nothing in report-core's
    `diagnose` and resolving its own data in a final render; report-core
    cannot import the corpus, which depends on it, so the corpus is where
    `diagnose` meets every starter. `logo.test.ts`: the draft prints no
    mark.
  - **Its PDF.** `packages/report-render-pdf/src/starters.test.ts`: the
    starter's own data on one page, held by the corpus's `verify`, each
    answer and box on its line and each finding's row formatted here by
    Intl, not by the runtime; and 80 findings over pages, every row once,
    the header on each page, `n / N`. `src/pictures.test.ts` and
    `docs/images/pictures.json`: its picture in the README, drawn by
    `scripts/readme-pictures.ts`, held to its page's lines.
  - **The Studio.** Its picker offers the starter after the euro invoice
    (`apps/studio/src/starters/starters.test.ts`, `src/studio.test.tsx`),
    its preview prints it (`src/preview/pipeline.test.ts`), both builders
    draw one accessible tree over it in three languages
    (`src/parity.test.tsx`), and the browser gate prints it on white with
    the lines `pictures.json` records, in both builders. The README's
    pictures of the Studio were retaken by `node scripts/pictures.mjs`,
    since every one lists the picker's starters.
  - **The e-invoice gate.** `scripts/e-invoice/pdf-corpus.mjs`'s
    `variant-site-visit.pdf`: the starter drawn as an e-invoice's PDF/A-3b
    and judged by veraPDF and Mustang. Watched refusing to run before the
    variant was added -- "report-corpus's starter site-visit has no PDF
    variant" -- then recorded with `--record` and judged without it: 146.9
    and 152.3 s, Mustang 131.5 and 133.7 s of them, on Java 25.0.4.1 and
    an Intel i9-10900K shared with two other workflows, 22 October 2026.
    The recording found veraPDF listing a control's two failed rules the
    other way round from the last one, so the gate's reader now sorts a
    job's failed rules (`scripts/e-invoice/verapdf.mjs`), held by a case
    of `verapdf.test.mjs` watched failing on the new recording first.
  - **The install gate.** `scripts/install-fixture/forms.ts`, in the Node
    host: a draft generated by the packed bridge from a version, naming
    it, its one assumption listed, a submission read into it and rendered.
    The package README's "Start a report from a form" is its lines
    (`scripts/readme-example.test.mjs`, watched failing before the
    section was written).

  Written before the generator had code, on 22 October 2026: against a
  stub that refused everything, 39 of the 40 tests of the four files
  failed; the one that passed, the property, refused nothing it was
  handed, and gained the count of drafts it requires, which the stub
  fails. Then each rule was broken on its own, 34 of them -- model order
  reversed, every group flattened, sections nested one deeper than the
  format, a skip rule, a visible rule, a group's visible rule and a
  repeater's ignored, required alone making a field never null, an
  integer read over a fractional least value and over no step, places
  from the step alone, a choice that offers nothing read by its label, a
  blank label printed, members' ids by place alone, colliding ids let
  through, a path past a binding, a long label, a static text and a
  resolved source's ticked boxes dropped or printed, too many fields,
  columns or components let through, nothing to print made, labels in
  another language unsaid, the version named by another hash, the
  binding's repeater by its key alone, an option beside the three taken,
  a box read by a dot, a colon after every label, a decimal printed
  plain, ids counted across reports, a grid in model order and its
  headings ignored, other repeaters dropped unsaid -- and each failed at
  least one test. One failed none at first, a visible rule on the
  repeater ignored for its rows, and gained its case and failed it. Each
  file was put back as it was read before its break.

  Two reviews of the branch followed, the same day. The worst finding: a
  draft of more columns than its page gives room was refused only when
  it printed -- the site visit read one row per submission, at its
  fourth column of thirteen -- so the page is chosen by the columns,
  above. The others: a grid whose order formancy's own function finds in
  quadratic time, 40.7 s for the most columns a form may hold; a
  member's id of a value meeting one of a place in one field; a long
  label refusing a form whose line could print it; a character no font
  draws passing every check; the default locale, a member's value and a
  catalogue's message id quoted in a note or a refusal; labels falling
  back unsaid; a blank title leaving a warning in the problems pane;
  ticked boxes of nothing vanishing; a hidden field printed unsaid; and
  rules no test held. The tests for them were written first and 20
  failed against the generator as it stood; then 24 rules were broken on
  their own, each failing at least one test but two: a page's place
  hidden by what holds it, which formancy's refusal of a page in
  anything makes no break at all, and is now written as that fact; and a
  heading quoted in a note, which no test reached until the test that
  gives every code held that none of its notes quotes a label, and then
  failed it.

  What holds nothing: that a draft of any other form opens with nothing
  in the problems pane -- report-forms does not depend on report-core,
  so its tests hold every draft to the runtime's `checkReport`, which
  refuses an error and passes a warning; the warnings are meant absent
  by construction, every field printed, every style used and the title
  never blank, which review found false once, for a blank title, and
  which `diagnose` holds on the starter alone. Whether a word of a
  heading or of an answer fits its column when the draft prints, past
  the measured case: the renderer decides it, holding the font. And
  whether a draft reads well, which is review's.

## Context

Plan item R12 asks for a report started from a formancy form: a
generated base, deterministic, its exclusions and assumptions listed
(plan 12.3), from which a person makes the report. 0042 gave the report
a binding to a form's submissions and a mapping from formancy's kinds to
the report's types, and nothing wrote one: every starter was blank, and
the binding was written by hand.

What there was to start from:

- **A form is a data model, not a printed page.** Its fields come in
  model order, the order a submission is collected in and formancy
  renders by default; a named layout arranges them for filling in --
  sections, tabs, a print layout that leaves a field out. Its pages are
  steps of filling it in, which scope nothing (plan 12.2, formancy.ai
  0012). A group nests fields under its key; a repeater holds rows; a
  matrix asks one question of several rows; ticked boxes tick options.
- **A report of version 0 has one detail table** (0007): one repeater
  can be its rows, or each submission a row (0042).
- **The format has bounds**: 64 fields a dataset, 32 columns a table,
  500 components a region, containers four deep, 200 characters a label,
  16 keys a binding's path (`limits.ts`). formancy bounds none of what
  they bound.
- **The renderer breaks no word in a table's cell** and refuses one
  wider than its column, a heading's among them (0011), and draws only
  what its font has a glyph for: Roboto, until fallback fonts (plan 19)
  or a host's own draw more.
- **A boolean prints as `true` or `false`** when a report prints it
  plainly: the format has no word for yes in a report's language.
- **A field's id is an expression's name** (0007, 0009): `header.roof`.
  A field key of formancy's may be a word CEL keeps for itself, `in` or
  `true`, and a matrix row's value or an option's is free text.
- **The plan's question FB-Q6**, whether the generated base is stored:
  answered (a), no -- the review compares the report with the new
  version, relabels are offered, and nothing is applied without the
  author. The user accepted the plan's recommendations for 0.3.0's form
  bridge.

## Decision

**`generateReport(form, { id, locale, detail? })`, in report-forms.** The
version is read as 0042 reads one -- copied as data through its
descriptors, held to the pinned `@formancy/spec`'s validator, named by
the `schemaHash` computed of it -- and the options are held to report-
spec's own judgement of an id and a locale, `detail` to `{ kind:
'repeater', repeater }`, a data path, or `{ kind: 'submissions' }`, and
nothing else beside them. It returns `{ ok: true, report, notes }` or
every reason it was not, by 0042's codes and nine of its own.

**Model order, never a named layout.** The draft is the version's model
walked in order. A layout is an arrangement for filling the form in and
may leave a field out; following one would make the draft depend on a
choice of layout the options do not make. A version that names layouts
is told it, in a note.

**What each part becomes.**
- **A field that holds an answer** is a line: its label from the version
  in `locale`, a colon unless it ends in one or asks a question, and its
  value -- a date and an instant in the report's locale, `medium`; a
  decimal to the places its step and least value have; a yes or a no as
  a box, `[x]` ticked, `[ ]` not, nothing unanswered, by an expression
  that reads the field in brackets, `header["roof"]`, which any field key
  is in CEL; anything else as the runtime prints it. A hidden field
  prints as any answer, said: the person filling in the form never saw
  it.
- **A group** is a section headed by its label, its fields' lines in it
  and its groups sections in it, as deep as the format nests containers;
  deeper, its heading and its lines stand in the section around it,
  said. **A matrix** and **ticked boxes** are a section of a line a row
  or an option; ticked boxes that offer no option are left out, said.
- **A page** is nothing: its fields stand where they are, and no page
  break is made of it.
- **The repeater `detail` names** is the table, where it stands, a column
  for each field of its rows -- its groups looked through, a matrix a
  column a row -- in the order its grid gives them where it is one, as
  formancy's `datagridColumns` orders them, ordered here in time linear
  in the grid, under the grid's headings, or the field's own label where
  a heading resolves nowhere. **One row per submission** is a table of
  the submission's answers, groups looked through, with no header. Every
  other repeater is left out, said, and without `detail`, every one.
- **Static text** is left out: it holds no answer. **A file, a signature,
  a ranking** and **ticked boxes whose options a deployment resolves**
  are left out, said: 0042 reads nothing of them.
- **The title** is the form's, over the body, or the form's id where it
  is blank, said; **the footer** counts the pages, `1 / 2`, in no
  language's words; a style for the title, one for headings where there
  are any, and one for the footer, each used.

**The page.** A4, 20 mm margins, portrait unless the table has more
columns than a portrait page gives `MIN_COLUMN_WIDTH`, 80 pt, each --
six -- and landscape, said, up to as many as a landscape page gives that
-- nine; a table of more is refused, `too-many-columns`, never cut to
its first columns. 80 pt is measured: inside the renderer's padding it
holds a heading word of 72 pt in the header's Roboto Medium at 9 pt,
`Massnahmenplan`, and not `Zusammenfassung`, 77.8 pt; every column of a
table is as wide as the next.

**Its labels.** Each is the version's in the report's locale, as
formancy reads one: a message the catalogue of that locale lacks is its
default locale's words, said of that label, and of the whole form where
it has no such catalogue. A label prints on one line: each run of white
space, a tab and a line break among it, is one space, and a blank label
is none -- the field labelled by its key, a row or an option by its
value, said at its place. A label holding a character no font draws, a
control character or half of a surrogate pair, is refused by its place,
never dropped; whether a font draws any other character is the
renderer's to say. A line's label prints whole, up to a text's length;
a field whose label is longer than a field's holds is labelled by its
row's or option's label, or by its id, said; a column's heading is a
field's label, and one longer is refused.

**What it declares, as 0042 reads it.** A field's id is its key, which
formancy holds unique in the form; a matrix row's or an option's is the
field's key and the member's value, `checks_roof`, where every member's
value gives a field key so, and the member's place in its list,
`checks_2`, for every member where one does not, so that an id of a
value never meets one of a place; two options of one value are one, as
the reader reads them. The header's ids and the table's are their own,
`header.x` and `row.x`. Two fields of one id are refused, naming both
paths and a member's place, never its value, and never renamed by
likeness. Each type is the one `KINDS` reads the kind as: a number an
integer where it steps by whole numbers from a whole number, as 0042's
`planField` reads one, and a decimal otherwise. Each binding is the
field's data path in its dataset's scope, a member, and `read: 'value'`
for a choice that offers no option and names no source, whose answer
has no label. A field is never null only where the version proves it
always answered: required, and no `visible` rule on it, a group or a
repeater holding it, and no `skip` rule on its page, since formancy
prunes what a rule hides; a requirement by rule proves nothing, its
expression may be false. The provenance is `{ kind: 'form', form,
formHash }`, the form's id as the version writes it and the hash
computed here.

**Deterministic.** The same version and the same options give the same
report, to its `reportHash`: the walk is the model's order, ids are
counted per report, and the version is named by its canonical hash. A
version that differs only in what the draft does not hold -- an option's
label, a rule, a static text -- gives the same report naming another
version.

**What it left out and assumed is listed.** Each note is a code of
`NOTE_CODES`, the place in the form it is about and a sentence:
`untitled`, `labels-default-locale`, `layouts-not-followed`,
`pages-not-breaks`, `table-landscape`; `static-excluded`,
`unsupported-excluded`, `repeater-excluded`; `group-flattened`;
`number-integer`, `number-decimal`, `yes-no-box`, `time-as-text`,
`rich-text-plain`, `hidden-printed`, `choice-host-labels`,
`choice-value`; `unlabelled`, `label-default-locale`, `long-label`;
`present-always`. What is said of the whole form first, then of each
field in model order, its kind's reading before its labels and its
presence. A note names a field by its data path, a row or an option by
its place, and the report's own locale; it quotes no title, label,
option, value, message or locale of the form's, which may name a
person. 0042's version reader names a refusal of formancy's validator
the same way: at where it points, cut before a segment that is neither
an index nor a field key, a catalogue's locale or a message's id.

**Refused, never cut to fit.** A draft that would declare more fields
than a dataset holds, or columns than a landscape page gives room, or
hold more components than a region; a column's heading longer than a
field's label, or a section's heading or a line's label longer than a
text; a label or the title holding a character no font draws; a field
deeper than a binding's path; a matrix row or an option whose field's
key leaves no room in a field key for `_` and its members' values or
places; two fields of one id; a form, or a repeater asked for, holding
nothing a report prints. Each by its place in the form and a code of its
own.

**No stored base (FB-Q6).** The draft is a report like any other once it
is made: nothing keeps it beside the report to merge a later version
into, and nothing regenerates a report. A later version will be reviewed
against the report itself.

**A starter generated from a form.** The corpus holds
`SITE_VISIT_STARTER`, the draft of its site visit form's version 2 in
Swiss German, its table over the findings, and the version-2 visit read
into it, both written out as data, and the options it was generated
with. The Studio opens it after the euro invoice, its PDF held as every
starter's, and the e-invoice gate draws it as a variant.

## Consequences

**What it buys.**
- **A report from a form in one call**, bound to the form's submissions,
  naming the version it was made from, that a person changes rather
  than writes.
- **Nothing left out unsaid.** Every kind is printed or listed, and every
  assumption a reader might not share -- a box for a yes, a decimal's
  places, a field declared always answered, a landscape page, a label in
  another language -- is a note with a code a host can show or act on.
- **A draft whose headings print.** Every draft the runtime compiles,
  and a submission of its version that answered nothing and one that
  answered every field read into it, the second resolved in a final
  render, over models of every kind, one draft in twenty rendered (the
  property); and its table stands on a page whose columns hold a
  heading's word of 72 pt, proved at the most columns each orientation
  gives (`generate-print.test.ts`). It does not promise that every draft
  prints: a heading's or an answer's word wider than its column, or a
  character Roboto has no glyph for, is refused when it prints, as in
  any report.
- **One mapping.** The types are 0042's `KINDS`, the integer rule its
  `planField`'s, and the grid's order formancy's, held equal to its
  function: nothing here reads a kind a second way.

**What it costs.**
- **A layout nobody would print as it is.** A line for each answer under
  the form's title, in the form's title's language whatever the report's,
  sections with no space between them, every column of the table as wide
  as the next. It is a first draft, and says so.
- **Model order, whatever the form's layouts say.** A form whose print
  layout leaves a field out, or orders its fields otherwise, gives a
  draft of every field in model order.
- **A yes or a no prints as a box, `[x]` or `[ ]`**, in no language, and
  an unanswered one as nothing.
- **Refused where the format or the page is smaller than the form.** A
  form of more than 64 answered fields, or a table of more than nine
  columns -- the site visit read one row per submission, thirteen, among
  them -- gives no draft at all; nor does a column headed longer than 200
  characters, a label holding a control character, groups nested past
  sixteen keys, or a matrix or ticked boxes whose key leaves no room for
  `_` and its members' values or places in 64 characters -- a key of 62
  with ten options that are no field keys, whose tenth would be `_10`.
  Nothing picks the fields to keep.
- **Words wider than their room are the renderer's to refuse.** A
  heading's word wider than 72 pt, `Zusammenfassung` among them, or an
  answer's, such as an e-mail address in a narrow column, is refused
  when the draft prints, and so is a label of a character Roboto has no
  glyph for -- Chinese, an emoji, a narrow no-break space -- until
  fallback fonts (plan 19) or a host's font draw it: the generator holds
  no font to see either.
- **Every field nullable but the proven.** A field the version does not
  require, or a rule can hide, is nullable: 0009's cost, a `dyn` member
  and no decimal `==`.
- **A member's id by its place** wherever one member's value is no field
  key, so an expression reads `header.checks_2` for an option called
  `opt-2`, every option of that field by its place, and an option moved
  in a later version is another member's id.
- **One table**: a form with defects and parts used gets one of them, and
  the other is a note.
- **The notes are linear in the form**, one an excluded field: a form of
  10,000 static texts gives 10,000 notes.
- **A draft's problems pane held on the starter alone.** That a draft
  opens with no warning is held by `diagnose` on the starter; any other
  draft is held to the runtime's `checkReport`, which passes warnings.
- **Time, measured.** From the built package, Node 24.21.0, an Intel
  i9-10900K at 3 to 100 % load from other workflows, 22 October 2026,
  runs two to six of six, twice: the site visit 1.8 to 3.9 ms; a form of
  64 fields 2.5 to 5.7 ms; 10,000 repeaters 0.13 to 0.22 s; a form of
  100,000 fields refused in 2.3 to 5.2 s, most of it formancy's
  `validateSchema`; a grid of 100,000 columns out of order refused in
  0.89 to 3.1 s, where formancy's own ordering had taken 40.7 s.

**What it forecloses.** A draft that follows a named layout; a page
break made of a form's page; a stored base merged into a report; words
for yes and no the generator chose; ids renamed by likeness to fit; a
draft cut to the format's bounds or the page's.

## Alternatives considered

**Follow a named layout, or the first one.** Its sections and tabs would
become sections, its tables tables. Rejected: a layout arranges a form
for filling it in and may leave fields out; which one to follow is a
choice the options would grow for, and the plan's acceptance names
model order. A host that wants it can move the draft's components.

**A page break for each of the form's pages.** Rejected by plan 12.2: a
page is a step of filling the form in, and printed, a page break would
leave each page half empty.

**Store the generated base, and merge a later version into the report
(FB-Q6 (b), (c)).** Rejected: a second document to keep in step, and a
three-way merge whose conflicts a person resolves anyway; the review
compares the report with the new version directly, and relabels are
offered. It can follow if authors ask for it.

**`true` and `false`, as the runtime prints a boolean.** No expression in
the draft. Rejected: the draft is in the report's language, and `true`
under a German label reads as the code it is.

**Words for yes and no, a table of them by language.** Rejected: the
generator would keep words of its own for every language a report may
have, and still have none for most.

**Every table portrait, its width a note.** The draft as it was, handed
over. Rejected: a draft of the site visit one row per submission passed
every check and was refused when it printed, after the person had
started on it. **Measure each heading's words in the generator** instead
of a column's room: rejected, it would put a font into report-forms and
read the renderer's metrics a second way, and still not see an answer.

**Ids made from a field's path, `inspector_name`.** Rejected: formancy
holds a key unique in the form, so the key alone is an id, and a path
joined by underscores could collide with a key that has one.

**Every member's id by its place.** One rule. Rejected: `header.checks_2`
reads worse than `header.checks_roof` wherever every value is a field
key. **Each member's id by its value or its place, one by one**, as the
first draft had it: rejected, `n/a` the first row's place and `1` a
value are both `checks_1`, and refused a form the format holds.

**Refuse a label longer than a field's**, as the first draft did.
Rejected: a consent question of 250 characters refused the whole form,
though its line holds it. **Drop a character no font draws**: rejected,
the label would change unsaid.

**Keep the first 64 fields, and note the rest.** A draft for every form.
Rejected: it is the format cut to fit, and which fields are first is the
model's order, not the person's choice; a refusal names the bound.

**Generate in report-core.** Rejected, as the plan's FB-Q1 says: it
would put `@formancy/spec`'s validator into the editor's core and into
both builders' closure.

**The corpus calling the generator for its starter.** Rejected: the
bridge's tests import the corpus, so the corpus importing the bridge is
a cycle. The corpus holds the draft as data, and the bridge's test holds
the two equal by hash.
