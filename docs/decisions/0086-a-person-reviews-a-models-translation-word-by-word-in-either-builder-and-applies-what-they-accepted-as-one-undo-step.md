# 0086 — A person reviews a model's translation word by word in either builder, and applies what they accepted as one undo step

- **Status:** accepted for the editor model, report-builder-core's; both builders' drawing of it, and the scenarios that hold them to it, come with a later pull request, which adds to Verified by; numbered while 0084 was held for a branch not yet merged, and merged after [0088](0088-an-agent-gets-reports-checks-over-the-model-context-protocol-from-a-server-of-reports-own.md), [0089](0089-the-mcps-render-check-reads-the-pdf-back-with-pdfjs-at-the-corpuss-pin-the-first-published-package-that-carries-it.md) and [0090](0090-a-preview-opens-a-report-that-carries-a-qr-bill-with-its-slip-in-view-and-nothing-moves-the-paper-after.md); extends [0012](0012-the-builders-are-native-and-share-one-session.md), whose one editor model it adds to, [0063](0063-a-reports-own-words-are-written-in-each-language-it-declares-and-a-render-names-the-one-it-prints-in.md), whose one language at a time it reviews in, and [0085](0085-a-model-is-asked-only-for-the-words-a-language-lacks-and-its-answer-is-one-batch-held-to-the-format-and-the-compiler-before-a-person-sees-it.md), whose proposal it shows; reads again the start page's guard of [0056](0056-the-start-page-leads-with-a-card-for-each-topic-report-is-built-around-every-card-on-the-site-names-the-tests-it-rests-on-and-no-page-compares-report-with-another-product.md), under which report-builder-core is the one package that takes report-ai; follows formancy.ai 0157, 0161 and 0164, and departs from 0161 and 0164 in one place each, said below
- **Date:** 2026-11-28
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The model, alone.** `packages/report-builder-core/src/translation-review.test.ts`,
    against a model scripted to answer when the test says so, from the
    request it was sent: no model given, nothing drawn and every action
    refused, and a model with no `ask` refused as the editor is made; Ask
    offered in a language that lacks words, counting them as the switch
    does, and refused in the report's own language and in one that lacks
    nothing, asking nobody; the run waiting with Stop and its answer held
    as rows, nothing applied; a row saying where its word stands in the
    editor's words, what the focus moving into it selects, and its toggle
    named by its text and its source, and one whose word the report no
    longer prints standing nowhere and selecting nothing; the run held for
    its language, and under another only said, every action refused there
    in that sentence;
    a language removed while its run waits stopping the run, its model
    told, and said under every language, and one removed while its review
    is held taking the review with it; rows accepted one at a time, taken
    back and all, a toggle pressed where it is changing nothing and
    telling no listener; Apply one undo step, labelled with the language
    and the count, made with the proposal's `expectedHash`, the words not
    accepted still missing and Undo taking back exactly what it wrote, the
    step said in each editor's own words; Apply refused once the report
    moved, nothing changed, and Review again leaving out what a person
    wrote, said under the table, with no new turn; another refusal said in
    the session's words; Discard forgetting a waiting run, its model told
    and its later answer never held; a run's ending landing only while it
    is the one in flight; Stop, a decline, a model not reached with and
    without a reason, a busy one, one that never answered as asked, and a
    request too large to send, each said as itself, and a run that came to
    nothing said under its own language alone; a disposed editor asking
    nobody and stopping its run; what was refused, dropped and is a
    person's to write said outside the rows; a model that wrote nothing
    told from one whose every word was refused; and the answer's `later`
    and `noRoom` said, a language with no room left never said as one that
    lacks nothing. `text.test.ts` holds every word of it to each of the
    three catalogues, in each language's own words and with English's
    placeholders, and Swiss French's colons and guillemets to their
    no-break spaces.
  - **The start page.** `apps/pages/src/limits.test.ts` holds "No changes
    described in words in the builders" to report-builder-core being the
    one published package beside report-ai that takes it, and to what its
    source calls of it being `translateMissing`, `proposeTranslation` and
    `createStop`, never the turn itself, with which it could ask a kind of
    its own.
  - **The packed package.** The install gate's
    `scripts/install-fixture/translation.ts`: report-builder-core's editor,
    given `askThrough` over the scripted server, asks for the quotation's
    French, holds the rows, accepts them all and applies them as one step
    labelled with the language and the count, under Node, from the
    tarballs.
  - **Seen failing on 28 November 2026**, each fault planted in the
    source and the file put back: Apply as one step per word (three
    cases); the review drawn under any language (two); an ending landed
    whatever run is in flight (three); a language's removal keeping its
    run (two); Apply made with no hash (three); Review again keeping the
    old proposal (one); Discard keeping the run (two); a toggle named by
    its text alone (two); `later` and `noRoom` unsaid (one); Ask offered
    while a review is held (one); dispose keeping the run (one); a request
    too large said as stopped (one); a toggle telling its listeners when
    nothing changed (one); a model that wrote nothing said as one whose
    words were refused (one); what was left said as unasked whatever the
    room (one); Ask in the report's own language (one); a run that came to
    nothing said under another language (one); a row whose word is gone
    given a place (one); a toggle with nothing held taken as done (one); a
    German sentence left in English, a French one without its count, and
    French's no-break space written as a plain one (one each, in
    `text.test.ts`); and the start page's guard, with report-builder-core
    taking report-ai under the old predicate, and with `askChecked`
    imported under the new.
  - **The builders' half, to come**, with the builders that draw it: the
    scenarios of `scenario-translation.ts`, run by `report-builder-react`
    and `report-builder-angular` with axe over the end of each in three
    languages and by the core against the model; the two trees compared
    with a review held; `css.test.ts` for the review's hooks; and
    `structure.ts` for the review as report-builder-core's README describes
    it; to be seen failing then: the focus left on the page's body after
    Apply.

## Context

A model's answer to 0085's request becomes a proposal: rows that compile
and print what their sources print, refused entries with their reasons,
what was dropped and why, what is still missing, the payment part's words
for a person, what the turn left for another and which lists have no room
left, and one batch against the report's hash. Something has to show it to
a person and apply what they agree to.

The builders edit one language at a time (0063): the switch in the bar
chooses it, each word's field writes it, and the problems list what it
lacks. Both builders are native over one editor model, and what they both
do is decided once in report-builder-core and held by `BUILDER_SCENARIOS`
(0012). The editor outlives a switch of framework: the Studio keeps one per
starter, and a builder drawn again draws the editor it is given. The
editor sees every change of its session, an undo or another editor's
included.

formancy's review of a translation (formancy.ai 0161) is a table of every
message beside its source and what was there, applied whole in one step;
per-message acceptance was rejected as "an undo step per message and a
second way to apply". Its run belongs to the host and is held for its
language, so that it survives the pane going away; a language that leaves
the form while its run waits is said to have gone, its Stop or Discard
offered from every language, because formancy's holder does not see the
session's edits (formancy.ai 0163, 0164).

## Decision

**A person reviews a model's translation one word at a time, accepts one,
several or all, and applies what they accepted as one undo step; the
review is report-builder-core's, so that both builders draw the same one.**

- **A model, given by the host.** `ReportEditorOptions.model` is
  `{ ask }`, report-ai's `AskModel` for its request kinds: `askThrough`
  over the host's server, or any other. Without it the state's
  `translation` is null and a builder draws nothing new; with one whose
  `ask` is no function, the editor is not made.
- **Ask.** Where the language edited lacks words, the state's
  `translation.ask` says *Ask a model for the missing words: 12*, its
  count report-core's `word-missing` in that language, as the switch
  counts them; in the report's own language, and in one that lacks
  nothing, there is none. `editor.askTranslation()` asks: it is no action,
  as `addImage` is none, because a run takes time and `dispatch` is
  synchronous (0008); it resolves once the run ends, done where an answer
  is held and `not-answered`, a new refusal code, where it ended without
  one or was discarded first. One run at a time, and one held review: while
  a run waits or a review is held, for any language, Ask is refused as
  `busy`. After Apply, the same Ask, counting what is still missing, asks
  for the rest.
- **While it waits**, `busy` and Stop, and the part's status says a model
  is being asked. Stop ends the run as stopped, its model told
  (formancy.ai 0157).
- **The review.** A region named by its heading, *French (Switzerland): a
  model's translation, words to review: 12*, over a table whose columns are
  the report's own language, where a word stands, the language edited and
  whether a row is accepted. Each row: its source, where it stands in the
  editor's own words -- the outline label of each component and column it
  stands in, or the title -- the proposed text, and a toggle, `accepted`
  for `aria-pressed`, named *Accept "Facture" for "Rechnung"*, by both
  texts and never the text alone. **One word at a time**: each row names
  what the focus moving into it selects, the first component or column its
  word stands in, so that the design view shows its place; the builders
  draw the part in the properties pane whatever is selected, since that
  selection would otherwise replace the report's own properties the part
  stands in. *Accept all*, *Apply the accepted words: 3* and *Discard*.
  An answer with no row to apply is held for its status and its notes, not
  for review, and Ask is offered again (formancy.ai 0161).
- **Outside the rows**, a sentence each: an entry refused and the
  sentence that refused it, as report-ai gives it; the entries dropped,
  by reason, each by its source; the payment part's words, for a person to
  write; how many the model left untranslated; how many were left for
  another run, or, where a list has no room left, not asked; and each list
  that has no room left for more, so that a language with no room left is
  never said as one that lacks nothing (0085's `later` and `noRoom`).
- **One undo step.** Apply is one `batch` of the accepted rows' steps,
  applied through the session with the proposal's `expectedHash`, labelled
  *Translate words into French (Switzerland): 3*, whatever the count, the
  label said in each editor's own words. Refused as stale, nothing
  changes, the part says the report changed, and offers *Review again*,
  which reads the held answer against the report as it stands with no new
  turn, leaving out what a person wrote meanwhile and keeping each row
  that stays accepted as it was. Applied, the review goes, and the editor's
  live region says how many words landed and how many are still missing.
- **Held for its language**, as formancy.ai 0164 holds one, and held by
  the editor rather than a pane, so that a builder switched or drawn again
  draws the same run. Under another language the part says only that a
  model is translating into French, or that its translation waits for
  review there, and draws nothing of it; asking, stopping, accepting,
  applying or discarding there is refused in that sentence. A run that
  came to nothing is said under its own language alone. **A language
  removed** while its run waits, or while its review is held, takes the
  run and the review with it, its model told to stop, and the part says so
  under every language until another run is asked; the removal undone
  brings neither back.
- **Discard** forgets what is held under its language and a run that
  waits, its model told; an answer arriving later is held for nobody.
  **Only the run in flight lands**: each run has a stop of its own, and
  what it came to is taken only while it is still the run in flight, so
  that an answer to a run discarded, removed or stopped is never held as
  the next one's (formancy.ai 0164's run holder). A disposed editor stops
  its run.
- **The status**, the part's own polite live region, in formancy's order:
  a run waiting, an Apply refused, a run that ended without an answer --
  stopped, given up after its attempts, a model not reached with its
  reason or without, busy, declined with its reason, or a request past
  `MAX_MODEL_REQUEST_BYTES` never sent -- then what is ready and what would
  still be missing with every row applied; elsewhere, where the run is.
  Every word from the editor's catalogue, in English, German (Switzerland)
  and French (Switzerland), in `text-model-*.ts`, each count after a colon
  as every count of the catalogue is, so that no language needs a plural;
  each language's name by Intl.
- **Decided once.** The run, the rows and their acceptance, the
  sentences, `askTranslation` and the actions `stopTranslation`,
  `acceptTranslation`, `acceptAllTranslations`, `applyTranslation`,
  `discardTranslation` and `reviewTranslationAgain` are
  report-builder-core's (`translation-review.ts`, lent what it needs of the
  editor as `images.ts` is; `translation-words.ts`; the state's types in
  `model-translation.ts`). The builders draw the state, move the focus --
  after Apply to Ask where words remain, which the state still offers, or
  to the language switch where none do -- and hand the actions on.
- **Held to each other** by new `BUILDER_SCENARIOS`, whose model field --
  a scripted answer for each turn -- every runner implements, with the
  builders that draw the review.

## Consequences

**What it buys.** A person sees every word before any lands, beside the
place it prints, and keeps the ones they can vouch for: someone who reads
French well enough for the headings and not for the terms accepts the
headings alone, and the rest stays missing, said as it was. Undo after
Apply puts back exactly what was there. The two builders cannot disagree
about when a row may be applied, what a run's ending says, or where a run
waits, because neither decides it. A turn carried by a person, or paid for
by the host, survives a builder drawn again and another language looked
at.

**What it costs.** **Per-row acceptance is a departure from formancy.ai
0161**, which applied a translation whole. It costs a toggle per row, a
second state per row both builders draw, and a person who presses *Apply*
without accepting anything is told to accept a word first; it is not a
second way to apply, since one Apply is one step. **A language removed
takes its run and its review with it, a departure from formancy.ai 0164**,
which keeps a held translation and says its language has gone: the editor
sees the removal, so the run ends there rather than wait under no
language; a person who removes a language by mistake, or undoes its
adding too far, and redoes it, asks again, and a turn carried by hand is
carried again. **Nothing edits a proposed word in the review**: a person
accepts it and corrects it in its field, two steps rather than one. A
review of many rows is long, and nothing groups them by component. The
part stands in the properties pane, narrow on a small screen, where the
pane is the one shown. **One review at a time**: while French waits or is
held, German cannot be asked for until French is applied or discarded.
An answer is read twice once Apply is refused, by report-ai's proposal
against the report as it stands, which validates and diagnoses the whole
report each time (0085 measured it). `askTranslation` is a method beside
`dispatch`, so a builder calls it as it calls `addImage`, and its promise
rejects with what a listener threw. A refusal the session gives Apply for
any reason but a moved report is said in report-core's English, as every
refusal from report-core is. Every sentence is written three times, in
each catalogue. report-builder-core depends on report-ai now, and through
it on `@formancy/spec` and `@noble/hashes` at exactly 2.4.0, which every
host of either builder installs. Until the builders draw it, the review is
a state a host can read and nothing on screen.

**What it forecloses.** Applying a model's words without this review, in
either builder.

## Alternatives considered

**Apply the whole proposal in one step, as formancy.ai 0161.** Simpler, and
it makes a person who cannot vouch for every word choose between all and
none.

**Accept and apply one word at a time**, each its own undo step. Lost to
formancy's reason: an undo step per word, and a person undoing a batch one
word at a time.

**Edit the proposed text in the row.** A third state per row, and the
review would then hold a person's words beside a model's under one heading;
the field the word is written in already does it.

**A dialog over the builder.** It would hide the design view the rows point
into, which is what makes a word's place visible.

**The run in a pane**, ended when the pane goes. formancy moved away from
it (formancy.ai 0163, 0164) for a person carrying a turn while they look
elsewhere; the editor is already the host-held object here.

**Keep a run whose language was removed, said as gone, as formancy.ai
0164.** Lost because the editor sees the removal: a run kept waiting under
no language is one no builder draws but in a sentence, for a language a
person may never add again, and every run after it waits behind it.

**Ask as an action, through `dispatch`.** Lost because a run takes time
and `dispatch` returns at once (0008): a run's ending would land with no
caller to hand what a listener threw, and a host or a test would have no
promise to wait on. `addImage` is no action for the same reason.

**Count the words a model may be asked for on Ask, the payment part's
left out.** It would decide again in the editor which words report-ai
asks for, a rule that is report-ai's; Ask counts what the language lacks,
as the switch does, and the part says afterwards what was a person's.
