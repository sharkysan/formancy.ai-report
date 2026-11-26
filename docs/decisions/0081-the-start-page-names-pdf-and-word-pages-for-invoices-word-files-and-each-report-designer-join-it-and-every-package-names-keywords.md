# 0081 — The start page names PDF and Word; pages for invoices, Word files and each report designer stand beside the payment codes', each under a status of its own; and every published package names keywords and the start page as its homepage

- **Status:** accepted; numbered while 0069 was held for a workbook's
  export and 0070 to 0073 by another branch; extends
  [0021](0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md),
  whose site gains four page groups and whose healthcare page says
  Formancy Health is released,
  [0024](0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md)
  and [0028](0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md),
  whose page statuses the new pages carry too, and
  [0056](0056-the-start-page-leads-with-a-card-for-each-topic-report-is-built-around-every-card-on-the-site-names-the-tests-it-rests-on-and-no-page-compares-report-with-another-product.md),
  whose start page names PDF and Word in its head and whose rule that
  every card names its tests the new cards follow
- **Date:** 2026-11-25
- **Deciders:** Daniel Bacher
- **Verified by:** the pages' suite, which CI's `test` job runs, the
  pages' browser gate, which its `browser` job runs, and
  `pnpm test:repo`. What each case holds:
  - **`apps/pages/src/site.test.ts`.** Every check of 0021 over the pages
    the build writes, the four new groups' among them; the addresses, in
    `GROUPS`' order, each new slug a word of its language; the one error a
    release commit meets, which names the start page's status first and
    then every page's that carries one, the four new ones' each by its
    constant, its file and its four sentences; and the homepage every
    published package names, held to the address of the English start
    page the build writes, not to an address typed in the test.
  - **`apps/pages/src/evidence.test.ts`.** Every new card names one list
    of files, shared by every language's card, each a test or a gate's
    entry of the checkout, and each page shows its group's cards.
  - **`apps/pages/src/product.test.ts`.** The start page introduces every
    topic page with a card in `GROUPS`' order, and says on each card where
    its page stands.
  - **`apps/pages/src/studio-words.test.ts`.** Each Studio word a new
    page names -- the starters "Invoice", "Euro invoice", "E-invoice
    (Factur-X)", "E-invoice (XRechnung)" and "Payment reminder" under
    "Starter", "Final", "Download XML", "Download Word", "Download PDF",
    and "Builder" with its "Angular" and "React" -- is one a scene of
    `docs/images/readme/captured.json` says in quotes, and every page of
    its group says it.
  - **`apps/pages/src/figures.test.ts`.** The e-invoice and payment
    reminder starters' pictures quote, in every language's description,
    only lines `docs/images/pictures.json` records for them, and the
    Angular builder's picture only text `docs/images/readme/captured.json`
    records of its scene; every picture outside `readme/` quotes its page;
    every figure is a picture a page shows.
  - **`apps/pages/scripts/inputs.test.mjs`.** The repository the pages
    link is read from the published manifests' `repository.url`, and the
    homepage from their `homepage`; a case hands `publishedOf` manifests
    made for it and sees two repositories, one not on GitHub, two
    homepages and none each refused in its own words; and a picture of
    the Studio is given the lines `captured.json` records of its scene.
  - **`scripts/manifests.test.mjs`, in `pnpm test:repo`.** Every
    published manifest names keywords of its own, each lower case words
    joined by hyphens, none twice, "formancy" and "source-available" among
    them, and none that calls it open source; and all of them name one
    homepage over https. A case hands the check manifests made for it,
    one for each way it refuses one.
  - **`scripts/finalize-angular-dist.test.mjs`, in `pnpm test:repo`.**
    The Angular builder's built `dist/package.json`, the manifest npm
    shows for it, names the keywords and the homepage its source manifest
    names.
  - **`scripts/architecture.test.mjs` and
    `scripts/release-report/limitations.test.mjs`.** A section of the
    architecture links this record, its costs are in
    `docs/release/limitations.json`, and 0021, 0024, 0028 and 0056, whose
    Status lines it changed, were read again and stamped.
  - **The pages' browser gate, `apps/pages/scripts/browser-test.mjs`
    ([0053](0053-the-product-pages-are-measured-in-chromium-by-a-browser-gate-of-their-own.md)).**
    It measures every page of the built sitemap, the new ones and the
    longer bar among them, at 320 pixels and up, for sideways scroll, axe
    and the keyboard.

  Each guard this record adds was seen failing on 25 November 2026 with
  what it guards undone, then passing with it restored: report-spec's
  keywords removed failed `manifests.test.mjs`; every manifest's homepage
  moved to the German start page failed `site.test.ts`'s homepage case;
  `INVOICES_STATUS` written against 0.2.0 stopped the site rendering, in
  its one error; the Angular builder's quote changed to words its scene
  does not show, and the scenes' text left unread, each failed
  `figures.test.ts`, the second `inputs.test.mjs` too; the e-invoice
  starter's figure quoting nothing failed `figures.test.ts`; `publishedOf`
  taking the homepage for the repository again failed `inputs.test.mjs`;
  and the Angular builder's built manifest without its keywords failed
  `finalize-angular-dist.test.mjs`.

  What holds nothing:
  - whether a sentence claims more than its card's tests show, and every
    sentence outside a card -- the heads, the leads, the teasers, the
    pictures' descriptions and captions;
  - the Angular page's description's "standalone components and signals",
    which is the builder's README's and manifest's, and no card's;
  - the topic pages' sentence on the licence, which says again what
    `LICENSE.md`'s table says is free and what is paid, where the product
    page translates the table itself, row by row;
  - that formancy's Angular form builder page and Formancy Health's demo
    still answer at the addresses `links.ts` names;
  - what the healthcare page says of Formancy Health, read from that
    repository's README and changelog on 25 November 2026 and dated so;
  - that each keyword names what its own package does;
  - the translations, which no native speaker has reviewed;
  - whether a search engine or npm's search shows the pages and the
    packages for the words they use.

## Context

The pages 0021, 0024, 0028 and 0056 built say what Formancy Report does,
in four languages, every card on its tests. Read on 25 November 2026
against what a reader searches for, four things were missing:

- **The start page's head named PDF alone.** Its title, description and
  h1 said "PDF report designer", "PDF-Berichtsdesigner", though 0.3.0
  writes Word files (0068) and the hero's standing said so. A reader
  searching for a report designer that writes Word met no page that said
  so where a search engine reads first. And the German head said
  "Berichtsdesigner", where a German reader searching types
  "Reportdesigner".
- **No page answered for the documents a business sends.** The QR-bill
  page and the EPC QR code page each detail one code. Nothing put the
  invoice on one page: both codes, Factur-X and XRechnung, the payment
  reminder and the invoice as a Word file, though 0.3.0 holds each.
- **No page for the Word file, and none for each framework.** The Word
  writer (0068, 0074 to 0077) and the two builders (0012) were said in a
  card of the start page each, under no title a search engine shows.
- **npm showed nothing to search by.** No published manifest named a
  keyword, and every one's homepage was the repository, which its
  `repository` field names already. The pages' build read that homepage
  as the repository (`apps/pages/scripts/inputs.mjs`), so the homepage
  could not move without the pages' links to the source moving with it.

And the healthcare page still said, dated 17 October 2026, that Formancy
Health was in development with nothing released. Its 0.1.0, a developer
preview, was released on 19 October 2026.

## Decision

**The start page's head names PDF and Word.** Its title, description and
h1 say a report designer for PDF and Word, in each language's words: the
German "Reportdesigner", which its lead repeats, its one word for it. Its
lead names the documents a business sends and keeps, invoices,
quotations, order confirmations, payment reminders and sales reports,
each a starter, and that the renderer prints the PDF or the writer writes
the same report as a Word file. Its status, `START_STATUS`, is
unchanged: no sentence it governs moved.

**Four page groups join the site**, each in `GROUPS` and so built in
every language, linked from every page's bar and introduced by a card on
the start page, in this order: the start page, invoices, the QR-bill, the
EPC QR code, Word files, the Angular report designer, the React report
designer, healthcare.

| Group | de | fr | it | en |
|---|---|---|---|---|
| `invoices` | `rechnungen` | `factures` | `fatture` | `invoices` |
| `word` | `word-dateien` | `documents-word` | `documenti-word` | `word-documents` |
| `angular` | `angular-reportdesigner` | `concepteur-rapports-angular` | `designer-report-angular` | `angular-report-designer` |
| `react` | `react-reportdesigner` | `concepteur-rapports-react` | `designer-report-react` | `react-report-designer` |

Each slug is its language's words for what a reader searches for.

- **One layout, four copies.** `apps/pages/src/content/topic.tsx` is the
  layout the four share, in the QR-bill page's order -- a hero that says
  where the page stands, what it does, its pictures, how to try it, what
  it does not do, and its status -- and `topicGroup` makes each one's
  group. Each page's words are a copy of its own (`invoices-copy.tsx`,
  `word-copy.tsx`, `angular-copy.tsx`, `react-copy.tsx`), and its status
  and pictures a file of its own. Every card names its tests, as 0056
  holds every card to. The status says the licence in one sentence the
  layout holds for all four, what is free and what is paid, and links the
  licence's own address, read from `LICENSE.md`, to ask for a licence at.
- **Each says what a test shows, and what it does not do.** The invoices
  page puts every way Report bills on one page, each card a claim another
  record makes -- 0022, 0025, 0027, 0031, 0038, 0039, 0044, 0066, 0075,
  0077 -- and links the two payment code pages for the detail. Its French
  and Italian name Factur-X and XRechnung, never a "facture électronique"
  or a "fattura elettronica" alone, which a reader there takes for
  France's reform or Italy's FatturaPA, neither of which Report claims,
  and its limits say so. The Word files page says what the file states,
  never what Word does with it, and that no automated test opens a file
  in Word.
  Each builder's page claims what its own tests and the install gate
  show: the Angular one that it renders under zoneless change detection
  and brings in no React, the React one that a React host installs no
  Angular builder.
- **Each carries a status.** `INVOICES_STATUS`, `WORD_STATUS`,
  `ANGULAR_STATUS` and `REACT_STATUS`, each written against 0.3.0 on
  25 November 2026, as 0024's and 0028's are. Each names four sentences:
  `standing`, which the hero and the start page's card say, worded to
  stand on that card on its own; `tryIt.text`, which names the release;
  `status.text`, dated; and `limits.items`, what the page says it does
  not do, which a payment code page's status does not name. A chart in a builder's palette, a
  wider peer range or a frozen report format would each make one of them
  false, and the release commit is where somebody reads them again.
- **Their pictures.** The invoices page shows, in each language, an
  invoice with its QR-bill and a euro invoice with its EPC QR code in that
  language -- German's from Austria, since its own beside the e-invoice
  starter would be nearly the same German invoice twice -- each captioned
  by the kind of invoice it is, then the e-invoice starter and the payment
  reminder, figures of their own whose descriptions quote their pages. The
  Word page shows the Studio's Preview with Download Word, the Angular
  page the quotation in the Angular builder, and the React page the
  XRechnung in the React builder, a scene that builder alone draws, then
  the Studio's opening picture. A picture of the Studio, under
  `docs/images/readme/`, is no document's page: what its description
  quotes, the Angular builder's edited line, is held to the text
  `captured.json` records of its scene, as the README's descriptions are,
  and `figures.test.ts` asks a quote of every other picture.
- **A document's page for a shared link.** Each page names its picture
  for a shared link apart from its pictures: the invoices and Word files
  pages the invoice with its QR-bill in their language, the builders'
  pages the quotation, as the start page does. Each is a PNG of a page,
  as every page's is, never a picture of the Studio.
- **Two more addresses.** The Angular page links formancy's Angular form
  builder, `FORMANCY_ANGULAR` in `links.ts`, and the healthcare page
  Formancy Health's demo, `FORMANCY_HEALTH_DEMO`, which the link check
  admits beside the few addresses it already did.

**The healthcare page says Formancy Health is released.** Its 0.1.0, a
developer preview, since 19 October 2026, not yet for the production
export of a person's record, and what it exports: a formancy form as an
SDC Questionnaire, a person's answers as its QuestionnaireResponse, a PDF
in a DocumentReference, a Swiss referral as CH ORF on CH Core; and it
links the demo on formancy.ai beside the repository. Nothing here reads
that repository, so `HEALTH_AS_OF` dates it, now 25 November 2026, and
no card claims it.

**Every published package names keywords and the start page.** Each
published manifest names keywords for what that package does, among them
"formancy" and "source-available", and never one that calls it open
source. Each names `https://formancy.ai/report/en/`, the English start
page, as its homepage; its `repository` still names the repository. The
pages' build reads the repository from `repository.url` and the homepage
from `homepage` (`publishedOf`), each refused unless the packages name
one alone, and the pages' suite holds the homepage to the English start
page it builds. `scripts/manifests.test.mjs` holds the keywords and the
one homepage in `pnpm test:repo`, and `finalize-angular-dist.test.mjs`
the Angular builder's built manifest, which npm shows, to its source's.
The private corpus names none.

## Consequences

**What it buys.**
- **A page for each thing a reader searches for,** in the reader's
  language, each with its own title and description, each held by every
  check 0021 and 0056 hold a page to.
- **npm says what each package is for,** in words its search reads, and
  sends a reader to the pages, where the terms are.
- **The healthcare page says what is true** of Formancy Health, dated.

**What it costs.**
- **Four more statuses at every release.** The release commit reads four
  more pages again, four sentences each in four languages, beside the
  start page's and the payment code pages', and sets four more constants
  (`RELEASING.md`, step 2). The site refuses to render until it has.
- **Claims said twice.** The invoices page says in a card what the
  QR-bill and EPC QR code pages say at length, and the builder pages what
  the start page's "two native editors" card says. Each card names its
  tests, and nothing compares the words of two cards that make one
  claim: a change to the code meets every card whose tests it breaks,
  and only review meets a card whose words it outdates.
- **A longer bar.** Seven topic pages, the Studio and the source wrap to
  several lines on a narrow screen. The browser gate measures that
  nothing scrolls sideways; how it looks is review's. The topic pages'
  names in the bar are short for this: "Angular" and "React" stand for
  the report designers.
- **Pictures of the Studio are described by review.** A quote in their
  descriptions is held to the scene's recorded text, and the Studio's
  words a page names to the Studio's; the rest of what a description says
  of a picture of the Studio is review's.
- **Portrait pictures for a shared link.** Every page that names a
  picture for a shared link names an A4 page, taller than wide, which a
  large link preview crops; no landscape picture of a document is there
  to name instead.
- **The licence said twice.** Each topic page's status says what
  `LICENSE.md`'s table says is free and what is paid, in a sentence the
  layout holds once for the four pages; a change of terms is met by the
  product page, which refuses a row it has no words for, and by review
  here.
- **The homepage moves.** npm's homepage link on every package now leads
  to the pages, not the repository, which its repository link still
  reaches. A slug renamed or the default language changed fails the
  pages' suite until every manifest names the new address.
- **Keywords are review's beyond their shape.** The guard reads their
  form, the shared two and the open-source spellings it lists, not
  whether "invoice" belongs on a package; a misleading keyword in a new
  spelling passes it.
- **Another repository's facts on a page.** What the healthcare page says
  of Formancy Health is that repository's, read by hand and dated, and
  goes stale silently until somebody reads it again.
- **Translations nobody reviewed.** The new pages' German, French and
  Italian are their author's. The German is Switzerland's spelling.
- **Copies past half their bound.** Each new copy, and `figures.tsx`,
  holds more than half the 600 lines `scripts/source-size.test.mjs`
  allows, on 25 November 2026: a ninth card or a fifth language splits
  one by the reason to change.

**What it forecloses.** Nothing that cannot be undone. A group can leave
`GROUPS`, and its addresses then answer 404 until something redirects
them.

## Alternatives considered

**One page for both builders.** Lost: a reader searches for a report
designer for the framework they use, and one page has one title. The two
pages share a layout and their words follow one another, each over its
own builder's tests.

**An e-invoice page of its own,** beside the invoices page. Lost for
now: a reader's job is the invoice, Factur-X and XRechnung are two of its
forms, and the payment code pages already detail the two codes. An
e-invoice page can follow when there is more to say than a card.

**Each page's layout its own file,** as the QR-bill and EPC QR code pages
have. Lost: the four say the same parts in the same order, and four
layouts are four places one change of layout must be made.

**No status on the new pages.** Lost: their limits are true of 0.3.0, and
a release can make one false -- a chart in the palette, a wider peer
range -- while the page goes on saying it.

**The homepage left as the repository.** Lost: npm shows the repository
link beside it already, and the homepage is where a reader of npm meets
the terms.

**The first picture as the picture for a shared link.** Lost: it gave
three pages a picture of the Studio for a shared link, a WebP some link
previews may not draw, one of them taller than wide, where every other
page names a PNG of a document's page.

**Pictures of the Studio described without a document's words.** Lost:
the Angular builder's edited line is what its picture shows, and
`captured.json` records the scene's text, so the quote is held as the
README's is.

**The keywords held by `scripts/verify-licenses.mjs`.** Lost: that
script's subject is the licence a tarball carries, and a test in
`pnpm test:repo` states each way it refuses a manifest as a case of its
own.

**The healthcare page's account of Formancy Health as a card.** Lost:
no test of this checkout holds what that repository does, so a card
would rest on nothing a release report here sees.
