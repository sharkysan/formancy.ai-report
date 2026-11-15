# 0063 — A report's own words are written in each language it declares, and a render names the one it prints in

- **Status:** accepted; numbered while 0053, 0054 and 0056 to 0062 were
  held by branches not yet merged; extends
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
  [0024](0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md),
  whose four invoices the corpus keeps beside one invoice in four
  languages,
  [0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md),
  whose line's name follows a translated render where the column it is
  read from prints a word,
  [0041](0041-a-renders-manifest-names-where-its-data-came-from-by-identifiers-alone.md),
  whose form source names the locale its labels were read in where it is
  not the report's own,
  [0042](0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md),
  whose labels are read in the render's locale,
  [0048](0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md),
  whose review judges a field's new type in every language the report
  declares,
  [0052](0052-a-report-draws-a-bar-line-or-pie-chart-of-its-detail-rows-each-series-a-total-of-one-field-per-category.md),
  whose chart's words are words, and
  [0055](0055-the-runtime-resolves-a-chart-exactly-its-totals-as-every-total-and-every-word-it-prints.md),
  whose chart prints its words, orders its categories and writes its
  shares in the render's locale
- **Date:** 2026-11-15
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The format.** report-spec's `src/validate-translations.test.ts`
    holds each rule where it is written:
    - translations read back whole, and part of what the hash names; a
      report without them valid and hashed as before, which the digests
      the corpus already pins hold too (report-forms' `starter.test.ts`);
    - an empty list of them refused, a language with no words yet held;
    - a translation's locale written as the report's `locale` is, refused
      twice or as the report's own (`duplicate-language`), and the
      languages bounded by `MAX_LANGUAGES`, the words and the expressions
      of each by `MAX_WORDS`, a word and its text by `MAX_TEXT_LENGTH`
      and an expression by `MAX_EXPRESSION_LENGTH`, where a translation
      no word looks up is held by no place's rule;
    - a word without a letter refused (`not-a-word`), a word written
      twice in one language (`duplicate-word`), and a blank translation
      (`blank-translation`);
    - a translation held to every rule each place of its word holds the
      word to, refused at the translation and naming the place and the
      language: a column header past `MAX_LABEL_LENGTH`, a word in a
      header and a paragraph held to the header's, a QR-bill's message
      outside SIX's characters or past its length, a Factur-X's title
      holding `&`, each language's error at its own translation.

    `src/validate.test.ts` holds a refusal case for each of the four new
    codes, as for every code. `src/words.test.ts` holds the walk: the
    places it yields, in order, with their components and columns; and
    a guard that every string the fixtures hold is either a word place
    the walk yields or a string `NOT_WORDS` names, never both, with the
    fixtures held whole by the validator's own shapes -- `check.js`
    wrapped so that every key of every shape the validator accepts is
    held by some fixture -- so that a string property added to the
    format, optional and held by none, fails it until it is decided. A
    string held only in a branch of a union the fixtures write the other
    way is review's. A text with no letter is no word.
    `src/report-in.test.ts` holds the report in a language: each word,
    at every place, and each translated expression replaced, and nothing
    else; `locale` the render's; the slip's language that locale's where
    SIX has headings in it and the bill's own where it has none; no
    translations left; in its own locale the report without its
    translations, and a report without any as it is; a locale the report
    does not declare refused, and a word it lacks there, which
    `writtenIn` leaves in the report's own; and `renderLocale` refusing
    a near locale. The corpus's `report-size.test.ts` holds `MAX_WORDS`
    to sixteen times the most words a corpus report holds, and every
    corpus report written in `MAX_LANGUAGES` languages to
    `MAX_REPORT_BYTES`.
  - **The editing core.** report-core's `src/diagnostics/words.test.ts`
    finds nothing in a whole translation, and nothing of the report's own
    language; says `word-missing` once for each word and language, an
    error at the word's first place that names its language, its
    component and its column; an expression a word where it prints text
    or a value the compiler cannot type, its run prints it as text and
    its source holds a quote, and neither a `dec("…")` that prints a
    number, a text without a quote, nor a run that prints it as a number;
    a translated expression compiled at every place its source stands,
    its errors at the translation naming their language and the source's
    component; `translation-differs` where it reads a member its source
    does not or fails to read one it does, gives another type, or
    translates an expression that prints a number -- the amount a table's
    column computes; what the report written in a language gives that
    its own does not, a total its e-invoice holds that the French page
    no longer prints among it; and `unused-translation`, a warning.
    `src/diagnostics/diagnose.test.ts` gives each of the three codes
    alone from one break, and `diagnose()` lists each language's after
    the report's own, in the order declared.
    `src/commands/translations.test.ts` holds `addLanguage`,
    `removeLanguage`, `translateWord` and `translateExpression`: each
    one undo step, a refusal changing nothing, a blank translation and a
    locale written otherwise left to the validator the session asks, and
    the registry's arguments for each, so that a batch and a proposal
    can name them; `src/commands/registry.test.ts` holds each of them to
    keeping the payment part and the e-invoice it found.
  - **The runtime.** report-runtime's `src/languages.test.ts` holds a
    render that names no locale to the report's own words, and one that
    names its own locale to the same document; a report whose French
    lacks a word printing its own language as the same report without
    translations does; a locale the report does
    not declare refused as `undeclared-locale`; a translation's locale
    printing its words in the title, a text, a column header, an empty
    table, a group header, a footer cell and a QR-bill's message, its
    numbers and dates as that locale writes them and its rows in that
    locale's order, where two locales order them differently; a word
    missing refused as `word-missing`, a preview as a final render,
    while the report's own locale prints; a translated expression
    printing a plural; the slip's headings in that locale's language, or
    the bill's own where SIX has none; the manifest naming the
    template's hash and the render's locale; a chart's title, series
    labels and null label in that language and its sorted categories in
    that locale's order; and form data whose labels were read in another
    locale than the render's refused as `labels-locale-differs`, data
    that names none read as the report's own and refused in a
    translation's.
  - **The form's labels.** report-forms' `src/read.test.ts` and
    `src/many.test.ts` read a choice's label in the locale a read names,
    refuse a locale the report does not declare, and name the locale in
    the data's source only where it is not the report's own.
    `src/generate.test.ts` holds a generated report to no translations,
    and `src/review.test.ts` a field's new type judged in every language
    the report declares.
  - **The PDF.** report-render-pdf's `src/languages.test.ts` prints the
    corpus's invoice in four languages in each of them and reads each PDF
    back with PDF.js: that language's words and none of the report's own
    words in another, its
    total as that locale writes it, the slip's headings in its language,
    and the slip's QR code, decoded with `readCodes`, carrying the
    message in it; each PDF equal by `inflatedDigest` to the same invoice
    written in that language alone. And every starter and sample prints
    the same bytes with its own locale named as with none. The corpus's
    `src/starters/invoice-languages.test.ts` holds that invoice to the
    German starter's report, whole in every language it declares, and
    written in each to the same invoice written in it alone, word for
    word.
  - **The builders.** report-builder-core's `BUILDER_SCENARIOS`, in
    `src/scenario-languages.ts`, add a language by its tag -- the
    report's own refused on the field -- see its missing words as
    problems that name it, choose it in the bar's switch, see a box
    described as missing, write a word from its field, which says in how
    many places the word stands, see it in the design view, switch back
    to the report's own words and undo; the core runs them against the
    model, and React's and Angular's suites in both builders, in three
    languages, with axe over the end of each, a `described` step holding
    each builder's descriptions. `src/languages.test.ts` holds the model:
    a report in its own language alone offering no switch and marking
    nothing; a language added and removed in one step each, the view back
    to the report's own when the language shown goes, a refusal changing
    nothing; the outline, the design view and the bar in the language's
    words, a word it lacks the report's own, marked; every field at a
    word writing its translation, every other the report's own, the
    Language field the report's own language; and one word missing in two
    languages two problems. `src/css.test.ts` holds the marks to the
    workbench's variables and the hooks both builders render, the Angular
    builder's `src/parts.test.ts` holds it to rendering every hook, and
    React's `src/properties.test.tsx` and that test hold each builder to
    marking a missing word's box and field.
  - **The Studio.** `apps/studio/src/studio.test.tsx` previews the
    language the builder shows, across the framework switch, refused
    while a word is missing and printed once it is written;
    `src/preview/pipeline.test.ts` prints the four-language invoice in
    French and refuses it a word short; `src/parity.test.tsx` compares
    both builders' trees with a language added, shown, a row of each kind
    selected in it and a word written; `src/journey.test.tsx` audits the
    blank report with a language shown; and the browser gate's
    `gate-languages.mjs` adds a language to the invoice in each builder
    from the keyboard, sees the Preview refuse it while its words are
    missing, writes its title, prints the report's own, and undoes.
  - **Seen failing.** On 2026-11-15, the format and the core: each new
    test file refused to load before the module it tests existed; the
    words guard failed on `/regions/summary/4/valueTitle` with the
    chart's value title dropped from the walk, and on an optional
    `caption` added to the table's keys that no fixture held, each put
    back; `report-in.test.ts` failed its slip and own-locale cases with
    the slip's language left the bill's and the translations kept in the
    report's own locale; report-core's `words.test.ts` failed six cases
    without the report written in the language diagnosed, every case but
    one with any text taken for a quote, and the number-format case
    without the run's format read; the corpus's `MAX_WORDS` guard failed
    at 512. On 2026-11-15 too, the runtime, the form's labels, the corpus
    and the PDF, each rule broken alone and put back: the runtime's
    `languages.test.ts` failed its unfinished-French and missing-word
    cases with an error of any language refusing every render, twenty
    cases with the locale a render names ignored, its three
    `labels-locale-differs` cases with the labels unchecked, four with a
    source's locale left unread, thirteen with the report printed as
    validated rather than written in the render's locale, the
    translation's `unsupported-locale` case with it refused at `/locale`,
    the manifest's with the printed copy hashed, and the own-locale cases
    with a named locale formatted otherwise; report-forms' review case
    failed offering both retypes over the French translation, and the
    generator's with a translation written into its draft; the corpus's
    `invoice-languages.test.ts` refused to load before its module, and
    failed with the firm's line left out of the words and with each
    language billed by its own firm; the PDF's `languages.test.ts` failed
    six cases with the slip left in the bill's language, five with values
    formatted in the report's own locale -- en-CH's by `inflatedDigest`
    alone, its total's line printing alike -- and the bytes of every
    starter and sample not in de-DE with a named locale formatted
    otherwise. On 2026-11-15 too, the builders and the Studio, each rule
    broken alone and put back: report-builder-core's `languages.test.ts`
    failed five cases with a field's own change ignored, two with a
    text's runs taken for a code's and two with no word counted missing
    from the diagnostics, and one case each with the labels of the
    report's own words, no box marked, the view kept on a language undone
    away, problems keyed without their language, a word missing given as
    its field's error, a QR code's content taken for words, every
    expression taken for words, and the places a word stands not
    counted; report-core's `wordExpressions` case refused to load before
    its function; the React and the Angular scenario failed in every
    language with the switch left out, the box not described as missing
    and the field's note not describing it, and the Angular hooks test
    with the note left out; each builder's mark test failed with the
    mark left off its field, and React's with it left off the box; the
    parity test failed at "the language added shown" with React's note
    left out; and the Studio's preview test failed with the language left
    out of the request and with the pipeline dropping it, and its
    pipeline test with the runtime given no locale.

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
- **An expression is opaque.** Upstream's parser exposes the paths an
  expression reads and rewrites them (`referencedPaths`, `rewritePath`),
  and none of its literals, and a second, partial parser here would be a
  second place to disagree with the real one (report-spec's
  `values.ts`). Nothing can tell a string literal an expression prints
  from one it compares with.

And the rules this had to keep: a report that does not use what is added
resolves and prints exactly as before; none of the report's own words is
printed in another language than the one a render names; and what cannot
print whole is refused
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
  European Union's official languages. `MAX_WORDS`, 1,024, bounds the
  words and the expressions of each language: the least power of two at
  least sixteen times the most a corpus report holds, the XRechnung
  sample's 36 words and 13 expression runs where words stand, measured on
  2026-11-15 as `limits.ts` says. A word and its translation are each
  bounded by `MAX_TEXT_LENGTH`, and a translated expression by
  `MAX_EXPRESSION_LENGTH`, where they are, since a translation no word
  looks up is held by no place's rule. The format admits more words than
  `MAX_WORDS`; a report that holds more validates and cannot be
  translated whole, each word past the bound said missing. That sample in
  twenty-four languages is 91,113 bytes, inside `MAX_REPORT_BYTES`.
- **`setLocale` relabels the report's own language**, the one its words
  are written in, and leaves its translations as they are; the validator
  refuses it for a locale a translation declares (`duplicate-language`).

**What a word is.** report-spec's `reportWords` walks every word, at its
place, and these places are the only ones:
- the report's title;
- each literal run of a text component, and of a table's cells, its
  group's header and the cells of its footer rows -- a group's footer and
  the table's totals -- in every region;
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
which the editor and the host show and nothing prints; a parameter's
default, which is a value the host may replace and may be compared with
in a condition, so that translating it would change what the report
shows; and the runtime's own words. Data prints as the host hands it
over, in whatever language the host chose: a field's value, a
parameter's, a line's description. `NOT_WORDS`, beside the walk in
report-spec's `translation.ts` and read by its test alone, names every
string of the format that is not a word, each with its reason, so that a
string added to the format is one or the other by a decision, not by
default.

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
run at a word's place prints words where it gives text -- a string, or a
value the compiler cannot type, which may be one -- its run prints it as
text, with no format or a text format, and its source holds a quote:
CEL writes every string literal between quotes, so the test can call too
many expressions words and never too few, without a parser of its own.
Its translation is an expression of that language, keyed by the source
exactly, as a word is by its text, and is held to what it translates:
- compiled at every place its source stands, by the same compilation,
  its errors the same errors as any expression's, at the translation,
  naming their language and the source's component (0009);
- of the same type, and reading exactly what its source reads, no member
  more and none fewer (`translation-differs`), so that what reads a
  field -- `fieldReaders`, `removeFieldWithReaders`, the unused field's
  warning, an e-invoice's printed totals -- reads the same in every
  language, and no command learns of translations;
- never of an expression that prints no words: a translation of one is
  refused as `translation-differs`, an error, since a number is no
  language's, and one translated would print another value in French
  than in German.

A plural, or a word that follows a number, is written this way. An
expression that prints a number, a date or a boolean prints no word:
`row.amount * dec("1.081")` holds a quote and prints a number.

**A word missing is said before any render, and refused at one.**
report-core's `languageDiagnostics(report, locale)` gives, for one
language:
- `word-missing`, an error, once for each word and each expression that
  prints words, at the first place it stands;
- `translation-differs`, an error, as above;
- every diagnostic the report written in that language -- `writtenIn`,
  its missing words left in its own -- gives that the report in its own
  does not, through the same diagnosis, a translated expression's
  pointed at its translation: so each language is held to every rule
  the report is, by the one compilation and the one set of checks, and
  a translation that leaves out the total its source printed is the
  e-invoice's `e-invoice-total-unprinted` in that language;
- `unused-translation`, a warning, for a translation of a word or an
  expression the report no longer prints.

A `Diagnostic` names the language it is about, `language`. An error
that names a language refuses a render in that language alone, and one
that names none refuses every render: the runtime refuses, before it
writes the report in the render's language, each error `diagnose` gives
that names no language or that one, so that a report whose French is
unfinished prints in its own language and in every language that is
whole. `diagnose()` lists the report's own first, then every language's
in the order declared. A missing word is valid, so that a session, a
builder and the server hold a report being translated, and it is never
printed: there is no fallback, not to the report's own language, and not
from a region's locale to its language's.

**A render names its locale.** The runtime's `ResolveOptions.locale` is
the locale it prints in, the report's own when absent, and refused as
`undeclared-locale` unless the report's own or a translation's
(`renderLocale`). The runtime then:
1. refuses every error `diagnose` gives that names no language or the
   render's;
2. resolves `reportIn(report, locale)` -- report-spec's: the report with
   each word and each translated expression replaced, `locale` the
   render's, the slip's language as below, and no translations, in its
   own locale too -- through every stage it has, so that formats, the
   collation of rows, groups and least and greatest texts, and a chart's
   words, categories and shares (0055), all follow the render's locale
   with no stage of their own; a translation's locale the engine's
   `Intl` cannot write is refused as the report's own would be, at the
   translation that declares it;
3. writes the template's hash, translations and all, and the render's
   locale into the manifest.

`reportIn` throws for a locale `renderLocale` refuses and for a word the
language lacks: a caller's mistake, which neither check that was made
lets through.

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
(`FormSource.locale`); data that names none was read in the report's own,
as all data was before. The runtime, told the report's own locale beside
the render's, refuses form data whose labels were read in another locale
than the render's (`labels-locale-differs`), a source that names none
read as the report's own: submissions read once, in German, are refused
in a French render rather than print German labels in it.
`generateReport` writes a report in one language, as 0045 decides, and
`reviewFormVersion` reads labels in the report's own. A review that
changes a field's type judges the resolution in every language the
report declares, as in its own: a resolution is offered only where
`languageDiagnostics` gives no error in any language it did not give
before, so that 0048's promise, no expression refused that was not, holds
for each translation too.

**An e-invoice keeps one language but its lines' names.** Its texts are
no words. A line's name (BT-153) is read from the column that prints it,
for the page and the XML alike (0027): where that column's value is a
word, or an expression that prints words, the line's name follows a
translated render into the XML; every other text the XML holds is the
report's own. A translated e-invoice is validated, and diagnosed, as
every report is, in each language; the e-invoice gate's external judges
see none of its languages but the report's own.

**The builders edit one language at a time.** report-builder-core keeps
the language a person edits, the report's own at first, as view state,
as the zoom is; the report-level Locale field edits the report's own
locale in every language's view (`setLocale`), as the Title field writes
the title's translation in another's. The switch between languages
stands in the bar beside the title only while the report declares more
than one, and a language is added from the report's own properties,
whose Languages group every report's has:
- the design view and the properties show that language's words, and
  typing a word there writes its translation (`translateWord`,
  `translateExpression`), the field saying in how many places the word
  stands, a count derived from the walk;
- a word missing in it is shown as the report's own word marked missing,
  never as though it were written, and listed in the problems by its
  language. Every language's problems are listed and counted on the
  outline's rows whichever is edited, as each refuses a render in its
  language; a field shows none of another language's, and no word
  missing, which its note says. Which expressions print words is
  report-core's `wordExpressions`, the verdict `word-missing` gives;
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
  in another locale are refused; none of the report's own words is
  printed in a language the render did not name.
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
  A line's name is the exception, where its column prints a word, and a
  translated e-invoice's XML then holds names in its language beside
  terms in the report's own; the e-invoice gate judges no translated
  PDF/A-3b or XML.
- **Data prints in the host's language.** A field's value, a parameter's
  value and a parameter's default print as handed over, in whatever
  language the host chose; nothing checks it, but a form's labels.
- **A translator sees no PDF of a language until it is whole.** The
  Preview refuses a render in it, a labelled preview among them, while a
  word is missing; the builders show the words it lacks instead.
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
- **Validation grows with the languages.** The report is validated, and
  diagnosed, once for each language it declares, at most `MAX_LANGUAGES`
  times, and a report in many languages is a larger draft, nearer
  `MAX_REPORT_BYTES`.
- **A report of more than `MAX_WORDS` words cannot be translated whole.**
  It validates; each word past the bound stays missing in every language.
- **An expression's translation reads what its source reads.** A language
  that needs another field to agree with -- a gender, a count -- writes
  the report's own expression so that it reads it too.
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

**A preview of an unfinished language, its missing words marked.** It
would print the report's own words, marked, in a language that has none
of them, which this decision never does, and a preview that prints
otherwise than a final render is a second path through the runtime. The
builders show the missing words where they stand instead.

**A translated expression that may read less than its source.** It would
keep a field's readers the source's, but a language could then print
fewer totals than the XML holds, and the report in that language would
be diagnosed otherwise than its own.

**A parameter's default as a word.** A default is a value a condition
may compare with; translated, the same data would show other components
in French than in German.

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
