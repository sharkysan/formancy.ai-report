# 0063 — A report's own words are written in each language it declares, and a render names the one it prints in

- **Status:** accepted; numbered while 0053 to 0062 were held by branches
  not yet merged; extends
  [0007](0007-a-report-definition-is-its-own-versioned-document.md),
  whose definition gains its translations,
  [0009](0009-an-expression-is-checked-and-bound-member-by-member.md),
  whose one compilation compiles an expression's translation at the
  expression's own site,
  [0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md),
  whose values are formatted, and whose rows are ordered, in the locale a
  render names,
  [0012](0012-the-builders-are-native-and-share-one-session.md), whose
  builders edit one language at a time over the same session,
  [0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md),
  whose slip prints its headings in a translated render's language,
  [0041](0041-a-renders-manifest-names-where-its-data-came-from-by-identifiers-alone.md),
  whose form source names the locale its labels were read in where it is
  not the report's own,
  [0042](0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md),
  whose labels are read in the render's locale, and
  [0052](0052-a-report-draws-a-bar-line-or-pie-chart-of-its-detail-rows-each-series-a-total-of-one-field-per-category.md),
  whose chart's words are words
- **Date:** 2026-11-15
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The format.** report-spec's `src/validate-translations.test.ts`
    holds each rule where it is written:
    - translations read back whole, and part of what the hash names; a
      report without them valid and hashed as before, which the digests
      the corpus already pins hold too (report-forms' `starter.test.ts`);
    - a translation's locale written as the report's `locale` is, refused
      twice or as the report's own (`duplicate-language`), and the
      languages bounded by `MAX_LANGUAGES`, the words and the expressions
      of each by `MAX_WORDS`;
    - a word without a letter refused (`not-a-word`), a word written
      twice in one language (`duplicate-word`), and a blank translation
      (`blank-translation`);
    - a translation held to every rule each place of its word holds the
      word to, refused at the translation and naming the place: a column
      header past `MAX_LABEL_LENGTH`, a QR-bill's message outside SIX's
      characters or past its length, a Factur-X's title holding `&`.

    `src/words.test.ts` holds the walk: every string a report holding
    every kind of component holds is either a word `reportWords` yields,
    at its place, or a string `NOT_WORDS` names, so that a string
    property added to the format without a decision fails it; a text with
    no letter is no word. `src/report-in.test.ts` holds the report in a
    language: each word and each translated expression replaced, `locale`
    the render's, the slip's language that locale's where SIX has
    headings in it and the bill's own where it has none, and no
    translations left; in its own locale the report as it is; a locale
    the report does not declare refused, and a word it lacks there.
  - **The editing core.** report-core's `src/diagnostics/words.test.ts`
    says `word-missing` once for each word and language, an error at the
    word's first place that names its language; an expression a word
    where it prints text and its source holds a quote, and neither a
    `dec("…")` that prints a number nor a text without a quote;
    `unused-translation`, a warning; a translated expression compiled at
    its source's site, its errors naming their language, and refused as
    `translation-differs` where it reads a name its source does not or
    gives another type. `src/diagnostics/diagnose.test.ts` lists them
    through `diagnose()`, for each language. `src/commands/translations.test.ts`
    holds `addLanguage`, `removeLanguage`, `translateWord` and
    `translateExpression`: each one undo step, a refusal changing
    nothing, the registry's arguments for each, so that a batch and a
    proposal can name them.
  - **The runtime.** report-runtime's `src/languages.test.ts` holds a
    render that names no locale to the report's own words, and one that
    names its own locale to the same document; a locale the report does
    not declare refused as `undeclared-locale`; a translation's locale
    printing its words in the title, a text, a column header, an empty
    table, a group header, a footer cell and a QR-bill's message, its
    numbers and dates as that locale writes them and its rows in that
    locale's order, where two locales order them differently; a word
    missing refused as `word-missing`, a preview as a final render,
    while the report's own locale prints; a translated expression
    printing a plural; the slip's headings in that locale's language, or
    the bill's own where SIX has none; the manifest naming the
    template's hash and the render's locale; and form data whose labels
    were read in another locale refused as `labels-locale-differs`.
  - **The form's labels.** report-forms' `src/read.test.ts` and
    `src/many.test.ts` read a choice's label in the locale a read names,
    refuse a locale the report does not declare, and name the locale in
    the data's source only where it is not the report's own.
    `src/generate.test.ts` holds a generated report to no translations.
  - **The PDF.** report-render-pdf's `src/languages.test.ts` prints the
    corpus's invoice in four languages in each of them and reads each PDF
    back with PDF.js: that language's words and none of another's, its
    total as that locale writes it, the slip's headings in its language,
    and the slip's QR code, decoded with `readCodes`, carrying the
    message in it; each PDF equal by `inflatedDigest` to the same invoice
    written in that language alone. And every starter and sample prints
    the same bytes with its own locale named as with none.
  - **The builders.** report-builder-core's `BUILDER_SCENARIOS` add a
    language, see its missing words as problems, write one in either
    builder, see it in the design view, switch back to the report's own
    words and undo; the core runs them against the model, and React's and
    Angular's suites in both builders, in three languages, with axe over
    the end of each. `src/css.test.ts` holds the mark of a missing word to
    the workbench's variables and the hooks both builders render.
  - **The Studio.** `apps/studio/src/studio.test.tsx` previews the
    language the builder shows, across the framework switch;
    `src/parity.test.tsx` compares both builders' trees in a report with
    a translation; the browser gate's `gate-languages.mjs` adds a
    language in each builder from the keyboard, writes a word, sees the
    Preview refuse the language while a word is missing and print the
    report's own, and undoes.
  - **Seen failing.** To be written by the changes that add each case:
    which case failed before its code, how, and on what day.

## Context

A firm in Switzerland bills in German, French and Italian, and in English
for whom reads none of them; a report about the same work goes to
readers of several languages. Each wants one template: one layout, one
set of bindings, one review when a form changes, and its words written
in each language.

Report has one language a report. What stood when this was decided:
- **One locale.** `ReportDefinition.locale` is one BCP 47 tag
  (report-spec's `definition.ts`), and `title` one string, written into
  the PDF's info (report-runtime's `resolve.ts`).
- **Words as plain strings.** A literal run is one text (`TextInline`,
  `values.ts`); a table's column headers and its empty text are strings
  (`table.ts`), and so are a chart's words (`chart.ts`).
- **The locale decides more than words.** The runtime formats every
  value in it (`format.ts`), orders rows and groups by its collation
  (`sort-group.ts`) and takes a least or a greatest text by it
  (`totals.ts`); report-forms reads a choice's label in it (`read.ts`,
  `answers.ts`).
- **Switching words already half works.** A string parameter, a
  component's condition and an expression's conditional choose words
  per render, but nothing changes the locale a render prints in, so a
  French word prints beside a German date.
- **A QR-bill's slip has a language of its own**, `paymentPart.language`,
  one of SIX's five, which may differ from the report's (0022).
- **The invoice in four languages is four reports**, made by one function
  from each language's words (`invoice-words.ts`, 0024).
- **An expression is opaque.** Upstream's parser exposes nothing of an
  expression but its source (`ExpressionAst`), and a second, partial
  parser here would be a second place to disagree with the real one
  (report-spec's `values.ts`). Nothing can tell a string literal an
  expression prints from one it compares with.

And the rules this had to keep: a report that does not use what is added
resolves and prints exactly as before; nothing is printed in another
language than the one a render names; and what cannot print whole is
refused
([formancy.ai 0022](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0022-fail-open-fail-closed.md)).

## Decision

**A report may declare `translations`: for each language besides its own
`locale`, its words written in that language. A render names the locale
it prints in -- the report's own, or one its translations declare -- and
that locale decides every word it prints, every value's format, the order
of its rows, a formancy form's labels and a QR-bill's headings. A word
missing in that locale refuses the render; it is never printed in
another.** Its rules are report-spec's `translation.ts`, which holds the
types and the walk, `report-in.ts`, which writes a report in one of its
languages, and `validate-translations.ts`.

**Its shape.**

```ts
interface ReportDefinition {
  // … as before; `locale` is the report's own language.
  readonly translations?: readonly Translation[]
}
interface Translation {
  /** A BCP 47 tag, written as `locale` is; never the report's own. */
  readonly locale: string
  readonly words: readonly TranslatedWord[]
  readonly expressions: readonly TranslatedExpression[]
}
/** A word of the report, exactly as it stands in the report's own language, and what prints for it. */
interface TranslatedWord { readonly word: string; readonly text: string }
/** An expression that prints words, by its source exactly, and the expression that prints for it. */
interface TranslatedExpression { readonly cel: string; readonly expression: Expression }
```

- **`locale` stays the report's own language**: the one its words are
  written in, and the one a render that names none prints in. A report
  without `translations` is the report it was: valid, hashed, resolved and
  printed as before.
- **The languages are the translations.** Each declares one locale,
  written as `locale` is (`LOCALE`), never the report's own and never
  twice (`duplicate-language`), at most `MAX_LANGUAGES` languages in all,
  the report's own among them. A language just added holds no words yet;
  `translations` itself is absent where there is none, never an empty
  list, so that one report has one spelling.
- **Bounded as everything is.** `MAX_LANGUAGES` is chosen, not measured,
  as most of `limits.ts`'s bounds are: twenty-four, the number of the
  European Union's official languages. `MAX_WORDS` bounds the
  words and the expressions of each language, a multiple of what the
  corpus's richest report holds, measured when it is written and saying
  how, as `MAX_REPORT_BYTES` is.

**What a word is.** report-spec's `reportWords` walks every word, at its
place, and these places are the only ones:
- the report's title;
- each literal run of a text component, and of a table's cells, its
  group's header and its footer cells, in every region;
- a table's column headers and its empty text;
- a chart's title, category title, value title and empty text, the
  label of its rows without a category, and each series' label;
- a QR-bill's message, which the slip prints for the payer to read.

A literal is a word only where it holds a letter (`\p{L}`): a separator,
a number or a sign prints as written in every language, and never asks
for a translation. Nothing else is a word, and each prints as written in
every language: a QR code's content, which a scanner reads; an EPC QR
code's texts, which only the code carries; a QR-bill's account, its
parties' names and addresses, its reference and its billing information,
which are identifiers and names, not the report's words; an e-invoice's
texts, which its XML alone holds; a field's and a parameter's label,
which the editor and the host show and nothing prints; and the runtime's
own words. report-spec's `NOT_WORDS` names every string of the format
that is not a word, so that a string added to the format is one or the
other by a decision, not by default.

**One word, one translation.** A word is looked up by its exact text in
the report's own language, spaces included, and replaced by its
translation whole. A word that stands in several places is translated
once, and the translation is held to the rules of every place it stands
in: the validator writes the report in each of its languages and
validates that report by the rules every report is held to, and what it
breaks is reported at the translation that broke it, naming the place --
a column header past `MAX_LABEL_LENGTH`, a QR-bill's message outside
SIX's characters or past SIX's length, a Factur-X title holding `&`. A
word without a letter is no word (`not-a-word`), one word is translated
once in a language (`duplicate-word`), and a translation is never blank
(`blank-translation`).

**An expression that prints words is translated whole.** An expression
run at a word's place prints words where its type is text and its source
holds a quote: CEL writes every string literal between quotes, so the
test can call too many expressions words and never too few, without a
parser of its own. Its translation is an expression of that language,
keyed by the source exactly, as a word is by its text, and is held to
what it translates:
- compiled at the same site, by the same compilation, its errors the
  same errors as any expression's, naming their language (0009);
- of the same type, and reading nothing its source does not
  (`translation-differs`), so that what reads a field -- `fieldReaders`,
  a form review, `removeFieldWithReaders`, the unused field's warning --
  is the source's alone, and no command learns of translations.

A plural, or a word that follows a number, is written this way. An
expression that prints a number, a date or a boolean prints no word:
`row.amount * dec("1.081")` holds a quote and prints a number.

**A word missing is said before any render, and refused at one.**
report-core's `languageDiagnostics(report, locale)` gives, for one
language:
- `word-missing`, an error, once for each word and each expression that
  prints words, at the first place it stands;
- `translation-differs`, an error, and every error a translated
  expression compiles to;
- `unused-translation`, a warning, for a translation of a word or an
  expression the report no longer prints.

A `Diagnostic` names the language it is about, `language`, and an error
that names one refuses a render in that language alone: a report whose
French is unfinished prints in its own language and in every language
that is whole. `diagnose()` lists every language's. A missing word is
valid, so that a session, a builder and the server hold a report being
translated, and it is never printed: there is no fallback, not to the
report's own language, and not from a region's locale to its language's.

**A render names its locale.** The runtime's `ResolveOptions.locale` is
the locale it prints in, the report's own when absent, and refused as
`undeclared-locale` unless the report's own or a translation's. The
runtime then:
1. refuses every error `languageDiagnostics` gives for that locale;
2. resolves `reportIn(report, locale)` -- report-spec's: the report with
   each word and each translated expression replaced, `locale` the
   render's, the slip's language as below, and no translations -- through
   every stage it has, so that formats, the collation of rows, groups and
   least and greatest texts, and a chart's words when charts print, all
   follow the render's locale with no stage of their own;
3. writes the template's hash, translations and all, and the render's
   locale into the manifest.

A report without translations, rendered with no locale or its own named,
takes the path it takes today.

**A QR-bill's headings follow a translated render.** In the report's own
locale the slip prints its headings in `paymentPart.language`, as it
does today, where that differs from the report's language too. In a
translation's locale it prints them in that locale's language where SIX
has headings in it (`QR_BILL_LANGUAGES`), and in `paymentPart.language`
where it has none. Its message is a word; every other text of the bill
is the same in every language, and so is an EPC QR code's caption,
Austria's words (0025). `reportIn` decides it, once.

**A formancy form's labels are read in the render's locale.**
report-forms' `readSubmission` and `readSubmissions` take the locale a
render will name, held to the report's declared locales by report-spec's
`renderLocale`, the rule the runtime's option is held to, and the report's
own when absent. A choice's label is read in it as 0042 reads one in the
report's locale: where the version has no catalogue in it, formancy gives
its default locale's label, which is the form's word, not the report's.
Data read in a translation's locale names that locale in its source
(`FormSource.locale`), and the runtime refuses form data whose labels were
read in another locale than the render's (`labels-locale-differs`); data
that names none was read in the report's own, as all data was before.
`generateReport` writes a report in one language, as 0045 decides, and
`reviewFormVersion` reads labels in the report's own.

**The builders edit one language at a time.** report-builder-core keeps
the language a person edits, the report's own at first, as view state,
as the zoom is:
- the design view and the properties show that language's words, and
  typing a word there writes its translation (`translateWord`,
  `translateExpression`), the field saying in how many places the word
  stands, a count derived from the walk;
- a word missing in it is shown as the report's own word marked missing,
  never as though it were written, and listed in the problems by its
  language;
- a language is added and removed at the report's level (`addLanguage`,
  `removeLanguage`), each one undo step, and a language removed returns
  the view to the report's own;
- the report's own words are edited in its own language alone; changing
  one leaves its translations unused and the new word missing in every
  language, until a person writes it again.

Both builders render it, held to each other by `BUILDER_SCENARIOS`
(0012). The Studio's Preview prints in the language the builder shows,
and refuses it as the runtime does while a word is missing.

**What does not change.** The server keeps a draft with its translations
as it keeps any report, validated by `validateReport` and held to
`MAX_REPORT_BYTES` (0049). The renderer draws the resolved document as it
does; the PDF still names no language of its own. `reportSpecVersion` is
unchanged: a draft-format addition, which 0.2.0, as every release before
it, refuses whole as an unknown property, never prints without its words.

**The corpus.** It holds the invoice once in four languages: the German
starter's report with its French, Italian and English words from
`invoice-words.ts`, beside 0024's samples, which stay four reports with
their own firms. Its PDF in each language is held to the same invoice
written in that language alone.

## Consequences

**What it buys.**
- **One template for every language a firm bills in.** One layout, one
  set of bindings, one hash; a column moved, a style changed or a form's
  version reviewed once for every language.
- **A translation that cannot go stale unseen.** It is keyed by the word
  it translates, so a word that changes asks for its translations again,
  and the old ones are warned of, never printed for the new.
- **Each language held to every rule its words meet.** The slip's message
  to SIX's, a chart's words to their length, a Factur-X title to its
  metadata, because the report in each language is validated as every
  report is.
- **Fail closed.** A word missing, a locale not declared and a form read
  in another locale are refused; nothing is printed in a language the
  render did not name.
- **One decision, one place.** The words are report-spec's walk, the
  report in a language report-spec's `reportIn`, what is missing
  report-core's diagnostics, and every runtime stage reads the locale
  where it read it before. A component added later is translated by
  being a word's place, with no stage of its own.
- **Nothing moves for a report without translations.** The same
  validation, hash, path through the runtime and PDF bytes.

**What it costs.**
- **One translation a word, whatever its place.** Where two places need
  two words in a language, the report's own words must differ.
- **A word changed is a word to translate again.** A typo fixed in the
  report's own language asks for it in every other, and so does a form
  review's relabel (0048), whose old word's translations it leaves
  unused.
- **Runs keep their order.** A language that puts the value elsewhere in
  a sentence writes that sentence as an expression.
- **No blank translation.** A word that a language leaves out cannot
  print nothing there.
- **Every text with a letter is a word.** A firm's name, a street or an
  address in a paragraph is written again in each language, the same.
- **Expressions are judged by a quote.** An expression that prints text
  and holds a quote is a word even where its quotes are only compared --
  `row.kind == "a" ? row.first : row.last` -- and is written again in
  each language; one that holds none is never one. Telling a literal
  printed from a literal compared needs upstream's parser to show its
  literals, which it does not.
- **A translator who writes an expression writes CEL.**
- **Codes and XML keep one language.** A QR code's content, an EPC QR
  code's texts and an e-invoice's texts are as written in every
  language; a host that wants one per language hands it over as data.
- **The slip follows a translated render, and cannot keep its own.** A
  French render of a report whose own slip is German prints French
  headings; no render in a translation's locale can keep the bill's
  language.
- **A form's label may be its default locale's.** As 0042 reads one, in
  the render's locale now.
- **The runtime's own words are English** in every language: the
  preview's and the copy's labels, and a boolean's `true` and `false`.
- **Related locales are written whole, each.** de-CH and de-DE are two
  languages, every word written in both; Switzerland writes no ß, so a
  fallback between them would print the other's spelling.
- **A script the faces lack is refused when it prints** (0043), not when
  the translation is written.
- **Validation grows with the languages.** The report is validated once
  for each language it declares, at most `MAX_LANGUAGES` times, and a
  report in many languages is a larger draft, nearer `MAX_REPORT_BYTES`.
- **The report's own language is not swapped.** Its words are the keys;
  making French the report's own is writing the report again.
- **0.2.0 refuses a report with translations,** whole: one saved with
  them opens only in a release that has them.

**What it forecloses.** Nothing that cannot be undone: the format is a
draft's. A catalogue by id, a word for each place, a language an
expression reads and a generated report in several languages would each
be another record's.

## Alternatives considered

**Each word carrying its translations where it stands**, a map of
languages beside every string, or every string a map. Every package that
reads a column header, an empty text or a title would read another type;
a translation beside a word that changes stays beside it and prints,
unread, for a word it no longer translates; and the same word is
translated in every place it stands.

**A catalogue keyed by an id**, each word a reference to it, as report
engines' resource bundles are. A column header, an empty text and a
title would each become a reference, a change to every feature that
reads one, and an id outlives the meaning of the word it named as
quietly as a word in place does.

**A report for each language**, 0024's way. Four layouts edited four
times, bindings and hashes that drift apart, and four reviews of every
form version: the gap this closes.

**A fallback**, to the report's own language or from a region's locale
to its language's. It prints in another language without a word said,
and between de-CH and de-DE it prints a spelling the reader does not
write.

**A missing word refused by the validator.** A report being translated
could not be held by a session, saved as a draft or edited a word at a
time: adding a language would be refused.

**A missing word as a warning.** A warning renders as written, and this
one would be refused at the render: the editor would call printable what
the runtime refuses.

**Words in expressions translated literal by literal.** Upstream's
parser shows no literal, a second parser would be a second place to
disagree, and a literal compared with the data must not be translated,
which only a reading of the expression's flow tells.

**A language an expression reads**, so that a condition shows a
component in one language. A word only one language prints would be no
word the walk could hold complete, and every other language's renders
would print what it left out.

**The slip's language written for each translation.** A second place to
say what the locale says, and a property a translator could leave wrong.
**The slip's own language in every render** prints a French invoice
with German headings, the four-language invoice's case.

**A form's label refused where formancy falls back.** A translated
render would follow another rule than the report's own, or every report
reading a version without a catalogue in its locale, valid today, would
be refused.

**A list of languages beside the translations.** Two places to say which
languages a report has, which could disagree; a language with no words
yet is a translation with none.

**A generated report in several languages.** A version's catalogues
could give its labels in each, but 0045's draft is a first draft in one
language, and its words a person reads before anyone prints it.
