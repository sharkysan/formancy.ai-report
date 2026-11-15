# 0059 — A group header is kept on its page with as many of its group's first rows as the report states, or as many as fit

- **Status:** accepted; numbered while 0053 to 0058 were other branches'; extends [0007](0007-a-report-definition-is-its-own-versioned-document.md), whose table group may state how many of its first rows its header is kept with, [0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md), whose group header row carries that number resolved against its group, and [0011](0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md), whose renderer keeps the header with those rows
- **Date:** 2026-11-15
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The format.** report-spec's `src/validate-table.test.ts` reads a
    group's `keepWithRows` back whole and holds it to the hash: absent, 1
    and `MAX_KEEP_WITH_ROWS` accepted; 0 and one past the bound refused as
    `out-of-range`, 2.5 as `not-an-integer` and a string as `wrong-type`,
    each at `/group/keepWithRows`; and the member on the table rather than
    its group refused as `unknown-property`.
  - **The editing core.** report-core's `src/commands/table.test.ts`: a
    count set through `setGroup` and through `updateComponent` is kept, a
    count out of range is refused by the session with nothing changed, and
    one undo takes a count back.
  - **The runtime.** report-runtime's `src/lower-table.test.ts`: a group of
    five rows stating three resolves to a group header row that keeps
    three; a group of two stating three, two; a group of one, and a group
    stating one, to a row without the member; and a report that states
    nothing to the document it resolved to before, its existing cases
    unchanged.
  - **The renderer, on the PDF.** report-render-pdf's
    `src/group-rows.test.ts`, each case read back with PDF.js
    ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)):
    - group headers stating three rows, swept across page ends, each on
      the page of its first three rows;
    - a group of two rows stating three printed whole with its subtotal on
      one page;
    - a table's first group header moved with the column header and the
      rows it keeps;
    - a header and three rows too tall for a page under the column header
      kept with two, and a header kept with its first row alone where no
      count above one fits, on the pages the arithmetic gives;
    - a row with no text among the stated rows counted, one with no text
      last among them ending nothing, a group whose last row prints
      nothing kept whole to its subtotal, and a header over rows none of
      which prints, and a header that prints nothing, left where they fall,
      to the byte as without a count;
    - a table in a framed section, broken by its rules alone, and a table
      whose rows split, its last kept row starting on its header's page.

    `src/breaks.test.ts` holds the arithmetic apart from pdfmake: the
    blocks a count makes, a group no longer than its count merged with its
    footers, the count that fits chosen where the stated one does not, and
    a block ended on a row that prints, judged after the footers are
    merged.
    `src/tables.test.ts` lays a 400-group table that keeps three rows out
    at most three times, and renders tables that state counts to the same
    bytes with the plan as with the rules alone. `src/refusals.test.ts`
    refuses, as `unsupported` and naming the table, the member on a row
    that is not a group header, a count not whole or outside 2 to
    `MAX_KEEP_WITH_ROWS`, and a count past the detail rows under the
    header.
  - **The corpus.** report-corpus's `src/checks.test.ts` holds its orphan
    check generalised: a group header with fewer of its rows under it on
    its page than its row keeps is reported; one that keeps none is held as
    it always was, over a row without a key too; and one whose kept rows
    have no key, which no count can find, is still held to not ending its
    page. `src/fixtures/fixtures.test.ts` holds the
    `group-keep-with` fixture to what it is built for: for every plausible
    number of rows a page, a group header placed where one and where two
    of its rows would be left room on its page, and a group of fewer rows
    than it states. report-render-pdf's `src/corpus.test.ts` and
    `src/browser.test.ts` render it beside section 20's fixtures, which it
    is kept apart from, as the SVG fixtures are, so that the corpus the
    renderer trial chose an engine on stays the one it ran on.
  - **Nothing else prints otherwise.** Every corpus fixture's and starter's
    PDF, each invoice sample's final and preview among them, compared byte
    for byte with what `main`'s renderer wrote of it, on the day the
    renderer's change is made -- a script's comparison, made once and kept
    nowhere. What holds it after that day: report-runtime's
    `src/lower-table.test.ts`, which resolves a report that states no
    count, or one, to rows without the member; the existing cases of
    `breaks.test.ts`, `flow.test.ts`, `tables.test.ts`, `corpus.test.ts`
    and `starters.test.ts`, unchanged; `group-rows.test.ts`, where a
    header keeps none of its count, printing the bytes it prints without
    one; and the `e-invoice` gate passing on its recorded corpus without
    `--record`, whose digests (`inflatedDigest`) cover the e-invoice
    samples and the variants it draws -- every starter among them, and of
    section 20's fixtures `fonts` and `host-fonts` alone.
  - **The builders.** report-builder-core's `src/scenario-table-group.ts`,
    in `BUILDER_SCENARIOS`, run against the model by `src/scenarios.test.ts`
    and by React's `src/scenarios.test.tsx` and Angular's
    `src/scenarios.test.ts`, each in English, Swiss German and Swiss French,
    the frameworks with axe over the end of each: the count's field on a
    grouped table read as one, typed, refused out of range on its field,
    written back as one, and undone; a count given back as it reads, or
    emptied where none is stated, no edit, and the field reading one again
    in both builders; and the field absent from a table without a group.
    `src/properties.test.ts` holds the field's key, kind and value on the
    grouped table of its report and its absence from the same table without
    a group, one and nothing written as the member's absence, a count given
    back as it reads or written otherwise left alone, and the validator's
    own reason on the field for a count it refuses. The Studio's
    `parity.test.tsx` holds both builders' accessible trees alike over the
    grouped equipment starter's table, the one starter whose table has a
    group, in each of the editor's languages.
  - **Seen failing.** Each stage records here, with the date, each case
    run before its code or with that code disabled and restored, and the
    byte comparison above with what it compared. Until it has, this line
    claims nothing.

## Context

Report already keeps every group header with its group's first row. It has
since the renderer trial ([0005](0005-pdfmake-renders-reports-behind-one-adapter.md)),
and [0011](0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)
restates it for the renderer that ships. A verification against `main`, on
15 November 2026, read how:

- **The block.** `keepBlocks` (`breaks.ts`) makes a block of a group header
  and the row after it; `tableRules` (`table-rules.ts`) breaks before the
  header where none of that row's cells start on the header's page, and
  `plannedBreaks` makes those breaks in one more layout rather than one
  layout each. The corpus's `group-boundary` fixture and its `orphans`
  check (`check-tables.ts`) prove that no page ends on a group header, and
  `flow.test.ts` that a header stays with a row of several lines, that a
  row which cannot share a page with its header splits instead, and that a
  table starting with a group header moves with its first row. The
  runtime's `TableRow` says so of a `groupHeader` (`document.ts`).
- **Where it cannot hold.** A header and a first row too tall to share a
  page under the repeated column header are not kept as a block
  (`keptBlocks`); the table's rows then split (`tablePlan`), and the row
  starts on its header's page. A first row with no text keeps nothing: a
  rule finds a row on its page by its text alone (`flow.test.ts`, "leaves
  a group header over an empty row where it falls"). A table in a
  keep-together block or a page region has no plan and no rules, and
  stands whole (`UNPLANNED`, `tableContent`).
- **How far it reaches.** The block grows past the first row only where
  that row is its group's only one, and so runs into the group's footers,
  which the closing rows' rule keeps with the row before them.

What it could not do is keep more. An order whose lines are grouped by
delivery, or an invoice grouped by project, could start a group at the
foot of a page with its heading and one line, and the rest of the group on
the next. And the format could not say otherwise: `TableGroup` has `by`,
`direction`, `header`, `headerStyle` and `footer`, and the validator
refuses any other member (`unknown-property`, `validate-table.ts`).

The roadmap's nested groups (item 2) name the step: a group's header kept
on its page with as many of the group's first rows as the report states,
or with all of them where the group has fewer, at every level. Version 0
has one grouping level ([0007](0007-a-report-definition-is-its-own-versioned-document.md));
nested groups are not this record's.

What this record had to keep: a report that does not state the new member
resolves and prints exactly as it did, and the existing rule is extended,
not built a second time beside the first.

## Decision

**A table's group may state `keepWithRows`, a whole number from 1 to
`MAX_KEEP_WITH_ROWS`: its header is kept on its page with that many of the
group's first rows, or with all of them where the group has fewer, or with
as many as fit on a page under the repeated column header where those do
not -- never with fewer than the one row it is kept with today. Absent, it
is one, the rule every group header has had.**

**In the format** (report-spec).
- **The group's own member.** `TableGroup.keepWithRows`, so that each
  level states its own when a later record gives the format nested
  groups.
- **Bounded.** `MAX_KEEP_WITH_ROWS`, 32, in `limits.ts`. Chosen, not
  measured, as the bounds beside it are: well above the two or three rows
  that keep a group from starting at the foot of a page. A count past what
  a page holds keeps what fits (below), so the bound protects no page: it
  refuses a count nobody means and bounds what the renderer adds up for
  each group header.
- **Read where it is written.** `readGroup` reads it with `integer`: 0 and
  33 are refused as `out-of-range`, 2.5 as `not-an-integer`, a string as
  `wrong-type`, each at `/group/keepWithRows`. On the table it is
  `unknown-property`, as any member the table does not have.
- **One is accepted**, and prints as its absence, as `keepWithNext: false`
  is accepted beside no `keepWithNext`. The builders write the absence.
- **No command of its own.** `setGroup` and `updateComponent` carry it, and
  the session holds it to the validator, as every edit
  ([0008](0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)).
- **A draft-format addition.** `reportSpecVersion` is unchanged, and so is
  every report that was valid. A release that predates the member, 0.2.0
  among them, refuses a report that states it as `unknown-property`, never
  printing it without the count.

**In the resolved document** (report-runtime).
- **The runtime counts the group.** A `groupHeader` row carries
  `keepWithRows`: the stated number or the group's rows, whichever is
  fewer, and only where that is more than one. How many rows a group has
  is the runtime's grouping, decided there once
  ([0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md));
  the renderer reads the number and never counts a group itself.
- **One spelling, and the old documents.** A report that states nothing,
  or one, or whose group has a single row, resolves to the row it did
  before, without the member.
- **The bound travels with it.** The runtime re-exports
  `MAX_KEEP_WITH_ROWS` from report-spec, as it does the font and SVG
  bounds the renderer checks against.

**In the PDF** (report-render-pdf). The existing blocks, rules and planned
breaks keep the longer block; nothing beside them is built.
- **How many are kept.** A group header is kept with the greatest number
  of its first rows, up to the number its row carries, whose last row
  prints and whose block fits on a page under the repeated column header:
  the header and those rows, and, where they are all of the group's rows
  and the table keeps closing rows, its footers and any totals that close
  it, as the closing rows' rule already merges them. Where no number above
  one fits, the header is kept as it is today: with its first row -- and
  that row's footers, where it is the group's only row -- where they fit,
  and with none where they do not.
- **A row with no text** counts where it stands among the rows kept, but
  never ends them: a rule finds a row on its page by its text alone, so
  the block ends at the last of them that prints, and the plan is held to
  that same block so that it breaks where the rules would; where the
  block reaches the group's last row, its end is judged after its footers
  are merged, so that a subtotal that prints ends it. Where none of them
  prints, nothing is kept, as of a first row with no text today, and a
  header that prints nothing keeps nothing either, whatever it states.
- **Rows that may split.** Whether a table's rows split is decided as
  before, by each row and its group header alone, never by the count. In a
  table whose rows split, the last kept row starts on its header's page and
  may continue on the next, as the first row does today.
- **The first group.** The rows that move with the column header
  (`keepWithHeaderRows`) take the first group's kept rows with them, as
  they already take any block that starts among them.
- **Refused, not guessed.** Before pdfmake sees the document, and as
  `unsupported`, naming the table: the member on a row that is not a group
  header, a number that is not whole or not from 2 to
  `MAX_KEEP_WITH_ROWS` -- one row kept is no member, as the runtime writes
  it -- and a number past the detail rows under the header before the next
  row of another kind. A document the runtime did not resolve is held to
  what the runtime writes; if the two ever disagree, the render says so.
- **Where nothing breaks a table.** A table in a keep-together block or a
  page region stands whole, as before, and the count changes nothing
  there.

**In the builders.** A table with a group shows one field more in its
properties, *Rows kept with each group header*, a number, reading 1 where
the member is absent. A number typed is written through `updateComponent`
at `/group/keepWithRows`; 1, or nothing, is written as the member's
absence, as a boolean's default is; a count given back as it reads -- 1,
or nothing, where none is stated -- is no edit, with no Undo of its own,
and the field reads it again; a count out of range is the validator's to
refuse, and its message stands on the field. The field is builder-core's
(`field-specs.ts`, where the constructors of every field now stand, apart
from the table of which fields each kind has), drawn by both builders as
any number field, and held by `BUILDER_SCENARIOS`
([0012](0012-the-builders-are-native-and-share-one-session.md)). The
Angular builder gives a typed control back what its field reads once a
commit is taken as no edit, which Angular's binding, unchanged, would not
write, as React's draft already gives way to it. A table without a group
shows no such field.

## Consequences

**What it buys.**
- **A group starts with as many rows as the report asks for.** No page
  ends on a group's heading and fewer of its rows than the report states,
  where the page could hold them.
- **A small group stays whole.** A count at least a group's rows keeps
  its header, every row and its subtotal on one page where they fit, by
  the closing rows' rule the renderer already has.
- **Nothing is lost.** Where the stated rows do not fit, the count moves
  where the page breaks, never what prints: every row prints once, whole,
  as 0003 and 0011 require.
- **One mechanism.** The longer block is a `KeepBlock` like any other:
  ruled, planned and checked by the same code that keeps a header with its
  first row today, so the two can never disagree.
- **Nothing else changes.** A report that states nothing resolves to the
  same document and prints to the same bytes.

**What it costs.**
- **White space, and pages.** A group that would have started at the foot
  of a page starts on the next, and leaves blank the room its header and
  fewer than its count of rows would have taken. A report that states a count can
  need more pages than without, and is refused as `too-many-pages` where
  that passes the host's limit. The least height a body is bounded by
  before pdfmake measures it does not count that space, so such a report
  is measured whole before it is refused.
- **A count is a most, not a promise.** Where the stated rows do not fit
  on a page, fewer are kept, and nothing says so: the heights are the
  data's, known only at render, and the renderer has no warning to say it
  in.
- **Two spellings of one.** `keepWithRows: 1` and no `keepWithRows` print
  alike and hash differently. The builders write the absence; a host or a
  proposal may write either.
- **A row with no text ends no count.** A header whose last stated rows
  print nothing is kept with the rows before them that do, and the rows
  that print nothing may stand on the next page.
- **A header with no text keeps nothing.** A group header may be empty,
  or resolve to no text, and a rule has nothing of it to find on the page:
  it is left where it falls whatever its count, and the builders still
  show the count's field for its group.
- **In a table whose rows split**, the last kept row may continue on the
  next page.
- **Older releases.** 0.2.0 refuses a report that states a count, whole, as
  `unknown-property`, so a report saved with one opens only in a release
  that has the member. 0.2.0's renderer, handed a document this release's
  runtime resolved, keeps each header with one row: it reads no member of a
  row it does not know.
- **The bound is chosen**, not measured.
- **The fallback is proved by the renderer's own cases.** The corpus's
  check holds a group header to the count its row carries, and its fixture
  is built of rows that fit; where the stated rows cannot fit, a case says
  the count it expects, from the heights it computes.
- **One field and three scenarios more**, in three languages, for the
  builders to keep.

**What it forecloses.** Nothing that cannot be undone: the format is a
draft's. A group header repeated on the pages its group continues on --
pdfmake repeats the column header alone (`measure.ts`) -- a count of a
group's last rows kept with its footers, and keeping a whole group by a
flag are each another record's; nested groups are the roadmap's item 2.

## Alternatives considered

**Fall back to the header and its first row** where the stated rows do not
fit. It is the rule the renderer has, and the simplest to say. But a group
whose header and three rows do not fit on a page would then start at the
foot of one with a single row, the very thing the report stated a count to
prevent, where the page could have held two. Keeping as many as fit is the
same arithmetic, the blocks' heights against the page under the column
header, asked for each count down to one.

**Refuse a report whose stated rows do not fit.** It would fail closed. But
the heights are the data's: a report that printed yesterday would be
refused today for a long description, for data its author could not
foresee, and nothing would have been lost by printing it, since moving a
break drops no content. 0011 refuses what cannot be drawn whole; this can.

**Count only the rows that print**, so that a row with no text lengthens
the block rather than ending it. It would keep the number of rows a reader
sees. But the block would then hold more rows than the report stated, and
one run of rows with no text, which the data decides, could pull any
number of them onto the header's page; and a block must still end on a row
a rule can find there. Counting every row where it stands keeps the count
the report's, and ending on the last that prints keeps it findable.

**A flag that keeps a whole group together.** A group longer than a page
can never be kept whole, so the flag would need a rule for that case in
any event, and that rule is a count. A count at least a group's rows keeps
a small group whole where it fits, and states how much of a long one to
keep where it does not.

**The count on the table**, one for every group. Nested groups will want
a count per level, and a table's member would then need a second spelling
beside each group's.

**The renderer counting the group.** The runtime could hand over the
stated number and the renderer clamp it to the detail rows that follow the
header. That would decide what a group is a second time, from the order of
the rows' kinds, and nested groups would make it wrong. The runtime
resolves the number against the group it made; the renderer checks it and
refuses one past the rows it can see.

**pdfmake's own unbreakable stacks** for each group's first rows. pdfmake
moves an unbreakable block whole and draws nothing of one taller than its
page (0005, 0011); the renderer's blocks already keep rows together, check
what fits first, and are planned, so a second mechanism would be one more
to keep agreeing with the first.

**A least count of two**, refusing one. One spelling for each meaning, as
lengths are refused finer than they are stored. But a host or an author
writing the rule every group already has would be refused for stating it,
and the format already accepts a flag's default written out.
