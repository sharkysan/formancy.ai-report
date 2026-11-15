# 0061 — A paragraph's run may be set below or above the line, in any character its face draws, and prints only beside a run on the line

- **Status:** accepted; extends [0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md) (the corpus reads a run set below or above the line into the line it stands on, and holds its size and its baseline), [0007](0007-a-report-definition-is-its-own-versioned-document.md) (a paragraph's run may carry a baseline), [0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md) (the document's run carries it, and the document says what it prints as), [0011](0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md) (the renderer sets it with pdfmake's own `sub` and `sup`, and refuses a word that could leave it alone on a line) and [0012](0012-the-builders-are-native-and-share-one-session.md) (a person sets one in either builder with two buttons on each run); numbered while 0053 to 0060 were held by branches not yet merged
- **Date:** 2026-11-15
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The format.** report-spec's `src/validate-baseline.test.ts` holds
    each rule where it is written:
    - a run of each kind that takes one -- literal text, a field, a
      parameter, an expression and an aggregate -- set below and above
      the line, read back whole in a paragraph of the body, of a page
      region, of a section, of a columns block and of a keep-together
      block, and part of what the hash names, where a report that sets
      none hashes as `src/hash.test.ts` pins it;
    - a value other than `subscript` and `superscript` refused, and a
      `baseline` on a page number or a page count refused as
      `unknown-property`;
    - `misplaced-baseline` in a QR code's content, an EPC QR code's
      texts, a QR-bill's texts, an e-invoice's texts, a table column's
      value, a footer cell and a group header.

    report-forms' `src/review.test.ts` holds a relabel of a run set above
    the line to keeping it there.
  - **The runtime.** report-runtime's `src/lower.test.ts`: a paragraph's
    literal and bound runs carry their baseline into the document, and a
    run that sets none carries no key, so a document of a report that
    sets none is the one it was.
  - **The renderer, on the PDF.** report-render-pdf's
    `src/shifted.test.ts`, read back with PDF.js:
    - in Roboto and in the corpus's Liberation Serif, each run set below
      or above the line drawn at `SHIFTED_SIZE` of its paragraph's size,
      its baseline moved by `SHIFTED_RISE` of that size, to a hundredth
      of a point, on the line of the text beside it, its characters as
      typed;
    - a paragraph wrapped so that a raised and a lowered run stand on
      its second line, overlapping nothing above or below them;
    - refused as `unsupported`, naming the block: a paragraph whose every
      run is set below or above the line, and one whose run so set
      follows a space at its end; refused as `content-too-large`: a word
      that holds one and is wider than its line.

    `src/bounds.test.ts` counts a run so set at its own line, never more
    than pdfmake lays out; `src/pdfmake.test.ts` holds that pdfmake
    0.3.11 still writes a text node's words as `_inlines`, each with
    `sup`, `sub`, `noNewLine` and `width`, where the renderer reads them;
    `src/corpus.test.ts` renders the corpus's `SHIFTED_FIXTURES` and
    passes every check.
  - **The proof's reader.** report-corpus's `src/lines.test.ts`: a run
    drawn at `SHIFTED_SIZE` of the run beside it and moved by
    `SHIFTED_RISE` joins that run's line; a small run moved otherwise,
    and a line of small text of its own, stay lines of their own.
    `src/check-text.test.ts`: `shiftedRuns` fails a run expected below
    or above the line that is drawn on it, at another size, or moved
    otherwise.
  - **The builders.** report-builder-core's `src/baselines.test.ts`: the
    selected text split from its run and set, snapped to whole
    characters, its neighbours on the same baseline joined again; a
    bound run set whole; a split past `MAX_INLINES` refused, the report
    unchanged. `src/properties.test.ts`: each run of a paragraph a group
    of its own with its two buttons, pressed as the run is set, and none
    for a QR code's content, a payment part's or an e-invoice's texts or
    a table's values. `BUILDER_SCENARIOS`' scenario that sets a run
    below the line from the keyboard and undoes it, run by the core
    against the model, by React's `src/scenarios.test.tsx` and Angular's
    `src/scenarios.test.ts`, with axe at its end, in three languages; the
    Studio's `parity.test.tsx` and the browser gate's `gate-parity.mjs`
    compare the two builders' trees, which hold the buttons.

## Context

A report prints a formula's digits and a unit's power: H₂O, CO₂, m²,
10⁻³, a footnote's mark. Report could print only what Unicode gives a
raised or lowered form of, typed as that character, and only where the
face maps it. The forms are few -- digits, five signs, a handful of
letters (U+2070–209F, which `font-scripts.ts` prints) -- and faces map
fewer: read with fontkit 2.0.4 on 15 November 2026, Roboto 3.014 maps
the digits and the signs but no lowered letter (U+2090–209C) and no
raised i (U+2071), which the renderer refuses as `unsupported`
(`glyphs.ts`); Liberation Serif 2.1.5, the corpus's host face, maps no
raised zero (U+2070) and no raised or lowered sign (U+207A–207E,
U+208A–208E). A lowered x, a raised n or a raised minus could not be
printed in every face, and a raised letter in none of Roboto's.

What the format, the runtime and the renderer had to build it from:
- **Runs without a style.** A paragraph's content is runs -- literal
  text, a field, a parameter, an expression, an aggregate, a page number
  or count (`INLINE_KINDS`) -- and a print style attaches to a component
  or a table's cell, never to a run
  ([0007](0007-a-report-definition-is-its-own-versioned-document.md)).
  The resolved document's run already carries a weight of its own, which
  nothing writes yet (`document.ts`).
- **One string per cell.** A table's cell, a footer cell and a group
  header are one string in the resolved document (`TableRow.cells`),
  measured by the renderer's `styledRows`; a column's value is one run.
- **Runs a code encodes.** A QR code, an EPC QR code, a QR-bill and an
  e-invoice read runs as a paragraph does and encode the text they join
  to (0020, 0022, 0025, 0027).
- **An engine that sets a run below or above the line.** pdfmake 0.3.11,
  the engine 0005 chose and the renderer pins, takes `sup` and `sub` on a
  run: `TextInlines.js` sets the run at 58 % of its size, and
  `Renderer.js`'s `offsetText` moves its baseline up by 0.75 of that
  reduced size, or down by 0.35 of it, when it draws the run. It lays the
  line out first, as tall as its runs' own lines and its baseline its
  tallest ascender down (`Line.js`), so the move takes no room: a line of
  nothing but such runs is laid out as small as they are and drawn above
  its own top. The renderer never wrote either property (`content.ts`).
- **A proof that reads lines by their baseline.** The corpus rebuilds a
  page's lines from runs whose baselines lie within 0.3 of the smaller
  size of each other (`lines.ts`), so a run moved by 0.435 of its line's
  size is a line of its own, and "H2O" would not be found.

A field read as a formula -- C6H12O6 printed with its digits lowered --
is the other half of roadmap item 8, rich text from data, and not this
record's (below).

## Decision

**A run of a paragraph may be set below or above the line, as
`baseline: 'subscript'` or `baseline: 'superscript'`, in any character its
face draws. It prints at pdfmake's own size and offset, which the
document states as Report's, and the renderer refuses a paragraph in which
pdfmake could set it on a line with no run on the line beside it.**

**In the format.**
- **A property of the run.** Literal text, a field, a parameter, an
  expression and an aggregate take an optional `baseline`, one of
  report-spec's `BASELINE_SHIFTS`, `subscript` or `superscript`; absent,
  the run stands on the line. A value can be raised as literal text can:
  an exponent read from a field, a footnote's number from a parameter.
- **Not a page counter.** A page number and a page count take no
  `baseline`, refused as `unknown-property`: a page's number raised is no
  formula, and the field is the engine's to fill.
- **In a paragraph alone.** A text component's runs, in any region, may
  carry one. Anywhere else a run is read, a `baseline` is refused as
  `misplaced-baseline`:
  - **What a code encodes** -- a QR code's content, an EPC QR code's,
    a QR-bill's and an e-invoice's texts -- is its text alone, and a
    run's place above or below the line is no part of it. A property
    accepted there and ignored would be one that does nothing.
  - **A table's cell** -- a column's value, a footer cell, a group
    header -- prints one string at one size. A column's value is one run,
    so its baseline would move the whole cell, which is no formula, and a
    group header's runs are joined into one string before the renderer
    sees them.
- **A draft-format addition.** `reportSpecVersion` is unchanged, and so
  is every report that sets no baseline, its hash among it. A release that
  predates the property, 0.2.0 among them, refuses a run that sets one as
  `unknown-property`, never printing it on the line.

**In the document.** The resolved document's literal run carries the
`baseline` its source run set, and a run that sets none carries no key.
`document.ts` states what it prints as, for any engine: at
`SHIFTED_SIZE`, 0.58, of its paragraph's size, its baseline moved by
`SHIFTED_RISE` of that size, 0.435 up for `superscript` (0.75 × 0.58) and
0.203 down for `subscript` (0.35 × 0.58), in the face its paragraph
prints in. The runtime re-exports the names from report-spec, so the
format and the document cannot name different ones, and the renderer and
the corpus read the geometry from the runtime, which both depend on.

**In the renderer.**
- **pdfmake's own, and nothing else.** A run set below the line is handed
  to pdfmake with `sub: true`, one above with `sup: true`. The renderer
  states no offset of its own: pdfmake takes none, and its numbers are the
  document's, held on the PDF by `shifted.test.ts`, so a pdfmake release
  that moved them fails a test before it moves a printed formula.
- **Measured as pdfmake measures it.** `bound.ts` counts such a run's line
  at `SHIFTED_SIZE` of the paragraph's, as pdfmake lays it out, so the
  least height stays never more than pdfmake's. The face's glyph check is
  the paragraph's, as any run's (`check.ts`).
- **Never alone on a line.** Once pdfmake has measured a paragraph that
  holds such a run, and before it lays out a line -- where `words.ts`
  reads its widest word -- the renderer reads pdfmake's own words, the
  inlines it chains with `noNewLine` so that a line never breaks inside
  them. Every word that holds a run set below or above the line must hold
  a run on the line too, or the paragraph is refused as `unsupported`,
  naming it: pdfmake could set that word on a line of its own, laid out
  at the small run's height and drawn above its top, into the line
  before. And the word must fit its line, or it is refused as
  `content-too-large`: pdfmake breaks a word wider than its line anywhere,
  and a piece of it could stand alone. The breaks are pdfmake's, read
  from it, never a second rule here. Only a paragraph that holds such a
  run is read, so every other paragraph is laid out as it was.

**In the proof.** The corpus's line reader joins a run drawn at
`SHIFTED_SIZE` of a run beside it, its baseline that run's moved by
`SHIFTED_RISE`, to that run's line, and records it there with its text,
its size and its move, so that "H2O" is read as one line and a check finds
it. `expectation` derives the runs a document sets below or above the
line, and `shiftedRuns` holds each, on the PDF, to its size and its
baseline. The fixtures that do are `SHIFTED_FIXTURES`, beside
`SVG_FIXTURES` and outside `ALL_FIXTURES`, the corpus the renderer trial
chose an engine against.

**In the builders.**
- **Two buttons on each run.** In a paragraph's properties, each run is a
  group of its own, named as its field is now ("Text", "Part 2: Text"),
  holding its field and two toggle buttons, Subscript and Superscript, in
  the editor's three languages, each pressed while the run is set so.
  From the keyboard: Tab into the run's field, select the characters with
  Shift and the arrows, Tab to a button and press it.
- **On the selection, or the whole run.** Pressed on a literal run with
  text selected in its field, a button splits the selection from its run
  and sets it, snapped to whole characters (`Intl.Segmenter`'s
  graphemes); with nothing selected, or on a bound run, it sets the whole
  run. A pressed button sets its text back on the line. Literal runs left
  side by side on one baseline are joined again, so the content stays in
  as few runs as it can. Each press is one `updateComponent`, one undo
  step; a split past `MAX_INLINES` is the validator's to refuse, and
  changes nothing (0008).
- **Decided once.** builder-core holds the split, the join and the
  buttons (`baselines.ts`); a builder adds only the selection, which only
  the DOM knows, read from the group's own field when its button is
  pressed. A binding changed in a run's field keeps its baseline.
- **Not drawn in the design view.** The design view labels a box with its
  text, "H2O", as it labels every text; the Preview is the PDF and shows
  the run where it prints.

**A field read as a formula is not this record's.** A text format that
lowered the digits after a letter or a closing bracket would turn one
value into runs, where a format yields one string, and would guess at a
meaning the field does not carry: A4 and B12 are no formulas, m2 asks for
its digit raised, a charge as in SO₄²⁻ for a lowered digit then raised
ones, and an isotope's mass, ¹⁴C, stands before its letter. Data that
holds a formula can carry Unicode's lowered digits, U+2080–2089, which
Roboto and Liberation Serif both map. Formatted text read from a field is
roadmap item 8's other half, and another record's.

## Consequences

**What it buys.**
- **Any character, raised or lowered.** A formula's digits, a unit's
  power, an exponent and a footnote's mark print in whatever the
  paragraph's face draws, a lowered letter in Roboto among them, and a
  raised minus in Liberation Serif.
- **A value too.** An exponent, a footnote's number or a unit read from
  the data is raised as a template's own text is.
- **Nothing printed over the line before.** A run so set always shares
  its line with a run on the line, which keeps the line its full height,
  or the paragraph is refused; it is never drawn into the line above.
- **One geometry, proved.** The size and the move are stated once, in the
  document, read by the renderer's bound and by the corpus, and held to
  what pdfmake draws on the PDF.
- **Fail closed where it means nothing.** A code, a payment part, an
  e-invoice, a table and a page counter refuse a baseline where it is
  written, rather than accept it and print the run on the line.
- **Existing reports untouched.** A report that sets no baseline
  validates, hashes, resolves and renders as before: the document holds
  no new key, the renderer reads no new word, and the corpus joins no run
  it did not join. No starter, sample or fixture of `ALL_FIXTURES` sets
  one, so the pictures of the starters, the e-invoice gate's variants and
  the browser gate's PDFs are what they were.

**What it costs.**
- **One size and one move.** A run is set at 58 % of its paragraph's
  size and moved 43.5 % up or 20.3 % down, pdfmake's numbers. A face's
  own superscript and subscript metrics (its OS/2 table's) are not read,
  and a run cannot be set smaller, larger, higher or lower.
- **No room of its own.** pdfmake lays the line out as though the run
  stood on it, so a raised run reaches above its line's text and a
  lowered one below. By the corpus's box -- one size tall, a fifth below
  the baseline -- a raised run reaches 0.899 of the paragraph's size
  above the baseline where the line's own text reaches 0.8, and a lowered
  one 0.319 below where it reaches 0.2. Computed from the faces' lines,
  read with fontkit 2.0.4 on 15 November 2026, and not measured on a
  PDF: in Roboto, whose line is 1.172 ems, the boxes stay apart
  from the lines above and below; in Liberation Serif, 1.107 ems, a
  lowered run's box reaches 0.012 of the size into the next line's, under
  the corpus's one-point allowance at any size below 83 points. By the
  glyphs, a lowered g can touch an Ä on the line below, by 0.026 ems in
  Roboto and 0.031 in Liberation Serif, and a raised Ä a g on the line
  above, by 0.014 ems in Liberation Serif, each read from the glyphs'
  boxes with fontkit; the corpus's boxes do not see it, as they see no
  touching accent (0003). A host face of a shorter line is not proved
  (0043).
- **Joined to a run on the line, or refused.** A run set below or above
  the line prints only inside a word with a run on the line, as pdfmake
  breaks words (Unicode's line-breaking rules, by the `linebreak` package
  it carries). A footnote's mark after a space, or at the head of its
  text before one, is refused: it is written against its word, or with a
  no-break space, U+00A0, which Roboto and Liberation both map. A value
  read from the data decides it too, so a field set below the line that
  prints a space, or a run beside it that prints nothing, refuses the
  render, a preview as a final one.
- **The builders do not foresee it.** Nothing in either builder says a
  run would stand alone; the Preview is refused, naming the paragraph.
- **The text layer reads it on the line.** PDF.js extracts "H2O", not
  "H₂O": a search or a copy of the PDF finds the digit as typed, and an
  untagged PDF tells a screen reader nothing of where it was set.
- **Not in a table, a code or a payment part.** A unit's power in a
  column's header or a cell is printed as Unicode's raised form, ², ³,
  where the face maps it, or not at all. Making a cell runs is a change
  to every table's document and to its measure, and another record's.
- **No formula read from a field.** As said above, C6H12O6 from the data
  prints on the line unless the data carries Unicode's lowered digits.
- **Each text's properties are longer.** Every run of a paragraph is a
  group with two buttons, so the panel of every text grows, the builders'
  tests that list a text's controls list them, report-builder-core's
  README describes the group, and the README picture that shows a text's
  properties is retaken with `node scripts/pictures.mjs`.
- **A selection is cut at characters, not at runs.** A split adds up to
  two runs, bounded by `MAX_INLINES`; a paragraph near it refuses a split
  that would pass it.
- **pdfmake's own fields are read.** `_inlines`, `noNewLine`, `sup`,
  `sub` and an inline's `width` are not pdfmake's API;
  `pdfmake.test.ts` holds 0.3.11 to them, and an upgrade reads them
  again, as `_minWidth` already is (`words.ts`).
- **No browser gate sets one.** The scenarios hold both builders in
  jsdom, the parity checks compare their trees in Chromium too, and the
  renderer's tests hold the PDF; no gate sets a run below the line
  through the Studio and reads its Download PDF.
- **0.2.0 refuses a report with a baseline**, whole, as
  `unknown-property`: a report saved with one opens only in a release
  that has the property.

**What it forecloses.** Nothing that cannot be undone: the format is a
draft's. A size or a move of a run's own, a baseline in a table's cell,
and formatted text read from a field would each be another record's.

## Alternatives considered

**Unicode's raised and lowered characters, written in place of the
run's.** The text layer would read "H₂O", and nothing would need a
property. But the forms are digits, signs and a few letters, and a face
maps fewer: Roboto no lowered letter, Liberation Serif no raised zero and
no sign. A formula would print in one face and be refused in another, and
a character typed as such prints already, without this record.

**A baseline on literal text alone.** It is the template's own text the
roadmap asks for, and a smaller format. But an exponent or a footnote's
number read from the data is as common, the property costs the same on
every run kind, and a field run raised by the renderer is the same run.

**A size and a move of Report's own**, a face's OS/2 metrics among them.
pdfmake takes `sup` and `sub` and no offset: another geometry would mean
drawing the run outside pdfmake's text, or a patched pdfmake, which is
0002's copy.

**Room made for the run in its line**, as CSS and word processors make
it. pdfmake lays a line out by its runs' own lines and ascenders, and
moves a run only when it draws it, so room above a raised run cannot be
asked of it. A taller line for the whole paragraph that holds one would
set its lines apart from the paragraphs around it, and still leave a
line of nothing but such runs drawn above its own top.

**The join held by the format.** The validator sees literal text alone:
a field's value, a run that prints nothing and where pdfmake breaks a
line are known only at print, and a second line-breaking rule in
report-spec would disagree with pdfmake's, which nobody would find until
a page did. The renderer reads pdfmake's own words.

**A run alone on a line drawn and accepted.** The line before would be
printed over, a raised digit's top 0.07 of the size above that line's
baseline in Roboto: text over text, which the repository refuses rather
than prints (0003, 0011).

**A baseline in a table's cell.** The resolved document's cell is one
string, measured once by `styledRows`. A column's value is one run, so
the whole cell would move; a group header's runs would have to become
runs of the document, and every table's measure with them.

**A shortcut in the run's field, as word processors have.** A text field
keeps its own keys, and the editor is never asked by one (`keys.ts`); a
shortcut nobody sees is no keyboard path for a person who does not know
it. Buttons are reached with Tab, named, and say whether they are
pressed; a shortcut can be added over them later.

**One pair of buttons for the whole paragraph**, acting on the field
last focused. The panel would be shorter, and the buttons would act on a
field a screen reader's user can no longer see named; a run's own group
says which text a button sets.

**A text format that lowers a formula's digits.** Left out, as the
Decision says: it would guess, and it is formatted text from data.
