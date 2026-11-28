# 0085 — A model is asked only for the words a language lacks, and its answer is one batch held to the format and the compiler before a person sees it

- **Status:** accepted; numbered while 0084 was held for a branch not yet merged, and merged after [0090](0090-a-preview-opens-a-report-that-carries-a-qr-bill-with-its-slip-in-view-and-nothing-moves-the-paper-after.md) and [0088](0088-an-agent-gets-reports-checks-over-the-model-context-protocol-from-a-server-of-reports-own.md), whose translate prompt to an agent's own model keeps the payment part's words for a person by the same rule, report-core's `missingWords`, since 0088's paragraph of 2026-11-28; extends [0063](0063-a-reports-own-words-are-written-in-each-language-it-declares-and-a-render-names-the-one-it-prints-in.md), whose words and `word-missing` it reads, and [0048](0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md), whose commands as data against a hash it follows with a model as the proposer; gives [0083](0083-the-models-turn-is-held-in-report-ai-in-formancys-shapes-until-formancy-releases-one-other-products-may-brief.md)'s `REQUEST_KINDS` its first kind; follows formancy.ai 0158 and 0161, and departs from 0161 where the Consequences say
- **Date:** 2026-11-27
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **What is asked.** `packages/report-ai/src/translation/request.test.ts`,
    over every starter of the corpus with a language added, once with
    nothing written in it and once with half of it written, every word of a
    payment part's message among the half: the request asks for exactly
    what report-core's `languageDiagnostics` names `word-missing`, read back
    to each source through report-spec's walk apart from the request, but
    what stands in the payment part, which it lists for a person; each entry
    is keyed once, words and expressions apart, in the order asked; the
    language's words so far are sent but the payment part's, and but one
    the report no longer prints. None of the starter's sample data's
    strings is in it, as written or as JSON escapes them; no string
    report-spec's `NOT_WORDS` names is, but the ids and the kinds a place
    is told by, the report's locale and the language's words so far;
    nothing of the payment part is, the invoice's and the payment
    reminder's among them; a string the request carries by design -- a
    source, a word so far, a place, a member of its own -- is taken as no
    leak only where the place is held, in every starter, to one of its
    shapes naming only the report's ids. That makes these checks a guard
    against the request being widened, not proof that no short string ever
    stands in it. A word standing in five places tells three and counts
    two, and each place is told once; an expression whose first site does
    not compile is asked at the site that prints words, with what it gives
    and reads there. `translation/places.test.ts` holds each shape to its
    place, and a place no shape knows to its property's key. Seen failing on
    27 November 2026, each fault planted and put back: the request built
    from the report's own words in place of `word-missing` (nineteen cases:
    every starter with half its language written, and the seven with
    nothing written whose reports hold an expression run that prints no
    words); the payment part let through (six); the language's words so
    far sent with the payment part's (two); the places uncapped (one); the
    parameters sent beside the words (two); the payment part sent whole
    (eight); and on 28 November, an expression matched at its first site
    alone (one), and a translation of a word no longer printed sent
    (one).
  - **The briefing.** `translation/briefing.test.ts` pins its text beside
    its digest, the SHA-256 of its UTF-8 computed again with Node's crypto,
    reads its example answer with the reader and its example decline as a
    decline, and holds `REQUEST_KINDS` to the translation alone, read by the
    list, so that `constructor` is no kind.
  - **The reader.** `translation/reader.test.ts` over the answers recorded
    in `packages/report-ai/fixtures/answers/`, against the monthly sales
    report's request into French, whose keys it holds first: an answer in a
    fence after a sentence, between other text and alone is read, each text
    by the source the request held; another locale, none or a number, a
    `words` that is no object or holds a number, `expressions` that hold no
    strings, no object, and a decline with no reason are asked again with
    that problem alone, the follow-up its complaint; three answers that are
    none give up; a decline ends the run on its turn; a key not asked, in
    either member, `__proto__` and `constructor` among them, is dropped and
    listed; a key written twice is read as JSON keeps it, the last; a
    partial answer is kept, and a text of nothing but white space is still
    missing; nothing is asked of a language that lacks nothing; a stop ends
    the run at once. Seen failing, each planted and put back: a key read
    back to the source at its position (two); a blank text written (one);
    the locale not compared (two); a key not asked kept (one); a decline
    with no reason read as an answer (one); and on 28 November, the locale
    read by its presence rather than its type (one), a member's texts that
    are no strings skipped rather than asked again for (three), and the
    answer's keys read into a plain object, where `__proto__` sets the
    prototype and is lost (one). The case of a key written twice holds
    `JSON.parse`'s own rule, which no fault of the reader's can change.
  - **The proposal.** `translation/proposal.test.ts`, and
    `translation/texts.test.ts` for the rules of a text: the whole answer
    is a row an entry, one batch whose candidate the language lacks nothing
    in; a word a person translated while the model answered is never in the
    batch and keeps the person's text; a word whose source changed
    meanwhile is dropped; an expression that prints words no longer is
    dropped as one; keys not asked, and every entry of a language removed
    meanwhile, are dropped; what the language has no room left for, as it
    stands, is dropped at its own entries and what fits kept; an expression
    that does not compile, reads another member or gives a number is
    refused with report-core's own sentence, the rest kept; a word holding
    a character report-spec's `refusedCharacter` refuses -- a script a
    report does not print, a bidirectional control -- and an expression
    whose escape writes one, are refused at their own entries; a word that
    keeps not its source's white space at either end is refused at its
    entry; one past a column header's bound, and a text past
    `MAX_TEXT_LENGTH`, with the validator's sentence, the rest kept; a word
    a person put into the payment part's message meanwhile is dropped for a
    person; a finding that stands at no entry left -- a step its command
    refuses -- refuses every entry left with its sentence; the batch,
    applied through a session against its hash, is one undo step, a subset
    of it applies too, and it is refused `stale-document`, nothing changed,
    once the report moved, by a word and by the title; read again on the
    report as it stands, the held answer leaves out what the person wrote.
    Seen failing, each planted and put back: the batch refused whole for
    one finding (four cases); a word written whatever the report now holds
    (three); the characters unchecked (one); the diagnostics unread
    (three); a word of the payment part written (one); a hash other than
    the report's (four); and on 28 November, a word's spaces unchecked
    (two, one of them `texts.test.ts`'s), an expression's escapes unread
    (two), an escaped backslash read as an escape's start (one), the room
    unapplied (one), a finding at no entry keeping every entry left (one),
    and an expression that prints no words said to be written meanwhile
    (one).
  - **The bounds.** `translation/bounds.test.ts`: the bound holds a turn of
    `MAX_BATCH_COMMANDS` entries at the most bytes an entry adds to any
    body the corpus makes, and sixteen times its largest body, at the least
    power of two that does, measured on every report `report-size.test.ts`
    holds; a request one byte past it is refused before anything is asked,
    and one at it asked; no body a run hands a host through `askThrough`,
    whatever answer that is none came before it, is past it, each counted
    as a server counts the JSON it reads; a turn asks at most
    `MAX_BATCH_COMMANDS` entries and no more of a list than the language
    has room for under `MAX_WORDS`, the rest `later`, and a language with no
    room left asks nothing and says so in `noRoom`. Seen failing, each
    planted and put back: the bound unchecked (one); a request measured by
    its first turn alone (one); the count uncapped (one); the room
    unchecked (one); the bound halved (two); and on 28 November, the body
    measured by its user part alone (three, two of them `askThrough`'s),
    `noRoom` said of the count rather than the room (two), and the
    answer's `later` and `noRoom` dropped (one).
  - **Through a host's server.** `packages/report-ai/src/ask-through.test.ts`:
    `askThrough` sends the kind, the user part and the briefing's digest and
    never the briefing; refuses a prompt briefed otherwise, a kind Report
    does not ask, a body one byte past the bound and a user part under it
    whose JSON is past it before `complete` is called, and sends a body at
    the bound, as long as a server counts it; reads a text as the answer;
    ends the run on the server's decline on its turn, and unreachable on
    the host's error, on a completion of neither shape and on a decline
    with no reason, in a sentence of its own; tells the host of a stop.
    Seen failing, each planted and put back: the system part not compared
    (one); the briefing sent (one); a decline read as a text (one); the
    kind looked up in a table (one); the size unchecked (one); and on 28
    November, a decline with no reason handed on (one).
  - **The start page.** `apps/pages/src/limits.test.ts` holds "No changes
    described in words in the builders" to report-ai's built
    `REQUEST_KINDS` being the translation alone, to no published package
    but report-ai taking it, and to report-mcp's built `PROMPTS` being the
    two its last clause names; seen failing with `edit` written into the
    built list, and with a third prompt written into report-mcp's, and the
    sentence it replaces, "No changes proposed by an AI", failing on the
    translation's arrival.
  - **The packed package.** The install gate's
    `scripts/install-fixture/translation.ts`: the quotation, French added,
    asked of a scripted server through `askThrough`, which checks the
    digest it is sent; the answer proposed, applied as one step against its
    hash, the French title the one `reportIn` prints; the same batch
    refused stale after an edit. The package README's example is its lines
    (`scripts/readme-example.test.mjs`).

## Context

A report may be written in several languages, each word keyed by its exact
text in the report's own language and each expression that prints words by
its source (0063). report-core says what a language lacks as `word-missing`,
an error of that language, and what a translated expression must be -- of
its source's type, reading what its source reads -- as
`translation-differs`. report-core's `translateWord` and
`translateExpression` write one entry each, and overwrite what is there;
`batch` runs several as one edit (0048). report-ai holds formancy's turn,
asking a model for nothing (0083).

formancy.ai 0161 asked a model for a form's missing messages: only what is
missing, in the shape of its catalogue file, read entry by entry, partial
answers kept, nothing a person translated overwritten, and reviewed before
anything lands. Report's words differ in two ways that matter. They are
keyed by their text, so a source changed meanwhile is another word. And an
expression that prints words is code a model writes: it can fail to compile
or read another field, which no form message can.

What a report holds beside its words is untrusted and often a customer's:
its data, its parameters, its QR-bill's account and parties, its e-invoice.
And the QR-bill's message, which is a word, is printed on the slip and
encoded in the code a bank reads.

report-ai's request is not the only way a report's words reach a model.
report-mcp (0088) hands a coding agent's own model two prompts: one writes a
template from a description, one translates a template the agent holds,
every `word-missing` its `validate_report` lists, through `apply_commands`.
What the agent's model reads there is the agent's and its host's, and no
proposal of report-ai's.

## Decision

**report-ai asks a model for the words a language lacks and nothing else,
and its answer becomes one batch of `translateWord` and
`translateExpression` against the report's hash, every entry of which the
format and the compiler have accepted before a person sees it.**

- **What is sent.** `translationRequest(report, locale)` takes the report
  and the locale and nothing else; a locale the report declares no
  translation into is a caller's mistake, a `RangeError`. It asks for what
  `word-missing` names for the language, read back to each source through
  report-spec's walk, in document order, words first, an expression at the
  site the diagnostic stands at, its first that prints words; each under a
  key of the request's own, `w1` or `e1`, with up to three places it
  stands told in English words derived from its pointer, its component's
  kind and id, its column's and its region, each told once, and how many
  more; for an expression, the type it gives and the members it reads
  there, as report-core's compiler says; and beside them the language's
  words and expressions so far that the report still holds, for the
  register. **Never**: data, a parameter's value, an asset, a font, a
  string `NOT_WORDS` names but the ids and kinds a place is told by, the
  e-invoice, and **the payment part, its message included**: a word or an
  expression standing in it anywhere, the same word elsewhere among them,
  since a word is translated once wherever it stands, is `forPerson`, for
  a person to write, and the words so far are sent without the payment
  part's. report-spec exports `NOT_WORDS` for the test that holds this.
- **A turn's bounds.** At most `MAX_BATCH_COMMANDS` entries, so that one
  answer is one batch, and no more of a list than the language has room
  for under `MAX_WORDS`, by one rule, `withinRoom`, which the proposal
  applies too; the rest is `later`, for a turn of its own, and a list with
  no room left is named in `noRoom`, so that a language with no room is not
  taken for one that lacks nothing. A request whose longest body -- `{
  kind, user, briefing }` as JSON, as `askThrough` hands it to a host, its
  user part the request and the longest complaint the reader can give
  after it -- is past `MAX_MODEL_REQUEST_BYTES` is refused before anything
  is asked, so that a host's server can read a body under that one number.
  The bound is 256 KiB, the least power of two that holds a turn of
  `MAX_BATCH_COMMANDS` entries at the most bytes an entry adds to any body
  the corpus makes, the payment reminder's 216.1, what a body costs with no
  entry left out; sixteen times the largest body the corpus makes, the
  XRechnung sample's 7,746 bytes, is less (measured on 28 November 2026 on
  an Intel i9-10900K under Windows 11 and Node 24.21.0).
- **The briefing**, model-facing English in report-ai, one for each kind of
  `REQUEST_KINDS`, which holds `translation` alone: keep every key, write
  only the text, keep a word's spaces at either end, keep an expression's
  members and its quotes' kind, match the words so far, give `""` when
  unsure, answer with the object alone or decline. `modelBriefing(kind)`
  gives it, and `briefingDigest(kind)` the SHA-256 of its UTF-8, written as
  report-spec writes a digest.
- **Through a host's server.** `askThrough(complete)` is the `AskModel` a
  host makes over its own `complete`, which sends `{ kind, user,
  briefing }` -- the briefing's digest, never the briefing -- wherever the
  host's model is, and resolves with `{ text }` or `{ declined }`. It
  refuses, before `complete` is called, a prompt whose system part is not
  report-ai's briefing for its kind, a kind `REQUEST_KINDS` does not hold
  and a body past the bound. What the host's server does is the host's to
  build and owed: write the system part from `modelBriefing` by the kind,
  read no system part a page sent, and refuse a digest that is not its own
  briefing's. Nothing here holds a server to that; Report's own server's
  route is 0084's, a record still to come. A server's decline ends the run
  on its turn, and one with no reason ends it unreachable in a sentence of
  its own; a host's error ends it unreachable with its words.
- **The answer** is `{ into, words: { key: text }, expressions: { key:
  source } }` or `{ "declined": "<why>" }`, `DECLINE_KEY` formancy's
  (0083). It holds no source. Asked again, with that problem alone, are an
  answer that holds no object, one that names no locale or another than
  the one asked, a member that is not an object of strings, and a decline
  with no reason; a member left out is empty; at most three turns.
- **The reader** reads each asked key back to the source the request held,
  never to anything the model wrote; a key the request did not ask, in
  either member, is dropped and listed; a text of nothing but white space
  is still missing. The answer carries the request's `later` and `noRoom`.
- **The proposal.** `proposeTranslation(report, answer)` runs on the report
  as it stands when it runs, and keeps an entry only where its source is
  still one the language lacks there: a word a person translated meanwhile
  is never overwritten, one whose text changed is no longer in the report,
  an expression that no longer prints words is dropped as one, one a
  person put into the payment part is a person's, and a language removed
  meanwhile drops every entry. Then it holds each text (`texts.ts`): its
  characters by report-spec's `refusedCharacter`, the rule the renderers
  print by, and for an expression the characters its escapes write, which
  CEL decodes; and for a word, its source's white space at either end.
  What is left is sized by `withinRoom` to the room the language has as it
  stands, what does not fit dropped at its own entries; then the batch's
  report is held by the validator, through `tryEdit`, which reports a
  translation's error at the entry that broke it, and by
  `languageDiagnostics`, an error the language did not give before --
  `translation-differs`, a compile error -- refusing the entry it stands
  at. Each refused entry is taken out with the sentence that refused it
  and the rest held again, until what is left stands or nothing is. A
  finding that stands at no entry left refuses every one of them, since
  none can be shown to leave a report the format and the compiler accept:
  the validator reports a list past `MAX_WORDS` at the list, which the
  room keeps from arising, an error near no replaced string at the
  translation, and one over the whole report at its first substitution,
  which may be a person's entry; a step its command refuses stands at none.
- **What it gives** is `{ locale, expectedHash, rows, refused, dropped,
  stillMissing, forPerson, candidate }`: each row a key, its kind, its
  source, its text, its places and its step; `expectedHash` the report's
  `reportHash`; `stillMissing` report-core's `word-missing` of the
  candidate; `candidate` the report every row would leave. A subset of its
  rows is a valid batch too, applied with `expectedHash`, so a report that
  moved since refuses it as `stale-document` and changes nothing; the same
  answer can be read again against the report as it stands, with no new
  turn.
- **A partial answer is kept**; what is still missing is asked for in a new
  run over the report as it stands, which names nothing of the answer
  before it.

## Consequences

**What it buys.** A model report-ai asks never sees a report's data, its
payment part or its e-invoice, by type and by test, and never writes over a
person's word. Every row a person reviews is one the report would print --
compiled, of its source's type, reading what its source reads, in
characters a report prints, a word with its spaces -- so the review is about
the language and almost never about whether a row works. One bad word costs
one row, not the answer. A stale proposal is refused by the session's own
rule, not a second one, and read again for free. A host's server that
compares the digest, as it owes, refuses a page of another version rather
than brief a model one way and read its answer another, which formancy
carries as debt (its SAFETY-ANALYSIS D17).

**What it costs.** **The review is only as good as its reader's command of
the language**: a fluent mistranslation passes every check here, as
formancy.ai 0161 says of its own (D15 there). **A template's words steer the
model**: a header that reads as an instruction can bend the texts written
for other keys, and an expression's literals so long as it keeps its type
and its reads; what can land is bounded -- asked keys, strings, the asked
locale, the format and the compiler -- and what it says is the reviewer's
alone to catch ([§11.2](../architecture/11-risks-and-debt.md)). **Nothing
draws it yet**: no builder shows a proposal, and a host that wants one now
calls report-ai itself. Where a word came from is not recorded once it
lands. Missing-only: a model never improves a word that exists, and a
person empties one to have it redone. **The QR-bill's message is always a
person's to write in what report-ai asks**, and so is any word that also
stands in it, so a report with a bill is never translated whole by
report-ai. **report-mcp's translate prompt leaves the same words to a
person**, listed by the same rule, report-core's `missingWords` (0088,
2026-11-28), but asks it of the agent and refuses nothing: an agent's
`apply_commands` writes a translation of the slip's message as a builder's
field does, where a proposal drops one. **The template's words, their places and the language's words so
far leave** for whichever model the host chose. A request names component
and column ids, which a template's author may have written in a language of
their own. A model that writes a text in another language than the one
asked passes: nothing checks a word's language. **A character the report's
own faces lack passes the review**: whether a face draws it needs the
face's bytes, which the host holds and report-ai never sees, so the render
in that language refuses it (0043) and the person corrects the word after
it landed. An expression's escapes are read as CEL decodes a string
literal's, so a raw string's backslash is read as one too, and refused
where it would write a character no report prints: the safe side, and once
in a while a row lost. Only a word's spaces at either end are held; an
expression's literals keep theirs or not as the model wrote them. A new run
names nothing an earlier answer had refused, so a model may write the same
refused entry again. A finding at no entry refuses every row left; the room
keeps the one way a batch could make such a finding from arising, and the
others stand on how report-spec reports a language's errors. Each answer is
validated and diagnosed at least twice, and the whole report in every
language each time: holding a whole answer for the XRechnung sample, the
corpus's largest request, took 90 and 97 ms, the medians of two runs of
seven (measured on 27 November 2026 as the bound first was), and it grows
with the report and its languages. The places are English whatever the
person's language, because the reader of a request is a model. A report
whose words are long, or whose ids are and stand in many places, is refused
rather than asked in parts: the bound is a turn's, and a turn is cut by its
entries, not by its bytes. report-ai depends on report-core and report-spec
now, and on `@noble/hashes` at exactly 2.4.0 for the digest and a request's
bytes; its turn, in `src/turn/`, still imports neither (0083).

**Where it departs from formancy.ai 0161.** The answer is a key-only patch,
`{ key: text }`, which 0161 lost as "a patch of its own": its answer was the
catalogue file a translator downloads, every source beside its target, so
that the same file could go to a person; Report has no such file, and keeps
the request's sources beside the answer, as 0161 came to keep its `asked`.
A text equal to its source is kept with no mark, where 0161 marks it
`unchanged`; a review that wants the mark draws it from the row's source and
text. The rest is asked once the rows land, in a run over the report as it
stands, where 0161's "Translate the rest" is written over the earlier
proposal against its basis. And the sentence a relay says of what a
translation request carries (formancy.ai 0167) is owed by the builder that
draws one.

**What report-mcp's prompts do not make false.** The start page says that
neither builder lets a person describe a change in words for a model to
propose, and that report-ai asks a model for a language's missing words
alone; report-mcp's prompts are read by the model of an agent the host
brings, outside the builders, whose edits the agent applies itself through
`apply_commands` (0088), and the sentence says so in its last clause. Its
guard pins report-mcp's prompts, so one added is read against it again.

**What it forecloses.** A translation of words that exist, and a request
that carries anything but a report's words, until a record says otherwise.

## Alternatives considered

**The report whole, for context.** Lost: its data contract, its parameters'
values, its payment part and its e-invoice would leave for nothing, and the
model would be free to change what it was not asked to.

**The payment part's message with the rest.** Lost: a proposal changes
nothing the payment part prints (0039, 0048), and that message reaches a
bank in a code. A word that stands in the message and elsewhere is one
word, translated once, so it goes with the message.

**Keys as the sources themselves.** Smaller to read and wrong to trust: a
model's echo of a source differs by a space or a quote, and formancy.ai 0161
found judging by the echo wrong both ways.

**The catalogue's shape, every source beside its target, as 0161 answers.**
A file that can go to a translator too; Report has no catalogue file to
round-trip, and a source in the answer is one more string a model writes
and the reader must ignore.

**Validate the batch whole and refuse it whole.** One word with a character
a report does not print, or one header past its bound, would cost every row.

**Ask again for any entry refused.** Each turn is paid for, through a relay
two pastes by hand; the rest is a run of its own, offered once the person
has the rows that work.

**Accept an expression that compiles, whatever it reads.** Lost to 0063's
rule that a translation reads exactly what its source reads, which is what
keeps a field's readers its expression's alone.

**Restore a word's spaces at either end, rather than refuse it.** The model
wrote something else, and a row a person reviews would show a text nobody
wrote; refused, the word stays for a person or another turn.

**A bound sixteen times the corpus's largest body, 128 KiB.** The factor
`MAX_REPORT_BYTES` keeps, and lost: a turn of `MAX_BATCH_COMMANDS` entries
like the corpus's is about 216 KB, so the count a batch is bounded by could
never be reached, and a report of seven hundred ordinary words would be
refused whole rather than asked.

**Bound the user part, and let a server read a body under a larger limit.**
JSON escapes a quote and a line break a byte each, so the body is a tenth or
so larger than the user part, and a server would need a second number to
state; measured as sent, the one number is the body's.

**Fill a turn by its bytes as well as its entries.** It would ask a report
of long words in parts. Lost for now: the bound would then refuse nothing a
report can hold, and the second bound would be one more rule for what a turn
holds; the cost is said above.

**The page compares a digest the server serves.** It needs a second request
before the first, and a server that serves its digests; the digest sent
beside the request is compared by the server that writes the briefing, in
the same request.
