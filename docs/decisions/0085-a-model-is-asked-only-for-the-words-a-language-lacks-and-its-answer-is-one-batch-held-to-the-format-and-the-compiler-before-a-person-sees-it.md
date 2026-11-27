# 0085 — A model is asked only for the words a language lacks, and its answer is one batch held to the format and the compiler before a person sees it

- **Status:** accepted; numbered while 0084 was held for a branch not yet merged, and merged after [0088](0088-an-agent-gets-reports-checks-over-the-model-context-protocol-from-a-server-of-reports-own.md); extends [0063](0063-a-reports-own-words-are-written-in-each-language-it-declares-and-a-render-names-the-one-it-prints-in.md), whose words and `word-missing` it reads, and [0048](0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md), whose commands as data against a hash it follows with a model as the proposer; gives [0083](0083-the-models-turn-is-held-in-report-ai-in-formancys-shapes-until-formancy-releases-one-other-products-may-brief.md)'s `REQUEST_KINDS` its first kind; follows formancy.ai 0158 and 0161
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
    language's words so far are sent but the payment part's. None of the
    starter's sample data's strings is in it, as written or as JSON escapes
    them; no string report-spec's `NOT_WORDS` names is, but the ids and the
    kinds a place is told by, the report's locale and the language's words
    so far; nothing of the payment part is, the invoice's and the payment
    reminder's among them; a string the request carries by design -- a
    source, a word so far, a place, a member of its own -- is taken as no
    leak only where the place is held, in every starter, to one of its
    shapes naming only the report's ids. A word standing in five places
    tells three and counts two, and each place is told once.
    `translation/places.test.ts` holds each shape to its place, and a place
    no shape knows to its property's key. Seen failing on 27 November 2026,
    each fault planted and put back: the request built from the report's
    own words in place of `word-missing` (nineteen cases: every starter
    with half its language written, and the seven with nothing written
    whose reports hold an expression run that prints no words); the
    payment part let through (six); the language's words
    so far sent with the payment part's (two); the places uncapped (one);
    the parameters sent beside the words (two); the payment part sent
    whole (eight).
  - **The briefing.** `translation/briefing.test.ts` pins its text beside
    its digest, the SHA-256 of its UTF-8 computed again with Node's crypto,
    reads its example answer with the reader and its example decline as a
    decline, and holds `REQUEST_KINDS` to the translation alone, read by the
    list, so that `constructor` is no kind.
  - **The reader.** `translation/reader.test.ts` over the answers recorded
    in `packages/report-ai/fixtures/answers/`, against the monthly sales
    report's request into French, whose keys it holds first: an answer in a
    fence after a sentence, between other text and alone is read, each text
    by the source the request held; another locale, none, a `words` that is
    no object or holds a number, no object, and a decline with no reason
    are asked again with that problem alone, the follow-up its complaint;
    three answers that are none give up; a decline ends the run on its turn;
    a key not asked, in either member, is dropped and listed; a partial
    answer is kept, and a text of nothing but white space is still missing;
    nothing is asked of a language that lacks nothing; a stop ends the run
    at once. Seen failing, each planted and put back: a key read back to the
    source at its position (two); a blank text written (one); the locale
    not compared (two); a key not asked kept (one); a decline with no reason
    read as an answer (one).
  - **The proposal.** `translation/proposal.test.ts`: the whole answer is a
    row an entry, one batch whose candidate the language lacks nothing in;
    a word a person translated while the model answered is never in the
    batch and keeps the person's text; a word whose source changed
    meanwhile is dropped; keys not asked, and every entry of a language
    removed meanwhile, are dropped; an expression that does not compile,
    reads another member or gives a number is refused with report-core's
    own sentence, the rest kept; a word holding a character report-spec's
    `refusedCharacter` refuses -- a script a report does not print, a
    bidirectional control -- is refused at its own entry, and one past a
    column header's bound with the validator's sentence, the rest kept; a
    word a person put into the payment part's message meanwhile is dropped
    for a person; the batch, applied through a session against its hash, is
    one undo step, a subset of it applies too, and it is refused
    `stale-document`, nothing changed, once the report moved, by a word
    and by the title; read again on the report as it stands, the held
    answer leaves out what the person wrote. Seen failing, each planted and
    put back: the batch refused whole for one finding (four cases); a
    word written whatever the report now holds (three); the characters
    unchecked (one); the diagnostics unread (three); a word of the payment
    part written (one); a hash other than the report's (four).
  - **The bounds.** `translation/bounds.test.ts`: the bound holds a turn of
    `MAX_BATCH_COMMANDS` entries at the most bytes an entry costs in any
    request the corpus makes, and sixteen times its largest request, at the
    least power of two that does, measured on every report
    `report-size.test.ts` holds; a request one byte past it is refused
    before anything is asked, and one at it asked; no turn a run sends,
    whatever answer that is none came before it, is past it; a turn asks
    at most `MAX_BATCH_COMMANDS` entries and no more of a list than the
    language has room for under `MAX_WORDS`, the rest `later`. Seen
    failing, each planted and put back: the bound unchecked (one); a
    request measured by its first turn alone (one); the count uncapped
    (one); the room unchecked (one); the bound halved (two).
  - **Through a host's server.** `packages/report-ai/src/ask-through.test.ts`:
    `askThrough` sends the kind, the user part and the briefing's digest and
    never the briefing; refuses a prompt briefed otherwise, a kind Report
    does not ask and a user part past the bound before `complete` is
    called, and sends one at the bound; reads a text as the answer; ends the
    run on the server's decline on its turn, and unreachable on the host's
    error and on a completion of neither shape; tells the host of a stop.
    Seen failing, each planted and put back: the system part not compared
    (one); the briefing sent (one); a decline read as a text (one); the
    kind looked up in a table (one); the size unchecked (one).
  - **The start page.** `apps/pages/src/limits.test.ts` holds "No changes
    described in words" to report-ai's built `REQUEST_KINDS` being the
    translation alone, and to no published package but report-ai taking
    it; seen failing with `edit` written into the built list, and the
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

## Decision

**A model is asked for the words a language lacks and nothing else, and
its answer becomes one batch of `translateWord` and `translateExpression`
against the report's hash, every entry of which the format and the compiler
have accepted before a person sees it.**

- **What is sent.** `translationRequest(report, locale)` takes the report
  and the locale and nothing else; a locale the report declares no
  translation into is a caller's mistake, a `RangeError`. It asks for what
  `word-missing` names for the language, read back to each source through
  report-spec's walk, in document order, words first; each under a key of
  the request's own, `w1` or `e1`, with up to three places it stands told
  in English words derived from its pointer, its component's kind and id,
  its column's and its region, each told once, and how many more; for an
  expression, the type it gives and the members it reads, as report-core's
  compiler says; and beside them the language's words and expressions so
  far, for the register. **Never**: data, a parameter's value, an asset, a
  font, a string `NOT_WORDS` names but the ids and kinds a place is told
  by, the e-invoice, and **the payment part, its message included**: a
  word or an expression standing in it anywhere, the same word elsewhere
  among them, since a word is translated once wherever it stands, is
  `forPerson`, for a person to write, and the words so far are sent
  without the payment part's. report-spec exports `NOT_WORDS` for the test
  that holds this.
- **A turn's bounds.** At most `MAX_BATCH_COMMANDS` entries, so that one
  answer is one batch, and no more of a list than the language has room
  for under `MAX_WORDS`; the rest is `later`, for a turn of its own. A
  request whose longest turn -- the request, and the longest complaint the
  reader can give after it -- is past `MAX_MODEL_REQUEST_BYTES` is refused
  before anything is asked. The bound is 256 KiB, the least power of two
  that holds a turn of `MAX_BATCH_COMMANDS` entries at the most bytes an
  entry costs in any request the corpus makes, the grouped equipment
  list's 216.5; sixteen times the largest request the corpus makes, the
  XRechnung sample's 6,917 bytes, is less (measured on 27 November 2026 on
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
  and a user part past the bound. A server that answers Report's requests
  writes the system part from `modelBriefing` by the kind and refuses a
  digest that is not its own briefing's. A server's decline ends the run
  on its turn; a host's error ends it unreachable with its words.
- **The answer** is `{ into, words: { key: text }, expressions: { key:
  source } }` or `{ "declined": "<why>" }`, `DECLINE_KEY` formancy's
  (0083). It holds no source. Asked again, with that problem alone, are an
  answer that holds no object, one that names no locale or another than
  the one asked, a member that is not an object of strings, and a decline
  with no reason; a member left out is empty; at most three turns.
- **The reader** reads each asked key back to the source the request held,
  never to anything the model wrote; a key the request did not ask, in
  either member, is dropped and listed; a text of nothing but white space
  is still missing.
- **The proposal.** `proposeTranslation(report, answer)` runs on the report
  as it stands when it runs, and keeps an entry only where its source is
  still one the language lacks there: a word a person translated meanwhile
  is never overwritten, one whose text changed is no longer in the report,
  one a person put into the payment part is a person's, and a language
  removed meanwhile drops every entry. Then it holds what is left before
  anything is shown: each text's characters by report-spec's
  `refusedCharacter`, the rule the renderers print by; the batch's report
  by the validator, through `tryEdit`, which reports a translation's error
  at the entry that broke it; then by `languageDiagnostics`, an error the
  language did not give before -- `translation-differs`, a compile error
  -- refusing the entry it stands at. Each refused entry is taken out with
  the sentence that refused it and the rest held again, until what is left
  stands or nothing is; a finding that stands at no entry left refuses
  every one of them, since none can be shown to leave a report the format
  and the compiler accept.
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

**What it buys.** A model never sees a report's data, its payment part or its
e-invoice, by type and by test, and never writes over a person's word. Every
row a person reviews is one the report would print -- compiled, of its
source's type, reading what its source reads, in characters a report prints
-- so the review is about the language and almost never about whether a
row works. One bad word costs one row, not the answer. A stale proposal is
refused by the session's own rule, not a second one, and read again for free.
A page and a host's server of different versions refuse rather than brief a
model one way and read its answer another, which formancy carries as debt
(its SAFETY-ANALYSIS D17).

**What it costs.** **The review is only as good as its reader's command of
the language**: a fluent mistranslation passes every check here, as
formancy.ai 0161 says of its own (D15 there). **Nothing draws it yet**: no
builder shows a proposal, and a host that wants one now calls report-ai
itself. Where a word came from is not recorded once it lands. Missing-only:
a model never improves a word that exists, and a person empties one to have
it redone. **The QR-bill's message is always a person's to write**, and so
is any word that also stands in it, so a report with a bill is never
translated whole by a model. **The template's words, their places and the
language's words so far leave** for whichever model the host chose. A
request names component and column ids, which a template's author may have
written in a language of their own. A model that writes a text in another
language than the one asked passes: nothing checks a word's language. **A
character the report's own faces lack passes the review**: whether a face
draws it needs the face's bytes, which the host holds and report-ai never
sees, so the render in that language refuses it (0043) and the person
corrects the word after it landed. A new run names nothing an earlier
answer had refused, so a model may write the same refused entry again. A
finding that stands at no entry refuses every row left; report-spec and
report-core report a translation's at its entry, and no case here reaches
one that does not. Each answer is validated and diagnosed at least twice,
and the whole report in every language each time: holding a whole answer
for the XRechnung sample, the corpus's largest request, took 90 and 97 ms,
the medians of two runs of seven (measured as the bound was), and it grows
with the report and its languages. The places are English whatever the person's language,
because the reader of a request is a model. A report whose words are long
is refused rather than asked in parts: the bound is a turn's, and a turn
is cut by its entries, not by its bytes. report-ai depends on report-core
and report-spec now, and on `@noble/hashes` at exactly 2.4.0 for the
digest and a request's bytes; its turn, in `src/turn/`, still imports
neither (0083).

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

**Validate the batch whole and refuse it whole.** One word with a character
a report does not print, or one header past its bound, would cost every row.

**Ask again for any entry refused.** Each turn is paid for, through a relay
two pastes by hand; the rest is a run of its own, offered once the person
has the rows that work.

**Accept an expression that compiles, whatever it reads.** Lost to 0063's
rule that a translation reads exactly what its source reads, which is what
keeps a field's readers its expression's alone.

**A bound sixteen times the corpus's largest request, 128 KiB.** The factor
`MAX_REPORT_BYTES` keeps, and lost: a turn of `MAX_BATCH_COMMANDS` entries
like the corpus's is about 216 KB, so the count a batch is bounded by could
never be reached, and a report of seven hundred ordinary words would be
refused whole rather than asked.

**Fill a turn by its bytes as well as its entries.** It would ask a report
of long words in parts. Lost for now: the bound would then refuse nothing a
report can hold, and the second bound would be one more rule for what a turn
holds; the cost is said above.

**The page compares a digest the server serves.** It needs a second request
before the first, and a server that serves its digests; the digest sent
beside the request is compared by the server that writes the briefing, in
the same request.
