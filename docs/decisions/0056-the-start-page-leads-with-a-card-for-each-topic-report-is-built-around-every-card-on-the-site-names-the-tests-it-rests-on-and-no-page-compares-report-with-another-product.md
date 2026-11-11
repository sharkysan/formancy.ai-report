# 0056 — The start page leads with a card for each topic Report is built around; every card on the site names the tests it rests on; and no page compares Report with another product

- **Status:** accepted; numbered while 0053, 0054 and 0055 were other branches'; extends [0021](0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md),
  whose site it changes, [0024](0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md),
  whose status the start page now carries too, and [0028](0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md),
  whose `CARD_EVIDENCE` became every card's `evidence`
- **Date:** 2026-11-11
- **Deciders:** Daniel Bacher
- **Verified by:** the pages' suite, which CI's `test` job runs, and
  `pnpm test:repo`. Each case below was watched failing on a Mac on
  11 November 2026, its fault planted once and the file put back, or the
  case written before what it holds was built. A case watched before a
  later round of review changed the code it reads says so.
  - **`apps/pages/src/evidence.test.ts`.** Every file a card of the site
    names, at least one by the card's type, is a file of the checkout, and
    a test or the entry of a gate CI runs by `EVIDENCE_KIND`, never a
    directory, a source file or a README. Each card has one list in every
    language, compared by reference, so a list copied into a translation
    word for word is named. The cards a page shows, `main li.card:not(.topic)
    h3`, are its group's, in its order. A topic page the start page
    introduces declares a card. It failed before `checks/evidence.ts`
    existed, and, in its first form, before review had it share
    `checks/read.ts`'s `collapsed`, with each of these planted in it:
    - the existence check taken out;
    - `EVIDENCE_KIND` admitting anything;
    - the lists compared by what they hold;
    - the languages not compared;
    - the teaser's rule taken out;
    - the page not compared with its group;
    - a `..` segment admitted;
    - the dependency licences' guard dropped from the gates it admits;
    - a browser gate's entry admitted anywhere in an app, which passed
      until `apps/studio/src/gate-images.mjs` joined the refused paths.
  - **The site's checks over the pages the build writes**, which
    `site.test.ts`'s `passes every check` runs all at once, this record's
    among them. They failed, naming the page, with the start page's
    `pdf-view.test.tsx` named as `pdf-view.tsx`, a source file; with the
    totals' cards declared after the cards of how it behaves, which the
    page shows in the other order; and with an amount of money in a limit
    of the totals.
  - **`apps/pages/src/studio-words.test.ts`.** Every word a group names as
    the Studio's is one a scene of `docs/images/readme/captured.json` says
    in quotes, and every page of the group says it:
    - "Download PDF" on the start page;
    - "Starter" and "Invoice" on the QR-bill page;
    - "Starter", "Euro invoice" and "EPC payment code" on the EPC QR code
      page.

    It failed in two of its first three cases with the check returning
    nothing, and in the case of "Euro", which is only part of "Euro
    invoice", with the quotes dropped from the match.
  - **`apps/pages/src/product.test.ts`.** The start page's topic cards
    stand right after the hero, one for each page with a teaser, in the
    order `GROUPS` gives. Each says where its page stands where the page
    has a status, and no teaser band is left at the foot. Its exact totals
    stand between the topics and how it behaves, point to `#examples` and
    show no code. Its status:
    - the site refuses to render once the changelog names another release
      than `START_STATUS`'s, naming its three files and their sentences;
    - the hero names the release in the sentence that links the
      changelog's Unreleased;
    - the list of what it does not do yet carries its day;
    - the link check refuses the start page's link to Unreleased once the
      changelog has no such heading.

    Each case failed before what it holds was built. It failed again with
    a `<pre><code>` in the totals, with the totals' link pointed at
    `#example`, which the link check named on every start page too, and
    with `{version}` dropped from the English standing.
  - **`apps/pages/src/limits.test.ts`.** What the start page says
    Formancy Report does not do yet, held to the code each sentence rests
    on, every absence but one detail table grouped by one field at most. It
    holds that:
    - `@formancy/report-render-pdf` is the one `report-render-*` package
      published;
    - report-spec's component kinds are those the codes' sentence was read
      against, the chart among them;
    - report-spec prints the blocks the scripts' sentence was read
      against, whole, and refuses a letter of each script it names;
    - no published package has `viewer` or `report-ai` in its name;
    - the data provider alone declares `@formancy/data-client`, at exactly
      0.1.0;
    - `@formancy/report-server`'s closure in the workspace installs
      neither the runtime nor the renderer, nor pdfkit, pdfmake or uqr;
    - report-spec reads version 0 of the report format, the draft, which
      the start page's status section says the format still is, in every
      language, in words;
    - every absence a predicate holds is one the page says, every absence
      worded is listed once, and every language's page lists them all, no
      line and no heading empty, with one link to `docs/roadmap.md`.

    It failed with each fact changed, each put back after:
    - the component kinds listed without the chart, which report-spec
      holds;
    - a manifest made for `packages/report-render-html`, for
      `packages/report-viewer` and for `packages/report-ai`;
    - report-spec's built `dist` patched to print Hebrew, and to refuse
      Greek, its SHA-1 the same before and after. This was in the scripts'
      first case, before review made it compare the whole of
      `PRINTED_BLOCKS`. That comparison failed with Armenian added to the
      blocks it expects, and with Armenian added to report-spec's, where
      the first case passed;
    - the provider's data-client moved to 0.2.0, and report-forms
      declaring data-client too;
    - report-server-core declaring report-render-pdf, report-server
      declaring pdfmake, and report-server declaring report-runtime;
    - report-spec's built `dist` patched to read version 1, its SHA-1 the
      same before and after, and the English format sentence made empty;
    - `jobs` dropped from `LIMIT_ORDER`, the roadmap's link pointed at the
      getting-started guide, and the English `jobs` and the heading made
      empty;
    - and before `ai` joined `LIMIT_ORDER`, the case that every absence a
      predicate holds is said.
  - **`apps/pages/src/site.test.ts`'s whole message.** The one error a
    release commit meets names the start page's whole line first, then the
    QR-bill page's and the EPC QR code page's. It failed before
    `START_STATUS` existed, finding two lines where it asks three. It and
    the status tests of the start page, the QR-bill page and the EPC QR
    code page take the later release from `test-site.ts`'s `nextRelease`,
    the next minor after the changelog's newest, and build each line from
    its page's status, so a release commit edits no test. A release commit
    was simulated on 11 November 2026, and everything put back after: with
    `## Unreleased` renamed to 0.3.0 and an empty one opened, every file of
    the pages' suite that renders the site failed on the one status error
    and on nothing else; with the three statuses set to 0.3.0, the suite
    passed whole and the build rendered the site.
  - **`scripts/architecture.test.mjs` and
    `scripts/release-report/limitations.test.mjs`, in `pnpm test:repo`.**
    A section of the architecture links this record, its costs are in
    `docs/release/limitations.json`, and every record whose Status line it
    changed was read again and stamped. Both failed with this record
    written and nothing else.

  Not run: the pages' browser gate, which 0053 adds, and which this record's
  branch was cut before. No gate has measured the start page's topic
  cards, its totals, its list of what it does not do yet or its hero's
  standing in a browser, and no fault of this record's has been planted in
  one; CI's `browser` job measures them once main, with 0053, is merged
  into this branch. On 11 November 2026 the built start page was looked at
  by hand in Chromium, in English at 1280 pixels and in German at 320, for
  the topic cards' spacing and for nothing else: a card's teaser, standing
  and link ran together, and 8047605 spaced them, with nothing past the
  window at 320.

  What holds nothing:
  - whether a sentence claims more than its evidence shows, and whether a
    card's list holds every test its claim needs;
  - every sentence outside a card: the leads, the topic cards' teasers,
    the hero's standing, and the limits of the totals;
  - one detail table grouped by one field at most, which only `START_STATUS`
    sends a release back to;
  - the translations, which no native speaker has reviewed;
  - the rule that no page compares Report with another product or names
    a competing one;
  - whether a search engine shows the pages.

## Context

0021's pages are a start page and a page for each topic, and 0024 and
0028 added the two payment codes' pages. A design for the pages, read
against main at da76a44 on 5 November 2026, found four things:
- **The topics were at the start page's foot.** A band per topic page
  stood after the licence, where a reader who came for the product has
  already left.
- **One page in four named the tests its cards rest on.** The EPC QR code
  page's `CARD_EVIDENCE` was held to the checkout by its own test (0028).
  The start page's, the QR-bill page's and the healthcare page's cards
  rested on nothing a test read.
- **The start page's absences had no status.** "Not here yet: the server
  and its jobs…" was true of 0.2.0, but main had a server
  ([0046](0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md),
  [0049](0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md)).
  The start page had no `PageStatus`, so at the next release that
  sentence would turn false and nothing would fail.
- **The Studio's words were held by nothing.** 0024 and 0028 each name the
  Studio's words their page uses, "Invoice", "Euro invoice", "Starter" and
  "EPC payment code", as words nothing here reads.

The rightsholder asked for a stronger start page, and for pages on four
topics that a comparison with other products, made outside this
repository, picked out: e-invoices, exact totals, native Angular and React
builders, and formancy's forms. The pages were to say only what is built,
in four languages. That comparison's own counts rest on cells it marks
"not confirmed".

On 5 November 2026 the rightsholder answered:
- exact totals are a section of the start page, not a page;
- the start page keeps a short list of what Report does not do yet,
  linking the roadmap;
- French and Italian ship as written;
- each page ships with the release it describes, the start page against
  0.2.0.

## Decision

**The start page leads with a card for each topic, and says what Formancy
Report does not do yet.** Its sections, in order, are these:

- **The hero**, with a sentence on where it stands: what 0.2.0 holds, and
  that anything the source on GitHub has gained since is listed under the
  changelog's Unreleased, which it links.
- **A card for each topic page**, from each group's teaser in `GROUPS`'
  order. Each card is a heading, the teaser's words, its page's `standing`
  where the page has a status, and a link. The `standing` is a field of the
  teaser, which the QR-bill and EPC QR code pages set from their status.
  The teaser bands at the foot are gone.
- **Exact totals**, a section of cards and of what the totals do not do,
  its words in `totals-copy.tsx`, linking the starters that print them.
- **How it behaves**, the cards no topic takes over.
- **The starters' pictures.**
- **What it does not do yet**, dated by the start page's status: one
  detail table grouped by one field at most; no consistent read from Formancy
  Data; no print format but PDF; no codes but QR codes; Latin, Greek and
  Cyrillic only; no published PDF viewer; no render jobs; and no changes
  proposed by an AI. Each is stated as an absence today, never as a
  plan. Their words are in `limits-copy.tsx`. The roadmap,
  `docs/roadmap.md`, is linked, and its order and plans are not
  restated.
- **The status**, linking the release's entry and Unreleased.
- **The licence.**

The data and the AI absences are the old status sentence's. The six the
design proposed would have dropped them, and the page would have said less
than the one it replaced. A chart has no absence of its own: report-spec
holds one (0052) and the runtime refuses it. Until the runtime prints
charts the page says nothing of them, which is no claim.

**Every card on the site names its tests.** A card is a title, its words
and its `evidence`. The evidence is a list of at least one file, written
once in its page's copy and shared by reference by every language's card.
`checks/evidence.ts` holds:
- every file to the checkout;
- every file to `EVIDENCE_KIND`: a test of a package, an app or the
  repository's scripts, or the entry of a gate CI runs and the parts an
  app's browser gate runs;
- every language to the English card's one list;
- every page's cards, as the built HTML shows them, to its group's;
- every topic page the start page introduces to a card of its own.

0028's `CARD_EVIDENCE` is this, for every card. The release report fails a
run in which a test file of the checkout did not run or did not pass
([0014](0014-a-release-report-is-derived-from-the-run-that-gated-it.md)),
so a test a card names has passed. Whether it still tests what the card
says is review's.

Claims no test held were cut or narrowed, not reworded until they sounded
safe:
- **The healthcare page's "Forms with formancy" card is cut.** Nothing in
  this checkout holds formancy's facts. Its teaser on the start page now
  says only what the page's cards hold.
- **The two data cards say what the Studio's browser gate fails on.** A
  report names its datasets and images, and the application hands over
  both. The Studio's browser gate fails on any request outside the address
  the Studio is served at, `blob:` and `data:` addresses aside. "Your data
  stays with you" is gone.
- **The totals' claims are worded to their tests,** `format.test.ts` and
  the editor's `format-rounds-again` in `diagnose.test.ts`. Only a number a
  format shows goes through `Intl`, and a total is rounded at most once.
  The division limit says that an expression divides only through a
  function that names its places.

**The pages may read facts from workspace packages.**
`limits.test.ts` holds each absence it can to the code it rests on. For
that, `@formancy/report-spec` is a devDependency of the pages. A package
only a test reads is a devDependency. A package the build reads, to derive
a page's words, is a dependency, with its row's column in the building
blocks. Every absence but one detail table grouped by one field at most has
a predicate there, read from report-spec's built `dist` or from the
published packages' manifests. A change to that code fails the pages'
suite in the pull request that makes it, until somebody reads the sentence
again.

**What a release can make false, a page says under a status.** A sentence
on what a release holds, on what the source on GitHub has gained since, or
on what Formancy Report does not do yet sits under a status naming the
release it was written against, as a payment code page's does (0024). The
start page carries `START_STATUS`, written against 0.2.0. Three sets of
sentences rest on it:
- `standing` in `product-copy.tsx`;
- `items` in `limits-copy.tsx`;
- `limits.items` in `totals-copy.tsx`.

Each is true of that release and of main on the day it names. A
`PageStatus` may say, in `ask`, what its sentences must say again, where
"whether that release has the feature" is not it. The site names the start
page first in the one error it raises once the changelog names another
release (0028). The start page links the changelog's Unreleased, so a
release commit opens a new, empty `## Unreleased`, as `RELEASING.md`'s
second step says, or the link check refuses the site.

**The Studio's words are checked.** A group names the Studio's words its
pages use, `studioWords`, English in every language. `checks/studio-words.ts`
holds each to `docs/images/readme/captured.json`: a scene of it must say the
word in quotes, and every page of the group must say it. The README
pictures' check (`test:pictures`) walks the Studio and compares its text
with that file, so the words are the Studio's as its pictures last recorded
them. A starter renamed in the Studio reaches the pages when its pictures
are taken again, and a page then fails until it names what they say.

**No page compares.** No page names a competing product, compares Report
with one, or says of Report "the only", "unlike", "first" or "best". No count
from the comparison appears. The comparison chose the topics and does
nothing else.

## Consequences

**What it buys.**
- **A reader meets the topics first,** with each topic page's standing on
  its card, and the absences on the same page as the claims.
- **No card is said on trust.** A test renamed or removed fails the pages'
  suite, naming the card, whose list every language's card shares.
- **An absence fails before a release where it can.** A component kind, a
  printed block, a renderer, a viewer, an AI package, another Data client,
  or the runtime or the renderer in the server's install fails the pages'
  suite in the pull request that adds it. 0052's chart was read so,
  against the codes' sentence.
- **A renamed starter fails the page that names it,** once the pictures
  record the name.
- **The start page's status goes stale loudly.** A release commit meets it
  beside the two payment code pages', in one error.

**What it costs.**
- **A list for every card.** Whoever writes a card reads the tests it
  rests on, and review reads them again. Nothing fails when a list misses
  a test its claim needs. The totals' last card lacked the e-invoice
  samples' test until review found it. Nothing fails when a test no longer
  tests what its card says either.
- **`EVIDENCE_KIND` admits any `gate-*.mjs` in an app's `scripts/`,**
  beside the browser gate's entry: the steps the entry runs, and also a
  helper of theirs that runs nothing by itself, such as the Studio's
  `gate-steps.mjs`. A card that rests on one rests on the gate that
  imports it, and nothing reads which gate that is.
- **Predicates by name.** The `pdf`, `viewer`, `ai` and `jobs` predicates
  read packages by their names. A renderer, a viewer or a server published
  under another name, or a server that prints with a library the renderer
  does not take, pdf-lib or a headless browser, passes them, and is
  review's. The predicates read kinds and package names, not what each
  one does: a barcode added as a property of an existing component kind
  passes `codes`, and a new output format inside report-render-pdf passes
  `pdf`.
- **A change to the code an absence rests on meets the start page.** A
  pull request that adds a component kind or a printed block, or moves the
  provider's Data client, fails the pages' suite until the sentence is
  read again, though nothing of the pages changed. That is the point, and
  it costs that pull request a sentence in four languages.
- **The pages' suite needs report-spec built, and runs uncached.** Turbo
  builds report-spec before the pages' `test` and `test:coverage`, in CI's
  job too. The suite run alone reads `dist` as it stands. Neither task is
  replayed from turbo's cache (`apps/pages/turbo.json`), since the suite
  reads files outside the package, every card's evidence among them: the
  suite runs whole each time.
- **One more page to read at every release.** The release commit writes
  the start page's sentences again, the hero's standing, the absences, the
  totals' limits and the report format's draft, beside the two payment
  code pages' three each, sets `START_STATUS`, and opens an empty
  Unreleased (`RELEASING.md`, step 2). The standing's second sentence is
  worded to be true whether Unreleased lists anything or nothing.
- **The Studio's words, as recorded.** A word is held to the Studio's
  recorded pictures, not to the Studio as it runs: a word the Studio drops
  passes until the pictures are taken again. A page says a word wherever
  its text holds it, a caption included, so a word inside a longer one
  counts.
- **Claims cut.** The healthcare page lost a card, and its teaser on the
  start page its forms line. Its title and h1 still name forms, and its
  description and lead formancy's forms, as the page's frame: no card says
  so, and review holds those sentences. The data cards say what a test in
  a browser fails on, which is narrower than what a reader wants to
  hear.
- **Translations nobody reviewed.** The start page's new words, its
  totals and its absences are in German, French and Italian as their
  author wrote them. No native speaker's review of the French or the
  Italian is recorded. The German is Switzerland's spelling, which the
  rightsholder reads.
- **No comparison, held by review.** A reader who wants one finds none
  here. A check would need the names it refuses, in a public file, so
  nothing fails when a page names a competing product.
- **A copy near its bound.** The start page's words are split across
  `product-copy.tsx`, `totals-copy.tsx` and `limits-copy.tsx`. On
  11 November 2026 the first held 540 lines, against the 600
  `scripts/source-size.test.mjs` allows.

**What it forecloses.** Nothing that cannot be undone. A card could rest
on a gate's recorded check rather than a file, and a topic could become a
page of its own.

## Alternatives considered

**The teaser bands at the foot,** as 0024 and 0028 placed them. Lost: a
reader who has left does not read them, and said twice, there and on the
cards, they would drift.

**Exact totals as a page of their own,** as the design proposed. Lost to
the rightsholder's answer of 5 November 2026. As a section they need no
entry in every page's bar, and their claims stand on the page whose
starters print them.

**`CARD_EVIDENCE` beside each page,** as the EPC QR code page held it,
each page's test holding its own table. Lost: a card added without its row
passes until somebody writes a test for its page, and four tables are four
copies of one check.

**Any file of the checkout as evidence.** Lost: a directory, a source file
and a README each exist and prove nothing.

**Lists compared by what they hold.** Lost: a list a translation copied
agrees until one of them is edited, and then the two languages claim
different things with nothing to say so.

**The absences under the status alone, with no predicate.** Lost: a change
to the code, 0052's chart among them, would leave the sentence standing
until the next release read it, where a predicate fails the pull request
that made it false.

**The six absences the design proposed.** Lost: the old status sentence
said there was no consistent read from Formancy Data and no AI that
proposes changes. Dropping them would have left the page saying less than
the one it replaced.

**An absence for charts.** Lost: it would need a predicate on the
renderer's refusal, and so the renderer as a devDependency of the pages,
for a sentence the change that prints charts removes. Saying nothing is no
claim.

**The healthcare page's forms card on `scripts/upstream-deps.test.mjs`
and `scripts/dependency-licences.mjs`,** as first proposed. Lost:
the first holds that an upstream version is exact, and the second admits
any permissive licence. Neither holds that formancy is for Angular and
React, under Apache-2.0, or what its editor does.

**A comparison on the pages,** a table or a sentence naming other
products. Lost: the comparison's counts rest on cells it marks "not
confirmed", so even "one of few" would be unbacked. And a claim about
another product is one no test here can hold.

**A check refusing competing products' names.** Lost: it would list them in a
public file, which is the naming it is meant to prevent.
